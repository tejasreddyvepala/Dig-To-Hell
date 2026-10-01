// Draws the world, the destructible dig face, miner/crew, FX and HUD overlays. Reads state; never mutates sim.
import { CFG, FINDS, MATERIALS, MAX_DEPTH, type Find } from './config';
import { S } from './state';
import { materialAt } from './economy';
import { face, type Chunk, type Crack, type Mark } from './digface';
import { workers } from './sim';
import { miner, minerSwingAngle, swingAngle } from './miner';
import { FX, drawPopups, drawWorldFx } from './fx';
import { ctx, faceOrigin, faceScale, faceY, shaftW, view, viewTop, yOf } from './view';
import { fmt, hash, rgb, rgba } from './util';

const FONT_DISPLAY = "'Bungee',Impact,sans-serif";
const FONT_UI = "'Rubik',system-ui,sans-serif";
const M = CFG.miner;
const IMPACT_AT = (M.windupMs + M.downswingMs) / 1000;

// ---------- dig face ----------
function polyPath(p: number[]) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
  ctx.closePath();
}

function bbox(p: number[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < p.length; k += 2) {
    x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]);
  }
  return { x0, x1, y0, y1 };
}

function strokeCrack(k: Crack) {
  const n = k.pts.length / 2 - 1;
  const segs = k.grow * n;
  ctx.beginPath();
  ctx.moveTo(k.pts[0], k.pts[1]);
  for (let i = 1; i <= Math.ceil(segs); i++) {
    const f = Math.min(1, segs - (i - 1));
    const ax = k.pts[i * 2 - 2], ay = k.pts[i * 2 - 1], bx = k.pts[i * 2], by = k.pts[i * 2 + 1];
    ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
  }
  ctx.stroke();
}

function drawCracks(c: Chunk) {
  const red = S.depth >= CFG.face.redFleckDepth;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const k of c.cracks) {
    if (k.style === 'deep') {
      ctx.strokeStyle = red ? 'rgba(190,30,20,.28)' : 'rgba(90,110,210,.22)';
      ctx.lineWidth = k.w * 2; strokeCrack(k);
      ctx.strokeStyle = 'rgba(2,2,8,.95)'; ctx.lineWidth = k.w; strokeCrack(k);
    } else if (k.style === 'thick') {
      ctx.strokeStyle = 'rgba(30,8,2,.92)'; ctx.lineWidth = k.w; strokeCrack(k);
      ctx.save(); ctx.translate(0.8, 0.9); ctx.strokeStyle = 'rgba(255,190,150,.22)'; ctx.lineWidth = 0.8; strokeCrack(k); ctx.restore();
    } else if (k.style === 'radial') {
      ctx.strokeStyle = c.mat.crack; ctx.lineWidth = k.w; strokeCrack(k);
      ctx.save(); ctx.translate(0.7, 0.7); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.6; strokeCrack(k); ctx.restore();
    } else {
      ctx.strokeStyle = c.mat.crack; ctx.lineWidth = k.w; strokeCrack(k);
    }
  }
}

function drawMark(m: Mark) {
  if (m.kind === 'indent') {
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
  } else if (m.kind === 'dent') {
    ctx.fillStyle = 'rgba(40,10,0,.26)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.55, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,160,.2)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, m.r, m.r * 0.55, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (m.kind === 'impact') {
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + m.x, r = m.r * (0.6 + hash(m.y + i) * 0.6);
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.3, 0, 6.283); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
  }
}

function drawTexture(c: Chunk, b: ReturnType<typeof bbox>) {
  const id = c.mat.id;
  for (let k = 0; k < 12; k++) {
    const hx = b.x0 + hash(c.seed + k * 3.1) * (b.x1 - b.x0);
    const hy = b.y0 + hash(c.seed + k * 7.7) * (b.y1 - b.y0);
    const r = 0.8 + hash(c.seed + k * 1.3) * (id === 'clay' ? 4 : 2.2);
    if (id === 'stone') ctx.fillStyle = k % 3 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.22)';
    else if (id === 'cave') ctx.fillStyle = k % 4 ? 'rgba(0,0,10,.22)' : 'rgba(150,170,255,.2)';
    else if (id === 'clay') ctx.fillStyle = k % 2 ? 'rgba(90,30,10,.16)' : 'rgba(255,170,120,.12)';
    else ctx.fillStyle = k % 2 ? 'rgba(40,24,10,.25)' : 'rgba(220,180,130,.18)';
    ctx.beginPath();
    if (id === 'clay') ctx.ellipse(hx, hy, r * 1.8, r * 0.6, 0, 0, 6.283);
    else if (id === 'stone') { ctx.moveTo(hx - r, hy); ctx.lineTo(hx, hy - r); ctx.lineTo(hx + r, hy + r * 0.4); }
    else ctx.arc(hx, hy, r, 0, 6.283);
    ctx.fill();
  }
}

/** Chunk polygon with its top edge dipped into a bowl (break crater + camera-sync recess).
 *  Seam endpoints never move, so the face stays one continuous surface. */
function dippedPoly(c: Chunk, s: number): number[] {
  const d = c.recess / s + c.dip;
  if (d < 0.05) return c.poly;
  const p = c.poly.slice(), n = c.top.length - 1;
  c.top.forEach((v, j) => { p[v * 2 + 1] += d * Math.sin((Math.PI * j) / n); });
  return p;
}

const PULSE: Record<string, string> = {
  dirt: 'rgba(255,226,180,', clay: 'rgba(55,14,0,', stone: 'rgba(255,255,255,', cave: 'rgba(170,190,255,',
};

/** The working face: a continuous mass of earth whose top band holds the logical damage regions. */
function drawFace(s: number) {
  const F = CFG.face, W = F.logicalW, cur = materialAt(S.depth);
  // dark inner earth just under the surface: only visible where a break leaves a crater
  const gm = ctx.createLinearGradient(0, F.edgeJitter, 0, F.craterDepth);
  gm.addColorStop(0, rgb(cur.face, 0.3)); gm.addColorStop(1, rgba(cur.face, 0.45, 0));
  ctx.fillStyle = gm;
  ctx.fillRect(0, F.edgeJitter, W, F.craterDepth - F.edgeJitter);

  // chunks share one face-space gradient per material, have no outlines, and differ only by damage
  const grads = new Map<string, CanvasGradient>();
  const grad = (c: Chunk) => {
    let g = grads.get(c.mat.id);
    if (!g) {
      // lit lip -> body -> fades out into the surrounding ground, so the face is the top of a mass, not a strip
      g = ctx.createLinearGradient(0, -4, 0, F.height);
      g.addColorStop(0, rgb(c.mat.face, 1.16)); g.addColorStop(0.22, rgb(c.mat.face, 1));
      g.addColorStop(0.6, rgba(c.mat.face, 0.92, 0.85)); g.addColorStop(1, rgba(c.mat.face, 0.85, 0));
      grads.set(c.mat.id, g);
    }
    return g;
  };
  const polys = face.chunks.map((c) => dippedPoly(c, s));
  face.chunks.forEach((c, i) => {
    const b = bbox(polys[i]);
    polyPath(polys[i]);
    ctx.fillStyle = grad(c);
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawTexture(c, b);
    for (const m of c.marks) drawMark(m);
    drawCracks(c);
    if (c.reveal > 0) {
      // freshly exposed rock: a soft dark bowl around the crater, never a rectangle
      const cx = (b.x0 + b.x1) / 2, r = (b.x1 - b.x0) * 0.75;
      const g = ctx.createRadialGradient(cx, b.y0 + c.dip, 0, cx, b.y0 + c.dip, r);
      g.addColorStop(0, `rgba(12,6,0,${((0.6 * c.reveal) / F.revealSecs).toFixed(3)})`); g.addColorStop(1, 'rgba(12,6,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, b.y0 - 2, r * 2, r + 2);
    }
    ctx.restore();
  });

  // local impact pulses, clipped to the whole face (not to a chunk) so nothing reveals the grid
  if (face.chunks.some((c) => c.pulse)) {
    ctx.save();
    ctx.beginPath();
    for (const p of polys) { ctx.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]); ctx.closePath(); }
    ctx.clip();
    for (const c of face.chunks) {
      const p = c.pulse; if (!p) continue;
      const k = p.t / F.pulseSecs, r = F.pulseRadius * (0.55 + 0.6 * k) * (0.7 + 0.3 * Math.min(1.6, p.k));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const col = PULSE[c.mat.id];
      g.addColorStop(0, col + (0.65 * Math.min(1, p.k) * (1 - k)).toFixed(3) + ')'); g.addColorStop(1, col + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // one continuous lit lip along the top of the face, with a soft shadow just under it
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lip = () => {
    ctx.beginPath();
    face.chunks.forEach((c, i) => c.top.forEach((v, j) => {
      const x = polys[i][v * 2], y = polys[i][v * 2 + 1];
      i === 0 && j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }));
  };
  ctx.save(); ctx.translate(0, 2.2); lip(); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  lip(); ctx.strokeStyle = rgba(cur.face, 1.5, 0.75); ctx.lineWidth = 1.5; ctx.stroke();
}

// ---------- figures ----------
type ToolKind = 'pick' | 'jackhammer';

/** Miner in logical face units, feet at (x, 0). angle from swingAngle(). */
function drawWorker(x: number, dir: number, angle: number, tool: ToolKind, shirt: string, scale: number, player: boolean) {
  ctx.save();
  ctx.translate(x, 0); ctx.scale(dir * scale, scale);
  const lean = Math.max(0, angle) * 0.12 - 0.04;
  ctx.rotate(lean);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (player) {
    // helmet lamp beam toward the work + dark rim so the player's miner reads first
    const beam = ctx.createLinearGradient(6, -38, 30, 6);
    beam.addColorStop(0, 'rgba(255,240,170,.32)'); beam.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(7, -39); ctx.lineTo(40, 2); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3;
  }
  // legs
  ctx.strokeStyle = '#2b2219'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-5, 0); ctx.moveTo(0, -14); ctx.lineTo(6, 0); ctx.stroke();
  // torso
  ctx.strokeStyle = shirt; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -28); ctx.stroke();
  // head + helmet + lamp
  ctx.fillStyle = '#f0c79a'; ctx.beginPath(); ctx.arc(1, -34, 5.5, 0, 6.283); ctx.fill();
  ctx.fillStyle = player ? '#ffd83a' : '#c9a443'; ctx.beginPath(); ctx.arc(1, -36, 6.5, Math.PI, 0); ctx.fill(); ctx.fillRect(-6, -37, 14, 2.5);
  ctx.fillStyle = player ? '#ffffff' : '#bfb68a'; ctx.fillRect(6, -39.5, 3, 3);
  if (tool === 'pick') {
    ctx.save(); ctx.translate(0, -27); ctx.rotate(angle);
    ctx.strokeStyle = '#f0c79a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(35, 0); ctx.stroke();
    ctx.strokeStyle = '#aab3bd'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(31, -9); ctx.quadraticCurveTo(39, 0, 33, 10); ctx.stroke();
    ctx.restore();
  } else {
    const plunge = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
    const jx = 17, jy = -6 + plunge * 9 + (plunge > 0.9 ? Math.sin(view.t * 120) * 0.8 : 0);
    ctx.strokeStyle = '#f0c79a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(jx - 2, jy - 20); ctx.stroke();
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(jx - 5, jy - 24, 10, 16);
    ctx.fillStyle = '#3b3f45'; ctx.fillRect(jx - 7, jy - 26, 14, 3);
    ctx.fillStyle = '#aab3bd'; ctx.fillRect(jx - 1.5, jy - 8, 3, 12);
  }
  ctx.restore();
}

function drawExcavator(x: number, dir: number, angle: number) {
  ctx.save(); ctx.translate(x, 0); ctx.scale(dir, 1);
  ctx.fillStyle = '#2c2f33'; ctx.fillRect(-26, -10, 46, 10);
  ctx.fillStyle = '#f2b01e'; ctx.fillRect(-22, -32, 34, 22);
  ctx.fillStyle = '#8fc6e8'; ctx.fillRect(-4, -29, 12, 10);
  const k = Math.max(0, Math.min(1, (angle + 0.5) / 1.55));
  const bx = 34, by = -34 + k * 36;
  ctx.strokeStyle = '#f2b01e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(24, -44 + k * 10); ctx.lineTo(bx, by); ctx.stroke();
  ctx.fillStyle = '#7d848c'; ctx.beginPath(); ctx.moveTo(bx - 6, by - 4); ctx.lineTo(bx + 8, by - 4); ctx.lineTo(bx + 4, by + 8); ctx.lineTo(bx - 6, by + 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCarts() {
  const n = S.crew.cart;
  if (!n) return;
  const x = 10;
  ctx.save(); ctx.translate(x, -2);
  ctx.fillStyle = '#5f646b'; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(22, -16); ctx.lineTo(18, -3); ctx.lineTo(-2, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgb(materialAt(S.depth).chip, 1.1); ctx.fillRect(-4, -20, 24, 5);
  ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(2, -2, 3, 0, 6.283); ctx.arc(14, -2, 3, 0, 6.283); ctx.fill();
  if (n > 1) { ctx.font = `700 9px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('×' + n, 8, -24); }
  ctx.restore();
}

function workerAngle(timer: number, since: number) {
  return timer < IMPACT_AT ? swingAngle(IMPACT_AT - timer) : swingAngle(IMPACT_AT + since);
}

const SHIRTS = ['#4a6a86', '#6f5a4a', '#55705a'];

/** Owned diggers beyond the visible few: a quiet row of helmets on the shaft wall. */
function drawReserve() {
  const extra = S.crew.dig - workers.filter((w) => w.id === 'dig').length;
  if (extra <= 0) return;
  const n = Math.min(extra, CFG.reserveHelmetsMax);
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#c9a443'; ctx.beginPath(); ctx.arc(8 + i * 7, -62, 3, Math.PI, 0); ctx.fill();
  }
  ctx.font = `700 8px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e8dcc0';
  ctx.fillText(`+${extra} crew`, 8 + n * 7, -60);
  ctx.restore();
}

function drawFaceAndCrew() {
  const o = faceOrigin(), s = faceScale();
  if (o.y < -160 || o.y > view.H + 160) return;
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(s, s);
  drawFace(s);
  drawCarts();
  let di = 0;
  for (const w of workers) {
    const a = workerAngle(w.timer, w.since);
    if (w.id === 'exc') drawExcavator(w.x, w.dir, a);
    else drawWorker(w.x, w.dir, a, 'pick', SHIRTS[di++ % SHIRTS.length], CFG.crewScale, false);
  }
  drawReserve();
  drawWorker(miner.x, miner.dir, minerSwingAngle(), S.tool >= 1 ? 'jackhammer' : 'pick', '#d0532c', CFG.playerScale, true);
  ctx.restore();
}

// ---------- world ----------
function drawFind(f: Find, x: number, y: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  if (f.kind === 'coin') {
    ctx.fillStyle = '#d9a62e'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6414'; ctx.fillRect(-2, -5, 4, 10);
  } else {
    ctx.rotate(-0.12); ctx.fillStyle = '#8c3b22'; ctx.fillRect(-40, -14, 80, 20); ctx.fillRect(-22, -28, 44, 16);
    ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(-24, 8, 9, 0, 7); ctx.arc(24, 8, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b7f8f'; ctx.fillRect(-18, -25, 16, 10); ctx.fillRect(2, -25, 16, 10);
  }
  ctx.restore();
}

function drawBase(cx: number, groundY: number) {
  const total = S.crew.dig + S.crew.cart + S.crew.exc;
  const bx = cx + 120;
  if (total < 1) {
    ctx.fillStyle = '#4f6b3a'; ctx.beginPath(); ctx.moveTo(bx, groundY); ctx.lineTo(bx + 30, groundY - 40); ctx.lineTo(bx + 60, groundY); ctx.fill();
  } else if (total < 8) {
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(bx, groundY - 44, 70, 44);
    ctx.fillStyle = '#5a3e26'; ctx.beginPath(); ctx.moveTo(bx - 6, groundY - 44); ctx.lineTo(bx + 35, groundY - 68); ctx.lineTo(bx + 76, groundY - 44); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(bx + 10, groundY - 32, 14, 12);
  } else {
    ctx.fillStyle = '#8c949e'; ctx.fillRect(bx, groundY - 70, 120, 70);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(bx, groundY - 78, 120, 8);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffd76a'; ctx.fillRect(bx + 10 + i * 28, groundY - 56, 16, 14); }
  }
}

function drawWorld() {
  const { W, H, t } = view;
  const PPM = CFG.ppm;
  const top = viewTop(), cx = W / 2, sw = shaftW();
  const rows = Math.ceil(H / PPM) + 2, m0 = Math.floor(top);
  const gy = yOf(0);
  if (gy > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#6fb7e8'); g.addColorStop(1, '#cfe9f7');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, gy + 10);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 + t * 12) % (W + 200)) - 100;
      ctx.beginPath(); ctx.ellipse(x, gy * 0.3 + i * 14, 46, 14, 0, 0, 7); ctx.fill();
    }
  }
  for (let i = 0; i < rows; i++) {
    const m = m0 + i; if (m < 0) continue;
    const y = yOf(m), L = materialAt(m);
    ctx.fillStyle = rgb(L.wall, 0.9 + hash(m) * 0.2); ctx.fillRect(-10, y, W + 20, PPM + 1);
    if (hash(m * 3.1) < 0.5) { ctx.fillStyle = rgb(L.wall, 0.75); ctx.fillRect(hash(m * 5.7) * W, y, 6 + hash(m) * 20, 3); }
    if (m >= CFG.face.redFleckDepth && hash(m * 8.1) < 0.4) { ctx.fillStyle = 'rgba(110,14,12,.7)'; ctx.fillRect(hash(m * 2.9) * W, y + 4, 3, 2); }
  }
  if (gy > -20 && gy < H) { ctx.fillStyle = '#4f8a3a'; ctx.fillRect(-10, gy - 6, W + 20, 10); }
  // shaft interior down to the face
  const sTop = Math.max(-10, gy), sBot = faceOrigin().y;
  if (sBot > sTop) {
    for (let i = 0; i < rows; i++) {
      const m = m0 + i; if (m < 0 || m >= view.camDepth) continue;
      const y = yOf(m);
      ctx.fillStyle = rgb(materialAt(m).wall, 0.4 + hash(m) * 0.06);
      ctx.fillRect(cx - sw / 2, y, sw, Math.min(PPM + 1, sBot - y));
    }
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(cx - sw / 2, sTop, 8, sBot - sTop); ctx.fillRect(cx + sw / 2 - 8, sTop, 8, sBot - sTop);
    // depth: the shaft darkens upward, and the work light pools on the face so the action is the focus
    const L = CFG.light;
    const gd = ctx.createLinearGradient(0, sBot - H * L.fadeSpan, 0, sBot);
    gd.addColorStop(0, `rgba(0,0,0,${L.shaftDark})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gd; ctx.fillRect(cx - sw / 2, sTop, sw, sBot - sTop);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, sBot - 6, 0, cx, sBot - 6, sw * L.radius);
    gl.addColorStop(0, `rgba(255,196,120,${L.glow})`); gl.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = gl; ctx.fillRect(cx - sw / 2, sBot - sw * L.radius, sw, sw * L.radius);
    ctx.restore();
    ctx.strokeStyle = 'rgba(210,180,120,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - sw / 2 + 16, sTop); ctx.lineTo(cx - sw / 2 + 16, sBot - 30); ctx.stroke();
    ctx.font = `600 12px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    const stepM = S.depth > 80 ? 25 : 10;
    for (let m = Math.ceil(Math.max(0, top) / stepM) * stepM; m < Math.min(view.camDepth, top + rows); m += stepM) {
      const y = yOf(m);
      ctx.fillRect(cx + sw / 2 - 24, y, 16, 2); ctx.fillText(fmt(m) + ' m', cx + sw / 2 + 6, y + 4);
    }
  }
  FINDS.forEach((f, i) => {
    const y = yOf(f.d); if (y < -120 || y > H + 120) return;
    const x = cx + f.side * (sw / 2 + 80);
    if (i < S.found) drawFind(f, x, y, 1);
    else if (i === S.found && f.d - S.depth < CFG.findTeaseM) {
      drawFind(f, x, y, 0.12 + 0.06 * Math.sin(t * 3));
      ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('Something is down here…', x, y - 40);
    }
  });
  if (gy > -200) drawBase(cx + sw / 2, gy - 4);
}

// ---------- HUD overlays ----------
function drawGauge() {
  const { W, H } = view;
  const gx = W - 22, gt = 20, gh = H - 40;
  for (let i = 0; i < MATERIALS.length; i++) {
    const a = MATERIALS[i].from, b = i + 1 < MATERIALS.length ? MATERIALS[i + 1].from : MAX_DEPTH;
    ctx.fillStyle = rgb(MATERIALS[i].wall, 1.1);
    ctx.fillRect(gx, gt + (a / MAX_DEPTH) * gh, 8, ((b - a) / MAX_DEPTH) * gh + 1);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(gx - 5, gt + (S.depth / MAX_DEPTH) * gh - 1, 18, 3);
  ctx.font = `700 11px ${FONT_UI}`; ctx.textAlign = 'right';
  FINDS.forEach((f, i) => {
    ctx.fillStyle = i < S.found ? '#ffcf3a' : 'rgba(255,255,255,.75)';
    ctx.fillText(i < S.found ? '★' : '?', gx - 5, gt + (f.d / MAX_DEPTH) * gh + 4);
  });
}

function drawOverlays() {
  const { W, H, t } = view;
  const b = FX.banner;
  if (b) {
    ctx.globalAlpha = Math.min(1, b.t * 3, Math.max(0, CFG.bannerSecs - b.t));
    ctx.textAlign = 'center'; ctx.font = `34px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(b.s, W / 2 + 2, 72);
    ctx.fillStyle = '#ffcf3a'; ctx.fillText(b.s, W / 2, 70);
    ctx.font = `500 15px ${FONT_UI}`; ctx.fillStyle = '#fff'; ctx.fillText(b.sub, W / 2, 96);
    ctx.globalAlpha = 1;
  }
  if (S.clicks < 3 && !view.hideDigHint) {
    ctx.textAlign = 'center'; ctx.font = `700 18px ${FONT_UI}`; ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4);
    ctx.fillText('Click the rock to dig', W / 2, faceY() + 90);
    ctx.globalAlpha = 1;
  }
  if (S.depth >= MAX_DEPTH) {
    ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT_UI}`; ctx.fillStyle = 'rgba(255,190,180,.9)';
    ctx.fillText('300 m. The slice ends here, for now.', W / 2, H - 38);
  }
  if (view.scrollOff < 0) {
    ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT_UI}`; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('Viewing the shaft. Click to jump back to the bottom', W / 2, H - 16);
  }
}

export function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#191c20'; ctx.fillRect(0, 0, view.W, view.H);
  ctx.save();
  ctx.translate(FX.cam.x, FX.cam.y);
  drawWorld();
  drawFaceAndCrew();
  drawWorldFx(ctx);
  drawPopups(ctx);
  ctx.restore();
  drawGauge();
  drawOverlays();
}
