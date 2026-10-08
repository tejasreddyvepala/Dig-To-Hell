// ART LANGUAGE (Visual Pass 1): the shared rendering rules every scene builds on. Spec §17.1.
//   • PALETTE — related families (earth, rock, wood, metal, industrial accents, UI, light) instead of one-off colours.
//   • 3-TONE MATERIALS — base + highlight on the lit side + shadow on the far side. Light comes from the UPPER-LEFT
//     outdoors; underground the work lights do the lighting, but materials keep the same top/left-lit convention.
//   • OUTLINES BY DEPTH — foreground gameplay objects: strongest local-colour outline; midground: lighter; background:
//     none. Never pure black.
//   • CONTACT SHADOWS — a soft dark ellipse wherever something rests on a surface.
//   • SUBTLE TEXTURE — cached, deterministic speckle patterns at low alpha; generated once, never per frame.
// Keep this module small: palette + a handful of helpers. Scenes call these rather than inventing colours.
import { ctx } from './view';
import { hash } from './util';

export const PAL = {
  earth: { base: '#7a5236', light: '#a0744b', shadow: '#53361f', deep: '#2b1b10' },
  rock: { base: '#5e534a', light: '#857565', shadow: '#3c332c', deep: '#1f1915' },
  wood: { base: '#9b6536', light: '#c99055', shadow: '#653f1f', dark: '#3c2512' }, // warm, bright mine timber
  metal: { base: '#6f7781', light: '#b2bbc5', shadow: '#454c55' },
  yellow: { base: '#f0b32c', light: '#ffd76a', shadow: '#b47d14' }, // industrial accents
  orange: { base: '#e5732a', light: '#ff9a52', shadow: '#a84d16' }, // construction
  ui: { dark: '#1d2126', mid: '#2b3037', light: '#ece6d8' },
  warm: '#ffcf8a', // practical light (lamps, work light)
  cool: '#34445e', // ambient / shadow tint
  bgMute: 'rgba(16,11,8,.2)', // pushes background earth back so gameplay pops
};
export type Tone = { base: string; light: string; shadow: string };
export type Layer = 'fg' | 'mid' | 'bg';

/** Hex colour scaled toward black (k < 1) or white-ish (k > 1). */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Outline weight/darkness by depth layer (null = no outline). */
const OUTLINE: Record<Layer, { w: number; k: number } | null> = { fg: { w: 1.4, k: 0.42 }, mid: { w: 1, k: 0.55 }, bg: null };
export function outline(base: string, layer: Layer, scale = 1) {
  const o = OUTLINE[layer];
  if (!o) return;
  ctx.strokeStyle = shade(base, o.k); ctx.lineWidth = o.w * scale; ctx.stroke();
}

/** Soft contact shadow: the object sits on the surface at (x, y). */
export function contactShadow(x: number, y: number, rx: number, ry: number, a = 0.32) {
  ctx.fillStyle = `rgba(10,6,4,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill();
}

/** A horizontal member (plank, beam, slab): lit top edge, base body, dark underside, local outline. */
export function beam(x: number, y: number, w: number, h: number, t: Tone, layer: Layer = 'mid', grainSeed = -1, r = 0) {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath(); r > 0 ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  ctx.fillStyle = t.base; ctx.fill();
  const hl = Math.max(0.8, h * 0.22), sh = Math.max(0.8, h * 0.26);
  ctx.fillStyle = t.light; ctx.fillRect(x + 0.5, y + 0.4, w - 1, hl);
  ctx.fillStyle = t.shadow; ctx.fillRect(x + 0.5, y + h - sh, w - 1, sh);
  if (grainSeed >= 0) grain(x, y + hl, w, h - hl - sh, grainSeed, true, t.shadow);
  ctx.beginPath(); r > 0 ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  outline(t.base, layer);
}

/** A vertical member (post, rail, stud): lit left side, dark right side (light from the upper-left). */
export function post(x: number, y: number, w: number, h: number, t: Tone, layer: Layer = 'mid', grainSeed = -1) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = t.base; ctx.fillRect(x, y, w, h);
  const s = Math.max(0.8, w * 0.28);
  ctx.fillStyle = t.light; ctx.fillRect(x, y, s, h);
  ctx.fillStyle = t.shadow; ctx.fillRect(x + w - s, y, s, h);
  if (grainSeed >= 0) grain(x + s, y, w - 2 * s, h, grainSeed, false, t.shadow);
  ctx.beginPath(); ctx.rect(x, y, w, h); outline(t.base, layer);
}

/** A few deterministic wood-grain strokes (never noise). */
export function grain(x: number, y: number, w: number, h: number, seed: number, horizontal: boolean, col: string) {
  if (w < 3 || h < 3) return;
  ctx.strokeStyle = col; ctx.globalAlpha *= 0.45; ctx.lineWidth = 0.7;
  const n = horizontal ? Math.max(1, Math.round(w / 18)) : Math.max(1, Math.round(h / 18));
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 3.7), b = hash(seed + i * 9.1);
    if (horizontal) { const gx = x + a * w * 0.8, gy = y + b * h; ctx.moveTo(gx, gy); ctx.lineTo(gx + w * (0.12 + 0.1 * b), gy + (a - 0.5)); }
    else { const gx = x + a * w, gy = y + b * h * 0.8; ctx.moveTo(gx, gy); ctx.lineTo(gx + (b - 0.5), gy + h * (0.12 + 0.1 * a)); }
  }
  ctx.stroke(); ctx.globalAlpha /= 0.45;
}

// ---- cached deterministic textures (built once; used as low-alpha pattern overlays) ----
const patterns = new Map<string, CanvasPattern | null>();
function buildTexture(kind: 'rock' | 'earth'): HTMLCanvasElement {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const n = kind === 'rock' ? 110 : 70;
  for (let i = 0; i < n; i++) {
    const x = hash(i * 1.37 + (kind === 'rock' ? 0 : 50)) * S, y = hash(i * 7.91 + 3) * S, r = 0.8 + hash(i * 3.3) * (kind === 'rock' ? 3.2 : 4.5);
    const dark = hash(i * 5.5) > 0.4;
    c.fillStyle = dark ? 'rgba(0,0,0,.55)' : 'rgba(255,235,210,.45)';
    c.beginPath(); c.ellipse(x, y, r * (kind === 'earth' ? 1.8 : 1.15), r, hash(i) * 3, 0, 6.283); c.fill();
    // wrap so the tile is seamless
    for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) { c.beginPath(); c.ellipse(x + dx, y + dy, r * (kind === 'earth' ? 1.8 : 1.15), r, hash(i) * 3, 0, 6.283); c.fill(); }
  }
  return cv;
}
/** Subtle speckle/mottling over (x, y, w, h). Stable (no per-frame randomness), cheap (one pattern fill). */
/** `ax, ay` anchor the pattern to the world (pass the scene origin) so it never slides when the camera moves. */
export function texture(kind: 'rock' | 'earth', x: number, y: number, w: number, h: number, a = 0.14, ax = 0, ay = 0) {
  let p = patterns.get(kind);
  if (p === undefined) { p = ctx.createPattern(buildTexture(kind), 'repeat'); patterns.set(kind, p); }
  if (!p || w <= 0 || h <= 0) return;
  p.setTransform(new DOMMatrix([1, 0, 0, 1, ax, ay]));
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p; ctx.fillRect(x, y, w, h); ctx.restore();
}
