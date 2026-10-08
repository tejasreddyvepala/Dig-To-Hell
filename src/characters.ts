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
  // a supporting light: short, narrow, soft-edged (three nested wedges, each fading out — no visible triangle),
  // brightest at the lamp; what matters is the small warm patch where the pick lands
  const ang = Math.atan2(ty - ly, tx - lx), len = Math.hypot(tx - lx, ty - ly) * 0.95;
  for (const [spread, k] of [[0.26, 0.35], [0.17, 0.4], [0.09, 0.45]] as const) {
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, len);
    g.addColorStop(0, `rgba(255,232,170,${strength * k})`); g.addColorStop(0.45, `rgba(255,226,160,${strength * k * 0.35})`); g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, len, ang - spread, ang + spread); ctx.closePath(); ctx.fill();
  }
  const pool = ctx.createRadialGradient(tx, ty - 2, 0, tx, ty - 2, 12 * scale);
  pool.addColorStop(0, `rgba(255,214,140,${strength * 0.8})`); pool.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(tx, ty - 2, 12 * scale, 0, 6.283); ctx.fill();
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

/** k 0..1: 0 = bucket raised/idle, 1 = bucket biting the face at `reach`. bounce: post-impact body rock.
 *  A real hydraulic excavator: tracked undercarriage (sprocket, idler, rollers, grousered shoes), slewing upper with
 *  engine hood, exhaust and rounded counterweight, framed cab with tinted glass, a curved ("banana") boom with its two
 *  boom cylinders, the stick cylinder, the bucket cylinder + linkage, hydraulic hoses, and a toothed bucket.
 *  Logical units (a worker ≈ 46 tall); everything is outlined and shaded from the upper-left. */
export function drawExcavator(x: number, dir: number, k: number, reach: number, bounce: number) {
  const Y = '#f2b21c', YL = '#ffd257', YD = '#b9800e', INK = 'rgba(28,20,10,.9)', STEEL = '#5b636c', STEEL_D = '#3a4047', CHROME = '#dfe6ec';
  const fillO = (path: () => void, fill: string | CanvasGradient, lw = 0.9) => { ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); };
  const rr = (x0: number, y0: number, w: number, h: number, r: number | number[]) => () => ctx.roundRect(x0, y0, w, h, r);
  const vgrad = (y0: number, y1: number, a: string, b: string) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const cyl = (x0: number, y0: number, x1: number, y1: number, ext: number, w: number) => { // hydraulic cylinder: barrel + chrome rod
    const mx = x0 + (x1 - x0) * ext, my = y0 + (y1 - y0) * ext;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 1.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(mx, my); ctx.stroke();
    ctx.strokeStyle = Y; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = w * 0.55 + 1; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = CHROME; ctx.lineWidth = w * 0.55; ctx.stroke();
  };
  const pin = (px: number, py: number, r = 1.8) => { ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(px - 0.4, py - 0.4, r * 0.45, 0, 6.283); ctx.fill(); };

  ctx.save(); ctx.translate(x, 0); ctx.scale(dir, 1);
  // ---- timber mat + undercarriage ----
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(-36, -2, 72, 4); ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -32; i < 36; i += 9) ctx.fillRect(i, -2, 1, 4);
  fillO(rr(-33, -13, 66, 11.5, 5.7), '#26292d'); // track chain loop
  ctx.fillStyle = '#3a3e43'; for (let i = -31; i < 32; i += 3.2) ctx.fillRect(i, -3.2, 2.2, 1.6); // grousers (bottom)
  for (let i = -30; i < 31; i += 3.2) ctx.fillRect(i, -13, 2.2, 1.3); // (top)
  fillO(rr(-27, -11, 54, 7, 2), '#4a4f55', 0.7); // track frame
  for (const [cx, r] of [[-28, 4.6], [28, 4.6]] as const) { fillO(() => ctx.arc(cx, -7.2, r, 0, 6.283), STEEL); ctx.fillStyle = STEEL_D; for (let t = 0; t < 8; t++) { const a = t * 0.785; ctx.fillRect(cx + Math.cos(a) * r - 0.6, -7.2 + Math.sin(a) * r - 0.6, 1.2, 1.2); } pin(cx, -7.2, 1.4); } // idler + sprocket
  for (let i = 0; i < 5; i++) pin(-17 + i * 8.5, -5.4, 1.7); // bottom rollers
  // ---- upper structure (slews with the dig rhythm a little, rocks after each bite) ----
  ctx.save(); ctx.translate(0, -bounce * 1.6); ctx.rotate(bounce * 0.015);
  fillO(rr(-20, -16.5, 36, 3.5, 1), '#2f3338', 0.7); // slewing ring
  // counterweight: rounded rear mass with the maker's stripe
  fillO(() => { ctx.moveTo(-23, -16.5); ctx.lineTo(-33, -17); ctx.quadraticCurveTo(-37, -24, -33, -31); ctx.lineTo(-22, -31); ctx.closePath(); }, vgrad(-31, -17, '#e3a516', '#a8740c'));
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-35, -22.5, 12, 1.6);
  // engine house + hood
  fillO(rr(-24, -31, 40, 15, [3, 3, 1, 1]), vgrad(-31, -16, YL, YD));
  ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 5; i++) ctx.fillRect(-21 + i * 3, -27, 1.6, 7); // radiator louvres
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-23, -30.2, 38, 1.1); // top highlight
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-23, -18.5); ctx.lineTo(15, -18.5); ctx.stroke(); // walkway edge
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-10, -26, 13, 2.2); ctx.fillStyle = YL; ctx.font = 'bold 2.4px sans-serif'; ctx.fillText('DIG CO', -9.5, -24.2); // decal
  // handrail + exhaust stack + beacon
  ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-22, -31); ctx.lineTo(-22, -36); ctx.lineTo(-8, -36); ctx.lineTo(-8, -31); ctx.stroke();
  fillO(rr(-15.5, -38, 2.6, 7, 0.6), '#2f3338', 0.6); ctx.fillStyle = '#111'; ctx.fillRect(-15.6, -38.6, 2.8, 1);
  const tPh = (performance.now() / 1000) % 1.4;
  ctx.fillStyle = `rgba(90,90,90,${(0.35 * (1 - tPh / 1.4)).toFixed(3)})`; ctx.beginPath(); ctx.arc(-14.2 - tPh * 3, -41 - tPh * 6, 1.4 + tPh * 2.4, 0, 6.283); ctx.fill(); // exhaust puff
  ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.arc(-1, -32, 1.4, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-2.6, -32, 3.2, 0.8);
  // cab: frame, tinted glass, wiper, operator
  fillO(() => { ctx.moveTo(-1, -16.5); ctx.lineTo(-1, -51); ctx.lineTo(13, -51); ctx.quadraticCurveTo(17, -50.5, 17.5, -46); ctx.lineTo(17.5, -16.5); ctx.closePath(); }, vgrad(-51, -16, YL, YD));
  fillO(() => { ctx.moveTo(1.5, -33); ctx.lineTo(1.5, -48.5); ctx.lineTo(12.5, -48.5); ctx.quadraticCurveTo(15.3, -48, 15.5, -45); ctx.lineTo(15.5, -33); ctx.closePath(); }, vgrad(-48, -33, '#bfe4f5', '#6aa6c6'), 0.7);
  ctx.fillStyle = 'rgba(40,40,40,.6)'; ctx.beginPath(); ctx.arc(7, -40.5, 2.6, 0, 6.283); ctx.fill(); ctx.fillRect(4.5, -38.2, 5, 4.5); // operator
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(3, -47); ctx.lineTo(6, -47); ctx.lineTo(2.6, -40); ctx.lineTo(2.6, -44); ctx.closePath(); ctx.fill(); // glass glare
  ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(15, -36); ctx.lineTo(11, -45); ctx.stroke(); // wiper
  fillO(rr(-2, -52.5, 19.5, 2.2, 1), '#2f3338', 0.6); // roof guard
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(15.8, -50, 2.4, 1.6); // cab work light
  // ---- the arm: banana boom + stick, solved so every joint stays attached ----
  const ease = k * k * (3 - 2 * k);
  const tip = { x: 46 + (reach - 46) * ease, y: -40 + (4 + 40) * ease };
  const curl = -0.5 + 1.7 * ease;
  const wrist = { x: tip.x - Math.cos(curl) * 11, y: tip.y - Math.sin(curl) * 11 - 3 };
  const e = elbow(SHOULDER.x, SHOULDER.y, wrist.x, wrist.y);
  const bAng = Math.atan2(e.y - SHOULDER.y, e.x - SHOULDER.x), nx = -Math.sin(bAng), ny = Math.cos(bAng);
  // boom cylinders (from the upper's front, low) pushing the boom's belly
  const bc = { x: SHOULDER.x + (e.x - SHOULDER.x) * 0.45 + nx * 3.5, y: SHOULDER.y + (e.y - SHOULDER.y) * 0.45 + ny * 3.5 };
  cyl(12, -19, bc.x, bc.y, 0.55, 3.2);
  // the boom: two straight halves with a bend, tapered, with a lit top edge
  const mid = { x: (SHOULDER.x + e.x) / 2 - nx * 4.5, y: (SHOULDER.y + e.y) / 2 - ny * 4.5 }; // the knee bends upward
  const boom = (w0: number, w1: number) => () => {
    const pts = [[SHOULDER.x, SHOULDER.y, w0], [mid.x, mid.y, (w0 + w1) / 2 + 0.6], [e.x, e.y, w1]];
    ctx.moveTo(pts[0][0] - nx * pts[0][2], pts[0][1] - ny * pts[0][2]);
    for (const [px, py, w] of pts) ctx.lineTo(px - nx * w, py - ny * w);
    for (const [px, py, w] of pts.slice().reverse()) ctx.lineTo(px + nx * w, py + ny * w);
    ctx.closePath();
  };
  fillO(boom(5.2, 3.8), Y);
  ctx.save(); ctx.beginPath(); boom(5.2, 3.8)(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,240,180,.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(SHOULDER.x - nx * 3.6, SHOULDER.y - ny * 3.6); ctx.lineTo(mid.x - nx * 3.6, mid.y - ny * 3.6); ctx.lineTo(e.x - nx * 2.6, e.y - ny * 2.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(SHOULDER.x + nx * 3.4, SHOULDER.y + ny * 3.4); ctx.lineTo(mid.x + nx * 3.4, mid.y + ny * 3.4); ctx.lineTo(e.x + nx * 2.4, e.y + ny * 2.4); ctx.stroke();
  ctx.restore();
  // hydraulic hoses running along the boom
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(SHOULDER.x + nx, SHOULDER.y + ny - 2); ctx.quadraticCurveTo(mid.x - nx * 1.5, mid.y - ny * 1.5 - 2, e.x - nx * 1.4, e.y - ny * 1.4); ctx.stroke();
  // stick cylinder: from the boom's back (near the knee) to the top of the stick
  const sAng = Math.atan2(wrist.y - e.y, wrist.x - e.x), snx = -Math.sin(sAng), sny = Math.cos(sAng);
  cyl(mid.x - nx * 5.5, mid.y - ny * 5.5, e.x - snx * 3 - Math.cos(sAng) * 4, e.y - sny * 3 - Math.sin(sAng) * 4, 0.6, 2.6);
  // the stick: tapered box section
  fillO(() => { ctx.moveTo(e.x - snx * 2.8 - Math.cos(sAng) * 4, e.y - sny * 2.8 - Math.sin(sAng) * 4); ctx.lineTo(wrist.x - snx * 1.8, wrist.y - sny * 1.8); ctx.lineTo(wrist.x + snx * 1.8, wrist.y + sny * 1.8); ctx.lineTo(e.x + snx * 2.8, e.y + sny * 2.8); ctx.closePath(); }, YD);
  ctx.strokeStyle = 'rgba(255,230,160,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x - snx * 2.2, e.y - sny * 2.2); ctx.lineTo(wrist.x - snx * 1.4, wrist.y - sny * 1.4); ctx.stroke();
  // bucket cylinder + linkage (dog-bone) to the bucket
  const lk = { x: wrist.x - snx * 3.5 + Math.cos(curl) * 2, y: wrist.y - sny * 3.5 + Math.sin(curl) * 2 };
  cyl(e.x - snx * 2.5 + Math.cos(sAng) * 6, e.y - sny * 2.5 + Math.sin(sAng) * 6, lk.x, lk.y, 0.62, 2.2);
  ctx.strokeStyle = STEEL_D; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lk.x, lk.y); ctx.lineTo(wrist.x + Math.cos(curl) * 3, wrist.y + Math.sin(curl) * 3); ctx.stroke();
  // bucket: shell, wear plate, teeth
  ctx.save(); ctx.translate(wrist.x, wrist.y); ctx.rotate(curl);
  fillO(() => { ctx.moveTo(-2.5, -5.5); ctx.lineTo(12.5, -4.5); ctx.lineTo(13.5, 3.5); ctx.quadraticCurveTo(6, 9, -2.5, 5.5); ctx.closePath(); }, vgrad(-5, 7, '#7a838c', '#454c54'));
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.moveTo(10.5, -3.6); ctx.lineTo(12, 2.6); ctx.quadraticCurveTo(6, 6.5, 0, 4.2); ctx.lineTo(1, 1.5); ctx.closePath(); ctx.fill(); // inside of the bucket
  ctx.fillStyle = CHROME; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(12.6, -3.6 + i * 2.1); ctx.lineTo(15.4, -3 + i * 2.1); ctx.lineTo(12.8, -2.2 + i * 2.1); ctx.closePath(); ctx.fill(); } // teeth
  ctx.restore();
  pin(SHOULDER.x, SHOULDER.y, 2.3); pin(e.x, e.y, 2.1); pin(wrist.x, wrist.y, 1.9); pin(bc.x, bc.y, 1.4); pin(lk.x, lk.y, 1.3);
  ctx.restore();
  ctx.restore();
}

/** Excavator lamp beam (cab work light). */
export function drawExcavatorLight(x: number, dir: number, strength: number) {
  drawLampBeam(x + dir * 6, dir, 1, strength, CFG.excavatorReach - 6);
}

/** Shared tracked undercarriage + timber mat for the heavy machines (logical units, ground y = 0). */
function tracks(w: number, col = '#23262a') {
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(-w / 2 - 3, -2, w + 6, 4);
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-w / 2, -12, w, 10, 5); ctx.fill();
  ctx.fillStyle = '#4a4f55'; const n = Math.round(w / 12); for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(-w / 2 + 8 + i * ((w - 16) / (n - 1)), -7, 3, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let i = -w / 2 + 3; i < w / 2 - 2; i += 4) { ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i + 1.5, -10.5); ctx.stroke(); }
}

/** DIAMOND SAW RIG: blue tracked carrier, a two-part arm and a big circular blade with diamond segments that spins
 *  constantly and drops into the floor at `reach` on each cut (k 0..1), throwing sparks. t = time (s). */
export function drawSaw(x: number, dir: number, k: number, reach: number, bounce: number, t: number) {
  ctx.save(); ctx.translate(x, 0); ctx.scale(dir, 1);
  tracks(60, '#1d2026');
  ctx.save(); ctx.translate(0, -bounce * 1.4);
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(-18, -15, 32, 3);
  ctx.fillStyle = '#1f5c99'; ctx.beginPath(); ctx.roundRect(-30, -32, 14, 18, 3); ctx.fill(); // engine block
  ctx.fillStyle = '#2d7fd0'; ctx.beginPath(); ctx.roundRect(-24, -33, 40, 19, 3); ctx.fill(); // body
  ctx.fillStyle = '#e8eef4'; ctx.fillRect(-24, -24, 40, 2.4); // white stripe
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(-21 + i * 4, -31, 1.4, 6); // louvres
  ctx.fillStyle = '#2d7fd0'; ctx.beginPath(); ctx.roundRect(-8, -50, 18, 19, [4, 4, 0, 0]); ctx.fill(); // cab
  ctx.fillStyle = '#9fd0ea'; ctx.beginPath(); ctx.roundRect(-5, -47, 12, 12, 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,40,40,.55)'; ctx.beginPath(); ctx.arc(1, -41, 2.8, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-26, -36, 3, 3); // beacon
  // arm: shoulder → elbow → blade hub; the hub drops into the cut
  const e = k * k * (3 - 2 * k), hub = { x: reach, y: -24 + 18 * e }, sh = { x: 14, y: -28 };
  const el = { x: (sh.x + hub.x) / 2 + 2, y: Math.min(sh.y, hub.y) - 14 };
  limb(sh.x, sh.y, el.x, el.y, 6, '#2d7fd0'); limb(el.x, el.y, hub.x, hub.y, 5, '#1f5c99');
  limb(4, -22, el.x - 4, el.y + 4, 2, '#9aa3ad'); // hydraulic ram
  ctx.fillStyle = '#3b3f45'; for (const p of [sh, el]) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.283); ctx.fill(); }
  // the blade
  const R = 15, a0 = t * 14;
  ctx.save(); ctx.translate(hub.x, hub.y);
  const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, R); g.addColorStop(0, '#f2f6fa'); g.addColorStop(0.6, '#a9b4bf'); g.addColorStop(1, '#6d7884');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
  ctx.rotate(a0);
  for (let i = 0; i < 14; i++) { ctx.rotate(6.283 / 14); ctx.fillStyle = i % 2 ? '#bff4ff' : '#ffffff'; ctx.fillRect(R - 2.2, -1.6, 3.6, 3.2); } // diamond segments
  ctx.strokeStyle = 'rgba(60,70,80,.6)'; ctx.lineWidth = 0.8; for (let i = 0; i < 6; i++) { ctx.rotate(6.283 / 6); ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(R - 4, 0); ctx.stroke(); } // gullets
  ctx.restore();
  ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(hub.x, hub.y, 3.5, 0, 6.283); ctx.fill(); // hub
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(hub.x, hub.y, 1.5, 0, 6.283); ctx.fill();
  // guard over the top half
  ctx.strokeStyle = '#1f5c99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hub.x, hub.y, R + 3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  if (e > 0.55) { // sparks off the cut
    ctx.strokeStyle = `rgba(255,${200 + Math.floor(Math.random() * 50)},120,${(e - 0.55) * 2})`; ctx.lineWidth = 1;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.55 + Math.random() * 0.4), L = 6 + Math.random() * 12, sx = hub.x - 4, sy = hub.y + R - 2; ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); } ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/** DEEP DRILL RIG: wide orange carrier with a tall lattice mast at `reach`; the auger turns all the time and plunges
 *  into the floor on each bite (k 0..1). t = time (s). */
export function drawDrill(x: number, dir: number, k: number, reach: number, bounce: number, t: number) {
  ctx.save(); ctx.translate(x, 0); ctx.scale(dir, 1);
  tracks(72, '#1d2026');
  ctx.save(); ctx.translate(0, -bounce * 1.2);
  ctx.fillStyle = '#c86f17'; ctx.beginPath(); ctx.roundRect(-36, -34, 18, 22, 3); ctx.fill(); // power pack
  ctx.fillStyle = '#ef8f24'; ctx.beginPath(); ctx.roundRect(-30, -36, 52, 24, 3); ctx.fill(); // house
  ctx.fillStyle = '#1e1e1e'; for (let i = 0; i < 6; i++) ctx.fillRect(-28 + i * 7, -16, 4, 3); // hazard band
  ctx.fillStyle = '#ffcf3a'; for (let i = 0; i < 6; i++) ctx.fillRect(-24.5 + i * 7, -16, 3, 3);
  ctx.fillStyle = '#ef8f24'; ctx.beginPath(); ctx.roundRect(-14, -54, 18, 19, [4, 4, 0, 0]); ctx.fill(); // cab
  ctx.fillStyle = '#9fd0ea'; ctx.beginPath(); ctx.roundRect(-11, -51, 12, 12, 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,40,40,.55)'; ctx.beginPath(); ctx.arc(-5, -45, 2.8, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ff3b2f'; ctx.fillRect(-32, -39, 3, 3);
  // boom from the house to the mast + the lattice mast
  const mx = reach, top = -96;
  limb(16, -30, mx - 4, -40, 6, '#ef8f24'); limb(16, -20, mx - 4, -18, 3, '#9aa3ad');
  ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(mx - 6, -6); ctx.lineTo(mx - 6, top); ctx.moveTo(mx + 6, -6); ctx.lineTo(mx + 6, top); ctx.stroke();
  ctx.strokeStyle = '#c98f12'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let y = -6; y > top + 8; y -= 12) { ctx.moveTo(mx - 6, y); ctx.lineTo(mx + 6, y - 12); ctx.moveTo(mx - 6, y - 12); ctx.lineTo(mx + 6, y - 12); }
  ctx.stroke();
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(mx - 9, top - 4, 18, 6); // crown block
  ctx.fillStyle = '#ff3b2f'; if (Math.floor(t * 1.5) % 2) { ctx.beginPath(); ctx.arc(mx, top - 6, 2, 0, 6.283); ctx.fill(); }
  // rotary head rides the mast; the auger below it plunges into the floor
  const e = k * k * (3 - 2 * k), head = -58 + 26 * e, tip = 6 + 10 * e;
  ctx.fillStyle = '#5f666e'; ctx.beginPath(); ctx.roundRect(mx - 8, head - 8, 16, 12, 3); ctx.fill();
  ctx.fillStyle = '#ef8f24'; ctx.fillRect(mx - 8, head - 8, 16, 3);
  ctx.save(); ctx.beginPath(); ctx.rect(mx - 9, head + 4, 18, tip - head - 4 + 2); ctx.clip();
  ctx.fillStyle = '#8d97a2'; ctx.fillRect(mx - 1.5, head + 4, 3, tip - head);
  ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = 2.2; const ph = (t * 40) % 8; ctx.beginPath(); // helical flights scrolling
  for (let y = head + 4 - ph; y < tip + 8; y += 8) { ctx.moveTo(mx - 6, y); ctx.lineTo(mx + 6, y + 4); }
  ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#c9d2dc'; ctx.beginPath(); ctx.moveTo(mx - 6, tip - 2); ctx.lineTo(mx + 6, tip - 2); ctx.lineTo(mx, tip + 5); ctx.closePath(); ctx.fill(); // bit
  ctx.restore();
  ctx.restore();
}
