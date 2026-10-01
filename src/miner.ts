// Player miner: turns clicks into scheduled strikes. Swing anticipation -> accelerated downswing -> impact.
// The strike is resolved by the simulation exactly when the pick lands, so animation and sim stay in sync.
import { CFG } from './config';
import { chunkAtX, clampHitX, face } from './digface';
import { playerStrike, type HitResult } from './sim';
import { playSwing } from './audio';
import { clamp, rnd } from './util';

const M = CFG.miner;
const W = CFG.face.logicalW;

interface Pending { idx: number; x: number; y: number; at: number; swung: boolean }

export const miner = {
  x: CFG.minerStartX, // logical stand position (the left side of the face is the loading area)
  standX: CFG.minerStartX,
  dir: 1 as 1 | -1, // facing
  clock: 0,
  lastImpact: -10,
  pending: [] as Pending[],
};

const impactAt = () => (M.windupMs + M.downswingMs) / 1000;

/** Queue a strike aimed at logical face point (x, y). */
export function minerClick(x: number, y: number) {
  if (miner.pending.length >= M.queueMax) return;
  const idx = chunkAtX(x);
  const hx = clampHitX(idx, x);
  const hy = clamp(y, CFG.face.hitYMin, CFG.face.hitYMax);
  // stand beside the target, keeping the current facing when there is room
  const reach = M.reach * CFG.playerScale; // pick tip lands exactly on the hit point
  let dir = miner.dir;
  if (hx > miner.x + reach * 0.5) dir = 1;
  else if (hx < miner.x - reach * 0.5) dir = -1;
  let stand = hx - dir * reach;
  if (stand < 12 || stand > W - 12) { dir = dir === 1 ? -1 : 1; stand = hx - dir * reach; }
  miner.dir = dir;
  miner.standX = clamp(stand, 12, W - 12);
  const last = miner.pending[miner.pending.length - 1];
  const at = Math.max(miner.clock + impactAt(), last ? last.at + M.chainGapMs / 1000 : 0);
  miner.pending.push({ idx, x: hx, y: hy, at, swung: false });
}

/** Keyboard dig: strike a chunk near the miner. */
export function minerKeyStrike() {
  const x = clamp(miner.x + miner.dir * M.reach + rnd(-M.keyboardSpread, M.keyboardSpread) * 0.5, 4, W - 4);
  minerClick(x, rnd(CFG.face.hitYMin, CFG.face.hitYMax));
}

/** Advance the miner; returns strikes that landed this frame. */
export function updateMiner(dt: number): HitResult[] {
  miner.clock += dt;
  miner.x += (miner.standX - miner.x) * (1 - Math.exp(-M.moveSpeed * dt));
  const out: HitResult[] = [];
  while (miner.pending.length && miner.pending[0].at <= miner.clock) {
    const p = miner.pending.shift()!;
    miner.lastImpact = p.at;
    if (p.idx < face.chunks.length) out.push(playerStrike(p.idx, p.x, p.y));
  }
  // whoosh at the start of each downswing
  for (const p of miner.pending) {
    if (!p.swung && p.at - miner.clock <= M.downswingMs / 1000) { p.swung = true; playSwing(); }
  }
  return out;
}

/** Current pick arm angle, derived from the strike queue so the pick always lands on the impact frame. */
export function minerSwingAngle() {
  const next = miner.pending[0];
  if (next) return swingAngle(Math.max(0, impactAt() - (next.at - miner.clock)));
  return swingAngle(impactAt() + (miner.clock - miner.lastImpact));
}

/** Pick arm angle (rad) t secs into a swing: 0 = forward, negative = raised back, positive = driven down. */
export function swingAngle(t: number) {
  const w = M.windupMs / 1000, d = M.downswingMs / 1000, r = M.recoverMs / 1000;
  const REST = -0.5, RAISED = -2.5, IMPACT = 1.05;
  if (t < w) { const k = t / w; return REST + (RAISED - REST) * (1 - (1 - k) * (1 - k)); } // ease-out raise
  if (t < w + d) { const k = (t - w) / d; return RAISED + (IMPACT - RAISED) * k * k * k; } // accelerating strike
  if (t < w + d + r) { const k = (t - w - d) / r; return IMPACT + (REST - IMPACT) * k * k; }
  return REST;
}
