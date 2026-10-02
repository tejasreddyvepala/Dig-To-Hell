// Geology sampler + painter. ONE source of truth for what material is where, used by the wall renderer, the dig face,
// debris and rubble colours. Deterministic (hash-based), so returning to any depth shows the same rock.
// The wall is painted per 5 m segment into small cached offscreen canvases (half resolution, blitted smoothed).
import { CFG, MATERIALS, type Material, type MaterialId, type RGB } from './config';
import { hash } from './util';

const SEG_M = CFG.geo.segmentM;
const PX_PER_M = CFG.ppm * CFG.geo.res; // offscreen px per metre
const HALF_W_M = CFG.geo.halfWidthM; // world metres either side of the shaft centre that are painted

// ---- deterministic noise ----
const h2 = (x: number, y: number) => hash(x * 157.31 + y * 311.73 + 0.5);
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** How far (m) material boundary `i` is pushed down at world x (m): big waves + small noise. */
function boundaryOffset(i: number, wx: number) {
  return 2.4 * Math.sin(wx * 0.085 + i * 1.7) + 1.2 * Math.sin(wx * 0.21 + i * 3.1) + 1.4 * (vnoise(wx * 0.35, i * 9.1) - 0.5);
}

/** Logical material (gameplay): clean depth ranges. */
export const materialAt = (d: number): Material => {
  let m = MATERIALS[0];
  for (const x of MATERIALS) if (d >= x.from) m = x;
  return m;
};

/** Visual material at depth m (metres) and world x (metres from the shaft centre): irregular boundaries,
 *  pockets and lenses of the neighbouring material near a transition. */
export function materialAtXY(m: number, wx: number): Material {
  let idx = 0;
  for (let i = 1; i < MATERIALS.length; i++) if (m >= MATERIALS[i].from + boundaryOffset(i, wx)) idx = i;
  // near a boundary, lenses of the other material
  const next = MATERIALS[idx + 1], here = MATERIALS[idx];
  if (next && next.from - m < 5) {
    if (vnoise(wx * 0.18, m * 0.55 + 40) > 0.78 - (5 - (next.from - m)) * 0.03) return next;
  }
  if (idx > 0 && m - here.from < 6) {
    if (vnoise(wx * 0.16 + 7, m * 0.5) > 0.74 + (m - here.from) * 0.03) return MATERIALS[idx - 1];
  }
  return here;
}

// ---- material colours (shared by walls, face, debris, rubble) ----
const BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<MaterialId, Material>;
export const matById = (id: MaterialId) => BY_ID[id];
/** Rubble/debris colour of a material (what pieces of it look like once broken out). */
export const rubbleRGB = (id: MaterialId): RGB => BY_ID[id].chip;

// ---- segment painter ----
interface Seg { canvas: HTMLCanvasElement; used: number }
const cache = new Map<number, Seg>();
let frame = 0, builtThisFrame = 0;

function paintSegment(k: number): HTMLCanvasElement {
  const w = Math.round(HALF_W_M * 2 * PX_PER_M), h = Math.round(SEG_M * PX_PER_M);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(w, h), d = img.data;
  // boundary offsets depend only on x: compute once per column, not per pixel
  const nb = MATERIALS.length, off = new Float32Array(nb * w);
  for (let px = 0; px < w; px++) {
    const wx = -HALF_W_M + (px + 0.5) / PX_PER_M;
    for (let i = 1; i < nb; i++) off[i * w + px] = MATERIALS[i].from + boundaryOffset(i, wx);
  }
  for (let py = 0; py < h; py++) {
    const m = k * SEG_M + (py + 0.5) / PX_PER_M;
    for (let px = 0; px < w; px++) {
      const wx = -HALF_W_M + (px + 0.5) / PX_PER_M;
      let idx = 0;
      for (let i = 1; i < nb; i++) if (m >= off[i * w + px]) idx = i;
      let mat = MATERIALS[idx];
      // lenses / pockets near a boundary (only evaluated where it can matter)
      const next = MATERIALS[idx + 1];
      if (next && next.from - m < 5 && vnoise(wx * 0.18, m * 0.55 + 40) > 0.78 - (5 - (next.from - m)) * 0.03) mat = next;
      else if (idx > 0 && m - MATERIALS[idx].from < 6 && vnoise(wx * 0.16 + 7, m * 0.5) > 0.74 + (m - MATERIALS[idx].from) * 0.03) mat = MATERIALS[idx - 1];
      // painted shading: elongated noise (soft strata that wander), wavy light streaks, fine grain
      const n = vnoise(wx * 0.12, m * 0.32 + mat.from) * 0.65 + vnoise(wx * 0.26, m * 0.7) * 0.35;
      const warp = vnoise(wx * 0.04 + 3, m * 0.08);
      const streak = Math.sin((m + warp * 6) * 1.9 + mat.from) > 0.93 ? 0.07 : 0;
      const k2 = 0.84 + n * 0.3 + streak + (h2(px, py + k * 1000) - 0.5) * 0.05;
      const top = m < 0.8 ? 0.82 + m * 0.2 : 1; // darker topsoil just under the grass
      const i = (py * w + px) * 4;
      d[i] = Math.min(255, mat.wall[0] * k2 * top); d[i + 1] = Math.min(255, mat.wall[1] * k2 * top); d[i + 2] = Math.min(255, mat.wall[2] * k2 * top); d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  // embedded rocks (deterministic per segment) and a few faint fissures
  for (let r = 0; r < 22; r++) {
    const rx = hash(k * 91.7 + r * 3.13) * w, ry = hash(k * 13.3 + r * 7.71) * h;
    const m = k * SEG_M + ry / PX_PER_M, wx = -HALF_W_M + rx / PX_PER_M;
    const mat = materialAtXY(m, wx);
    const rad = (1.2 + hash(k + r * 5.3) * 3.2) * CFG.geo.res * 2;
    const shade = hash(k * 2.7 + r) > 0.5 ? 0.72 : 1.18;
    c.fillStyle = `rgb(${mat.chip.map((v) => Math.min(255, Math.round(v * shade))).join(',')})`;
    c.beginPath(); c.ellipse(rx, ry, rad * 1.3, rad, hash(r + k) * 3, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.beginPath(); c.ellipse(rx - rad * 0.3, ry - rad * 0.35, rad * 0.5, rad * 0.3, 0, 0, 6.283); c.fill();
  }
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.6;
  for (let f = 0; f < 2; f++) {
    let fx = hash(k * 5.1 + f) * w, fy = hash(k * 8.3 + f) * h;
    c.beginPath(); c.moveTo(fx, fy);
    for (let s = 0; s < 3; s++) { fx += (hash(k + f + s * 1.3) - 0.5) * 10; fy += hash(k * 2 + s + f) * 4; c.lineTo(fx, fy); }
    c.stroke();
  }
  return cv;
}

/** Draw the painted geology covering virtual rows [yTop, yBot] given a depth->y mapping. */
export function drawGeology(ctx: CanvasRenderingContext2D, centreX: number, yOf: (m: number) => number, mTop: number, mBot: number, vx0: number, vx1: number) {
  frame++; builtThisFrame = 0;
  const k0 = Math.max(0, Math.floor(mTop / SEG_M)), k1 = Math.floor(mBot / SEG_M);
  const x0 = centreX - HALF_W_M * CFG.ppm, wPx = HALF_W_M * 2 * CFG.ppm, hPx = SEG_M * CFG.ppm;
  // blit only the visible horizontal span of each segment
  const a = Math.max(0, vx0 - x0 - 4), b = Math.min(wPx, vx1 - x0 + 4);
  // beyond the painted span (far along the road: the construction site) the ground is a flat wall colour
  if (vx0 < x0 || vx1 > x0 + wPx) {
    for (let k = k0; k <= k1; k++) {
      ctx.fillStyle = `rgb(${materialAt(k * SEG_M).wall.map((v) => Math.round(v * 0.97)).join(',')})`;
      const y = yOf(k * SEG_M);
      if (vx0 < x0) ctx.fillRect(vx0 - 4, y, x0 - vx0 + 6, hPx + 0.5);
      if (vx1 > x0 + wPx) ctx.fillRect(x0 + wPx - 2, y, vx1 - x0 - wPx + 6, hPx + 0.5);
    }
  }
  const fadeEdges = () => { // soften the seam between painted and flat ground
    const yTop = yOf(k0 * SEG_M), yBot = yOf((k1 + 1) * SEG_M), F = 90;
    for (const [ex, dir] of [[x0, 1], [x0 + wPx, -1]] as const) {
      if (ex < vx0 - F || ex > vx1 + F) continue;
      const g = ctx.createLinearGradient(ex, 0, ex + dir * F, 0);
      const c = materialAt((k0 + 1) * SEG_M).wall.map((v) => Math.round(v * 0.97)).join(',');
      g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(dir > 0 ? ex : ex - F, yTop, F, yBot - yTop);
    }
  };
  if (b <= a) return;
  const sa = a * CFG.geo.res, sw = (b - a) * CFG.geo.res;
  for (let k = k0; k <= k1; k++) {
    let seg = cache.get(k);
    if (!seg && builtThisFrame < CFG.geo.maxBuildsPerFrame) { seg = { canvas: paintSegment(k), used: frame }; cache.set(k, seg); builtThisFrame++; }
    const y = yOf(k * SEG_M);
    if (seg) { seg.used = frame; ctx.drawImage(seg.canvas, sa, 0, sw, seg.canvas.height, x0 + a, y, b - a, hPx + 0.5); }
    else { ctx.fillStyle = `rgb(${materialAt(k * SEG_M).wall.join(',')})`; ctx.fillRect(x0 + a, y, b - a, hPx + 0.5); }
  }
  if (vx0 < x0 + 90 || vx1 > x0 + wPx - 90) fadeEdges();
  // prefetch the next segments below the view (one per frame) so digging deeper never stalls on painting
  if (builtThisFrame === 0) {
    for (let k = k1 + 1; k <= k1 + CFG.geo.prefetch; k++) if (!cache.has(k)) { cache.set(k, { canvas: paintSegment(k), used: frame }); break; }
  }
  if (cache.size > CFG.geo.cacheSegments) { // evict least recently used
    const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - CFG.geo.cacheSegments);
    for (const [key] of old) cache.delete(key);
  }
}
