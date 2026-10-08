// Rung-locked ladder climbing, shared by the Mine's wall ladder and the construction site's scaffold ladder.
// Authored in Mine logical units: rungs RUNG0 above the ladder's foot, then every RUNG. Callers pass `s` = world
// units per logical unit (Mine: 1; surface: the site's scale) and `rigScale` = world units per rig unit.
// Two limb pairs alternate (A = left hand + right foot on even rungs, B = right hand + left foot on odd rungs); a pair
// moves up two rungs while the other holds. Everything is a function of HEIGHT only, so planted hands/feet never
// slide and the same motion plays in reverse going down. Hands hold the rung five above their foot.
import { CFG } from './config';
import type { Look, Pose } from './rig';

export const RUNG0 = 6, RUNG = 8, LADDER_HALF_W = 5;
const rungH = (k: number) => (k >= 0 ? RUNG0 + RUNG * k : RUNG0 + RUNG0 * k); // k = -1 is the floor
const climbU = (h: number) => (h >= RUNG0 ? (h - RUNG0) / RUNG : (h - RUNG0) / RUNG0); // inverse of rungH
const ease = (r: number) => r * r * (3 - 2 * r);
function pairRung(u: number, odd: boolean) {
  const w = odd ? u + 1 : u, n = Math.floor(w / 2), r = w - 2 * n;
  return (r < 1 ? 2 * n + 2 * ease(r) : 2 * n + 2) - (odd ? 1 : 0);
}

/** Ladder pose + feet height for a climber `hWorld` above the ladder foot (`topWorld` = ladder top). */
export function ladderFrame(hWorld: number, topWorld: number, look: Look, s = 1, rigScale = CFG.crewScale) {
  const h = hWorld / s, topH = topWorld / s;
  const hc = Math.max(0, Math.min(h, topH));
  const u = Math.max(-1, climbU(hc));
  const base = rungH(u); // feet baseline: never above the lowest planted foot
  const kA = pairRung(u, false), kB = pairRung(u, true);
  const k = (rigScale * look.height) / s; // logical -> rig units
  const foot = (kk: number) => (Math.min(rungH(kk), topH) - base + 0.8) / k; // sole on top of the rung
  const hand = (kk: number) => (Math.min(rungH(kk + 5), topH + 4) - base) / k; // grip above the helmet
  return {
    base: base * s,
    pose: { k: 'ladder', t: 0, ladder: { fr: foot(kA), hl: hand(kA), fl: foot(kB), hr: hand(kB), hx: 5.6 / k, fx: 3.2 / k } } as Pose,
  };
}

/** World heights of every rung on a ladder `topWorld` tall (for drawing). */
export function rungHeights(topWorld: number, s = 1): number[] {
  const out: number[] = [];
  for (let h = RUNG0; h * s < topWorld; h += RUNG) out.push(h * s);
  return out;
}
