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
const SHOULDER_Y = -27, HIP_Y = -17;
const THIGH = 8.8, SHIN = 7.6, UPPER = 8.6, FORE = 8.2;

export type Role = 'player' | 'miner' | 'builder' | 'contractor' | 'hand';
export interface Look {
  skin: string; skinD: string; shirt: string; sleeve: string; pants: string; boots: string; glove: string;
  helmet: string; // '' = none
  cap: string; // '' = none (civilians)
  hair: string; beard: number; // 0 none, 1 stubble, 2 beard, 3 moustache
  vest: '' | 'hivis' | 'player'; belt: boolean; toolBelt: boolean;
  build: number; height: number;
}

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
}

const SKINS: [string, string][] = [['#f1c9a0', '#d9a77e'], ['#e0ae84', '#c58f68'], ['#c98d62', '#a8714b'], ['#9a6644', '#7d5135'], ['#6e4630', '#573623']];
const HAIRS = ['#2b1f17', '#4a3222', '#6b4a2e', '#1b1b1d', '#8a8378', '#a2662e'];
const MINER_SHIRTS = ['#4a6a86', '#56705a', '#5d6f8a', '#6d5a4a', '#4f5f6b', '#71644c'];
const MINER_PANTS = ['#33404d', '#3a3f34', '#2f3a44', '#3d3a36'];
const MINER_HATS = ['#d6b24a', '#d9a33a', '#e0c35a', '#cfd3d6'];
const BUILDER_SHIRTS = ['#3d6e9c', '#8a4f3a', '#4d6a4a', '#6a6f7a'];
const BUILDER_HATS = ['#f2f2ee', '#f0b330', '#e5e8ea'];

function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16);
  return `rgb(${Math.min(255, Math.round(((n >> 16) & 255) * k))},${Math.min(255, Math.round(((n >> 8) & 255) * k))},${Math.min(255, Math.round((n & 255) * k))})`;
}
const pick = <T,>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length];

/** Deterministic look for a role + seed. */
export function lookFor(role: Role, seed: number): Look {
  const r = (k: number) => hash(seed * 1.37 + k * 17.11);
  const [skin, skinD] = role === 'player' ? SKINS[0] : pick(SKINS, r(1));
  const base: Look = {
    skin, skinD, shirt: '#4a6a86', sleeve: '', pants: '#33404d', boots: '#3a2a1e', glove: '#5a4632',
    helmet: '', cap: '', hair: pick(HAIRS, r(2)), beard: r(3) < 0.45 ? 1 + Math.floor(r(4) * 3) : 0,
    vest: '', belt: true, toolBelt: false, build: 0.92 + r(5) * 0.16, height: 0.96 + r(6) * 0.08,
  };
  if (role === 'player') Object.assign(base, { shirt: '#d0532c', pants: '#3d4654', helmet: '#ffd83a', vest: 'player', beard: 0, hair: '#4a3222', build: 1, height: 1 });
  if (role === 'miner') Object.assign(base, { shirt: pick(MINER_SHIRTS, r(7)), pants: pick(MINER_PANTS, r(8)), helmet: pick(MINER_HATS, r(9)) });
  if (role === 'builder') Object.assign(base, { shirt: pick(BUILDER_SHIRTS, r(7)), pants: '#3b4a63', helmet: pick(BUILDER_HATS, r(9)), vest: 'hivis', toolBelt: true, glove: '#7a5a34' });
  if (role === 'contractor') Object.assign(base, { shirt: '#7a5a3a', pants: '#3a3f34', cap: '#3d5a3a', glove: skin, beard: 3, build: 1.08 });
  if (role === 'hand') Object.assign(base, { shirt: '#3d6e9c', pants: '#2f3a44', helmet: '#ffd83a', vest: 'hivis' });
  base.sleeve = shade(base.shirt, 0.8);
  return base;
}

function seg(x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

/** Leg from the hip; angles from straight down, positive = forward. */
function leg(hx: number, a1: number, a2: number, L: Look, back: boolean, hy = HIP_Y) {
  const kx = hx + Math.sin(a1) * THIGH, ky = hy + Math.cos(a1) * THIGH;
  const fx = kx + Math.sin(a2) * SHIN, fy = ky + Math.cos(a2) * SHIN;
  const col = back ? shade(L.pants, 0.82) : L.pants;
  seg(hx, hy, kx, ky, 5 * L.build, col);
  seg(kx, ky, fx, fy, 4.4 * L.build, col);
  ctx.fillStyle = back ? shade(L.boots, 0.8) : L.boots;
  ctx.beginPath(); ctx.roundRect(fx - 2.6, fy - 2.4, 7.2, 3.4, [2, 2.2, 1, 1]); ctx.fill();
}

/** Arm from a shoulder; angles from straight down, positive = forward. Returns the hand position. */
function arm(sx: number, sy: number, a1: number, a2: number, L: Look, back: boolean, bare = false) {
  const ex = sx + Math.sin(a1) * UPPER, ey = sy + Math.cos(a1) * UPPER;
  const hx = ex + Math.sin(a2) * FORE, hy = ey + Math.cos(a2) * FORE;
  seg(sx, sy, ex, ey, 3.9 * L.build, back ? shade(L.shirt, 0.72) : L.shirt);
  seg(ex, ey, hx, hy, 3.4 * L.build, bare ? L.skin : back ? shade(L.shirt, 0.72) : L.sleeve);
  ctx.fillStyle = back ? shade(L.glove, 0.85) : L.glove;
  ctx.beginPath(); ctx.arc(hx, hy, 2.1, 0, 6.283); ctx.fill();
  return { x: hx, y: hy };
}

function torso(L: Look, lod: number) {
  const b = L.build;
  ctx.fillStyle = L.shirt;
  ctx.beginPath();
  ctx.moveTo(-4.6 * b, HIP_Y + 0.5); ctx.lineTo(5.4 * b, HIP_Y + 0.5); ctx.lineTo(6.6 * b, -28);
  ctx.quadraticCurveTo(6.4 * b, -31.6, 2, -31.6); ctx.lineTo(-0.5, -31.6);
  ctx.quadraticCurveTo(-5.9 * b, -31.6, -6 * b, -28); ctx.closePath(); ctx.fill();
  if (lod < 2) return;
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-5 * b, -23, 11 * b, 1.1); // fold
  if (L.vest === 'player') { ctx.fillStyle = '#f2e27a'; ctx.fillRect(-5.6 * b, -26.5, 12.2 * b, 1.6); ctx.fillRect(-5.2 * b, -22, 11.6 * b, 1.6); }
  if (L.vest === 'hivis') {
    ctx.fillStyle = 'rgba(255,140,30,.9)'; ctx.fillRect(-5.4 * b, -30, 11.8 * b, 12);
    ctx.fillStyle = '#eef0d0'; ctx.fillRect(-5.4 * b, -25.5, 11.8 * b, 1.4); ctx.fillRect(-5.2 * b, -21.5, 11.4 * b, 1.4);
  }
  if (L.belt) { ctx.fillStyle = '#2b2219'; ctx.fillRect(-4.8 * b, -18.6, 10.4 * b, 2.3); ctx.fillStyle = '#c9a443'; ctx.fillRect(0.4, -18.4, 2.2, 1.9); }
  if (L.toolBelt) { ctx.fillStyle = '#8a6236'; ctx.fillRect(-5.4 * b, -17.6, 3.6, 4.4); ctx.fillRect(3.4 * b, -17.6, 3, 3.8); }
}

function head(L: Look, lod: number, lit: boolean, lift = 0) {
  ctx.fillStyle = L.skinD; ctx.fillRect(-0.4, -33.2, 2.8, 3); // neck
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(1, -36.3, 4.3, 4.7, 0, 0, 6.283); ctx.fill();
  if (lod >= 2) {
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-1.6, -36.6, 2.2, 3.4, 0, 0, 6.283); ctx.fill(); // hair at the back
    ctx.fillStyle = L.skinD; ctx.beginPath(); ctx.arc(-0.9, -35.8, 1.3, 0, 6.283); ctx.fill(); // ear
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.moveTo(4.9, -37); ctx.lineTo(6.4, -35.2); ctx.lineTo(4.9, -34.8); ctx.fill(); // nose
    ctx.fillStyle = '#2b1f17'; ctx.beginPath(); ctx.arc(3.3, -37.1, 0.72, 0, 6.283); ctx.fill(); // eye
    ctx.fillRect(2.3, -38.6, 2.2, 0.6); // brow
    if (L.beard === 1) { ctx.fillStyle = 'rgba(40,28,20,.28)'; ctx.beginPath(); ctx.ellipse(2.6, -33.6, 3, 1.6, 0, 0, 6.283); ctx.fill(); }
    if (L.beard === 2) { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(2.4, -33.4, 3.2, 2, 0.2, 0, 6.283); ctx.fill(); }
    if (L.beard === 3) { ctx.fillStyle = L.hair; ctx.fillRect(3.4, -34.6, 3, 1.1); }
  }
  if (L.cap) {
    ctx.fillStyle = L.cap; ctx.beginPath(); ctx.arc(1, -38.6, 4.6, Math.PI, 0); ctx.fill(); ctx.fillRect(1, -39.4, 7, 1.8);
  } else if (L.helmet) {
    ctx.save(); ctx.translate(-lift * 0.6, -lift); ctx.rotate(-lift * 0.06);
    ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(1, -38.4, 5.2, Math.PI, 0); ctx.fill();
    ctx.fillRect(-4.6, -39, 13, 2.1);
    if (lod >= 2) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-2.6, -42.8, 1.2, 4); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(2, -43, 3, 1.2); }
    ctx.fillStyle = '#3b3f45'; ctx.fillRect(5.2, -42.3, 3.4, 3.2); // lamp housing
    ctx.fillStyle = lit ? '#fff2c4' : '#6b6550'; ctx.fillRect(6.4, -41.7, 2.4, 2);
    ctx.restore();
  } else if (lod >= 2) {
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(1, -38, 4.5, Math.PI * 1.02, -0.1); ctx.fill();
  }
}

function pickaxe(tool: Tool, angle: number, lean: number, L: Look) {
  const hs = tool.headScale;
  ctx.save(); ctx.translate(0, SHOULDER_Y); ctx.rotate(angle + lean);
  seg(8, 0, 34, 0, 2.2 + hs * 0.6, tool.handle);
  ctx.strokeStyle = tool.head; ctx.lineWidth = 2.6 * hs; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(33 - 2 * hs, -9 * hs); ctx.quadraticCurveTo(33 + 6 * hs, 0, 33 - hs, 10 * hs); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(31, -2, 3, 2);
  if (hs > 1.3) { ctx.fillStyle = tool.head; ctx.fillRect(30, -4, 7, 8); }
  seg(0, 0, 11, 0, 4 * L.build, L.shirt); // front arm along the handle
  ctx.fillStyle = L.glove; ctx.beginPath(); ctx.arc(11, 0, 2.3, 0, 6.283); ctx.arc(19, 0, 2.2, 0, 6.283); ctx.fill();
  ctx.restore();
}

/** Screen px height of one rig at `scale` under the current transform (for LOD). */
function screenH(scale: number) {
  const m = ctx.getTransform();
  return (RIG_H * scale * Math.hypot(m.c, m.d)) / view.dpr;
}

function silhouette(L: Look) {
  ctx.fillStyle = L.pants; ctx.fillRect(-3, -17, 6, 17);
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.roundRect(-5, -31, 11, 15, 4); ctx.fill();
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(1, -36, 4.5, 0, 6.283); ctx.fill();
  if (L.helmet || L.cap) { ctx.fillStyle = L.helmet || L.cap; ctx.fillRect(-4, -41.5, 10, 4); }
}

/** Draw a person. (x, y) = feet in the current space; `scale` = px per rig unit; dir 1 faces +x. */
export function drawRig(x: number, y: number, scale: number, dir: number, L: Look, p: Pose) {
  const s = scale * L.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const px = screenH(s);
  const lod = px < 14 ? 0 : px < 30 ? 1 : 2;
  // contact shadow only
  if (p.k !== 'sit' && p.k !== 'climb' && p.k !== 'ladder') { ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(0.6, 0.4, 7.5 * L.build, 1.6, 0, 0, 6.283); ctx.fill(); }
  if (lod === 0) { silhouette(L); ctx.restore(); return; }
  const lit = p.lit ?? true;
  const t = p.t;
  switch (p.k) {
    case 'swing': case 'jack': {
      const angle = p.a ?? -0.5;
      const lean = Math.max(0, angle) * 0.1 - 0.03;
      if (p.k === 'swing') { ctx.save(); ctx.translate(0, SHOULDER_Y); ctx.rotate(angle); seg(-2, 0, 8, 0, 3.6 * L.build, L.sleeve); ctx.restore(); }
      ctx.save(); ctx.rotate(lean);
      leg(-1.6, -0.18, 0.05, L, true); leg(1.6, 0.26, -0.08, L, false);
      torso(L, lod); head(L, lod, lit);
      ctx.restore();
      if (p.k === 'swing' && p.tool) pickaxe(p.tool, angle, lean, L);
      else {
        const plunge = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
        const jx = 17, jy = -6 + plunge * 9 + (plunge > 0.9 ? Math.sin(view.t * 120) * 0.8 : 0);
        seg(0, -26, jx - 3, jy - 20, 4, L.shirt);
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.roundRect(jx - 5, jy - 25, 10, 17, 2); ctx.fill();
        ctx.fillStyle = '#3b3f45'; ctx.fillRect(jx - 8, jy - 27, 16, 3);
        ctx.fillStyle = '#aab3bd'; ctx.fillRect(jx - 1.5, jy - 8, 3, 12);
        ctx.fillStyle = L.glove; ctx.beginPath(); ctx.arc(jx - 6, jy - 25.5, 2.2, 0, 6.283); ctx.arc(jx + 6, jy - 25.5, 2.2, 0, 6.283); ctx.fill();
      }
      break;
    }
    case 'walk': case 'carry': case 'climb': {
      const ph = t * Math.PI * 2, sw = Math.sin(ph);
      const climb = p.k === 'climb';
      const bob = Math.abs(Math.cos(ph)) * 0.8;
      ctx.translate(0, -bob);
      ctx.rotate(climb ? 0.12 : 0.04);
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
        arm(-0.5, SHOULDER_Y, sw * 0.5, sw * 0.5 + 0.35, L, true);
        leg(1.4, sw * 0.45 + Math.max(0, sw) * lift, -sw * 0.1 - Math.max(0, sw) * lift * 1.6, L, false);
        torso(L, lod); head(L, lod, lit);
        arm(0.5, SHOULDER_Y, -sw * 0.5, -sw * 0.5 + 0.35, L, false);
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
      const breathe = Math.sin(view.t * 2.2 + x) * 0.25;
      ctx.translate(0, breathe);
      leg(-1.6, -0.08, 0.04, L, true); leg(1.6, 0.1, -0.04, L, false);
      const k = Math.sin(Math.min(1, t) * Math.PI); // 0 -> 1 -> 0 over the idle
      // back arm
      if (p.k === 'helmet') arm(-0.5, SHOULDER_Y, 2.4 * k + 0.1, 3.0 * k + 0.2, L, true);
      else if (p.k === 'cheer') arm(-0.5, SHOULDER_Y, 2.9, 3.0, L, true);
      else arm(-0.5, SHOULDER_Y, 0.12, 0.25, L, true);
      torso(L, lod);
      // head: drink tilts back, look turns over the shoulder
      ctx.save();
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
      else arm(0.5, SHOULDER_Y, 0.1, 0.22, L, false);
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
      seg(sx, sy, ex, ey, 3.9 * L.build, L.shirt); seg(ex, ey, hx, hy, 3.4 * L.build, L.sleeve);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
      seg(0, 0, HAMMER_LEN - 1.5, 0, 1.6, '#7a5532'); // handle
      ctx.fillStyle = '#5b636c'; ctx.fillRect(HAMMER_LEN - 2.4, -2.6, 3, 5.2); // head (strikes at the aim point)
      ctx.restore();
      ctx.fillStyle = L.glove; ctx.beginPath(); ctx.arc(hx, hy, 2.1, 0, 6.283); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
