// Machine art + lamp light (Canvas geometry, no assets). People are drawn by the shared CharacterRig (rig.ts).
// Drawn in face-logical units, ground at y = 0, facing +x (mirrored with dir).
import { CFG } from './config';
import { ctx } from './view';

function limb(x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
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
