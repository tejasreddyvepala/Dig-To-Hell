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
import { restZoneY, structuralLamp } from './minelight';
import { S } from './state';
import { LEDGES, worksiteDef } from './layout';
import { face } from './digface';
import { materialAtXY } from './geo';
import { cluster, dimPal, drawCluster, lightAt, palOf, palAt, setRockSpace, type Cluster, type Pal } from './bedrock';
const cssRGB = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// ---------- faceted rock shapes (cached) ----------
interface RockShape { body: Path2D; lit: Path2D; dark: Path2D; crev: Path2D; rim: Path2D }
const shapes = new Map<string, RockShape>();

/** A chunky low-poly rock centred at 0,0: body + lit facet (upper-left) + shadow facet (lower-right) + crevice line
 *  along the shadow side + a thin rim on the lit side. Some edges get no line at all (the wall reads as one mass). */
export function rockShape(seed: number, rx: number, ry: number, sharp = false): RockShape {
  const key = `${seed}|${Math.round(rx * 2)}|${Math.round(ry * 2)}|${sharp ? 1 : 0}`;
  let s = shapes.get(key);
  if (s) return s;
  if (shapes.size > 600) shapes.clear();
  const n = sharp ? 6 + Math.floor(hash(seed * 1.31) * 4) : 5 + Math.floor(hash(seed * 1.31) * 3);
  const pts: [number, number][] = [];
  // fractured faces: a random lean, uneven radii and the odd notch, so corners are sharp and no two read alike
  const lean = sharp ? (hash(seed * 3.9) - 0.5) * 0.9 : 0;
  // start at the left and go clockwise (canvas y is down): left → top → right → bottom
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.9 + (i + (hash(seed + i * 4.7) - 0.5) * (sharp ? 0.8 : 0.5)) / n * Math.PI * 2;
    let r = sharp ? 0.58 + hash(seed * 2.3 + i * 1.9) * 0.42 : 0.74 + hash(seed * 2.3 + i * 1.9) * 0.26;
    if (sharp && hash(seed * 7.1 + i) < 0.18) r *= 0.62; // a broken-in notch
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    pts.push([x + y * lean * 0.5, y]);
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
  if (mode >= 10) { const b = toneAt(m, variant, mode - 10); t = { ...b, light: b.base }; tones.set(key, t); return t; }
  const v = [0.62, 0.7, 0.78][variant] * (mode === 1 ? 1.08 : mode === 2 ? 0.75 : 1);
  const c: RGB = [0, 1, 2].map((i) => (ROCK[i] * 0.4 + mat.wall[i] * 0.6) * v) as RGB;
  const lk = mode === 2 ? 1.1 : 1.18;
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
  if (lw > 0) { // only selected rocks show a crack/edge; the rest merge into the mass
    c.strokeStyle = t.deep; c.lineWidth = lw; c.stroke(r.crev);
    c.strokeStyle = t.rim; c.lineWidth = lw * 0.5; c.globalAlpha *= 0.55; c.stroke(r.rim);
  }
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
  const h = hash(i * 5.13 + side * 17.7) * 0.6 + hash((i + 1) * 5.13 + side * 17.7) * 0.4; // smoothed: no sawtooth
  return z === 'recessed' ? 4 + h * 7 : z === 'solid' ? h * 3 : 2 + h * 4;
}

export interface ShaftGeom { cx: number; sw: number; k: number; sTop: number; sBot: number; floorM: number; wallBot: number; chTop: number; chBot: number }
/** Screen-y interval [a, b] overlaps the Work Chamber room (which sits at its own world depth; NaN = no room)? */
const inRoom = (g: ShaftGeom, a: number, b: number) => g.chBot === g.chBot && b > g.chTop && a < g.chBot;

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
/** Visual geology profile by WORLD depth (never by the dig depth): soil near the grass, rock emerging through the first
 *  metres, full chunky bedrock from ~9 m. 0 at 1 m → 1 at 9 m. Purely visual; hardness/economy untouched. */
export const rockiness = (m: number) => Math.max(0, Math.min(1, (m - 1) / 8));
/** Deterministic thinning: keep this rock at world depth mC only if its own hash clears the local rockiness. */
const keep = (hs: number, mC: number, bias = 0) => hash(hs * 9.17 + 0.5) < rockiness(mC) + bias;

/** Layer A: the outer rock mass hugging the shaft, darker than the open earth, irregular big lobes. */
export function drawRockMass(g: ShaftGeom) {
  const j0 = Math.max(0, Math.floor(viewM(g.sTop) / SEG) - 1), j1 = Math.max(j0, Math.floor(g.floorM / SEG));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(g.cx + side * g.sw / 2, Math.max(g.sTop, yOf(0) + 8));
    for (let j = j0; j <= j1; j++) {
      const w = (200 + hash(j * 3.7 + side * 9.1) * 30) * g.k * (0.12 + 0.88 * rockiness(j * SEG));
      ctx.lineTo(g.cx + side * (g.sw / 2 + w), Math.max(g.sTop, yOf(j * SEG + 1.2 * hash(j + side))));
    }
    ctx.lineTo(g.cx + side * g.sw / 2, Math.min(g.sBot + 4, yOf(j1 * SEG + 3))); // ends at the excavation
    ctx.closePath();
    ctx.fillStyle = cssRGB(palAt(viewM((g.sTop + g.wallBot) / 2)).shadow.map((v) => v * 0.6) as RGB); ctx.fill(); // one continuous dark bedrock body behind the boulders
  }
}

/** Back wall (inside the interior clip): one continuous, very dark bedrock surface built from large interlocking
 *  low-contrast clusters (broad planes + faint seams). Lamps reveal it a little; away from them it stays near-black. */
export function drawRearWall(g: ShaftGeom) {
  { // pick/drill marks on the freshly cut back wall just above the floor
    const yF = yOf(g.floorM);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let q = 0; q < 14; q++) {
      const x = g.cx + (hash(q * 3.1 + Math.floor(g.floorM)) - 0.5) * g.sw * 0.85, y = yF - (0.5 + hash(q * 5.7) * 3.5) * CFG.ppm;
      ctx.moveTo(x, y); ctx.lineTo(x + 4 * g.k, y + 7 * g.k);
    }
    ctx.stroke();
  }
  { // faint strata every ~10 m and a few drip stains (world-anchored)
    const a = Math.floor(viewM(g.sTop) / 10), b = Math.ceil(viewM(g.sBot) / 10);
    ctx.lineWidth = 1.4;
    for (let j = Math.max(0, a); j <= b; j++) {
      const y = yOf(j * 10 + hash(j * 1.3) * 3);
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.moveTo(g.cx - g.sw / 2, y);
      for (let x = -g.sw / 2; x <= g.sw / 2; x += 30) ctx.lineTo(g.cx + x, y + Math.sin(x * 0.02 + j) * 6);
      ctx.stroke();
      if (hash(j * 4.7) < 0.4) { // a drip stain
        const x = g.cx + (hash(j * 9.1) - 0.5) * g.sw * 0.7, gr = ctx.createLinearGradient(0, y, 0, y + 4 * CFG.ppm);
        gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(x, y, 3 * g.k, 4 * CFG.ppm);
      }
    }
  }
  const k = g.k, ROW = 3.5, j0 = Math.max(0, Math.floor(viewM(g.sTop) / ROW) - 1), j1 = Math.ceil(viewM(g.sBot) / ROW) + 1;
  for (let j = j0; j <= j1; j++) {
    const m = j * ROW, p = dimPal(palAt(m), 0.36);
    for (let q = 0; q < 4; q++) { // a quiet dark stone surface: mid-size, barely-contrasting stones, never giant planes
      const hs = j * 11.3 + q * 3.7, w = (66 + hash(hs) * 26) * k, h = (ROW + 1.2 + hash(hs * 2.3) * 1.2) * CFG.ppm;
      const x = g.cx - g.sw / 2 + (q * 70 + (j % 2) * 35 - 10 + hash(hs * 3.1) * 18) * k, y = yOf(m + ROW * 0.5 + (hash(hs * 4.7) - 0.5) * 1.2);
      if (y < view.vy0 - h || y > view.vy1 + h) continue;
      drawCluster(cluster(Math.floor(hs * 7) + 40000, w, h, hash(hs * 5.5) - 0.5, 3, 0), x, y, p, 0.22, 0.3); // the back wall only hints at light
    }
  }
}

/** Layer C: dark band where the rock turns inward (stroke the silhouette inside the clip). */
export function drawInnerCut(g: ShaftGeom) {
  interiorPath(g);
  ctx.strokeStyle = 'rgba(4,3,2,.4)'; ctx.lineWidth = 10 * g.k; ctx.stroke();
  ctx.strokeStyle = 'rgba(4,3,2,.22)'; ctx.lineWidth = 22 * g.k; ctx.stroke();
}

/** Layer B: chunky edge rocks — a low-contrast back row deeper in the wall, then the front row on the silhouette.
 *  Static wall is cached per side per 8 m tile (offscreen, built once per viewport size); only the strip near the
 *  dig face (fresh rock, rocks framing the face, a chamber ceiling cut) is drawn live, clipped so seams match. */
const TILE = 8; // m
const tiles = new Map<string, HTMLCanvasElement>();
const IN_W = 45, OUT_W = 240; // logical units the tile spans inward / outward of the logical edge

type Emit = (c: Cluster, x: number, m: number, p: Pal, contrast: number) => void;
/** Every wall boulder whose centre lies in [mFrom, mTo) — a PURE function of world depth, side and cell (never of
 *  the current dig depth or the camera), so any world location always shows the same rock. x is relative to the
 *  logical edge (logical units × k). Layers interleave: background bedrock (dark, broad, low contrast) → large
 *  masses (the wall's volume) → medium boulders (break the masses) → foreground edge rocks (strongest shape and
 *  light) → small fillers tucked into the crevices. Clusters form per 16 m region; calm stretches between. */
// ---------- permanent wall PANELS (authored-style, reusable, picked by world depth) ----------
/** One boulder in a wall panel: u = distance OUTWARD from the shaft edge (logical units; negative = into the shaft),
 *  y = metres down from the panel's top, w/h = size (logical / metres), layer 0 recess · 1 main · 2 foreground · 3 filler. */
interface PB { u: number; y: number; w: number; h: number; layer: number; seed: number; lean: number; anchor?: boolean; cavity?: boolean }
const PANEL_M = 8, PANEL_VARIANTS = 10;
const panels: PB[][] = [];
/** The 8 panel designs — generated ONCE from fixed seeds (never from the world, the camera or the dig depth), so
 *  each is effectively an authored rock formation: a dense column of big rounded boulders hugging the shaft edge,
 *  recessed darker stones behind them, a protruding foreground boulder or two, and small stones in the gaps. */
function panel(v: number): PB[] {
  if (panels[v]) return panels[v];
  let i = 0;
  const r = () => hash(v * 97.13 + ++i * 3.71);
  const out: PB[] = [], lean = (r() - 0.5) * 1.1;
  // outer layers first (layer 0): two extra rows of big boulders reaching to the screen edge, then the recess row
  // (fewer internal planes, lower contrast: they are background)
  for (const [u0, du, n, w0, h0] of [[150, 50, 3, 62, 5], [100, 40, 3, 56, 4.6], [50, 30, 3, 48, 4]] as const)
    for (let q = 0; q < n; q++) out.push({ u: u0 + r() * du, y: (q + r() * 0.7) * (PANEL_M / n), w: w0 + r() * 16, h: h0 + r() * 1.6, layer: 0, seed: v * 100 + u0 + q, lean: lean + (r() - 0.5) * 0.6 });
  // main column: fewer, bigger round boulders stacked down the panel, each resting on the one below (≈15% overlap),
  // zig-zagging a little; one ANCHOR boulder per panel is ~1.5× the others
  const anchorQ = Math.floor(r() * 2);
  let y = r() * 0.5;
  for (let q = 0; y < PANEL_M; q++) {
    const big = q === anchorQ ? 1.45 : 1, h = (4.2 + r() * 1.6) * big;
    out.push({ u: (q % 2 ? 20 : 12) + r() * 8 + (big > 1 ? 6 : 0), y: y + h * 0.5, w: (42 + r() * 16) * big, h, layer: 1, seed: v * 100 + 20 + q, lean: lean + (r() - 0.5) * 0.5, anchor: big > 1 });
    y += h * (0.8 + r() * 0.08);
  }
  // foreground: one boulder that protrudes a little into the shaft (left wall only reaches further: the right wall
  // keeps the rail lane clear — clamped where it's emitted)
  out.push({ u: -6 + r() * 6, y: 1 + r() * (PANEL_M - 2), w: 30 + r() * 12, h: 3 + r() * 1.4, layer: 2, seed: v * 100 + 40, lean: lean + (r() - 0.5) * 0.4 });
  // small stones only in the gaps between boulders (just outside the column, at the seams between stacked stones)
  for (let q = 0; q < 4; q++) out.push({ u: 30 + r() * 26, y: (q + 0.5) * (PANEL_M / 4) + (r() - 0.5) * 0.6, w: 6 + r() * 6, h: 0.6 + r() * 0.5, layer: 3, seed: v * 100 + 60 + q, lean: 0 });
  if (v === 8) for (const b of out) if (b.layer === 1) b.anchor = true; // the cracked-rock variant: every main boulder fractured
  if (v === 9) out.push({ u: 18, y: PANEL_M * 0.45, w: 30, h: 2.4, layer: 0, seed: v * 100 + 90, lean: 0, cavity: true }); // a dark hollow between stones
  return (panels[v] = out);
}
/** Which panel a world segment uses (never the same design twice in a row on one wall). Pure function of world depth. */
function panelFor(seg: number, side: number) {
  const pick = (s: number) => Math.floor(hash(s * 7.13 + side * 3.31 + 0.5) * PANEL_VARIANTS);
  const v = pick(seg);
  return v === pick(seg - 1) ? (v + 1) % PANEL_VARIANTS : v;
}

/** Every wall boulder whose centre lies in [mFrom, mTo): panels picked by WORLD depth, so any world location always
 *  shows the same rock (never the dig depth, the camera or the frame). x is relative to the logical edge (logical
 *  units × k). Near the surface the rock thins into soil (rockiness), deterministically. */
function rocksIn(g: ShaftGeom, side: number, mFrom: number, mTo: number, emit: Emit) {
  const k = g.k, ppm = CFG.ppm;
  const fitDepth = (h: number, mC: number) => Math.min(h, Math.max(2, (mC - 0.25) * ppm * 2)); // never pokes above the grass
  const s0 = Math.max(0, Math.floor(mFrom / PANEL_M) - 1), s1 = Math.ceil(mTo / PANEL_M) + 1;
  for (const layer of [0, 1, 2, 3]) for (let sg = s0; sg <= s1; sg++) {
    const P = panel(panelFor(sg, side));
    for (const b of P) {
      if (b.layer !== layer) continue;
      const mC = sg * PANEL_M + b.y;
      if (mC < 0.6 || mC < mFrom || mC >= mTo) continue;
      const hs = b.seed * 13.7 + sg * 1.31 + side * 0.7;
      if (layer !== 3 && !keep(hs, mC, layer === 1 ? 0.15 : 0)) continue;
      const rk = layer === 3 ? 1 : 0.4 + 0.6 * rockiness(mC);
      const R = recessAt(Math.round(mC / 2), side);
      // geological boundaries interlock: near a layer change, boulders take the neighbouring material in pockets
      const P0 = palOf(materialAtXY(mC, side * (6 + b.u * 0.08)));
      const pal = b.cavity ? dimPal(P0, 0.22) : layer === 0 ? dimPal(P0, b.u > 90 ? 0.6 : 0.75) : P0;
      const con = layer === 0 ? 0.5 : layer === 2 ? 1.15 : 1;
      const w = b.w * rk * k, h = fitDepth(b.h * rk * ppm, mC);
      const u = layer === 2 && side > 0 ? Math.max(b.u, 2) : b.u; // right wall: never into the rail lane
      const planes = layer === 0 ? 3 : layer === 3 ? 3 : 3 + (b.seed % 2);
      emit(cluster(b.seed * 31 + sg * 7 + (side > 0 ? 3 : 0), w, h, b.lean * side, planes, b.anchor ? 1 : 0), side * (R + u) * k, mC, pal, con);
    }
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
  rocksIn(g, side, t * TILE - 9, (t + 1) * TILE + 9, (cl, x, m, p, con) => drawCluster(cl, x, (m - t * TILE) * CFG.ppm, p, 0, con, 1, c));
  tiles.set(key, cv);
  return cv;
}

/** Rock high above the work floor recedes: a dark vertical ramp over the wall bands (0 near the floor). */
export function drawWallDepthRamp(g: ShaftGeom) {
  const yF = yOf(g.floorM), y0 = Math.max(view.vy0, g.sTop), span = 26 * CFG.ppm;
  if (yF - 6 * CFG.ppm <= y0) return;
  const gr = ctx.createLinearGradient(0, yF - 6 * CFG.ppm - span, 0, yF - 6 * CFG.ppm);
  gr.addColorStop(0, 'rgba(8,5,3,.2)'); gr.addColorStop(1, 'rgba(8,5,3,0)');
  ctx.fillStyle = gr;
  for (const side of [-1, 1]) {
    const e = g.cx + side * g.sw / 2, x0 = side < 0 ? e - OUT_W * g.k : e - 12 * g.k;
    ctx.fillRect(x0, y0, (OUT_W + 12) * g.k, yF - 6 * CFG.ppm - y0);
  }
}

export function drawEdgeRocks(g: ShaftGeom) {
  const k = g.k, res = Math.round(view.dpr * Math.max(1, view.zoom) * 4) / 4;
  const mTop = Math.max(0, viewM(view.vy0) - 1), mBot = viewM(view.vy1) + 1;
  // the Work Chamber's cavity replaces the wall between its ceiling and the floor (a visibility clip, not a reseed)
  // revealed ground: the wall exists in world space, but solid ground below the excavation isn't a cave — show rock
  // only to just under the floor (tight near the surface, opening up with depth). Visibility only, never a reseed.
  const faceM = (CFG.face.height * k) / CFG.ppm, revealM = g.floorM + Math.min(faceM + 3, 0.8 * g.floorM + 1);
  const clipBot = Math.min(g.wallBot < g.sBot - 1 ? g.wallBot : view.vy1 + 40, yOf(revealM));
  setRockSpace(0, 0, 1);
  for (const side of [-1, 1]) {
    const edge = g.cx + side * g.sw / 2, x0 = side > 0 ? -IN_W * k : -OUT_W * k;
    ctx.save(); ctx.beginPath();
    if (g.chBot === g.chBot && g.chBot > view.vy0 && g.chTop < clipBot) { // wall hidden inside the room (visibility only)
      if (g.chTop > view.vy0 - 40) ctx.rect(edge - OUT_W * k, view.vy0 - 40, 2 * OUT_W * k, g.chTop - view.vy0 + 40);
      if (clipBot > g.chBot) ctx.rect(edge - OUT_W * k, g.chBot, 2 * OUT_W * k, clipBot - g.chBot);
    } else {
      const x0 = edge - OUT_W * k, x1 = edge + OUT_W * k;
      ctx.moveTo(x0, view.vy0 - 40); ctx.lineTo(x1, view.vy0 - 40);
      for (let x = x1; x >= x0; x -= 14 * k) ctx.lineTo(x, clipBot + (hash(Math.round(x / k) * 0.37 + side) - 0.3) * 18 * k);
      ctx.closePath();
    }
    ctx.clip();
    for (let t = Math.floor(mTop / TILE); t * TILE < mBot; t++) {
      const cv = tileCanvas(g, side, t, res);
      ctx.drawImage(cv, edge + x0, yOf(t * TILE), cv.width / res, cv.height / res);
    }
    // lit redraw only for the rock facing the shaft (the outer rows stay in the cached unlit tiles: cheap)
    rocksIn(g, side, Math.max(0, mTop - 5), mBot + 5, (cl, x, m, p, con) => { const y = yOf(m); if (con < 1 || Math.abs(x) > 70 * k) return; const f = lightAt(edge + x, y, cl.r); if (f > 0.02) drawCluster(cl, edge + x, y, p, 1, con, Math.min(1, f * 2.5)); });
    ctx.restore();
  }
}

// ---------- structural timber (world-anchored rhythm) ----------
const LEVEL = 8; // m between structural levels (shared with minelight.ts)
let woodTone = PAL.wood;
const OLD_WOOD = { base: '#7e5532', light: '#a87a4c', shadow: '#53361d', dark: '#33200f' }; // weathered timber (older, upper levels)
const wood = (x: number, y: number, w: number, h: number, seed = -1) => beam(x, y, w, h, woodTone, 'mid', seed);
/** The beam a lamp hangs from catches its light: warm top edge, and a hard occlusion shadow on the rock behind. */
function lampLitBeam(x: number, y: number, w: number, h: number, k: number) {
  ctx.fillStyle = 'rgba(4,3,2,.5)'; ctx.fillRect(x + 2 * k, y + h, w, 3.5 * k);
  ctx.fillStyle = 'rgba(255,196,110,.55)'; ctx.fillRect(x + 1 * k, y + 0.4 * k, w - 2 * k, 1.3 * k);
  ctx.fillStyle = 'rgba(255,214,140,.22)'; ctx.fillRect(x + 1 * k, y + 1.7 * k, w - 2 * k, h * 0.35);
  ctx.fillStyle = '#2a2420'; // two bolts
  for (const bx of [x + 4 * k, x + w - 4 * k]) { ctx.beginPath(); ctx.arc(bx, y + h * 0.55, 0.9 * k, 0, 6.283); ctx.fill(); }
}
function brace(x0: number, y0: number, x1: number, y1: number, k: number) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 5.2 * k * 0.7;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = PAL.wood.base; ctx.lineWidth = 3.6 * k * 0.7; ctx.stroke();
}

export function drawRearFrame(_g: ShaftGeom, _stopM: number) { /* back wall geology: see drawRearWall */ }

/** Rock intrusions: big fractured shoulders of bedrock pushing into the shaft on alternating walls (presentation only:
 *  no collision, routes untouched — ladder, rail and cart are drawn in front). They break the shaft into compact
 *  chambers so it reads as excavated rock, not one tall empty room. Never in the work/rest area (below `spanM`). */
export function drawIntrusions(g: ShaftGeom, _spanM: number) {
  setRockSpace(0, 0, 1);
  const k = g.k, CH = 8, j0 = Math.max(0, Math.floor(viewM(g.sTop) / CH) - 1), j1 = Math.ceil(viewM(Math.min(view.vy1, g.wallBot)) / CH);
  for (let c = j0; c <= j1; c++) {
    const hs = c * 23.9 + 3;
    if (hash(hs * 8.1) < 0.35) continue;
    const hM = 3.5 + hash(hs * 1.3) * 3.5, m0 = c * CH + hash(hs * 2.7) * 3;
    if (m0 < 14 || yOf(m0 + hM) > g.wallBot || inRoom(g, yOf(m0) - 10, yOf(m0 + hM) + 10)) continue; // pocket / room hide it (visibility only)
    const side = (c % 2 ? -1 : 1) * (hash(hs * 3.9) < 0.25 ? -1 : 1);
    const d = (24 + hash(hs * 4.4) * 14) * k; // reach into the shaft (kept shallow: never behind the miners)
    const e = g.cx + side * g.sw / 2, yT = yOf(m0), yB = yOf(m0 + hM), mid = (yT + yB) / 2, p = palAt(m0), th = (hash(hs * 6.3) - 0.5);
    drawCluster(cluster(Math.floor(hs * 3) + 50000, d * 1.7, (yB - yT) * 1.05, th, 6, 2), e - side * d * 0.3, mid, p, 1, 1.05);
    drawCluster(cluster(Math.floor(hs * 5) + 51000, d * 0.9, (yB - yT) * 0.5, th + 0.3, 5, 1), e - side * d * 0.55, mid + (yB - yT) * 0.3, p, 1, 1.15);
    drawCluster(cluster(Math.floor(hs * 7) + 52000, d * 0.6, (yB - yT) * 0.32, th - 0.3, 4, 0), e - side * d * 0.35, yT + (yB - yT) * 0.12, p, 1, 1.1);
    drawCluster(cluster(Math.floor(hs * 9) + 53000, d * 0.28, d * 0.2, 0, 3, 0), e - side * d * 0.7, yB - (yB - yT) * 0.05, p, 1, 1);
  }
}

/** One bedrock cluster in the current space (face-local allowed: call setRockSpace first). mode 2 = deeper/darker. */
export function bedRock(x: number, y: number, seed: number, rx: number, ry: number, m: number, mode = 0, _k = 1) {
  const p = mode === 2 ? dimPal(palAt(m), 0.6) : palAt(m);
  drawCluster(cluster(seed + 30000, rx * 2, ry * 2, (hash(seed * 1.9) - 0.5) * 1.4, 3 + Math.floor(hash(seed * 2.3) * 3), 1, 1), x, y, p, 1, 1);
}

/** The shaft's timber — only where it does a job (Pass "convergence"): the transport guide post (+ one tie per level),
 *  compact work ledges (deck, brace into the rock, railing) by the ladder, transport landings, and wall caps that
 *  carry a lamp. No continuous wall posts, no spreaders across the shaft, no rear frame. */
export function drawTimberSets(g: ShaftGeom, _clearLeftM: number, spanM: number) {
  const k = g.k, X = (lx: number) => g.cx - g.sw / 2 + lx * k;
  const top = Math.max(g.sTop, yOf(0)), wallBot = Math.min(g.wallBot, view.vy1 + 20);
  if (wallBot <= top) return;
  const tBot = Math.min(wallBot, yOf(g.floorM) - 62 * k);
  if (tBot > top) post(X(206), top, 7 * k, tBot - top, PAL.wood, 'mid', 7); // transport compartment guide post
  const rz = restZoneY();
  const lBot = Math.min(wallBot, rz - 10 * k, yOf(g.floorM) - 40 * k), lTop = Math.max(top, yOf(10));
  if (lBot > lTop) { // left wall post: the work ledges hang from it (from the first structural level to the rest nook)
    post(X(-4), lTop, 6 * k, lBot - lTop, PAL.wood, 'mid', 9);
    ctx.fillStyle = 'rgba(6,4,3,.45)'; ctx.fillRect(X(2), lTop, 3 * k, lBot - lTop); // its shadow on the rock
  }
  const j0 = Math.max(0, Math.floor(viewM(top) / LEVEL) - 1), j1 = Math.ceil(viewM(wallBot) / LEVEL);
  LEDGES.length = 0;
  for (let j = j0; j <= j1; j++) {
    const m = j * LEVEL + 2.5, y = yOf(m), yl = yOf(m + 3.2);
    if (y < top - 20 || y > wallBot - 10 || inRoom(g, y - 30 * k, yOf(m + 3.2) + 30 * k)) continue; // no shaft timber inside the room
    if (m < 10) continue; // nothing structural in the first metres of the pit
    const lamp = structuralLamp(j, spanM), upper = m < spanM;
    woodTone = m < g.floorM - 70 ? OLD_WOOD : PAL.wood; // the older levels up the shaft are weathered
    if (y < tBot && (j % 3 === 0 || lamp === 'landing')) wood(X(206), y + 2 * k, 40 * k, 4 * k); // tie: guide post -> rail
    // compact work ledge by the ladder (always where its lamp hangs; otherwise only on some levels)
    if (lamp === 'ledge' || (upper && j % 2 === 1 && hash(j * 3.3) < 0.45 && yl + 12 * k < rz)) {
      const w = (46 + hash(j * 6.1) * 10) * k;
      ctx.fillStyle = 'rgba(4,3,2,.5)'; ctx.fillRect(X(-10), yl + 6 * k, w + 4 * k, 3 * k); // its shadow on the rock
      wood(X(-8), yl, w, 6 * k, j * 13);
      ctx.fillStyle = 'rgba(30,18,8,.55)'; for (let px = X(-8) + 9 * k; px < X(-8) + w - 3 * k; px += 9 * k) ctx.fillRect(px, yl + 0.8 * k, 0.9 * k, 4.6 * k); // plank gaps
      ctx.fillStyle = 'rgba(255,220,170,.35)'; ctx.fillRect(X(-8), yl, w, 0.8 * k); // front edge catches light
      if (m > 150) { ctx.fillStyle = '#5e646b'; ctx.fillRect(X(-8) + w * 0.3, yl, 2.2 * k, 6 * k); ctx.fillRect(X(-8) + w * 0.75, yl, 2.2 * k, 6 * k); } // steel bands
      if (lamp === 'ledge') lampLitBeam(X(-8), yl, w, 6 * k, k);
      LEDGES.push({ x0: X(-8), x1: X(-8) + w, y: yl, j, kind: 'ledge' });
      brace(X(0), yl + 26 * k, X(-8) + w * 0.75, yl + 6 * k, k);
      ctx.fillStyle = PAL.wood.shadow;
      ctx.fillRect(X(-8) + w - 3 * k, yl - 15 * k, 3 * k, 15 * k); ctx.fillRect(X(-2), yl - 15 * k, 3 * k, 15 * k); // rail posts
      ctx.fillStyle = PAL.wood.base; ctx.fillRect(X(-2), yl - 15 * k, w - 4 * k, 2.4 * k); // hand rail
    }
    // BRIDGE: every other level, a plank deck spans the shaft from the left wall to the transport post (the cart's
    // column stays clear): deck, railing, braces into both walls, posts down from the bridge above — a timber frame
    // through the whole mine, with miners working on it (render.drawLedgeCrew)
    const bridge = j % 2 === 0 && m >= 14 && yl < yOf(g.floorM) - 140 * k && yl + 30 * k < rz;
    if (bridge) {
      const bx0 = X(-8), bx1 = X(204), bw = bx1 - bx0;
      const mU = (j - 2) * LEVEL + 2.5 + 3.2, yU = yOf(mU);
      if (j - 2 >= 0 && (j - 2) * LEVEL + 2.5 >= 14 && !inRoom(g, yU - 10 * k, yU + 10 * k) && yU > top - 40 * k) { // frame posts up to the bridge above
        [X(70), X(150)].forEach((px, pi) => post(px, yU + 7 * k, 5 * k, yl - yU - 7 * k, woodTone, 'bg', j * 3 + pi)); // stable grain seeds (cached)
        ctx.strokeStyle = 'rgba(60,38,20,.55)'; ctx.lineWidth = 2.2 * k; ctx.beginPath(); // a cross brace in alternate bays
        if (j % 4 === 0) { ctx.moveTo(X(72), yU + 8 * k); ctx.lineTo(X(152), yl - 2 * k); ctx.moveTo(X(152), yU + 8 * k); ctx.lineTo(X(72), yl - 2 * k); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(4,3,2,.45)'; ctx.fillRect(bx0 + 2 * k, yl + 9 * k, bw, 3 * k); // its shadow
      wood(bx0, yl, bw, 7 * k, j * 19); // deck
      ctx.fillStyle = 'rgba(30,18,8,.55)'; for (let px = bx0 + 9 * k; px < bx1 - 3 * k; px += 9 * k) ctx.fillRect(px, yl + 0.8 * k, 0.9 * k, 5.4 * k); // plank gaps
      beam(bx0, yl + 7 * k, bw, 3 * k, PAL.wood, 'bg'); // stringer under the deck
      ctx.fillStyle = 'rgba(255,220,170,.3)'; ctx.fillRect(bx0, yl, bw, 0.8 * k);
      if (m > 150) { ctx.fillStyle = '#5e646b'; for (let px = bx0 + bw * 0.2; px < bx1; px += bw * 0.3) ctx.fillRect(px, yl, 2.2 * k, 7 * k); } // steel bands deeper down
      brace(X(0), yl + 30 * k, X(26), yl + 8 * k, k); brace(X(206), yl + 30 * k, X(180), yl + 8 * k, k);
      ctx.fillStyle = PAL.wood.shadow; for (let px = bx0 + 2 * k; px <= bx1 - 2 * k; px += bw / 5) ctx.fillRect(px, yl - 14 * k, 2.6 * k, 14 * k); // railing posts
      ctx.fillStyle = PAL.wood.base; ctx.fillRect(bx0 + 2 * k, yl - 14 * k, bw - 4 * k, 2.2 * k); // hand rail
      electrics(bx0, bx1, yl, j, k);
      LEDGES.push({ x0: bx0, x1: bx1, y: yl, j, kind: 'bridge' });
    }
    if (!bridge && (lamp === 'landing' || (upper && j % 4 === 2 && hash(j * 4.4) < 0.4))) { // transport maintenance landing
      wood(X(168), yl, 44 * k, 6 * k, j * 17);
      if (lamp === 'landing') lampLitBeam(X(168), yl, 44 * k, 6 * k, k);
      LEDGES.push({ x0: X(168), x1: X(212), y: yl, j, kind: 'landing' });
      brace(X(206), yl + 24 * k, X(176), yl + 6 * k, k);
      ctx.fillStyle = PAL.wood.shadow; ctx.fillRect(X(168), yl - 13 * k, 3 * k, 13 * k);
      ctx.fillStyle = PAL.wood.base; ctx.fillRect(X(168), yl - 13 * k, 38 * k, 2.2 * k);
    }
    if (lamp === 'left') { wood(X(-16), y, 38 * k, 9 * k, j * 3); lampLitBeam(X(-16), y, 38 * k, 9 * k, k); brace(X(6), y + 30 * k, X(20), y + 7 * k, k); }
    if (lamp === 'right') { wood(X(240), y, 36 * k, 9 * k, j * 5); lampLitBeam(X(240), y, 36 * k, 9 * k, k); brace(X(260), y + 30 * k, X(246), y + 7 * k, k); }
  }
}

/** Mine electrics on a bridge: a power cable sagging under the deck between the posts, a junction box on the left
 *  post, and on every third bridge a generator / fuse cabinet with a blinking status light (some deeper ones a
 *  transformer drum). World-anchored per level. */
function electrics(x0: number, x1: number, y: number, j: number, k: number) {
  const w = x1 - x0, cy = y + 11 * k;
  ctx.strokeStyle = '#1b1b1d'; ctx.lineWidth = Math.max(1, 1.4 * k); ctx.beginPath(); // the main cable, sagging between hangers
  for (let i = 0; i < 4; i++) { const a = x0 + (w * i) / 4, b = x0 + (w * (i + 1)) / 4; ctx.moveTo(a, cy); ctx.quadraticCurveTo((a + b) / 2, cy + 5 * k, b, cy); }
  ctx.stroke();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(0.8, 0.9 * k); ctx.beginPath(); // a thinner red signal line
  for (let i = 0; i < 4; i++) { const a = x0 + (w * i) / 4, b = x0 + (w * (i + 1)) / 4; ctx.moveTo(a, cy + 2 * k); ctx.quadraticCurveTo((a + b) / 2, cy + 6.5 * k, b, cy + 2 * k); }
  ctx.stroke();
  ctx.fillStyle = '#3a3f45'; for (let i = 0; i <= 4; i++) ctx.fillRect(x0 + (w * i) / 4 - 1, y + 9 * k, 2, 3 * k); // hangers
  // junction box on the left end
  const jx = x0 + 4 * k, jy = y - 12 * k;
  ctx.fillStyle = '#7d858f'; ctx.fillRect(jx, jy, 8 * k, 9 * k); ctx.fillStyle = '#ffcf3a'; ctx.fillRect(jx + 1.5 * k, jy + 1.5 * k, 5 * k, 1.6 * k);
  ctx.strokeStyle = '#1b1b1d'; ctx.lineWidth = Math.max(1, 1.2 * k); ctx.beginPath(); ctx.moveTo(jx + 4 * k, jy + 9 * k); ctx.lineTo(jx + 4 * k, cy); ctx.stroke();
  if (j % 3 === 0) { // generator / fuse cabinet on the deck
    const gx = x0 + w * (0.55 + 0.25 * hash(j * 1.7)), gw = 20 * k, gh = 13 * k;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(gx + 2 * k, y - 1, gw, 2 * k);
    ctx.fillStyle = j % 6 === 0 ? '#c88a1a' : '#4f7a4a'; ctx.fillRect(gx, y - gh, gw, gh); // generator (amber) / fuse cabinet (green)
    ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 3; i++) ctx.fillRect(gx + 2 * k, y - gh + (3 + i * 3) * k, gw - 9 * k, 1.2 * k); // vents
    ctx.fillStyle = '#2b2e32'; ctx.fillRect(gx + gw - 6 * k, y - gh + 2 * k, 4 * k, 5 * k); // panel
    const on = Math.floor(view.t * 2 + j) % 2 === 0;
    ctx.fillStyle = on ? '#5dff7a' : '#1f5a2a'; ctx.beginPath(); ctx.arc(gx + gw - 4 * k, y - gh + 3.5 * k, 1.1 * k, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(gx + gw - 4 * k, y - gh + 6 * k, 0.9 * k, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#1b1b1d'; ctx.lineWidth = Math.max(1, 1.2 * k); ctx.beginPath(); ctx.moveTo(gx + gw / 2, y); ctx.lineTo(gx + gw / 2, cy); ctx.stroke();
    if (j % 6 === 0) { ctx.fillStyle = '#5e646b'; ctx.fillRect(gx - 9 * k, y - 10 * k, 8 * k, 10 * k); ctx.fillStyle = '#8d949c'; ctx.fillRect(gx - 9 * k, y - 10 * k, 8 * k, 2 * k); } // transformer drum
  }
}

/** A high catwalk across the big work rooms (Great Hall and up): from the left bay wall to the transport post, so the
 *  busiest floor also carries the bridge frame and its crew (render.drawLedgeCrew). Virtual coords. */
export function drawRoomCatwalk(g: ShaftGeom) {
  const ws = worksiteDef();
  if (!(g.chBot === g.chBot) || ws.ceiling < 170) return;
  const k = g.k, y = g.chBot - 128 * k;
  if (y < view.vy0 - 40 || y > view.vy1 + 40) return;
  const left = g.cx - (face.w / 2) * k + 8 * k, X = (lx: number) => g.cx - g.sw / 2 + lx * k, right = X(204), w = right - left;
  woodTone = PAL.wood;
  ctx.fillStyle = 'rgba(4,3,2,.45)'; ctx.fillRect(left + 2 * k, y + 9 * k, w, 3 * k);
  wood(left, y, w, 7 * k, 777);
  ctx.fillStyle = 'rgba(30,18,8,.55)'; for (let px = left + 9 * k; px < right - 3 * k; px += 9 * k) ctx.fillRect(px, y + 0.8 * k, 0.9 * k, 5.4 * k);
  beam(left, y + 7 * k, w, 3 * k, PAL.wood, 'bg');
  for (const px of [left + w * 0.25, left + w * 0.62]) post(px, y + 10 * k, 5 * k, g.chBot - y - 10 * k - 2, PAL.wood, 'bg', 21); // legs to the floor
  ctx.fillStyle = PAL.wood.shadow; for (let px = left + 2 * k; px <= right - 2 * k; px += w / 6) ctx.fillRect(px, y - 14 * k, 2.6 * k, 14 * k);
  ctx.fillStyle = PAL.wood.base; ctx.fillRect(left + 2 * k, y - 14 * k, w - 4 * k, 2.2 * k);
  LEDGES.push({ x0: left, x1: right, y, j: -7, kind: 'bridge' });
}

/** The shaft collar: a heavy timber frame set into an earth/rock lip at the surface, dark mouth beneath. */
export function drawCollar(g: ShaftGeom, gy: number) {
  if (gy < view.vy0 - 120 || gy > view.vy1 + 60) return;
  const k = g.k, dug = S.depth; // excavation history: what the player has actually opened
  if (dug < 0.3) return; // untouched ground: nothing yet
  const mouthM = Math.min(2.5, dug);
  const mouth = ctx.createLinearGradient(0, gy, 0, gy + mouthM * CFG.ppm);
  mouth.addColorStop(0, `rgba(0,0,0,${(0.55 * Math.min(1, dug / 4)).toFixed(3)})`); mouth.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mouth; ctx.fillRect(g.cx - g.sw / 2, gy, g.sw, mouthM * CFG.ppm);
  for (const side of [-1, 1]) {
    const e = g.cx + side * g.sw / 2;
    // earth lip overhanging the mouth, with a dark underside
    ctx.fillStyle = 'rgba(8,5,3,.5)';
    ctx.beginPath(); ctx.moveTo(e + side * 6 * k, gy + 2); ctx.lineTo(e - side * 9 * k, gy + 5 * k); ctx.lineTo(e - side * 4 * k, gy + 13 * k); ctx.lineTo(e + side * 8 * k, gy + 16 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath(); ctx.moveTo(e + side * 30 * k, gy - 1); ctx.lineTo(e - side * 10 * k, gy - 1); ctx.lineTo(e - side * 8 * k, gy + 4 * k); ctx.lineTo(e + side * 4 * k, gy + 7 * k); ctx.lineTo(e + side * 30 * k, gy + 5 * k); ctx.closePath(); ctx.fill();
    if (dug < 4) continue; // the cribbing goes in once the pit is a real shaft
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
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / (34 * size))), th = (hash(seed * 3.1) - 0.5) * 1.4;
  const p = mode === 2 ? dimPal(palAt(m), 0.6) : palAt(m);
  for (let i = 0; i < n; i++) {
    const hs = seed + i * 7.7, t = (i + 0.2 + hash(hs * 5.3) * 0.6) / n, f = 0.7 + hash(hs * 8.3) * 0.6;
    const w = (40 + hash(hs) * 16) * size * f, h = w * (0.6 + hash(hs * 2.3) * 0.4), out = h * (0.3 + push + hash(hs * 3.1) * 0.2);
    drawCluster(cluster(Math.floor(hs * 13) + 7000, w, h, th, 3 + Math.floor(hash(hs * 4.4) * 3), 1, 1), x0 + (x1 - x0) * t + nx * out, y0 + (y1 - y0) * t + ny * out, p, 1, 1);
  }
}
