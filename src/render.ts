// Draws the world, the destructible dig face, miner/crew, FX and HUD overlays. Reads state; never mutates sim.
import { CFG, FINDS, MATERIALS, MAX_DEPTH, TOOLS, type Find } from './config';
import { S } from './state';
import { cartCapacity, mixPick, tierOf } from './economy';
import { materialAt, rubbleRGB } from './geo';
import { drawSurface, flushGlows } from './yard';
import { bubble, drawPile, pileHeight, pileLabel } from './draw';
import { cartBlocked, cartDepth, cartFill } from './cart';
import { CREW_LOOKS, PLAYER_LOOK, drawExcavator, drawExcavatorLight, drawLampBeam, drawMiner, type Look } from './characters';
import { face, type Chunk, type Crack, type Mark } from './digface';
import { workers } from './sim';
import { miner, minerSwingAngle, swingAngle } from './miner';
import { FX, drawPopups, drawWorldFx } from './fx';
import { applyZoom, cartScreen, ctx, faceOrigin, faceScale, faceY, shaftCX, shaftW, toScreen, view, viewTop, yOf } from './view';
import { drawGeology } from './geo';
import { drawGround, drawLandscape, drawSurfaceGrade } from './landscape';
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
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const k of c.cracks) {
    if (k.style === 'deep') {
      ctx.strokeStyle = 'rgba(90,110,210,.22)';
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
    // damage cracks belong to the working face only: they fade out before the face blends into untouched ground
    ctx.beginPath(); ctx.rect(b.x0 - 4, b.y0 - 8, b.x1 - b.x0 + 8, F.height * F.crackDepthFrac + 8); ctx.clip();
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

// ---------- figures (art lives in characters.ts) ----------
function workerAngle(timer: number, since: number) {
  return timer < IMPACT_AT ? swingAngle(IMPACT_AT - timer) : swingAngle(IMPACT_AT + since);
}
/** 0..1 swing progress for machines (0 raised, 1 at impact), derived from the same timing as the miners. */
const machineK = (timer: number, since: number) => Math.max(0, Math.min(1, (workerAngle(timer, since) + 0.5) / 1.55));

/** Owned diggers beyond the visible few: a quiet row of helmets on the shaft wall. */
function drawReserve() {
  const extra = S.crew.dig - workers.filter((w) => w.id === 'dig').length;
  if (extra <= 0) return;
  const n = Math.min(extra, CFG.reserveHelmetsMax);
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#d6b24a'; ctx.beginPath(); ctx.arc(10 + i * 8, -70, 3.4, Math.PI, 0); ctx.fill();
  }
  ctx.font = `700 9px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e8dcc0';
  ctx.fillText(`+${extra} crew`, 10 + n * 8, -68);
  ctx.restore();
}

function drawFaceAndCrew() {
  const o = faceOrigin(), s = faceScale();
  if (o.y < view.vy0 - 200 || o.y > view.vy1 + 200) return;
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(s, s);
  drawFace(s);
  // rubble waiting at the dig site, coloured by what it is, with its count right on the pile
  drawPile(C.pileX, 0, S.rubble, CFG.rubble.pileVisualMax, 1, 17);
  if (S.rubble.qty >= 1) pileLabel(C.pileX, -pileHeight(S.rubble.qty, CFG.rubble.pileVisualMax, 1) - 5, Math.floor(S.rubble.qty), 10, S.rubble.qty > CFG.rubble.pileVisualMax);
  let di = 0;
  const ropeTop = -(o.y - view.vy0 + 30) / s;
  for (const w of workers) {
    if (w.arrive > 0) { drawArrival(w.x, w.dir, 1 - w.arrive / CFG.crewArriveSecs, ropeTop, CREW_LOOKS[di++ % CREW_LOOKS.length]); continue; }
    if (w.id === 'exc') drawExcavator(w.x, w.dir, machineK(w.timer, w.since), CFG.excavatorReach, w.since < 0.4 ? Math.sin(w.since * 25) * (0.4 - w.since) * 2.5 : 0);
    else drawMiner(w.x, w.dir, workerAngle(w.timer, w.since), TOOLS[0], CREW_LOOKS[di++ % CREW_LOOKS.length], CFG.crewScale, false);
  }
  drawReserve();
  drawMiner(miner.x, miner.dir, minerSwingAngle(), TOOLS[S.tool], PLAYER_LOOK, CFG.playerScale, true);
  // underground light: the deeper, the darker — helmet lamps carve out the work area
  const dark = Math.min(CFG.light.maxDark, S.depth / CFG.light.darkAtM * CFG.light.maxDark);
  if (dark > 0.01) {
    // only inside the shaft (never over the sky), fading out through the face band into the ground
    const top = -(o.y - Math.max(view.vy0, yOf(0))) / s, bot = CFG.face.height * 0.75;
    const g = ctx.createLinearGradient(0, bot - 18, 0, bot);
    g.addColorStop(0, `rgba(4,4,10,${dark})`); g.addColorStop(1, 'rgba(4,4,10,0)');
    ctx.fillStyle = `rgba(4,4,10,${dark})`; ctx.fillRect(0, top, CFG.face.logicalW, bot - 18 - top);
    ctx.fillStyle = g; ctx.fillRect(0, bot - 18, CFG.face.logicalW, 18);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const boost = 1 + dark * 1.4;
  for (const w of workers) {
    if (w.arrive > 0.15 * CFG.crewArriveSecs) continue;
    if (w.id === 'exc') drawExcavatorLight(w.x, w.dir, 0.12 * boost);
    else drawLampBeam(w.x, w.dir, CFG.crewScale, 0.1 * boost, CFG.miner.reach);
  }
  drawLampBeam(miner.x, miner.dir, CFG.playerScale, 0.2 * boost, CFG.miner.reach);
  ctx.restore();
  ctx.restore();
}

/** Rope drops from above, the digger slides down it, lands, the lamp clicks on (then normal digging resumes). */
function drawArrival(x: number, dir: number, p: number, ropeTop: number, look: Look) {
  const ropeIn = Math.min(1, p / 0.25);
  ctx.strokeStyle = 'rgba(210,180,120,.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + 4, ropeTop); ctx.lineTo(x + 4, ropeTop + (0 - ropeTop) * ropeIn); ctx.stroke();
  if (p < 0.25) return;
  const slide = Math.min(1, (p - 0.25) / 0.5), ease = slide * slide;
  ctx.save(); ctx.translate(0, ropeTop * (1 - ease));
  drawMiner(x, dir, -1.6, TOOLS[0], look, CFG.crewScale, false, p > 0.85);
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

// ---------- transport: rails, cart, piles, headframe ----------
const C = CFG.cart;
const RAIL_STYLES = [
  { rail: '#7a5634', w: 2.2, tie: '#4e3620', tieW: 2.4, plate: '', bracket: '' }, // rough wooden track
  { rail: '#5e4127', w: 3, tie: '#3e2a17', tieW: 3, plate: '#8a9198', bracket: '' }, // reinforced wood
  { rail: '#a3acb6', w: 2.4, tie: '#4e3620', tieW: 2.6, plate: '', bracket: '' }, // metal rail
  { rail: '#c4ccd4', w: 3.6, tie: '#3b3f45', tieW: 3.2, plate: '', bracket: '#e0b322' }, // heavy industrial
];

/** Rails along the transport wall from the headframe to the dig face; ties are anchored in world metres.
 *  Major tiers change the material; EVERY Rail Quality level visibly changes something (thickness, sleeper
 *  spacing, bolts, brackets, cross bracing, side braces, lamps, hazard paint, guard rails). */
export const railCableW = () => 1.1 + 0.12 * S.upg.rail;
function drawRails(yTop: number, yBot: number) {
  const L = S.upg.rail, st = RAIL_STYLES[tierOf(L, C.railTiers)];
  const s = faceScale(), x = toScreen(C.railX, 0).x, half = 6 * s;
  const top = Math.max(view.vy0 - 20, yTop), bot = Math.min(view.vy1 + 20, yBot);
  if (bot <= top) return;
  const railW = st.w + 0.18 * L, tieStep = Math.max(0.45, 1.15 - 0.06 * L); // metres between sleepers
  const mTop = viewTop() + view.vy0 / CFG.ppm, mBot = viewTop() + view.vy1 / CFG.ppm;
  ctx.lineCap = 'butt';
  // side braces (Lv 5+): timber/steel uprights tying the track to the wall
  if (L >= 5) {
    ctx.fillStyle = L >= 7 ? '#59616a' : '#4a3420';
    ctx.fillRect(x + half + 4 * s, top, 2.2 + 0.1 * L, bot - top);
  }
  for (let i = Math.floor(mTop / tieStep); i * tieStep <= mBot; i++) {
    const m = i * tieStep, y = yOf(m) + (st === RAIL_STYLES[0] ? (hash(i * 1.7) - 0.5) * 3 : 0);
    if (y < top || y > bot) continue;
    ctx.strokeStyle = st.tie; ctx.lineWidth = st.tieW + 0.05 * L;
    ctx.beginPath(); ctx.moveTo(x - half - 3, y); ctx.lineTo(x + half + 3, y); ctx.stroke();
    if (L >= 1) { // bolts on every sleeper
      ctx.fillStyle = L >= 4 ? '#d6dde4' : '#b4bcc4';
      ctx.fillRect(x - half - 2, y - 1.5, 3, 3); ctx.fillRect(x + half - 1, y - 1.5, 3, 3);
    }
    if (st.plate && i % 3 === 0) { ctx.fillStyle = st.plate; ctx.fillRect(x - half - 2, y - 2, 4, 4); ctx.fillRect(x + half - 2, y - 2, 4, 4); }
  }
  // per-metre structure: brackets (Lv 3+), cross bracing (Lv 4+), hazard paint (Lv 9+)
  for (let m = Math.max(0, Math.floor(mTop)); m <= mBot; m++) {
    const y = yOf(m);
    if (y < top || y > bot) continue;
    if ((L >= 3 || st.bracket) && m % 4 === 0) { ctx.fillStyle = st.bracket || '#7d858f'; ctx.fillRect(x + half + 2, y - 3, 5 * s * 0.6, 6); }
    if (L >= 4 && m % 3 === 0) {
      ctx.strokeStyle = 'rgba(160,170,180,.45)'; ctx.lineWidth = 1;
      const y2 = yOf(m + 3);
      ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y2); ctx.moveTo(x + half, y); ctx.lineTo(x - half, y2); ctx.stroke();
    }
    if (L >= 9 && m % 2 === 0) { ctx.fillStyle = m % 4 ? '#1d1d1d' : '#e0b322'; ctx.fillRect(x - half - railW / 2, y, railW, 6); }
  }
  ctx.strokeStyle = shadeHex(st.rail, 0.9 + Math.min(0.35, 0.03 * L)); ctx.lineWidth = railW;
  ctx.beginPath(); ctx.moveTo(x - half, top); ctx.lineTo(x - half, bot); ctx.moveTo(x + half, top); ctx.lineTo(x + half, bot); ctx.stroke();
  if (railW > 2.3) { // highlight edge on metal rails
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - half + 1, top); ctx.lineTo(x - half + 1, bot); ctx.moveTo(x + half + 1, top); ctx.lineTo(x + half + 1, bot); ctx.stroke();
  }
  if (L >= 12) { // guard rail on the shaft side
    ctx.strokeStyle = '#e0b322'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - half - 9 * s * 0.6, top); ctx.lineTo(x - half - 9 * s * 0.6, bot); ctx.stroke();
  }
  // shaft lamps (Lv 6+): warm lights on the wall, closer together every level
  if (L >= 6) {
    const every = Math.max(3, 12 - (L - 6));
    ctx.save();
    for (let m = Math.ceil(Math.max(0, mTop) / every) * every; m <= mBot; m += every) {
      const y = yOf(m);
      if (y < top || y > bot) continue;
      ctx.fillStyle = '#3b3f45'; ctx.fillRect(x + half + 6, y - 2, 6, 4);
      ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x + half + 9, y - 1.5, 3, 3);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x + half + 10, y, 0, x + half + 10, y, 46);
      g.addColorStop(0, 'rgba(255,210,140,.22)'); g.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + half + 10, y, 46, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

function shadeHex(c: string, k: number) {
  const n = parseInt(c.slice(1), 16);
  return `rgb(${Math.min(255, Math.round(((n >> 16) & 255) * k))},${Math.min(255, Math.round(((n >> 8) & 255) * k))},${Math.min(255, Math.round((n & 255) * k))})`;
}

const CART_BODIES = [
  { w: 24, h: 13, body: '#8a5a3a', band: '#5b3a22', rim: '#a9764f', wheel: 3.2 }, // tiny rusty hand cart
  { w: 28, h: 15, body: '#7a5233', band: '#3d3d3d', rim: '#9a6c45', wheel: 3.6 }, // reinforced
  { w: 32, h: 17, body: '#6f7780', band: '#4b5157', rim: '#9aa3ad', wheel: 4 }, // metal mining cart
  { w: 36, h: 19, body: '#d9a520', band: '#2c2f33', rim: '#f2c64a', wheel: 4.4 }, // heavy industrial
];

/** The cart in screen space, base centred at (x, y). */
function drawCartAt(x: number, y: number, s: number, fill: number, tip: number, roll: number) {
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  const w = b.w * s, h = b.h * s, r = b.wheel * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.translate(w / 2, -r); ctx.rotate(tip); ctx.translate(-w / 2, r); // tips over its right wheel, toward the stockpile
  // load: rocks heap up over the rim as it fills
  if (fill > 0.001) {
    const n = Math.max(2, Math.round(fill * 14));
    const mound = Math.max(0, fill - 0.35) * h * 0.75;
    for (let i = 0; i < n; i++) {
      const k = hash(31 + i * 7.3), px = -w / 2 + 3 * s + (w - 6 * s) * k;
      const py = -r - h + 3 * s + (1 - fill) * h * 0.55 - mound * Math.sin(Math.PI * k) * (0.6 + 0.4 * hash(i * 3.1));
      ctx.fillStyle = rgb(rubbleRGB(mixPick(S.cart.load, hash(i * 2.9))), 0.8 + hash(i * 5.3) * 0.45);
      ctx.beginPath(); ctx.ellipse(px, py, (2.2 + hash(i) * 1.6) * s, (1.8 + hash(i * 2) * 1.2) * s, 0, 0, 6.283); ctx.fill();
    }
  }
  // body (slightly tapered tub)
  ctx.fillStyle = b.body;
  ctx.beginPath(); ctx.moveTo(-w / 2, -r - h); ctx.lineTo(w / 2, -r - h); ctx.lineTo(w / 2 - 2.5 * s, -r); ctx.lineTo(-w / 2 + 2.5 * s, -r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b.band; ctx.fillRect(-w / 2 + 1.5 * s, -r - h * 0.55, w - 3 * s, 2 * s);
  ctx.fillStyle = b.rim; ctx.fillRect(-w / 2 - 1 * s, -r - h - 1.5 * s, w + 2 * s, 2.2 * s);
  if (b === CART_BODIES[2] || b === CART_BODIES[3]) { // rivets
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + (4 + i * (w / s - 8) / 3) * s - 1, -r - h * 0.3, 2, 2);
  }
  // wheels with turning spokes
  for (const wx of [-w / 2 + r + 1.5 * s, w / 2 - r - 1.5 * s]) {
    ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(wx, -r, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#777'; ctx.lineWidth = Math.max(1, 0.8 * s);
    ctx.beginPath(); ctx.moveTo(wx + Math.cos(roll) * r * 0.8, -r + Math.sin(roll) * r * 0.8); ctx.lineTo(wx - Math.cos(roll) * r * 0.8, -r - Math.sin(roll) * r * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function drawCart() {
  const s = faceScale(), c = cartScreen(), st = S.cart.state, cs = S.cart;
  if (c.y < -80 || c.y > view.H + 80) { view.cartRect = null; return; }
  let tip = 0, bump = 0;
  if (st === 'SURFACE_ARRIVAL') bump = Math.sin(Math.min(1, cs.t / cs.dur) * Math.PI) * 3 * s;
  if (st === 'UNLOADING') {
    const p = Math.min(1, cs.t / cs.dur);
    tip = 0.95 * (p < 0.75 ? Math.sin(Math.min(1, p / 0.3) * Math.PI / 2) : (1 - p) / 0.25);
  }
  const roll = cartDepth() * 1.6;
  // cable from the headframe pulley to the cart
  const pulleyY = yOf(-C.headframeM);
  ctx.strokeStyle = 'rgba(40,36,30,.8)'; ctx.lineWidth = railCableW();
  ctx.beginPath(); ctx.moveTo(c.x, Math.max(view.vy0 - 10, pulleyY)); ctx.lineTo(c.x, c.y - 22 * s + bump); ctx.stroke();
  drawCartAt(c.x, c.y + bump, s, cartFill(), tip, roll);
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  view.cartRect = { x: c.x - (b.w / 2 + 6) * s, y: c.y - (b.h + b.wheel * 2 + 12) * s, w: (b.w + 12) * s, h: (b.h + b.wheel * 2 + 16) * s };
  // "tap to send" hint while it holds something but is not yet full
  if ((st === 'LOADING' || st === 'BOTTOM_EMPTY') && cs.load.qty > 0.5) {
    const cap = cartCapacity(S);
    ctx.font = `700 ${Math.round(9 * s)}px ${FONT_UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText(`${Math.floor(cs.load.qty)}/${cap}`, c.x, c.y - (b.h + b.wheel * 2 + 6) * s);
  }
  if (cartBlocked()) bubble(c.x - 30, c.y - (b.h + b.wheel * 2 + 14) * s, 'STORAGE FULL', '#ff9a7a');
}


function drawWorld() {
  const { H, t } = view;
  const PPM = CFG.ppm;
  const top = viewTop(), cx = shaftCX(), sw = shaftW();
  const X0 = view.vx0 - 10, XW = view.vx1 - view.vx0 + 20;
  const gy = yOf(0);
  // sky + surface landscape (only when the ground line is in view)
  if (gy > view.vy0) drawLandscape(gy, X0, XW);
  // painted, deterministic geology
  drawGeology(ctx, cx, yOf, Math.max(0, top + view.vy0 / PPM), top + view.vy1 / PPM, view.vx0, view.vx1);
  if (gy > view.vy0 - 20 && gy < view.vy1) drawGround(gy, X0, XW);
  // shaft interior: the same rock, in shadow, down to the face
  const sTop = Math.max(view.vy0, gy), sBot = faceOrigin().y;
  if (sBot > sTop) {
    ctx.fillStyle = 'rgba(12,8,6,.62)';
    ctx.fillRect(cx - sw / 2, sTop, sw, sBot - sTop);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(cx - sw / 2, sTop, 10, sBot - sTop); ctx.fillRect(cx + sw / 2 - 10, sTop, 10, sBot - sTop);
    // depth: the shaft darkens upward, and the work light pools on the face so the action is the focus
    const L = CFG.light;
    const gd = ctx.createLinearGradient(0, sBot - H * L.fadeSpan, 0, sBot);
    gd.addColorStop(0, `rgba(0,0,0,${L.shaftDark})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gd; ctx.fillRect(cx - sw / 2, sTop, sw, sBot - sTop);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, sBot - 6, 0, cx, sBot - 6, sw * L.radius);
    gl.addColorStop(0, `rgba(255,196,120,${L.glow})`); gl.addColorStop(1, 'rgba(255,196,120,0)');
    const gTop = Math.max(sTop, sBot - sw * L.radius); // never leak above ground into the sky
    ctx.fillStyle = gl; ctx.fillRect(cx - sw / 2, gTop, sw, sBot - gTop);
    ctx.restore();
    ctx.font = `600 12px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    const stepM = S.depth > 80 ? 25 : 10;
    const mEnd = Math.min(view.camDepth, top + view.vy1 / PPM);
    for (let m = Math.max(stepM, Math.ceil(Math.max(0, top + view.vy0 / PPM) / stepM) * stepM); m < mEnd; m += stepM) {
      const y = yOf(m);
      ctx.fillRect(cx + sw / 2 - 24, y, 16, 2); ctx.fillText(fmt(m) + ' m', cx + sw / 2 + 6, y + 4);
    }
  }
  FINDS.forEach((f, i) => {
    const y = yOf(f.d); if (y < view.vy0 - 120 || y > view.vy1 + 120) return;
    const x = cx + f.side * (sw / 2 + 55);
    if (i < S.found) drawFind(f, x, y, 1);
    else if (i === S.found && f.d - S.depth < CFG.findTeaseM) {
      drawFind(f, x, y, 0.12 + 0.06 * Math.sin(t * 3));
      ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('Something is down here…', x, y - 40);
    }
  });
  drawRails(yOf(-C.surfaceLiftM - 1.5), faceOrigin().y + 2);
  drawSurface(gy);
}

/** Night/sunset grade over the surface, then the practical lights (yard lamps, headframe, headlights). */
function drawSurfaceLight() {
  const gy = yOf(0);
  if (gy > view.vy0 - 50) drawSurfaceGrade(gy, view.vx0 - 10, view.vx1 - view.vx0 + 20);
  flushGlows();
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
  // the cart's live position on its journey
  const cd = Math.max(0, cartDepth());
  ctx.fillStyle = '#ffcf3a'; ctx.fillRect(gx - 9, gt + (cd / MAX_DEPTH) * gh - 3, 6, 6);
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
    ctx.fillText('300 m: digging deeper arrives in a later build.', W / 2, H - 38);
  }

}

export function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#191c20'; ctx.fillRect(0, 0, view.W, view.H);
  ctx.save();
  ctx.translate(FX.cam.x, FX.cam.y);
  applyZoom(ctx);
  drawWorld();
  drawFaceAndCrew();
  drawCart();
  drawSurfaceLight();
  drawWorldFx(ctx);
  drawPopups(ctx);
  ctx.restore();
  drawGauge();
  drawOverlays();
}
