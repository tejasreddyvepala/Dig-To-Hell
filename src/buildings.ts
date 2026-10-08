// BUILDINGS: one generic, data-driven construction renderer for every project on the ladder
// (Hut → Tiny Cabin → One-Story House → Two-Story Home → Farmhouse → Apartment Block → Office Tower → Mansion → The
// White House). Each project lists the KIND of each stage (foundation, studs, a floor's walls, roof, windows, portico
// columns, wings, landscaping…); the building visibly grows by those kinds, and the builders get work targets on the
// advancing edge of the current stage (sitecrew.ts). Geometry in worker units u; origin = the building's left/ground.
import { PROJECTS, type ProjectId } from './config';
import { nightness } from './landscape';
import { ctx as mainCtx } from './view';
import { hash } from './util';

type Kind = 'found' | 'frame' | 'frame1' | 'walls' | 'floor0' | 'floor1' | 'floor2' | 'floor3' | 'roof' | 'windows' | 'finish' | 'columns' | 'wings' | 'land';
type Pat = 'log' | 'plank' | 'brick' | 'siding' | 'stucco' | 'marble' | 'glass';
interface Def {
  kinds: Kind[]; floors: number; fh: number; slab: number;
  walls: string[]; pat: Pat[]; roof: 'gable' | 'hip' | 'flat' | 'thatch'; roofH: number; roofCol: string; trim: string;
  win: number[]; door: string; porch?: boolean; chimney?: number; columns?: number; portico?: number; wings?: number;
  balustrade?: boolean; flag?: boolean; sign?: string; balconies?: boolean; shutters?: string; barn?: boolean;
  spire?: boolean; stadium?: boolean; flagCol?: string;
}
export const BLD: Record<ProjectId, Def> = {
  hut: { kinds: ['found', 'walls', 'roof'], floors: 1, fh: 1.25, slab: 0.14, walls: ['#9a6a3c'], pat: ['plank'], roof: 'thatch', roofH: 1, roofCol: '#c9a24e', trim: '#5e3d20', win: [1], door: '#5a3a1e' },
  cabin: { kinds: ['found', 'frame', 'walls', 'roof', 'finish'], floors: 1, fh: 1.5, slab: 0.2, walls: ['#a4703e'], pat: ['log'], roof: 'gable', roofH: 1.15, roofCol: '#7a3b2e', trim: '#5e3d20', win: [1], door: '#6b3f24', porch: true, chimney: 1 },
  house: { kinds: ['found', 'frame', 'walls', 'roof', 'windows'], floors: 1, fh: 1.45, slab: 0.22, walls: ['#9fb8cc'], pat: ['siding'], roof: 'hip', roofH: 1, roofCol: '#4a4f5a', trim: '#f2efe6', win: [3], door: '#7a2e24', shutters: '#3f5a74' },
  home: { kinds: ['found', 'floor0', 'frame1', 'floor1', 'roof', 'windows', 'land'], floors: 2, fh: 1.35, slab: 0.24, walls: ['#a65a42', '#d9d2bf'], pat: ['brick', 'siding'], roof: 'hip', roofH: 1.2, roofCol: '#4a4f5a', trim: '#f2efe6', win: [2, 3], door: '#5a3a22', chimney: 1 },
  farm: { kinds: ['found', 'floor0', 'frame1', 'floor1', 'roof', 'windows', 'land'], floors: 2, fh: 1.45, slab: 0.26, walls: ['#f1ede2', '#f1ede2'], pat: ['plank', 'plank'], roof: 'gable', roofH: 1.6, roofCol: '#8e2f25', trim: '#3d5a3a', win: [2, 3], door: '#3d5a3a', porch: true, chimney: 2, barn: true, shutters: '#3d5a3a' },
  apartments: { kinds: ['found', 'floor0', 'floor1', 'floor2', 'roof', 'windows', 'land'], floors: 3, fh: 1.4, slab: 0.26, walls: ['#9c5240', '#a85a46', '#a85a46'], pat: ['brick', 'brick', 'brick'], roof: 'flat', roofH: 0.35, roofCol: '#55504a', trim: '#e8e2d6', win: [3, 4, 4], door: '#2f3a44', balconies: true },
  office: { kinds: ['found', 'frame', 'floor0', 'floor1', 'floor2', 'floor3', 'roof', 'windows'], floors: 4, fh: 1.4, slab: 0.3, walls: ['#5f7686', '#5f7686', '#5f7686', '#5f7686'], pat: ['glass', 'glass', 'glass', 'glass'], roof: 'flat', roofH: 0.4, roofCol: '#3d444c', trim: '#c9d2da', win: [4, 5, 5, 5], door: '#20262c', sign: 'DIG CO.' },
  mansion: { kinds: ['found', 'floor0', 'floor1', 'roof', 'columns', 'windows', 'land'], floors: 2, fh: 1.55, slab: 0.32, walls: ['#ecdcb8', '#ecdcb8'], pat: ['stucco', 'stucco'], roof: 'hip', roofH: 1.3, roofCol: '#3e3a3a', trim: '#fbf6ea', win: [4, 5], door: '#4a2c1a', columns: 4, portico: 2.6, chimney: 2, shutters: '#2f4a3a' },
  skyscraper: { kinds: ['found', 'frame', 'walls', 'roof', 'windows', 'land'], floors: 8, fh: 1.15, slab: 0.35, walls: Array(8).fill('#4f6a80'), pat: Array(8).fill('glass'), roof: 'flat', roofH: 0.5, roofCol: '#2c333b', trim: '#d8e2ea', win: [3, 6, 6, 6, 6, 6, 6, 6], door: '#1a2026', sign: 'DIG CORP', spire: true },
  stadium: { kinds: ['found', 'floor0', 'floor1', 'roof', 'windows', 'land'], floors: 2, fh: 1.7, slab: 0.3, walls: ['#c9c4bb', '#d8d3ca'], pat: ['stucco', 'stucco'], roof: 'flat', roofH: 0.3, roofCol: '#e8e8ea', trim: '#2d7fd0', win: [7, 9], door: '#2d7fd0', stadium: true, sign: 'DIG ARENA' },
  palace: { kinds: ['found', 'floor0', 'floor1', 'wings', 'roof', 'columns', 'windows', 'land'], floors: 2, fh: 1.8, slab: 0.45, walls: ['#2c2634', '#2c2634'], pat: ['marble', 'marble'], roof: 'hip', roofH: 1.6, roofCol: '#181220', trim: '#e8c45a', win: [5, 6], door: '#5a1010', columns: 8, portico: 4.6, wings: 2.8, balustrade: true, flag: true, flagCol: '#c0201a' },
  whitehouse: { kinds: ['found', 'floor0', 'floor1', 'wings', 'roof', 'columns', 'windows', 'land'], floors: 2, fh: 1.6, slab: 0.4, walls: ['#f3f0e8', '#f3f0e8'], pat: ['marble', 'marble'], roof: 'flat', roofH: 0.45, roofCol: '#d9d4c8', trim: '#ffffff', win: [4, 5], door: '#2f2a24', columns: 6, portico: 3.4, wings: 2.4, balustrade: true, flag: true },
};

const INK = '#2a1d12';
/** Drawing target (the main canvas, or an offscreen one for the distant town skyline). */
let c: CanvasRenderingContext2D = mainCtx;
/** Per-stage kind progress (-1 = this project has no such stage). */
function kindP(d: Def, p: number[], k: Kind) { const i = d.kinds.indexOf(k); return i < 0 ? -1 : p[i]; }

/** Geometry derived from the def (in u). */
function geo(id: ProjectId) {
  const d = BLD[id], w = PROJECTS.find((p) => p.id === id)!.w, wing = d.wings ?? 0;
  const mx0 = wing, mx1 = w - wing, top = d.slab + d.floors * d.fh;
  return { d, w, wing, mx0, mx1, mw: mx1 - mx0, top, roofTop: top + d.roofH };
}

/** Window/door slots in order of installation: ground-floor door first, then windows floor by floor. */
function slots(id: ProjectId) {
  const g = geo(id), d = g.d, out: { x: number; h: number; w: number; hh: number; door?: boolean; floor: number }[] = [];
  out.push({ x: g.mx0 + g.mw / 2 - 0.27, h: d.slab, w: 0.54, hh: Math.min(1.05, d.fh * 0.78), door: true, floor: 0 });
  for (let f = 0; f < d.floors; f++) {
    const n = d.win[Math.min(f, d.win.length - 1)], base = d.slab + f * d.fh, ww = d.pat[f] === 'glass' ? Math.min(0.8, (g.mw - 0.4) / n - 0.18) : 0.6;
    for (let i = 0; i < n; i++) {
      let x = g.mx0 + 0.3 + ((i + 0.5) / n) * (g.mw - 0.6) - ww / 2;
      if (f === 0 && Math.abs(x + ww / 2 - (g.mx0 + g.mw / 2)) < 0.5) x += x + ww / 2 < g.mx0 + g.mw / 2 ? -0.45 : 0.45; // clear the door
      out.push({ x, h: base + d.fh * 0.35, w: ww, hh: d.fh * 0.42, floor: f });
    }
  }
  if (g.wing) for (const side of [0, 1]) for (let i = 0; i < 2; i++) out.push({ x: (side ? g.mx1 : 0) + 0.35 + i * (g.wing - 0.7) / 1.2, h: d.slab + 0.45, w: 0.5, hh: 0.62, floor: -1 });
  return out;
}

/** Draw project `project` at per-stage progress `p` with its left/ground corner at the current origin (scale u). */
export function drawBuilding(project: number, u: number, p: number[], bp: boolean, t = 0, target: CanvasRenderingContext2D = mainCtx) {
  c = target;
  const id = PROJECTS[project].id, g = geo(id), d = g.d, U = (v: number) => v * u, night = nightness();
  const P = (k: Kind) => (bp ? 1 : kindP(d, p, k));
  const shape = (draw: () => void, col: string, out = true) => { // fill + ink outline (blueprint: dashed outline only)
    c.beginPath(); draw();
    if (bp) { c.stroke(); return; }
    c.fillStyle = col; c.fill(); if (out) { c.strokeStyle = INK; c.lineWidth = 1.3; c.lineJoin = 'round'; c.stroke(); }
  };
  const rect = (x: number, h: number, w: number, hh: number, col: string, out = true) => shape(() => c.rect(U(x), -U(h + hh), U(w), U(hh)), col, out);
  const pattern = (pat: Pat, x0: number, h0: number, w: number, hh: number) => { // wall texture in a clip
    if (bp) return;
    c.save(); c.beginPath(); c.rect(U(x0), -U(h0 + hh), U(w), U(hh)); c.clip();
    if (pat === 'log' || pat === 'plank' || pat === 'siding') {
      const step = pat === 'log' ? 0.18 : pat === 'plank' ? 0.16 : 0.11;
      for (let y = h0; y < h0 + hh; y += step) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(U(x0), -U(y), U(w), 1.4); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(U(x0), -U(y + step) + 1.5, U(w), 1); }
      if (pat === 'log') for (let y = h0; y < h0 + hh; y += 0.18) { c.fillStyle = 'rgba(80,45,20,.5)'; c.beginPath(); c.ellipse(U(x0) + 2, -U(y + 0.09), 2.5, U(0.08), 0, 0, 6.283); c.fill(); }
    } else if (pat === 'brick') {
      c.fillStyle = 'rgba(0,0,0,.16)';
      let r = 0; for (let y = h0; y < h0 + hh; y += 0.12, r++) { c.fillRect(U(x0), -U(y), U(w), 1); for (let x = x0 + (r % 2) * 0.13; x < x0 + w; x += 0.26) c.fillRect(U(x), -U(y + 0.12), 1, U(0.12)); }
    } else if (pat === 'stucco' || pat === 'marble') {
      c.fillStyle = pat === 'marble' ? 'rgba(160,150,130,.18)' : 'rgba(120,90,50,.12)';
      for (let y = h0; y < h0 + hh; y += 0.32) c.fillRect(U(x0), -U(y), U(w), 1);
      for (let i = 0; i < 6; i++) c.fillRect(U(x0 + hash(i * 3.1 + h0) * w), -U(h0 + hash(i * 5.7) * hh), U(0.25), 1);
    } else if (pat === 'glass') { // curtain wall: mullion grid over blue glass with sky reflections
      const gr = c.createLinearGradient(U(x0), -U(h0 + hh), U(x0 + w), -U(h0)); gr.addColorStop(0, 'rgba(190,225,245,.55)'); gr.addColorStop(0.5, 'rgba(90,130,160,.2)'); gr.addColorStop(1, 'rgba(200,230,250,.45)');
      c.fillStyle = gr; c.fillRect(U(x0), -U(h0 + hh), U(w), U(hh));
      c.fillStyle = 'rgba(30,40,50,.55)'; for (let x = x0; x < x0 + w; x += 0.55) c.fillRect(U(x), -U(h0 + hh), 1.5, U(hh));
      for (let y = h0; y < h0 + hh; y += d.fh / 2) c.fillRect(U(x0), -U(y), U(w), 1.5);
    }
    // light from the left/front: the right part of the wall in shade, a warm edge on the left
    const sh = c.createLinearGradient(U(x0), 0, U(x0 + w), 0); sh.addColorStop(0, 'rgba(255,230,190,.12)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,5,0,.22)');
    c.fillStyle = sh; c.fillRect(U(x0), -U(h0 + hh), U(w), U(hh));
    c.restore();
  };
  if (bp) { c.setLineDash([5, 4]); c.strokeStyle = 'rgba(140,200,255,.75)'; c.lineWidth = 1.5; }

  // ---- WINGS (White House): lower side blocks growing outward from the main body ----
  const wp = P('wings');
  if (g.wing && wp > 0) {
    const ww = g.wing * Math.min(1, wp * 1.25), wh = d.fh * 1.05;
    for (const side of [0, 1]) {
      const x = side ? g.mx1 : g.mx0 - ww;
      rect(x, 0, ww, d.slab, '#bdb6a6'); rect(x, d.slab, ww, wh, d.walls[0]); pattern(d.pat[0], x, d.slab, ww, wh);
      if (wp > 0.8) { rect(x - 0.05, d.slab + wh, ww + 0.1, 0.18, d.trim); if (d.balustrade && !bp) { c.fillStyle = d.trim; for (let bx = x + 0.1; bx < x + ww - 0.05; bx += 0.18) c.fillRect(U(bx), -U(d.slab + wh + 0.42), U(0.07), U(0.24)); c.fillRect(U(x), -U(d.slab + wh + 0.46), U(ww), U(0.06)); } }
    }
  }
  // ---- FOUNDATION: concrete slab poured left → right ----
  const fp = P('found');
  if (fp > 0) { rect(g.mx0 - 0.12, 0, (g.mw + 0.24) * fp, d.slab, '#9a958c'); if (!bp && d.slab > 0.3) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(U(g.mx0 - 0.12), -U(d.slab * 0.5), U((g.mw + 0.24) * fp), 1); } }
  // ---- FLOORS: studs (frame) then the wall material rising, floor by floor ----
  const whole = P('walls');
  for (let f = 0; f < d.floors; f++) {
    const base = d.slab + f * d.fh;
    const fpI = whole >= 0 ? Math.max(0, Math.min(1, (whole * d.floors) - f)) : Math.max(0, P(`floor${f}` as Kind));
    const fr = P('frame') >= 0 ? P('frame') : f === 1 ? P('frame1') : -1;
    if (fr > 0 && fpI < 1 && !(fr < 0)) { // studs (wood; steel for glass towers)
      const n = Math.max(4, Math.round(g.mw / 0.55)), shown = Math.ceil(fr * n), steel = d.pat[f] === 'glass';
      for (let i = 0; i < shown; i++) rect(g.mx0 + (i / (n - 1)) * (g.mw - 0.1), base, 0.1, d.fh, steel ? '#5d646d' : '#b58a52');
      if (fr > 0.85) rect(g.mx0, base + d.fh - 0.08, g.mw, 0.1, steel ? '#4a5058' : '#8a6236');
    }
    if (f > 0 && fpI > 0) rect(g.mx0 - 0.08, base - 0.06, g.mw + 0.16, 0.12, '#9a958c'); // floor slab
    if (fpI > 0) {
      const hh = d.fh * (bp ? 1 : fpI), col = d.walls[Math.min(f, d.walls.length - 1)];
      rect(g.mx0, base, g.mw, hh, col); pattern(d.pat[Math.min(f, d.pat.length - 1)], g.mx0, base, g.mw, hh);
      if (!bp && fpI < 1) { c.fillStyle = 'rgba(255,240,200,.25)'; c.fillRect(U(g.mx0), -U(base + hh) , U(g.mw), 2); } // fresh course
    }
  }
  // ---- WINDOWS & DOORS: installed one by one (lit warm at night) ----
  let wpr = P('windows'); if (wpr < 0) wpr = P('finish'); if (wpr < 0) wpr = P(d.kinds[d.kinds.length - 1]);
  const sl = slots(id), shownW = bp ? sl.length : Math.ceil(Math.max(0, wpr) * sl.length);
  for (let i = 0; i < shownW; i++) {
    const s = sl[i];
    if (!bp && s.floor >= 0) { const fpI = whole >= 0 ? whole * d.floors - s.floor : P(`floor${s.floor}` as Kind); if (fpI < 0.9) continue; }
    if (s.door) {
      rect(s.x - 0.06, s.h, s.w + 0.12, s.hh + 0.08, d.trim); rect(s.x, s.h, s.w, s.hh, d.door);
      if (!bp) { c.fillStyle = '#e8c45a'; c.beginPath(); c.arc(U(s.x + s.w * 0.78), -U(s.h + s.hh * 0.45), Math.max(1, U(0.035)), 0, 6.283); c.fill(); }
      continue;
    }
    const lit = night > 0.25 && hash(i * 7.3 + project) > 0.3;
    rect(s.x - 0.05, s.h - 0.05, s.w + 0.1, s.hh + 0.1, d.trim);
    rect(s.x, s.h, s.w, s.hh, lit ? '#ffd98a' : d.pat[0] === 'glass' ? '#a9d4ec' : '#9fd0ea', false);
    if (!bp) {
      if (!lit) { c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(U(s.x), -U(s.h + s.hh * 0.4)); c.lineTo(U(s.x + s.w * 0.4), -U(s.h + s.hh)); c.lineTo(U(s.x + s.w * 0.6), -U(s.h + s.hh)); c.lineTo(U(s.x), -U(s.h + s.hh * 0.15)); c.fill(); }
      c.fillStyle = d.trim; c.fillRect(U(s.x + s.w / 2) - 1, -U(s.h + s.hh), 2, U(s.hh)); c.fillRect(U(s.x), -U(s.h + s.hh / 2) - 1, U(s.w), 2);
      if (d.shutters) { c.fillStyle = d.shutters; c.fillRect(U(s.x - 0.17), -U(s.h + s.hh), U(0.12), U(s.hh)); c.fillRect(U(s.x + s.w + 0.05), -U(s.h + s.hh), U(0.12), U(s.hh)); }
      if (d.balconies && s.floor > 0) { c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(U(s.x - 0.1), -U(s.h + 0.05), U(s.w + 0.2), U(0.22)); c.fillStyle = '#3a3f45'; for (let x = s.x - 0.05; x < s.x + s.w + 0.1; x += 0.12) c.fillRect(U(x), -U(s.h + 0.05), 1, U(0.22)); }
      if (lit) { const gl = c.createRadialGradient(U(s.x + s.w / 2), -U(s.h + s.hh / 2), 0, U(s.x + s.w / 2), -U(s.h + s.hh / 2), U(0.7)); gl.addColorStop(0, 'rgba(255,210,130,.35)'); gl.addColorStop(1, 'rgba(255,210,130,0)'); c.fillStyle = gl; c.fillRect(U(s.x - 0.6), -U(s.h + s.hh + 0.6), U(s.w + 1.2), U(s.hh + 1.2)); }
    }
  }
  // ---- ROOF: filled from the eaves up ----
  const rp = P('roof');
  if (rp > 0) {
    const top = g.top, x0 = g.mx0 - 0.3, x1 = g.mx1 + 0.3;
    c.save();
    if (!bp) { c.beginPath(); c.rect(U(x0 - 1), -U(top + d.roofH * rp + 0.1), U(x1 - x0 + 2), U(d.roofH * rp + 0.2)); c.clip(); }
    if (d.roof === 'flat') {
      rect(g.mx0 - 0.08, top, g.mw + 0.16, d.roofH, d.roofCol);
      if (!bp) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(U(g.mx0 - 0.08), -U(top + d.roofH), U(g.mw + 0.16), 2); }
      if (d.balustrade && !bp) { c.fillStyle = d.trim; for (let bx = g.mx0 + 0.05; bx < g.mx1 - 0.05; bx += 0.18) c.fillRect(U(bx), -U(top + d.roofH + 0.3), U(0.07), U(0.3)); c.fillRect(U(g.mx0 - 0.05), -U(top + d.roofH + 0.34), U(g.mw + 0.1), U(0.06)); }
    } else {
      const peak = top + d.roofH;
      shape(() => {
        if (d.roof === 'hip') { c.moveTo(U(x0), -U(top - 0.05)); c.lineTo(U(g.mx0 + 0.9), -U(peak)); c.lineTo(U(g.mx1 - 0.9), -U(peak)); c.lineTo(U(x1), -U(top - 0.05)); }
        else { c.moveTo(U(x0), -U(top - 0.05)); c.lineTo(U((x0 + x1) / 2), -U(peak)); c.lineTo(U(x1), -U(top - 0.05)); }
        c.closePath();
      }, d.roofCol);
      if (!bp) { // shingles/thatch lines + the far slope in shade
        c.save(); c.clip();
        c.fillStyle = d.roof === 'thatch' ? 'rgba(90,60,20,.35)' : 'rgba(0,0,0,.18)';
        for (let y = top; y < peak; y += d.roof === 'thatch' ? 0.12 : 0.22) c.fillRect(U(x0), -U(y), U(x1 - x0), d.roof === 'thatch' ? 2 : 1.4);
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(U((x0 + x1) / 2), -U(peak), U((x1 - x0) / 2), U(peak - top + 0.1));
        c.restore();
      }
    }
    c.restore();
  }
  // ---- PORTICO + COLUMNS (Mansion, White House): columns rise one by one, then the pediment ----
  const cp = P('columns');
  if (d.columns && cp > 0) {
    const pw = d.portico ?? 2.4, px0 = g.mx0 + g.mw / 2 - pw / 2, ch = d.floors * d.fh, n = d.columns, shown = bp ? n : Math.ceil(cp * n);
    rect(px0 - 0.15, 0, pw + 0.3, d.slab * 0.8, '#d8d2c4'); // steps
    for (let i = 0; i < shown; i++) {
      const cx = px0 + (i / (n - 1)) * (pw - 0.22);
      rect(cx, d.slab, 0.22, ch, d.trim);
      if (!bp) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(U(cx + 0.14), -U(d.slab + ch), U(0.08), U(ch)); c.fillStyle = 'rgba(0,0,0,.1)'; for (let k = 1; k < 3; k++) c.fillRect(U(cx + k * 0.07), -U(d.slab + ch), 1, U(ch)); }
      rect(cx - 0.05, d.slab + ch - 0.12, 0.32, 0.12, d.trim); // capital
    }
    if (cp > 0.85) {
      rect(px0 - 0.2, d.slab + ch, pw + 0.4, 0.22, d.trim); // entablature
      shape(() => { c.moveTo(U(px0 - 0.25), -U(d.slab + ch + 0.22)); c.lineTo(U(px0 + pw / 2), -U(d.slab + ch + 0.9)); c.lineTo(U(px0 + pw + 0.25), -U(d.slab + ch + 0.22)); c.closePath(); }, d.trim); // pediment
    }
  }
  // ---- FINISH: porch, chimneys, sign, flag ----
  const fin = Math.max(P('finish'), wpr);
  if (d.porch && fin > 0.4) {
    const pw = d.barn ? g.mw : g.mw * 0.6, px = d.barn ? g.mx0 : g.mx0 + 0.1;
    rect(px - 0.1, 0, pw + 0.2, 0.12, '#8a6236');
    if (fin > 0.6) { for (const x of [px, px + pw - 0.1]) rect(x, 0.12, 0.1, d.fh * 0.78, '#f2efe6'); rect(px - 0.2, 0.12 + d.fh * 0.78, pw + 0.4, 0.14, d.roofCol); }
  }
  if (d.chimney && (P('finish') > 0.5 || (P('finish') < 0 && rp > 0.9))) for (let ci = 0; ci < d.chimney; ci++) {
    const cx = g.mx0 + (ci ? 0.25 : 0.72) * g.mw;
    rect(cx, g.top + d.roofH * 0.35, 0.3, d.roofH * 0.75, '#8d4b3a');
    if (!bp) { const k = (t * 0.5 + ci * 0.37) % 1; c.fillStyle = `rgba(220,220,220,${(0.35 * (1 - k)).toFixed(2)})`; c.beginPath(); c.arc(U(cx + 0.15 + k * 0.4), -U(g.top + d.roofH * 1.1 + k * 0.8), U(0.12 + k * 0.2), 0, 6.283); c.fill(); }
  }
  if (d.spire && rp > 0.6 && !bp) { // crown + needle spire with a blinking light
    const sx = g.mx0 + g.mw / 2, sy = g.top + d.roofH;
    rect(sx - 0.9, sy, 1.8, 0.5, '#3a434c'); rect(sx - 0.5, sy + 0.5, 1, 0.5, '#46505a');
    shape(() => { c.moveTo(U(sx - 0.08), -U(sy + 1)); c.lineTo(U(sx), -U(sy + 2.6)); c.lineTo(U(sx + 0.08), -U(sy + 1)); c.closePath(); }, '#c9d2da');
    if (Math.floor(t * 1.3) % 2) { c.fillStyle = '#ff3b2f'; c.beginPath(); c.arc(U(sx), -U(sy + 2.6), Math.max(2, U(0.06)), 0, 6.283); c.fill(); }
  }
  if (d.stadium && rp > 0.3 && !bp) { // a sweeping canopy over the stands + four floodlight masts
    const top = g.top + d.roofH;
    shape(() => { c.moveTo(U(g.mx0 - 0.3), -U(top)); c.quadraticCurveTo(U(g.mx0 + g.mw / 2), -U(top + 1.6 * Math.min(1, rp)), U(g.mx1 + 0.3), -U(top)); c.lineTo(U(g.mx1 + 0.3), -U(top - 0.2)); c.quadraticCurveTo(U(g.mx0 + g.mw / 2), -U(top + 1.3 * Math.min(1, rp)), U(g.mx0 - 0.3), -U(top - 0.2)); c.closePath(); }, '#eef0f2');
    const lit = nightness() > 0.2;
    for (const mx of [g.mx0 + 0.4, g.mx0 + g.mw * 0.3, g.mx0 + g.mw * 0.7, g.mx1 - 0.4]) {
      rect(mx - 0.05, top, 0.1, 2.2, '#5d646d'); rect(mx - 0.45, top + 2.2, 0.9, 0.4, '#2c333b');
      for (let i = 0; i < 4; i++) rect(mx - 0.4 + i * 0.21, top + 2.26, 0.16, 0.26, lit ? '#fffbe0' : '#c9d2da', false);
    }
  }
  if (d.sign && rp > 0.8 && !bp) {
    const sx = g.mx0 + g.mw / 2, sy = g.top + d.roofH;
    rect(sx - 1.1, sy + 0.1, 2.2, 0.55, '#1f2a33');
    c.font = `${Math.round(U(0.36))}px 'Bungee',Impact,sans-serif`; c.textAlign = 'center'; c.fillStyle = night > 0.2 ? '#ffd84a' : '#f2c64a'; c.fillText(d.sign, U(sx), -U(sy + 0.22));
  }
  // ---- LANDSCAPING ----
  const lp = P('land');
  if (lp > 0 && !bp) {
    if (lp > 0.05) { c.fillStyle = '#5e8f45'; c.fillRect(U(-0.9), -U(0.08), U(g.w + 1.8), U(0.1)); }
    if (lp > 0.25) { c.fillStyle = '#c9bea6'; c.fillRect(U(g.mx0 + g.mw / 2 - 0.3), -U(0.06), U(0.6), U(0.08)); }
    if (lp > 0.45) for (const bx of [g.mx0 + 0.2, g.mx1 - 0.8]) { c.fillStyle = '#3f7a3a'; c.beginPath(); c.ellipse(U(bx + 0.3), -U(0.22), U(0.34), U(0.24), 0, 0, 6.283); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
    if (lp > 0.7) for (const tx of [-0.6, g.w + 0.55]) { c.fillStyle = '#6b4a2e'; c.fillRect(U(tx), -U(1.1), U(0.12), U(1.1)); c.fillStyle = '#4c8a3c'; c.beginPath(); c.arc(U(tx + 0.06), -U(1.4), U(0.52), 0, 6.283); c.fill(); c.strokeStyle = INK; c.stroke(); }
    if (d.barn && lp > 0.5) { // a little red barn + hay bales
      const bx = g.w + 1.2; rect(bx, 0, 1.6, 1.1, '#9c3226'); shape(() => { c.moveTo(U(bx - 0.1), -U(1.1)); c.lineTo(U(bx + 0.8), -U(1.75)); c.lineTo(U(bx + 1.7), -U(1.1)); c.closePath(); }, '#6e2a20');
      c.strokeStyle = '#f1ede2'; c.lineWidth = 2; c.strokeRect(U(bx + 0.5), -U(0.75), U(0.6), U(0.75)); c.beginPath(); c.moveTo(U(bx + 0.5), -U(0.75)); c.lineTo(U(bx + 1.1), 0); c.moveTo(U(bx + 1.1), -U(0.75)); c.lineTo(U(bx + 0.5), 0); c.stroke();
      for (let i = 0; i < 2; i++) { c.fillStyle = '#d9b45a'; c.beginPath(); c.ellipse(U(-0.5 + i * 0.5), -U(0.2), U(0.24), U(0.2), 0, 0, 6.283); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
    }
    if (lp > 0.9 && !d.flag) { c.fillStyle = '#efe9da'; for (let x = -0.9; x < -0.1; x += 0.16) c.fillRect(U(x), -U(0.42), U(0.06), U(0.42)); c.fillRect(U(-0.9), -U(0.34), U(0.8), U(0.05)); }
    if (d.flag && lp > 0.6) { // the flag on the roof, waving
      const fx = g.mx0 + g.mw / 2, fy = g.top + d.roofH;
      c.fillStyle = '#d8d8d8'; c.fillRect(U(fx) - 1, -U(fy + 1.6), 2, U(1.6));
      for (let i = 0; i < 7; i++) { c.fillStyle = d.flagCol ? (i % 2 ? '#1a0a0a' : d.flagCol) : i % 2 ? '#f4f4f4' : '#c0392b'; c.beginPath(); for (let k = 0; k <= 8; k++) { const x = fx + k * 0.1, y = fy + 1.55 - i * 0.07 + Math.sin(t * 4 + k * 0.7) * 0.04 * k / 8; k ? c.lineTo(U(x), -U(y)) : c.moveTo(U(x), -U(y)); } for (let k = 8; k >= 0; k--) { const x = fx + k * 0.1, y = fy + 1.55 - (i + 1) * 0.07 + Math.sin(t * 4 + k * 0.7) * 0.04 * k / 8; c.lineTo(U(x), -U(y)); } c.fill(); }
      c.fillStyle = d.flagCol ? '#e8c45a' : '#2c3e70'; c.fillRect(U(fx), -U(fy + 1.55), U(0.36), U(0.28));
    }
    if (d.flag && lp > 0.3) { c.fillStyle = '#7bb5d6'; c.beginPath(); c.ellipse(U(g.w / 2), -U(0.1), U(0.9), U(0.12), 0, 0, 6.283); c.fill(); } // fountain pool
  }
  if (bp) c.setLineDash([]);
}

export interface WPt { x: number; h: number }
/** Builders' targets on the advancing edge of stage `stage` at progress p (u, building space). */
export function bldTargets(project: number, stage: number, p: number): WPt[] {
  const id = PROJECTS[project].id, g = geo(id), d = g.d, k = d.kinds[stage];
  const cl = (x: number) => Math.max(g.mx0 + 0.15, Math.min(g.mx1 - 0.15, x));
  const spread = (h: number) => [0.15, 0.4, 0.65, 0.88].map((t) => ({ x: g.mx0 + t * g.mw, h }));
  switch (k) {
    case 'found': { const e = g.mx0 - 0.1 + (g.mw + 0.2) * p; return [e, e - 0.7, e - 1.4].map((x) => ({ x: cl(x), h: d.slab })); }
    case 'frame': case 'frame1': { const f0 = k === 'frame1' ? 1 : 0, hh = d.slab + f0 * d.fh + Math.min(d.floors - f0, 1 + p * (d.floors - f0 - 1)) * d.fh * 0.7; const ex = g.mx0 + p * g.mw; return [{ x: cl(ex), h: hh }, { x: cl(ex - 0.6), h: hh - 0.4 }, { x: cl(ex), h: d.slab + 0.6 }]; }
    case 'walls': return spread(Math.max(0.35, d.slab + d.floors * d.fh * p));
    case 'roof': { const hr = g.top + (d.roof === 'flat' ? 0.2 : d.roofH * p); return [{ x: g.mx0 + g.mw * 0.3, h: hr }, { x: g.mx0 + g.mw * 0.5, h: hr }, { x: g.mx0 + g.mw * 0.7, h: hr }]; }
    case 'windows': case 'finish': { const sl = slots(id), i = Math.min(sl.length - 1, Math.floor(p * sl.length)), s = sl[i], s2 = sl[Math.min(sl.length - 1, i + 1)]; return [{ x: s.x + s.w / 2, h: s.h + s.hh / 2 }, { x: s2.x + s2.w / 2, h: s2.h + s2.hh / 2 }]; }
    case 'columns': { const pw = d.portico ?? 2.4, px0 = g.mx0 + g.mw / 2 - pw / 2, n = d.columns ?? 4, i = Math.min(n - 1, Math.floor(p * n)), cx = px0 + (i / (n - 1)) * (pw - 0.22) + 0.11; return [{ x: cx, h: 0.6 + p * d.floors * d.fh * 0.6 }, { x: cx, h: 0.5 }]; }
    case 'wings': { const ww = g.wing * Math.min(1, p * 1.25); return [{ x: g.mx0 - ww + 0.2, h: d.slab + 0.6 }, { x: g.mx1 + ww - 0.2, h: d.slab + 0.6 }, { x: g.mx1 + ww * 0.5, h: d.slab + 1.1 }]; }
    case 'land': return [{ x: 0.8, h: 0.08 }, { x: g.mx0 + g.mw / 2, h: 0.06 }, { x: g.w - 0.5, h: 0.2 }];
    default: { const f = parseInt(k.slice(5)), hh = d.slab + f * d.fh + d.fh * p; return spread(Math.max(0.35, hh)); } // floorN
  }
}
