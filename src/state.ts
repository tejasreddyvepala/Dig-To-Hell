import { CFG, CREW, FINDS, LAYERS, TOOLS, type CrewId, type Find, type Layer } from './config';

export interface State {
  cash: number;
  depth: number;
  tool: number;
  crew: Record<CrewId, number>;
  found: number;
  last: number;
  clicks: number;
}

export function fresh(): State {
  return { cash: 0, depth: 0, tool: 0, crew: { dig: 0, cart: 0, exc: 0, bore: 0, mole: 0 }, found: 0, last: Date.now(), clicks: 0 };
}

export const S: State = fresh();

// ---- economy ----
export const hardAt = (d: number) => Math.pow(1 + d / CFG.hardnessDepthDiv, CFG.hardnessExp);
export const valAt = (d: number) => hardAt(d) * (1 + d / CFG.valueDepthDiv);
export const layerAt = (d: number): Layer => {
  let L = LAYERS[0];
  for (const l of LAYERS) if (d >= l.from) L = l;
  return L;
};
export const mult = () => 1 + CFG.findMultBonus * S.found;
export const clickVal = () => TOOLS[S.tool].pow * mult() * (1 + S.depth / CFG.valueDepthDiv);
export const crewCost = (id: CrewId) => {
  const c = CREW.find((x) => x.id === id)!;
  return Math.ceil(c.cost * Math.pow(CFG.crewCostGrowth, S.crew[id]));
};
export const crewMps = () => CREW.reduce((s, c) => s + c.rate * S.crew[c.id], 0) * mult();
export const incomePerSec = () => crewMps() * (1 + S.depth / CFG.valueDepthDiv);

// ---- simulation ----
export interface FindEvent { f: Find; bonus: number }
export const pendingFinds: FindEvent[] = [];

export function checkFinds(silent: boolean) {
  while (S.found < FINDS.length && S.depth >= FINDS[S.found].d) {
    const f = FINDS[S.found];
    const b = CFG.findBonus;
    const bonus = Math.max(b.min, incomePerSec() * b.incomeSecs, clickVal() * b.clicks);
    S.found++;
    S.cash += bonus;
    if (!silent) pendingFinds.push({ f, bonus });
  }
}

/** Crew digging for dt seconds. */
export function crewTick(dt: number) {
  const m = (crewMps() / hardAt(S.depth)) * dt;
  S.cash += m * valAt(S.depth);
  S.depth += m;
}

/** Integrate crew digging in steps so hardness changes are respected. */
export function advance(secs: number) {
  let left = secs;
  while (left > 0) {
    const dt = Math.min(left, CFG.offlineStepSecs);
    crewTick(dt);
    left -= dt;
    checkFinds(true);
  }
}

// ---- persistence ----
export interface OfflineReport { secs: number; dm: number; dc: number }

export function load(): OfflineReport | null {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const base = fresh();
    Object.assign(S, base, o);
    S.crew = Object.assign(base.crew, o.crew || {});
    const secs = Math.min(CFG.offlineCapSecs, Math.max(0, (Date.now() - (o.last || Date.now())) / 1000));
    if (secs > CFG.offlineMinSecs && crewMps() > 0) {
      const d0 = S.depth, c0 = S.cash;
      advance(secs);
      return { secs, dm: S.depth - d0, dc: S.cash - c0 };
    }
  } catch (e) {
    console.warn('Save load failed', e);
  }
  return null;
}

export function save() {
  S.last = Date.now();
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify(S));
  } catch (e) {
    /* storage unavailable: play on without saving */
  }
}

export function resetState() {
  Object.assign(S, fresh());
  pendingFinds.length = 0;
}
