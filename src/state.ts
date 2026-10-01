// Persistent game state + save/load/migration. The only module that touches localStorage.
import { CFG, CREW, FINDS, MAX_DEPTH, TOOLS, UPGRADES, type CrewId, type UpgradeId } from './config';

/** A quantity of material with its accumulated value (value realised only when sold). */
export interface Load { qty: number; val: number }

export type CartState =
  | 'BOTTOM_EMPTY' | 'LOADING' | 'READY' | 'TRAVELLING_UP' | 'SURFACE_ARRIVAL' | 'UNLOADING' | 'TRAVELLING_DOWN';
export const CART_STATES: CartState[] =
  ['BOTTOM_EMPTY', 'LOADING', 'READY', 'TRAVELLING_UP', 'SURFACE_ARRIVAL', 'UNLOADING', 'TRAVELLING_DOWN'];

export interface CartSave {
  state: CartState;
  t: number; // secs spent in the current state
  dur: number; // planned duration of the current state (travel/unload); 0 when open-ended
  from: number; // depth the cart left from (TRAVELLING_UP)
  load: Load;
}

export interface State {
  version: number;
  cash: number;
  depth: number;
  tool: number;
  crew: Record<CrewId, number>;
  found: number;
  last: number;
  clicks: number;
  rubble: Load; // waiting in the pile at the dig site
  cart: CartSave;
  surface: Load; // unloaded at the surface (sold in Phase 3C)
  upg: Record<UpgradeId, number>;
  stall: boolean; // Scrap Stall built (the permanent seller)
  flags: { dispatched: boolean; arrived: boolean; sold: boolean; storageSeen: boolean };
  stats: { earned: number; sold: number }; // lifetime cash from sales, units sold
}

export const emptyLoad = (): Load => ({ qty: 0, val: 0 });

export function fresh(): State {
  return {
    version: CFG.saveVersion, cash: 0, depth: 0, tool: 0,
    crew: { dig: 0, exc: 0 }, found: 0, last: Date.now(), clicks: 0,
    rubble: emptyLoad(),
    cart: { state: 'BOTTOM_EMPTY', t: 0, dur: 0, from: 0, load: emptyLoad() },
    surface: emptyLoad(),
    upg: { cartCap: 0, cartSpeed: 0, loadSpeed: 0, rail: 0, sellSpeed: 0, sellValue: 0, storage: 0 },
    stall: false,
    flags: { dispatched: false, arrived: false, sold: false, storageSeen: false },
    stats: { earned: 0, sold: 0 },
  };
}

export const S: State = fresh();

const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
const load = (o: any): Load => ({ qty: num(o?.qty, 0, 1e12, 0), val: num(o?.val, 0, 1e18, 0) });

/** Validate a parsed save of the current version, or migrate an older supported one. */
export function sanitize(o: any): State | null {
  if (!o || typeof o !== 'object') return null;
  if (o.version !== CFG.saveVersion && o.version !== CFG.migrateFrom.version) return null;
  const s = fresh();
  s.cash = num(o.cash, 0, 1e15, 0);
  s.depth = num(o.depth, 0, MAX_DEPTH, 0);
  s.tool = Math.floor(num(o.tool, 0, TOOLS.length - 1, 0));
  for (const c of CREW) s.crew[c.id] = Math.floor(num(o.crew?.[c.id], 0, 1e4, 0));
  s.found = Math.floor(num(o.found, 0, FINDS.length, 0));
  s.last = num(o.last, 0, Date.now(), Date.now());
  s.clicks = Math.floor(num(o.clicks, 0, 1e9, 0));
  if (o.version === CFG.migrateFrom.version) return s; // v2 had no transport: cart starts empty at the bottom

  s.rubble = load(o.rubble);
  s.surface = load(o.surface);
  for (const u of UPGRADES) s.upg[u.id] = Math.floor(num(o.upg?.[u.id], 0, u.maxLevel, 0));
  s.flags.dispatched = !!o.flags?.dispatched;
  s.flags.arrived = !!o.flags?.arrived;
  s.flags.sold = !!o.flags?.sold;
  s.flags.storageSeen = !!o.flags?.storageSeen;
  s.stall = !!o.stall;
  s.stats.earned = num(o.stats?.earned, 0, 1e18, 0);
  s.stats.sold = num(o.stats?.sold, 0, 1e15, 0);
  const c = o.cart;
  if (c && CART_STATES.includes(c.state)) {
    s.cart = {
      state: c.state, t: num(c.t, 0, 1e6, 0), dur: num(c.dur, 0, 1e6, 0),
      from: num(c.from, 0, MAX_DEPTH, s.depth), load: load(c.load),
    };
  } else {
    // unknown cart state: keep its contents (never destroy material) and put it back at the bottom
    s.cart.load = load(c?.load);
    s.cart.state = s.cart.load.qty > 0 ? 'LOADING' : 'BOTTOM_EMPTY';
  }
  return s;
}

/** Load into S. Returns seconds elapsed since the last save (0 if none). */
export function loadState(): number {
  try {
    for (const k of CFG.legacySaveKeys) localStorage.removeItem(k);
    let raw = localStorage.getItem(CFG.saveKey);
    if (!raw) raw = localStorage.getItem(CFG.migrateFrom.key);
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
    localStorage.removeItem(CFG.migrateFrom.key); // only after the migrated save is safely written
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function resetState() {
  Object.assign(S, fresh());
}
