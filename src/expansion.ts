// Worksite expansion (Spec §7.5): Narrow Shaft -> Work Chamber as a physical EVENT, not a stat row.
//   WHISTLE -> crew CLEAR to the wall -> CHARGES set (beeping) -> BOOM (face rebuilt wider) -> SETTLE (dust, supports
//   go up, crew walk into the chamber, camera reframes) -> done.
// The purchase is saved immediately (S.worksite); the sequence is presentation + a short crew pause. A reload
// mid-sequence simply opens in the finished chamber.
import { S, saveState } from './state';
import { nextWorksite } from './economy';
import { face } from './digface';
import { applyWorksite, workers } from './workers';
import { miner } from './miner';
import { worksiteDef } from './layout';

export type ExpPhase = 'none' | 'whistle' | 'clear' | 'charges' | 'boom' | 'settle';
export const EXP = { phase: 'none' as ExpPhase, t: 0, supports: 1, flash: 0 };
const DUR: Record<ExpPhase, number> = { none: 0, whistle: 1.1, clear: 1.6, charges: 1.6, boom: 0.05, settle: 2.6 };
export type ExpEvent = 'whistle' | 'charges' | 'beep' | 'boom' | 'done';

export const expanding = () => EXP.phase !== 'none';
/** Player input is held while the crew clears and the charges blow. */
export const inputBlocked = () => EXP.phase === 'clear' || EXP.phase === 'charges' || EXP.phase === 'boom' || (EXP.phase === 'settle' && EXP.t < 0.8);

export function buyExpansion(): boolean {
  const n = nextWorksite(S);
  if (!n || expanding() || S.cash < n.cost || S.crew.dig < n.unlockCrew) return false;
  S.cash -= n.cost;
  S.worksite++;
  saveState();
  EXP.phase = 'whistle'; EXP.t = 0;
  return true;
}

let beepT = 0;
const wallX = (i: number) => 14 + i * 13; // where the crew wait during the blast (left wall, by the stairs)

export function updateExpansion(dt: number, out: ExpEvent[] = []): ExpEvent[] {
  if (EXP.flash > 0) EXP.flash = Math.max(0, EXP.flash - dt * 2.5);
  if (EXP.phase === 'none') { EXP.supports = Math.min(1, EXP.supports + dt); return out; }
  EXP.t += dt;
  const ph = EXP.phase;
  if (ph === 'whistle' && EXP.t < dt * 1.5) out.push('whistle');
  if (ph === 'clear') {
    // everyone on the floor walks to the left wall; the player steps back too
    const k = 1 - Math.exp(-3 * dt);
    workers.forEach((w, i) => {
      if (w.state !== 'work' && w.state !== 'idle') return;
      const tx = w.id === 'exc' ? w.x : wallX(i);
      w.dir = tx < w.x ? -1 : 1; w.x += (tx - w.x) * k;
    });
    miner.standX = wallX(workers.length) + 4;
  }
  if (ph === 'charges') { beepT -= dt; if (beepT <= 0) { beepT = 0.32; out.push('beep'); } }
  if (EXP.t >= DUR[ph]) {
    EXP.t = 0;
    if (ph === 'whistle') EXP.phase = 'clear';
    else if (ph === 'clear') { EXP.phase = 'charges'; out.push('charges'); }
    else if (ph === 'charges') {
      EXP.phase = 'boom';
      // BOOM: the face is rebuilt at the new width. Keep everyone where they stood (shifted into the wider
      // floor's coordinates) so they can walk to their new stations during SETTLE.
      const before = workers.map((w) => ({ w, x: w.x })), oldW = face.w, mx = miner.x;
      applyWorksite();
      const shift = (face.w - oldW) / 2;
      for (const b of before) if (workers.includes(b.w) && b.w.id === 'dig') b.w.x = b.x + shift;
      miner.x = mx + shift; miner.standX = worksiteDef().playerX;
      EXP.supports = 0; EXP.flash = 1;
      out.push('boom');
    } else if (ph === 'boom') EXP.phase = 'settle';
    else if (ph === 'settle') { EXP.phase = 'none'; out.push('done'); }
  }
  if (EXP.phase === 'settle') {
    EXP.supports = Math.min(1, EXP.t / (DUR.settle * 0.8));
    const k = 1 - Math.exp(-2.5 * dt);
    for (const w of workers) if (w.state === 'work' || w.state === 'idle') { w.dir = w.homeX < w.x ? -1 : 1; w.x += (w.homeX - w.x) * k; }
    if (EXP.t > DUR.settle - dt * 2) for (const w of workers) if (w.state === 'work' || w.state === 'idle') { w.x = w.homeX; w.dir = w.homeX < face.w / 2 ? 1 : -1; }
  }
  return out;
}

/** Charge positions along the walls/face (face-logical), for the blinking markers. */
export const chargeSpots = () => {
  const w = face.w;
  return [[8, -30], [8, -70], [w - 40, -30], [w - 40, -70], [w * 0.35, 6], [w * 0.65, 6]];
};
