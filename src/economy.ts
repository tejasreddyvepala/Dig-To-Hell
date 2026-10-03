// Pure economy formulas. No DOM, no rendering.
import { CFG, CREW, MAX_DEPTH, PROJECTS, RESOURCES, TOOLS, TRACK_TIERS, UPGRADES, WORKSITES, type Crew, type CrewId, type UpgradeId } from './config';
import type { Load, State } from './state';
import type { MaterialId } from './config';

export { materialAt } from './geo';
import { materialAt } from './geo';

// ===== ECONOMY: the one authoritative source of production rates and payouts (Spec §3.1). UI, sim and offline all
// call these; never re-derive a rate elsewhere. =====

/** BLOCK VALUE of one unit of material dug at depth d. It travels with the material (Load.val) all the way into the
 *  building, so deeper rock pays off through construction (never as a direct depth reward). */
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
/** Chunk breaks per second of one crew type at depth d. Diggers wear the rock down (dps vs chunk HP); a machine bites
 *  a whole chunk every swing whatever the rock (that is why the Excavator matters deep down). Online strikes, the UI
 *  rate and offline progress all use THIS. */
export const crewBreaksPerSec = (s: State, id: CrewId, d = s.depth) => {
  if (d >= MAX_DEPTH || !s.crew[id]) return 0;
  const c = crewDef(id);
  if (id === 'exc') return s.worksite >= c.needsTier ? s.crew[id] / c.swingSecs : 0;
  return (crewTypeDps(s, id) * uptime(id)) / chunkHp(d);
};
/** Meters per second crew dig at depth d. */
export const crewMps = (s: State, d = s.depth) =>
  CREW.reduce((a, c) => a + crewBreaksPerSec(s, c.id, d), 0) * materialAt(d).metersPerBreak;
/** Rubble units per second crew produce at depth d. */
export const crewRubbleRate = (s: State, d = s.depth) =>
  CREW.reduce((a, c) => a + crewBreaksPerSec(s, c.id, d) * CFG.rubble.perBreak * c.yield, 0);
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
/** $ the contractor pays per unit of raw material value (his small sample purchase before the yard exists). */
export const contractPrice = (_s: State) => P.marketPrice;
/** Block Quality: multiplier stamped onto the value of every block pressed from now on (never retroactive). */
export const blockQualityMult = (s: State) => 1 + P.qualityPerLevel * s.upg.contractValue;

// ---- construction capacity (Construction Crew): builders lay blocks; the truck's runs grow with the crew ----
export const builders = (s: State) => CFG.build.baseBuilders + s.upg.crew;
export const constructionRate = (s: State) => CFG.build.perBuilder * builders(s);
const truckK = (s: State) => 1 + P.truck.perCrew * s.upg.crew;
export const truckCapacity = (s: State) => Math.round(P.truck.capacity * truckK(s));
export const truckLoadRate = (s: State) => P.truck.loadRate * truckK(s);
export const truckUnloadRate = (s: State) => P.truck.unloadRate * truckK(s);

// ---- construction (where value is created) ----
// A property's money follows the MATERIAL actually built into it:
//   stage payment = base value × milestoneShare × (stage blocks / project blocks) × avg block value of THAT stage
//   sale          = base value × avg block value of the WHOLE house × repeat factor
// Block value = depth value × Block Quality at pressing time, so neither depth nor quality can be applied retroactively.
export const projectBlocks = (project: number) => PROJECTS[project].stages.reduce((a, st) => a + st.blocks, 0);
/** TEMPORARY (until more projects exist): repeats of the last project sell for a little less each time. */
export function repeatFactor(s: State, project = s.build.project) {
  if (project !== PROJECTS.length - 1) return 1;
  const repeats = Math.max(0, s.stats.sold - (PROJECTS.length - 1));
  return Math.max(CFG.build.repeatFloor, 1 - CFG.build.repeatDecay * repeats);
}
/** Average block value going into the current project so far (falls back to what is on the plot, then to fresh rock). */
export function projectValueFactor(s: State) {
  const b = s.build;
  if (b.projQty > 1e-9) return b.projVal / b.projQty;
  if (b.material.qty > 1e-9) return b.material.val / b.material.qty;
  return valueAt(s.depth) * blockQualityMult(s);
}
/** Sale price of the current property (estimate while building; exact once complete). */
export const projectValue = (s: State, project = s.build.project) =>
  Math.round(PROJECTS[project].value * projectValueFactor(s) * repeatFactor(s, project));
/** Stage payment for stage `i` given the average block value `factor` used in it. */
export const stagePaymentFor = (s: State, i: number, factor: number, project = s.build.project) =>
  Math.round(PROJECTS[project].value * CFG.build.milestoneShare * (PROJECTS[project].stages[i].blocks / projectBlocks(project)) * factor * repeatFactor(s, project));
/** Estimated payment for the current/next stage (UI). */
export const stagePayment = (s: State) => {
  const b = s.build, i = Math.min(b.stage, PROJECTS[b.project].stages.length - 1);
  const f = b.active && b.used > 1e-9 ? b.stageVal / b.used : projectValueFactor(s);
  return stagePaymentFor(s, i, f);
};
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

// ---- site unlocks (pure; nav + art read these) ----
/** YARD opens when the first cart leaves for the surface. */
export const yardUnlocked = (s: State) => s.tut >= 3 || s.flags.dispatched;
/** BUILD opens when the first construction block comes off the press. */
export const buildUnlocked = (s: State) => s.stats.processed > 0 || s.stats.delivered > 0 || s.tut >= 5;
