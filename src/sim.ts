// Simulation: resolves strikes against the dig face, crew strike timing, finds, offline progress.
// No DOM, no rendering, no audio. Presentation reacts to the HitResults returned here.
// Digging never creates cash: broken chunks add rubble to the dig-site pile (see cart.ts for transport).
import { CFG, CREW, FINDS, MAX_DEPTH, type CrewId, type Find, type Material } from './config';
import { S } from './state';
import {
  addTo, chunkHp, clickPower, crewMps, crewRubbleRate, crewTypeDps, materialAt, unitValue,
} from './economy';
import { updateCart } from './cart';
import { updateSurface } from './surface';
import { face, initFace, renewChunk, damageChunk, chunkAtX, clampHitX, type Chunk } from './digface';
import { rnd } from './util';

export interface HitResult {
  chunk: Chunk; // the chunk that was struck (the old one, if it broke)
  idx: number;
  x: number; y: number; // logical face coords of the impact
  mat: Material;
  crit: boolean;
  crew: CrewId | null;
  before: number; after: number; broke: boolean;
  rubble: number; // units added to the pile (0 unless broke)
  meters: number;
}

export function initSim() {
  initFace(materialAt(S.depth), chunkHp(S.depth));
  syncWorkers();
}

/** Resolve one strike. A broken chunk is renewed recessed by the depth gained, so it stays put while the camera eases down. */
export function strike(idx: number, x: number, y: number, power: number, crit: boolean, crew: CrewId | null): HitResult {
  const c = face.chunks[idx];
  const dmg = crit ? Math.max(power, c.stageHp) * CFG.critStages : power;
  const r = damageChunk(c, dmg, x, y, crew ? CFG.crewFxScale : crit ? 1.6 : 1);
  let meters = 0, rubble = 0;
  if (r.broke) {
    rubble = CFG.rubble.perBreak * (crit ? CFG.rubble.critBreakMult : 1);
    addTo(S.rubble, rubble, unitValue(S.depth), c.mat.id); // the pile remembers what rock it came from
    meters = Math.min(c.mat.metersPerBreak, MAX_DEPTH - S.depth);
    S.depth += meters;
    const mat = materialAt(S.depth);
    const fresh = renewChunk(idx, mat, chunkHp(S.depth), meters * CFG.ppm);
    // chunks nobody is working (e.g. under the loading area) follow the geology instead of staying old material
    if (mat !== c.mat) face.chunks.forEach((k, i) => { if (i !== idx && k.hp === 0 && k.mat !== mat) { const n = renewChunk(i, mat, chunkHp(S.depth), 0); n.reveal = 0; n.dip = 0; } });
    // excess damage carries into the fresh chunk (never a full visible stage), so +% bonuses always count
    fresh.hp = Math.min(c.hp - c.maxHp, fresh.stageHp * CFG.overflowCarry);
  }
  if (!crew) S.clicks++;
  checkFinds(false);
  return { chunk: c, idx, x, y, mat: c.mat, crit, crew, ...r, rubble, meters };
}

export function playerStrike(idx: number, x: number, y: number): HitResult {
  const crit = Math.random() < CFG.critChance;
  return strike(idx, clampHitX(idx, x), y, clickPower(S), crit, null);
}

// ---- crew workers ----
export interface Worker {
  id: CrewId; x: number; dir: 1 | -1; timer: number; period: number; since: number;
  arrive: number; // secs left of the rope-drop arrival (0 = digging)
}
export const workers: Worker[] = [];
/** Workers that finished their arrival this frame (presentation: landing dust, lamp click). */
export const landings: Worker[] = [];

/** Sync the visible worker set with owned crew. Existing workers keep their phase; new ones optionally rappel in.
 *  Phases are randomized so crews never swing in lockstep. Extras beyond the visible cap still dig at full DPS. */
export function syncWorkers(animateNew = false) {
  const hasExc = S.crew.exc > 0;
  const digSlots = hasExc ? CFG.crewSlotsWithExc : CFG.crewSlots.dig;
  const digCap = hasExc ? CFG.crewVisibleWithExc : CFG.crewVisibleMax;
  const keep: Worker[] = [];
  for (const c of CREW) {
    if (!c.dps) continue;
    const slots = c.id === 'dig' ? digSlots : CFG.crewSlots[c.id];
    const want = Math.min(S.crew[c.id], c.id === 'dig' ? digCap : 1, slots.length);
    for (let k = 0; k < want; k++) {
      const x = slots[k];
      const old = workers.find((w) => w.id === c.id && w.x === x);
      keep.push(old ?? {
        id: c.id, x, dir: x < CFG.face.logicalW / 2 ? 1 : -1,
        timer: rnd(0.25, 1) * c.swingSecs, period: c.swingSecs * rnd(0.9, 1.1), since: 1,
        arrive: animateNew ? CFG.crewArriveSecs : 0,
      });
    }
  }
  workers.length = 0;
  workers.push(...keep);
}

/** Advance crew timers; returns strikes that landed this frame. */
export function updateCrew(dt: number): HitResult[] {
  const out: HitResult[] = [];
  for (const w of workers) {
    if (w.arrive > 0) {
      w.arrive = Math.max(0, w.arrive - dt);
      if (w.arrive === 0) landings.push(w);
      continue;
    }
    w.since += dt;
    w.timer -= dt;
    if (w.timer > 0) continue;
    w.timer += w.period * rnd(0.85, 1.15);
    w.since = 0;
    const visible = workers.filter((o) => o.id === w.id && o.arrive === 0).length;
    const power = (crewTypeDps(S, w.id) * w.period) / visible;
    const reach = w.id === 'exc' ? CFG.excavatorReach : CFG.miner.reach * CFG.crewScale;
    const hx = w.x + w.dir * reach;
    const idx = chunkAtX(hx);
    out.push(strike(idx, clampHitX(idx, hx), rnd(CFG.face.hitYMin, CFG.face.hitYMax), power, false, w.id));
  }
  return out;
}

// ---- finds (placeholder modal flow; animated reveals are Phase 4). Finds give bonuses, never cash. ----
export interface FindEvent { f: Find }
export const pendingFinds: FindEvent[] = [];

export function checkFinds(silent: boolean) {
  while (S.found < FINDS.length && S.depth >= FINDS[S.found].d) {
    const f = FINDS[S.found];
    S.found++;
    if (!silent) pendingFinds.push({ f });
  }
}

// ---- offline (interim): simulate the real production chain conservatively ----
export interface OfflineReport { secs: number; dm: number; dug: number; delivered: number; earned: number }

export function offlineAdvance(secs: number): OfflineReport | null {
  secs = Math.min(CFG.offlineCapSecs, secs);
  if (secs <= CFG.offlineMinSecs) {
    updateCart(secs); // short gaps (reloads): just let the cart and the seller catch up
    updateSurface(secs);
    return null;
  }
  const d0 = S.depth, s0 = S.raw.qty + S.goods.qty + S.truck.load.qty + S.stats.delivered, c0 = S.stats.earned;
  // crew digging stops just short of the next find so discoveries are never skipped silently
  const stopAt = Math.min(MAX_DEPTH, S.found < FINDS.length ? FINDS[S.found].d - 0.01 : Infinity);
  let dug = 0, left = secs;
  while (left > 0) {
    const dt = Math.min(left, CFG.offlineStepSecs);
    if (S.depth < stopAt) {
      const m = Math.min(crewMps(S) * dt, stopAt - S.depth);
      const frac = crewMps(S) > 0 ? m / (crewMps(S) * dt) : 0;
      const r = crewRubbleRate(S) * dt * frac;
      addTo(S.rubble, r, unitValue(S.depth), materialAt(S.depth).id);
      S.depth += m;
      dug += r;
    }
    updateCart(dt);
    updateSurface(dt);
    left -= dt;
  }
  const delivered = S.raw.qty + S.goods.qty + S.truck.load.qty + S.stats.delivered - s0;
  if (S.depth - d0 < 0.01 && delivered < 0.01) return null;
  return { secs, dm: S.depth - d0, dug, delivered, earned: S.stats.earned - c0 };
}
