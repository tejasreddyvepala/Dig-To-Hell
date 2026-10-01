// Simulation: resolves strikes against the dig face, crew strike timing, finds, offline progress.
// No DOM, no rendering, no audio. Presentation reacts to the HitResults returned here.
import { CFG, CREW, FINDS, MAX_DEPTH, type CrewId, type Find, type Material } from './config';
import { S } from './state';
import {
  chunkHp, clickPower, crewIncome, crewMps, crewTypeDps, hitCash, breakCash, materialAt,
} from './economy';
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
  cash: number;
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
  const r = damageChunk(c, dmg, x, y);
  let cash = hitCash(power, S.depth) * (crit ? CFG.critCashMult : 1);
  let meters = 0;
  if (r.broke) {
    cash += breakCash(S.depth);
    meters = Math.min(c.mat.metersPerBreak, MAX_DEPTH - S.depth);
    S.depth += meters;
    const fresh = renewChunk(idx, materialAt(S.depth), chunkHp(S.depth), meters * CFG.ppm);
    // excess damage carries into the fresh chunk (never a full visible stage), so +% bonuses always count
    fresh.hp = Math.min(c.hp - c.maxHp, fresh.stageHp * CFG.overflowCarry);
  }
  S.cash += cash;
  if (!crew) S.clicks++;
  checkFinds(false);
  return { chunk: c, idx, x, y, mat: c.mat, crit, crew, ...r, cash, meters };
}

export function playerStrike(idx: number, x: number, y: number): HitResult {
  const crit = Math.random() < CFG.critChance;
  return strike(idx, clampHitX(idx, x), y, clickPower(S), crit, null);
}

// ---- crew workers ----
export interface Worker { id: CrewId; x: number; dir: 1 | -1; timer: number; period: number; since: number }
export const workers: Worker[] = [];

export function syncWorkers() {
  for (const c of CREW) {
    if (!c.dps) continue;
    const want = Math.min(S.crew[c.id], CFG.crewVisibleMax, CFG.crewSlots[c.id].length);
    const have = workers.filter((w) => w.id === c.id);
    for (let k = have.length; k < want; k++) {
      const x = CFG.crewSlots[c.id][k];
      workers.push({ id: c.id, x, dir: x < CFG.face.logicalW / 2 ? 1 : -1, timer: rnd(0.2, c.swingSecs), period: c.swingSecs, since: 1 });
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

// ---- finds (placeholder modal flow from the prototype; animated reveals are Step 3) ----
export interface FindEvent { f: Find; bonus: number }
export const pendingFinds: FindEvent[] = [];

export function checkFinds(silent: boolean) {
  while (S.found < FINDS.length && S.depth >= FINDS[S.found].d) {
    const f = FINDS[S.found];
    const b = CFG.findBonus;
    const bonus = Math.max(b.min, crewIncome(S) * b.incomeSecs, hitCash(clickPower(S), S.depth) * b.clicks);
    S.found++;
    S.cash += bonus;
    if (!silent) pendingFinds.push({ f, bonus });
  }
}

// ---- offline ----
export interface OfflineReport { secs: number; dm: number; dc: number }

export function offlineAdvance(secs: number): OfflineReport | null {
  secs = Math.min(CFG.offlineCapSecs, secs);
  if (secs <= CFG.offlineMinSecs || crewMps(S) <= 0) return null;
  const d0 = S.depth, c0 = S.cash;
  let left = secs;
  while (left > 0) {
    const dt = Math.min(left, CFG.offlineStepSecs);
    S.cash += crewIncome(S) * dt;
    S.depth = Math.min(MAX_DEPTH, S.depth + crewMps(S) * dt);
    left -= dt;
    checkFinds(true);
  }
  return { secs, dm: S.depth - d0, dc: S.cash - c0 };
}
