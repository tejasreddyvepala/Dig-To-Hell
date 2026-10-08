// CharacterRig: ONE normalized human rig for every person in the game (player, miners, construction workers,
// contractor, yard hand; future roles are just a Look + poses). Spec §8.
//   - Authored in rig units: feet at (0,0), facing +x, standing height RIG_H = 40 (helmet top ≈ 43).
//     Callers pass `scale` = screen px per rig unit (face-logical crewScale underground, u / RIG_H at the surface).
//   - Proportions: ~5 heads tall, shoulder joint at 0.675 H, hip at 0.425 H. The pick geometry (shoulder (0,-27),
//     tool tip 37 out) is kept so a swing still lands exactly on the impact point.
//   - Variation is deterministic per seed (skin, clothes, helmet, hair, beard, build, height).
//   - LOD by on-screen height: < 14 px silhouette, < 30 px medium (no face detail), otherwise full.
//   - Only a small contact shadow under the feet (the old dark rim behind the player is gone).
import type { Tool } from './config';
import { ctx, view } from './view';
import { hash } from './util';

export const RIG_H = 40;
/** Phase (0..1 of a hammer cycle) at which the hammer head reaches its target. */
export const HAMMER_IMPACT = 0.9;
const HAMMER_LEN = 9;
const SHOULDER_Y = -29.2, HIP_Y = -18.4; // longer torso + legs, head ~12% smaller (see head())
const NECK_Y = SHOULDER_Y - 4.4, WAIST_Y = HIP_Y - 2.4; // torso top / belt line
const PICK_SH = -27; // the pick's swing pivot used for the impact point — gameplay geometry, independent of the body
const THIGH = 9.4, SHIN = 8.4, UPPER = 9, FORE = 8.4;
/** Mine light comes from above and in front (the work lamp + the helmet lamp): the light direction in rig space. */
const LX = 0.45, LY = -0.89;

export type Role = 'player' | 'miner' | 'builder' | 'contractor' | 'hand';
export interface Look {
  skin: string; skinD: string; shirt: string; sleeve: string; pants: string; boots: string; glove: string;
  helmet: string; // '' = none
  cap: string; // '' = none (civilians)
  hair: string; beard: number; // 0 none, 1 stubble, 2 beard, 3 moustache
  vest: '' | 'hivis' | 'player'; belt: boolean; toolBelt: boolean;
  build: number; height: number;
  kneePads: boolean; // dark knee pads on the jeans
  seed: number; // per-person timing (blink, fidget)
  grey: boolean; // older worker: grey beard/hair
  sticker: number; // helmet sticker hue (0 = none)
  rolled: boolean; // sleeves rolled up: bare forearms
}
/** Outline colour for all people (Miner reference: chunky shapes with dark outlines). Set per draw by LOD. */
const INK = '#1c120b';
let OL = 0; // outline width in rig units for the current figure (0 = none: small on screen)

export type PoseKind =
  | 'stand' | 'walk' | 'climb' | 'sit' | 'swing' | 'jack' | 'wipe' | 'helmet' | 'drink' | 'look'
  | 'hammer' | 'carry' | 'cheer' | 'gesture' | 'drive' | 'ladder';
export interface Pose {
  k: PoseKind;
  t: number; // phase (walk/climb/hammer cycles) or 0..1 progress (idles)
  a?: number; // swing angle (pick) / gesture amount
  tool?: Tool;
  lit?: boolean; // helmet lamp on
  carryCol?: string; // block colour while carrying
  /** 'ladder': seen from behind, facing the wall ladder. Heights are rig units ABOVE the feet baseline (each limb
   *  sits exactly on a rung); hx/fx = half-spacing of hands/feet across the ladder. */
  ladder?: { fl: number; fr: number; hl: number; hr: number; hx: number; fx: number };
  /** 'hammer': the point the hammer head strikes, in rig units from the feet (x forward, y up). Impact at t%1 = HAMMER_IMPACT. */
  aim?: { x: number; y: number };
  tired?: number; // 0..1: slumped shoulders, head down, smaller swing
}

const SKINS: [string, string][] = [['#f1c9a0', '#d9a77e'], ['#e0ae84', '#c58f68'], ['#c98d62', '#a8714b'], ['#9a6644', '#7d5135'], ['#6e4630', '#573623']];
const HAIRS = ['#2b1f17', '#4a3222', '#6b4a2e', '#1b1b1d', '#8a8378', '#a2662e'];
const MINER_SHIRTS = ['#d8c7a3', '#cbb58c', '#d2bf98', '#bfae8a', '#d9c9a8']; // khaki work shirts
const MINER_PANTS = ['#3e5f8f', '#36557f', '#456795', '#3a5884']; // jeans
const MINER_HATS = ['#f2b417', '#efab12', '#f5bf26']; // yellow hard hats
const BUILDER_SHIRTS = ['#d8c7a3', '#8fa3b8', '#cbb58c', '#a7b59a'];
const BUILDER_HATS = ['#f2f2ee', '#f0b330', '#e5e8ea'];

function shade(c: string, k: number) {
  let r: number, g: number, b: number;
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
  else { [r, g, b] = (c.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number); } // rgb(...) from an earlier shade()
  return `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;
}
const pick = <T,>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length];

/** Deterministic look for a role + seed. */
export function lookFor(role: Role, seed: number): Look {
  const r = (k: number) => hash(seed * 1.37 + k * 17.11);
  const [skin, skinD] = role === 'player' ? SKINS[0] : pick(SKINS, r(1));
  const base: Look = {
    skin, skinD, shirt: '#4a6a86', sleeve: '', pants: '#33404d', boots: '#3a2a1e', glove: '#5a4632',
    helmet: '', cap: '', hair: pick(HAIRS, r(2)), beard: r(3) < 0.45 ? 1 + Math.floor(r(4) * 3) : 0,
    vest: '', belt: true, toolBelt: false, build: 0.98 + r(5) * 0.14, height: 0.96 + r(6) * 0.08,
    kneePads: false, rolled: false, seed, grey: r(11) < 0.18, sticker: r(12) < 0.4 ? 1 + Math.floor(r(13) * 3) : 0,
  };
  // the shared work outfit (Miner reference): khaki shirt, rolled sleeves, orange hi-vis vest, jeans, knee pads,
  // brown work gloves + boots, tool belt
  const OUTFIT = { shirt: pick(MINER_SHIRTS, r(7)), pants: pick(MINER_PANTS, r(8)), boots: '#6a4225', glove: '#7b5230', vest: 'hivis' as const, toolBelt: true, kneePads: true, rolled: true };
  if (role === 'player') Object.assign(base, OUTFIT, { shirt: '#d8c39b', pants: '#3e5f8f', helmet: '#ffbe1a', vest: 'player', beard: 2, hair: '#3a2416', build: 1.06, height: 1 });
  if (role === 'miner') Object.assign(base, OUTFIT, { helmet: pick(MINER_HATS, r(9)), beard: r(3) < 0.7 ? 1 + Math.floor(r(4) * 3) : 0 });
  if (role === 'builder') Object.assign(base, OUTFIT, { shirt: pick(BUILDER_SHIRTS, r(7)), helmet: pick(BUILDER_HATS, r(9)) });
  if (role === 'contractor') Object.assign(base, { shirt: '#8a6a44', pants: '#3e5f8f', boots: '#6a4225', cap: '#3d5a3a', glove: skin, beard: 2, build: 1.1, rolled: true });
  if (role === 'hand') Object.assign(base, OUTFIT, { helmet: '#f2b417' });
  if (base.grey) base.hair = '#9a948a';
  base.sleeve = base.rolled ? base.skin : shade(base.shirt, 0.8);
  return base;
}

function seg(x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  if (OL) { ctx.strokeStyle = INK; ctx.lineWidth = w + OL * 2; ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
/** Fill the current path with an ink outline. */
function inked(col: string) {
  if (OL) { ctx.strokeStyle = INK; ctx.lineWidth = OL * 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = col; ctx.fill();
}
/** A tapered limb (or any tube) through points [x, y, width]: one smooth outlined shape — no round "pill" caps at
 *  the joints, so elbows and knees read as real bends. */
function limb(pts: number[][], col: string, endCap = 0.55) {
  const n = pts.length, Lp: number[][] = [], Rp: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = pts[i][2] / 2;
    Lp.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); Rp.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const dir = (i: number, j: number) => { const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  const [ex, ey] = dir(n - 2, n - 1), [sx, sy] = dir(1, 0);
  ctx.beginPath(); ctx.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(Lp[i][0], Lp[i][1], (Lp[i][0] + Lp[i + 1][0]) / 2, (Lp[i][1] + Lp[i + 1][1]) / 2);
  ctx.lineTo(Lp[n - 1][0], Lp[n - 1][1]);
  const we = pts[n - 1][2] * endCap, ws = pts[0][2] * 0.55;
  ctx.quadraticCurveTo(pts[n - 1][0] + ex * we, pts[n - 1][1] + ey * we, Rp[n - 1][0], Rp[n - 1][1]);
  for (let i = n - 2; i > 0; i--) ctx.quadraticCurveTo(Rp[i][0], Rp[i][1], (Rp[i][0] + Rp[i - 1][0]) / 2, (Rp[i][1] + Rp[i - 1][1]) / 2);
  ctx.lineTo(Rp[0][0], Rp[0][1]);
  ctx.quadraticCurveTo(pts[0][0] + sx * ws, pts[0][1] + sy * ws, Lp[0][0], Lp[0][1]);
  ctx.closePath(); inked(col);
  if (!OL) return;
  // volume: a light band on the side facing the lamp, a shadow band on the far side (round, not flat)
  const ox = pts[n - 1][0] - pts[0][0], oy = pts[n - 1][1] - pts[0][1], od = Math.hypot(ox, oy) || 1;
  const sgn = (-oy / od) * LX + (ox / od) * LY < 0 ? -1 : 1; // which side of the limb faces the light
  ctx.save(); ctx.clip();
  const band = (k: number, wk: number, c: string) => {
    ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const x = pts[i][0] + (-dy / d) * pts[i][2] * k * sgn, y = pts[i][1] + (dx / d) * pts[i][2] * k * sgn;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineWidth = pts[Math.floor(n / 2)][2] * wk; ctx.stroke();
  };
  band(-0.42, 0.42, 'rgba(10,5,2,.32)'); // underside / back in shadow
  band(0.3, 0.26, 'rgba(255,236,205,.26)'); // the side facing the lamp
  ctx.restore();
}
const lerpP = (a: number[], b: number[], t: number, w: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, w];

/** Work boot: shaft at the ankle, instep, toe out front, heel behind, thick sole. (fx,fy) = ankle bottom on the ground. */
function boot(fx: number, fy: number, L: Look, back: boolean) {
  const c = back ? shade(L.boots, 0.78) : L.boots;
  if (fy > -2) { // planted: a strong soft shadow right under the sole
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(fx + 1.8, fy + 1.3, 6.4, 1.6, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(fx + 1.8, fy + 1.2, 4.6, 0.9, 0, 0, 6.283); ctx.fill();
  }
  // upper: shaft, instep, a big rounded toe box
  ctx.beginPath(); ctx.moveTo(fx - 2.6, fy - 5); ctx.lineTo(fx + 1.9, fy - 5);
  ctx.quadraticCurveTo(fx + 2.3, fy - 3, fx + 3.8, fy - 2.9); ctx.bezierCurveTo(fx + 6.6, fy - 3, fx + 7.2, fy - 1.4, fx + 7, fy + 0.1);
  ctx.lineTo(fx - 3.1, fy + 0.1); ctx.quadraticCurveTo(fx - 3.6, fy - 2.6, fx - 2.6, fy - 5); ctx.closePath(); inked(c);
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(fx - 3.6, fy - 5, 2.2, 6); // back of the heel in shadow
  ctx.fillStyle = shade(c, 1.35); ctx.beginPath(); ctx.ellipse(fx + 5, fy - 2.2, 1.9, 0.9, -0.2, 0, 6.283); ctx.fill(); // scuffed toe cap catching light
  ctx.restore();
  ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = 0.5; ctx.beginPath(); // laces
  ctx.moveTo(fx + 0.4, fy - 4.2); ctx.lineTo(fx + 2.2, fy - 3.6); ctx.moveTo(fx + 0.8, fy - 3.3); ctx.lineTo(fx + 2.7, fy - 2.8); ctx.stroke();
  // sole (seen a touch from above: lighter top edge), separate heel block
  ctx.beginPath(); ctx.roundRect(fx - 3.2, fy - 0.5, 10.4, 1.9, 0.8); inked('#22150c');
  ctx.fillStyle = 'rgba(255,220,180,.18)'; ctx.fillRect(fx - 2.8, fy - 0.45, 9.6, 0.45);
  ctx.beginPath(); ctx.rect(fx - 3.2, fy - 1.4, 2.6, 1.2); inked(shade(c, 0.62));
}
function knee(kx: number, ky: number, L: Look, ang = 0) {
  if (!L.kneePads) return;
  ctx.save(); ctx.translate(kx, ky); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(30,22,16,.65)'; ctx.fillRect(-2.8 * L.build, 1.2, 5.6 * L.build, 0.7); // strap
  ctx.beginPath(); ctx.roundRect(-0.4, -2, 3.6 * L.build, 4, [1.6, 1.8, 1.2, 1]); inked('#5b4a3c');
  ctx.fillStyle = 'rgba(255,230,200,.28)'; ctx.fillRect(0.4, -1.5, 2.2 * L.build, 0.7); // hard cap highlight
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-0.4, 1, 3.6 * L.build, 1); // lower edge
  ctx.restore();
}
/** A work-gloved hand at the wrist (x,y), pointing along `ang`: cuff, palm, thumb and four fingers — curled into a
 *  fist round a handle when `grip`, relaxed (slightly bent) otherwise. */
function hand(x: number, y: number, ang: number, L: Look, back: boolean, grip: boolean, thumbUp = 1) {
  const c = back ? shade(L.glove, 0.8) : L.glove, d = shade(c, 0.68);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.2, 1.2 * thumbUp);
  ctx.beginPath(); ctx.moveTo(-1.6, -2.2); ctx.lineTo(0.4, -2); ctx.lineTo(0.4, 2); ctx.lineTo(-1.6, 2.2); ctx.closePath(); inked(d); // flared glove cuff
  ctx.beginPath(); ctx.roundRect(0.2, -1.9, 3.3, 3.8, [0.8, 1.2, 1.2, 0.8]); inked(c); // palm
  if (grip) { // fist round the handle: one grouped block of curled fingers, three creases
    ctx.beginPath(); ctx.roundRect(2.7, -2, 2.2, 4, [0.6, 1.6, 1.6, 0.6]); inked(c);
    ctx.strokeStyle = d; ctx.lineWidth = 0.32; ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(3.3, -2 + i); ctx.lineTo(4.9, -2 + i); } ctx.stroke();
  } else { // relaxed: grouped fingers bending down a little, finger creases
    ctx.save(); ctx.translate(3.2, 0); ctx.rotate(0.35);
    ctx.beginPath(); ctx.roundRect(0, -1.8, 2.7, 3.6, [0.6, 1.6, 1.6, 0.6]); inked(c);
    ctx.strokeStyle = d; ctx.lineWidth = 0.3; ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(1, -1.8 + i * 0.9); ctx.lineTo(2.7, -1.8 + i * 0.9); } ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.translate(1.3, -1.7); ctx.rotate(grip ? -0.15 : -0.7); ctx.beginPath(); ctx.roundRect(0, -0.65, 2.6, 1.3, 0.65); inked(c); ctx.restore(); // thumb
  ctx.fillStyle = shade(c, 1.3); ctx.fillRect(0.7, -1.5, 2, 0.55); // light across the back of the hand
  ctx.restore();
}
/** Upper arm (sleeve) + forearm + hand as defined shapes: shoulder (sx,sy) → elbow (ex,ey) → wrist (hx,hy). */
function armChain(sx: number, sy: number, ex: number, ey: number, hx: number, hy: number, L: Look, back: boolean, grip: boolean, handAng?: number) {
  const b = L.build, shirt = back ? shade(L.shirt, 0.74) : L.shirt, skin = back ? L.skinD : L.skin;
  limb([[sx, sy, 5.3 * b], lerpP([sx, sy], [ex, ey], 0.4, 4.7 * b), [ex, ey, 3.9 * b]], shirt, 0.3); // sleeve (deltoid → elbow)
  { // the elbow is a joint: a bony point on the outside of the bend, fabric bunching on the inside
    const ux = ex - sx, uy = ey - sy, fx = hx - ex, fy = hy - ey, cross = ux * fy - uy * fx, ud = Math.hypot(ux, uy) || 1;
    const out = cross > 0 ? -1 : 1, nx = (-uy / ud) * out, ny = (ux / ud) * out;
    ctx.beginPath(); ctx.ellipse(ex + nx * 1.1, ey + ny * 1.1, 1.3 * b, 1.1 * b, Math.atan2(uy, ux), 0, 6.283); inked(L.rolled ? shade(shirt, 0.9) : shirt);
    ctx.strokeStyle = shade(shirt, 0.62); ctx.lineWidth = 0.4; ctx.beginPath();
    for (let i = 0; i < 2; i++) { const t = 0.7 + i * 0.12, px = sx + ux * t - nx * 1.2, py = sy + uy * t - ny * 1.2; ctx.moveTo(px, py); ctx.quadraticCurveTo(px + nx * 1.2 + ux / ud * 0.6, py + ny * 1.2 + uy / ud * 0.6, px + nx * 2.2, py + ny * 2.2); }
    ctx.stroke();
  }
  if (L.rolled) {
    limb([[ex, ey, 3.6 * b], lerpP([ex, ey], [hx, hy], 0.35, 4.1 * b), [hx, hy, 2.9 * b]], skin, 0.2); // forearm: swells, tapers to the wrist
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.atan2(hy - ey, hx - ex));
    ctx.beginPath(); ctx.roundRect(-1.6, -2.5 * b, 2.6, 5 * b, 1); inked(shade(shirt, 0.88)); ctx.restore(); // rolled cuff
  } else limb([[ex, ey, 4 * b], lerpP([ex, ey], [hx, hy], 0.4, 3.8 * b), [hx, hy, 3.1 * b]], back ? shade(L.shirt, 0.66) : L.sleeve, 0.2);
  hand(hx, hy, handAng ?? Math.atan2(hy - ey, hx - ex), L, back, grip);
}
/** Leg from the hip; angles from straight down, positive = forward. */
function leg(hx: number, a1: number, a2: number, L: Look, back: boolean, hy = HIP_Y) {
  const kx = hx + Math.sin(a1) * THIGH, ky = hy + Math.cos(a1) * THIGH;
  const fx = kx + Math.sin(a2) * SHIN, fy = ky + Math.cos(a2) * SHIN;
  legChain(hx, hy, kx, ky, fx, fy, L, back);
}
/** Jeans leg + boot: the boot is drawn first and the jeans hem falls OVER its shaft (the boot comes out of the pants). */
function legChain(hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, L: Look, back: boolean) {
  const b = L.build, col = back ? shade(L.pants, 0.76) : L.pants;
  boot(fx, fy, L, back);
  const ank = [fx + 0.1, fy - 3.8];
  limb([[kx, ky, 5.4 * b], lerpP([kx, ky], ank, 0.45, 5 * b), [ank[0], ank[1], 5.8 * b]], col, 0.1); // shin (jeans flare over the boot)
  limb([[hx, hy, 7 * b], lerpP([hx, hy], [kx, ky], 0.5, 6.4 * b), [kx, ky, 5.6 * b]], col, 0.45); // thigh
  ctx.strokeStyle = shade(col, 0.62); ctx.lineWidth = 0.45; ctx.beginPath();
  ctx.moveTo(kx - 1.6, ky + 1.6); ctx.quadraticCurveTo(kx - 0.4, ky + 2.6, kx - 1.8, ky + 3.4); // fold behind the knee
  ctx.moveTo(ank[0] - 2.4, ank[1] - 1.4); ctx.quadraticCurveTo(ank[0], ank[1] - 0.6, ank[0] + 2.4, ank[1] - 1.2); // pant stack at the boot
  ctx.moveTo(hx + 1.2, hy + 2); ctx.quadraticCurveTo(hx + 2.4, hy + 3.4, hx + 2, hy + 5); ctx.stroke(); // thigh crease
  ctx.fillStyle = shade(col, 0.78); ctx.fillRect(ank[0] - 2.9 * b, ank[1] - 0.6, 5.8 * b, 1.1); // hem fold
  knee(kx, ky, L, Math.atan2(ank[1] - ky, ank[0] - kx) - Math.PI / 2);
}
/** Arm from a shoulder; angles from straight down, positive = forward. Returns the hand position. */
function arm(sx: number, sy: number, a1: number, a2: number, L: Look, back: boolean, _bare = false, grip = false) {
  const ex = sx + Math.sin(a1) * UPPER, ey = sy + Math.cos(a1) * UPPER;
  const hx = ex + Math.sin(a2) * FORE, hy = ey + Math.cos(a2) * FORE;
  armChain(sx, sy, ex, ey, hx, hy, L, back, grip);
  return { x: hx, y: hy };
}
function torso(L: Look, lod: number, breath = 0) {
  const b = L.build, S0 = SHOULDER_Y, N = NECK_Y, W = WAIST_Y, H = HIP_Y;
  // PELVIS (jeans): its own block below the belt — wider than the waist, so chest and hips read as two masses
  ctx.beginPath(); ctx.moveTo(-4.8 * b, W - 0.4); ctx.lineTo(5.2 * b, W - 0.4);
  ctx.quadraticCurveTo(6.4 * b, H, 5.6 * b, H + 2.2); ctx.lineTo(-5.4 * b, H + 2.2); ctx.quadraticCurveTo(-6.4 * b, H, -4.8 * b, W - 0.4); ctx.closePath();
  inked(L.pants);
  if (lod >= 1) { ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-7 * b, W, 3.4 * b, 6); ctx.fillStyle = shade(L.pants, 0.7); ctx.fillRect(-5.4 * b, W + 1.2, 2.4, 2.2); ctx.restore(); } // back in shadow, back pocket
  const by = 1 + breath * 0.03;
  ctx.save(); ctx.translate(0, W); ctx.scale(1 + breath * 0.012, by); ctx.translate(0, -W); // breathing: the chest rises
  // SHIRT: broad shoulders → chest → narrower waist at the belt
  const shirt = () => { ctx.beginPath();
    ctx.moveTo(-4.4 * b, W + 0.4);
    ctx.bezierCurveTo(-5.4 * b, W - 4, -7.4 * b, S0 + 4, -7 * b, S0 - 0.6); // back
    ctx.quadraticCurveTo(-6.6 * b, N + 0.4, -1.6, N); // back shoulder → neck
    ctx.lineTo(3.4, N - 0.2);
    ctx.quadraticCurveTo(7.6 * b, N + 0.2, 8 * b, S0 - 0.4); // broad front shoulder
    ctx.bezierCurveTo(8.6 * b, S0 + 3, 8.2 * b, S0 + 6.6, 6.4 * b, W - 2.4); // chest → belly
    ctx.lineTo(5 * b, W + 0.4); ctx.closePath(); };
  shirt(); inked(L.shirt);
  // VEST: separate garment — armholes show the shirt shoulders; it gathers at the waist
  const vest = () => { ctx.beginPath();
    ctx.moveTo(-4.7 * b, W + 0.8);
    ctx.bezierCurveTo(-5.6 * b, W - 4, -6.6 * b, S0 + 3.4, -5.8 * b, S0 + 0.4); // back panel
    ctx.quadraticCurveTo(-5.2 * b, N + 0.6, -2.8, N + 0.4); ctx.lineTo(-0.4, N + 0.4); // back strap
    ctx.lineTo(2.3, S0 + 3.4); // V neckline
    ctx.lineTo(4, N + 0.6); ctx.lineTo(6.2 * b, N + 1.2); // front strap
    ctx.quadraticCurveTo(6 * b, S0 + 1.6, 7.6 * b, S0 + 3); // front armhole
    ctx.bezierCurveTo(8 * b, S0 + 6.4, 6.8 * b, W - 1.8, 5.4 * b, W + 0.8);
    ctx.lineTo(4.2 * b, W + 1.6); ctx.lineTo(3 * b, W + 0.9); ctx.closePath(); }; // a hem notch breaks the clean outline
  const v = L.vest === 'player' ? '#ff6a1a' : '#f36b1c';
  if (L.vest) { vest(); inked(v); }
  const volume = () => { // directional light (above/front): lit front + top, deep shadow on the back side, belly underside
    const gx = ctx.createLinearGradient(-7.5 * b, 0, 8.5 * b, 0);
    gx.addColorStop(0, 'rgba(8,4,2,.48)'); gx.addColorStop(0.35, 'rgba(8,4,2,.12)'); gx.addColorStop(0.7, 'rgba(255,230,190,0)'); gx.addColorStop(1, 'rgba(255,230,190,.16)');
    ctx.fillStyle = gx; ctx.fillRect(-9 * b, N - 1, 18 * b, W - N + 3);
    const gy = ctx.createLinearGradient(0, N, 0, W + 1);
    gy.addColorStop(0, 'rgba(255,232,195,.14)'); gy.addColorStop(0.45, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(10,5,2,.26)');
    ctx.fillStyle = gy; ctx.fillRect(-9 * b, N - 1, 18 * b, W - N + 3);
    const chest = ctx.createRadialGradient(4.4 * b, S0 + 1.4, 0, 4.4 * b, S0 + 1.4, 5.5);
    chest.addColorStop(0, 'rgba(255,236,205,.2)'); chest.addColorStop(1, 'rgba(255,236,205,0)');
    ctx.fillStyle = chest; ctx.fillRect(-2, N, 12, 10);
    const spill = ctx.createRadialGradient(7 * b, N + 1, 0, 7 * b, N + 1, 6); // warm headlamp spill on the front shoulder/chest
    spill.addColorStop(0, 'rgba(255,190,110,.22)'); spill.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = spill; ctx.fillRect(0, N - 2, 12, 9);
  };
  if (lod >= 1) {
    ctx.save(); shirt(); ctx.clip(); volume();
    ctx.strokeStyle = shade(L.shirt, 0.62); ctx.lineWidth = 0.45; ctx.beginPath(); // cloth folds under the arm + at the waist
    ctx.moveTo(-4.6 * b, S0 + 2.4); ctx.quadraticCurveTo(-3.6 * b, S0 + 4, -4.4 * b, S0 + 5.6);
    ctx.moveTo(5.4 * b, W - 1.4); ctx.quadraticCurveTo(4 * b, W - 0.6, 2.6 * b, W - 1); ctx.stroke();
    ctx.restore();
    if (L.vest) {
      ctx.save(); vest(); ctx.clip();
      ctx.fillStyle = '#e8ebee'; ctx.fillRect(-8 * b, S0 + 2.4, 17 * b, 1.7); ctx.fillRect(-8 * b, S0 + 5.6, 17 * b, 1.7); // reflective bands
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-8 * b, S0 + 2.4, 17 * b, 0.45); ctx.fillRect(-8 * b, S0 + 5.6, 17 * b, 0.45);
      ctx.fillStyle = shade(v, 0.6); ctx.fillRect(2.1, S0 + 3.4, 0.5, 9); // zip
      volume();
      ctx.strokeStyle = shade(v, 0.55); ctx.lineWidth = 0.5; ctx.beginPath(); // vest gathers at the waist
      for (const fx of [-2.6, 0.4, 3.6]) { ctx.moveTo(fx * b, W - 3); ctx.quadraticCurveTo(fx * b + 0.6, W - 1.4, fx * b - 0.2, W + 0.6); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(70,40,20,.3)'; for (let i = 0; i < 4; i++) ctx.fillRect(-4 + hash(L.seed * 7 + i) * 9, W - 2 + hash(L.seed * 9 + i) * 2.4, 1.1, 0.6); // dirt
      ctx.restore();
      ctx.beginPath(); ctx.roundRect(4.2 * b, S0 + 1, 3, 2.6, 0.5); inked(shade(v, 0.86)); // chest pocket (proud of the vest)
      ctx.beginPath(); ctx.moveTo(4 * b, S0 + 1); ctx.lineTo(7.6 * b, S0 + 1); ctx.lineTo(7.4 * b, S0 + 2); ctx.lineTo(4.1 * b, S0 + 2); ctx.closePath(); inked(shade(v, 0.72)); // its flap sticks out
    }
    if (lod >= 2) {
      ctx.beginPath(); ctx.moveTo(0.2, N); ctx.lineTo(2.1, N + 2.8); ctx.lineTo(3, N); ctx.closePath(); inked(shade(L.shirt, 0.9)); // collar points
      ctx.beginPath(); ctx.moveTo(3, N); ctx.lineTo(4, N + 2.6); ctx.lineTo(5.2, N + 0.2); ctx.closePath(); inked(shade(L.shirt, 0.9));
      if (L.vest) { ctx.beginPath(); ctx.roundRect(-2.6, N + 2, 1.6, 2.6, 0.4); inked('#2a2a2a'); ctx.fillStyle = '#9aa2aa'; ctx.fillRect(-2.3, N + 1, 0.45, 1.1); ctx.fillStyle = '#d23c2c'; ctx.fillRect(-2.2, N + 2.6, 0.5, 0.5); } // radio
    }
  }
  ctx.restore();
  // belt: leather with a highlight, loops that stick out, a buckle with a hard specular glint
  ctx.beginPath(); ctx.roundRect(-5.2 * b, W - 1.2, 11.2 * b, 2.8, 0.6); inked('#3a2516');
  ctx.fillStyle = 'rgba(255,220,170,.22)'; ctx.fillRect(-5 * b, W - 1, 10.8 * b, 0.5);
  for (const lx of [-3.8 * b, 4.4 * b]) { ctx.beginPath(); ctx.rect(lx, W - 1.6, 0.9, 3.6); inked('#5a3a22'); }
  ctx.beginPath(); ctx.roundRect(0.6, W - 1.4, 3.2, 3.2, 0.6); inked('#c9a443'); ctx.fillStyle = '#3a2516'; ctx.fillRect(1.6, W - 0.4, 1.2, 1.2);
  ctx.fillStyle = '#fff8dc'; ctx.fillRect(0.9, W - 1.1, 0.8, 0.6); // specular
  if (L.toolBelt) {
    ctx.fillStyle = '#5a5f66'; ctx.fillRect(-6.6 * b, W - 3.8, 1.1, 6.2); ctx.beginPath(); ctx.rect(-7.4 * b, W - 4.4, 2.8, 1.4); inked('#6b7178');
    ctx.fillStyle = '#e8f0f6'; ctx.fillRect(-7.2 * b, W - 4.3, 0.8, 0.4); // hammer head glint
    ctx.beginPath(); ctx.roundRect(-6.6 * b, W + 0.2, 4.2, 5.6, 1); inked('#8a5c32'); // pouch
    ctx.beginPath(); ctx.moveTo(-6.8 * b, W + 0.1); ctx.lineTo(-2.2 * b, W + 0.1); ctx.lineTo(-2.4 * b, W + 1.8); ctx.lineTo(-6.6 * b, W + 1.8); ctx.closePath(); inked('#6e4826'); // flap
    ctx.fillStyle = 'rgba(255,225,180,.35)'; ctx.fillRect(-6.3 * b, W + 2.4, 0.6, 3); // sharp leather highlight
    ctx.beginPath(); ctx.roundRect(4.4 * b, W + 0.2, 3.4, 4.8, 1); inked('#7a5030'); ctx.fillStyle = 'rgba(255,225,180,.3)'; ctx.fillRect(6.8 * b, W + 0.8, 0.5, 3.4);
  }
}

function head(L: Look, lod: number, lit: boolean, lift = 0) {
  ctx.save(); ctx.translate(0, NECK_Y + 31.6); // the head sits on the (higher) neck; it is ~12% smaller than before relative to the body
  // neck: thick, shadowed under the jaw
  ctx.beginPath(); ctx.roundRect(-1.2, -33.6, 4.2, 3.6, 1); inked(L.skinD);
  // skull + square jaw (facing +x): rounder cranium, flatter jaw line
  const face = () => { ctx.beginPath(); ctx.moveTo(-3.2, -38.6); ctx.quadraticCurveTo(-3.8, -41.6, 1, -41.6); ctx.quadraticCurveTo(5.8, -41.6, 5.7, -37.4);
    ctx.lineTo(5.9, -34.6); ctx.quadraticCurveTo(5.6, -31.9, 2.6, -31.7); ctx.lineTo(0.2, -31.9); ctx.quadraticCurveTo(-3, -32.4, -3.4, -35.4); ctx.closePath(); };
  face(); inked(L.skin);
  if (lod >= 2) {
    ctx.save(); face(); ctx.clip();
    ctx.fillStyle = 'rgba(60,30,15,.22)'; ctx.fillRect(-4, -42, 3.2, 11); // the back of the face in shadow
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-4, -33.4, 11, 2); // under the jaw
    if (L.beard === 0 || L.beard === 3) { ctx.fillStyle = 'rgba(40,28,20,.18)'; ctx.fillRect(0, -34.6, 6, 3); } // stubble shadow
    // face planes: brow ridge shadow, cheekbone light, shadow side of the nose, jaw underside, warm lamp spill on the cheek
    ctx.fillStyle = 'rgba(60,28,12,.22)'; ctx.fillRect(1.8, -38.2, 4.4, 0.9);
    ctx.fillStyle = 'rgba(255,230,200,.28)'; ctx.beginPath(); ctx.ellipse(3.6, -35.9, 1.5, 0.8, -0.3, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(60,28,12,.25)'; ctx.beginPath(); ctx.ellipse(4.7, -35.6, 0.6, 1.1, 0.3, 0, 6.283); ctx.fill();
    const sp = ctx.createRadialGradient(5.6, -37, 0, 5.6, -37, 4.5); sp.addColorStop(0, 'rgba(255,190,110,.22)'); sp.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = sp; ctx.fillRect(1, -41, 8, 9);
    ctx.fillStyle = 'rgba(90,50,30,.25)'; for (let i = 0; i < 3; i++) ctx.fillRect(2 + hash(L.seed + i) * 3, -36 + hash(L.seed * 2 + i) * 3, 0.6, 0.6); // grime
    ctx.restore();
    // hair at the nape + sideburn
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-3.4, -39); ctx.quadraticCurveTo(-4.2, -35.4, -2.2, -33.8); ctx.lineTo(-1.2, -36.5); ctx.closePath(); ctx.fill();
    ctx.fillRect(-0.2, -38.6, 1.3, 3.2);
    // ear
    ctx.beginPath(); ctx.ellipse(-0.8, -36.4, 1.3, 1.7, 0, 0, 6.283); inked(L.skin);
    ctx.fillStyle = L.skinD; ctx.beginPath(); ctx.ellipse(-0.7, -36.3, 0.6, 0.9, 0, 0, 6.283); ctx.fill();
    // nose: rounded, shadow under it
    ctx.beginPath(); ctx.moveTo(5.4, -38); ctx.quadraticCurveTo(7.6, -36, 6.6, -35.2); ctx.quadraticCurveTo(5.8, -34.9, 5.3, -35.4); ctx.closePath(); inked(L.skin);
    ctx.fillStyle = 'rgba(60,30,15,.3)'; ctx.fillRect(5, -35.2, 1.6, 0.5);
    // eye: white + pupil, blinks now and then
    const blink = ((view.t + hash(L.seed) * 7) % 4.3) < 0.12;
    if (blink) { ctx.fillStyle = '#2b1f17'; ctx.fillRect(2.6, -37.6, 2.2, 0.5); }
    else { ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.ellipse(3.7, -37.5, 1.15, 0.95, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#21160f'; ctx.beginPath(); ctx.arc(4.15, -37.45, 0.62, 0, 6.283); ctx.fill(); }
    // brow: thick, angled down toward the nose (focused)
    ctx.fillStyle = L.grey ? '#7a746a' : L.hair; ctx.beginPath(); ctx.moveTo(2.3, -39.4); ctx.lineTo(5.4, -38.9); ctx.lineTo(5.3, -38.2); ctx.lineTo(2.4, -38.5); ctx.closePath(); ctx.fill();
    // beard: jagged edge along the jaw, darker than the hair; moustache; mouth
    const bc = shade(L.hair, 0.85);
    if (L.beard === 1) { ctx.fillStyle = 'rgba(40,28,20,.35)'; ctx.beginPath(); ctx.moveTo(-1, -35.6); ctx.quadraticCurveTo(0, -32, 3, -31.9); ctx.quadraticCurveTo(5.8, -32, 5.8, -34.6); ctx.lineTo(3, -33.6); ctx.closePath(); ctx.fill(); }
    if (L.beard === 2) { // a beard with volume: lighter on top where the lamp hits, darker under the chin, strands
      ctx.beginPath(); ctx.moveTo(-1.6, -37); ctx.lineTo(-1.2, -34);
      for (let i = 0; i <= 6; i++) { const x = -0.8 + i * 1.15; ctx.lineTo(x, -31.2 + (i % 2) * 0.9 + (i === 3 ? 0.6 : 0)); }
      ctx.lineTo(6, -34.4); ctx.lineTo(4.6, -34.2); ctx.quadraticCurveTo(2.8, -33.2, 1.2, -35.4); ctx.closePath();
      const bg = ctx.createLinearGradient(0, -35.5, 0, -30.8); bg.addColorStop(0, shade(bc, 1.3)); bg.addColorStop(1, shade(bc, 0.7));
      if (OL) { ctx.strokeStyle = INK; ctx.lineWidth = OL * 2; ctx.stroke(); } ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = shade(bc, 1.6); ctx.lineWidth = 0.3; ctx.beginPath();
      for (const [x0, y0] of [[0.6, -34], [2, -33.6], [3.4, -33.4], [1.4, -32.6], [4.4, -33.2]]) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + 0.3, y0 + 1.2); }
      ctx.stroke();
    }
    if (L.beard >= 2) { ctx.beginPath(); ctx.moveTo(3.4, -35.4); ctx.quadraticCurveTo(5, -35.9, 6.2, -35); ctx.lineTo(6, -34.2); ctx.quadraticCurveTo(4.8, -34.8, 3.4, -34.4); ctx.closePath(); inked(bc); } // moustache
    ctx.fillStyle = '#4a2418'; ctx.fillRect(4.1, -33.7, 1.7, 0.5); // set mouth
  }
  if (L.cap) {
    ctx.beginPath(); ctx.arc(1, -38.8, 4.9, Math.PI, 0); ctx.lineTo(8.4, -38.8); ctx.lineTo(8.4, -37.6); ctx.lineTo(1, -37.6); ctx.closePath(); inked(L.cap);
  } else if (L.helmet) {
    ctx.save(); ctx.translate(-lift * 0.6, -lift - 1.5); ctx.rotate(-lift * 0.06); // sits up on the head: eyes show under the brim
    if (lod >= 2) { ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1.4, -37); ctx.quadraticCurveTo(0.4, -30, 4, -30.1); ctx.stroke(); } // chin strap
    ctx.fillStyle = 'rgba(30,15,5,.3)'; ctx.fillRect(-3.2, -36.9, 9, 1.1); // brim shadow on the forehead
    ctx.beginPath(); ctx.arc(1, -38.6, 6.2, Math.PI, 0); ctx.lineTo(9.6, -38.6); ctx.quadraticCurveTo(9.8, -37, 8.8, -36.8); ctx.lineTo(-5.4, -36.8); ctx.quadraticCurveTo(-6, -37.6, -5.4, -38.6); ctx.closePath(); inked(L.helmet); // dome + brim
    if (lod >= 2) {
      ctx.save(); ctx.beginPath(); ctx.arc(1, -38.6, 6.2, Math.PI, 0); ctx.closePath(); ctx.clip();
      ctx.fillStyle = shade(L.helmet, 0.72); ctx.beginPath(); ctx.ellipse(-3.6, -39.5, 3.2, 5, 0, 0, 6.283); ctx.fill(); // shadow side
      ctx.fillStyle = shade(L.helmet, 0.8); ctx.fillRect(0.2, -45, 1.8, 6.6); // ridge
      ctx.fillStyle = '#2e2a26'; ctx.fillRect(-5.2, -40.4, 12.6, 1.1); // lamp band
      ctx.fillStyle = 'rgba(80,50,20,.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(-3 + hash(L.seed * 3 + i) * 8, -43.5 + hash(L.seed * 5 + i) * 3, 0.7, 0.5); // scuffs
      if (L.sticker) { ctx.fillStyle = ['', '#2f6fb0', '#2f8f4a', '#c0392b'][L.sticker]; ctx.beginPath(); ctx.arc(-2.2, -41.6, 1, 0, 6.283); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(1, -38.6, 5.5, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke(); // lit rim
      ctx.fillStyle = shade(L.helmet, 0.66); ctx.fillRect(-5.4, -37.5, 14.6, 0.7); // brim underside
    }
    ctx.beginPath(); ctx.roundRect(5, -43.4, 4.2, 4, 1); inked('#3b3f45'); // lamp housing
    ctx.fillStyle = lit ? '#fff6d0' : '#6b6550'; ctx.beginPath(); ctx.arc(8.5, -41.4, 1.7, 0, 6.283); ctx.fill();
    if (lit) { // a small hot core + a short controlled cone (no orb over the face) + warm spill on the brim
      const g = ctx.createRadialGradient(8.8, -41.4, 0, 8.8, -41.4, 3); g.addColorStop(0, 'rgba(255,248,220,.75)'); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(8.8, -41.4, 3, 0, 6.283); ctx.fill();
      const cg = ctx.createLinearGradient(9, 0, 19, 0); cg.addColorStop(0, 'rgba(255,236,180,.22)'); cg.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(9.4, -42.2); ctx.lineTo(19, -44.6); ctx.lineTo(19, -37.4); ctx.lineTo(9.4, -40.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,150,.4)'; ctx.fillRect(6, -37.4, 3.4, 0.6); // spill on the brim edge
    }
    ctx.restore();
  } else if (lod >= 2) {
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(1, -38.4, 4.9, Math.PI * 1.02, -0.1); ctx.fill();
  }
  ctx.restore();
}

/** Two-link arm by IK: shoulder (sx,sy) → elbow → hand (hx,hy); `flip` picks the elbow side. Returns nothing. */
function armIK(sx: number, sy: number, hx: number, hy: number, L: Look, back: boolean, flip = 1, grip = false, handAng?: number) {
  const reach = UPPER + FORE - 0.3;
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
  if (d > reach) { hx = sx + (dx * reach) / d; hy = sy + (dy * reach) / d; dx = hx - sx; dy = hy - sy; d = reach; }
  const ca = Math.max(-1, Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d)));
  const ea = Math.atan2(dy, dx) + flip * Math.acos(ca);
  armChain(sx, sy, sx + Math.cos(ea) * UPPER, sy + Math.sin(ea) * UPPER, hx, hy, L, back, grip, handAng);
}
/** The pick along `ang` from the grip origin (gx,gy); the head sits `head` units out (hands slide on the handle). */
function pickaxe(tool: Tool, gx: number, gy: number, ang: number, head: number) {
  const hs = tool.headScale;
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang);
  seg(Math.max(2, head - 25), 0, head + 1, 0, 2.2 + hs * 0.6, tool.handle);
  ctx.strokeStyle = tool.head; ctx.lineWidth = 2.6 * hs; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(head - 2 * hs, -9 * hs); ctx.quadraticCurveTo(head + 6 * hs, 0, head - hs, 10 * hs); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(head - 2, -2, 3, 2);
  if (hs > 1.3) { ctx.fillStyle = tool.head; ctx.fillRect(head - 3, -4, 7, 8); }
  ctx.restore();
}

/** Leg by IK: hip (hx,hy) → knee (bends forward) → foot planted at (fx, 0). */
function legIK(hx: number, hy: number, fx: number, L: Look, back: boolean) {
  const len = THIGH + SHIN - 0.2;
  let dx = fx - hx, dy = -hy, d = Math.hypot(dx, dy) || 1;
  let footY = 0;
  if (d > len) { footY = -(d - len) * 0.9; dy = footY - hy; d = Math.hypot(dx, dy); } // on the toes when stretched
  const ca = Math.max(-1, Math.min(1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d)));
  const ka = Math.atan2(dy, dx) - Math.acos(ca); // knee forward (+x)
  legChain(hx, hy, hx + Math.cos(ka) * THIGH, hy + Math.sin(ka) * THIGH, fx, footY, L, back);
}
/** Screen px height of one rig at `scale` under the current transform (for LOD). */
function screenH(scale: number) {
  const m = ctx.getTransform();
  return (RIG_H * scale * Math.hypot(m.c, m.d)) / view.dpr;
}

function silhouette(L: Look) {
  ctx.fillStyle = L.pants; ctx.fillRect(-3.4, -17, 7, 17);
  ctx.fillStyle = L.boots; ctx.fillRect(-3.6, -3, 8, 3);
  ctx.fillStyle = L.vest ? '#f36b1c' : L.shirt; ctx.beginPath(); ctx.roundRect(-5.6, -31.5, 12.4, 15.5, 4); ctx.fill();
  if (L.vest) { ctx.fillStyle = '#e9ecef'; ctx.fillRect(-5.6, -24, 12.4, 2); }
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(1, -36.5, 4.8, 0, 6.283); ctx.fill();
  if (L.helmet || L.cap) { ctx.fillStyle = L.helmet || L.cap; ctx.beginPath(); ctx.arc(1, -39.5, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(-5, -39.5, 14, 2); }
  if (L.helmet) { ctx.fillStyle = '#fff2c4'; ctx.fillRect(7.6, -43, 2.4, 2.4); }
}

/** Draw a person. (x, y) = feet in the current space; `scale` = px per rig unit; dir 1 faces +x. */
export function drawRig(x: number, y: number, scale: number, dir: number, L: Look, p: Pose) {
  const s = scale * L.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const px = screenH(s);
  const lod = px < 14 ? 0 : px < 30 ? 1 : 2;
  OL = lod >= 1 ? Math.min(0.9, 64 / px) : 0; // ~1.6 screen px of ink at any size (bold outline, like the reference)
  // contact shadow only
  if (p.k !== 'sit' && p.k !== 'climb' && p.k !== 'ladder') {
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(0.6, 0.5, 10.5 * L.build, 2.2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0.6, 0.4, 7 * L.build, 1.4, 0, 0, 6.283); ctx.fill();
  }
  if (lod === 0) { silhouette(L); ctx.restore(); return; }
  const lit = p.lit ?? true;
  const t = p.t;
  switch (p.k) {
    case 'swing': {
      // WHOLE-BODY SWING, driven by the pick angle (rest -0.5, raised -2.5, impact +1.05):
      //   wind-up: arch back, rise, weight on the back foot · strike: hinge forward at the hips, knees bend into a
      //   crouch, head nods down at the target · impact: body compressed · recovery: rises back. Feet stay planted.
      const angle = p.a ?? -0.5, tired = p.tired ?? 0;
      const up = Math.max(0, Math.min(1, (-0.5 - angle) / 2)) * (0.88 + hash(L.seed * 1.7) * 0.24) * (1 - 0.3 * tired), down = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
      if (down > 0.97) ctx.translate(Math.sin(view.t * 95 + L.seed) * 0.35, Math.cos(view.t * 80) * 0.25); // impact recoil: the shock runs through the body
      const breathe = Math.sin(view.t * 2.1 + x * 0.7) * 0.22 * (1 - down) * (1 - up);
      const hinge = 0.1 + 0.55 * down * down - 0.2 * up + 0.14 * tired; // torso pitch about the hip (forward +)
      const drop = 0.5 + 3.4 * down - 0.6 * up + breathe; // hips sink as the knees bend
      const hipX = -0.6 - 1.6 * down + 0.6 * up, hipY = HIP_Y + drop;
      legIK(hipX - 1.2, hipY, -5.6, L, true); // back foot (wide, braced stance)
      // torso + head in the hinged frame
      const rot = (px: number, py: number) => { const dx = px, dy = py - HIP_Y; return { x: hipX + dx * Math.cos(hinge) - dy * Math.sin(hinge), y: hipY + dx * Math.sin(hinge) + dy * Math.cos(hinge) }; };
      const shB = rot(-1.4, SHOULDER_Y + 0.6), shF = rot(1.2, SHOULDER_Y);
      // the pick's head lands where the rigid rig's would (impact point unchanged): aim from the new grip
      const H = { x: Math.cos(angle) * 33, y: PICK_SH + Math.sin(angle) * 33 };
      const grip = { x: (shB.x + shF.x) / 2 + Math.cos(angle) * 3, y: (shB.y + shF.y) / 2 + Math.sin(angle) * 3 };
      const ang = Math.atan2(H.y - grip.y, H.x - grip.x), reachH = Math.hypot(H.x - grip.x, H.y - grip.y);
      const hand1 = { x: grip.x + Math.cos(ang) * Math.max(6, reachH - 22), y: grip.y + Math.sin(ang) * Math.max(6, reachH - 22) }; // lower hand
      const hand2 = { x: grip.x + Math.cos(ang) * Math.max(11, reachH - 14), y: grip.y + Math.sin(ang) * Math.max(11, reachH - 14) }; // upper hand (chokes up)
      if (p.tool && up > 0.35) pickaxe(p.tool, grip.x, grip.y, ang, reachH); // raised over the back: behind the body
      armIK(shB.x, shB.y, hand1.x, hand1.y, L, true, 1, true, ang + Math.PI / 2);
      ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(hinge); ctx.translate(0, -HIP_Y);
      torso(L, lod, breathe * 4);
      ctx.translate(1, -32.5); ctx.rotate(0.22 * down - 0.12 * up + 0.25 * tired); ctx.translate(-1, 32.5); // head nods to the target
      head(L, lod, lit);
      ctx.restore();
      legIK(hipX + 1.2, hipY, 6.4, L, false); // front foot, knee forward
      if (p.tool && up <= 0.35) pickaxe(p.tool, grip.x, grip.y, ang, reachH);
      armIK(shF.x, shF.y, hand2.x, hand2.y, L, false, 1, true, ang + Math.PI / 2);
      break;
    }
    case 'jack': {
      const angle = p.a ?? -0.5;
      const lean = Math.max(0, angle) * 0.1 - 0.03;
      ctx.save(); ctx.rotate(lean);
      leg(-1.6, -0.18, 0.05, L, true); leg(1.6, 0.26, -0.08, L, false);
      torso(L, lod); head(L, lod, lit);
      ctx.restore();
      {
        const plunge = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
        const jx = 17, jy = -6 + plunge * 9 + (plunge > 0.9 ? Math.sin(view.t * 120) * 0.8 : 0);
        seg(0, -26, jx - 3, jy - 20, 4, L.shirt);
        const tn = p.tool?.name ?? '', diamond = tn.startsWith('Diamond'), hell = tn.startsWith('Hell');
        const sc = p.tool?.headScale ?? 1, bw = 10 * sc, bh = 17 * sc;
        ctx.fillStyle = hell ? '#2a1a18' : diamond ? '#2a4a6a' : '#ffcf3a'; ctx.beginPath(); ctx.roundRect(jx - bw / 2, jy - 8 - bh, bw, bh, 2); ctx.fill(); // body
        ctx.fillStyle = hell ? '#ff5a2a' : diamond ? '#9be8ff' : 'rgba(0,0,0,.18)'; ctx.fillRect(jx - bw / 2, jy - 8 - bh * 0.55, bw, 2); // trim band
        if (hell) { ctx.fillStyle = 'rgba(255,120,40,.85)'; for (let i = 0; i < 3; i++) ctx.fillRect(jx - bw / 2 + 1.5 + i * (bw - 3) / 3, jy - 8 - bh * 0.85, 1.5, bh * 0.5); } // glowing vents
        ctx.fillStyle = '#3b3f45'; ctx.fillRect(jx - 8 * sc, jy - 10 - bh, 16 * sc, 3); // handles
        if (diamond) { // spiral diamond bit, spinning
          ctx.fillStyle = '#c9d2dc'; ctx.fillRect(jx - 2, jy - 8, 4, 13);
          ctx.strokeStyle = '#9be8ff'; ctx.lineWidth = 1.4; ctx.beginPath(); const ph = (view.t * 30) % 4; for (let y = jy - 8 - ph; y < jy + 5; y += 4) { ctx.moveTo(jx - 2.5, Math.max(jy - 8, y)); ctx.lineTo(jx + 2.5, Math.max(jy - 8, y + 2)); } ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(jx - 2.5, jy + 5); ctx.lineTo(jx + 2.5, jy + 5); ctx.lineTo(jx, jy + 9); ctx.closePath(); ctx.fill();
          if (plunge > 0.85) { ctx.fillStyle = 'rgba(190,240,255,.9)'; ctx.fillRect(jx + 3, jy + 6, 1.5, 1.5); ctx.fillRect(jx - 5, jy + 4, 1.2, 1.2); }
        } else if (hell) { // red-hot breaker point + licking flames
          const hot = ctx.createLinearGradient(0, jy - 8, 0, jy + 6); hot.addColorStop(0, '#5a5f66'); hot.addColorStop(0.5, '#ff7a2a'); hot.addColorStop(1, '#ffe08a');
          ctx.fillStyle = hot; ctx.beginPath(); ctx.moveTo(jx - 2.5, jy - 8); ctx.lineTo(jx + 2.5, jy - 8); ctx.lineTo(jx + 1.5, jy + 4); ctx.lineTo(jx, jy + 8); ctx.lineTo(jx - 1.5, jy + 4); ctx.closePath(); ctx.fill();
          for (let i = 0; i < 3; i++) { const fl = Math.sin(view.t * 14 + i * 2) * 1.5; ctx.fillStyle = i ? 'rgba(255,170,40,.75)' : 'rgba(255,80,20,.8)'; ctx.beginPath(); ctx.moveTo(jx - bw / 2 + i * bw / 2.2, jy - 8 - bh); ctx.quadraticCurveTo(jx - bw / 2 + i * bw / 2.2 + fl, jy - 12 - bh - 4, jx - bw / 2 + i * bw / 2.2 + 2, jy - 8 - bh - 9 - i); ctx.quadraticCurveTo(jx - bw / 2 + i * bw / 2.2 + 3, jy - 8 - bh - 3, jx - bw / 2 + i * bw / 2.2 + 3.5, jy - 8 - bh); ctx.fill(); }
        } else { ctx.fillStyle = '#aab3bd'; ctx.fillRect(jx - 1.5, jy - 8, 3, 12); }
        ctx.fillStyle = L.glove; ctx.beginPath(); ctx.arc(jx - 6 * sc, jy - 8.5 - bh, 2.2, 0, 6.283); ctx.arc(jx + 6 * sc, jy - 8.5 - bh, 2.2, 0, 6.283); ctx.fill();
      }
      break;
    }
    case 'walk': case 'carry': case 'climb': {
      const ph = t * Math.PI * 2, sw = Math.sin(ph);
      const climb = p.k === 'climb';
      const bob = Math.abs(Math.cos(ph)) * 1.1;
      ctx.translate(0, -bob);
      ctx.rotate(climb ? 0.12 : 0.09); // leaning into the walk
      const lift = climb ? 0.5 : 0;
      leg(-1.4, -sw * 0.45 + Math.max(0, -sw) * lift, sw * 0.1 - Math.max(0, -sw) * lift * 1.6, L, true);
      if (p.k === 'carry') {
        leg(1.4, sw * 0.45, -sw * 0.1, L, false);
        torso(L, lod); head(L, lod, lit);
        // block held at chest height with both hands
        arm(-1, SHOULDER_Y, 0.9, 1.9, L, true);
        ctx.fillStyle = p.carryCol ?? '#a8a196'; ctx.fillRect(6, -26, 9, 6);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(6, -26, 9, 1.4);
        arm(1, SHOULDER_Y, 0.8, 1.7, L, false);
      } else {
        arm(-0.5, SHOULDER_Y, sw * 0.7, sw * 0.6 + 0.4, L, true);
        leg(1.4, sw * 0.45 + Math.max(0, sw) * lift, -sw * 0.1 - Math.max(0, sw) * lift * 1.6, L, false);
        torso(L, lod); head(L, lod, lit);
        arm(0.5, SHOULDER_Y, -sw * 0.7, -sw * 0.6 + 0.4, L, false);
      }
      break;
    }
    case 'sit': {
      // seat height 11; thighs forward, shins down; leaning back a touch
      const hy = -11;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(5, 0.4, 6, 1.4, 0, 0, 6.283); ctx.fill();
      ctx.translate(0, hy - HIP_Y);
      leg(-1.2, 1.45, -0.05, L, true); leg(1.2, 1.5, 0.05, L, false);
      ctx.rotate(-0.06);
      torso(L, lod);
      const drink = p.a ?? 0; // 0..1 canteen to mouth
      head(L, lod, lit);
      arm(-0.5, SHOULDER_Y, 0.55, 1.2, L, true);
      if (drink > 0) {
        const h = arm(0.5, SHOULDER_Y, 0.6 + drink * 1.6, 1.8 + drink * 1.2, L, false);
        ctx.fillStyle = '#4b6b7a'; ctx.beginPath(); ctx.roundRect(h.x - 1.5, h.y - 5, 3.2, 6, 1); ctx.fill();
      } else arm(0.5, SHOULDER_Y, 0.7, 1.35, L, false);
      break;
    }
    case 'wipe': case 'helmet': case 'drink': case 'look': case 'stand': case 'cheer': case 'gesture': case 'drive': {
      const breathe = Math.sin(view.t * 2.2 + x) * 0.25, tired = p.tired ?? 0;
      // weight on one leg (straight, under the hip); the other relaxed with a bent knee — the weight drifts slowly
      const ws = 0.5 + 0.5 * Math.sin(view.t * 0.37 + L.seed * 6.1), hx0 = -0.6 + 1.2 * ws, hy0 = HIP_Y + 0.55 + tired * 0.8;
      legIK(hx0 - 1.5, hy0, hx0 - 1.5 - 2.4 * (1 - ws) - 0.6, L, true);
      ctx.save(); ctx.translate(0, breathe * 0.4); ctx.translate(hx0, hy0 - HIP_Y); ctx.rotate((ws - 0.5) * 0.05);
      legIK(1.5, HIP_Y, 1.5 + 2.4 * ws + 0.4, L, false); ctx.restore();
      ctx.translate(hx0, hy0 - HIP_Y + breathe * 0.4); ctx.rotate((ws - 0.5) * 0.05 + 0.12 * tired);
      const k = Math.sin(Math.min(1, t) * Math.PI); // 0 -> 1 -> 0 over the idle
      // back arm
      if (p.k === 'helmet') arm(-0.5, SHOULDER_Y, 2.4 * k + 0.1, 3.0 * k + 0.2, L, true);
      else if (p.k === 'cheer') arm(-0.5, SHOULDER_Y, 2.9, 3.0, L, true);
      else arm(-0.5, SHOULDER_Y, 0.12 + Math.sin(view.t * 1.3 + L.seed) * 0.05, 0.25, L, true);
      torso(L, lod, breathe * 4);
      // head: drink tilts back, look turns over the shoulder
      ctx.save();
      if (p.k === 'stand') { const gl = ((view.t + hash(L.seed) * 9) % 9) < 1.2 ? Math.sin(((view.t + hash(L.seed) * 9) % 9) / 1.2 * Math.PI) : 0; // occasional glance
        ctx.translate(1, NECK_Y); ctx.rotate(Math.sin(view.t * 1.9 + L.seed) * 0.02 - gl * 0.12); ctx.translate(-1, -NECK_Y); }
      if (p.k === 'drink') { ctx.translate(1, -32.5); ctx.rotate(-0.35 * k); ctx.translate(-1, 32.5); }
      if (p.k === 'look') { const side = Math.sin(t * Math.PI * 2); ctx.translate(1, -36); ctx.scale(side < -0.3 ? -1 : 1, 1); ctx.rotate(-0.15 * k); ctx.translate(-1, 36); }
      head(L, lod, lit, p.k === 'helmet' ? 2.4 * k : 0);
      ctx.restore();
      if (p.k === 'wipe') {
        const sweep = Math.sin(t * Math.PI * 4) * 0.25;
        arm(0.5, SHOULDER_Y, 2.2 * k + 0.1, 3.6 * k + sweep * k, L, false);
      } else if (p.k === 'helmet') arm(0.5, SHOULDER_Y, 2.5 * k + 0.1, 3.3 * k + 0.2, L, false);
      else if (p.k === 'drink') {
        const h = arm(0.5, SHOULDER_Y, 0.3 + 1.6 * k, 0.4 + 2.6 * k, L, false);
        ctx.fillStyle = '#4b6b7a'; ctx.beginPath(); ctx.roundRect(h.x - 1.6, h.y - 5, 3.2, 6, 1); ctx.fill();
      } else if (p.k === 'cheer') arm(0.5, SHOULDER_Y, 2.8, 3.1, L, false);
      else if (p.k === 'gesture') { const a = p.a ?? 0; arm(0.5, SHOULDER_Y, 0.4 + a * 1.2, 0.8 + a * 1.4, L, false); }
      else arm(0.5, SHOULDER_Y, 0.1 - Math.sin(view.t * 1.3 + L.seed) * 0.05, 0.22, L, false);
      break;
    }
    case 'ladder': {
      const q = p.ladder!, b = L.build;
      // legs: hip -> foot on its rung; the knee bends sideways as the foot comes up (seen from behind)
      const leg2 = (side: number, fh: number) => {
        const hx = side * 1.8 * b, hy = HIP_Y, fx = side * q.fx, fy = -fh;
        const len = THIGH + SHIN, dist = Math.hypot(fx - hx, fy - hy);
        const bend = Math.sqrt(Math.max(0, len * len - dist * dist)) * 0.5;
        const kx = (hx + fx) / 2 + side * bend * 0.3, ky = (hy + fy) / 2 + bend * 0.25;
        seg(hx, hy, kx, ky, 5 * b, L.pants); seg(kx, ky, fx, fy, 4.4 * b, shade(L.pants, 0.9));
        ctx.fillStyle = L.boots; ctx.beginPath(); ctx.roundRect(fx - 2, fy - 2.6, 4, 3.2, 1.2); ctx.fill(); // heel on the rung
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(fx - 2, fy + 0.2, 4, 0.8);
      };
      const sway = (q.hl - q.hr) * 0.05;
      leg2(-1, q.fl); leg2(1, q.fr);
      ctx.save(); ctx.translate(sway, 0);
      // torso from behind: symmetric, belt, hi-vis stripes if any
      ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.roundRect(-6 * b, -31.6, 12 * b, 15.4, [5, 5, 2, 2]); ctx.fill();
      if (lod >= 2) {
        ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(-0.4, -30, 0.8, 12); // spine seam
        if (L.vest === 'hivis' || L.vest === 'player') { ctx.fillStyle = '#eef0d0'; ctx.fillRect(-6 * b, -26, 12 * b, 1.4); ctx.fillRect(-6 * b, -21.6, 12 * b, 1.4); }
        if (L.belt) { ctx.fillStyle = '#2b2219'; ctx.fillRect(-5.6 * b, -18.6, 11.2 * b, 2.3); }
      }
      // arms: shoulder -> elbow (out to the side) -> glove gripping its rung (behind the head: the hands grip the ladder on the wall side)
      const arm2 = (side: number, hh: number) => {
        const sx = side * 5.2 * b + sway, sy = SHOULDER_Y - 3, hx = side * q.hx, hy = -hh;
        const dist = Math.hypot(hx - sx, hy - sy), len = UPPER + FORE;
        const bend = Math.sqrt(Math.max(0, len * len - dist * dist)) * 0.5;
        const ex = (sx + hx) / 2 + side * bend * 0.8, ey = (sy + hy) / 2 + bend * 0.2;
        seg(sx, sy, ex, ey, 3.9 * b, L.shirt); seg(ex, ey, hx, hy, 3.4 * b, L.sleeve);
        ctx.fillStyle = L.glove; ctx.beginPath(); ctx.ellipse(hx, hy, 2.3, 1.9, 0, 0, 6.283); ctx.fill();
      };
      arm2(-1, q.hl); arm2(1, q.hr);
      // head from behind: neck, ears, hair at the nape, helmet dome + brim
      ctx.fillStyle = L.skinD; ctx.fillRect(-1.3, -33.4, 2.6, 3);
      ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(0, -36.3, 4.2, 4.6, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = L.skinD; ctx.beginPath(); ctx.arc(-4.2, -36, 1.2, 0, 6.283); ctx.arc(4.2, -36, 1.2, 0, 6.283); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -36.3, 4.2, 4.6, 0, 0, 6.283); ctx.clip(); // back of the head: hair down to the nape
      ctx.fillStyle = L.hair; ctx.fillRect(-5, -42, 10, 7.4); ctx.restore();
      if (L.helmet) {
        ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(0, -38.4, 5.2, Math.PI, 0); ctx.fill();
        ctx.fillRect(-6.2, -39, 12.4, 2.1);
        if (lod >= 2) { ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-0.6, -43.4, 1.2, 4.6); ctx.fillStyle = '#3b3f45'; ctx.fillRect(-2.2, -39.6, 4.4, 1.2); } // lamp strap
      }
      ctx.restore();
      break;
    }
    case 'hammer': {
      // the hammer head travels to the AIM point and lands on it at HAMMER_IMPACT: raise back over the shoulder, then
      // an accelerating swing; the body leans toward low targets (feet stay planted)
      const aim = p.aim ?? { x: 16, y: 20 };
      const ph = t % 1, I = HAMMER_IMPACT;
      const lean = Math.max(0, Math.min(0.45, (16 - aim.y) * 0.03));
      leg(-1.8, -0.1 - lean * 0.6, 0.05 + lean * 0.4, L, true); leg(1.8, 0.2 + lean * 0.5, -0.1, L, false);
      const hipY = HIP_Y, sx0 = 0.5, sy0 = SHOULDER_Y;
      // shoulder after the torso rotates `lean` about the hip (clockwise = forward)
      const sx = sx0 * Math.cos(lean) - (sy0 - hipY) * Math.sin(lean), sy = hipY + sx0 * Math.sin(lean) + (sy0 - hipY) * Math.cos(lean);
      ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
      arm(-0.5, SHOULDER_Y, 0.9, 1.5, L, true); // the other hand steadies the work
      torso(L, lod); head(L, lod, lit);
      ctx.restore();
      const tx = aim.x, ty = -aim.y;
      let dx = tx - sx, dy = ty - sy; const dist = Math.hypot(dx, dy) || 1; dx /= dist; dy /= dist;
      const reach = UPPER + FORE - 0.4;
      let hix = tx - dx * HAMMER_LEN, hiy = ty - dy * HAMMER_LEN; // hand at impact
      const hd = Math.hypot(hix - sx, hiy - sy); if (hd > reach) { hix = sx + (hix - sx) * reach / hd; hiy = sy + (hiy - sy) * reach / hd; }
      const hrx = sx - 3, hry = sy - 12; // hand raised over the shoulder
      const angI = Math.atan2(dy, dx), angR = angI - 2.4;
      const k = ph < 0.5 ? 1 - (1 - ph / 0.5) ** 2 : ph < I ? 1 - ((ph - 0.5) / (I - 0.5)) ** 3 : 0; // 1 = raised, 0 = impact
      const hx = hix + (hrx - hix) * k, hy = hiy + (hry - hiy) * k, ang = angI + (angR - angI) * k;
      // two-link arm: shoulder -> elbow (bends down/out) -> hand
      const ax = hx - sx, ay = hy - sy, ad = Math.min(reach, Math.hypot(ax, ay)) || 1;
      const ca = Math.max(-1, Math.min(1, (UPPER * UPPER + ad * ad - FORE * FORE) / (2 * UPPER * ad)));
      const base = Math.atan2(ay, ax), ea = base + Math.acos(ca);
      const ex = sx + Math.cos(ea) * UPPER, ey = sy + Math.sin(ea) * UPPER;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
      seg(0, 0, HAMMER_LEN - 1.5, 0, 1.6, '#7a5532'); // handle
      ctx.beginPath(); ctx.rect(HAMMER_LEN - 2.4, -2.6, 3, 5.2); inked('#5b636c'); // head (strikes at the aim point)
      ctx.restore();
      armChain(sx, sy, ex, ey, hx, hy, L, false, true, ang + Math.PI / 2);
      break;
    }
  }
  ctx.restore();
}
