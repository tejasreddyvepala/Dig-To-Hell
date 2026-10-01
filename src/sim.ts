// Simulation: resolves strikes against the dig face, crew strike timing, finds, offline progress.
// No DOM, no rendering, no audio. Presentation reacts to the HitResults returned here.
// Digging never creates cash: broken chunks add rubble to the dig-site pile (see cart.ts for transport).
import { CFG, CREW, FINDS, MAX_DEPTH, type CrewId, type Find, type Material } from './config';
import { S } from './state';
import {
  addTo, chunkHp, clickPower, crewMps, crewRubbleRate, crewTypeDps, materialAt, unitValue,
} from './economy';
import { updateCart } from './cart';
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
    addTo(S.rubble, rubble, unitValue(S.depth));
    meters = Math.min(c.mat.metersPerBreak, MAX_DEPTH - S.depth);
    S.depth += meters;
    const fresh = renewChunk(idx, materialAt(S.depth), chunkHp(S.depth), meters * CFG.ppm);
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
export interface Worker { id: CrewId; x: number; dir: 1 | -1; timer: number; period: number; since: number }
export const workers: Worker[] = [];

/** Rebuild the visible worker set. Phases are randomized so crews never swing in lockstep. */
export function syncWorkers() {
  const hasExc = S.crew.exc > 0;
  const digSlots = hasExc ? CFG.crewSlotsWithExc : CFG.crewSlots.dig;
  const digCap = hasExc ? CFG.crewVisibleWithExc : CFG.crewVisibleMax;
  workers.length = 0;
  for (const c of CREW) {
    if (!c.dps) continue;
    const slots = c.id === 'dig' ? digSlots : CFG.crewSlots[c.id];
    const want = Math.min(S.crew[c.id], c.id === 'dig' ? digCap : 1, slots.length);
    for (let k = 0; k < want; k++) {
      const x = slots[k];
      workers.push({
        id: c.id, x, dir: x < CFG.face.logicalW / 2 ? 1 : -1,
        timer: rnd(0.25, 1) * c.swingSecs, period: c.swingSecs * rnd(0.9, 1.1), since: 1,
      });
    }
  }
}

/** Advance crew timers; returns strikes that landed this frame. */
export function updateCrew(dt: number): HitResult[] {
  const out: HitResult[] = [];
  for (const w of workers) {
    w.since += dt;
    w.timer -= dt;
    if (w.timer > 0) continue;
    w.timer += w.period * rnd(0.85, 1.15);
    w.since = 0;
    const visible = workers.filter((o) => o.id === w.id).length;
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
export interface OfflineReport { secs: number; dm: number; dug: number; delivered: number }

export function offlineAdvance(secs: number): OfflineReport | null {
  secs = Math.min(CFG.offlineCapSecs, secs);
  if (secs <= CFG.offlineMinSecs) {
    updateCart(secs); // short gaps (reloads): just let the cart catch up
    return null;
  }
  const d0 = S.depth, s0 = S.surface.qty;
  // crew digging stops just short of the next find so discoveries are never skipped silently
  const stopAt = Math.min(MAX_DEPTH, S.found < FINDS.length ? FINDS[S.found].d - 0.01 : Infinity);
  let dug = 0, left = secs;
  while (left > 0) {
    const dt = Math.min(left, CFG.offlineStepSecs);
    if (S.depth < stopAt) {
      const m = Math.min(crewMps(S) * dt, stopAt - S.depth);
      const frac = crewMps(S) > 0 ? m / (crewMps(S) * dt) : 0;
      const r = crewRubbleRate(S) * dt * frac;
      addTo(S.rubble, r, unitValue(S.depth));
      S.depth += m;
      dug += r;
    }
    updateCart(dt);
    left -= dt;
  }
  if (S.depth - d0 < 0.01 && S.surface.qty - s0 < 0.01) return null;
  return { secs, dm: S.depth - d0, dug, delivered: S.surface.qty - s0 };
}
