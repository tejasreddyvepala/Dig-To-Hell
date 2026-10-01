// Surface: headframe, the Recycling Yard production line and the delivery truck (virtual px, scale from the
// surface worker unit u). Visual flow left → right, readable with no UI:
//   cart dumps into HOPPER → CRUSHER drum → inclined AUGER → hydraulic PRESS → BLOCK STACK → TRUCK on the road → $
// Scale rules (worker height u = 1): cart ≈ 1, truck cab ≈ 1.5, truck length ≈ 3.6, plant ≈ 2–3, headframe ≈ 2.5+.
import { CFG } from './config';
import { S } from './state';
import { mixPick, processRate, rawCap, tierOf } from './economy';
import { rubbleRGB } from './geo';
import { SV, truckPose } from './juice';
import { drawCivilian, type Look } from './characters';
import { bubble, drawPile, pileHeight, pileLabel } from './draw';
import { nightness } from './landscape';
import { ctx, faceScale, surfaceLayout, toScreen, view, yOf } from './view';
import { hash, rgb } from './util';

const C = CFG.cart, Y = CFG.yard;
const FONT_UI = "'Rubik',system-ui,sans-serif";
const STEEL = '#5b636c', STEEL_D = '#3f464e', STEEL_L = '#8a949e', YELLOW = '#e6a91a';
const CONTRACTOR: Look = { shirt: '#7a5a3a', pants: '#3a3f34', helmet: '', cap: '#3d5a3a' };
const HAND: Look = { shirt: '#3d6e9c', pants: '#2f3a44', helmet: '#ffd83a', vest: true };

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
    // before the yard: raw material sits on the ground beside the headframe
    drawPile(L.hopperX, gy - 2, S.raw, rawCap(S) * 0.6, u / 30, 91);
    if (S.raw.qty >= 1 || S.flags.arrived) pileLabel(L.hopperX, gy - 2 - pileHeight(S.raw.qty, rawCap(S) * 0.6, u / 30) - 8, Math.floor(S.raw.qty), Math.round(11 + u * 0.08), false);
  }
  if (SV.contractorGone < 1) drawContractor(L);
  if (S.truck.state !== 'NONE') drawTruck(night);
  // speech: the contractor before the yard, the yard hand after
  if (SV.speech) {
    const sx = S.yard && SV.contractorGone >= 1 ? L.pressX - u * 0.9 : L.stackX + u * 0.2;
    bubble(sx, gy - u * 1.55, SV.speech.text, '#2a2420', SV.speech.hold);
  }
}

function drawHeadframe(gy: number, s: number, night: number) {
  const x = toScreen(C.railX, 0).x, topY = yOf(-C.headframeM);
  const w = 20 * s;
  ctx.strokeStyle = '#5b3d22'; ctx.lineWidth = Math.max(3, 2.4 * s); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - w, gy - 2); ctx.lineTo(x - 3 * s, topY); ctx.moveTo(x + w * 0.8, gy - 2); ctx.lineTo(x + 3 * s, topY); ctx.stroke();
  ctx.lineWidth = Math.max(2, 1.6 * s);
  for (let i = 1; i <= 3; i++) { // cross braces
    const y = gy + (topY - gy) * (i / 4), k = 1 - i / 4;
    ctx.beginPath(); ctx.moveTo(x - w * k - 3 * s * (1 - k), y); ctx.lineTo(x + w * 0.8 * k + 3 * s * (1 - k), y); ctx.stroke();
  }
  ctx.fillStyle = '#3b3f45'; ctx.beginPath(); ctx.arc(x, topY, 6 * s, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(x, topY, 2.4 * s, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(x + 7 * s, topY + 10 * s, 2 * s, 0, 6.283); ctx.fill(); // work lamp
  glow(x + 7 * s, topY + 10 * s, 34 * s, 0.3 * night);
}

function drawRoad(L: ReturnType<typeof surfaceLayout>) {
  const u = L.u, x0 = L.pressX - u * 0.9, x1 = view.vx1 + 20, y = L.roadY;
  ctx.fillStyle = '#5d5a55'; ctx.fillRect(x0, y - u * 0.22, x1 - x0, u * 0.44);
  ctx.fillStyle = '#4a4744'; ctx.fillRect(x0, y + u * 0.18, x1 - x0, u * 0.06);
  ctx.fillStyle = 'rgba(240,220,150,.7)';
  for (let x = L.bayX + u * 0.8; x < x1; x += u * 0.7) ctx.fillRect(x, y - 1, u * 0.35, 2);
  // loading bay markings
  ctx.fillStyle = 'rgba(255,207,58,.8)'; ctx.fillRect(L.bayX - u * 0.05, y - u * 0.22, u * 0.08, u * 0.44);
}

function drawYard(L: ReturnType<typeof surfaceLayout>, night: number) {
  const { gy, u } = L;
  const pt = tierOf(S.upg.processSpeed, Y.processTiers), st = tierOf(S.upg.rawStorage, Y.storageTiers), vt = tierOf(S.upg.contractValue, Y.valueTiers);
  const s1 = step(0, 0.25), s2 = step(0.2, 0.45), s3 = step(0.4, 0.7), s4 = step(0.65, 0.9), s5 = step(0.88, 1);
  // concrete pad under the whole line
  ctx.fillStyle = '#8b8780'; ctx.fillRect(L.right + 2, gy - 3, (L.stackX - L.right + u * 0.9) * s1, 5);

  // ---- HOPPER (cart dumps straight in) ----
  if (s2 > 0) {
    const hw = u * (st >= 1 ? 0.72 : 0.62), top = L.hopperTop, bot = gy - u * 0.68;
    const h = (bot - top) * s2;
    ctx.save(); ctx.beginPath(); ctx.rect(L.hopperX - hw - 6, bot - h - 4, hw * 2 + 12, h + 8); ctx.clip();
    ctx.fillStyle = STEEL_D; ctx.fillRect(L.hopperX - u * 0.06 - hw * 0.5, bot - 2, u * 0.12, gy - bot); // legs
    ctx.fillRect(L.hopperX + hw * 0.5 - u * 0.06, bot - 2, u * 0.12, gy - bot);
    ctx.fillStyle = STEEL;
    ctx.beginPath(); ctx.moveTo(L.hopperX - hw, top); ctx.lineTo(L.hopperX + hw, top); ctx.lineTo(L.hopperX + hw * 0.32, bot); ctx.lineTo(L.hopperX - hw * 0.32, bot); ctx.closePath(); ctx.fill();
    ctx.fillStyle = STEEL_L; ctx.fillRect(L.hopperX - hw - 2, top - 3, hw * 2 + 4, 4);
    if (st >= 1) { ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = -2; i <= 2; i++) ctx.fillRect(L.hopperX + i * hw * 0.32 - 1, top + 4, 2, (bot - top) * 0.8); }
    // raw material heaped in the mouth (rises with fill, coloured by what came up)
    const fill = Math.min(1, S.raw.qty / rawCap(S));
    if (S.raw.qty > 0.5) {
      const n = Math.round(4 + fill * 22);
      for (let i = 0; i < n; i++) {
        const k = hash(i * 3.7 + 1), px = L.hopperX - hw * 0.85 + hw * 1.7 * k;
        const py = top + 4 - fill * u * 0.32 * Math.sin(Math.PI * k) * (0.6 + 0.4 * hash(i * 1.3));
        ctx.fillStyle = rgb(rubbleRGB(mixPick(S.raw, hash(i * 5.1))), 0.8 + hash(i * 2.2) * 0.4);
        ctx.beginPath(); ctx.ellipse(px, py, u * 0.06, u * 0.045, hash(i) * 3, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
    if (st >= 2) { // overflow bunker
      ctx.fillStyle = '#7d786f'; ctx.fillRect(L.hopperX - hw - u * 0.55, gy - u * 0.45, u * 0.5, u * 0.45);
      ctx.fillStyle = '#6a655d'; ctx.fillRect(L.hopperX - hw - u * 0.55, gy - u * 0.47, u * 0.5, u * 0.05);
    }
    if (s2 >= 1) {
      const full = S.raw.qty >= rawCap(S) - 0.5;
      pileLabel(L.hopperX, top - u * 0.42 - fill * u * 0.3, Math.floor(S.raw.qty), Math.round(12 + u * 0.08), full);
      ctx.font = `600 ${Math.round(9 + u * 0.05)}px ${FONT_UI}`; ctx.textAlign = 'center';
      ctx.fillStyle = full ? '#ffb38a' : 'rgba(255,255,255,.8)';
      ctx.fillText(full ? `RAW FULL (${rawCap(S)})` : `raw / ${rawCap(S)}`, L.hopperX, top - u * 0.18 - fill * u * 0.3);
    }
  }

  // ---- CRUSHER drum(s) under the hopper ----
  if (s3 > 0) {
    ctx.globalAlpha = s3;
    const drums = pt >= 1 ? 2 : 1;
    for (let d = 0; d < drums; d++) {
      const cx = L.hopperX + (d - (drums - 1) / 2) * u * 0.5, cy = gy - u * 0.42, r = u * 0.26;
      ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, 6.283); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(SV.spin * (d % 2 ? -1 : 1));
      ctx.fillStyle = STEEL_L;
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(r * 0.55, -r * 0.12, r * 0.45, r * 0.24); }
      ctx.fillStyle = STEEL; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    // ---- AUGER: inclined screw conveyor from the crusher up to the press ----
    const ax0 = L.hopperX + u * 0.38, ay0 = gy - u * 0.3, ax1 = L.pressX - u * 0.5, ay1 = gy - u * 1.45;
    const len = Math.hypot(ax1 - ax0, ay1 - ay0), ang = Math.atan2(ay1 - ay0, ax1 - ax0), tw = u * 0.34;
    ctx.save(); ctx.translate(ax0, ay0); ctx.rotate(ang);
    ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.roundRect(0, -tw / 2, len * s3, tw, tw / 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, -tw / 2 + 2, len * s3, tw - 4, tw / 2); ctx.clip();
    ctx.strokeStyle = '#b6bec7'; ctx.lineWidth = Math.max(1.5, u * 0.035);
    const pitch = u * 0.16, ph = (SV.spin * u * 0.18) % pitch;
    for (let x = -pitch + ph; x < len; x += pitch) { ctx.beginPath(); ctx.moveTo(x, -tw / 2); ctx.lineTo(x + pitch * 0.55, tw / 2); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, -tw / 2 + 2, len * s3, 2);
    ctx.restore();
    ctx.fillStyle = STEEL_D; // auger supports
    ctx.fillRect(ax0 + (ax1 - ax0) * 0.55 - 2, ay0 + (ay1 - ay0) * 0.55, 4, gy - (ay0 + (ay1 - ay0) * 0.55));
    ctx.globalAlpha = 1;
  }

  // ---- PRESS: frame, hydraulic ram, mould; a block slides out after each THUMP ----
  if (s4 > 0) {
    const px = L.pressX, w = u * (pt >= 2 ? 1.15 : 1.0), top = gy - u * 2.5, base = gy - u * 0.35;
    ctx.save(); ctx.beginPath(); ctx.rect(px - w, gy - (gy - top + 10) * s4, w * 2, gy - top + 10); ctx.clip();
    ctx.fillStyle = YELLOW; ctx.fillRect(px - w / 2, top, u * 0.14, gy - top); ctx.fillRect(px + w / 2 - u * 0.14, top, u * 0.14, gy - top);
    ctx.fillRect(px - w / 2, top, w, u * 0.2);
    ctx.fillStyle = '#c98f12'; ctx.fillRect(px - w / 2, top + u * 0.2, w, u * 0.04);
    // ram: anticipation drop, THUMP at the press event, then rise
    const period = Y.pressBatch / Math.max(0.1, processRate(S));
    const working = S.raw.qty > 0.01;
    let f = SV.pressT < 0.06 ? 1 : Math.max(0, 1 - (SV.pressT - 0.06) / 0.35);
    if (working && SV.pressT > period - 0.2) f = Math.max(f, Math.min(1, (SV.pressT - (period - 0.2)) / 0.2));
    const ramTop = top + u * 0.24, ramBot = base - u * 0.32, ry = ramTop + (ramBot - ramTop - u * 0.3) * f;
    ctx.fillStyle = STEEL_L; ctx.fillRect(px - u * 0.07, ramTop, u * 0.14, ry - ramTop + u * 0.05);
    ctx.fillStyle = STEEL; ctx.fillRect(px - w * 0.36, ry, w * 0.72, u * 0.3);
    // mould + the material being pressed
    ctx.fillStyle = STEEL_D; ctx.fillRect(px - w * 0.42, base - u * 0.06, w * 0.84, u * 0.4);
    if (working || SV.pressT < 0.6) { ctx.fillStyle = rgb(blockRGB(S.goods.qty > 0 ? S.goods : S.raw), 1); ctx.fillRect(px - w * 0.3, base - u * 0.12, w * 0.6, u * 0.12); }
    ctx.restore();
    // block sliding from the press to the stack
    if (SV.pressT < 0.55 && s4 >= 1) {
      const k = SV.pressT / 0.55, bx = px + (L.stackX - px - u * 0.4) * k;
      block(bx, gy - u * 0.12, u, blockRGB(S.goods));
    }
    // short roller bed between press and stack
    ctx.fillStyle = STEEL_D; ctx.fillRect(px + w / 2, gy - u * 0.04, L.stackX - px - w / 2 - u * 0.3, u * 0.05);
    // contract value tiers: painted sign -> contract board -> weigh station -> company livery
    if (s5 > 0) {
      ctx.globalAlpha = s5;
      const sx = px, sy = top - u * 0.42;
      ctx.fillStyle = vt >= 3 ? '#1f5b4a' : vt >= 1 ? '#2f3a2f' : '#a4793f';
      ctx.fillRect(sx - u * 0.75, sy, u * 1.5, u * 0.34);
      ctx.font = `${Math.round(u * 0.17)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = vt >= 1 ? '#ffe08a' : '#2b1a0c';
      ctx.fillText(vt >= 1 ? 'RECYCLING ✓' : 'RECYCLING', sx, sy + u * 0.24);
      if (vt >= 2) { // weigh station by the bay
        ctx.fillStyle = '#6f7780'; ctx.fillRect(L.bayX - u * 0.35, L.roadY - u * 0.26, u * 0.3, u * 0.08);
        ctx.fillStyle = '#c9d2dc'; ctx.fillRect(L.bayX - u * 0.25, L.roadY - u * 0.62, u * 0.1, u * 0.36);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- OUTPUT: finished blocks stacked on pallets ----
  if (s5 > 0) {
    const n = Math.min(24, Math.ceil(S.goods.qty / 2)), cols = 4, bw = u * 0.36, bh = u * 0.21;
    const x0 = L.stackX - (cols * bw) / 2;
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(x0 - 2, gy - u * 0.06, cols * bw + 4, u * 0.06); // pallet
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      block(x0 + c * bw + bw / 2, gy - u * 0.06 - r * bh, u, blockRGB(S.goods), hash(i));
    }
    const lab = gy - u * 0.06 - Math.ceil(Math.max(1, n) / cols) * bh - u * 0.18;
    pileLabel(L.stackX, lab, Math.floor(S.goods.qty), Math.round(12 + u * 0.08), false);
    ctx.font = `600 ${Math.round(9 + u * 0.05)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('blocks', L.stackX, lab + u * 0.2);
  }

  // ---- yard hand (scale reference), lights ----
  if (SV.buildT >= 1) {
    const busy = S.raw.qty > 0.01;
    drawCivilian(L.pressX - u * 0.9, gy, u, HAND, busy ? (Math.sin(view.t * 3) + 1) / 4 : 0.1, 1);
    for (const lx of [L.hopperX - u * 0.1, L.stackX + u * 0.5]) {
      ctx.fillStyle = STEEL_D; ctx.fillRect(lx - 1.5, gy - u * 2.3, 3, u * 2.3);
      ctx.fillStyle = '#ffd98a'; ctx.fillRect(lx - u * 0.12, gy - u * 2.36, u * 0.24, u * 0.07);
      glow(lx, gy - u * 2.2, u * 1.05, 0.32 * night);
    }
    glow(L.pressX, gy - u * 1.2, u * 0.9, 0.14 * night);
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

function drawTruck(night: number) {
  const p = truckPose(), u = p.u, tr = S.truck;
  const x = p.rear, y = p.y + p.rock * 1.5, len = p.len;
  const body = truckColor(tr.n), dark = truckColor(tr.n, 0.7);
  const wr = u * 0.27; // wheels roughly a worker's torso width
  const bedTop = y - u * 0.82, bedEnd = x + len * 0.68;
  // chassis + wheels
  ctx.fillStyle = '#2a2c30'; ctx.fillRect(x + u * 0.1, y - u * 0.42, len - u * 0.2, u * 0.16);
  for (const wx of [x + u * 0.45, x + u * 1.05, x + len - u * 0.55]) {
    ctx.fillStyle = '#1c1c1e'; ctx.beginPath(); ctx.arc(wx, y - wr, wr, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#8a9198'; ctx.beginPath(); ctx.arc(wx, y - wr, wr * 0.45, 0, 6.283); ctx.fill();
  }
  // flatbed with side rails
  ctx.fillStyle = dark; ctx.fillRect(x, y - u * 0.5, bedEnd - x, u * 0.1);
  ctx.fillStyle = body; ctx.fillRect(x, bedTop, u * 0.06, u * 0.36); ctx.fillRect(bedEnd - u * 0.06, bedTop, u * 0.06, u * 0.36);
  // load on the bed (rows of blocks)
  const onBed = tr.state === 'DEPARTING' ? tr.bed : tr.load.qty;
  const fill = onBed / Y.truck.capacity, n = Math.round(fill * 15), cols = 5, bw = (bedEnd - x - u * 0.16) / cols;
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    block(x + u * 0.08 + c * bw + bw / 2, y - u * 0.5 - r * u * 0.16, u, lastBlock, hash(i * 1.7));
  }
  // cab (front faces right: it backs into the bay, then drives off to the right)
  const cx = bedEnd + u * 0.04, cw = len - (bedEnd - x) - u * 0.04, ch = u * 1.5;
  ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(cx, y - ch + u * 0.26, cw, ch - u * 0.5, [u * 0.12, u * 0.2, 2, 2]); ctx.fill();
  ctx.fillStyle = '#9fd0ea'; ctx.beginPath(); ctx.roundRect(cx + cw * 0.38, y - ch + u * 0.4, cw * 0.5, u * 0.42, 3); ctx.fill();
  ctx.fillStyle = 'rgba(40,40,40,.6)'; ctx.beginPath(); ctx.arc(cx + cw * 0.58, y - ch + u * 0.6, u * 0.1, 0, 6.283); ctx.fill(); // driver
  ctx.fillStyle = dark; ctx.fillRect(cx, y - u * 0.5, cw, u * 0.08); // bumper line
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx + cw - u * 0.08, y - u * 0.62, u * 0.08, u * 0.1); // headlight
  if (night > 0.05) glow(cx + cw + u * 0.3, y - u * 0.58, u * 0.8, 0.4 * night);
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(cx - u * 0.05, y - ch + u * 0.15, u * 0.06, u * 0.5); // exhaust stack
}

function drawContractor(L: ReturnType<typeof surfaceLayout>) {
  const u = L.u, gone = SV.contractorGone, off = gone * gone * (view.vx1 - L.stackX + u * 4);
  const x = L.stackX + u * 0.2 + off, y = L.roadY;
  ctx.save(); ctx.globalAlpha = 1 - Math.max(0, gone - 0.8) * 5;
  // pickup truck: bigger than a person (length ≈ 2.6, cab ≈ 1.3 worker heights)
  const len = u * 2.6, wr = u * 0.25;
  ctx.fillStyle = '#7d3b26'; ctx.fillRect(x, y - u * 0.75, len * 0.58, u * 0.32); // bed
  ctx.fillStyle = '#93492e'; ctx.beginPath(); ctx.roundRect(x + len * 0.58, y - u * 1.3, len * 0.42, u * 0.88, [u * 0.12, u * 0.18, 2, 2]); ctx.fill();
  ctx.fillStyle = '#9fd0ea'; ctx.fillRect(x + len * 0.66, y - u * 1.2, len * 0.26, u * 0.32);
  ctx.fillStyle = '#2a2c30'; ctx.fillRect(x, y - u * 0.45, len, u * 0.12);
  for (const wx of [x + u * 0.45, x + len - u * 0.45]) { ctx.fillStyle = '#1c1c1e'; ctx.beginPath(); ctx.arc(wx, y - wr, wr, 0, 6.283); ctx.fill(); }
  ctx.font = `700 ${Math.round(u * 0.13)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9c0';
  ctx.fillText('CONTRACTOR', x + len * 0.29, y - u * 0.52);
  // the contractor himself (only while the truck is parked)
  if (gone <= 0) {
    const buying = !S.flags.sold && S.flags.arrived && S.raw.qty > 0;
    drawCivilian(L.hopperX + u * 0.75, L.gy, u, CONTRACTOR, buying ? (Math.sin(view.t * 8) + 1) / 2 : 0.15, -1);
  }
  ctx.restore();
}
