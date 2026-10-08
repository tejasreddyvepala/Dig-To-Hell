// THE HELL LAYER (from 930 m; reference: the final-layer concept art). All lava is the procedural lava.ts texture
// (flowing crust plates, molten cracks, black-body colours, bloom).
//   BACK (behind the crew): a cavern glow, wide uneven lavafalls pouring down the back rock, giant fossils — a rib cage
//   (left) and a T-rex skull with its neck (right) — rimmed by lava light.
//   FRONT (after the darkness: emissive): a near-black basalt cliff under the work floor with pulsing molten cracks and
//   lava dripping from them, lavafalls spilling over its lip with splashes and flying droplets, the lava sea below
//   (bubbles that swell and pop), basalt islands and spikes silhouetted against it, and embers.
import { S } from './state';
import { face } from './digface';
import { drawLava } from './lava';
import { ctx, faceScale, shaftCX, shaftW, view, yOf } from './view';
import { hash } from './util';
import { LEDGES } from './layout';
import { WORKSITES } from './config';

/** 0..1 how much of the Hell scene is showing (fades in over the first 30 m of Hellstone). */
export const hellK = () => Math.max(0, Math.min(1, (S.depth - 930) / 30));
const geo = () => {
  const k = faceScale(), cx = shaftCX(), R = Math.max(shaftW() / 2, (face.w / 2) * k), F = yOf(S.depth);
  return { k, cx, R, F, cliff: F + 40 * k, seaTop: F + 100 * k };
};
const T = () => view.t;

/** Where the giant fossils sit: in side-cavern pockets in the open wall between the two lowest bridges (above the floor
 *  crew and machines, so nothing stands in front of them). Shared with minelight.ts so their lamps follow. */
export function fossilSpots() {
  const { k, cx, R, F } = geo();
  const lo = F - (WORKSITES[face.tier].ceiling + 42) * k; // above the room's ceiling rim (its edge rocks are drawn in front)
  const decks = LEDGES.filter((l) => l.kind === 'bridge' && l.y < lo - 60 * k).map((l) => l.y).sort((a, b) => b - a);
  const hi = (decks[0] ?? lo - 240 * k) + 16 * k; // under the next bridge up
  const y = (lo + hi) / 2;
  return { ribs: { x: cx - R * 0.6, y }, skull: { x: cx + R * 0.52, y: y + 12 * k }, gap: lo - hi, k };
}
/** A side cavern opened in the wall: a dark hollow with a lava-lit rim, so the fossil reads as uncovered, not pasted. */
function pocket(x: number, y: number, rx: number, ry: number) {
  const g = ctx.createRadialGradient(x, y + ry * 0.2, ry * 0.2, x, y, rx);
  g.addColorStop(0, 'rgba(18,5,3,.96)'); g.addColorStop(0.72, 'rgba(36,9,4,.9)'); g.addColorStop(0.9, 'rgba(255,96,24,.32)'); g.addColorStop(1, 'rgba(255,96,24,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill();
}

/** A lavafall from y0 to y1: procedural molten stream that flares as it falls, a hot lip, and (optionally) a splash at
 *  the foot with spray droplets on ballistic arcs. */
function lavafall(key: string, x: number, y0: number, y1: number, w: number, seed: number, k: number, splash = true) {
  if (y1 < view.vy0 - 20 || y0 > view.vy1 + 20 || y1 - y0 < 4) return;
  const a = Math.max(view.vy0 - 10, y0), b = Math.min(view.vy1 + 10, y1);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x - w * 0.42, a);
  for (let y = a; y <= b; y += 10) { const f = (y - y0) / (y1 - y0); ctx.lineTo(x - w * (0.42 + f * 0.12) + Math.sin(y * 0.045 + T() * 3 + seed) * w * 0.07, y); }
  for (let y = b; y >= a; y -= 10) { const f = (y - y0) / (y1 - y0); ctx.lineTo(x + w * (0.42 + f * 0.12) + Math.sin(y * 0.05 + T() * 3.4 + seed + 2) * w * 0.07, y); }
  ctx.closePath(); ctx.clip();
  drawLava(ctx, key, x - w * 0.6, a, w * 1.2, b - a, T(), { mode: 'fall', wx: seed * 37, wy: (a - y0) / 2, scale: 0.5, edge: true, heat: 0.05 });
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createRadialGradient(x, y0, 0, x, y0, w * 0.9); lg.addColorStop(0, 'rgba(255,220,130,.4)'); lg.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, y0, w * 0.9, 0, 6.283); ctx.fill();
  if (splash) {
    const sg = ctx.createRadialGradient(x, y1, 0, x, y1, w * 1.3); sg.addColorStop(0, 'rgba(255,230,140,.7)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.save(); ctx.translate(x, y1); ctx.scale(1, 0.35); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, w * 1.3, 0, 6.283); ctx.fill(); ctx.restore();
    for (let r = 0; r < 2; r++) { const q = ((T() * 1.6 + r * 0.5) % 1); ctx.strokeStyle = `rgba(255,200,100,${(0.6 * (1 - q)).toFixed(2)})`; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.ellipse(x, y1, w * (0.5 + q * 1.1), w * (0.15 + q * 0.3), 0, Math.PI, 0); ctx.stroke(); } // ripples
    for (let i = 0; i < 10; i++) {
      const life = 0.7 + hash(seed * 3 + i) * 0.5, ph = ((T() + hash(seed + i * 1.7) * life) % life) / life;
      const vx = (hash(seed * 7 + i) - 0.5) * w * 4.5, vy = -(0.6 + hash(seed * 11 + i) * 0.9) * w * 3.2;
      ctx.fillStyle = `rgba(255,${190 + (hash(i) * 60) | 0},90,${(1 - ph).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(x + vx * ph, y1 + vy * ph + w * 7 * ph * ph, Math.max(1, (1.2 + hash(i * 3) * 1.6) * k * (1 - ph * 0.5)), 0, 6.283); ctx.fill();
    }
  }
  ctx.restore();
}

/** Giant fossil bone stroke: dark outline, aged ivory, a warm lava-lit underside, a pale top. */
function boneStroke(path: () => void, w: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = w + 3.5; ctx.beginPath(); path(); ctx.stroke();
  ctx.strokeStyle = '#bfa98a'; ctx.lineWidth = w; ctx.beginPath(); path(); ctx.stroke();
  ctx.save(); ctx.translate(w * 0.2, w * 0.25); ctx.strokeStyle = 'rgba(255,120,40,.5)'; ctx.lineWidth = w * 0.35; ctx.beginPath(); path(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(-w * 0.2, -w * 0.22); ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.lineWidth = w * 0.25; ctx.beginPath(); path(); ctx.stroke(); ctx.restore();
}

/** BACK layer: drawn after the world, before the crew/structures (and before the darkness). */
export function drawHellBack() {
  const h = hellK(); if (h <= 0) return;
  const { k, cx, R, F } = geo();
  if (F < view.vy0 - 50 || F - 600 * k > view.vy1) return;
  ctx.save(); ctx.globalAlpha = h;
  const hz = ctx.createLinearGradient(0, F - 480 * k, 0, F);
  hz.addColorStop(0, 'rgba(90,10,2,0)'); hz.addColorStop(0.7, 'rgba(200,50,10,.22)'); hz.addColorStop(1, 'rgba(255,110,30,.4)');
  ctx.fillStyle = hz; ctx.fillRect(cx - R * 1.7, F - 480 * k, R * 3.4, 480 * k);
  for (let i = 0; i < 4; i++) {
    const x = cx + (-0.95 + i * 0.62 + (hash(i * 3.7) - 0.5) * 0.18) * R, top = F - (240 + hash(i * 5.1) * 260) * k;
    lavafall(`bf${i}`, x, top, F + 4 * k, (16 + hash(i) * 22) * k, i * 7.1 + 3, k, false);
  }
  const fs = fossilSpots(), fk = Math.max(0.55, Math.min(1, fs.gap / (230 * k))); // fit the gap between the bridges
  { // giant rib cage (left), in its own side cavern
    const s = k * 1.15 * fk, bx = fs.ribs.x, by = fs.ribs.y - 55 * s;
    pocket(bx, fs.ribs.y, 135 * s, 95 * s);
    for (let r = 0; r < 8; r++) {
      const t = r / 7, sx = bx - 70 * s + t * 150 * s, sy = by + 8 * s - Math.sin(t * Math.PI) * 28 * s, len = (62 + Math.sin(t * Math.PI) * 58) * s;
      boneStroke(() => { ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx - 44 * s, sy + len * 0.2, sx - 36 * s, sy + len * 0.85, sx - 4 * s, sy + len); }, 8 * s);
    }
    boneStroke(() => { ctx.moveTo(bx - 80 * s, by + 12 * s); ctx.quadraticCurveTo(bx, by - 34 * s, bx + 90 * s, by - 4 * s); }, 10 * s);
  }
  { // giant T-rex skull + neck (right), in its own side cavern
    const s = k * 1.2 * fk, sx = fs.skull.x, sy = fs.skull.y + 18 * s;
    pocket(sx - 30 * s, fs.skull.y, 150 * s, 92 * s);
    for (let v = 0; v < 8; v++) { const vx = sx - 32 * s - v * 15 * s, vy = sy - 42 * s - Math.sin(v * 0.45) * 22 * s - v * 6 * s; ctx.fillStyle = '#b8a283'; ctx.beginPath(); ctx.ellipse(vx, vy, 7.5 * s, 9.5 * s, -0.3, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillRect(vx - 1.6 * s, vy - 17 * s, 3.2 * s, 8 * s); }
    ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s);
    const skull = () => { ctx.moveTo(-40, -30); ctx.quadraticCurveTo(-10, -52, 40, -40); ctx.quadraticCurveTo(78, -30, 96, -8); ctx.lineTo(92, 4); ctx.lineTo(40, 6); ctx.lineTo(-30, 10); ctx.quadraticCurveTo(-48, -8, -40, -30); ctx.closePath(); };
    ctx.beginPath(); skull(); const sg = ctx.createLinearGradient(0, -52, 0, 10); sg.addColorStop(0, '#dccaa6'); sg.addColorStop(0.7, '#a48c6a'); sg.addColorStop(1, '#c46a3a'); ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = '#1c0a06';
    ctx.beginPath(); ctx.ellipse(8, -26, 10, 8, -0.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-22, -14, 13, 9, 0.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(52, -26, 9, 5, -0.2, 0, 6.283); ctx.fill();
    const eg = ctx.createRadialGradient(8, -26, 0, 8, -26, 9); eg.addColorStop(0, `rgba(255,170,60,${(0.7 + 0.3 * Math.sin(T() * 1.7)).toFixed(2)})`); eg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(8, -26, 9, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, 10); ctx.quadraticCurveTo(30, 26, 88, 10); ctx.lineTo(92, 4); ctx.lineTo(-24, 6); ctx.closePath(); ctx.fillStyle = '#a8906c'; ctx.fill(); ctx.strokeStyle = '#1a0c08'; ctx.stroke();
    ctx.fillStyle = '#efe4c8'; for (let i = 0; i < 11; i++) { const tx = -14 + i * 9.5; ctx.beginPath(); ctx.moveTo(tx, 5); ctx.lineTo(tx + 3, 15 - (i % 2) * 3); ctx.lineTo(tx + 6, 5); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

/** FRONT layer: cliff, lavafalls, the lava sea (drawn after the darkness: it is the light source). */
export function drawHellFront() {
  const h = hellK(); if (h <= 0) return;
  const { k, cx, R, cliff, seaTop } = geo();
  if (cliff > view.vy1 + 10) return;
  const x0 = view.vx0 - 20, x1 = view.vx1 + 20, bot = view.vy1 + 20;
  ctx.save(); ctx.globalAlpha = h;
  // ---- the lava sea ----
  if (seaTop < bot) {
    const surf = (x: number) => seaTop + Math.sin(x * 0.012 + T() * 0.9) * 4 * k + Math.sin(x * 0.031 - T() * 1.7) * 2.2 * k;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, surf(x));
    ctx.lineTo(x1, bot); ctx.closePath(); ctx.clip();
    drawLava(ctx, 'sea', x0, seaTop - 8 * k, x1 - x0, bot - seaTop + 8 * k, T(), { mode: 'pool', wx: (x0 - cx) * 0.35, wy: 0, scale: 0.35, top: 0.18 });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,130,.75)'; ctx.lineWidth = 2.4 * k; ctx.beginPath();
    for (let x = x0; x <= x1; x += 12) { const y = surf(x); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.restore();
    for (let i = 0; i < 9; i++) { // bubbles: swell, then pop into a ring of droplets
      const life = 2.2 + hash(i * 3.3) * 2, cyc = Math.floor((T() + hash(i * 5.1) * life) / life), ph = ((T() + hash(i * 5.1) * life) % life) / life;
      const px = cx + (hash(i * 7.7 + cyc * 1.31) - 0.5) * (x1 - x0), py = surf(px) + (10 + hash(i + cyc) * 50) * k;
      if (py > bot) continue;
      if (ph < 0.8) { const r = (2 + ph * 8) * k, bg = ctx.createRadialGradient(px - r * 0.3, py - r * 0.7, 0, px, py - r * 0.3, r * 1.1); bg.addColorStop(0, 'rgba(255,240,170,.95)'); bg.addColorStop(0.5, 'rgba(255,140,40,.85)'); bg.addColorStop(1, 'rgba(120,20,4,.6)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(px, py - r * 0.3, r, Math.PI, 0); ctx.fill(); }
      else { const q = (ph - 0.8) / 0.2; ctx.fillStyle = `rgba(255,220,120,${(1 - q).toFixed(2)})`; for (let d = 0; d < 6; d++) { const a = -Math.PI * (0.15 + 0.7 * d / 5); ctx.beginPath(); ctx.arc(px + Math.cos(a) * q * 16 * k, py + Math.sin(a) * q * 14 * k + q * q * 10 * k, 1.6 * k, 0, 6.283); ctx.fill(); } }
    }
    for (let i = 0; i < 8; i++) { // cooled basalt rocks poking out of the sea: rounded dark masses, lava-lit undersides, a few spires
      const ix = cx + (-1.05 + i * 0.3 + (hash(i * 4.1) - 0.5) * 0.12) * R, iy = seaTop + (34 + hash(i * 6.3) * 120) * k, iw = (30 + hash(i * 2.9) * 46) * k, ih = (16 + hash(i * 8.1) * 20) * k;
      if (ix < x0 - iw || ix > x1 + iw || iy - ih > bot) continue;
      const bob = Math.sin(T() * 0.8 + i) * 0.8 * k;
      ctx.save(); ctx.translate(ix, iy + bob);
      const rock = () => { ctx.beginPath(); ctx.moveTo(-iw / 2, 0); ctx.quadraticCurveTo(-iw * 0.48, -ih * 0.9, -iw * 0.1, -ih); ctx.quadraticCurveTo(iw * 0.3, -ih * 1.05, iw * 0.46, -ih * 0.35); ctx.quadraticCurveTo(iw * 0.52, -ih * 0.05, iw / 2, 0); ctx.closePath(); };
      rock(); const rg = ctx.createLinearGradient(0, -ih, 0, 0); rg.addColorStop(0, '#1a0c08'); rg.addColorStop(0.75, '#2a120a'); rg.addColorStop(1, '#8a2a0a'); ctx.fillStyle = rg; ctx.fill();
      ctx.save(); rock(); ctx.clip(); ctx.fillStyle = 'rgba(255,170,90,.22)'; ctx.beginPath(); ctx.ellipse(iw * 0.18, -ih * 0.75, iw * 0.25, ih * 0.18, -0.4, 0, 6.283); ctx.fill(); ctx.restore(); // a faint lit facet
      const ring = ctx.createRadialGradient(0, 0, 0, 0, 0, iw * 0.7); ring.addColorStop(0, 'rgba(255,200,100,0)'); ring.addColorStop(0.6, 'rgba(255,180,80,.55)'); ring.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.save(); ctx.scale(1, 0.22); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(0, 0, iw * 0.7, 0, 6.283); ctx.fill(); ctx.restore(); // molten ring where it meets the lava
      if (hash(i * 13) > 0.45) { // a basalt spire
        const sx = (hash(i * 17) - 0.5) * iw * 0.3, sh = (40 + hash(i * 19) * 60) * k;
        ctx.fillStyle = '#140806'; ctx.beginPath(); ctx.moveTo(sx - 9 * k, -ih * 0.8); ctx.quadraticCurveTo(sx - 3 * k, -ih - sh * 0.5, sx, -ih - sh); ctx.quadraticCurveTo(sx + 4 * k, -ih - sh * 0.5, sx + 10 * k, -ih * 0.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,50,.55)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(sx + 10 * k, -ih * 0.8); ctx.quadraticCurveTo(sx + 4 * k, -ih - sh * 0.5, sx, -ih - sh); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // ---- the basalt cliff under the work floor ----
  ctx.fillStyle = '#0e0605'; ctx.beginPath(); ctx.moveTo(x0, cliff);
  for (let x = x0; x <= x1; x += 18) ctx.lineTo(x, cliff + hash(Math.floor((x - cx) / 18) * 1.7) * 6 * k);
  for (let x = x1; x >= x0; x -= 26) ctx.lineTo(x, seaTop + (2 + hash(Math.floor((x - cx) / 26) * 2.3) * 12) * k);
  ctx.closePath(); ctx.fill();
  // columnar basalt: tall blocks of slightly different darkness, a faint lava-lit top edge, dark joints
  for (let x = Math.floor((x0 - cx) / (38 * k)) * 38 * k + cx; x < x1; x += 38 * k) {
    const j = Math.round((x - cx) / (38 * k)), t = hash(j * 5.9), hgt = (seaTop - cliff) * (0.6 + hash(j * 3.1) * 0.35);
    const bg = ctx.createLinearGradient(0, cliff, 0, cliff + hgt); bg.addColorStop(0, `rgb(${30 + t * 16 | 0},${12 + t * 6 | 0},${9 + t * 4 | 0})`); bg.addColorStop(1, '#140806');
    ctx.fillStyle = bg; ctx.fillRect(x + 1.5, cliff + 6 * k, 38 * k - 3, hgt);
    ctx.fillStyle = 'rgba(255,120,50,.28)'; ctx.fillRect(x + 1.5, cliff + 5 * k, 38 * k - 3, 1.6 * k);
  }
  // molten seams running down the joints between columns (pulsing), with drips falling from their ends
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let x = Math.floor((x0 - cx) / (38 * k)) * 38 * k + cx; x < x1; x += 38 * k) {
    const j = Math.round((x - cx) / (38 * k));
    if (hash(j * 7.3) > 0.45) continue;
    const len = (seaTop - cliff) * (0.25 + hash(j * 2.1) * 0.45), y0 = cliff + 8 * k, pul = 0.55 + 0.45 * Math.sin(T() * (0.9 + hash(j) * 1.2) + j);
    ctx.strokeStyle = `rgba(255,${110 + (90 * pul) | 0},40,${(0.45 + 0.45 * pul).toFixed(2)})`; ctx.lineWidth = (1 + pul * 0.8) * k;
    ctx.beginPath(); ctx.moveTo(x, y0);
    for (let y = y0; y < y0 + len; y += 6 * k) ctx.lineTo(x + (hash(j * 13 + y) - 0.5) * 3 * k, y);
    ctx.stroke();
    const dl = 1.2 + hash(j * 9) * 1.6, dp = ((T() + hash(j * 3) * dl) % dl) / dl, dy = y0 + len + dp * dp * (seaTop - y0 - len);
    ctx.fillStyle = `rgba(255,190,80,${(1 - dp * 0.7).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(x, dy, 1.5 * k, (1.5 + dp * 2) * k, 0, 0, 6.283); ctx.fill();
  }
  ctx.restore();
  // ---- lavafalls spilling over the cliff into the sea ----
  for (let i = 0; i < 5; i++) {
    const x = cx + (-0.95 + i * 0.47 + (hash(i * 9.3) - 0.5) * 0.14) * R;
    lavafall(`ff${i}`, x, cliff - 2 * k, seaTop + 6 * k, (14 + hash(i * 2.2) * 18) * k, 50 + i * 3.3, k);
  }
  // ---- the glow on the floor above + embers ----
  ctx.globalCompositeOperation = 'lighter';
  const up = ctx.createLinearGradient(0, cliff - 60 * k, 0, cliff + 8 * k); up.addColorStop(0, 'rgba(255,90,20,0)'); up.addColorStop(1, 'rgba(255,120,30,.28)');
  ctx.fillStyle = up; ctx.fillRect(x0, cliff - 60 * k, x1 - x0, 68 * k);
  for (let i = 0; i < 36; i++) {
    const life = 3 + hash(i * 1.7) * 3, ph = ((T() + hash(i * 2.9) * life) % life) / life;
    const px = x0 + hash(i * 7.9) * (x1 - x0) + Math.sin(T() * 1.3 + i) * 14 * k, py = seaTop - ph * (seaTop - view.vy0) * 0.9;
    ctx.fillStyle = `rgba(255,${150 + (hash(i) * 90) | 0},60,${(Math.sin(ph * Math.PI) * 0.9).toFixed(2)})`; ctx.fillRect(px, py, 2 * k, 2 * k);
  }
  ctx.restore();
}
