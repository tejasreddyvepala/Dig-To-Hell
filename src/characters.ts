// Character + machine art (Canvas geometry, no assets). Stylised people ~4.7 heads tall: boots, bent knees,
// torso with belt, gloves, face with a nose, helmet with a lamp. All drawn in face-logical units, feet at (x, 0),
// facing +x (mirrored with dir). Pick geometry is unchanged from Step 2 so the tip still lands on the impact point
// (shoulder at y -27, tip 37 units out → at the impact angle it lands ~19 units ahead, 5 below the surface).
import { CFG, type Tool } from './config';
import { ctx, view } from './view';

const SKIN = '#efc49a', SKIN_D = '#d9a57c', BOOT = '#3a2a1e', GLOVE = '#5a4632';

export interface Look { shirt: string; pants: string; helmet: string; vest?: boolean; cap?: string }
export const PLAYER_LOOK: Look = { shirt: '#d0532c', pants: '#3d4654', helmet: '#ffd83a', vest: true };
export const CREW_LOOKS: Look[] = [
  { shirt: '#4a6a86', pants: '#33404d', helmet: '#d6b24a' },
  { shirt: '#56705a', pants: '#3a3f34', helmet: '#d6b24a' },
  { shirt: '#5d6f8a', pants: '#2f3a44', helmet: '#d6b24a' },
];

function limb(x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

/** Body without arms (arms are drawn with the tool). `stride` 0..1 animates legs (walking). */
function body(look: Look, stride = 0, lean = 0) {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0.5, 9, 2, 0, 0, 6.283); ctx.fill();
  ctx.save(); ctx.rotate(lean);
  // legs: hip -> knee -> ankle, slightly bent
  const sw = Math.sin(stride * Math.PI * 2) * 3;
  limb(-1.5, -17, -3 - sw * 0.5, -9, 4.8, look.pants); limb(-3 - sw * 0.5, -9, -4 - sw, -3, 4.4, look.pants);
  limb(1.5, -17, 3.5 + sw * 0.5, -9, 4.8, look.pants); limb(3.5 + sw * 0.5, -9, 4 + sw, -3, 4.4, look.pants);
  // boots
  ctx.fillStyle = BOOT;
  ctx.beginPath(); ctx.roundRect(-7 - sw, -4, 7, 4, [2, 1, 1, 1]); ctx.fill();
  ctx.beginPath(); ctx.roundRect(1.5 + sw, -4, 7.5, 4, [2, 2, 1, 1]); ctx.fill();
  // torso: rounded with shoulders, belt + buckle
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.roundRect(-5.5, -31, 12, 15, [5, 5, 2, 2]); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-5.5, -22, 12, 1.2); // shirt fold
  if (look.vest) { ctx.fillStyle = '#f2e27a'; ctx.fillRect(-5.5, -26, 12, 1.6); ctx.fillRect(-5.5, -21.5, 12, 1.6); }
  ctx.fillStyle = '#2b2219'; ctx.fillRect(-5.5, -18, 12, 2.4);
  ctx.fillStyle = '#c9a443'; ctx.fillRect(0, -17.8, 2.4, 2);
  // head: neck, face, ear, nose, eye
  ctx.fillStyle = SKIN_D; ctx.fillRect(-0.5, -33, 3, 3);
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(1, -36, 4.4, 0, 6.283); ctx.fill();
  ctx.fillStyle = SKIN_D; ctx.beginPath(); ctx.arc(-1.8, -35.5, 1.3, 0, 6.283); ctx.fill();
  ctx.fillStyle = SKIN_D; ctx.beginPath(); ctx.arc(5.2, -35.4, 1.4, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#2b1f17'; ctx.beginPath(); ctx.arc(3.2, -37, 0.75, 0, 6.283); ctx.fill();
  if (look.cap) { // civilians: a flat cap
    ctx.fillStyle = look.cap; ctx.beginPath(); ctx.arc(1, -38.5, 4.6, Math.PI, 0); ctx.fill(); ctx.fillRect(1, -39.3, 7, 1.8);
  } else { // miners: hard hat with brim and lamp housing
    ctx.fillStyle = look.helmet; ctx.beginPath(); ctx.arc(1, -38.2, 5.2, Math.PI, 0); ctx.fill();
    ctx.fillRect(-5, -38.8, 13, 2.2);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-3, -42.5, 1.2, 4);
  }
  ctx.restore();
}

/** Helmet lamp lens (bright = lit). */
function lamp(lit: boolean, player: boolean) {
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(5.2, -42.2, 3.4, 3.2);
  ctx.fillStyle = lit ? (player ? '#ffffff' : '#fff2c4') : '#6b6550'; ctx.fillRect(6.4, -41.6, 2.4, 2);
}

/** A miner with a tool; `angle` from swingAngle (0 forward, negative raised, positive driven down). */
export function drawMiner(x: number, dir: number, angle: number, tool: Tool, look: Look, scale: number, player: boolean, lit = true) {
  ctx.save();
  ctx.translate(x, 0); ctx.scale(dir * scale, scale);
  const lean = Math.max(0, angle) * 0.1 - 0.03;
  if (player) { // cheap dark rim: a slightly larger silhouette behind the player (shadowBlur is too costly here)
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(-7, -44, 15, 41, 6); ctx.fill();
  }
  // back arm (behind the body) reaches to the handle too
  if (tool.kind === 'pick') {
    ctx.save(); ctx.translate(0, -27); ctx.rotate(angle); limb(-2, 0, 8, 0, 3.6, shade(look.shirt)); ctx.restore();
  }
  body(look, 0, lean);
  lamp(lit, player);
  if (tool.kind === 'pick') {
    const hs = tool.headScale;
    ctx.save(); ctx.translate(0, -27); ctx.rotate(angle + lean);
    limb(8, 0, 34, 0, 2.2 + hs * 0.6, tool.handle); // handle
    ctx.strokeStyle = tool.head; ctx.lineWidth = 2.6 * hs; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(33 - 2 * hs, -9 * hs); ctx.quadraticCurveTo(33 + 6 * hs, 0, 33 - hs, 10 * hs); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(31, -2, 3, 2);
    if (hs > 1.3) { ctx.fillStyle = tool.head; ctx.fillRect(30, -4, 7, 8); }
    limb(0, 0, 11, 0, 4, look.shirt); // front arm (sleeve)
    ctx.fillStyle = GLOVE; ctx.beginPath(); ctx.arc(11, 0, 2.3, 0, 6.283); ctx.arc(19, 0, 2.2, 0, 6.283); ctx.fill();
    ctx.restore();
  } else {
    const plunge = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
    const jx = 17, jy = -6 + plunge * 9 + (plunge > 0.9 ? Math.sin(view.t * 120) * 0.8 : 0);
    limb(0, -26, jx - 3, jy - 20, 4, look.shirt);
    ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.roundRect(jx - 5, jy - 25, 10, 17, 2); ctx.fill();
    ctx.fillStyle = '#3b3f45'; ctx.fillRect(jx - 8, jy - 27, 16, 3);
    ctx.fillStyle = '#aab3bd'; ctx.fillRect(jx - 1.5, jy - 8, 3, 12);
    ctx.fillStyle = GLOVE; ctx.beginPath(); ctx.arc(jx - 6, jy - 25.5, 2.2, 0, 6.283); ctx.arc(jx + 6, jy - 25.5, 2.2, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

/** A surface person (contractor, yard hand, driver). arm 0..1 animates a gesture/work motion. */
export function drawCivilian(x: number, y: number, u: number, look: Look, arm: number, dir = 1, stride = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale((dir * u) / 40, u / 40); // u = this person's height in px
  ctx.save(); ctx.translate(0, -27); ctx.rotate(-0.4 - arm * 1.1); limb(0, 0, 10, 0, 3.6, shade(look.shirt)); ctx.restore();
  body(look, stride, 0);
  ctx.save(); ctx.translate(0, -27); ctx.rotate(0.9 - arm * 1.4);
  limb(0, 0, 11, 0, 4, look.shirt); ctx.fillStyle = look.cap ? SKIN : GLOVE; ctx.beginPath(); ctx.arc(11.5, 0, 2.2, 0, 6.283); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function shade(c: string) {
  const n = parseInt(c.slice(1), 16), k = 0.78;
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

/** Soft helmet-lamp cone from the lamp toward the work point (draw with 'lighter' after the darkness pass). */
export function drawLampBeam(x: number, dir: number, scale: number, strength: number, reach: number) {
  const lx = x + dir * 7.5 * scale, ly = -40.6 * scale;
  const tx = x + dir * reach * scale, ty = 4;
  const ang = Math.atan2(ty - ly, tx - lx), len = Math.hypot(tx - lx, ty - ly) * 1.35, spread = 0.38;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, len);
  g.addColorStop(0, `rgba(255,236,170,${strength})`); g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(lx, ly);
  ctx.arc(lx, ly, len, ang - spread, ang + spread);
  ctx.closePath(); ctx.fill();
  const pool = ctx.createRadialGradient(tx, ty - 2, 0, tx, ty - 2, 16 * scale);
  pool.addColorStop(0, `rgba(255,220,150,${strength * 0.7})`); pool.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(tx, ty - 2, 16 * scale, 0, 6.283); ctx.fill();
}

// ---------- compact tracked excavator with a real articulated arm ----------
const BOOM = 38, STICK = 31; // lengths (logical)
const SHOULDER = { x: 15, y: -27 };

/** Two-link IK: elbow position for shoulder S reaching wrist W (elbow bends upward). */
function elbow(sx: number, sy: number, wx: number, wy: number) {
  const dx = wx - sx, dy = wy - sy;
  const d = Math.min(BOOM + STICK - 0.01, Math.max(Math.abs(BOOM - STICK) + 0.01, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx);
  const b = Math.acos((BOOM * BOOM + d * d - STICK * STICK) / (2 * BOOM * d));
  return { x: sx + Math.cos(a - b) * BOOM, y: sy + Math.sin(a - b) * BOOM, d };
}

/** k 0..1: 0 = bucket raised/idle, 1 = bucket biting the face at `reach`. bounce: post-impact body rock. */
export function drawExcavator(x: number, dir: number, k: number, reach: number, bounce: number) {
  ctx.save(); ctx.translate(x, 0); ctx.scale(dir, 1);
  // timber mat it works from (a stable platform on the face)
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(-34, -2, 68, 4);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -30; i < 34; i += 9) ctx.fillRect(i, -2, 1, 4);
  // tracks
  ctx.fillStyle = '#23262a'; ctx.beginPath(); ctx.roundRect(-31, -12, 62, 10, 5); ctx.fill();
  ctx.fillStyle = '#4a4f55'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-23 + i * 11.5, -7, 3, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let i = -28; i < 30; i += 4) { ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i + 1.5, -10.5); ctx.stroke(); }
  // upper structure (rocks slightly after each bite)
  ctx.save(); ctx.translate(0, -bounce * 1.6); ctx.rotate(bounce * 0.015);
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(-18, -15, 32, 3); // slewing ring
  ctx.fillStyle = '#d99a14'; ctx.beginPath(); ctx.roundRect(-30, -30, 10, 16, 4); ctx.fill(); // counterweight
  ctx.fillStyle = '#eab01c'; ctx.beginPath(); ctx.roundRect(-24, -31, 40, 17, 3); ctx.fill(); // body
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-20, -24, 14, 1.2); ctx.fillRect(-20, -21, 14, 1.2); // engine louvres
  // cab: ~1.15 worker heights tall, glass + frame + roof
  ctx.fillStyle = '#eab01c'; ctx.beginPath(); ctx.roundRect(-6, -49, 20, 21, [4, 4, 0, 0]); ctx.fill();
  ctx.fillStyle = '#9fd0ea'; ctx.beginPath(); ctx.roundRect(-3, -46, 14, 14, 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, -45, 3, 12);
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(-7, -50, 22, 2.4);
  // operator silhouette in the cab
  ctx.fillStyle = 'rgba(40,40,40,.55)'; ctx.beginPath(); ctx.arc(4, -40, 3, 0, 6.283); ctx.fill();
  // arm: target the bucket tip, solve IK for the wrist so every joint stays attached
  const ease = k * k * (3 - 2 * k);
  const tip = { x: 46 + (reach - 46) * ease, y: -40 + (4 + 40) * ease };
  const curl = -0.5 + 1.7 * ease; // bucket curls into the face
  const wrist = { x: tip.x - Math.cos(curl) * 11, y: tip.y - Math.sin(curl) * 11 - 3 };
  const e = elbow(SHOULDER.x, SHOULDER.y, wrist.x, wrist.y);
  // hydraulic ram on the boom
  limb(4, -22, (SHOULDER.x + e.x) / 2, (SHOULDER.y + e.y) / 2 + 2, 2, '#9aa3ad');
  limb(SHOULDER.x, SHOULDER.y, e.x, e.y, 6.5, '#eab01c'); // boom
  limb(e.x, e.y, wrist.x, wrist.y, 5, '#d99a14'); // stick
  // pivots
  ctx.fillStyle = '#3b3f45';
  for (const p of [SHOULDER, e, wrist]) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.3, 0, 6.283); ctx.fill(); }
  // bucket hangs from the wrist pin
  ctx.save(); ctx.translate(wrist.x, wrist.y); ctx.rotate(curl);
  ctx.fillStyle = '#5f666e';
  ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(12, -4); ctx.lineTo(13, 3); ctx.quadraticCurveTo(6, 8, -2, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9d2dc'; for (let i = 0; i < 3; i++) ctx.fillRect(12, -3 + i * 2.6, 2.5, 1.4); // teeth
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

/** Excavator lamp beam (cab work light). */
export function drawExcavatorLight(x: number, dir: number, strength: number) {
  drawLampBeam(x + dir * 6, dir, 1, strength, CFG.excavatorReach - 6);
}
