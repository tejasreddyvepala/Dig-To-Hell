import { CFG, CREW, FINDS, LAYERS, type Find } from './config';
import { S, layerAt } from './state';
import { fmt, hash, rgb, rnd } from './util';

const FONT_DISPLAY = "'Bungee',Impact,sans-serif";
const FONT_UI = "'Rubik',system-ui,sans-serif";

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; col: string; sz: number }
export interface FloatText { x: number; y: number; s: string; c: string; t: number; big: boolean }
export interface Banner { s: string; sub: string; t: number }
export interface Nugget { ox: number; oy: number; x: number; y: number; life: number }

/** Transient view/effects state (never saved). */
export const V = {
  W: 0,
  H: 0,
  dpr: 1,
  t: 0,
  parts: [] as Particle[],
  texts: [] as FloatText[],
  shake: 0,
  swing: 0,
  banner: null as Banner | null,
  nugget: null as Nugget | null,
  nuggetT: CFG.nugget.firstDelay,
  scrollOff: 0, // meters, <= 0 when scrolled up
  scrollIdle: 0,
  hideDigHint: false,
};

const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
export const canvas = cv;

function resize() {
  const r = cv.getBoundingClientRect();
  V.dpr = window.devicePixelRatio || 1;
  V.W = r.width;
  V.H = r.height;
  cv.width = Math.round(V.W * V.dpr);
  cv.height = Math.round(V.H * V.dpr);
}
new ResizeObserver(resize).observe(cv);
resize();

export const faceY = () => V.H * CFG.faceYFrac;
const viewTop = () => S.depth - faceY() / CFG.ppm + V.scrollOff;

export function burst(x: number, y: number, col: string, n: number, sp: number) {
  for (let i = 0; i < n && V.parts.length < CFG.maxParticles; i++) {
    const a = rnd(-Math.PI, 0), s = rnd(sp * 0.3, sp);
    V.parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rnd(CFG.particleLife[0], CFG.particleLife[1]), col,
      sz: rnd(CFG.particleSize[0], CFG.particleSize[1]),
    });
  }
}

export function addText(x: number, y: number, s: string, c: string, big = false) {
  V.texts.push({ x, y, s, c, t: 0, big });
}

/** Advance particles, texts, shake, banner and scroll by dt. */
export function updateFx(dt: number) {
  V.t += dt;
  for (let i = V.parts.length - 1; i >= 0; i--) {
    const p = V.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += CFG.gravity * dt; p.life -= dt;
    if (p.life <= 0) V.parts.splice(i, 1);
  }
  for (let i = V.texts.length - 1; i >= 0; i--) {
    const q = V.texts[i];
    q.t += dt; q.y -= CFG.text.rise * dt;
    if (q.t > CFG.text.life) V.texts.splice(i, 1);
  }
  V.shake = Math.max(0, V.shake - CFG.shake.decayPerSec * dt);
  V.swing = Math.max(0, V.swing - CFG.swingDecayPerSec * dt);
  if (V.banner) { V.banner.t += dt; if (V.banner.t > CFG.bannerSecs) V.banner = null; }
  if (V.scrollIdle > 0) { V.scrollIdle -= dt; if (V.scrollIdle <= 0) V.scrollOff = 0; }
}

// ---- drawing helpers ----
function drawFind(f: Find, x: number, y: number, alpha: number) {
  const t = V.t;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  switch (f.kind) {
    case 'coin':
      ctx.fillStyle = '#d9a62e'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a6414'; ctx.fillRect(-2, -5, 4, 10);
      break;
    case 'car':
      ctx.rotate(-0.12); ctx.fillStyle = '#8c3b22'; ctx.fillRect(-40, -14, 80, 20); ctx.fillRect(-22, -28, 44, 16);
      ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(-24, 8, 9, 0, 7); ctx.arc(24, 8, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#5b7f8f'; ctx.fillRect(-18, -25, 16, 10); ctx.fillRect(2, -25, 16, 10);
      break;
    case 'cart':
      ctx.fillStyle = '#6b6f75'; ctx.beginPath(); ctx.moveTo(-26, -16); ctx.lineTo(26, -16); ctx.lineTo(20, 8); ctx.lineTo(-20, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(-13, 11, 6, 0, 7); ctx.arc(13, 11, 6, 0, 7); ctx.fill();
      break;
    case 'cave':
      ctx.fillStyle = '#15161f'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 32, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8fd0ff';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 25, -28); ctx.lineTo(-44 + i * 25, -10); ctx.lineTo(-38 + i * 25, -28); ctx.fill(); }
      break;
    case 'skull':
      ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 24, 0, 0, 7); ctx.fill(); ctx.fillRect(10, 4, 48, 14);
      ctx.fillStyle = '#3b3226'; ctx.beginPath(); ctx.arc(-14, -6, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#efe6cf'; for (let i = 0; i < 6; i++) ctx.fillRect(14 + i * 7, 16, 4, 9);
      break;
    case 'train':
      ctx.fillStyle = '#2f3a44'; ctx.fillRect(-70, -20, 140, 36);
      ctx.fillStyle = '#e7c46a'; for (let i = 0; i < 5; i++) ctx.fillRect(-60 + i * 26, -12, 16, 12);
      ctx.fillStyle = '#1b1b1b'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-50 + i * 33, 18, 8, 0, 7); ctx.fill(); }
      break;
    case 'temple':
      ctx.fillStyle = '#b9b08a'; ctx.fillRect(-60, -46, 120, 10);
      ctx.beginPath(); ctx.moveTo(-66, -46); ctx.lineTo(0, -70); ctx.lineTo(66, -46); ctx.fill();
      for (let i = 0; i < 5; i++) ctx.fillRect(-54 + i * 26, -36, 12, 52);
      ctx.fillRect(-64, 16, 128, 8);
      break;
    case 'crystal':
      ctx.fillStyle = '#7ff7ff'; ctx.shadowColor = '#7ff7ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(22, -10); ctx.lineTo(8, 30); ctx.lineTo(-14, 26); ctx.lineTo(-24, -14); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    case 'magma': {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 80);
      g.addColorStop(0, '#fff0a0'); g.addColorStop(0.4, '#ff8a1e'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 90, 40, 0, 0, 7); ctx.fill();
      break;
    }
    case 'door':
      ctx.fillStyle = '#3a0b10'; ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(-26, -20); ctx.arc(0, -20, 26, Math.PI, 0); ctx.lineTo(26, 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(12, 4, 3, 0, 7); ctx.fill();
      break;
    case 'eye':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 60, 26, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c01030'; ctx.beginPath(); ctx.arc(Math.sin(t) * 14, 0, 18, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.sin(t) * 14, 0, 5, 15, 0, 0, 7); ctx.fill();
      break;
  }
  ctx.restore();
}

function figure(x: number, y: number, s: number, toolTier: number, ph: number, col?: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col || '#2a2016'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 6); ctx.moveTo(0, 6); ctx.lineTo(-7, 20); ctx.moveTo(0, 6); ctx.lineTo(7, 20); ctx.stroke();
  ctx.fillStyle = '#f0c79a'; ctx.beginPath(); ctx.arc(0, -22, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, -24, 8, Math.PI, 0); ctx.fill(); ctx.fillRect(-10, -25, 20, 3);
  const a = -1.1 + ph * 1.6;
  ctx.save(); ctx.translate(0, -8); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 0); ctx.stroke();
  if (toolTier === 1) {
    ctx.strokeStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(34, 0); ctx.stroke();
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(32, -6, 10, 12);
  }
  if (toolTier >= 2) {
    ctx.strokeStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(32, 0); ctx.stroke();
    ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(26, -12); ctx.quadraticCurveTo(36, 0, 26, 12); ctx.stroke();
  }
  ctx.restore(); ctx.restore();
}

function drawMachine(tier: number, x: number, y: number, ph: number) {
  const t = V.t;
  ctx.save(); ctx.translate(x, y);
  if (tier === 3) {
    const j = Math.sin(t * 90) * 1.5;
    figure(-26, -4, 1, 0, 0.5);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-12, -34 + j, 22, 28);
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-4, -6 + j, 6, 16);
  } else if (tier === 4) {
    ctx.fillStyle = '#d6a21e'; ctx.fillRect(-46, -58, 92, 40);
    ctx.fillStyle = '#3b3f45'; ctx.fillRect(-36, -18, 72, 8);
    ctx.fillStyle = '#9aa3ad'; ctx.save(); ctx.translate(0, -10); ctx.rotate(t * 12); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(0, 14); ctx.fill();
  } else if (tier === 5) {
    ctx.fillStyle = '#3a4250'; ctx.fillRect(-50, -70, 100, 44);
    ctx.fillStyle = '#7ff7ff'; ctx.shadowColor = '#7ff7ff'; ctx.shadowBlur = 18;
    ctx.fillRect(-6 + Math.sin(t * 40) * 2, -26, 12, 36 + ph * 8); ctx.shadowBlur = 0;
  } else if (tier === 6) {
    ctx.fillStyle = '#2a1f40'; ctx.beginPath(); ctx.arc(0, -50, 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c58cff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -50, 24 + Math.sin(t * 8) * 4, 0, 7); ctx.stroke();
    ctx.fillStyle = '#e3c8ff'; ctx.shadowColor = '#c58cff'; ctx.shadowBlur = 24; ctx.fillRect(-5, -18, 10, 30); ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawCrew(cx: number, fy: number, shaftW: number) {
  // each crew type shows one figure/machine plus a count
  const t = V.t;
  const slots = CREW.filter((c) => S.crew[c.id] > 0);
  const step = Math.min(70, (shaftW - 60) / Math.max(1, slots.length));
  slots.forEach((c, i) => {
    const px = i % 2 === 0 ? cx - shaftW / 2 + 30 + (i / 2) * step : cx + shaftW / 2 - 30 - ((i - 1) / 2) * step;
    const ph = (Math.sin(t * 6 + i) + 1) / 2;
    ctx.save();
    if (c.id === 'dig') figure(px, fy - 20, 0.8, 2, ph);
    else if (c.id === 'cart') {
      ctx.fillStyle = '#6b6f75'; ctx.fillRect(px - 16, fy - 26 - ph * 3, 32, 16);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(px - 9, fy - 8, 5, 0, 7); ctx.arc(px + 9, fy - 8, 5, 0, 7); ctx.fill();
      ctx.fillStyle = rgb(layerAt(S.depth).col, 1.1); ctx.fillRect(px - 14, fy - 32 - ph * 3, 28, 7);
    } else if (c.id === 'exc') {
      ctx.fillStyle = '#f2b01e'; ctx.fillRect(px - 18, fy - 30, 30, 18);
      ctx.fillStyle = '#333'; ctx.fillRect(px - 20, fy - 12, 36, 8);
      ctx.strokeStyle = '#f2b01e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px + 10, fy - 26); ctx.lineTo(px + 26, fy - 40 + ph * 14); ctx.stroke();
      ctx.fillStyle = '#8a8f96'; ctx.fillRect(px + 22, fy - 40 + ph * 14, 10, 10);
    } else if (c.id === 'bore') {
      ctx.fillStyle = '#7d858f'; ctx.fillRect(px - 20, fy - 34, 40, 26);
      ctx.save(); ctx.translate(px, fy - 6); ctx.rotate(t * 10); ctx.fillStyle = '#c9d2dc';
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-2, 0, 4, 10); }
      ctx.restore();
    } else if (c.id === 'mole') {
      ctx.fillStyle = '#7a5cff'; ctx.beginPath(); ctx.arc(px, fy - 18 - ph * 4, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 5, fy - 21 - ph * 4, 4, 0, 7); ctx.arc(px + 5, fy - 21 - ph * 4, 4, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.font = `700 13px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText('×' + S.crew[c.id], px, fy - 48);
  });
}

function drawBase(cx: number, groundY: number) {
  const total = Object.values(S.crew).reduce((a, b) => a + b, 0);
  const bx = cx + 120;
  ctx.save();
  if (total < 1) {
    ctx.fillStyle = '#4f6b3a'; ctx.beginPath(); ctx.moveTo(bx, groundY); ctx.lineTo(bx + 30, groundY - 40); ctx.lineTo(bx + 60, groundY); ctx.fill();
  } else if (total < 8) {
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(bx, groundY - 44, 70, 44);
    ctx.fillStyle = '#5a3e26'; ctx.beginPath(); ctx.moveTo(bx - 6, groundY - 44); ctx.lineTo(bx + 35, groundY - 68); ctx.lineTo(bx + 76, groundY - 44); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(bx + 10, groundY - 32, 14, 12);
  } else if (total < 30) {
    ctx.fillStyle = '#8c949e'; ctx.fillRect(bx, groundY - 70, 120, 70);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(bx, groundY - 78, 120, 8);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffd76a'; ctx.fillRect(bx + 10 + i * 28, groundY - 56, 16, 14); }
    ctx.fillStyle = '#3a414b'; ctx.fillRect(bx + 130, groundY - 110, 10, 110); ctx.fillRect(bx + 100, groundY - 110, 70, 8);
  } else {
    ctx.fillStyle = '#5c6672'; ctx.fillRect(bx, groundY - 150, 90, 150);
    ctx.fillStyle = '#8c949e'; ctx.fillRect(bx + 90, groundY - 90, 110, 90);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
      ctx.fillStyle = hash(r * 7 + c) > 0.3 ? '#ffd76a' : '#2b3138'; ctx.fillRect(bx + 12 + c * 26, groundY - 140 + r * 22, 14, 12);
    }
    ctx.fillStyle = '#ffcf3a'; ctx.font = `22px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('DIG CO', bx + 145, groundY - 60);
  }
  ctx.restore();
}

export function render() {
  const { W, H, t } = V;
  const PPM = CFG.ppm;
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.save();
  if (V.shake > 0) ctx.translate(rnd(-V.shake, V.shake), rnd(-V.shake, V.shake));
  const top = viewTop(), cx = W / 2, shaftW = Math.min(CFG.shaftMaxW, W * CFG.shaftWFrac);
  const rows = Math.ceil(H / PPM) + 2;
  const m0 = Math.floor(top);
  const yOf = (m: number) => (m - top) * PPM;

  // sky
  const gy = yOf(0);
  if (gy > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#6fb7e8'); g.addColorStop(1, '#cfe9f7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 + t * 12) % (W + 200)) - 100;
      ctx.beginPath(); ctx.ellipse(x, gy * 0.3 + i * 14, 46, 14, 0, 0, 7); ctx.fill();
    }
  }
  // ground rows
  for (let i = 0; i < rows; i++) {
    const m = m0 + i; if (m < 0) continue;
    const y = yOf(m), L = layerAt(m);
    ctx.fillStyle = rgb(L.col, 0.9 + hash(m) * 0.2); ctx.fillRect(0, y, W, PPM + 1);
    if (hash(m * 3.1) < 0.5) { ctx.fillStyle = rgb(L.col, 0.75); ctx.fillRect(hash(m * 5.7) * W, y, 6 + hash(m) * 20, 3); }
    if (hash(m * 9.3) < 0.07) {
      const side = hash(m * 2.2) < 0.5 ? -1 : 1;
      const ox = cx + side * (shaftW / 2 + 30 + hash(m * 4.4) * (W / 2 - shaftW / 2 - 60));
      ctx.fillStyle = L.ore; ctx.beginPath(); ctx.ellipse(ox, y + 3, 7, 4, 0, 0, 7); ctx.fill();
    }
  }
  // grass
  if (gy > -20 && gy < H) { ctx.fillStyle = '#4f8a3a'; ctx.fillRect(0, gy - 6, W, 10); }
  // shaft
  const sTop = Math.max(0, gy), sBot = yOf(S.depth);
  if (sBot > sTop) {
    for (let i = 0; i < rows; i++) {
      const m = m0 + i; if (m < 0 || m >= S.depth) continue;
      ctx.fillStyle = rgb(layerAt(m).col, 0.42 + hash(m) * 0.06); ctx.fillRect(cx - shaftW / 2, yOf(m), shaftW, PPM + 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(cx - shaftW / 2, sTop, 8, sBot - sTop); ctx.fillRect(cx + shaftW / 2 - 8, sTop, 8, sBot - sTop);
    // rope
    ctx.strokeStyle = 'rgba(210,180,120,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - shaftW / 2 + 18, sTop); ctx.lineTo(cx - shaftW / 2 + 18, sBot); ctx.stroke();
    // depth markers
    ctx.font = `600 12px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    const stepM = S.depth > 2000 ? 500 : S.depth > 400 ? 100 : S.depth > 80 ? 25 : 10;
    for (let m = Math.ceil(Math.max(0, top) / stepM) * stepM; m < Math.min(S.depth, top + rows); m += stepM) {
      const y = yOf(m);
      ctx.fillRect(cx + shaftW / 2 - 24, y, 16, 2); ctx.fillText(fmt(m) + ' m', cx + shaftW / 2 + 6, y + 4);
    }
  }
  // finds: found ones stay in the wall, the next one is teased as a silhouette
  FINDS.forEach((f, i) => {
    const y = yOf(f.d); if (y < -120 || y > H + 120) return;
    const x = cx + f.side * (shaftW / 2 + 110);
    if (i < S.found) drawFind(f, x, y, 1);
    else if (i === S.found && f.d - S.depth < CFG.findTeaseM) {
      drawFind(f, x, y, 0.12 + 0.06 * Math.sin(t * 3));
      ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('Something is down here…', x, y - 50);
    }
  });
  if (gy > -200) drawBase(cx + shaftW / 2, gy - 4);
  // dig face + digger
  const fy = yOf(S.depth);
  if (fy > -80 && fy < H + 80) {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx - shaftW / 2, fy, shaftW, 4);
    if (S.tool < 3) figure(cx, fy - 22, 1.15, S.tool, V.swing); else drawMachine(S.tool, cx, fy, V.swing);
    drawCrew(cx, fy, shaftW);
    const n = V.nugget;
    if (n) {
      n.x = cx + n.ox; n.y = fy + n.oy;
      ctx.fillStyle = '#ffd84a'; ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 16 + Math.sin(t * 10) * 6;
      ctx.beginPath(); ctx.arc(n.x, n.y, CFG.nugget.drawRadius, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  // particles + texts
  for (const p of V.parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const q of V.texts) {
    ctx.globalAlpha = Math.max(0, 1 - q.t / CFG.text.life);
    ctx.font = q.big ? `22px ${FONT_DISPLAY}` : `700 16px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(q.s, q.x + 1, q.y + 2);
    ctx.fillStyle = q.c; ctx.fillText(q.s, q.x, q.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // depth gauge
  const gx = W - 26, gt = 20, gh = H - 40;
  const maxD = Math.max(60, FINDS[Math.min(S.found, FINDS.length - 1)].d * 1.15, S.depth * 1.1);
  for (let i = 0; i < LAYERS.length; i++) {
    const a = LAYERS[i].from, b = i + 1 < LAYERS.length ? LAYERS[i + 1].from : maxD;
    if (a > maxD) break;
    ctx.fillStyle = rgb(LAYERS[i].col, 1); ctx.fillRect(gx, gt + (a / maxD) * gh, 10, ((Math.min(b, maxD) - a) / maxD) * gh + 1);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(gx - 6, gt + (S.depth / maxD) * gh - 1, 22, 3);
  FINDS.forEach((f, i) => {
    if (f.d > maxD) return;
    const y = gt + (f.d / maxD) * gh;
    ctx.font = `700 11px ${FONT_UI}`; ctx.textAlign = 'right';
    ctx.fillStyle = i < S.found ? '#ffcf3a' : 'rgba(255,255,255,.75)';
    ctx.fillText(i < S.found ? '★' : '?', gx - 6, y + 4);
  });
  // layer banner
  const b = V.banner;
  if (b) {
    ctx.globalAlpha = Math.min(1, b.t * 3, Math.max(0, CFG.bannerSecs - b.t));
    ctx.textAlign = 'center'; ctx.font = `34px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(b.s, W / 2 + 2, 72);
    ctx.fillStyle = '#ffcf3a'; ctx.fillText(b.s, W / 2, 70);
    ctx.font = `500 15px ${FONT_UI}`; ctx.fillStyle = '#fff'; ctx.fillText(b.sub, W / 2, 96);
    ctx.globalAlpha = 1;
  }
  if (S.clicks < 3 && !V.hideDigHint) {
    ctx.textAlign = 'center'; ctx.font = `700 18px ${FONT_UI}`; ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4); ctx.fillText('Click anywhere to dig', W / 2, yOf(S.depth) + 60);
    ctx.globalAlpha = 1;
  }
  if (V.scrollOff < 0) {
    ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT_UI}`; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('Viewing the shaft. Click to jump back to the bottom', W / 2, H - 16);
  }
}
