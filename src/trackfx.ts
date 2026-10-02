// Track strain presentation (Spec §7.8): the WORLD shows the problem before the UI explains it.
//   STRAINED (loaded cart near the safe load): rare creaks, a wheel squeak, the odd speck of dust.
//   OVERLOADED: frequent creaks + squeal, dust and pebbles shaken off the wall around the cart, a tiny camera jolt
//   per joint crossed. Everything is local to the climbing cart and only while it is near the camera.
//   First overload ever (seen at the Mine): a short scripted beat, then two non-blocking lines and the
//   TRACK STRENGTH card is highlighted. Reinforcement: hammering, dust at the working section, a final clunk.
import { CFG, TRACK_TIERS } from './config';
import { S } from './state';
import { cartDepth, cartTrackStress, type CartEvent } from './cart';
import { trackStress } from './economy';
import { TRACKUP, trackUpK, type TrackUpEvent } from './track';
import { FX, addPart, impulse } from './fx';
import { playClunk, playCreak, playDebris, playHammer, playSqueak } from './audio';
import { cartScreen, faceOrigin, faceScale, view, yOf } from './view';
import { showLine } from './intro';
import { highlightTrack } from './panel';
import { rnd } from './util';

let creakT = 2, squeakT = 2, dustAcc = 0, pebAcc = 0, lastJoltM = 0;
let story: { t: number; step: number } | null = null;

/** Cart on screen? 1 = in view, fading to 0 a screen away (sounds + effects stay local). */
function nearness() {
  const y = cartScreen().y, H = view.H;
  const off = y < view.vy0 ? view.vy0 - y : y > view.vy1 ? y - view.vy1 : 0;
  return Math.max(0, 1 - off / (H * 0.6));
}
const mobileK = () => Math.min(1, view.W / 900); // smaller screens get a smaller jolt

function wallBits(n: number, pebbles: number) {
  const c = cartScreen(), s = faceScale();
  for (let i = 0; i < n; i++) addPart({ kind: 'dust', x: c.x + rnd(-14, 22) * s, y: c.y - rnd(0, 46) * s, vx: rnd(-12, 12), vy: rnd(8, 30), size: rnd(2.5, 5), col: 'rgba(176,150,118,1)', life: rnd(0.7, 1.2), floor: Infinity, bounce: 0 });
  for (let i = 0; i < pebbles; i++) addPart({ kind: 'frag', x: c.x + rnd(-10, 20) * s, y: c.y - rnd(10, 50) * s, vx: rnd(-25, 25), vy: rnd(20, 80), vr: rnd(-8, 8), size: rnd(1.6, 2.8) * s, col: 'rgb(120,96,70)', life: rnd(0.8, 1.3), floor: Infinity, bounce: 0, shape: true });
}

export function updateTrackFx(dt: number, cartEvents: CartEvent[], upEvents: TrackUpEvent[]) {
  // ---- first overload: the mine itself says what went wrong (only if the player is watching the Mine) ----
  for (const e of cartEvents) {
    if (e.type === 'depart' && trackStress(S, S.cart.load.qty) === 'over' && !S.flags.trackStory && view.site === 'mine') {
      S.flags.trackStory = true;
      story = { t: 0, step: 0 };
    }
  }
  if (story) {
    story.t += dt;
    const beats: [number, () => void][] = [
      [0.15, () => playCreak(1)],
      [0.55, () => wallBits(6, 2)],
      [0.95, () => { playCreak(1); playSqueak(0.8); }],
      [1.3, () => { impulse(CFG.track.jolt * 2 * mobileK(), rnd(-0.3, 0.3), 1); wallBits(10, 4); playDebris(0.6); }],
      [1.7, () => {
        const wood = TRACK_TIERS[S.upg.rail].name.toLowerCase().includes('wood');
        showLine('⚠ TRACK STRAIN', true, 1.8);
        showLine(wood ? "These wooden rails weren't built for loads this heavy." : `This ${TRACK_TIERS[S.upg.rail].name.toLowerCase()} wasn't built for loads this heavy.`, false, 3.2);
        showLine('Reinforce the track before transport gets worse.', false, 3.2);
      }],
      [6.4, () => { highlightTrack(); story = null; }],
    ];
    while (story && story.step < beats.length && story.t >= beats[story.step][0]) beats[story.step++][1]();
  }

  // ---- continuous strain while a loaded cart climbs ----
  const stress = S.cart.state === 'TRAVELLING_UP' && !TRACKUP.active ? cartTrackStress() : 'safe';
  const near = nearness();
  if (stress !== 'safe' && near > 0.05) {
    const over = stress === 'over';
    creakT -= dt; squeakT -= dt;
    if (creakT <= 0) { creakT = over ? rnd(0.9, 2) : rnd(2.5, 5); playCreak((over ? 0.9 : 0.45) * near); }
    if (squeakT <= 0) { squeakT = over ? rnd(1.5, 3) : rnd(4, 7); playSqueak((over ? 0.8 : 0.35) * near); }
    dustAcc += dt * (over ? 4 : 0.6) * near; pebAcc += dt * (over ? 1.5 : 0.15) * near;
    while (dustAcc >= 1) { dustAcc -= 1; wallBits(1, 0); }
    while (pebAcc >= 1) { pebAcc -= 1; wallBits(0, 1); }
    // joints: a tiny jolt each time the overloaded cart crosses one (communicates mass, not an earthquake)
    const m = cartDepth();
    if (over && Math.abs(m - lastJoltM) >= CFG.track.joltEveryM) { lastJoltM = m; if (near > 0.6) impulse(CFG.track.jolt * mobileK(), rnd(-0.3, 0.3), 1); }
  } else { lastJoltM = cartDepth(); creakT = Math.max(creakT, 0.6); }

  // ---- reinforcement job ----
  for (const e of upEvents) {
    if (e === 'hammer') {
      playHammer(0.75);
      const y = reinforceY(), x = cartScreen().x, s = faceScale();
      if (y !== null) for (let i = 0; i < 3; i++) addPart({ kind: 'dust', x: x + rnd(-10, 10) * s, y: y + rnd(-6, 6), vx: rnd(-30, 30), vy: rnd(-30, 10), size: rnd(3, 6), col: 'rgba(190,170,140,1)', life: rnd(0.4, 0.8), floor: Infinity, bounce: 0 });
    } else if (e === 'done') {
      playClunk();
      impulse(0.5 * mobileK(), 0, 1);
      const t = TRACK_TIERS[S.upg.rail];
      FX.banner = { s: 'TRACK REINFORCED', sub: `${t.name} · safe load ${t.safe}`, t: 0 };
    }
  }
}

/** Screen y of the section being rebuilt right now (sweeps from the dig face up the visible shaft). */
export function reinforceY(): number | null {
  if (!TRACKUP.active) return null;
  const bot = Math.min(view.vy1, faceOrigin().y), top = Math.max(view.vy0, yOf(-CFG.cart.surfaceLiftM - 1.5));
  if (bot <= top) return null;
  return bot - (bot - top) * trackUpK();
}
