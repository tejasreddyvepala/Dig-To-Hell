// Persistent game state + save/load/migration. The only module that touches localStorage.
import { CFG, CREW, FINDS, MATERIALS, MAX_DEPTH, TOOLS, UPGRADES, type CrewId, type MaterialId, type UpgradeId } from './config';

/** Material composition of a load (units per source material); sums to qty. */
export type Mix = Partial<Record<MaterialId, number>>;
/** A quantity of material with its accumulated value (realised only when delivered) and where it came from. */
export interface Load { qty: number; val: number; mix: Mix }

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

export type TruckState = 'NONE' | 'ARRIVING' | 'LOADING' | 'DEPARTING';
export const TRUCK_STATES: TruckState[] = ['NONE', 'ARRIVING', 'LOADING', 'DEPARTING'];
export interface TruckSave {
  state: TruckState;
  t: number;
  dur: number;
  load: Load; // finished blocks on the truck bed
  n: number; // deliveries so far (deterministic truck colour)
  paid: number; // cash credited for the current departure (for the popup)
  bed: number; // visual only: blocks drawn on a departing truck (already delivered + paid; not material)
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
  raw: Load; // raw material at the surface (hopper / ground pile)
  goods: Load; // finished recycled blocks waiting for a truck
  truck: TruckSave;
  upg: Record<UpgradeId, number>;
  yard: boolean; // Recycling Yard built
  flags: { dispatched: boolean; arrived: boolean; sold: boolean; storageSeen: boolean };
  stats: { earned: number; delivered: number; processed: number }; // lifetime cash, units delivered by truck, units processed
}

export const emptyLoad = (): Load => ({ qty: 0, val: 0, mix: {} });

export function fresh(): State {
  return {
    version: CFG.saveVersion, cash: 0, depth: 0, tool: 0,
    crew: { dig: 0, exc: 0 }, found: 0, last: Date.now(), clicks: 0,
    rubble: emptyLoad(),
    cart: { state: 'BOTTOM_EMPTY', t: 0, dur: 0, from: 0, load: emptyLoad() },
    raw: emptyLoad(),
    goods: emptyLoad(),
    truck: { state: 'NONE', t: 0, dur: 0, load: emptyLoad(), n: 0, paid: 0, bed: 0 },
    upg: { cartCap: 0, cartSpeed: 0, loadSpeed: 0, rail: 0, processSpeed: 0, contractValue: 0, rawStorage: 0 },
    yard: false,
    flags: { dispatched: false, arrived: false, sold: false, storageSeen: false },
    stats: { earned: 0, delivered: 0, processed: 0 },
  };
}

export const S: State = fresh();

const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
const IDS = MATERIALS.map((m) => m.id);
const matIdAt = (d: number): MaterialId => { let id = IDS[0]; for (const m of MATERIALS) if (d >= m.from) id = m.id; return id; };

/** Validate a saved load. A missing/invalid mix is inferred from `guessDepth` (older saves had no composition). */
function load(o: any, guessDepth: number): Load {
  const l: Load = { qty: num(o?.qty, 0, 1e12, 0), val: num(o?.val, 0, 1e18, 0), mix: {} };
  let sum = 0;
  for (const id of IDS) { const v = num(o?.mix?.[id], 0, 1e12, 0); if (v > 0) { l.mix[id] = v; sum += v; } }
  if (l.qty <= 0) { l.mix = {}; l.val = 0; return l; }
  if (sum <= 0) l.mix = { [matIdAt(guessDepth)]: l.qty };
  else if (Math.abs(sum - l.qty) > 1e-6) for (const id of IDS) if (l.mix[id]) l.mix[id] = (l.mix[id]! * l.qty) / sum; // renormalise
  return l;
}

/** Validate a parsed save of the current version, or migrate an older supported one. Never duplicates material or cash. */
export function sanitize(o: any): State | null {
  if (!o || typeof o !== 'object') return null;
  const v = o.version;
  if (v !== CFG.saveVersion && !CFG.migrateFrom.some((m) => m.version === v)) return null;
  const s = fresh();
  s.cash = num(o.cash, 0, 1e15, 0);
  s.depth = num(o.depth, 0, MAX_DEPTH, 0);
  s.tool = Math.floor(num(o.tool, 0, TOOLS.length - 1, 0));
  for (const c of CREW) s.crew[c.id] = Math.floor(num(o.crew?.[c.id], 0, 1e4, 0));
  s.found = Math.floor(num(o.found, 0, FINDS.length, 0));
  s.last = num(o.last, 0, Date.now(), Date.now());
  s.clicks = Math.floor(num(o.clicks, 0, 1e9, 0));
  if (v === 2) return s; // v2 had no transport: cart starts empty at the bottom

  s.rubble = load(o.rubble, s.depth);
  s.flags.dispatched = !!o.flags?.dispatched;
  s.flags.arrived = !!o.flags?.arrived;
  s.flags.sold = !!o.flags?.sold;
  s.flags.storageSeen = !!o.flags?.storageSeen;
  s.stats.earned = num(o.stats?.earned, 0, 1e18, 0);
  const c = o.cart;
  if (c && CART_STATES.includes(c.state)) {
    const from = num(c.from, 0, MAX_DEPTH, s.depth);
    s.cart = { state: c.state, t: num(c.t, 0, 1e6, 0), dur: num(c.dur, 0, 1e6, 0), from, load: load(c.load, from) };
  } else {
    // unknown cart state: keep its contents (never destroy material) and put it back at the bottom
    s.cart.load = load(c?.load, s.depth);
    s.cart.state = s.cart.load.qty > 0 ? 'LOADING' : 'BOTTOM_EMPTY';
  }

  if (v === 3) {
    // Phase 3C seller model -> Phase 3C.5 Recycling Yard (stock becomes raw material; stall becomes the yard)
    s.raw = load(o.surface, s.depth * 0.6);
    s.yard = !!o.stall;
    s.upg.cartCap = Math.floor(num(o.upg?.cartCap, 0, 30, 0));
    s.upg.cartSpeed = Math.floor(num(o.upg?.cartSpeed, 0, 30, 0));
    s.upg.loadSpeed = Math.floor(num(o.upg?.loadSpeed, 0, 30, 0));
    s.upg.rail = Math.floor(num(o.upg?.rail, 0, 20, 0));
    s.upg.processSpeed = Math.floor(num(o.upg?.sellSpeed, 0, 30, 0));
    s.upg.contractValue = Math.floor(num(o.upg?.sellValue, 0, 30, 0));
    s.upg.rawStorage = Math.floor(num(o.upg?.storage, 0, 30, 0));
    s.stats.delivered = num(o.stats?.sold, 0, 1e15, 0);
    return s;
  }

  s.raw = load(o.raw, s.depth * 0.6);
  s.goods = load(o.goods, s.depth * 0.6);
  for (const u of UPGRADES) s.upg[u.id] = Math.floor(num(o.upg?.[u.id], 0, u.maxLevel, 0));
  s.yard = !!o.yard;
  s.stats.delivered = num(o.stats?.delivered, 0, 1e15, 0);
  s.stats.processed = num(o.stats?.processed, 0, 1e15, 0);
  const t = o.truck;
  if (t && TRUCK_STATES.includes(t.state)) {
    // a truck saved mid-departure was already paid; it simply finishes driving off
    s.truck = {
      state: t.state, t: num(t.t, 0, 1e6, 0), dur: num(t.dur, 0, 1e6, 0), load: load(t.load, s.depth * 0.6),
      n: Math.floor(num(t.n, 0, 1e9, 0)), paid: num(t.paid, 0, 1e15, 0), bed: num(t.bed, 0, 1e6, 0),
    };
    if (s.truck.state === 'DEPARTING' && s.truck.load.qty > 0) { s.truck.bed = s.truck.load.qty; s.truck.load = { qty: 0, val: 0, mix: {} }; } // pre-fix saves
  } else {
    // unknown truck state: its blocks go back to the stack (never destroyed, never paid twice)
    const back = load(t?.load, s.depth * 0.6);
    s.goods.qty += back.qty; s.goods.val += back.val;
    for (const id of IDS) if (back.mix[id]) s.goods.mix[id] = (s.goods.mix[id] ?? 0) + back.mix[id]!;
  }
  return s;
}

/** Load into S. Returns seconds elapsed since the last save (0 if none). */
export function loadState(): number {
  try {
    for (const k of CFG.legacySaveKeys) localStorage.removeItem(k);
    let raw = localStorage.getItem(CFG.saveKey);
    for (const m of CFG.migrateFrom) if (!raw) raw = localStorage.getItem(m.key);
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
    for (const m of CFG.migrateFrom) localStorage.removeItem(m.key); // only after the migrated save is safely written
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function resetState() {
  Object.assign(S, fresh());
}
