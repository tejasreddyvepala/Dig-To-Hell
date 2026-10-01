// Persistent game state + save/load. The only module that touches localStorage.
import { CFG, CREW, FINDS, MAX_DEPTH, TOOLS, type CrewId } from './config';

export interface State {
  version: number;
  cash: number;
  depth: number;
  tool: number;
  crew: Record<CrewId, number>;
  found: number;
  last: number;
  clicks: number;
}

export function fresh(): State {
  return {
    version: CFG.saveVersion, cash: 0, depth: 0, tool: 0,
    crew: { dig: 0, cart: 0, exc: 0 }, found: 0, last: Date.now(), clicks: 0,
  };
}

export const S: State = fresh();

const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

/** Validate a parsed save. Anything from another version is discarded (fresh run). */
export function sanitize(o: any): State | null {
  if (!o || typeof o !== 'object' || o.version !== CFG.saveVersion) return null;
  const s = fresh();
  s.cash = num(o.cash, 0, 1e15, 0);
  s.depth = num(o.depth, 0, MAX_DEPTH, 0);
  s.tool = Math.floor(num(o.tool, 0, TOOLS.length - 1, 0));
  for (const c of CREW) s.crew[c.id] = Math.floor(num(o.crew?.[c.id], 0, 1e4, 0));
  s.found = Math.floor(num(o.found, 0, FINDS.length, 0));
  s.last = num(o.last, 0, Date.now(), Date.now());
  s.clicks = Math.floor(num(o.clicks, 0, 1e9, 0));
  return s;
}

/** Load into S. Returns seconds elapsed since the last save (0 if none). */
export function loadState(): number {
  try {
    for (const k of CFG.legacySaveKeys) localStorage.removeItem(k);
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return 0;
    const s = sanitize(JSON.parse(raw));
    if (!s) return 0;
    Object.assign(S, s);
    return Math.max(0, (Date.now() - s.last) / 1000);
  } catch (e) {
    console.warn('Save load failed; starting fresh', e);
    return 0;
  }
}

export function saveState() {
  S.last = Date.now();
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify(S));
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function resetState() {
  Object.assign(S, fresh());
}
