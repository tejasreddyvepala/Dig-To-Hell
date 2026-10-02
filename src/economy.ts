// Pure economy formulas. No DOM, no rendering.
import { CFG, CREW, MAX_DEPTH, PROJECTS, RESOURCES, TOOLS, TRACK_TIERS, UPGRADES, WORKSITES, type Crew, type CrewId, type UpgradeId } from './config';
import type { Load, State } from './state';
import type { MaterialId } from './config';

export { materialAt } from './geo';
import { materialAt } from './geo';

/** Value of one unit of material dug at depth d (realised only when sold). */
export const valueAt = (d: number) => Math.pow(1 + d / CFG.valueDiv, CFG.valueExp);
export const unitValue = (d: number) => RESOURCES.rubble.baseValue * valueAt(d);
/** HP of one face chunk at depth d. */
export const chunkHp = (d: number) => materialAt(d).stages * materialAt(d).hpPerStage;

export const mult = (s: State) => 1 + CFG.findMultBonus * s.found;
export const clickPower = (s: State) => TOOLS[s.tool].pow * mult(s);

// ---- crew ----
export const crewDef = (id: CrewId): Crew => CREW.find((c) => c.id === id)!;
export const crewCost = (s: State, id: CrewId) =>
  Math.ceil(crewDef(id).cost * Math.pow(CFG.crewCostGrowth, s.crew[id]));
/** Raw dig power per second of one crew type (all units). */
export const crewTypeDps = (s: State, id: CrewId) => crewDef(id).dps * s.crew[id] * mult(s);
export const crewDps = (s: State) => CREW.reduce((a, c) => a + crewTypeDps(s, c.id), 0);
/** Share of time a crew type is actually digging (diggers rest; machines don't). */
const uptime = (id: CrewId) => (id === 'dig' ? CFG.rest.uptime : 1);
/** Meters per second crew dig at depth d (analytic; used offline). */
export const crewMps = (s: State, d = s.depth) =>
  d >= MAX_DEPTH ? 0 : (CREW.reduce((a, c) => a + crewTypeDps(s, c.id) * uptime(c.id), 0) / chunkHp(d)) * materialAt(d).metersPerBreak;
/** Rubble units per second crew produce (analytic): bigger machines yield more per break. */
export const crewRubbleRate = (s: State, d = s.depth) =>
  d >= MAX_DEPTH ? 0 : CREW.reduce((a, c) => a + (crewTypeDps(s, c.id) * uptime(c.id) / chunkHp(d)) * CFG.rubble.perBreak * c.yield, 0);
/** Can this crew type be hired now (depth, worksite tier, ownership cap)? */
export const crewAvailable = (s: State, id: CrewId) => {
  const c = crewDef(id);
  return s.depth >= c.unlockDepth && s.worksite >= c.needsTier && s.crew[id] < c.max;
};

// ---- loads (quantity + value + material composition travel together) ----
export function addTo(l: Load, qty: number, unitVal: number, mat: MaterialId) {
  l.qty += qty; l.val += qty * unitVal; l.mix[mat] = (l.mix[mat] ?? 0) + qty;
}
/** Move up to `qty` units from a to b, carrying average value and material mix. Returns units moved. */
export function moveLoad(a: Load, b: Load, qty: number): number {
  const q = Math.max(0, Math.min(qty, a.qty));
  if (q <= 0) return 0;
  const f = a.qty > 0 ? q / a.qty : 0;
  const v = a.val * f;
  for (const id in a.mix) {
    const k = id as MaterialId, m = a.mix[k]! * f;
    a.mix[k] = a.mix[k]! - m; b.mix[k] = (b.mix[k] ?? 0) + m;
    if (a.mix[k]! < 1e-9) delete a.mix[k];
  }
  a.qty -= q; a.val -= v; b.qty += q; b.val += v;
  if (a.qty < 1e-9) { a.qty = 0; a.val = 0; a.mix = {}; }
  return q;
}
/** Material whose share of the load reaches cumulative fraction r (0..1): used to colour pieces by composition. */
export function mixPick(l: Load, r: number): MaterialId {
  let acc = 0, last: MaterialId = 'dirt';
  for (const id in l.mix) { last = id as MaterialId; acc += l.mix[last]! / Math.max(1e-9, l.qty); if (r <= acc) return last; }
  return last;
}

// ---- transport ----
export const upgDef = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;
export const upgCost = (s: State, id: UpgradeId) => {
  if (id === 'rail') return nextTrack(s)?.cost ?? Infinity; // Track Strength: priced per physical tier
  const u = upgDef(id);
  return Math.ceil(u.baseCost * Math.pow(u.growth, s.upg[id]));
};
const C = CFG.cart;
export const cartCapacity = (s: State) => Math.round(C.capacity.base * (1 + C.capacity.perLevel * s.upg.cartCap));
export const loadRate = (s: State) => C.loadRate.base * (1 + C.loadRate.perLevel * s.upg.loadSpeed);
export const trackDef = (s: State) => TRACK_TIERS[Math.min(s.upg.rail, TRACK_TIERS.length - 1)];
export const nextTrack = (s: State) => TRACK_TIERS[s.upg.rail + 1];
export const trackSafe = (s: State) => trackDef(s).safe;
export type TrackStress = 'safe' | 'strained' | 'over';
/** How hard a given cart load works the current track (loadRatio = load / safe load). */
export function trackStress(s: State, load: number): TrackStress {
  const r = load / trackSafe(s);
  return r > 1 + 1e-9 ? 'over' : r >= CFG.track.strainedAt ? 'strained' : 'safe';
}
export const railMult = (s: State) => trackDef(s).speed;
export const cartSpeed = (s: State) => C.speed.base * (1 + C.speed.perLevel * s.upg.cartSpeed) * railMult(s);
/** One-way trip time between the surface and depth d. Linear in depth: deep transport matters, never explodes. */
export const travelTime = (s: State, d: number) => C.baseTravel + (d + C.surfaceLiftM) / cartSpeed(s);
/** Highest threshold index reached by `level` (visual tier). */
export const tierOf = (level: number, tiers: number[]) => tiers.reduce((t, at, i) => (level >= at ? i : t), 0);

// ---- processing (the Recycling Yard) ----
const P = CFG.yard;
export const rawCap = (s: State) => Math.round(P.rawStorage.base * (1 + P.rawStorage.perLevel * s.upg.rawStorage));
/** Raw units/s the crusher + press turn into finished blocks. */
export const processRate = (s: State) => P.processRate.base * (1 + P.processRate.perLevel * s.upg.processSpeed);
/** $ per unit of carried material value, paid when a loaded truck departs. */
export const contractPrice = (s: State) => P.price.base * (1 + P.price.perLevel * s.upg.contractValue);

// ---- construction (where value is created) ----
/** Sale value of the current project's property (Block Quality raises it). */
export const projectValue = (s: State, project = s.build.project) =>
  Math.round(PROJECTS[project].value * (1 + P.price.perLevel * s.upg.contractValue));
/** Milestone payment for completing one stage. */
export const stagePayment = (s: State) => Math.round(projectValue(s) * CFG.build.stagePay);
export const projectBlocks = (project: number) => PROJECTS[project].stages.reduce((a, st) => a + st.blocks, 0);
/** 0..1 physical completion of the current project (drives the building drawing). */
export function buildProgress(s: State) {
  const p = PROJECTS[s.build.project];
  if (s.build.done) return 1;
  let used = 0;
  for (let i = 0; i < s.build.stage; i++) used += p.stages[i].blocks;
  return (used + s.build.used) / projectBlocks(s.build.project);
}
// ---- worksite ----
export const nextWorksite = (s: State) => WORKSITES[s.worksite + 1];
export const worksiteAvailable = (s: State) => !!nextWorksite(s) && s.crew.dig >= nextWorksite(s).unlockCrew;
