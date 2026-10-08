// Surface: headframe, the Recycling Yard production line and the delivery truck (virtual px, scale from the
// surface worker unit u). Visual flow left → right, readable with no UI:
//   cart dumps into HOPPER → CRUSHER drum → inclined AUGER → hydraulic PRESS → BLOCK STACK → TRUCK on the road → $
// Scale rules (worker height u = 1): cart ≈ 1, truck cab ≈ 1.5, truck length ≈ 3.6, plant ≈ 2–3, headframe ≈ 2.5+.
import { CFG } from './config';
import { S } from './state';
import { mixPick, processRate, rawCap, tierOf, truckCapacity } from './economy';
import { rubbleRGB } from './geo';
import { SV, truckPose } from './juice';
import { drawRig, lookFor, RIG_H } from './rig';
import { railX } from './layout';
import { bubble, drawPile, pileHeight, pileLabel } from './draw';
import { nightness } from './landscape';
import { ctx, faceScale, surfaceLayout, toScreen, view, yOf } from './view';
import { hash, rgb } from './util';

const C = CFG.cart, Y = CFG.yard;
const FONT_UI = "'Rubik',system-ui,sans-serif";
const CONTRACTOR = { ...lookFor('contractor', 7), height: 1.04 };
const HAND = lookFor('hand', 11), HAND2 = lookFor('hand', 23);

/** 0..1 progress of one construction step within the yard build. */
const step = (a: number, b: number) => Math.max(0, Math.min(1, (SV.buildT - a) / (b - a)));

/** Deterministic, tasteful truck colour per delivery: golden-angle hue, controlled saturation/lightness. */
export function truckColor(n: number, k = 1) {
  const hue = (n * 137.508) % 360;
  return `hsl(${hue.toFixed(0)},${(42 + (n % 3) * 6)}%,${(44 * k).toFixed(0)}%)`;
}

/** Warm practical lights are queued and drawn after the night grade (so they glow instead of being dimmed). */
const glows: [number, number, number, number][] = [];
function glow(x: number, y: number, r: number, a: number) { if (a > 0.01) glows.push([x, y, r, a]); }
export function flushGlows() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of glows) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,214,140,${a})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }
  ctx.restore();
  glows.length = 0;
}

export function drawSurface(gy: number) {
  if (gy < view.vy0 - 400 || gy > view.vy1 + 400) return;
  const L = surfaceLayout(), u = L.u, s = faceScale(), night = nightness();
  drawHeadframe(gy, s, night);
  drawRoad(L);
  if (S.yard) drawYard(L, night);
  else {
    drawIdleYard(L);
    // before the yard: raw material sits on the ground beside the headframe
    drawPile(L.hopperX, gy - 2, S.raw, rawCap(S) * 0.6, u / 30, 91);
    if (S.raw.qty >= 1 || S.flags.arrived) pileLabel(L.hopperX, gy - 2 - pileHeight(S.raw.qty, rawCap(S) * 0.6, u / 30) - 8, Math.floor(S.raw.qty), Math.round(11 + u * 0.08), false);
  }
  if (SV.contractorGone < 1) drawContractor(L);
  // speech: the contractor before the yard, the yard hand after
  if (SV.speech) {
    const sx = S.yard && SV.contractorGone >= 1 ? L.pressX - u * 0.9 : L.stackX + u * 0.2;
    bubble(sx, gy - u * 1.55, SV.speech.text, '#2a2420', SV.speech.hold);
  }
}

/** Before the Recycling Yard exists: an idle industrial lot — cracked pad, ghostly machine silhouettes, a weathered
 *  RECYCLING sign and a sagging fence. Foreshadowing: "what happens over there?" */
function drawIdleYard(L: ReturnType<typeof surfaceLayout>) {
  const { gy, u } = L;
  ctx.save();
  ctx.fillStyle = 'rgba(139,135,128,.55)'; ctx.fillRect(L.right + 2, gy - 3, L.stackX - L.right + u * 0.9, 5); // old pad
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(L.right + u * (0.3 + i * 0.6), gy - 3, 1.5, 5); // cracks
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#4a4f55'; ctx.strokeStyle = '#4a4f55'; ctx.lineWidth = Math.max(1.5, u * 0.04);
  // silent machinery: hopper, crusher drum, inclined conveyor, press frame
  const hw = u * 0.55, top = gy - u * 1.45, bot = gy - u * 0.68;
  ctx.beginPath(); ctx.moveTo(L.hopperX - hw, top); ctx.lineTo(L.hopperX + hw, top); ctx.lineTo(L.hopperX + hw * 0.32, bot); ctx.lineTo(L.hopperX - hw * 0.32, bot); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(L.hopperX, gy - u * 0.42, u * 0.28, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L.hopperX + u * 0.38, gy - u * 0.3); ctx.lineTo(L.pressX - u * 0.5, gy - u * 1.45); ctx.lineWidth = u * 0.22; ctx.stroke();
  ctx.fillRect(L.pressX - u * 0.5, gy - u * 2.4, u * 0.13, u * 2.4); ctx.fillRect(L.pressX + u * 0.37, gy - u * 2.4, u * 0.13, u * 2.4); ctx.fillRect(L.pressX - u * 0.5, gy - u * 2.4, u, u * 0.18);
  ctx.globalAlpha = 1;
  // weathered sign on a leaning post
  ctx.save(); ctx.translate(L.pressX + u * 0.95, gy); ctx.rotate(0.06);
  ctx.fillStyle = '#5b4632'; ctx.fillRect(-2, -u * 1.25, 4, u * 1.25);
  ctx.fillStyle = 'rgba(164,121,63,.75)'; ctx.fillRect(-u * 0.62, -u * 1.55, u * 1.24, u * 0.34);
  ctx.font = `${Math.round(u * 0.15)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(43,26,12,.7)';
  ctx.fillText('RECYCLING', 0, -u * 1.3);
  ctx.restore();
  // sagging fence along the front of the lot
  ctx.strokeStyle = 'rgba(120,120,115,.6)'; ctx.lineWidth = 1;
  for (let x = L.right + u * 0.9; x < L.stackX + u * 0.8; x += u * 0.55) {
    ctx.fillStyle = 'rgba(90,90,88,.7)'; ctx.fillRect(x, gy - u * 0.42, 2, u * 0.42);
    ctx.beginPath(); ctx.moveTo(x, gy - u * 0.36); ctx.quadraticCurveTo(x + u * 0.27, gy - u * 0.3, x + u * 0.55, gy - u * 0.36); ctx.stroke();
  }
  ctx.restore();
}

function drawHeadframe(gy: number, s: number, night: number) {
  const x = toScreen(railX(), 0).x, topY = yOf(-C.headframeM);
  const w = 20 * s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - w, gy - 2); ctx.lineTo(x - 3 * s, topY); ctx.moveTo(x + w * 0.8, gy - 2); ctx.lineTo(x + 3 * s, topY);
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = Math.max(4.5, 3.8 * s); ctx.stroke(); // thicker legs: dark outline…
  ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = Math.max(3, 2.6 * s); ctx.stroke(); // …then warm timber
  ctx.strokeStyle = '#d99a14'; ctx.lineWidth = Math.max(2, 1.6 * s); // cross braces painted yellow
  for (let i = 1; i <= 3; i++) { // cross braces
    const y = gy + (topY - gy) * (i / 4), k = 1 - i / 4;
    ctx.beginPath(); ctx.moveTo(x - w * k - 3 * s * (1 - k), y); ctx.lineTo(x + w * 0.8 * k + 3 * s * (1 - k), y); ctx.stroke();
  }
  ctx.fillStyle = '#3b3f45'; ctx.beginPath(); ctx.arc(x, topY, 7.5 * s, 0, 6.283); ctx.fill(); // bigger sheave wheel…
  ctx.strokeStyle = '#7d858f'; ctx.lineWidth = Math.max(1, 0.9 * s); ctx.beginPath(); // …with spokes
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.moveTo(x, topY); ctx.lineTo(x + Math.cos(a) * 6.5 * s, topY + Math.sin(a) * 6.5 * s); }
  ctx.stroke();
  ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(x, topY, 2.4 * s, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(x + 7 * s, topY + 10 * s, 2 * s, 0, 6.283); ctx.fill(); // work lamp
  glow(x + 7 * s, topY + 10 * s, 34 * s, 0.3 * night);
}

function drawRoad(L: ReturnType<typeof surfaceLayout>) {
  const u = L.u, x0 = L.pressX - u * 0.9, x1 = Math.max(view.vx1 + 20, L.plotX1 + u * 2), y = L.roadY;
  ctx.fillStyle = '#5d5a55'; ctx.fillRect(x0, y - u * 0.22, x1 - x0, u * 0.44);
  ctx.fillStyle = '#4a4744'; ctx.fillRect(x0, y + u * 0.18, x1 - x0, u * 0.06);
  ctx.fillStyle = 'rgba(240,220,150,.7)';
  for (let x = L.bayX + u * 0.8; x < x1; x += u * 0.7) ctx.fillRect(x, y - 1, u * 0.35, 2);
  // loading bay markings
  ctx.fillStyle = 'rgba(255,207,58,.8)'; ctx.fillRect(L.bayX - u * 0.05, y - u * 0.22, u * 0.08, u * 0.44);
}

const INK_Y = '#1b140e', YEL = '#f0b21c', YEL_D = '#b97f0c', RUSTW = '#c9c2b4', RUSTW_D = '#8d857a';
/** Outlined filled box. */
function obox(x: number, y: number, w: number, h: number, col: string, r = 0) {
  ctx.beginPath(); r ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke();
}
/** A sign board on two short posts: dark plate, bold yellow title, optional level line. */
function signBoard(cx: number, y: number, u: number, title: string, sub = '') {
  const w = u * (title.length * 0.13 + 0.3), h = u * (sub ? 0.46 : 0.32);
  obox(cx - w / 2, y, w, h, '#24272b', 3);
  ctx.strokeStyle = YEL; ctx.lineWidth = 1.2; ctx.strokeRect(cx - w / 2 + 3, y + 3, w - 6, h - 6);
  ctx.font = `${Math.round(u * 0.15)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#f4f1e8';
  ctx.fillText(title, cx, y + u * 0.2);
  if (sub) { ctx.font = `700 ${Math.round(u * 0.11)}px ${FONT_UI}`; ctx.fillStyle = YEL; ctx.fillText(sub, cx, y + u * 0.37); }
}
/** Steel beam between two points (I-beam look: dark edges, lit top). */
function beamTo(x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = INK_Y; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, w * 0.25); ctx.beginPath(); ctx.moveTo(x0, y0 - w * 0.25); ctx.lineTo(x1, y1 - w * 0.25); ctx.stroke();
}
/** Conveyor belt from (x0,y0) to (x1,y1): frame, rollers, a moving belt and the material riding it. */
function conveyor(x0: number, y0: number, x1: number, y1: number, u: number, k: number, running: boolean, src: typeof S.raw) {
  const len = Math.hypot(x1 - x0, y1 - y0) * k, ang = Math.atan2(y1 - y0, x1 - x0), th = u * 0.17;
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(ang);
  obox(0, -th / 2, len, th, '#2e3237', th / 2); // belt
  ctx.fillStyle = '#4a4f55'; ctx.fillRect(th / 2, -th * 0.08, len - th, th * 0.16); // belt surface
  const pitch = u * 0.26, ph = running ? (SV.spin * u * 0.2) % pitch : 0;
  for (let x = th / 2; x < len - th / 2; x += pitch) { ctx.beginPath(); ctx.arc(x, th * 0.62, u * 0.07, 0, 6.283); ctx.fillStyle = YEL; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.fillStyle = '#1e2124'; for (let x = ph; x < len; x += pitch * 0.5) ctx.fillRect(x, -th * 0.5, 1.2, th * 0.2); // cleats moving
  if (running && src.qty > 0.01) for (let x = ph; x < len - u * 0.1; x += u * 0.2) { // rocks riding the belt
    const i = Math.floor((x - ph) / (u * 0.2));
    ctx.fillStyle = rgb(rubbleRGB(mixPick(src, hash(i * 1.9))), 0.9 + hash(i) * 0.25);
    ctx.beginPath(); ctx.ellipse(x, -th * 0.62, u * (0.055 + hash(i * 3.1) * 0.03), u * 0.045, hash(i) * 3, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
/** Chunky rock heap (hopper top / gravel piles): shaded pebbles coloured by the material. */
function heap(cx: number, base: number, w: number, h: number, u: number, src: typeof S.raw, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const k = hash(seed + i * 3.7), lift = hash(seed + i * 1.3);
    const px = cx - w / 2 + w * k, py = base - h * Math.sin(Math.PI * k) * (0.25 + 0.75 * lift);
    const r = u * (0.05 + hash(seed + i * 5.1) * 0.05), c = rubbleRGB(mixPick(src, hash(seed + i * 2.2)));
    ctx.fillStyle = rgb(c, 0.62); ctx.beginPath(); ctx.ellipse(px + r * 0.15, py + r * 0.2, r * 1.15, r * 0.85, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = rgb(c, 1); ctx.beginPath(); ctx.ellipse(px, py, r * 1.1, r * 0.8, hash(i) * 2, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,215,.35)'; ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.3, r * 0.45, r * 0.25, -0.5, 0, 6.283); ctx.fill();
  }
}
// ---------- upgrade-driven machinery: every Recycling upgrade visibly adds or grows something ----------
/** Behind the line: raw-storage silos (count + height follow Raw Storage), a dust-collector cyclone (Processing 5+). */
function yardBack(L: ReturnType<typeof surfaceLayout>, crX: number, running: boolean, night: number) {
  const { gy, u } = L, lv = S.upg.rawStorage, n = Math.min(3, 1 + Math.floor(lv / 5)), fill = Math.min(1, S.raw.qty / rawCap(S));
  { // yard dressing behind the bay (silos grow in front of it): site office, fuel tank, spare pallets
    const ox = L.bayX + u * 4.1, oy = gy - u * 0.15;
    obox(ox, oy - u * 1.05, u * 1.7, u * 1.05, '#e9e4d8', 3); // portable office
    ctx.fillStyle = '#2d7fd0'; ctx.fillRect(ox, oy - u * 0.32, u * 1.7, u * 0.08);
    obox(ox - u * 0.05, oy - u * 1.12, u * 1.8, u * 0.1, '#5d646d');
    const lit = night > 0.25;
    for (const wx of [ox + u * 0.15, ox + u * 0.95]) { obox(wx, oy - u * 0.85, u * 0.55, u * 0.35, lit ? '#ffd98a' : '#9fc4d8'); if (lit) glow(wx + u * 0.27, oy - u * 0.68, u * 0.6, 0.35); }
    obox(ox + u * 0.72, oy - u * 0.62, u * 0.22, u * 0.62, '#7a8592'); // door
    ctx.font = `${Math.round(u * 0.11)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#1f2a33'; ctx.fillText('YARD OFFICE', ox + u * 0.85, oy - u * 0.4);
    for (const bx of [ox + u * 0.1, ox + u * 1.5]) obox(bx, oy, u * 0.1, u * 0.15, '#3a3f45'); // blocks it stands on
    const tx = L.bayX + u * 2.7; // fuel tank on a frame
    beamTo(tx - u * 0.3, gy, tx - u * 0.3, gy - u * 0.4, u * 0.06, '#3a3f45'); beamTo(tx + u * 0.3, gy, tx + u * 0.3, gy - u * 0.4, u * 0.06, '#3a3f45');
    obox(tx - u * 0.48, gy - u * 0.85, u * 0.96, u * 0.48, '#c0392b', u * 0.24); ctx.font = `${Math.round(u * 0.1)}px 'Bungee',Impact,sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText('DIESEL', tx, gy - u * 0.56);
    for (let i = 0; i < 4; i++) obox(L.bayX + u * (3.25 + (i % 2) * 0.42), gy - u * (0.09 + Math.floor(i / 2) * 0.09), u * 0.4, u * 0.08, '#9a7448'); // empty pallets
  }
  for (let i = n - 1; i >= 0; i--) {
    const h = u * (2 + Math.min(15, lv) * 0.12 - i * 0.25), r = u * 0.55, cx = L.bayX + u * (1.2 + i * 1.25), base = gy - u * 0.9, top = base - h;
    for (const lx of [cx - r * 0.8, cx + r * 0.8]) beamTo(lx, gy, lx, base, u * 0.08, '#4a5058'); // legs
    beamTo(cx - r * 0.8, gy - u * 0.1, cx + r * 0.8, base + u * 0.2, u * 0.04, '#4a5058');
    ctx.beginPath(); ctx.moveTo(cx - r, base); ctx.lineTo(cx - r * 0.18, base + u * 0.55); ctx.lineTo(cx + r * 0.18, base + u * 0.55); ctx.lineTo(cx + r, base); ctx.closePath();
    ctx.fillStyle = '#8f949b'; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke(); // cone
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, '#cfd3d8'); g.addColorStop(0.35, '#eef0f2'); g.addColorStop(1, '#8d939b');
    ctx.beginPath(); ctx.rect(cx - r, top, r * 2, h); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, top, r, r * 0.22, 0, Math.PI, 0); ctx.fillStyle = '#b5bac1'; ctx.fill(); ctx.stroke(); // dome
    ctx.strokeStyle = 'rgba(60,66,74,.35)'; ctx.lineWidth = 1; for (let y = top + u * 0.3; y < base; y += u * 0.3) { ctx.beginPath(); ctx.moveTo(cx - r, y); ctx.lineTo(cx + r, y); ctx.stroke(); } // ring seams
    // level gauge: the raw stock (shared across silos), red when full
    const gx = cx - r * 0.55, gh = h * 0.7, gy0 = top + h * 0.15;
    obox(gx - u * 0.05, gy0, u * 0.1, gh, '#2a2d31');
    ctx.fillStyle = fill > 0.97 ? '#ff5a3a' : '#ffcf3a'; ctx.fillRect(gx - u * 0.03, gy0 + gh * (1 - fill), u * 0.06, gh * fill);
    ctx.strokeStyle = '#3a3f45'; ctx.lineWidth = Math.max(1, u * 0.025); ctx.beginPath(); // ladder
    ctx.moveTo(cx + r * 0.5, base); ctx.lineTo(cx + r * 0.5, top); ctx.moveTo(cx + r * 0.75, base); ctx.lineTo(cx + r * 0.75, top);
    for (let y = base; y > top; y -= u * 0.14) { ctx.moveTo(cx + r * 0.5, y); ctx.lineTo(cx + r * 0.75, y); } ctx.stroke();
    ctx.font = `${Math.round(u * 0.18)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#3a3f45'; ctx.fillText('RAW', cx + r * 0.05, top + h * 0.3);
    if (i === 0) { ctx.fillStyle = '#ff3b2f'; if (Math.floor(view.t * 1.1) % 2) { ctx.beginPath(); ctx.arc(cx, top - r * 0.25, u * 0.04, 0, 6.283); ctx.fill(); glow(cx, top - r * 0.25, u * 0.3, 0.3); } }
  }
  // feed duct from the hopper tower top across to the silos
  const dY = gy - u * 3.3 - Math.min(10, lv) * u * 0.05;
  beamTo(L.hopperX + u * 0.95, gy - u * 2.75, L.bayX + u * 1.2, dY, u * 0.14, '#7d838b');
  if (S.upg.processSpeed >= 9) { // dust-collector cyclone behind the crusher, ducted to its top
    const cx = crX + u * 0.15, top = gy - u * 3.2;
    beamTo(crX - u * 0.2, gy - u * 1.3, cx - u * 0.1, top + u * 0.3, u * 0.1, '#8a9098');
    obox(cx - u * 0.32, top, u * 0.64, u * 0.7, '#9aa0a8', 3);
    ctx.beginPath(); ctx.moveTo(cx - u * 0.32, top + u * 0.7); ctx.lineTo(cx - u * 0.06, top + u * 1.5); ctx.lineTo(cx + u * 0.06, top + u * 1.5); ctx.lineTo(cx + u * 0.32, top + u * 0.7); ctx.closePath();
    ctx.fillStyle = '#80868e'; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke();
    if (running) smoke(cx, top - u * 0.05, u * 0.5, 0.4, night);
  }
}

/** In front: crusher motors (one per 2 Processing levels), the QC beacon on the press (Quality 1+), an overhead
 *  gantry crane moving blocks onto the pallets (Quality 3+), premium trim (Quality 6+), a forklift (Processing 4+). */
function yardFront(L: ReturnType<typeof surfaceLayout>, crX: number, running: boolean, night: number) {
  const { gy, u } = L, ps = S.upg.processSpeed, q = S.upg.contractValue;
  const cw = u * 1.2, cy = gy - u * 0.2 - u * 1.05;
  const motors = Math.min(4, 1 + Math.floor(ps / 4));
  for (let i = 0; i < motors; i++) { // electric motors on the crusher's top, fans spinning while it runs
    const mx = crX - cw * 0.42 + i * u * 0.28, my = cy - u * 0.2;
    obox(mx, my, u * 0.24, u * 0.2, '#3f7d4a', 3);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 3; k++) ctx.fillRect(mx + u * 0.03, my + u * (0.04 + k * 0.05), u * 0.18, 1.2);
    ctx.save(); ctx.translate(mx + u * 0.12, my - u * 0.02); ctx.scale(1, 0.35); ctx.rotate(running ? view.t * 18 + i : i);
    ctx.fillStyle = '#c9cdd4'; for (let k = 0; k < 3; k++) { ctx.rotate(2.094); ctx.fillRect(-u * 0.015, 0, u * 0.03, u * 0.1); } ctx.restore();
  }
  // press crown beacon + premium trim
  const px = L.pressX, top = gy - u * 3.1, w = u * 1.22;
  if (q >= 1) {
    const hot = Math.max(0, 1 - SV.pressT / 0.6);
    obox(px + w * 0.32, top - u * 0.3, u * 0.14, u * 0.18, '#2a2d31', 2);
    ctx.fillStyle = hot > 0.05 ? '#5dff7a' : '#2f6a3a'; ctx.beginPath(); ctx.arc(px + w * 0.32 + u * 0.07, top - u * 0.34, u * 0.07, Math.PI, 0); ctx.fill();
    if (hot > 0.05) glow(px + w * 0.32 + u * 0.07, top - u * 0.36, u * 0.6, 0.45 * hot);
  }
  if (q >= 8) { ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = Math.max(1.5, u * 0.04); ctx.strokeRect(px - w / 2 + 2, top - u * 0.1, w - 4, u * 0.3); }
  if (q >= 4) { // overhead gantry crane over the pallets: the hook carries each fresh block to its stack
    const gx0 = L.stackX - u * 1.55, gx1 = L.stackX + u * 1.55, gyb = gy - u * 2.1;
    for (const x of [gx0, gx1]) beamTo(x, gy, x, gyb, u * 0.09, YEL);
    beamTo(gx0 - u * 0.1, gyb, gx1 + u * 0.1, gyb, u * 0.14, YEL);
    ctx.fillStyle = '#1e1e1e'; for (let x = gx0; x < gx1; x += u * 0.24) ctx.fillRect(x, gyb - u * 0.06, u * 0.1, u * 0.12);
    const k = (view.t * 0.35) % 1, e = (a: number) => a * a * (3 - 2 * a);
    const tx = k < 0.5 ? gx0 + u * 0.3 + (gx1 - gx0 - u * 0.6) * e(k * 2) : gx1 - u * 0.3 - (gx1 - gx0 - u * 0.6) * e((k - 0.5) * 2);
    const drop = u * (0.6 + 0.35 * Math.abs(Math.sin(k * Math.PI * 2)));
    obox(tx - u * 0.14, gyb + u * 0.05, u * 0.28, u * 0.14, '#3a3f45', 2);
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tx, gyb + u * 0.19); ctx.lineTo(tx, gyb + drop); ctx.stroke();
    if (k < 0.5) block(tx, gyb + drop + u * 0.2, u, blockRGB(S.goods.qty > 0 ? S.goods : S.raw));
  }
  if (ps >= 6) { // forklift shuttling between the press and the truck bay
    const k = (Math.sin(view.t * 0.5) + 1) / 2, fx = L.stackX - u * 0.4 + (L.bayX - L.stackX + u * 0.2) * k, dir = Math.cos(view.t * 0.5) > 0 ? 1 : -1, fy = L.roadY - u * 0.02;
    ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1);
    obox(-u * 0.32, -u * 0.38, u * 0.55, u * 0.3, YEL, 3); // body
    obox(-u * 0.22, -u * 0.72, u * 0.28, u * 0.34, 'rgba(160,200,230,.35)', 2); // cage
    obox(-u * 0.42, -u * 0.36, u * 0.12, u * 0.22, '#3a3f45'); // counterweight
    beamTo(u * 0.26, 0, u * 0.26, -u * 0.8, u * 0.05, '#3a3f45'); // mast
    beamTo(u * 0.26, -u * 0.08, u * 0.52, -u * 0.08, u * 0.04, '#2b2e32'); // forks
    if (dir > 0) block(u * 0.4, -u * 0.12, u, blockRGB(S.goods.qty > 0 ? S.goods : S.raw));
    for (const wx of [-u * 0.2, u * 0.14]) { ctx.beginPath(); ctx.arc(wx, -u * 0.06, u * 0.08, 0, 6.283); ctx.fillStyle = '#1e1e1e'; ctx.fill(); }
    if (night > 0.2) glow(u * 0.3, -u * 0.5, u * 0.5, 0.3);
    ctx.restore();
  }
}

/** Smoke plume: puffs rise, drift downwind, grow and fade (procedural from time; no particles). */
function smoke(x: number, y: number, u: number, amt: number, night: number) {
  const N = 9;
  for (let i = 0; i < N; i++) {
    const k = (view.t * 0.22 + i / N) % 1, r = u * (0.16 + k * 0.75), a = (1 - k) * 0.5 * amt;
    const sx = x + k * k * u * 3.2 + Math.sin(view.t * 0.8 + i) * u * 0.08, sy = y - k * u * 2.4;
    const c = night > 0.4 ? 90 : 205 - k * 25;
    ctx.fillStyle = `rgba(${c | 0},${c | 0},${(c + 6) | 0},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill();
  }
}

function lampPost(x: number, gy: number, h: number, u: number, night: number) {
  beamTo(x, gy, x, gy - h, u * 0.06, '#3a3f45');
  beamTo(x, gy - h, x + u * 0.22, gy - h, u * 0.04, '#3a3f45');
  obox(x + u * 0.15, gy - h, u * 0.16, u * 0.1, '#2b2e32', 2);
  ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x + u * 0.17, gy - h + u * 0.09, u * 0.12, u * 0.04);
  glow(x + u * 0.23, gy - h + u * 0.12, u * 0.9, 0.12 + 0.3 * night);
  if (night > 0.2) { // after dusk: a soft cone down to a warm pool on the concrete
    const a = Math.min(1, (night - 0.2) * 2), lx = x + u * 0.23, ly = gy - h + u * 0.14;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(lx, ly, lx, gy); g.addColorStop(0, `rgba(255,214,140,${(0.22 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - u * 0.08, ly); ctx.lineTo(lx + u * 0.08, ly); ctx.lineTo(lx + u * 0.95, gy); ctx.lineTo(lx - u * 0.95, gy); ctx.closePath(); ctx.fill();
    const pg = ctx.createRadialGradient(lx, gy, 0, lx, gy, u * 1.1); pg.addColorStop(0, `rgba(255,200,120,${(0.3 * a).toFixed(3)})`); pg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(lx, gy, u * 1.1, u * 0.22, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}
function hazardBarrier(x: number, gy: number, u: number) {
  obox(x, gy - u * 0.28, u * 0.42, u * 0.28, '#f0b21c', 2);
  ctx.save(); ctx.beginPath(); ctx.rect(x, gy - u * 0.28, u * 0.42, u * 0.28); ctx.clip();
  ctx.fillStyle = '#1e1e1e'; for (let i = -1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + i * u * 0.12, gy); ctx.lineTo(x + i * u * 0.12 + u * 0.06, gy); ctx.lineTo(x + i * u * 0.12 + u * 0.16, gy - u * 0.28); ctx.lineTo(x + i * u * 0.12 + u * 0.1, gy - u * 0.28); ctx.fill(); }
  ctx.restore();
}

/** The Recycling Yard production line (Yard reference): RECYCLING hopper on a steel frame → belt → CRUSHER →
 *  inclined belt → hydraulic PRESS → pallet stacks → truck bay. Every moving part is driven by the real state:
 *  the hopper heap = raw stock, belts/crusher run only while there is raw material, the press stamps on each THUMP
 *  (SV.pressT), pallets = finished blocks. Gameplay positions (dump point, press, stack, bay) are unchanged. */
function drawYard(L: ReturnType<typeof surfaceLayout>, night: number) {
  const { gy, u } = L;
  const pt = tierOf(S.upg.processSpeed, Y.processTiers), st = tierOf(S.upg.rawStorage, Y.storageTiers), vt = tierOf(S.upg.contractValue, Y.valueTiers);
  const s1 = step(0, 0.25), s2 = step(0.2, 0.45), s3 = step(0.4, 0.7), s4 = step(0.65, 0.9), s5 = step(0.88, 1);
  const running = S.raw.qty > 0.01 && SV.buildT >= 1;
  const crX = L.hopperX + u * 1.55, x1 = L.bayX + u * 0.6;

  // ---- background: timber shed / gantry behind the line (muted, it frames the machines) ----
  if (s1 > 0) {
    ctx.globalAlpha = s1;
    const bx0 = L.right + u * 0.1, top = gy - u * 3.4;
    ctx.fillStyle = '#3b2e24'; ctx.fillRect(bx0, top + u * 0.3, x1 - bx0, gy - top - u * 0.3); // back wall
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let x = bx0; x < x1; x += u * 0.18) ctx.fillRect(x, top + u * 0.3, 1.2, gy - top); // planks
    for (let x = bx0; x <= x1 + 1; x += u * 0.95) beamTo(x, gy, x, top + u * 0.2, u * 0.09, '#5a4330'); // posts
    beamTo(bx0 - u * 0.1, top + u * 0.25, x1 + u * 0.1, top + u * 0.25, u * 0.1, '#5a4330'); // ring beam
    ctx.beginPath(); ctx.moveTo(bx0 - u * 0.25, top + u * 0.22); ctx.lineTo(x1 + u * 0.25, top + u * 0.22); ctx.lineTo(x1, top - u * 0.18); ctx.lineTo(bx0, top - u * 0.18); ctx.closePath();
    ctx.fillStyle = '#4a3a2c'; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke(); // roof
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx0, top - u * 0.18, x1 - bx0, u * 0.06);
    // stacked spare blocks against the back wall (set dressing)
    for (let i = 0; i < 6; i++) block(L.pressX + u * 0.4 + (i % 3) * u * 0.36, gy - u * 0.04 - Math.floor(i / 3) * u * 0.2, u, [118, 112, 104], hash(i));
    // tall steel tower behind the hopper: legs, cross bracing, two platforms with railings, zig-zag stairs, an
    // operator cabin with a lit window on top, lamps — the yard reads as heavy industry from far away
    const tx0 = L.hopperX - u * 0.35, tx1 = L.hopperX + u * 0.95, tTop = gy - u * 3.7;
    for (const x of [tx0, tx1]) beamTo(x, gy, x, tTop, u * 0.1, '#3a3f45');
    for (let i = 0; i < 4; i++) { const ya = gy - i * u * 0.9, yb = ya - u * 0.9; beamTo(tx0, ya, tx1, yb, u * 0.04, '#4a5058'); beamTo(tx1, ya, tx0, yb, u * 0.04, '#4a5058'); }
    for (const py of [gy - u * 1.85, gy - u * 2.75]) {
      obox(tx0 - u * 0.15, py, tx1 - tx0 + u * 0.3, u * 0.07, '#5a6068');
      ctx.strokeStyle = YEL; ctx.lineWidth = Math.max(1.2, u * 0.025); ctx.beginPath(); ctx.moveTo(tx0 - u * 0.15, py - u * 0.3); ctx.lineTo(tx1 + u * 0.15, py - u * 0.3);
      for (let x = tx0 - u * 0.15; x <= tx1 + u * 0.16; x += u * 0.35) { ctx.moveTo(x, py); ctx.lineTo(x, py - u * 0.3); } ctx.stroke();
    }
    ctx.strokeStyle = '#2e3237'; ctx.lineWidth = Math.max(1.2, u * 0.03); ctx.beginPath(); // zig-zag stairs
    ctx.moveTo(tx1 + u * 0.1, gy); ctx.lineTo(tx0 + u * 0.1, gy - u * 1.85); ctx.lineTo(tx1 - u * 0.1, gy - u * 2.75); ctx.stroke();
    obox(tx0 + u * 0.05, tTop - u * 0.75, tx1 - tx0 - u * 0.1, u * 0.75, '#5d4a38', 2); // cabin
    obox(tx0 - u * 0.05, tTop - u * 0.85, tx1 - tx0 + u * 0.1, u * 0.12, '#3b2e24');
    ctx.fillStyle = night > 0.2 ? '#ffd890' : '#9fc4d8'; ctx.fillRect(tx0 + u * 0.2, tTop - u * 0.58, (tx1 - tx0) * 0.55, u * 0.3);
    glow(tx0 + (tx1 - tx0) * 0.45, tTop - u * 0.45, u * 0.7, 0.1 + 0.3 * night);
    for (const [lx, ly] of [[tx0 - u * 0.1, gy - u * 2.2], [tx1 + u * 0.1, gy - u * 3.1]] as const) { ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(lx, ly, u * 0.05, 0, 6.283); ctx.fill(); glow(lx, ly, u * 0.6, 0.12 + 0.3 * night); }
    // smokestack through the shed roof: brick, white bands, an aircraft light; the plume thickens while the line runs
    const chX = L.pressX + u * 1.25, chTop = gy - u * 5.2, chW = u * 0.42;
    ctx.beginPath(); ctx.moveTo(chX - chW / 2, top); ctx.lineTo(chX - chW * 0.38, chTop); ctx.lineTo(chX + chW * 0.38, chTop); ctx.lineTo(chX + chW / 2, top); ctx.closePath();
    ctx.fillStyle = '#8d4b3a'; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(chX + chW * 0.08, chTop, chW * 0.32, top - chTop);
    for (const k of [0.12, 0.3]) { ctx.fillStyle = '#ece6da'; ctx.fillRect(chX - chW * 0.42, chTop + (top - chTop) * k, chW * 0.84, u * 0.1); }
    obox(chX - chW * 0.48, chTop - u * 0.1, chW * 0.96, u * 0.12, '#5e3328');
    if (Math.floor(view.t * 1.2) % 2 === 0) { ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(chX, chTop - u * 0.14, u * 0.04, 0, 6.283); ctx.fill(); glow(chX, chTop - u * 0.14, u * 0.35, 0.35); }
    smoke(chX, chTop - u * 0.1, u, running ? 1 : 0.35, night);
    obox(L.right + 2, gy - u * 0.05, (x1 - L.right) * s1, u * 0.09, '#8d8880');
    ctx.globalAlpha = 1;
  }

  if (s1 >= 1) yardBack(L, crX, running, night);

  // ---- HOPPER on a yellow steel frame, RECYCLING sign above; heap = raw stock ----
  if (s2 > 0) {
    ctx.globalAlpha = s2;
    const hw = u * (st >= 1 ? 0.86 : 0.76), top = L.hopperTop, bot = Math.max(top + u * 0.5, gy - u * 0.42), hx = L.hopperX; // mouth at the cart's dump height
    for (const lx of [hx - hw * 0.55, hx + hw * 0.55]) beamTo(lx, gy, lx, bot - u * 0.1, u * 0.1, YEL); // legs
    beamTo(hx - hw * 0.55, gy - u * 0.4, hx + hw * 0.55, bot + u * 0.05, u * 0.06, YEL_D); // cross brace
    beamTo(hx - hw * 0.6, bot + u * 0.02, hx + hw * 0.6, bot + u * 0.02, u * 0.08, YEL);
    ctx.beginPath(); ctx.moveTo(hx - hw, top); ctx.lineTo(hx + hw, top); ctx.lineTo(hx + hw * 0.34, bot); ctx.lineTo(hx - hw * 0.34, bot); ctx.closePath();
    ctx.fillStyle = RUSTW; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(hx - hw, top, hw * 0.55, bot - top); // shadow side
    ctx.fillStyle = 'rgba(120,70,30,.28)'; for (let i = 0; i < 7; i++) ctx.fillRect(hx - hw + hash(i * 3.3) * hw * 2, top + hash(i * 5.1) * (bot - top), u * 0.04, u * (0.1 + hash(i) * 0.25)); // rust streaks
    ctx.strokeStyle = RUSTW_D; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { const yy = top + (bot - top) * i / 4; ctx.beginPath(); ctx.moveTo(hx - hw, yy); ctx.lineTo(hx + hw, yy); ctx.stroke(); }
    ctx.fillStyle = '#5a554d'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(hx - hw * 0.8 + i * hw * 0.2, top + u * 0.07, 1.1, 0, 6.283); ctx.fill(); } // rivets
    ctx.restore();
    obox(hx - hw - 2, top - 3, hw * 2 + 4, 5, RUSTW_D); // rim
    const fill = Math.min(1, S.raw.qty / rawCap(S));
    if (S.raw.qty > 0.5) heap(hx, top + 2, hw * 1.85, u * (0.15 + 0.55 * fill), u, S.raw, Math.round(8 + fill * 34), 5);
    // RECYCLING sign on its frame above the hopper
    const sy = top - u * 1.05 - u * 0.55 * fill;
    beamTo(hx - hw * 0.7, top - 2, hx - hw * 0.7, sy + u * 0.3, u * 0.05, '#3a3f45'); beamTo(hx + hw * 0.7, top - 2, hx + hw * 0.7, sy + u * 0.3, u * 0.05, '#3a3f45');
    signBoard(hx, sy, u, vt >= 1 ? 'RECYCLING ♻' : 'RECYCLING');
    // stock readout (functional): count + capacity, red when full
    const full = S.raw.qty >= rawCap(S) - 0.5;
    pileLabel(hx, sy - u * 0.12, Math.floor(S.raw.qty), Math.round(12 + u * 0.08), full);
    ctx.font = `600 ${Math.round(9 + u * 0.05)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = full ? '#ffb38a' : 'rgba(255,255,255,.85)';
    ctx.fillText(full ? `RAW FULL (${rawCap(S)})` : `raw / ${rawCap(S)}`, hx, sy + u * 0.62);
    if (st >= 2) { obox(hx - hw - u * 0.6, gy - u * 0.5, u * 0.5, u * 0.5, '#7d786f'); heap(hx - hw - u * 0.35, gy - u * 0.5, u * 0.45, u * 0.12, u, S.raw, 6, 9); } // overflow bunker
    ctx.globalAlpha = 1;
  }

  // ---- CRUSHER: fed by a belt from the hopper; flywheel, shake, gravel + dust when running ----
  if (s3 > 0) {
    ctx.globalAlpha = s3;
    const sh = running ? Math.sin(view.t * 60) * u * 0.008 : 0, cw = u * (pt >= 1 ? 1.2 : 1.06), ch = u * 1.05, cy = gy - u * 0.2 - ch;
    conveyor(L.hopperX + u * 0.25, gy - u * 0.32, crX - cw * 0.35, cy + u * 0.04, u, s3, running, S.raw); // inclined belt from the hopper outlet up into the crusher
    ctx.save(); ctx.translate(sh, 0);
    for (const lx of [crX - cw * 0.4, crX + cw * 0.4]) beamTo(lx, gy, lx, cy + ch, u * 0.09, '#3a3f45'); // legs
    obox(crX - cw / 2, cy, cw, ch, '#3d4248', 3); // housing
    obox(crX - cw / 2, cy, cw, ch * 0.32, YEL, 3); // yellow top
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 4; i++) ctx.fillRect(crX - cw * 0.35, cy + ch * (0.48 + i * 0.1), cw * 0.42, ch * 0.04); // vents
    // flywheel (spins while running), bigger on the upgraded crusher
    const fx = crX + cw * 0.28, fy = cy + ch * 0.62, fr = u * (pt >= 1 ? 0.2 : 0.16);
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 6.283); ctx.fillStyle = YEL; ctx.fill(); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(SV.spin * 2); ctx.strokeStyle = INK_Y; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fr * 0.85, 0); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    signBoard(crX, cy - u * 0.56, u, 'CRUSHER', `Lv ${S.upg.processSpeed + 1}`);
    // crushed gravel falling out of the bottom + a small pile, dust and a warm work-glow while running
    const outX = crX - cw * 0.05, outY = cy + ch;
    if (running) {
      for (let i = 0; i < 6; i++) { const k = (view.t * 1.8 + i / 6) % 1; ctx.fillStyle = rgb(rubbleRGB(mixPick(S.raw, hash(i * 4.1))), 0.95); ctx.fillRect(outX + (hash(i) - 0.5) * u * 0.18, outY + k * (gy - outY - u * 0.05), u * 0.045, u * 0.045); }
      for (let i = 0; i < 3; i++) { const k = (view.t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(210,190,160,${(0.25 * (1 - k)).toFixed(3)})`; ctx.beginPath(); ctx.arc(crX + (i - 1) * u * 0.25, cy - k * u * 0.5, u * (0.12 + k * 0.2), 0, 6.283); ctx.fill(); }
      glow(outX, gy - u * 0.2, u * 0.7, 0.22);
    }
    heap(outX, gy - u * 0.05, u * 0.42, u * 0.12, u, S.raw.qty > 0.01 ? S.raw : S.goods, 9, 21);
    // control panel up on the tower platform, overlooking the hopper (its lights blink while the line runs)
    const pX = L.hopperX + u * 0.72, pY = gy - u * 2.75;
    obox(pX - u * 0.12, pY - u * 0.5, u * 0.26, u * 0.5, '#3a3f45', 2);
    ctx.fillStyle = '#20252b'; ctx.fillRect(pX - u * 0.09, pY - u * 0.46, u * 0.2, u * 0.14);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#4be36a', '#ffd23a', '#ff5a3a'][i]; ctx.globalAlpha = s3 * (running && Math.sin(view.t * (3 + i) + i) > -0.3 ? 1 : 0.35); ctx.fillRect(pX - u * 0.07 + i * u * 0.065, pY - u * 0.28, u * 0.04, u * 0.04); }
    ctx.globalAlpha = 1;
  }

  // ---- inclined belt up to the PRESS; the press frame, ram, glowing mould ----
  if (s4 > 0) {
    ctx.globalAlpha = s4;
    const px = L.pressX, w = u * (pt >= 2 ? 1.22 : 1.08), top = gy - u * 3.1, base = gy - u * 0.35;
    conveyor(crX + u * 0.35, gy - u * 0.62, px - w * 0.42, gy - u * 1.75, u, s4, running, S.raw);
    // columns + crown + hazard-striped base
    obox(px - w / 2, top, u * 0.2, gy - top, YEL); obox(px + w / 2 - u * 0.2, top, u * 0.2, gy - top, YEL);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px - w / 2 + u * 0.13, top, u * 0.07, gy - top); ctx.fillRect(px + w / 2 - u * 0.07, top, u * 0.07, gy - top);
    obox(px - w / 2 - u * 0.06, top - u * 0.12, w + u * 0.12, u * 0.34, YEL, 2);
    obox(px - w / 2, base - u * 0.02, w, u * 0.4, '#3a3f45');
    ctx.save(); ctx.beginPath(); ctx.rect(px - w / 2, base + u * 0.18, w, u * 0.2); ctx.clip();
    ctx.fillStyle = YEL; ctx.fillRect(px - w / 2, base + u * 0.18, w, u * 0.2);
    ctx.fillStyle = '#1e1e1e'; for (let i = -2; i < 10; i++) { ctx.beginPath(); ctx.moveTo(px - w / 2 + i * u * 0.14, base + u * 0.38); ctx.lineTo(px - w / 2 + i * u * 0.14 + u * 0.07, base + u * 0.38); ctx.lineTo(px - w / 2 + i * u * 0.14 + u * 0.17, base + u * 0.18); ctx.lineTo(px - w / 2 + i * u * 0.14 + u * 0.1, base + u * 0.18); ctx.fill(); }
    ctx.restore();
    // hydraulic cylinder + ram (anticipation drop, THUMP, rise)
    const period = Y.pressBatch / Math.max(0.1, processRate(S));
    let f = SV.pressT < 0.06 ? 1 : Math.max(0, 1 - (SV.pressT - 0.06) / 0.35);
    if (running && SV.pressT > period - 0.2) f = Math.max(f, Math.min(1, (SV.pressT - (period - 0.2)) / 0.2));
    const cylTop = top + u * 0.22, ramBot = base - u * 0.32, ry = cylTop + u * 0.5 + (ramBot - cylTop - u * 0.8) * f;
    obox(px - u * 0.16, cylTop, u * 0.32, u * 0.55, '#2e3237', 3);
    ctx.fillStyle = '#c8d0d8'; ctx.fillRect(px - u * 0.07, cylTop + u * 0.55, u * 0.14, ry - cylTop - u * 0.55); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(px - u * 0.05, cylTop + u * 0.55, u * 0.03, ry - cylTop - u * 0.55);
    obox(px - w * 0.38, ry, w * 0.76, u * 0.28, '#4a4f55', 2); // ram head
    // mould: glows orange-hot for a moment after each stamp
    const hot = Math.max(0, 1 - SV.pressT / 0.5);
    obox(px - w * 0.4, base - u * 0.16, w * 0.8, u * 0.16, '#2a2d31');
    if (hot > 0.01) { ctx.fillStyle = `rgba(255,150,40,${(0.85 * hot).toFixed(3)})`; ctx.fillRect(px - w * 0.36, base - u * 0.14, w * 0.72, u * 0.08); glow(px, base - u * 0.1, u * 0.8, 0.45 * hot); }
    if (hot > 0.01) { // stamp: a burst of steam out of both sides of the mould and a fan of sparks
      const k = 1 - hot;
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, r = u * (0.12 + k * 0.32) * (0.7 + hash(i) * 0.5);
        ctx.fillStyle = `rgba(235,235,232,${(0.55 * hot).toFixed(3)})`; ctx.beginPath();
        ctx.arc(px + side * (w * 0.42 + k * u * (0.5 + hash(i + 7) * 0.5)), base - u * 0.12 - k * u * (0.3 + hash(i + 3) * 0.6), r, 0, 6.283); ctx.fill();
      }
      if (hot > 0.45) { ctx.strokeStyle = `rgba(255,${190 + (hash(SV.pressT) * 50) | 0},90,${hot.toFixed(3)})`; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.1 + 0.8 * hash(i * 1.7)), d = u * (0.2 + k * 1.4) * (0.6 + hash(i) * 0.6), sx = px + Math.cos(a) * d, sy = base - u * 0.12 + Math.sin(a) * d * 0.6 + k * k * u * 0.8; ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * u * 0.1, sy - Math.sin(a) * u * 0.06); }
        ctx.stroke(); }
    }
    if (running || SV.pressT < 0.6) { ctx.fillStyle = rgb(blockRGB(S.goods.qty > 0 ? S.goods : S.raw), 1); ctx.fillRect(px - w * 0.28, base - u * 0.26, w * 0.56, u * 0.1); }
    signBoard(px, top - u * 0.62, u, 'PRESS', `Lv ${S.upg.contractValue + 1}`);
    // block sliding out to the pallets
    if (SV.pressT < 0.55 && s4 >= 1) { const k = SV.pressT / 0.55; block(px + (L.stackX - px - u * 0.4) * k, gy - u * 0.12, u, blockRGB(S.goods)); }
    obox(px + w / 2, gy - u * 0.08, L.stackX - px - w / 2 - u * 0.3, u * 0.06, '#3a3f45'); // roller bed
    // operator platform on the press with a railing
    const plx = px + w / 2, ply = gy - u * 1.15;
    obox(plx, ply, u * 0.62, u * 0.07, '#5a6068'); beamTo(plx + u * 0.6, ply, plx + u * 0.6, gy, u * 0.05, '#3a3f45');
    ctx.strokeStyle = YEL; ctx.lineWidth = Math.max(1.2, u * 0.03); ctx.beginPath(); ctx.moveTo(plx + u * 0.04, ply - u * 0.32); ctx.lineTo(plx + u * 0.6, ply - u * 0.32); ctx.moveTo(plx + u * 0.6, ply); ctx.lineTo(plx + u * 0.6, ply - u * 0.32); ctx.stroke();
    if (vt >= 2) { obox(L.bayX - u * 0.35, L.roadY - u * 0.26, u * 0.3, u * 0.08, '#6f7780'); obox(L.bayX - u * 0.25, L.roadY - u * 0.62, u * 0.1, u * 0.36, '#c9d2dc'); } // weigh station
    ctx.globalAlpha = 1;
  }

  // ---- OUTPUT: finished blocks on pallets (count = blocks waiting for the truck) ----
  if (s5 > 0) {
    const n = Math.min(32, Math.ceil(S.goods.qty / 2)), cols = 4, bw = u * 0.36, bh = u * 0.21;
    for (let pI = 0; pI < 2; pI++) {
      const x0 = L.stackX - cols * bw + pI * (cols * bw + u * 0.06) - u * 0.03, m = Math.max(0, Math.min(16, n - pI * 16));
      obox(x0 - 2, gy - u * 0.08, cols * bw + 4, u * 0.08, '#9a7448'); // pallet
      ctx.fillStyle = '#6e5232'; for (let i = 0; i < 3; i++) ctx.fillRect(x0 + i * (cols * bw) / 2 - 1, gy - u * 0.03, u * 0.06, u * 0.03);
      for (let i = 0; i < m; i++) block(x0 + (i % cols) * bw + bw / 2, gy - u * 0.08 - Math.floor(i / cols) * bh, u, blockRGB(S.goods), hash(i + pI * 20));
      if (m >= 8) { ctx.strokeStyle = 'rgba(40,60,90,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + cols * bw * 0.5, gy - u * 0.08); ctx.lineTo(x0 + cols * bw * 0.5, gy - u * 0.08 - Math.ceil(m / cols) * bh); ctx.stroke(); } // strapping band
    }
    const lab = gy - u * 0.08 - Math.ceil(Math.max(1, Math.min(16, n)) / cols) * bh - u * 0.2;
    pileLabel(L.stackX, lab, Math.floor(S.goods.qty), Math.round(12 + u * 0.08), false);
    ctx.font = `600 ${Math.round(9 + u * 0.05)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText('blocks', L.stackX, lab + u * 0.2);
  }

  if (s5 >= 1) yardFront(L, crX, running, night);

  // ---- people, lamps, barriers ----
  if (SV.buildT >= 1) {
    const pX = L.hopperX + u * 0.72;
    drawRig(pX - u * 0.3, gy - u * 2.75, u / RIG_H, 1, HAND, running ? { k: 'gesture', t: 0, a: (Math.sin(view.t * 3) + 1) / 4 } : { k: 'stand', t: 0 });
    const w = u * (pt >= 2 ? 1.22 : 1.08);
    drawRig(L.pressX + w / 2 + u * 0.3, gy - u * 1.15, u / RIG_H, -1, HAND2, running ? { k: 'gesture', t: 0, a: (Math.sin(view.t * 2.2 + 1) + 1) / 3 } : { k: 'stand', t: 0 });
    hazardBarrier(L.hopperX - u * 0.95, gy, u); hazardBarrier(L.stackX + u * 0.75, gy, u);
    lampPost(L.hopperX + u * 0.9, gy, u * 2.6, u, night); lampPost(L.stackX + u * 0.95, gy, u * 2.5, u, night);
  }
}

/** Finished-block colour: the source material, cleaned up and lighter (pressed aggregate). */
let lastBlock: [number, number, number] = [150, 140, 130];
function blockRGB(l: typeof S.goods): [number, number, number] {
  if (l.qty <= 0) return lastBlock;
  const m = rubbleRGB(mixPick(l, 0.5));
  return (lastBlock = [m[0] * 0.55 + 150 * 0.45, m[1] * 0.55 + 146 * 0.45, m[2] * 0.55 + 140 * 0.45]);
}

function block(cx: number, by: number, u: number, col: [number, number, number], var_ = 0.5) {
  const w = u * 0.34, h = u * 0.2;
  ctx.fillStyle = rgb(col, 0.92 + var_ * 0.12); ctx.fillRect(cx - w / 2, by - h, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cx - w / 2, by - h, w, h * 0.22);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx - w / 2, by - 1.5, w, 1.5);
}

/** The truck drives on the road in FRONT of the yard and the construction plot (drawn after both). */
export function drawTruckLayer(gy: number) {
  if (gy < view.vy0 - 400 || gy > view.vy1 + 400 || S.truck.state === 'NONE') return;
  drawTruck(nightness());
}

// ---- heavy delivery truck (cab-forward, one front axle, tandem rear axles, steel flatbed) ----
// Drawn facing +x in worker units u with x = 0 at the rear and y = 0 on the road; mirrored by the pose's `face`.
// Scale: length 4.5u, cab roof 1.6u, wheels 0.62u across (a worker's waist), bed deck ~0.9u up.
// One company truck: red cab; tyres, chassis, steel and glass neutral.
const TYRE = '#1b1b1d', SIDEWALL = '#2b2c2f', RIM = '#8f969e', RIM_D = '#646a72', FRAME = '#26282c', STEEL_DECK = '#5d646d';
const TRUCK_RED = '#b8322a', TRUCK_RED_D = '#7e2019', TRUCK_RED_L = '#d24a3e'; // the one company truck
const susp = { qty: 0, kick: 0, pitch: 0, lastT: 0, lastSpeed: 0 };
const TRUCK_COLS = 7, TRUCK_ROWS = 4; // 28 visible blocks = a full 60-block load

function truckWheel(x: number, r: number, roll: number) {
  ctx.fillStyle = TYRE; ctx.beginPath(); ctx.arc(x, -r, r, 0, 6.283); ctx.fill();
  ctx.fillStyle = SIDEWALL; ctx.beginPath(); ctx.arc(x, -r, r * 0.84, 0, 6.283); ctx.fill();
  ctx.fillStyle = RIM; ctx.beginPath(); ctx.arc(x, -r, r * 0.58, 0, 6.283); ctx.fill();
  ctx.strokeStyle = RIM_D; ctx.lineWidth = Math.max(1, r * 0.07); ctx.beginPath(); ctx.arc(x, -r, r * 0.42, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#4a4f55'; ctx.beginPath(); ctx.arc(x, -r, r * 0.2, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#c4cad1';
  for (let i = 0; i < 6; i++) { const a = roll + (i / 6) * 6.283; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.31, -r + Math.sin(a) * r * 0.31, r * 0.045, 0, 6.283); ctx.fill(); }
}

function drawTruck(night: number) {
  const p = truckPose(), u = p.u, tr = S.truck, len = p.len;
  // suspension: settles lower over the rear axles as the load grows; a small dip each time blocks land on it;
  // a subtle pitch when it pulls away or stops
  const dt = Math.min(0.1, Math.max(0, view.t - susp.lastT)); susp.lastT = view.t;
  if (tr.load.qty > susp.qty + 0.5) susp.kick = Math.min(1, susp.kick + 0.35);
  susp.qty = tr.load.qty;
  susp.kick *= Math.exp(-dt * 6);
  if (p.speed !== susp.lastSpeed) { susp.pitch = p.speed - susp.lastSpeed; susp.lastSpeed = p.speed; }
  susp.pitch *= Math.exp(-dt * 4);
  const fill = Math.min(1, tr.load.qty / truckCapacity(S));
  const sag = (fill * 0.045 + susp.kick * 0.02) * u; // rear drop
  const pitch = -susp.pitch * 0.014; // squats at the rear on pull-away, dips the nose when stopping
  const r = 0.31 * u, rearA = 0.62 * u, rearB = 1.3 * u, frontA = 3.62 * u;
  const roll = p.cx / r; // wheels turn with the distance travelled (forward or reverse)

  ctx.save();
  ctx.translate(p.x0, p.y); // always faces the construction site (+x)
  // shadow on the road
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(len * 0.5, 0, len * 0.5, u * 0.07, 0, 0, 6.283); ctx.fill();
  ctx.save(); // everything above the wheels rides on the suspension
  ctx.translate(frontA, -r); ctx.rotate(-Math.atan2(sag, frontA - rearA) + pitch); ctx.translate(-frontA, r); // negative = rear down
  const body = TRUCK_RED, bodyD = TRUCK_RED_D, bodyL = TRUCK_RED_L;
  // ---- chassis: frame rail, axle hangers, springs, fuel tank, mudguards ----
  ctx.fillStyle = FRAME; ctx.fillRect(0.12 * u, -0.8 * u, len - 0.35 * u, 0.15 * u);
  ctx.fillStyle = '#34373c'; ctx.fillRect(0.12 * u, -0.8 * u, len - 0.35 * u, 0.03 * u);
  for (const wx of [rearA, rearB, frontA]) {
    ctx.fillStyle = '#3a3d42'; ctx.fillRect(wx - 0.32 * u, -0.7 * u, 0.64 * u, 0.06 * u); // leaf spring
    ctx.fillStyle = FRAME; ctx.fillRect(wx - 0.05 * u, -0.66 * u, 0.1 * u, 0.36 * u); // hanger to the axle
  }
  ctx.fillStyle = '#3a3d42'; ctx.fillRect(rearA, -0.42 * u, rearB - rearA, 0.07 * u); // tandem walking beam
  // fuel tank + toolbox between the axles
  const ft = ctx.createLinearGradient(0, -0.66 * u, 0, -0.32 * u); ft.addColorStop(0, '#b9c0c8'); ft.addColorStop(1, '#6d747c');
  ctx.fillStyle = ft; ctx.beginPath(); ctx.roundRect(2.6 * u, -0.66 * u, 0.62 * u, 0.32 * u, 0.12 * u); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(2.74 * u, -0.66 * u, 0.04 * u, 0.32 * u); ctx.fillRect(3.04 * u, -0.66 * u, 0.04 * u, 0.32 * u);
  ctx.fillStyle = '#2f3237'; ctx.fillRect(1.8 * u, -0.64 * u, 0.55 * u, 0.26 * u); // toolbox
  ctx.fillStyle = '#4a4e54'; ctx.fillRect(1.84 * u, -0.6 * u, 0.47 * u, 0.03 * u);
  // rear mudguard over the tandem + mud flap, underride bar
  ctx.fillStyle = FRAME; ctx.beginPath(); ctx.roundRect(0.22 * u, -0.7 * u, 1.5 * u, 0.08 * u, 0.04 * u); ctx.fill();
  ctx.fillRect(0.12 * u, -0.66 * u, 0.06 * u, 0.5 * u);
  ctx.fillStyle = '#3a3d42'; ctx.fillRect(0.05 * u, -0.34 * u, 0.32 * u, 0.06 * u); ctx.fillRect(0.12 * u, -0.66 * u, 0.04 * u, 0.32 * u);
  // ---- steel flatbed: deck, headboard rack, stake pockets, tail lights ----
  const bedL = 0.05 * u, bedR = 2.95 * u, deck = -0.95 * u;
  ctx.fillStyle = STEEL_DECK; ctx.fillRect(bedL, deck, bedR - bedL, 0.15 * u);
  ctx.fillStyle = '#7d858f'; ctx.fillRect(bedL, deck, bedR - bedL, 0.03 * u);
  ctx.fillStyle = '#454b52'; for (let x = bedL + 0.25 * u; x < bedR; x += 0.42 * u) ctx.fillRect(x, deck + 0.04 * u, 0.05 * u, 0.09 * u); // stake pockets
  ctx.fillStyle = '#c0392b'; ctx.fillRect(bedL - 0.02 * u, deck + 0.02 * u, 0.05 * u, 0.1 * u); // tail light
  ctx.fillStyle = '#e8a23a'; ctx.fillRect(bedL + 0.06 * u, deck + 0.05 * u, 0.04 * u, 0.05 * u);
  // headboard: steel rack protecting the cab
  ctx.fillStyle = '#4a5058'; ctx.fillRect(bedR - 0.1 * u, deck - 0.92 * u, 0.1 * u, 0.92 * u);
  ctx.strokeStyle = '#6b737c'; ctx.lineWidth = Math.max(1, 0.035 * u);
  for (let i = 1; i <= 3; i++) { const yy = deck - i * 0.23 * u; ctx.beginPath(); ctx.moveTo(bedR - 0.1 * u, yy); ctx.lineTo(bedR, yy); ctx.stroke(); }
  // side stakes (low rails) at the ends of the deck
  ctx.fillStyle = '#6b737c'; ctx.fillRect(bedL + 0.02 * u, deck - 0.3 * u, 0.05 * u, 0.3 * u);
  // ---- cargo: the player's actual blocks, stacked row by row (rear first), colour from the load's geology ----
  const n = Math.round(fill * TRUCK_COLS * TRUCK_ROWS);
  const bw = (bedR - bedL - 0.16 * u) / TRUCK_COLS, bh = 0.2 * u, col = blockRGB(tr.load);
  for (let i = 0; i < n; i++) {
    const c = i % TRUCK_COLS, rw = Math.floor(i / TRUCK_COLS);
    const jx = (hash(i * 3.7 + tr.n) - 0.5) * 0.03 * u;
    const x = bedL + 0.06 * u + c * bw + jx, y = deck - (rw + 1) * bh;
    ctx.fillStyle = rgb(col, 0.88 + hash(i * 1.9 + tr.n) * 0.18); ctx.fillRect(x + 1, y + 1, bw - 2, bh - 1.5);
    ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.fillRect(x + 1, y + 1, bw - 2, bh * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 1, y + bh - 2, bw - 2, 1.5);
  }
  if (n > 0) { // ratchet straps over a loaded stack
    ctx.strokeStyle = 'rgba(230,170,40,.85)'; ctx.lineWidth = Math.max(1, 0.025 * u);
    const top = deck - Math.ceil(n / TRUCK_COLS) * bh;
    for (const sx of [bedL + 0.7 * u, bedL + 1.9 * u]) { ctx.beginPath(); ctx.moveTo(sx, deck); ctx.lineTo(sx, top); ctx.stroke(); }
  }
  // ---- exhaust stack + air intake behind the cab ----
  ctx.fillStyle = '#9aa2ab'; ctx.fillRect(3.02 * u, -1.95 * u, 0.07 * u, 1.2 * u);
  ctx.fillStyle = '#5b6168'; ctx.fillRect(3.0 * u, -1.98 * u, 0.11 * u, 0.06 * u);
  ctx.fillStyle = '#6d747c'; ctx.beginPath(); ctx.roundRect(2.98 * u, -1.35 * u, 0.12 * u, 0.4 * u, 0.04 * u); ctx.fill();
  // ---- cab (cab-forward): body colour panels, big glass, grille, bumper, lights ----
  const cx0 = 3.12 * u, cx1 = len, roof = -1.6 * u, floor = -0.46 * u;
  const cab = () => {
    ctx.beginPath();
    ctx.moveTo(cx0, floor); ctx.lineTo(cx0, roof + 0.08 * u); ctx.quadraticCurveTo(cx0, roof, cx0 + 0.1 * u, roof);
    ctx.lineTo(cx1 - 0.34 * u, roof); ctx.quadraticCurveTo(cx1 - 0.24 * u, roof, cx1 - 0.2 * u, roof + 0.1 * u);
    ctx.lineTo(cx1 - 0.06 * u, -1.0 * u); ctx.lineTo(cx1 - 0.04 * u, floor); ctx.closePath();
  };
  cab();
  const cg = ctx.createLinearGradient(0, roof, 0, floor); cg.addColorStop(0, bodyL); cg.addColorStop(0.45, body); cg.addColorStop(1, bodyD);
  ctx.fillStyle = cg; ctx.fill();
  ctx.save(); cab(); ctx.clip();
  // wheel arch cut around the front wheel
  ctx.fillStyle = '#16171a'; ctx.beginPath(); ctx.arc(frontA, -r, r * 1.16, Math.PI, 0); ctx.lineTo(frontA + r * 1.16, 0); ctx.lineTo(frontA - r * 1.16, 0); ctx.fill();
  // side window + windshield edge (blue-grey glass with a highlight)
  ctx.fillStyle = '#3e5866';
  ctx.beginPath(); ctx.moveTo(cx0 + 0.42 * u, -1.47 * u); ctx.lineTo(cx1 - 0.36 * u, -1.47 * u); ctx.lineTo(cx1 - 0.3 * u, -1.08 * u); ctx.lineTo(cx0 + 0.42 * u, -1.08 * u); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx1 - 0.25 * u, -1.5 * u); ctx.lineTo(cx1 - 0.13 * u, -1.05 * u); ctx.lineTo(cx1 - 0.07 * u, -1.05 * u); ctx.lineTo(cx1 - 0.2 * u, -1.52 * u); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.moveTo(cx0 + 0.55 * u, -1.45 * u); ctx.lineTo(cx0 + 0.72 * u, -1.45 * u); ctx.lineTo(cx0 + 0.6 * u, -1.1 * u); ctx.lineTo(cx0 + 0.45 * u, -1.1 * u); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(30,30,30,.45)'; ctx.beginPath(); ctx.arc(cx1 - 0.62 * u, -1.27 * u, 0.1 * u, 0, 6.283); ctx.fill(); // driver
  // door seam, handle, step, panel shading
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(cx0 + 0.36 * u, -1.5 * u, Math.max(1, 0.02 * u), 1.04 * u); ctx.fillRect(cx1 - 0.3 * u, -1.0 * u, Math.max(1, 0.02 * u), 0.54 * u);
  ctx.fillRect(cx0 + 0.36 * u, -0.98 * u, cx1 - cx0 - 0.66 * u, Math.max(1, 0.015 * u));
  ctx.fillStyle = '#c9ced4'; ctx.fillRect(cx0 + 0.46 * u, -0.92 * u, 0.13 * u, 0.035 * u);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cx0 + 0.05 * u, roof + 0.03 * u, cx1 - cx0 - 0.35 * u, 0.04 * u);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx0, floor - 0.12 * u, cx1 - cx0, 0.12 * u);
  ctx.restore();
  // front fascia: grille, bumper, headlights, step
  ctx.fillStyle = '#2a2d31'; ctx.beginPath(); ctx.roundRect(cx1 - 0.13 * u, -0.98 * u, 0.12 * u, 0.42 * u, 0.02 * u); ctx.fill();
  ctx.fillStyle = '#8a9198'; for (let i = 0; i < 5; i++) ctx.fillRect(cx1 - 0.12 * u, -0.94 * u + i * 0.08 * u, 0.1 * u, 0.025 * u);
  ctx.fillStyle = '#3b3f45'; ctx.beginPath(); ctx.roundRect(cx1 - 0.3 * u, -0.5 * u, 0.36 * u, 0.15 * u, 0.03 * u); ctx.fill(); // bumper
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx1 - 0.05 * u, -0.66 * u, 0.06 * u, 0.1 * u); // headlight
  ctx.fillStyle = '#e8a23a'; ctx.fillRect(cx1 - 0.06 * u, -0.54 * u, 0.05 * u, 0.04 * u); // indicator
  ctx.fillStyle = '#2f3237'; ctx.fillRect(cx0 + 0.4 * u, -0.46 * u, 0.32 * u, 0.06 * u); // entry step
  // roof marker lights + side mirror
  ctx.fillStyle = '#f0b33a'; for (let i = 0; i < 3; i++) ctx.fillRect(cx0 + 0.45 * u + i * 0.28 * u, roof - 0.04 * u, 0.08 * u, 0.04 * u);
  ctx.strokeStyle = '#2f3237'; ctx.lineWidth = Math.max(1, 0.03 * u);
  ctx.beginPath(); ctx.moveTo(cx1 - 0.2 * u, -1.32 * u); ctx.lineTo(cx1 + 0.08 * u, -1.38 * u); ctx.stroke();
  ctx.fillStyle = '#2f3237'; ctx.beginPath(); ctx.roundRect(cx1 + 0.05 * u, -1.55 * u, 0.07 * u, 0.3 * u, 0.02 * u); ctx.fill();
  ctx.restore(); // suspension
  for (const wx of [rearA, rearB, frontA]) truckWheel(wx, r, roll); // wheels stay on the road, in front of arches/hangers
  ctx.restore();
  if (night > 0.05) glow(p.x0 + len + u * 0.3, p.y - u * 0.6, u * 0.9, 0.4 * night);
}

function drawContractor(L: ReturnType<typeof surfaceLayout>) {
  const u = L.u, gone = SV.contractorGone, off = gone * gone * (view.vx1 - L.stackX + u * 4);
  const x = L.stackX + u * 0.2 + off, y = L.roadY;
  ctx.save(); ctx.globalAlpha = 1 - Math.max(0, gone - 0.8) * 5;
  // pickup truck at the shared world scale: length ≈ 3.4, cab ≈ 1.7 worker heights (delivery truck is 4.5 long)
  const T = u * 1.3, len = T * 2.6, wr = T * 0.25;
  ctx.fillStyle = '#7d3b26'; ctx.fillRect(x, y - T * 0.75, len * 0.58, T * 0.32); // bed
  ctx.fillStyle = '#93492e'; ctx.beginPath(); ctx.roundRect(x + len * 0.58, y - T * 1.3, len * 0.42, T * 0.88, [T * 0.12, T * 0.18, 2, 2]); ctx.fill();
  ctx.fillStyle = '#9fd0ea'; ctx.fillRect(x + len * 0.66, y - T * 1.2, len * 0.26, T * 0.32);
  ctx.fillStyle = '#2a2c30'; ctx.fillRect(x, y - T * 0.45, len, T * 0.12);
  for (const wx of [x + T * 0.45, x + len - T * 0.45]) {
    ctx.fillStyle = '#1c1c1e'; ctx.beginPath(); ctx.arc(wx, y - wr, wr, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#8a9198'; ctx.beginPath(); ctx.arc(wx, y - wr, wr * 0.45, 0, 6.283); ctx.fill();
  }
  ctx.font = `700 ${Math.round(T * 0.13)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9c0';
  ctx.fillText('CONTRACTOR', x + len * 0.29, y - T * 0.52);
  // the contractor himself (only while the truck is parked)
  if (gone <= 0) {
    const buying = !S.flags.sold && S.flags.arrived && S.raw.qty > 0;
    drawRig(L.hopperX + u * 0.75, L.gy, (u / RIG_H) * 1.1, -1, CONTRACTOR, { k: 'gesture', t: 0, a: buying ? (Math.sin(view.t * 8) + 1) / 2 : 0.15 }); // a flat cap, not a helmet: drawn a touch larger so he reads as full height
  }
  ctx.restore();
}
