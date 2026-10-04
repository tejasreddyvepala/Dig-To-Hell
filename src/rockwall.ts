// MINE ROCK WALLS + SHAFT FRAMING (Visual Pass 2). Visual only: the logical shaft (cx ± sw/2) is unchanged; this
// draws excavated rock AROUND it so the shaft reads as cut through a rock mass instead of a rectangle.
//   Layers (back to front): outer rock mass (low contrast) → recessed interior silhouette (dark, organic) → inner cut
//   shadow → chunky faceted edge rocks → structural timber sets → collar at the surface.
// Everything is deterministic from world depth (hash per segment), so scrolling shows the same wall every time.
// Rock shapes are built once as Path2D (cached by seed + size); per frame we only place and fill them.
import { CFG, type RGB } from './config';
import { materialAt } from './geo';
import { hash, rgb } from './util';
import { ctx, view, viewTop, yOf } from './view';
import { PAL, beam, post, contactShadow } from './art';

// ---------- faceted rock shapes (cached) ----------
interface RockShape { body: Path2D; lit: Path2D; dark: Path2D; crev: Path2D; rim: Path2D }
const shapes = new Map<string, RockShape>();

/** A chunky low-poly rock centred at 0,0: body + lit facet (upper-left) + shadow facet (lower-right) + crevice line
 *  along the shadow side + a thin rim on the lit side. Some edges get no line at all (the wall reads as one mass). */
export function rockShape(seed: number, rx: number, ry: number): RockShape {
  const key = `${seed}|${Math.round(rx * 2)}|${Math.round(ry * 2)}`;
  let s = shapes.get(key);
  if (s) return s;
  if (shapes.size > 600) shapes.clear();
  const n = 5 + Math.floor(hash(seed * 1.31) * 3);
  const pts: [number, number][] = [];
  // start at the left and go clockwise (canvas y is down): left → top → right → bottom
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.9 + (i + (hash(seed + i * 4.7) - 0.5) * 0.5) / n * Math.PI * 2;
    const r = 0.74 + hash(seed * 2.3 + i * 1.9) * 0.26;
    pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
  }
  const poly = (p: Path2D, list: [number, number][], close = true) => {
    list.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    if (close) p.closePath();
    return p;
  };
  const litEnd = Math.max(2, Math.round(n * 0.42)), darkA = Math.round(n * 0.5), darkB = Math.min(n, Math.round(n * 0.9) + 1);
  const litPts = pts.slice(0, litEnd + 1), darkPts = pts.slice(darkA, darkB);
  s = {
    body: poly(new Path2D(), pts),
    lit: poly(new Path2D(), [[-rx * 0.12, -ry * 0.16], ...litPts]),
    dark: poly(new Path2D(), [[rx * 0.14, ry * 0.12], ...darkPts]),
    crev: poly(new Path2D(), darkPts.length > 1 ? darkPts : pts.slice(darkA - 1, darkA + 1), false),
    rim: poly(new Path2D(), litPts.slice(1, -1).length > 1 ? litPts.slice(1, -1) : litPts, false),
  };
  shapes.set(key, s);
  return s;
}

interface Tone { base: string; light: string; shadow: string; deep: string; rim: string }
const tones = new Map<string, Tone>();
const ROCK: RGB = [94, 83, 74];
/** Rock colours at depth m: the shared rock family tinted toward the local geology (so walls follow the layers). */
/** mode: 0 = edge rock, 1 = freshly exposed (near the dig face), 2 = back row (deeper in the wall, lower contrast). */
export function toneAt(m: number, variant: number, mode = 0): Tone {
  const mat = materialAt(Math.max(0, m));
  const key = `${mat.id}|${variant}|${mode}`;
  let t = tones.get(key);
  if (t) return t;
  const v = [0.8, 0.9, 1][variant] * (mode === 1 ? 1.1 : mode === 2 ? 0.72 : 0.92);
  const c: RGB = [0, 1, 2].map((i) => (ROCK[i] * 0.4 + mat.wall[i] * 0.6) * v) as RGB;
  const lk = mode === 2 ? 1.14 : 1.24;
  t = { base: rgb(c, 1), light: rgb(c, lk), shadow: rgb(c, mode === 2 ? 0.8 : 0.68), deep: rgb(c, 0.36), rim: rgb(c, mode === 1 ? 1.6 : 1.42) };
  tones.set(key, t);
  return t;
}

/** Fill one cached rock at (x, y) in the current transform. `lw` = crevice width in current units. */
export function drawRock(r: RockShape, x: number, y: number, t: Tone, lw: number, c: CanvasRenderingContext2D = ctx) {
  c.save(); c.translate(x, y);
  c.fillStyle = t.base; c.fill(r.body);
  c.fillStyle = t.light; c.fill(r.lit);
  c.fillStyle = t.shadow; c.fill(r.dark);
  c.lineJoin = 'round';
  c.strokeStyle = t.deep; c.lineWidth = lw; c.stroke(r.crev);
  c.strokeStyle = t.rim; c.lineWidth = lw * 0.5; c.globalAlpha *= 0.55; c.stroke(r.rim);
  c.restore();
}

// ---------- shaft wall geometry (world-anchored) ----------
const SEG = 4; // m per wall segment
type Zone = 'solid' | 'fractured' | 'recessed';
const zoneOf = (j: number, side: number): Zone => {
  const z = hash(Math.floor(j / 4) * 7.7 + side * 3.1);
  return z < 0.34 ? 'fractured' : z < 0.67 ? 'solid' : 'recessed';
};
/** How far (logical units) the dark interior is cut back into the rock at vertex i (one vertex per 2 m). */
function recessAt(i: number, side: number) {
  const z = zoneOf(Math.floor(i / 2), side);
  const h = hash(i * 5.13 + side * 17.7);
  return z === 'recessed' ? 10 + h * 22 : z === 'solid' ? h * 7 : 3 + h * 13;
}

export interface ShaftGeom { cx: number; sw: number; k: number; sTop: number; sBot: number; floorM: number; wallBot: number }

/** x of the interior silhouette on `side` at vertex i (screen). */
const edgeX = (g: ShaftGeom, side: number, i: number) => g.cx + side * (g.sw / 2 + recessAt(i, side) * g.k);

/** Path of the organic shaft interior (clip region for the interior fills). */
export function interiorPath(g: ShaftGeom) {
  const i0 = Math.floor((viewM(g.sTop)) / 2) - 1, i1 = Math.ceil(viewM(g.sBot) / 2) + 1;
  const yAt = (i: number) => Math.min(g.sBot, Math.max(g.sTop, yOf(i * 2)));
  ctx.beginPath();
  ctx.moveTo(g.cx - g.sw / 2, g.sTop);
  for (let i = Math.max(0, i0); i <= i1; i++) ctx.lineTo(i === 0 ? g.cx - g.sw / 2 : edgeX(g, -1, i), yAt(i));
  ctx.lineTo(g.cx - g.sw / 2, g.sBot); ctx.lineTo(g.cx + g.sw / 2, g.sBot);
  for (let i = i1; i >= Math.max(0, i0); i--) ctx.lineTo(i === 0 ? g.cx + g.sw / 2 : edgeX(g, 1, i), yAt(i));
  ctx.lineTo(g.cx + g.sw / 2, g.sTop); ctx.closePath();
}
const viewM = (y: number) => y / CFG.ppm + viewTop(); // screen y -> world metres

/** Layer A: the outer rock mass hugging the shaft, darker than the open earth, irregular big lobes. */
export function drawRockMass(g: ShaftGeom) {
  const j0 = Math.max(0, Math.floor(viewM(g.sTop) / SEG) - 1), j1 = Math.ceil(viewM(g.wallBot) / SEG) + 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(g.cx + side * g.sw / 2, Math.max(g.sTop, yOf(0) + 8));
    for (let j = j0; j <= j1; j++) {
      const w = (34 + hash(j * 3.7 + side * 9.1) * 46) * g.k;
      ctx.lineTo(g.cx + side * (g.sw / 2 + w), Math.max(g.sTop, yOf(j * SEG + 1.2 * hash(j + side))));
    }
    ctx.lineTo(g.cx + side * g.sw / 2, yOf(j1 * SEG));
    ctx.closePath();
    ctx.fillStyle = 'rgba(28,20,14,.26)'; ctx.fill();
  }
}

/** Inside the clip: quiet rear-wall forms + slow vertical tonal bands + the inner cut shadow along the silhouette. */
export function drawRearWall(g: ShaftGeom) {
  const j0 = Math.max(0, Math.floor(viewM(g.sTop) / 9) - 1), j1 = Math.ceil(viewM(g.sBot) / 9) + 1;
  for (let j = j0; j <= j1; j++) {
    const y = yOf(j * 9);
    ctx.fillStyle = j % 2 ? 'rgba(0,0,0,.07)' : 'rgba(255,220,180,.018)';
    ctx.fillRect(g.cx - g.sw / 2 - 40 * g.k, y, g.sw + 80 * g.k, 9 * CFG.ppm);
    // one or two big, barely-there rock forms on the rear wall
    for (let q = 0; q < 2; q++) {
      if (hash(j * 4.1 + q * 13) < 0.35) continue;
      const rx = (34 + hash(j * 2.2 + q) * 50) * g.k, ry = (18 + hash(j * 6.6 + q) * 22) * g.k;
      const x = g.cx + (hash(j * 9.3 + q * 5) - 0.5) * g.sw * 0.8, yy = y + hash(j * 1.9 + q * 7) * 9 * CFG.ppm;
      const r = rockShape(900 + j * 2 + q, rx, ry);
      ctx.save(); ctx.translate(x, yy);
      ctx.fillStyle = 'rgba(255,225,190,.028)'; ctx.fill(r.lit);
      ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fill(r.dark);
      ctx.restore();
    }
  }
}

/** Layer C: dark band where the rock turns inward (stroke the silhouette inside the clip). */
export function drawInnerCut(g: ShaftGeom) {
  interiorPath(g);
  ctx.strokeStyle = 'rgba(4,3,2,.55)'; ctx.lineWidth = 16 * g.k; ctx.stroke();
  ctx.strokeStyle = 'rgba(4,3,2,.35)'; ctx.lineWidth = 30 * g.k; ctx.stroke();
}

/** Layer B: chunky edge rocks — a low-contrast back row deeper in the wall, then the front row on the silhouette.
 *  Static wall is cached per side per 8 m tile (offscreen, built once per viewport size); only the strip near the
 *  dig face (fresh rock, rocks framing the face, a chamber ceiling cut) is drawn live, clipped so seams match. */
const TILE = 8; // m
const tiles = new Map<string, HTMLCanvasElement>();
const IN_W = 45, OUT_W = 165; // logical units the tile spans inward / outward of the logical edge

type Emit = (shape: RockShape, x: number, m: number, t: Tone, lw: number, crack: number) => void;
/** Every rock whose centre lies in [mFrom, mTo), in a fixed global order (so overlapping tiles agree). x is relative
 *  to the logical edge. `live` applies the floor-dependent rules (fresh rock near the face, framing below it). */
function rocksIn(g: ShaftGeom, side: number, mFrom: number, mTo: number, live: boolean, emit: Emit) {
  const k = g.k, faceM = (CFG.face.height * k) / CFG.ppm, wallBotM = viewM(g.wallBot);
  const j0 = Math.max(0, Math.floor(mFrom / SEG) - 1), j1 = Math.ceil(mTo / SEG) + 1;
  for (let j = j0; j <= j1; j++) { // back row
    const hs = j * 13.9 + side * 57, mC = j * SEG + hash(hs) * SEG;
    if (mC < 1 || mC < mFrom || mC >= mTo || (live && mC > wallBotM + 1)) continue;
    const rx = 22 + hash(hs * 2.1) * 16, ry = rx * (0.6 + hash(hs * 3.7) * 0.3);
    const out = recessAt(Math.round(mC / 2), side) + rx * 1.15 + 6;
    emit(rockShape(Math.floor(hs) + 5000, rx * k, ry * k), side * out * k, mC, toneAt(mC, Math.floor(hash(hs * 4.4) * 3), 2), 1.2 * k * 0.6, 0);
  }
  for (let j = j0; j <= j1; j++) { // front row
    const z = zoneOf(j, side), count = z === 'fractured' ? 2 : 1;
    for (let q = 0; q < count; q++) {
      const hs = j * 31.7 + q * 7.3 + side * 101;
      const mC = j * SEG + (q + 0.3 + hash(hs) * 0.6) * (SEG / count);
      if (mC < 0.6 || mC < mFrom || mC >= mTo) continue;
      const below = live && mC > g.floorM, nearFloor = live && !below && g.floorM - mC < 6;
      if (live && !below && mC > wallBotM + 0.5) continue; // chamber: the walls stop at its ceiling
      if (below && mC > g.floorM + faceM * 1.05) continue;
      const big = z === 'solid' ? 1.35 : z === 'fractured' ? 0.8 : 1.1;
      const rx = (14 + hash(hs * 1.7) * 12) * big * (nearFloor ? 0.8 : 1), ry = rx * (0.62 + hash(hs * 2.9) * 0.36);
      const R = recessAt(Math.round(mC / 2), side);
      const p = (nearFloor ? 0.55 : 0.2 + hash(hs * 3.3) * 0.35) * rx; // inward protrusion past the silhouette
      const out = below ? rx * 0.75 : R - p + rx;
      emit(rockShape(Math.floor(hs), rx * k, ry * k), side * out * k, mC, toneAt(mC, Math.floor(hash(hs * 5.1) * 3), nearFloor || below ? 1 : 0),
        1.6 * k * 0.6, z === 'fractured' && hash(hs * 8.8) > 0.5 ? side * rx * k : 0);
    }
  }
}

function drawItem(c: CanvasRenderingContext2D, shape: RockShape, x: number, y: number, t: Tone, lw: number, crack: number) {
  drawRock(shape, x, y, t, lw, c);
  if (crack) { // a thin dark crack below some fractured rocks (not every boundary: one geological mass)
    const r = Math.abs(crack), sd = Math.sign(crack);
    c.strokeStyle = 'rgba(10,6,4,.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x - sd * r * 0.2, y + r * 0.45); c.lineTo(x + sd * r * 0.6, y + r * 0.9); c.stroke();
  }
}

function tileCanvas(g: ShaftGeom, side: number, t: number, res: number) {
  const key = `${side}|${t}|${g.k.toFixed(3)}|${res}`;
  let cv = tiles.get(key);
  if (cv) return cv;
  if (tiles.size > 80) tiles.clear();
  cv = document.createElement('canvas');
  const wL = (IN_W + OUT_W) * g.k, hL = TILE * CFG.ppm;
  cv.width = Math.ceil(wL * res); cv.height = Math.ceil(hL * res);
  const c = cv.getContext('2d')!;
  const x0 = side > 0 ? -IN_W * g.k : -OUT_W * g.k; // tile-left in edge-relative x
  c.setTransform(res, 0, 0, res, -x0 * res, 0);
  rocksIn(g, side, t * TILE - 9, (t + 1) * TILE + 9, false, (sh, x, m, tone, lw, cr) => drawItem(c, sh, x, (m - t * TILE) * CFG.ppm, tone, lw, cr));
  tiles.set(key, cv);
  return cv;
}

export function drawEdgeRocks(g: ShaftGeom) {
  const k = g.k, res = Math.round(view.dpr * Math.max(1, view.zoom) * 4) / 4;
  const faceM = (CFG.face.height * k) / CFG.ppm;
  const cutM = Math.min(g.floorM - 6, viewM(g.wallBot)) - 9; // tiles fully above this never change
  const mTop = Math.max(0, viewM(view.vy0) - 1), mBot = viewM(view.vy1) + 1;
  for (const side of [-1, 1]) {
    const edge = g.cx + side * g.sw / 2;
    let liveFrom = Math.max(0, Math.floor(mTop / TILE) * TILE);
    for (let t = Math.floor(mTop / TILE); t * TILE < mBot; t++) {
      if ((t + 1) * TILE > cutM) break;
      const cv = tileCanvas(g, side, t, res);
      const x0 = side > 0 ? -IN_W * k : -OUT_W * k;
      ctx.drawImage(cv, edge + x0, yOf(t * TILE), cv.width / res, cv.height / res);
      liveFrom = (t + 1) * TILE;
    }
    if (liveFrom >= Math.min(mBot, g.floorM + faceM + 2)) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(edge - OUT_W * k, yOf(liveFrom), 2 * OUT_W * k, yOf(g.floorM + faceM + 4) - yOf(liveFrom)); ctx.clip();
    rocksIn(g, side, liveFrom - 9, g.floorM + faceM + 2, true, (sh, x, m, tone, lw, cr) => drawItem(ctx, sh, edge + x, yOf(m), tone, lw, cr));
    ctx.restore();
  }
}

// ---------- structural timber (world-anchored rhythm) ----------
const BAY = 8; // m
/** Timber sets along the shaft: every third bay a major set (posts on both walls + spreader beam + knee braces);
 *  some bays get a small reinforcement (lagging planks + a short post) on one wall; the rest is open rock.
 *  `clearM`: nothing below this depth on the LEFT wall (rest platform/stairs); spreaders stop above `spanM`. */
export function drawTimberSets(g: ShaftGeom, clearLeftM: number, spanM: number) {
  const k = g.k, j0 = Math.max(1, Math.floor(viewM(g.sTop) / BAY) - 1), j1 = Math.ceil(viewM(g.wallBot) / BAY);
  const PW = 7 * k, BH = 6 * k;
  for (let j = j0; j <= j1; j++) {
    const mBeam = j * BAY + 1.5, yB = yOf(mBeam), yFoot = yOf(mBeam + 6);
    if (yFoot < view.vy0 - 40 || yB > view.vy1 + 40 || mBeam + 6 > viewM(g.wallBot)) continue;
    // rhythm: a major set every third bay, open rock between (the ladder mounts are the small reinforcement)
    const kind = j % 3 === 0 ? 'major' : 'open';
    if (kind === 'open') continue;
    const sides = [-1, 1];
    for (const side of sides) {
      if (side < 0 && mBeam + 6 > clearLeftM) continue;
      const inner = g.cx + side * (g.sw / 2 - 2 * k); // the post stands just proud of the wall
      const w = PW, px = side < 0 ? inner : inner - w;
      // head block seated in a rock pocket, post, foot block on a rock ledge
      ctx.fillStyle = 'rgba(6,4,3,.55)'; ctx.fillRect(side < 0 ? px - 14 * k : px + w, yB - 1.5 * k, 14 * k, BH + 3 * k);
            post(px, yB, w, yFoot - yB, PAL.wood, 'mid', j * 3 + side);
      beam(px - (side < 0 ? 4 * k : 0), yFoot - 3 * k, w + 4 * k, 4 * k, PAL.wood, 'mid');
      contactShadow(px + w / 2, yFoot + 1.5 * k, w * 0.9, 1.5 * k, 0.35);
      if (mBeam < spanM) { // knee brace from the post up to the spreader
        const bx0 = side < 0 ? px + w : px, bx1 = bx0 - side * 22 * k;
        ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 5 * k * 0.7;
        ctx.beginPath(); ctx.moveTo(bx0, yB + BH + 20 * k); ctx.lineTo(bx1, yB + BH); ctx.stroke();
        ctx.strokeStyle = PAL.wood.shadow; ctx.lineWidth = 3.4 * k * 0.7; ctx.stroke();
      }
    }
    if (kind === 'major' && mBeam < spanM) {
      // spreader beam across the shaft, seated in rock pockets on both walls (behind the ladder, rail and cart)
      const x0 = g.cx - g.sw / 2 - 10 * k, x1 = g.cx + g.sw / 2 + 10 * k;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x0, yB + BH, x1 - x0, 3 * k); // its shadow on the rear wall
      beam(x0, yB, x1 - x0, BH, PAL.wood, 'mid', j * 11, 1);
    }
  }
}

/** The shaft collar: a heavy timber frame set into an earth/rock lip at the surface, dark mouth beneath. */
export function drawCollar(g: ShaftGeom, gy: number) {
  if (gy < view.vy0 - 120 || gy > view.vy1 + 60) return;
  const k = g.k;
  // dark mouth: the first metres of the shaft swallow the light
  const mouth = ctx.createLinearGradient(0, gy, 0, gy + 4 * CFG.ppm);
  mouth.addColorStop(0, 'rgba(0,0,0,.55)'); mouth.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mouth; ctx.fillRect(g.cx - g.sw / 2, gy, g.sw, 4 * CFG.ppm);
  for (const side of [-1, 1]) {
    const e = g.cx + side * g.sw / 2;
    // earth lip overhanging the mouth, with a dark underside
    ctx.fillStyle = 'rgba(8,5,3,.5)';
    ctx.beginPath(); ctx.moveTo(e + side * 6 * k, gy + 2); ctx.lineTo(e - side * 9 * k, gy + 5 * k); ctx.lineTo(e - side * 4 * k, gy + 13 * k); ctx.lineTo(e + side * 8 * k, gy + 16 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath(); ctx.moveTo(e + side * 30 * k, gy - 1); ctx.lineTo(e - side * 10 * k, gy - 1); ctx.lineTo(e - side * 8 * k, gy + 4 * k); ctx.lineTo(e + side * 4 * k, gy + 7 * k); ctx.lineTo(e + side * 30 * k, gy + 5 * k); ctx.closePath(); ctx.fill();
    // cribbing: posts down the first metres + a heavy sill beam lying on the ground, ends sunk into the lip
    const PW = 9 * k, px = side < 0 ? e - 1 * k : e - PW + 1 * k;
    post(px, gy, PW, 3.2 * CFG.ppm, PAL.wood, 'mid', side * 5 + 40);
    beam(px, gy + 3.2 * CFG.ppm - 3 * k, PW, 5 * k, PAL.wood, 'mid'); // foot
    const sx = side < 0 ? e - 46 * k : e - 6 * k;
    beam(sx, gy - 7 * k, 52 * k, 8 * k, PAL.wood, 'fg', side * 9 + 70, 1.5 * k);
    ctx.fillStyle = '#2c2c2c';
    for (const bx of [sx + 8 * k, sx + 44 * k]) { ctx.beginPath(); ctx.arc(bx, gy - 3 * k, 1.4 * k, 0, 6.283); ctx.fill(); } // bolts
    contactShadow(sx + 26 * k, gy + 1, 28 * k, 2.2 * k, 0.4);
  }
}

/** Rocks along a face-local edge (logical units, current transform): used to carve the Work Chamber and the rest
 *  pocket into the surrounding rock. (x0,y0)→(x1,y1) is the edge, `nx,ny` its outward normal. */
export function rockEdge(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, seed: number, m: number, size = 1, push = 0, mode = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / (30 * size)));
  for (let i = 0; i < n; i++) {
    const hs = seed + i * 7.7;
    if (n > 2 && hash(hs * 6.1) < 0.28) continue; // irregular gaps: never an even row of stones
    const t = (i + 0.2 + hash(hs * 5.3) * 0.6) / n, f = 0.6 + hash(hs * 8.3) * 0.8;
    const rx = (13 + hash(hs) * 9) * size * f, ry = rx * (0.6 + hash(hs * 2.3) * 0.3);
    const out = rx * (0.45 + push + hash(hs * 3.1) * 0.3);
    drawRock(rockShape(Math.floor(hs * 13) + 7000, rx, ry), x0 + (x1 - x0) * t + nx * out, y0 + (y1 - y0) * t + ny * out, toneAt(m, Math.floor(hash(hs * 4.9) * 3), mode), 1);
  }
}
