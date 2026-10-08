// REAL-LOOKING LAVA: a procedural, animated lava texture rendered each frame at low resolution and scaled up smoothly.
//   • A tileable fractal value-noise field (256², built once) is sampled with DOMAIN WARPING that drifts over time, so
//     the surface flows and churns instead of sliding.
//   • The warped value becomes a TEMPERATURE: high values cool into dark crust plates, low values are molten; a ridged
//     second octave cuts thin white-hot cracks between the plates; slow pulses make hot spots breathe.
//   • Temperature goes through a black-body colour ramp (black crust → deep red → orange → yellow → near white).
//   • POOLS flow sideways and churn; FALLS stretch the noise vertically and scroll it down fast (molten streaks) with
//     cooler, darker edges. A BLOOM pass (the same image downsampled and added) gives the heat glow.
// Cost: one ImageData per field per frame at ~1/4 resolution (a few thousand px for falls, ~20k for the sea).

const N = 256;
const field = new Float32Array(N * N);
{ // tileable fBm value noise (4 octaves), normalised to 0..1
  const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const oct = (cell: number, seed: number) => {
    const g = N / cell, grid = new Float32Array((g + 1) * (g + 1));
    for (let y = 0; y <= g; y++) for (let x = 0; x <= g; x++) grid[y * (g + 1) + x] = rnd(((x % g) + (y % g) * 977) * 1.31 + seed);
    return (px: number, py: number) => {
      const gx = px / cell, gy = py / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = g + 1;
      const a = grid[y0 * w + x0], b = grid[y0 * w + x0 + 1], c = grid[(y0 + 1) * w + x0], d = grid[(y0 + 1) * w + x0 + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  };
  const os = [oct(64, 1), oct(32, 7), oct(16, 13), oct(8, 29)], amp = [0.53, 0.27, 0.13, 0.07];
  let mn = 1, mx = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let o = 0; o < 4; o++) s += os[o](x, y) * amp[o]; field[y * N + x] = s; mn = Math.min(mn, s); mx = Math.max(mx, s); }
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - mn) / (mx - mn);
}
/** Bilinear sample of the tileable field (coordinates in field pixels, any range). */
function nz(x: number, y: number) {
  const xi = x >= 0 ? x | 0 : (x | 0) - 1, yi = y >= 0 ? y | 0 : (y | 0) - 1, fx = x - xi, fy = y - yi;
  const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
  const a = field[y0 * N + x0], b = field[y0 * N + x1], c = field[y1 * N + x0], d = field[y1 * N + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// black-body ramp: temperature 0..1 → rgb
const RAMP = new Uint8ClampedArray(256 * 3);
{
  const stops: [number, number, number, number][] = [[0, 16, 6, 5], [0.22, 48, 10, 6], [0.4, 128, 20, 6], [0.56, 212, 54, 8], [0.7, 255, 116, 18], [0.84, 255, 186, 60], [0.95, 255, 236, 150], [1, 255, 252, 220]];
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let j = 0; while (j < stops.length - 2 && t > stops[j + 1][0]) j++;
    const [t0, r0, g0, b0] = stops[j], [t1, r1, g1, b1] = stops[j + 1], k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    RAMP[i * 3] = r0 + (r1 - r0) * k; RAMP[i * 3 + 1] = g0 + (g1 - g0) * k; RAMP[i * 3 + 2] = b0 + (b1 - b0) * k;
  }
}

interface Buf { cv: HTMLCanvasElement; c: CanvasRenderingContext2D; img: ImageData; glow: HTMLCanvasElement; gc: CanvasRenderingContext2D; t: number; sig: string }
const bufs = new Map<string, Buf>();
function buf(key: string, w: number, h: number): Buf {
  let b = bufs.get(key);
  if (!b || b.cv.width !== w || b.cv.height !== h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d')!;
    const glow = document.createElement('canvas'); glow.width = Math.max(2, w >> 2); glow.height = Math.max(2, h >> 2);
    b = { cv, c, img: c.createImageData(w, h), glow, gc: glow.getContext('2d')!, t: -1, sig: '' };
    bufs.set(key, b);
  }
  return b;
}

export interface LavaOpts {
  mode: 'pool' | 'fall';
  wx: number; wy: number; // world anchor of the field's top-left (so it doesn't slide with the camera)
  scale: number; // field px per screen px
  heat?: number; // 0..1 overall temperature bias (falls/pool surface are hotter)
  edge?: boolean; // falls: cool, darker edges
  top?: number; // pools: rows (0..1) near the top get hotter (the churning surface)
}

/** Draw an animated lava field into the screen rect (x, y, w, h). `t` = time in seconds. */
export function drawLava(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, t: number, o: LavaOpts) {
  if (w < 2 || h < 2) return;
  const fall = o.mode === 'fall', RES = fall ? 6 : 6, bw = Math.max(2, Math.ceil(w / RES)), bh = Math.max(2, Math.ceil(h / RES));
  const B = buf(key, bw, bh), d = B.img.data, s = o.scale * RES, heat = o.heat ?? 0;
  // re-render the texture at most ~30×/s (and when the anchor moves); in between, redraw the cached image
  const sig = `${Math.round(o.wx)}|${Math.round(o.wy)}`, fresh = t - B.t >= (fall ? 1 / 30 : 1 / 20) || t < B.t || sig !== B.sig;
  if (fresh) { B.t = t; B.sig = sig; render(B, bw, bh, d, s, heat, fall, t, o); }
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(B.cv, x, y, w, h);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fall ? 0.35 : 0.22;
  const gp = fall ? w * 0.9 : 0;
  ctx.drawImage(B.glow, x - gp, y - (fall ? 0 : h * 0.06), w + gp * 2, h * (fall ? 1 : 1.06));
  ctx.restore();
}

function render(B: Buf, bw: number, bh: number, d: Uint8ClampedArray, s: number, heat: number, fall: boolean, t: number, o: LavaOpts) {
  for (let j = 0; j < bh; j++) {
    const fy = o.wy + j * s, ty = j / (bh - 1);
    for (let i = 0; i < bw; i++) {
      const fx = o.wx + i * s;
      let temp: number;
      if (fall) { // molten streaks racing down; a little sideways wobble
        const v = fy * 0.18 - t * 38, u = fx * 1.4;
        const w1 = nz(u * 0.5 + 40, v * 0.3);
        const n = nz(u + w1 * 6, v);
        const streak = 1 - Math.abs(nz(u * 1.7 + 90, v * 0.6) - 0.5) * 2;
        temp = 0.5 + (0.5 - n) * 0.6 + streak * streak * streak * 0.32 + heat * 0.12;
        if (o.edge) { const e = Math.abs(i / (bw - 1) - 0.5) * 2; temp -= e * e * 0.55; }
      } else { // pool: crust plates drifting + churning, white-hot cracks between them
        const u = fx * 0.9 + t * 3.2, v = fy * 0.9;
        const w1 = nz(u * 0.45 + t * 0.9, v * 0.45 + 17), w2 = nz(u * 0.45 + 63, v * 0.45 - t * 0.7);
        const n = nz(u + w1 * 22, v + w2 * 22);
        const r = 1 - Math.abs(nz(u * 1.9 + w2 * 10 + 133, v * 1.9 + w1 * 10) - 0.5) * 2; // ridged: thin veins
        const plate = Math.min(1, Math.max(0, (n - 0.36) / 0.16)); // most of the surface is crust
        const r2 = r * r, r4 = r2 * r2;
        temp = 0.66 - plate * 0.56 + r4 * r4 * r * 0.62 + 0.05 * Math.sin(t * 1.6 + n * 14) + heat * 0.1;
        if (o.top) temp += Math.max(0, 1 - ty / o.top) * 0.14; // hotter churn right at the surface
        temp -= ty * 0.12; // deeper = a little cooler/darker
      }
      const q = Math.max(0, Math.min(255, (temp * 255) | 0)) * 3, p = (j * bw + i) * 4;
      d[p] = RAMP[q]; d[p + 1] = RAMP[q + 1]; d[p + 2] = RAMP[q + 2]; d[p + 3] = 255;
    }
  }
  B.c.putImageData(B.img, 0, 0);
  // bloom source: the image downsampled (added back larger than the source: the heat glows past its edges)
  B.gc.clearRect(0, 0, B.glow.width, B.glow.height); B.gc.drawImage(B.cv, 0, 0, B.glow.width, B.glow.height);
}
