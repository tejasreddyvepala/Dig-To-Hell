// Surface landscape: a calm, painted contrast to the mine. Cosmetic day/night cycle (no gameplay effect),
// layered parallax mountains, deterministic tree clusters, painted clouds, an occasional distant flock, stars + moon.
import { CFG } from './config';
import { ctx, view } from './view';
import { hash } from './util';

const D = CFG.daynight;
type C3 = [number, number, number];
const mix3 = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const css = (c: C3, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---- palettes: the whole backdrop (sky, peaks, snow, haze, three pine forests, clouds) per time of day ----
interface Pal { top: C3; mid: C3; hor: C3; sun: C3; farSh: C3; farLit: C3; snowLit: C3; snowSh: C3; midSh: C3; midLit: C3; haze: C3; fFar: C3; fMid: C3; fNear: C3; rim: C3; cTop: C3; cBot: C3 }
const DAY: Pal = { top: [64, 128, 210], mid: [118, 172, 232], hor: [214, 232, 246], sun: [255, 246, 220], farSh: [118, 138, 180], farLit: [188, 200, 224], snowLit: [252, 253, 255], snowSh: [196, 210, 234], midSh: [80, 104, 138], midLit: [138, 160, 184], haze: [200, 222, 240], fFar: [88, 122, 132], fMid: [48, 86, 80], fNear: [28, 58, 48], rim: [150, 196, 140], cTop: [255, 255, 255], cBot: [198, 212, 232] };
const GOLD: Pal = { top: [50, 50, 122], mid: [206, 116, 142], hor: [255, 184, 102], sun: [255, 218, 146], farSh: [98, 86, 152], farLit: [242, 160, 118], snowLit: [255, 214, 170], snowSh: [168, 150, 206], midSh: [62, 58, 112], midLit: [214, 124, 104], haze: [206, 136, 152], fFar: [80, 76, 122], fMid: [42, 56, 72], fNear: [22, 38, 40], rim: [250, 160, 92], cTop: [138, 104, 164], cBot: [255, 168, 126] };
const DUSK: Pal = { top: [30, 32, 74], mid: [108, 66, 112], hor: [228, 112, 82], sun: [255, 150, 92], farSh: [70, 56, 100], farLit: [152, 92, 112], snowLit: [222, 172, 184], snowSh: [120, 110, 162], midSh: [50, 42, 78], midLit: [102, 66, 92], haze: [152, 92, 112], fFar: [56, 44, 78], fMid: [34, 30, 54], fNear: [20, 20, 34], rim: [182, 92, 82], cTop: [88, 70, 112], cBot: [222, 122, 112] };
const NIGHT: Pal = { top: [12, 18, 44], mid: [22, 32, 66], hor: [40, 54, 92], sun: [210, 220, 255], farSh: [38, 48, 80], farLit: [58, 70, 108], snowLit: [160, 176, 216], snowSh: [96, 110, 154], midSh: [28, 36, 62], midLit: [40, 50, 82], haze: [46, 60, 96], fFar: [28, 36, 60], fMid: [18, 26, 44], fNear: [12, 16, 30], rim: [48, 60, 96], cTop: [44, 52, 86], cBot: [32, 40, 70] };
const DAWN: Pal = { top: [58, 74, 124], mid: [170, 130, 162], hor: [252, 182, 132], sun: [255, 222, 172], farSh: [100, 96, 142], farLit: [222, 162, 152], snowLit: [255, 228, 218], snowSh: [170, 166, 206], midSh: [70, 72, 110], midLit: [172, 122, 122], haze: [222, 172, 162], fFar: [80, 80, 112], fMid: [46, 54, 78], fNear: [26, 34, 46], rim: [222, 152, 122], cTop: [204, 172, 204], cBot: [255, 192, 162] };
const KEYS: [number, Pal][] = [[0, DAWN], [0.08, DAY], [0.38, DAY], [0.48, GOLD], [0.6, GOLD], [0.68, DUSK], [0.76, NIGHT], [0.95, NIGHT], [1, DAWN]];
let palCache = { p: -1, pal: DAY };
function pal(): Pal {
  const p = dayPhase();
  if (Math.abs(p - palCache.p) < 0.0005) return palCache.pal;
  let out = DAY;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a, A] = KEYS[i], [b, B] = KEYS[i + 1];
    if (p >= a && p <= b) { const k = (p - a) / (b - a), e = k * k * (3 - 2 * k); out = {} as Pal; for (const key in A) (out as any)[key] = mix3((A as any)[key], (B as any)[key], e); break; }
  }
  palCache = { p, pal: out };
  return out;
}

/** Time of day 0..1 (0 = dawn). Starts in the morning each session. */
export const dayPhase = () => ((view.t + D.startPhase * D.cycleSecs) % D.cycleSecs) / D.cycleSecs;

/** 0 = full day, 1 = deep night. */
export function nightness() {
  const p = dayPhase();
  if (p < 0.64) return p < 0.04 ? 1 - p / 0.04 : 0;
  if (p < 0.77) return (p - 0.64) / 0.13;
  if (p < 0.96) return 1;
  return 1 - (p - 0.96) / 0.04 * 0.6;
}
/** 0..1 how much the golden-hour warmth is on. */
function sunset() { const p = dayPhase(); return Math.min(1, Math.max(0, 1 - Math.abs(p - 0.56) / 0.12) * 1.4) + Math.max(0, 1 - Math.abs(p - 0.02) / 0.05) * 0.7; }

/** Daylight tint applied to landscape colours (night = cool and dark, sunset = warm). */
function lit(c: C3): C3 {
  const n = nightness(), w = sunset();
  const warm = mix3(c, [c[0] * 1.12 + 18, c[1] * 0.92, c[2] * 0.82], w * 0.6);
  return mix3(warm, [c[0] * 0.22 + 8, c[1] * 0.26 + 12, c[2] * 0.36 + 26], n * 0.85);
}

export function drawLandscape(gy: number, x0: number, w: number) {
  const H = view.H / Math.max(0.3, view.zoom), x1 = x0 + w, n = nightness(), P = pal();
  const skyTop = Math.min(view.vy0, gy - H);
  const g = ctx.createLinearGradient(0, gy - H * 1.05, 0, gy - H * 0.05);
  g.addColorStop(0, css(P.top)); g.addColorStop(0.55, css(P.mid)); g.addColorStop(1, css(P.hor));
  ctx.fillStyle = css(P.top); ctx.fillRect(x0, skyTop - 10, w, gy - H * 1.05 - skyTop + 12);
  ctx.fillStyle = g; ctx.fillRect(x0, gy - H * 1.05, w, H * 1.05 + 2);

  if (n > 0.02) { // stars
    for (let i = 0; i < 110; i++) {
      const sx = x0 + hash(i * 3.1) * w, sy = gy - H * 0.3 - hash(i * 7.3) * H * 0.95;
      if (sy < view.vy0) continue;
      ctx.fillStyle = `rgba(255,255,240,${(n * (0.35 + 0.65 * Math.abs(Math.sin(view.t * 0.7 + i)))).toFixed(2)})`;
      const r = hash(i) > 0.88 ? 2.2 : 1.2; ctx.fillRect(sx, sy, r, r);
    }
  }
  const p = dayPhase();
  const arc = (k: number) => ({ x: x0 + w * (0.08 + 0.84 * k), y: gy - H * 0.2 - Math.sin(Math.PI * k) * H * 0.6 });
  if (p < 0.72) { // the sun, with a huge warm glow and soft rays at golden hour
    const s = arc(p / 0.72), r = H * 0.035, ss = sunset();
    const R = H * (0.35 + 0.35 * ss);
    const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
    sg.addColorStop(0, css(P.sun, 0.75 * (1 - n))); sg.addColorStop(0.25, css(P.sun, 0.25 * (1 - n))); sg.addColorStop(1, css(P.sun, 0));
    ctx.fillStyle = sg; ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2);
    if (ss > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(view.t * 0.05 + i) * 0.04, L = H * (0.9 + hash(i) * 0.5), wd = 0.05 + hash(i * 3) * 0.05;
        const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, L); rg.addColorStop(0, css(P.sun, 0.12 * ss)); rg.addColorStop(1, css(P.sun, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(a - wd) * L, s.y + Math.sin(a - wd) * L); ctx.lineTo(s.x + Math.cos(a + wd) * L, s.y + Math.sin(a + wd) * L); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = css(mix3(P.sun, [255, 255, 255], 0.35)); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill();
  }
  if (p > 0.68 || p < 0.03) { // moon
    const k = ((p - 0.68 + 1) % 1) / 0.35, m = arc(Math.min(1, k)), r = H * 0.024;
    const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 5); mg.addColorStop(0, `rgba(200,215,255,${(0.25 * n).toFixed(3)})`); mg.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(m.x - r * 5, m.y - r * 5, r * 10, r * 10);
    ctx.fillStyle = `rgba(235,240,255,${Math.min(1, n * 1.2)})`; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = css(P.top); ctx.beginPath(); ctx.arc(m.x + r * 0.4, m.y - r * 0.27, r * 0.87, 0, 6.283); ctx.fill();
  }

  drawClouds(gy, x0, w, P);
  drawBirds(gy, x0, w);

  // two snow-capped ranges (far = big + hazy, near = darker), mist between, then three pine forests
  range(gy, x0, x1, { amp: H * 0.5, cw: H * 0.5, par: 0.93, seed: 9.1, sh: mix3(P.farSh, P.hor, 0.5), lit: mix3(P.farLit, P.hor, 0.45), snow: 0.22, base: gy - H * 0.12 }, P);
  mist(gy - H * 0.3, H * 0.3, x0, w, P.haze, 0.35);
  range(gy, x0, x1, { amp: H * 0.62, cw: H * 0.52, par: 0.86, seed: 1.3, sh: P.farSh, lit: P.farLit, snow: 0.24, base: gy - H * 0.06 }, P);
  mist(gy - H * 0.16, H * 0.26, x0, w, P.haze, 0.55);
  range(gy, x0, x1, { amp: H * 0.42, cw: H * 0.42, par: 0.7, seed: 4.7, sh: P.midSh, lit: P.midLit, snow: 0.14, base: gy - H * 0.04 }, P);
  mist(gy - H * 0.09, H * 0.16, x0, w, P.haze, 0.45);
  forest(gy, x0, x1, { par: 0.56, seed: 2.1, hMin: H * 0.05, hMax: H * 0.09, step: H * 0.011, hill: H * 0.1, col: P.fFar, rim: null });
  mist(gy - H * 0.04, H * 0.1, x0, w, P.haze, 0.3);
  forest(gy, x0, x1, { par: 0.4, seed: 5.3, hMin: H * 0.09, hMax: H * 0.16, step: H * 0.022, hill: H * 0.035, col: P.fMid, rim: P.rim, detail: 1 });
  forest(gy, x0, x1, { par: 0.22, seed: 8.9, hMin: H * 0.16, hMax: H * 0.3, step: H * 0.05, hill: 0, col: P.fNear, rim: P.rim, sparse: 0.45, detail: 2 });
}

/** World-x (with parallax) helper: screen x of a world point for a layer. */
const sx = (wx: number, par: number) => wx - view.panX * par;

interface RangeDef { amp: number; cw: number; par: number; seed: number; sh: C3; lit: C3; snow: number; base: number }
/** A mountain range: jagged peaks with a sunlit flank, a shaded flank split by a crease, snow caps. Deterministic. */
function range(gy: number, x0: number, x1: number, R: RangeDef, P: Pal) {
  const off = view.panX * R.par, i0 = Math.floor((x0 + off) / R.cw) - 2, i1 = Math.ceil((x1 + off) / R.cw) + 2;
  type Pt = [number, number];
  const peak = (i: number): Pt => {
    const hero = hash(i * 7.7 + R.seed) > 0.8 ? 1.15 : 1;
    const h = R.amp * Math.pow(0.42 + 0.58 * hash(i * 1.7 + R.seed), 1.1) * hero;
    return [sx((i + 0.2 + 0.6 * hash(i * 3.9 + R.seed)) * R.cw, R.par), R.base - h];
  };
  // ridge: peak → jagged descent → valley → jagged ascent → next peak
  const ridge: Pt[] = [], peaks: { p: Pt; at: number }[] = [];
  for (let i = i0; i <= i1; i++) {
    const a = peak(i), b = peak(i + 1);
    peaks.push({ p: a, at: ridge.length }); ridge.push(a);
    const vx = a[0] + (b[0] - a[0]) * (0.38 + 0.24 * hash(i * 5.1 + R.seed)), vy = Math.max(a[1], b[1]) + (R.base - Math.max(a[1], b[1])) * (0.25 + 0.3 * hash(i * 2.3 + R.seed));
    for (let k = 1; k <= 4; k++) { const t = k / 5; ridge.push([a[0] + (vx - a[0]) * t + (hash(i * 11 + k) - 0.5) * R.cw * 0.04, a[1] + (vy - a[1]) * Math.pow(t, 0.85) + (hash(i * 13 + k + R.seed) - 0.5) * R.amp * 0.05]); }
    ridge.push([vx, vy]);
    for (let k = 1; k <= 4; k++) { const t = k / 5; ridge.push([vx + (b[0] - vx) * t + (hash(i * 17 + k) - 0.5) * R.cw * 0.04, vy + (b[1] - vy) * Math.pow(t, 1.15) + (hash(i * 19 + k + R.seed) - 0.5) * R.amp * 0.05]); }
  }
  // body (shadow colour fading into haze at the base)
  const g = ctx.createLinearGradient(0, R.base - R.amp, 0, gy);
  g.addColorStop(0, css(R.sh)); g.addColorStop(0.75, css(mix3(R.sh, P.haze, 0.45))); g.addColorStop(1, css(P.haze));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ridge[0][0], gy + 2);
  for (const q of ridge) ctx.lineTo(q[0], q[1]);
  ctx.lineTo(ridge[ridge.length - 1][0], gy + 2); ctx.closePath(); ctx.fill();
  // sunlit flanks + snow
  const lg = ctx.createLinearGradient(0, R.base - R.amp, 0, gy);
  lg.addColorStop(0, css(R.lit)); lg.addColorStop(0.28, css(mix3(R.lit, R.sh, 0.35))); lg.addColorStop(0.6, css(mix3(R.lit, R.sh, 0.7), 0.6)); lg.addColorStop(1, css(R.sh, 0));
  for (let k = 0; k < peaks.length - 1; k++) {
    const { p: pk, at } = peaks[k], end = peaks[k + 1].at, i = i0 + k;
    const vIdx = at + 5, v = ridge[vIdx], h = R.base - pk[1];
    // crease: from the peak down-right toward the ground, kinked
    const crease: Pt[] = [];
    for (let c = 1; c <= 5; c++) { const t = c / 5; crease.push([pk[0] + (v[0] - pk[0]) * 0.35 * t + (hash(i * 23 + c) - 0.5) * R.cw * 0.05, pk[1] + (gy - pk[1]) * t]); }
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(pk[0], pk[1]);
    for (let j = at + 1; j <= vIdx; j++) ctx.lineTo(ridge[j][0], ridge[j][1]);
    ctx.lineTo(v[0] - (v[0] - pk[0]) * 0.1, gy);
    for (let c = crease.length - 1; c >= 0; c--) ctx.lineTo(crease[c][0], crease[c][1]);
    ctx.closePath(); ctx.fill();
    // rock texture: gullies running down both flanks (dark on the lit side, pale on the shade side)
    ctx.lineWidth = Math.max(1, R.amp * 0.006); ctx.lineCap = 'round';
    for (let c = 0; c < 6; c++) {
      const j = at + 1 + (c % 4), q = ridge[Math.min(j, ridge.length - 1)], left = c >= 4;
      const sx0 = left ? pk[0] - (pk[0] - ridge[Math.max(0, at - 2 - c)][0]) * 0.5 : q[0], sy0 = left ? pk[1] + h * (0.15 + 0.1 * c) : q[1] + 2;
      const len = h * (0.25 + hash(i * 41 + c) * 0.3), dx = (left ? -1 : -0.35) * len * 0.25;
      ctx.strokeStyle = css(left ? mix3(R.sh, R.lit, 0.35) : mix3(R.sh, R.lit, 0.2), 0.45);
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + dx * 0.5 + (hash(i * 43 + c) - 0.5) * len * 0.1, sy0 + len * 0.5); ctx.lineTo(sx0 + dx, sy0 + len); ctx.stroke();
    }
    // a thin bright rim along the sunlit ridge (from the peak down toward the right valley)
    ctx.strokeStyle = css(mix3(R.lit, [255, 255, 255], 0.35), 0.75); ctx.lineWidth = Math.max(1, R.amp * 0.005); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pk[0], pk[1]); for (let j = at + 1; j <= at + 3; j++) ctx.lineTo(ridge[j][0], ridge[j][1]); ctx.stroke();
    // snow cap on tall peaks: shade snow over the whole cap, lit snow right of the crease
    if (h > R.amp * 0.48 && R.snow > 0) {
      const sl = pk[1] + h * R.snow * (0.8 + hash(i * 29) * 0.4);
      const yAt = (from: number, dir: number) => { // walk the ridge from the peak until it drops below the snowline
        let j = from; while (j + dir >= 0 && j + dir < ridge.length && ridge[j + dir][1] < sl) j += dir;
        const a = ridge[j], b = ridge[Math.max(0, Math.min(ridge.length - 1, j + dir))], t = b[1] === a[1] ? 0 : (sl - a[1]) / (b[1] - a[1]);
        return { j, pt: [a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, t)), sl] as Pt };
      };
      const L = yAt(at, -1), Rr = yAt(at, 1);
      const zig = (xa: number, xb: number, n: number, seed: number) => { const o: Pt[] = []; for (let z = 1; z < n; z++) { const t = z / n; o.push([xa + (xb - xa) * t, sl + (z % 2 ? h * 0.035 : -h * 0.015) * (0.5 + hash(seed + z) * 0.9)]); } return o; };
      ctx.fillStyle = css(R.snow > 0.25 ? P.snowSh : mix3(P.snowSh, R.sh, 0.25)); ctx.beginPath(); ctx.moveTo(L.pt[0], L.pt[1]);
      for (let j = L.j; j <= Rr.j; j++) ctx.lineTo(ridge[j][0], ridge[j][1]);
      ctx.lineTo(Rr.pt[0], Rr.pt[1]); for (const z of zig(Rr.pt[0], L.pt[0], 7, i * 31).reverse().reverse()) ctx.lineTo(z[0], z[1]);
      ctx.closePath(); ctx.fill();
      const cx = pk[0] + (v[0] - pk[0]) * 0.35 * ((sl - pk[1]) / (gy - pk[1]));
      ctx.fillStyle = css(P.snowLit); ctx.beginPath(); ctx.moveTo(pk[0], pk[1]);
      for (let j = at + 1; j <= Rr.j; j++) ctx.lineTo(ridge[j][0], ridge[j][1]);
      ctx.lineTo(Rr.pt[0], Rr.pt[1]); for (const z of zig(Rr.pt[0], cx, 4, i * 37)) ctx.lineTo(z[0], z[1]); ctx.lineTo(cx, sl);
      ctx.closePath(); ctx.fill();
      // couloirs: snow streaks running down the gullies below the cap, thinning out
      for (let c = 0; c < 5; c++) {
        const t = (c + 0.5) / 5, x = L.pt[0] + (Rr.pt[0] - L.pt[0]) * t + (hash(i * 53 + c) - 0.5) * R.cw * 0.03, len = h * (0.05 + hash(i * 59 + c) * 0.1), wd = R.cw * (0.004 + hash(i * 61 + c) * 0.006);
        const litSide = x > cx;
        ctx.fillStyle = css(litSide ? P.snowLit : P.snowSh, 0.55);
        ctx.beginPath(); ctx.moveTo(x - wd, sl - h * 0.02); ctx.quadraticCurveTo(x - wd * 0.4 - len * 0.05, sl + len * 0.5, x - len * 0.08, sl + len);
        ctx.quadraticCurveTo(x + wd * 0.4 - len * 0.04, sl + len * 0.5, x + wd, sl - h * 0.02); ctx.closePath(); ctx.fill();
      }
    }
    void end;
  }
}

function mist(y: number, h: number, x0: number, w: number, c: C3, a: number) {
  const g = ctx.createLinearGradient(0, y - h * 0.5, 0, y + h * 0.5);
  g.addColorStop(0, css(c, 0)); g.addColorStop(0.55, css(c, a)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.fillRect(x0, y - h * 0.5, w, h);
}

interface ForestDef { par: number; seed: number; hMin: number; hMax: number; step: number; hill: number; col: C3; rim: C3 | null; sparse?: number; detail?: number }
/** A band of spruces on a gentle hill line. Every tree has its own lean, width and ragged branch tips; near layers
 *  get a trunk, a shaded left side and a warm sunlit right edge (light from the sun side). */
function forest(gy: number, x0: number, x1: number, F: ForestDef) {
  const off = view.panX * F.par, i0 = Math.floor((x0 + off) / F.step) - 3, i1 = Math.ceil((x1 + off) / F.step) + 3;
  const hillY = (wx: number) => gy - F.hill * (0.6 + 0.4 * Math.sin(wx * 0.0021 + F.seed) * Math.sin(wx * 0.0007 + F.seed * 2));
  const trees: [number, number, number, number][] = [];
  for (let i = i0; i <= i1; i++) {
    if (F.sparse && vnoise1(i * 0.11 + F.seed) < F.sparse) continue;
    const wx = (i + hash(i * 1.3 + F.seed) * 0.8) * F.step;
    trees.push([wx - off, hillY(wx), F.hMin + (F.hMax - F.hMin) * Math.pow(hash(i * 2.7 + F.seed), 0.8), i * 7.13 + F.seed]);
  }
  trees.sort((a, b) => b[2] - a[2]); // tall ones behind
  const d = F.detail ?? 0, n = nightness();
  // hill body: slightly lighter at its crest (atmosphere), darker at the base
  const hg = ctx.createLinearGradient(0, gy - F.hill - F.hMax * 0.3, 0, gy);
  hg.addColorStop(0, css(mix3(F.col, [255, 255, 255], 0.04))); hg.addColorStop(1, css(mix3(F.col, [0, 0, 0], 0.25)));
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(x0 - 4, gy + 2);
  for (let x = x0 - 4; x <= x1 + 12; x += 12) ctx.lineTo(x, hillY(x + off) + (F.hill ? 0 : F.hMin * 0.3));
  ctx.lineTo(x1 + 12, gy + 2); ctx.closePath(); ctx.fill();
  if (d >= 2) { ctx.fillStyle = css(mix3(F.col, [40, 25, 15], 0.5)); for (const [tx, by, h] of trees) ctx.fillRect(tx - h * 0.018, by - h * 0.14, h * 0.036, h * 0.16); } // trunks
  // body: top of each tree a touch lighter (sky light), base darker
  const tg = ctx.createLinearGradient(0, gy - F.hMax - F.hill, 0, gy);
  tg.addColorStop(0, css(mix3(F.col, [255, 255, 255], 0.06))); tg.addColorStop(1, css(mix3(F.col, [0, 0, 0], 0.22)));
  ctx.fillStyle = tg; ctx.beginPath();
  for (const [tx, by, h, sd] of trees) pine(tx, by, h, sd, 0, d);
  ctx.fill();
  if (d >= 1) { // shaded left side
    ctx.fillStyle = css(mix3(F.col, [0, 0, 10], 0.35), 0.55); ctx.beginPath();
    for (const [tx, by, h, sd] of trees) pine(tx, by, h, sd, -1, d);
    ctx.fill();
  }
  if (F.rim) { // sunlit right edge
    ctx.fillStyle = css(F.rim, (d >= 2 ? 0.3 : 0.2) * (1 - n * 0.8)); ctx.beginPath();
    for (const [tx, by, h, sd] of trees) pine(tx, by, h, sd, 1, d);
    ctx.fill();
  }
}
/** Spruce silhouette: ragged drooping tiers (count/width/lean vary per tree). side: 0 whole, 1 right half, -1 left half. */
function pine(tx: number, by: number, h: number, sd: number, side: number, detail: number) {
  const tiers = 6 + Math.floor(hash(sd) * 3) + detail, w = h * (0.2 + hash(sd * 1.7) * 0.08), lean = (hash(sd * 2.3) - 0.5) * h * 0.04;
  const top = by - h, xAt = (k: number) => tx + lean * k; // the trunk line leans slightly toward the top
  const pts = (dir: number) => {
    const o: [number, number][] = [];
    for (let t = 0; t < tiers; t++) {
      const k = t / tiers, k2 = (t + 1) / tiers, ww = w * Math.pow(1 - k, 0.9) * (0.82 + hash(sd + t * 3.1 + dir) * 0.36);
      const yTip = by - h * k * 0.94 + h * 0.03, yNotch = by - h * (k + (k2 - k) * 0.7);
      o.push([xAt(k) + dir * ww, yTip]); // drooping branch tip
      if (detail) o.push([xAt(k) + dir * ww * 0.7, yTip - h * 0.025]); // ragged needle step
      o.push([xAt(k2 * 0.95) + dir * ww * 0.32, yNotch]); // notch toward the trunk
    }
    return o;
  };
  const L = pts(-1), R = pts(1);
  if (side >= 0 && side !== 1) { // whole tree
    ctx.moveTo(xAt(0) - w * 0.12, by);
    for (const p of L) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(xAt(1), top);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.lineTo(xAt(0) + w * 0.12, by); ctx.closePath();
    return;
  }
  const P = side > 0 ? R : L;
  ctx.moveTo(xAt(0), by);
  for (const p of P) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(xAt(1), top);
  for (let t = tiers; t >= 0; t--) ctx.lineTo(xAt(t / tiers) + side * w * 0.06, by - h * (t / tiers)); // back down the trunk
  ctx.closePath();
}

function vnoise1(x: number) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

// ---- clouds: overlapping soft forms, sunlit tops, gray undersides, slow drift ----
function drawClouds(gy: number, x0: number, w: number, P: Pal) {
  const n = nightness(), H = view.H / Math.max(0.3, view.zoom);
  const topC = P.cBot, botC = P.cTop; // sunlit underside glows, tops take the sky colour
  for (let c = 0; c < 5; c++) {
    const speed = 6 + hash(c * 1.9) * 8, scale = 0.7 + hash(c * 3.3) * 0.8;
    const span = w + 600;
    const cx = x0 - 300 + ((hash(c * 5.7) * span + view.t * speed) % span);
    const cy = gy - H * (0.62 + hash(c * 2.1) * 0.4);
    if (cy < view.vy0 - 80) continue;
    const r = H * 0.04 * scale;
    const g = ctx.createLinearGradient(0, cy - r * 1.4, 0, cy + r * 0.8);
    g.addColorStop(0, css(botC, 0.92 - n * 0.3)); g.addColorStop(1, css(topC, 0.95 - n * 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ox = (k - 2.5) * r * 0.75 + (hash(c * 7 + k) - 0.5) * r * 0.4;
      const oy = -Math.sin((k / 5) * Math.PI) * r * 0.55 + (hash(c * 11 + k) - 0.5) * r * 0.2;
      const rr = r * (0.55 + 0.45 * Math.sin((k / 5) * Math.PI) + hash(c * 13 + k) * 0.2);
      ctx.moveTo(cx + ox + rr, cy + oy); ctx.arc(cx + ox, cy + oy, rr, 0, 6.283);
    }
    ctx.fill();
  }
}

// ---- birds: an occasional small distant flock ----
function drawBirds(gy: number, x0: number, w: number) {
  const cycle = 46, k = view.t % cycle, n = nightness();
  if (k > 22 || n > 0.6) return;
  const flock = Math.floor(view.t / cycle), count = 3 + Math.floor(hash(flock) * 3);
  const bx = x0 + (k / 22) * (w + 200) - 100, by = gy - view.H * (0.55 + hash(flock * 2.3) * 0.2);
  ctx.strokeStyle = `rgba(40,44,52,${0.55 * (1 - n)})`; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = bx - i * 16 - hash(i + flock) * 8, y = by + (i % 2 ? 8 : -4) * (i * 0.6) + Math.sin(view.t * 1.3 + i) * 2;
    const flap = Math.sin(view.t * 9 + i * 1.7) * 3;
    ctx.beginPath(); ctx.moveTo(x - 5, y - flap); ctx.quadraticCurveTo(x - 2, y - 1, x, y); ctx.quadraticCurveTo(x + 2, y - 1, x + 5, y - flap); ctx.stroke();
  }
}

export function drawGround(gy: number, x0: number, w: number) {
  ctx.fillStyle = css(lit([112, 74, 44])); ctx.fillRect(x0, gy + 3, w, 5); // warm soil strip under the turf
  ctx.fillStyle = css(lit([84, 150, 58])); ctx.fillRect(x0, gy - 6, w, 10);
  ctx.fillStyle = css(lit([108, 176, 72]));
  for (let i = 0; i < w / 9; i++) { const x = x0 + i * 9 + hash(i) * 6; ctx.fillRect(x, gy - 8 - hash(i * 3) * 3, 2, 4); }
  ctx.fillStyle = css(lit([130, 196, 86])); // tufts
  for (let i = 0; i < w / 23; i++) { const x = x0 + i * 23 + hash(i * 7.7) * 12; ctx.beginPath(); ctx.moveTo(x, gy - 4); ctx.lineTo(x + 2, gy - 11 - hash(i) * 3); ctx.lineTo(x + 4, gy - 4); ctx.fill(); }
}

/** Night/sunset grade over the surface (drawn after the yard, before practical lights glow). */
export function drawSurfaceGrade(gy: number, x0: number, w: number) {
  const n = nightness(), ss = sunset();
  if (n < 0.02 && ss < 0.02) return;
  const top = view.vy0 - 10, bot = gy + 30, fade = 60;
  if (n > 0.02) {
    const a = (0.5 * n).toFixed(3);
    ctx.fillStyle = `rgba(8,12,34,${a})`; ctx.fillRect(x0, top, w, bot - top);
    const g = ctx.createLinearGradient(0, bot, 0, bot + fade);
    g.addColorStop(0, `rgba(8,12,34,${a})`); g.addColorStop(1, 'rgba(8,12,34,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, bot, w, fade);
  }
  if (ss > 0.02) { ctx.fillStyle = `rgba(255,120,60,${(0.08 * ss).toFixed(3)})`; ctx.fillRect(x0, top, w, bot - top); }
}
