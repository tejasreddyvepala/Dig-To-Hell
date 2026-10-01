// Shared drawing helpers used by the dig site and the surface: rubble piles, count labels, speech bubbles.
import { ctx, view } from './view';
import { mixPick } from './economy';
import { rubbleRGB } from './geo';
import type { Load } from './state';
import { hash, rgb } from './util';

const FONT_UI = "'Rubik',system-ui,sans-serif";

/** A procedural rubble mound sized by quantity, coloured by the load's material mix. Deterministic per rock index. */
export function drawPile(cx: number, baseY: number, l: Load, max: number, unit: number, seed: number) {
  const qty = l.qty;
  if (qty < 0.05) return;
  const f = Math.min(1.5, qty / max);
  const w = (10 + 46 * Math.min(f, 1.25)) * unit, h = (3 + 24 * Math.min(f, 1.3)) * unit;
  const main = rubbleRGB(mixPick(l, 0.5));
  // mound body
  ctx.fillStyle = rgb(main, 0.62);
  ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY);
  for (let i = 0; i <= 10; i++) {
    const k = i / 10, bump = (hash(seed + i * 3.3) - 0.5) * 0.18;
    ctx.lineTo(cx - w / 2 + w * k, baseY - h * (Math.sin(Math.PI * k) * (0.92 + bump)));
  }
  ctx.closePath(); ctx.fill();
  // rocks on the surface of the mound, each coloured by the material it came from
  const n = Math.min(46, Math.max(3, Math.round(f * 34)));
  for (let i = 0; i < n; i++) {
    const k = hash(seed + i * 7.1), lift = hash(seed + i * 2.3);
    const px = cx - w / 2 + w * (0.08 + 0.84 * k);
    const py = baseY - h * Math.sin(Math.PI * (0.08 + 0.84 * k)) * (0.35 + 0.6 * lift);
    const r = (1.6 + hash(seed + i * 5.9) * 2.6) * unit;
    ctx.fillStyle = rgb(rubbleRGB(mixPick(l, hash(seed + i * 4.1))), 0.8 + hash(seed + i * 9.7) * 0.45);
    ctx.beginPath(); ctx.ellipse(px, py, r * 1.2, r, hash(seed + i) * 3, 0, 6.283); ctx.fill();
  }
  if (f > 1) { // overflowing: rocks spill out to the sides
    for (let i = 0; i < Math.round((f - 1) * 20); i++) {
      const side = i % 2 ? 1 : -1, px = cx + side * (w / 2 + hash(seed + i * 4.4) * 10 * unit);
      ctx.fillStyle = rgb(rubbleRGB(mixPick(l, hash(seed + i * 6.6))), 0.85 + hash(seed + i) * 0.35);
      ctx.beginPath(); ctx.arc(px, baseY - 1.5 * unit, (1.4 + hash(seed + i * 3.1) * 1.6) * unit, 0, 6.283); ctx.fill();
    }
  }
}

export const pileHeight = (qty: number, max: number, unit: number) => (3 + 24 * Math.min(1.3, qty / max)) * unit;

/** Small count label sitting on a rubble pile. */
export function pileLabel(x: number, y: number, n: number, size: number, warn: boolean) {
  ctx.font = `700 ${size}px ${FONT_UI}`; ctx.textAlign = 'center';
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,12,6,.7)'; ctx.lineJoin = 'round';
  ctx.strokeText(String(n), x, y);
  ctx.fillStyle = warn ? '#ffb38a' : '#f3e6cf'; ctx.fillText(String(n), x, y);
}

/** Speech/status bubble with a pointer, centred at (x, y). */
export function bubble(x: number, y: number, text: string, col = '#2a2420', pulse = false) {
  ctx.font = `700 12px ${FONT_UI}`;
  const w = ctx.measureText(text).width + 16, h = 22;
  const a = pulse ? 0.85 + 0.15 * Math.sin(view.t * 5) : 1;
  ctx.globalAlpha = a;
  ctx.fillStyle = col === '#2a2420' ? '#fffaf0' : 'rgba(40,16,10,.92)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 7);
  ctx.globalAlpha = 1;
}
