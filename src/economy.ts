// Pure economy formulas. No DOM, no rendering.
import { CFG, CREW, MATERIALS, MAX_DEPTH, RESOURCES, TOOLS, UPGRADES, type Crew, type CrewId, type Material, type UpgradeId } from './config';
import type { Load, State } from './state';

export const materialAt = (d: number): Material => {
  let m = MATERIALS[0];
  for (const x of MATERIALS) if (d >= x.from) m = x;
  return m;
};

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
/** Meters per second crew dig at depth d (analytic; used offline). */
export const crewMps = (s: State, d = s.depth) =>
  d >= MAX_DEPTH ? 0 : (crewDps(s) / chunkHp(d)) * materialAt(d).metersPerBreak;
/** Rubble units per second crew produce (analytic). */
export const crewRubbleRate = (s: State, d = s.depth) =>
  d >= MAX_DEPTH ? 0 : (crewDps(s) / chunkHp(d)) * CFG.rubble.perBreak;

// ---- loads ----
export function addTo(l: Load, qty: number, unitVal: number) { l.qty += qty; l.val += qty * unitVal; }
/** Move up to `qty` units from a to b, carrying average value. Returns units moved. */
export function moveLoad(a: Load, b: Load, qty: number): number {
  const q = Math.max(0, Math.min(qty, a.qty));
  if (q <= 0) return 0;
  const v = a.qty > 0 ? (a.val * q) / a.qty : 0;
  a.qty -= q; a.val -= v; b.qty += q; b.val += v;
  if (a.qty < 1e-9) { a.qty = 0; a.val = 0; }
  return q;
}

// ---- transport ----
export const upgDef = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;
export const upgCost = (s: State, id: UpgradeId) => {
  const u = upgDef(id);
  return Math.ceil(u.baseCost * Math.pow(u.growth, s.upg[id]));
};
const C = CFG.cart;
export const cartCapacity = (s: State) => Math.round(C.capacity.base * (1 + C.capacity.perLevel * s.upg.cartCap));
export const loadRate = (s: State) => C.loadRate.base * (1 + C.loadRate.perLevel * s.upg.loadSpeed);
export const railMult = (s: State) => 1 + C.railPerLevel * s.upg.rail;
export const cartSpeed = (s: State) => C.speed.base * (1 + C.speed.perLevel * s.upg.cartSpeed) * railMult(s);
/** One-way trip time between the surface and depth d. Linear in depth: deep transport matters, never explodes. */
export const travelTime = (s: State, d: number) => C.baseTravel + (d + C.surfaceLiftM) / cartSpeed(s);
/** Highest threshold index reached by `level` (visual tier). */
export const tierOf = (level: number, tiers: number[]) => tiers.reduce((t, at, i) => (level >= at ? i : t), 0);
