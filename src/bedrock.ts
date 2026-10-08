// BEDROCK (Rock Art Rebuild): chunky, painterly 2.5D boulders — one renderer for wall, back wall, floor, embedded
// rocks, chamber/nook edges and rubble.
//   Shape: a chunky silhouette (6–10 contour points; straight geological edges joined by ROUNDED corners) — never
//   spikes, shards or bubbles. Volume: the body is divided into 3–6 sloped planes that meet at an off-centre peak
//   (like a faceted dome), so a single light direction makes one side glow, the middle read as mid-tone and the far
//   side fall into shadow. Depth: each rock casts a soft contact/occlusion shadow behind and below itself (no
//   outlines anywhere). Light: per rock, the existing lamps give a direction + strength (piecewise falloff across the
//   lamp radius); planes facing that direction go lit-stone → highlight, others stay mid/shadow. A few plane
//   boundaries carry a fine crack; only strongly lit edges that face the lamp get a short warm accent.
// Geometry is a pure function of its seed and size and is cached (Path2D); only colours vary with light.
import { MATERIALS, type Material, type RGB } from './config';
import { materialAt } from './geo';
import { hash } from './util';
import { ctx } from './view';

type Pt = [number, number];
interface Plane { path: Path2D; nx: number; ny: number }
interface Edge { x0: number; y0: number; x1: number; y1: number; nx: number; ny: number }
export interface Cluster { sil: Path2D; planes: Plane[]; edges: Edge[]; cracks: Path2D; r: number; w: number; h: number; v: number; hue: number }

// ---------- palette (value ladder from the reference, tinted a little by the local geology) ----------
export interface Pal { crev: RGB; shadow: RGB; mid: RGB; lit: RGB; hi: RGB; back: RGB; ore?: RGB[]; glow?: boolean }
const BASE: Pal = { crev: [24, 14, 9], shadow: [50, 39, 32], mid: [108, 77, 56], lit: [166, 100, 50], hi: [232, 160, 74], back: [34, 25, 19] };
const pals = new Map<string, Pal>();
export function palOf(mat: Material): Pal {
  let p = pals.get(mat.id);
  if (p) return p;
  const avg = (mat.wall[0] + mat.wall[1] + mat.wall[2]) / 3 || 1;
  const warm = [1.05, 1, 0.92], val = Math.pow(avg / 92, 0.35); // depth themes: hue AND value follow the layer
  const rich = mat.ore || mat.glow ? 1.15 : mat.fam === 'dirt' ? 0.6 : 1; // every layer's walls wear its own material colour
  const tint = mat.wall.map((v, i) => (1 + rich * (v / avg - 1)) * (mat.fam === 'dirt' ? warm[i] : 1) * val) as RGB; // clay red, stone warm grey, cave dark cool, gold, ruby…
  const t = (c: RGB, k = 1): RGB => [c[0] * tint[0] * k, c[1] * tint[1] * k, c[2] * tint[2] * k];
  const hi: RGB = mat.ore ? [(BASE.hi[0] + mat.ore[0][0]) / 2, (BASE.hi[1] + mat.ore[0][1]) / 2, (BASE.hi[2] + mat.ore[0][2]) / 2] : BASE.hi;
  p = { crev: BASE.crev, shadow: t(BASE.shadow), mid: t(BASE.mid), lit: t(BASE.lit, 0.97), hi, back: t(BASE.back), ore: mat.ore, glow: mat.glow };
  pals.set(mat.id, p);
  return p;
}
const dims = new Map<string, Pal>();
/** A deeper/darker variant (back bedrock, lower floor bed): lower values, same family. */
export function dimPal(p: Pal, k: number): Pal {
  const key = `${p.mid.join()}|${k}`;
  let d = dims.get(key);
  if (!d) { const f = (c: RGB, q: number): RGB => [c[0] * q, c[1] * q, c[2] * q]; d = { crev: p.crev, shadow: f(p.shadow, 0.6 + 0.4 * k), mid: f(p.mid, k), lit: f(p.lit, 0.45 + 0.55 * k), hi: f(p.hi, 0.45 + 0.55 * k), back: p.back, ore: p.ore, glow: p.glow }; dims.set(key, d); }
  return d;
}
export const palAt = (m: number) => palOf(materialAt(Math.max(0, m)));
export const palById = (id: string) => palOf(MATERIALS.find((x) => x.id === id) ?? MATERIALS[0]);

// ---------- boulder geometry (cached; pure function of the arguments) ----------
const cache = new Map<string, Cluster>();
/** seed · w,h (current units) · theta: lean of the rock · major: plane count (3–6) · secondary: cracks ·
 *  unit: (unused, kept for call compatibility) · flat: flattened base (sits on / in the ground). */
export function cluster(seed: number, w: number, h: number, theta: number, major: number, secondary: number, _unit = 1, flat = false): Cluster {
  const key = `${seed}|${w | 0}|${h | 0}|${(theta * 10) | 0}|${major}|${secondary}|${flat ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  if (cache.size > 20000) cache.clear(); // generous: a full screen of panels + floor + back wall must never thrash it
  let i = 0;
  const r = () => hash(seed * 7.31 + ++i * 1.618);
  const n = 8 + Math.floor(r() * 3), lean = Math.tan(Math.max(-0.5, Math.min(0.5, theta * 0.35)));
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = ((k + (r() - 0.5) * 0.45) / n) * Math.PI * 2 - Math.PI / 2;
    const rad = 0.9 + r() * 0.1;
    let y = Math.sin(a) * h * 0.5 * rad;
    if (flat && y > h * 0.3) y = h * 0.3 + (y - h * 0.3) * 0.3;
    const x = Math.cos(a) * w * 0.5 * rad;
    pts.push([x + y * lean, y]);
  }
  // silhouette: straight edges, rounded corners (chunky, never spiky)
  const sil = new Path2D(), lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const A = (k: number) => lerp(pts[k % n], pts[(k + 1) % n], 0.42), B = (k: number) => lerp(pts[k % n], pts[(k + 1) % n], 0.58); // round boulders
  sil.moveTo(...A(0));
  for (let k = 0; k < n; k++) { sil.lineTo(...B(k)); sil.quadraticCurveTo(pts[(k + 1) % n][0], pts[(k + 1) % n][1], ...A(k + 1)); }
  sil.closePath();
  // planes: contiguous contour groups joined to an off-centre peak (upper side larger: the rock sits on its base)
  const peak: Pt = [(r() - 0.5) * w * 0.3, -h * (0.08 + r() * 0.16)];
  const m = Math.max(3, Math.min(6, major, n));
  const starts: number[] = [];
  for (let g = 0; g < m; g++) starts.push(Math.floor((g * n) / m + (g ? (r() - 0.5) * 0.8 : 0)));
  const planes: Plane[] = [], cracks = new Path2D();
  for (let g = 0; g < m; g++) {
    const s0 = starts[g], s1 = g + 1 < m ? starts[g + 1] : n;
    const poly: Pt[] = [peak];
    for (let k = s0; k <= s1; k++) poly.push(pts[k % n]);
    const mid = pts[Math.floor((s0 + s1) / 2) % n];
    let nx = (mid[0] - peak[0]) / (w * 0.5), ny = (mid[1] - peak[1]) / (h * 0.5);
    const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    const p = new Path2D(); poly.forEach(([x, y], q) => (q ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath();
    planes.push({ path: p, nx, ny });
  }
  for (let q = 0; q < secondary; q++) { // a fine crack along a plane boundary (part of it only)
    const v = pts[starts[Math.floor(r() * m)] % n], t0 = 0.25 + r() * 0.2, t1 = 0.6 + r() * 0.3;
    const a = lerp(peak, v, t0), b = lerp(peak, v, t1);
    cracks.moveTo(...a); cracks.lineTo(b[0] + (r() - 0.5) * w * 0.05, b[1] + (r() - 0.5) * h * 0.05);
  }
  // straight contour edges with their outward normals (for the light-facing accent)
  const edges: Edge[] = [];
  for (let k = 0; k < n; k++) {
    const a = A(k), b = B(k), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let nx = dy / L, ny = -dx / L;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    edges.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], nx, ny });
  }
  const hv = hash(seed * 3.77 + 0.13);
  c = { sil, planes, edges, cracks, r: Math.max(w, h) * 0.5, w, h, v: hv < 0.16 ? 1.16 : 0.92 + hash(seed * 5.31) * 0.16, hue: (hash(seed * 8.9) - 0.5) * 0.08 };
  cache.set(key, c);
  return c;
}

// ---------- lights (the existing mine lamps, read-only) ----------
export interface RockLight { x: number; y: number; r: number; s: number }
let lights: RockLight[] = [];
let space = { ox: 0, oy: 0, s: 1 }; // current drawing space -> world (virtual px)
export function setRockLights(l: RockLight[]) { lights = l; }
export function setRockSpace(ox: number, oy: number, s: number) { space = { ox, oy, s }; }
export function nearLight(x: number, y: number, r: number) { return lightAt(x, y, r) > 0; }
/** 0..1: how much lamp light reaches this rock (for blending the lit redraw over the cached unlit wall). */
export function lightAt(x: number, y: number, r: number) {
  const wx = space.ox + x * space.s, wy = space.oy + y * space.s, wr = r * space.s;
  let f = 0;
  for (const l of lights) { const d = Math.hypot(l.x - wx, l.y - wy) - wr * 0.5; if (d < l.r) f = Math.max(f, 1 - Math.max(0, d) / l.r); }
  return f;
}
/** Material response across the lamp radius: strong near the core, warm-brown band, a faint fringe, nothing at the edge. */
function falloff(t: number) {
  if (t < 0.25) return 1;
  if (t < 0.55) return 1 - ((t - 0.25) / 0.3) * 0.45;
  if (t < 0.8) return 0.55 - ((t - 0.55) / 0.25) * 0.4;
  if (t < 1) return 0.15 - ((t - 0.8) / 0.2) * 0.15;
  return 0;
}

const tones = new Map<string, Pal>();
/** Per-boulder tone: value v and a small warm/cool hue shift (neighbours separate without seams). Cached. */
function tone(p: Pal, v: number, hue: number): Pal {
  const key = `${p.mid.join()}|${v.toFixed(2)}|${hue.toFixed(2)}`;
  let t = tones.get(key);
  if (!t) {
    const f = (c: RGB): RGB => [c[0] * v * (1 + hue), c[1] * v, c[2] * v * (1 - hue)];
    t = { crev: p.crev, shadow: f(p.shadow), mid: f(p.mid), lit: f(p.lit), hi: p.hi, back: p.back };
    if (tones.size > 60000) tones.clear(); // (~150 tones per palette × every dim variant: must never thrash)
    tones.set(key, t);
  }
  return t;
}
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

/** Draw a boulder centred at (x, y) in the current space.
 *  lit: lamp response (1 normal; >1 = extra bounce on the work floor) · contrast: ambient plane separation
 *  (back wall low, foreground high) · alpha: overall opacity. */
/** 1–3 faceted gem crystals set into a boulder (deterministic per rock shape): lit face, dark face, a white glint. */
function gems(cx: CanvasRenderingContext2D, c: Cluster, ore: RGB[]) {
  const sd = c.w * 13.37 + c.h * 7.31, n = hash(sd) < 0.45 ? 1 : 0; // about half the boulders carry one stone
  for (let i = 0; i < n; i++) {
    const gx = (hash(sd + i * 3.1) - 0.5) * c.w * 0.55, gy = (hash(sd + i * 5.7) - 0.6) * c.h * 0.5, r = c.r * (0.07 + hash(sd + i * 7.9) * 0.05);
    const col = ore[Math.floor(hash(sd + i * 9.3) * ore.length)], a = hash(sd + i) * 1.2;
    cx.save(); cx.translate(gx, gy); cx.rotate(a - 0.6);
    cx.fillStyle = css([col[0] * 0.55, col[1] * 0.55, col[2] * 0.6]); cx.beginPath(); cx.moveTo(0, -r * 1.5); cx.lineTo(r, -r * 0.2); cx.lineTo(r * 0.6, r); cx.lineTo(-r * 0.6, r); cx.lineTo(-r, -r * 0.2); cx.closePath(); cx.fill();
    cx.fillStyle = css(col); cx.beginPath(); cx.moveTo(0, -r * 1.5); cx.lineTo(r, -r * 0.2); cx.lineTo(r * 0.6, r); cx.lineTo(0, r * 0.2); cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.85)'; cx.beginPath(); cx.moveTo(0, -r * 1.2); cx.lineTo(r * 0.35, -r * 0.4); cx.lineTo(0, -r * 0.2); cx.closePath(); cx.fill();
    cx.restore();
  }
}

export function drawCluster(c: Cluster, x: number, y: number, p: Pal, lit = 1, contrast = 1, alpha = 1, cx = ctx) {
  cx.save(); cx.translate(x, y);
  if (alpha < 1) cx.globalAlpha *= alpha;
  // contact / occlusion shadow behind and below the rock
  cx.save(); cx.translate(c.w * 0.03, c.h * 0.07); cx.fillStyle = css(p.crev, 0.5); cx.fill(c.sil); cx.restore();
  if (c.v !== 1 || c.hue) p = tone(p, c.v, c.hue);
  // light: one direction + strength per rock from the nearby lamps
  let lx = 0, ly = 0, I = 0;
  if (lit > 0 && lights.length) {
    const wx = space.ox + x * space.s, wy = space.oy + y * space.s;
    for (const l of lights) {
      const dx = l.x - wx, dy = l.y - wy, d = Math.hypot(dx, dy) || 1, f = falloff(d / l.r) * l.s;
      if (f <= 0) continue;
      lx += (dx / d) * f; ly += (dy / d) * f; I = Math.max(I, f);
    }
    const L = Math.hypot(lx, ly) || 1; lx /= L; ly /= L; I = Math.min(1, I * lit);
  }
  cx.fillStyle = css(p.mid); cx.fill(c.sil);
  cx.save(); cx.clip(c.sil);
  for (const pl of c.planes) {
    const ta = -pl.ny * 0.85 - pl.nx * 0.25; // ambient: from above, a little left
    let col = mixc(p.shadow, p.mid, Math.max(0, Math.min(1, 0.5 + 0.55 * ta * contrast)));
    if (I > 0.01) {
      const tl = pl.nx * lx + pl.ny * ly, face = Math.max(0, Math.min(1, (tl + 0.05) / 0.95)) ** 1.35, w = I * face;
      if (tl < -0.2) col = mixc(col, p.shadow, Math.min(1, I * 0.9) * 0.6); // the side turned away sinks into shadow
      else if (w > 0.01) col = w < 0.5 ? mixc(col, p.lit, w / 0.5) : mixc(p.lit, p.hi, Math.min(1, (w - 0.5) / 0.4) * (I > 0.65 ? 1 : 0.4));
    }
    cx.fillStyle = css(col); cx.fill(pl.path);
  }
  if (!(lit > 0 && lit < 0.5)) { // (the faint back wall skips it: drawn live, many stones)
  // painterly volume: a soft sheen on the side facing the light (ambient top-left, or warm toward a near lamp) and a
  // soft occlusion where the boulder turns under — rounded mass, not flat facets
  const sx = (I > 0.05 ? lx : -0.45) * c.w * 0.28, sy = (I > 0.05 ? ly : -0.8) * c.h * 0.28, sr = c.r * 0.95;
  const sh = cx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sh.addColorStop(0, I > 0.05 ? css(p.hi, 0.1 + 0.28 * I) : css(p.lit, 0.14 * contrast)); sh.addColorStop(1, css(p.lit, 0));
  cx.fillStyle = sh; cx.fill(c.sil);
  const ao = cx.createLinearGradient(0, -c.h * 0.05, 0, c.h * 0.5);
  ao.addColorStop(0, css(p.crev, 0)); ao.addColorStop(1, css(p.crev, 0.4));
  cx.fillStyle = ao; cx.fill(c.sil);
  }
  cx.strokeStyle = p.glow ? 'rgba(255,120,40,.85)' : css(p.crev, 0.55); cx.lineWidth = Math.max(0.6, Math.min(p.glow ? 2 : 1.2, c.r * (p.glow ? 0.03 : 0.018))); cx.lineCap = 'round'; cx.stroke(c.cracks);
  if (p.ore && c.r > 5) gems(cx, c, p.ore);
  cx.restore();
  if (c.r > 8 && contrast >= 0.9) { // a thin warm highlight along the top of the boulder (light from above)
    cx.strokeStyle = css(p.lit, 0.32 * contrast); cx.lineWidth = Math.max(0.7, Math.min(1.6, c.r * 0.03)); cx.lineCap = 'round';
    cx.beginPath();
    for (const e of c.edges) if (e.ny < -0.75) { cx.moveTo(e.x0, e.y0); cx.lineTo(e.x1, e.y1); }
    cx.stroke();
  }
  if (I > 0.55 && c.r > 8) { // a short warm accent on contour edges that face the lamp (only a fraction of the outline)
    cx.strokeStyle = css(p.hi, Math.min(1, (I - 0.55) * 2)); cx.lineWidth = Math.max(0.7, Math.min(1.5, c.r * 0.022)); cx.lineCap = 'round';
    cx.beginPath();
    for (const e of c.edges) if (e.nx * lx + e.ny * ly > 0.82) { cx.moveTo(e.x0, e.y0); cx.lineTo(e.x1, e.y1); }
    cx.stroke();
  }
  cx.restore();
}
