// Pure economy formulas. No DOM, no rendering.
import { CFG, CREW, MATERIALS, MAX_DEPTH, TOOLS, type Crew, type CrewId, type Material } from './config';
import type { State } from './state';

export const materialAt = (d: number): Material => {
  let m = MATERIALS[0];
  for (const x of MATERIALS) if (d >= x.from) m = x;
  return m;
};

/** Multiplier on all cash. */
export const valueAt = (d: number) => Math.pow(1 + d / CFG.valueDiv, CFG.valueExp);
/** HP of one face chunk at depth d. */
export const chunkHp = (d: number) => materialAt(d).stages * materialAt(d).hpPerStage;

export const mult = (s: State) => 1 + CFG.findMultBonus * s.found;
export const clickPower = (s: State) => TOOLS[s.tool].pow * mult(s);
export const hitCash = (power: number, d: number) => power * CFG.cashPerPower * valueAt(d);
export const breakCash = (d: number) => CFG.breakCash * valueAt(d);

export const crewDef = (id: CrewId): Crew => CREW.find((c) => c.id === id)!;
export const crewCost = (s: State, id: CrewId) =>
  Math.ceil(crewDef(id).cost * Math.pow(CFG.crewCostGrowth, s.crew[id]));
export const crewBoost = (s: State) => 1 + CREW.reduce((a, c) => a + c.boost * s.crew[c.id], 0);
/** Raw dig power per second of one crew type (all units), including boosts. */
export const crewTypeDps = (s: State, id: CrewId) => crewDef(id).dps * s.crew[id] * crewBoost(s) * mult(s);
export const crewDps = (s: State) => CREW.reduce((a, c) => a + crewTypeDps(s, c.id), 0);

/** Meters per second crew dig at depth d (analytic; used offline and for HUD). */
export const crewMps = (s: State, d = s.depth) =>
  d >= MAX_DEPTH ? 0 : (crewDps(s) / chunkHp(d)) * materialAt(d).metersPerBreak;
/** Crew cash per second (analytic). */
export const crewIncome = (s: State, d = s.depth) =>
  crewDps(s) * CFG.cashPerPower * valueAt(d) + (crewDps(s) / chunkHp(d)) * breakCash(d);
