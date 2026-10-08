// Persistent game state + save/load/migration. The only module that touches localStorage.
import { CFG, CREW, CREW_GEAR, FINDS, MATERIALS, MAX_DEPTH, PROJECTS, TOOLS, UPGRADES, WORKSITES, type CrewId, type MaterialId, type UpgradeId } from './config';

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

/** The delivery truck lives at the yard and drives blocks to the construction plot (no cash on departure). */
export type TruckState = 'NONE' | 'ARRIVING' | 'PARKED' | 'LOADING' | 'TO_SITE' | 'UNLOADING' | 'RETURNING';
export const TRUCK_STATES: TruckState[] = ['NONE', 'ARRIVING', 'PARKED', 'LOADING', 'TO_SITE', 'UNLOADING', 'RETURNING'];

export type Site = 'mine' | 'yard' | 'build';
export const SITES: Site[] = ['mine', 'yard', 'build'];

/** Construction on the single plot: current project, stage, material on site. */
export interface BuildState {
  project: number; // index into PROJECTS
  stage: number; // index of the next/active stage
  active: boolean; // builders are working the current stage
  used: number; // blocks consumed in the current stage
  material: Load; // blocks stacked on the plot
  done: boolean; // every stage complete: ready to sell
  // value of the material actually built in (block value travels with the blocks; Spec §3.1)
  stageVal: number; // total block value consumed by the current stage
  stagePaid?: number; // progress instalments already paid for the current stage (big stages pay as they rise)
  projVal: number; // total block value consumed by the whole project so far
  projQty: number; // blocks consumed by the whole project so far
}
export interface TruckSave {
  state: TruckState;
  t: number;
  dur: number;
  load: Load; // finished blocks on the truck bed
  n: number; // deliveries so far (deterministic truck colour)
  paid: number; // legacy (v4); unused
  bed: number; // legacy (v4); unused
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
  worksite: number; // index into WORKSITES (0 Narrow Shaft, 1 Work Chamber)
  chamberM: number; // WORLD depth (m) of the Work Chamber's floor — where it was blasted; -1 = none. It stays there for good.
  build: BuildState;
  site: Site; // where the camera is (restored on load)
  tut: number; // first-time introduction step (see intro.ts; TUT_DONE = finished)
  // trackStory: first-overload moment shown · ann*: site-unlock announced · seen*: the player has visited the unlocked site
  // crewSeen: Construction Crew revealed (construction became a bottleneck) · crewAck: the player has seen it at BUILD
  flags: { dispatched: boolean; arrived: boolean; sold: boolean; storageSeen: boolean; trackStory: boolean; annYard: boolean; annBuild: boolean; seenYard: boolean; seenBuild: boolean; crewSeen: boolean; crewAck: boolean; finished?: boolean };
  projSchema: number; // 2 = project ladder with the Hut first (older saves: 0 = Cabin, 1 = Two-Story Home)
  trackSchema: number; // 1 = upg.rail is a Track Strength tier (older saves stored Rail Quality levels)
  crewGear: number; // index into CREW_GEAR (the crew's tool tier)
  stats: { earned: number; delivered: number; processed: number; sold: number; playSecs?: number }; // lifetime cash, blocks delivered to the plot, units processed, properties sold
}

export const emptyLoad = (): Load => ({ qty: 0, val: 0, mix: {} });

export function fresh(): State {
  return {
    version: CFG.saveVersion, cash: 0, depth: 0, tool: 0,
    crew: { dig: 0, exc: 0, saw: 0, borer: 0 }, found: 0, last: Date.now(), clicks: 0,
    rubble: emptyLoad(),
    cart: { state: 'BOTTOM_EMPTY', t: 0, dur: 0, from: 0, load: emptyLoad() },
    raw: emptyLoad(),
    goods: emptyLoad(),
    truck: { state: 'NONE', t: 0, dur: 0, load: emptyLoad(), n: 0, paid: 0, bed: 0 },
    upg: { cartCap: 0, cartSpeed: 0, loadSpeed: 0, rail: 0, processSpeed: 0, contractValue: 0, rawStorage: 0, crew: 0, crewTools: 0, crewStamina: 0 },
    yard: false,
    worksite: 0,
    chamberM: -1,
    build: { project: 0, stage: 0, active: false, used: 0, material: emptyLoad(), done: false, stageVal: 0, projVal: 0, projQty: 0, stagePaid: 0 },
    site: 'mine',
    tut: 0,
    flags: { dispatched: false, arrived: false, sold: false, storageSeen: false, trackStory: false, annYard: false, annBuild: false, seenYard: false, seenBuild: false, crewSeen: false, crewAck: false },
    trackSchema: 1,
    projSchema: 2,
    crewGear: 0,
    stats: { earned: 0, delivered: 0, processed: 0, sold: 0 },
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

/** Representative dig depth per material (pre-v6 loads stored values from the old depth curve). */
const REF_DEPTH: Partial<Record<MaterialId, number>> = { dirt: 37, clay: 115, stone: 200, cave: 275 };
const v6Value = (d: number) => Math.pow(1 + d / CFG.valueDiv, CFG.valueExp);
/** Pre-v6 saves: recompute every load's value from its material mix with the v6 curve (quantities untouched), and give
 *  a project in progress the value of the blocks it has already consumed. Never changes cash or quantities. */
function revalue(s: State) {
  const rv = (l: Load) => { l.val = 0; for (const id of IDS) if (l.mix[id]) l.val += l.mix[id]! * v6Value(REF_DEPTH[id] ?? 275); };
  for (const l of [s.rubble, s.cart.load, s.raw, s.goods, s.truck.load, s.build.material]) rv(l);
  const b = s.build, p = PROJECTS[b.project];
  const doneBlocks = p.stages.slice(0, Math.min(b.stage, p.stages.length)).reduce((a, st) => a + st.blocks, 0) + (b.active ? b.used : 0);
  const f = b.material.qty > 0 ? b.material.val / b.material.qty : v6Value(s.depth * 0.6);
  b.projQty = doneBlocks; b.projVal = doneBlocks * f; b.stageVal = (b.active ? b.used : 0) * f;
}

/** Old Rail Quality level -> Track Strength tier (any bought level keeps at least Reinforced Wood). */
const railLevelsToTier = (l: number) => (l >= 7 ? 3 : l >= 4 ? 2 : l >= 1 ? 1 : 0);

/** Validate a parsed save of the current version, or migrate an older supported one. Never duplicates material or cash. */
export function sanitize(o: any): State | null {
  if (!o || typeof o !== 'object') return null;
  const v = o.version;
  if (v !== CFG.saveVersion && !CFG.migrateFrom.some((m) => m.version === v)) return null;
  const s = fresh();
  s.cash = num(o.cash, 0, 1e15, 0);
  s.depth = num(o.depth, 0, MAX_DEPTH, 0);
  s.tool = Math.floor(num(o.tool, 0, TOOLS.length - 1, 0));
  for (const c of CREW) s.crew[c.id] = Math.floor(num(o.crew?.[c.id], 0, c.max, 0)); // machines are one of each
  s.found = Math.floor(num(o.found, 0, FINDS.length, 0));
  s.last = num(o.last, 0, Date.now(), Date.now());
  s.clicks = Math.floor(num(o.clicks, 0, 1e9, 0));
  if (v === 2) { s.tut = s.depth > 0 ? 1 : 0; return settleSiteFlags(s, o); } // v2 had no transport: cart starts empty at the bottom

  s.rubble = load(o.rubble, s.depth);
  s.flags.dispatched = !!o.flags?.dispatched;
  s.flags.arrived = !!o.flags?.arrived;
  s.flags.sold = !!o.flags?.sold;
  s.flags.storageSeen = !!o.flags?.storageSeen;
  s.flags.trackStory = !!o.flags?.trackStory;
  for (const k of ['annYard', 'annBuild', 'seenYard', 'seenBuild', 'crewSeen', 'crewAck'] as const) s.flags[k] = !!o.flags?.[k];
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
    s.upg.rail = railLevelsToTier(num(o.upg?.rail, 0, 20, 0));
    s.upg.processSpeed = Math.floor(num(o.upg?.sellSpeed, 0, 30, 0));
    s.upg.contractValue = Math.floor(num(o.upg?.sellValue, 0, 30, 0));
    s.upg.rawStorage = Math.floor(num(o.upg?.storage, 0, 30, 0));
    s.stats.delivered = 0;
    if (s.yard) s.truck.state = 'PARKED';
    s.tut = s.yard ? 5 : s.flags.sold ? 3 : s.flags.arrived ? 3 : s.flags.dispatched ? 2 : s.depth > 0 ? 1 : 0;
    revalue(s);
    return settleSiteFlags(s, o);
  }

  s.raw = load(o.raw, s.depth * 0.6);
  s.goods = load(o.goods, s.depth * 0.6);
  for (const u of UPGRADES) s.upg[u.id] = Math.floor(num(o.upg?.[u.id], 0, u.maxLevel, 0));
  // Rail Quality (speed levels 0..20) became Track Strength (physical tiers 0..3): map once, never downgrade a bought tier
  if (o.trackSchema !== 1) s.upg.rail = railLevelsToTier(num(o.upg?.rail, 0, 20, 0));
  s.yard = !!o.yard;
  s.stats.delivered = v >= 5 ? num(o.stats?.delivered, 0, 1e15, 0) : 0; // v4 "delivered" meant sold-by-truck
  s.stats.processed = num(o.stats?.processed, 0, 1e15, 0);
  const t = o.truck;
  if (v === 4) {
    // Phase 3C.5 trucks paid cash on departure; now they deliver to the plot. A departing (already paid) truck parks.
    const st: TruckState = !s.yard ? 'NONE' : t?.state === 'LOADING' ? 'LOADING' : t?.state === 'ARRIVING' ? 'ARRIVING' : 'PARKED';
    s.truck = { state: st, t: 0, dur: st === 'ARRIVING' ? num(t?.dur, 0, 60, 3.6) : 0, load: st === 'LOADING' ? load(t?.load, s.depth * 0.6) : emptyLoad(), n: Math.floor(num(t?.n, 0, 1e9, 0)), paid: 0, bed: 0 };
    // introduction: a v4 player already has the yard (or is mid-tutorial); construction is new to them
    s.tut = s.yard ? 5 : s.flags.sold ? 3 : s.flags.arrived ? 3 : s.flags.dispatched ? 2 : s.depth > 0 ? 1 : 0;
    revalue(s);
    return settleSiteFlags(s, o);
  }
  if (t && TRUCK_STATES.includes(t.state)) {
    s.truck = {
      state: t.state, t: num(t.t, 0, 1e6, 0), dur: num(t.dur, 0, 1e6, 0), load: load(t.load, s.depth * 0.6),
      n: Math.floor(num(t.n, 0, 1e9, 0)), paid: 0, bed: 0,
    };
  } else {
    // unknown truck state: its blocks go back to the stack (never destroyed)
    const back = load(t?.load, s.depth * 0.6);
    s.goods.qty += back.qty; s.goods.val += back.val;
    for (const id of IDS) if (back.mix[id]) s.goods.mix[id] = (s.goods.mix[id] ?? 0) + back.mix[id]!;
    if (s.yard) s.truck.state = 'PARKED';
  }
  s.worksite = Math.floor(num(o.worksite, 0, WORKSITES.length - 1, 0));
  // Saves from before the chamber was world-anchored don't know where it was blasted: the least disruptive
  // deterministic fallback is the depth the save is at now (the room appears where the floor is, then stays there).
  s.chamberM = s.worksite >= 1 ? num(o.chamberM, 0, 1e6, s.depth) : -1;
  const b = o.build;
  s.build = {
    project: Math.floor(num(b?.project, 0, PROJECTS.length - 1, 0)), stage: Math.floor(num(b?.stage, 0, 99, 0)),
    active: !!b?.active, used: num(b?.used, 0, 1e9, 0), material: load(b?.material, s.depth * 0.6), done: !!b?.done,
    stageVal: num(b?.stageVal, 0, 1e15, 0), projVal: num(b?.projVal, 0, 1e15, 0), projQty: num(b?.projQty, 0, 1e9, 0), stagePaid: num(b?.stagePaid, 0, 1e15, 0),
  };
  // project ladder v2 inserted the Hut (and more homes): old index 0 Cabin → 1, old 1 Two-Story Home → 3
  if (o.projSchema !== 2) s.build.project = [1, 3][Math.min(1, s.build.project)] ?? 1;
  s.projSchema = 2;
  const stages = PROJECTS[s.build.project].stages.length;
  if (s.build.stage >= stages) { s.build.stage = stages; s.build.done = true; s.build.active = false; }
  if (v < 6) revalue(s); // economy rebuild: material value now follows the v6 depth curve; the house in progress gets its built-in value
  s.site = SITES.includes(o.site) ? o.site : 'mine';
  s.tut = Math.floor(num(o.tut, 0, 99, 0));
  s.stats.sold = Math.floor(num(o.stats?.sold, 0, 1e9, 0));
  s.crewGear = Math.floor(num(o.crewGear, 0, CREW_GEAR.length - 1, 0));
  s.stats.playSecs = num(o.stats?.playSecs, 0, 1e9, 0);
  s.flags.finished = !!o.flags?.finished;
  return settleSiteFlags(s, o);
}

/** Saves from before site foreshadowing: sites the player already had open count as announced and visited. */
function settleSiteFlags(s: State, o: any): State {
  if (o.flags && 'annYard' in o.flags) return s;
  if (s.tut >= 3 || s.flags.dispatched) s.flags.annYard = s.flags.seenYard = true;
  if (s.stats.processed > 0 || s.stats.delivered > 0 || s.tut >= 5) s.flags.annBuild = s.flags.seenBuild = true;
  return s;
}

// SAVE SAFETY: a save that can't be read (corrupt JSON, a version from a newer build) is never silently lost.
//   • it is copied to `<key>_backup_<time>` first (the newest 2 are kept), then
//   • the rolling `<key>_prev` copy (written at most once a minute from the last good save) is tried, and only if
//     that fails too does a fresh game start. `loadIssue` tells main.ts to explain what happened to the player.
export let loadIssue: null | { kind: 'restored' | 'fresh'; backup: string } = null;
const PREV = () => CFG.saveKey + '_prev';
function backupRaw(raw: string): string {
  const key = `${CFG.saveKey}_backup_${Date.now()}`;
  try {
    localStorage.setItem(key, raw);
    const olds = Object.keys(localStorage).filter((k) => k.startsWith(CFG.saveKey + '_backup_')).sort();
    for (const k of olds.slice(0, Math.max(0, olds.length - 2))) localStorage.removeItem(k);
  } catch { /* storage full: nothing more we can do */ }
  return key;
}
function parse(raw: string | null): State | null {
  if (!raw) return null;
  try { return sanitize(JSON.parse(raw)); } catch { return null; }
}

/** Load into S. Returns seconds elapsed since the last save (0 if none). */
export function loadState(): number {
  try {
    for (const k of CFG.legacySaveKeys) localStorage.removeItem(k);
    let raw = localStorage.getItem(CFG.saveKey);
    for (const m of CFG.migrateFrom) if (!raw) raw = localStorage.getItem(m.key);
    if (!raw) return 0;
    let s = parse(raw);
    if (!s) { // unreadable: keep a copy, then fall back to the last good rolling copy
      const backup = backupRaw(raw);
      s = parse(localStorage.getItem(PREV()));
      loadIssue = { kind: s ? 'restored' : 'fresh', backup };
      console.warn(`Save could not be read; kept a copy in ${backup}; ${s ? 'restored the previous copy' : 'starting fresh'}`);
      if (!s) return 0;
    }
    Object.assign(S, s);
    return Math.max(0, (Date.now() - s.last) / 1000);
  } catch (e) {
    console.warn('Save load failed; starting fresh', e);
    return 0;
  }
}

let prevAt = 0;
export function saveState() {
  S.last = Date.now();
  const t0 = import.meta.env?.DEV ? performance.now() : 0;
  try {
    const before = localStorage.getItem(CFG.saveKey);
    localStorage.setItem(CFG.saveKey, JSON.stringify(S));
    // rolling copy of the previous good save (a torn or corrupted write never takes the only copy with it)
    if (before && S.last - prevAt > 60_000 && parse(before)) { localStorage.setItem(PREV(), before); prevAt = S.last; }
    for (const m of CFG.migrateFrom) localStorage.removeItem(m.key); // only after the migrated save is safely written
  } catch {
    /* storage unavailable: play on without saving */
  }
  if (import.meta.env?.DEV) { const ms = performance.now() - t0; const w = window as any; (w.__saveMs ??= []).push(Math.round(ms * 10) / 10); }
}

export function resetState() {
  Object.assign(S, fresh());
}
