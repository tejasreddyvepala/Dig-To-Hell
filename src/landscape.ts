// Surface landscape: a calm, painted contrast to the mine. Cosmetic day/night cycle (no gameplay effect),
// layered parallax mountains, deterministic tree clusters, painted clouds, an occasional distant flock, stars + moon.
import { CFG } from './config';
import { ctx, shaftCX, shaftW, surfaceLayout, view } from './view';
import { hash } from './util';

const D = CFG.daynight;
type C3 = [number, number, number];
const mix3 = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const css = (c: C3, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// sky keyframes: [phase, top, horizon]
const SKY: [number, C3, C3][] = [
  [0.0, [58, 74, 122], [240, 168, 120]], // dawn
  [0.08, [90, 166, 224], [245, 220, 176]], // morning
  [0.18, [78, 159, 224], [191, 227, 246]], // day
  [0.52, [78, 159, 224], [191, 227, 246]],
  [0.62, [61, 90, 154], [245, 154, 90]], // sunset
  [0.7, [31, 42, 82], [192, 106, 106]], // dusk
  [0.78, [11, 20, 48], [29, 42, 74]], // night
  [0.94, [11, 20, 48], [29, 42, 74]],
  [1.0, [58, 74, 122], [240, 168, 120]],
];

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
function sunset() { const p = dayPhase(); return Math.max(0, 1 - Math.abs(p - 0.63) / 0.07) + Math.max(0, 1 - Math.abs(p - 0.02) / 0.05) * 0.7; }

function skyColors(): [C3, C3] {
  const p = dayPhase();
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a, ta, ha] = SKY[i], [b, tb, hb] = SKY[i + 1];
    if (p >= a && p <= b) { const k = (p - a) / (b - a); return [mix3(ta, tb, k), mix3(ha, hb, k)]; }
  }
  return [SKY[0][1], SKY[0][2]];
}

/** Daylight tint applied to landscape colours (night = cool and dark, sunset = warm). */
function lit(c: C3): C3 {
  const n = nightness(), w = sunset();
  const warm = mix3(c, [c[0] * 1.12 + 18, c[1] * 0.92, c[2] * 0.82], w * 0.6);
  return mix3(warm, [c[0] * 0.22 + 8, c[1] * 0.26 + 12, c[2] * 0.36 + 26], n * 0.85);
}

function ridge(x: number, seed: number, amp: number) {
  return amp * (0.55 + 0.22 * Math.sin(x * 0.0042 + seed) + 0.14 * Math.sin(x * 0.011 + seed * 2.3) + 0.09 * Math.sin(x * 0.029 + seed * 5.1));
}

export function drawLandscape(gy: number, x0: number, w: number) {
  const H = view.H, x1 = x0 + w, n = nightness();
  const [top, hor] = skyColors();
  const skyTop = Math.min(view.vy0, gy - H);
  const g = ctx.createLinearGradient(0, gy - H * 0.9, 0, gy);
  g.addColorStop(0, css(top)); g.addColorStop(1, css(hor));
  ctx.fillStyle = g; ctx.fillRect(x0, skyTop - 10, w, gy - skyTop + 10);

  // stars + moon (night), sun (day)
  if (n > 0.02) {
    for (let i = 0; i < 70; i++) {
      const sx = x0 + hash(i * 3.1) * w, sy = gy - H * 0.25 - hash(i * 7.3) * H * 0.9;
      if (sy < view.vy0) continue;
      ctx.fillStyle = `rgba(255,255,240,${(n * (0.4 + 0.6 * Math.abs(Math.sin(view.t * 0.8 + i)))).toFixed(2)})`;
      ctx.fillRect(sx, sy, hash(i) > 0.85 ? 2 : 1.2, hash(i) > 0.85 ? 2 : 1.2);
    }
  }
  const p = dayPhase();
  const arc = (k: number) => ({ x: x0 + w * (0.08 + 0.84 * k), y: gy - H * 0.12 - Math.sin(Math.PI * k) * H * 0.55 });
  if (p < 0.7) { // sun crosses the sky during the day
    const s = arc(p / 0.7), r = 22;
    const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
    sg.addColorStop(0, `rgba(255,240,190,${0.5 * (1 - n)})`); sg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, r * 4, 0, 6.283); ctx.fill();
    ctx.fillStyle = sunset() > 0.3 ? '#ffb070' : '#fff4d0'; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill();
  }
  if (p > 0.66 || p < 0.03) { // moon
    const k = ((p - 0.66 + 1) % 1) / 0.37, m = arc(Math.min(1, k));
    ctx.fillStyle = `rgba(235,240,255,${Math.min(1, n * 1.2)})`; ctx.beginPath(); ctx.arc(m.x, m.y, 15, 0, 6.283); ctx.fill();
    ctx.fillStyle = css(top); ctx.beginPath(); ctx.arc(m.x + 6, m.y - 4, 13, 0, 6.283); ctx.fill(); // crescent
  }

  drawClouds(gy, x0, w);
  drawBirds(gy, x0, w);

  // far mountains (bluish, slow parallax) and near foothills (warmer)
  const layers: { amp: number; seed: number; col: C3; par: number }[] = [
    { amp: H * 0.34, seed: 1.3, col: [126, 146, 176], par: 0.75 },
    { amp: H * 0.2, seed: 4.1, col: [96, 128, 104], par: 0.45 },
  ];
  for (const L of layers) {
    ctx.fillStyle = css(lit(L.col));
    ctx.beginPath(); ctx.moveTo(x0, gy + 2);
    for (let x = x0; x <= x1 + 12; x += 12) {
      const wx = x + view.panX * L.par; // far layers drift less when the camera pans
      ctx.lineTo(x, gy - ridge(wx, L.seed, L.amp) - (vnoise1(wx * 0.05 + L.seed) - 0.5) * L.amp * 0.08);
    }
    ctx.lineTo(x1 + 12, gy + 2); ctx.closePath(); ctx.fill();
    // soft snow/haze on the far range
    if (L.par > 0.6) { ctx.fillStyle = css(lit([210, 220, 232]), 0.18); ctx.fill(); }
  }
  drawTrees(gy, x0, x1);
}

function vnoise1(x: number) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

// ---- clouds: overlapping soft forms, sunlit tops, gray undersides, slow drift ----
function drawClouds(gy: number, x0: number, w: number) {
  const n = nightness(), ss = sunset(), H = view.H;
  const topC: C3 = mix3(mix3([255, 255, 255], [255, 196, 150], ss * 0.7), [70, 80, 110], n * 0.85);
  const botC: C3 = mix3(mix3([196, 206, 222], [200, 130, 130], ss * 0.6), [36, 42, 66], n * 0.85);
  for (let c = 0; c < 7; c++) {
    const speed = 6 + hash(c * 1.9) * 8, scale = 0.7 + hash(c * 3.3) * 0.8;
    const span = w + 600;
    const cx = x0 - 300 + ((hash(c * 5.7) * span + view.t * speed) % span);
    const cy = gy - H * (0.42 + hash(c * 2.1) * 0.42);
    if (cy < view.vy0 - 80) continue;
    const r = 26 * scale;
    const g = ctx.createLinearGradient(0, cy - r * 1.4, 0, cy + r * 0.8);
    g.addColorStop(0, css(topC, 0.95 - n * 0.35)); g.addColorStop(1, css(botC, 0.9 - n * 0.35));
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

// ---- trees: deterministic clusters that frame the site but never cover the shaft or the yard ----
function drawTrees(gy: number, x0: number, x1: number) {
  const L = surfaceLayout(), u = L.u;
  // distant tree line (small, hazy) — sits behind everything, so it may run behind the yard
  const far = lit([88, 118, 96]);
  ctx.fillStyle = css(far, 0.9);
  const fs = u * 0.32;
  for (let x = Math.floor(x0 / fs) * fs; x < x1; x += fs) {
    const id = Math.round(x / fs), h = u * (0.35 + hash(id * 1.9) * 0.45);
    if (hash(id * 3.3) < 0.25) continue;
    ctx.beginPath(); ctx.ellipse(x, gy - h * 0.55, fs * 0.6, h * 0.55, 0, 0, 6.283); ctx.fill();
  }
  const keepOut: [number, number][] = [[shaftCX() - shaftW() / 2 - u * 0.4, L.right + u * 0.2], [L.right, L.needRight + u * 0.6]];
  const step = u * 0.55;
  for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
    const id = Math.round(x / step), r = hash(id * 1.37);
    if (r < 0.42) continue;
    if (keepOut.some(([a, b]) => x > a && x < b)) continue;
    const h = u * (0.9 + hash(id * 2.9) * 1.5), pine = hash(id * 4.1) > 0.5, tx = x + (hash(id * 5.3) - 0.5) * step;
    const trunk = lit([92, 66, 44]), leaf = lit(pine ? [52, 92, 64] : [74, 116, 62]);
    ctx.fillStyle = css(trunk); ctx.fillRect(tx - h * 0.04, gy - h * 0.32, h * 0.08, h * 0.32 + 2);
    ctx.fillStyle = css(leaf);
    if (pine) {
      for (let t = 0; t < 3; t++) {
        const ty = gy - h * (0.25 + t * 0.24), tw = h * (0.32 - t * 0.07);
        ctx.beginPath(); ctx.moveTo(tx - tw, ty); ctx.lineTo(tx, ty - h * 0.36); ctx.lineTo(tx + tw, ty); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(tx, gy - h * 0.62, h * 0.26, 0, 6.283); ctx.arc(tx - h * 0.18, gy - h * 0.48, h * 0.2, 0, 6.283); ctx.arc(tx + h * 0.18, gy - h * 0.5, h * 0.21, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = css(lit([110, 150, 84]), 0.5); ctx.beginPath(); ctx.arc(tx - h * 0.06, gy - h * 0.7, h * 0.12, 0, 6.283); ctx.fill();
    }
  }
}

export function drawGround(gy: number, x0: number, w: number) {
  ctx.fillStyle = css(lit([79, 138, 58])); ctx.fillRect(x0, gy - 6, w, 10);
  ctx.fillStyle = css(lit([98, 160, 70]));
  for (let i = 0; i < w / 9; i++) { const x = x0 + i * 9 + hash(i) * 6; ctx.fillRect(x, gy - 8 - hash(i * 3) * 3, 2, 4); }
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
