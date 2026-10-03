// Construction site (Spec §10): the plot along the road right of the yard. Blocks delivered by the truck stack on
// the left of the plot; builders carry them to the building, which visibly grows stage by stage. A finished
// property gets a SOLD sign, is cleared, and the next (bigger) project's blueprint appears.
// Drawing in surface virtual px (scale from the worker unit u); all state read from S + presentation-only SITE.
import { CFG, PROJECTS } from './config';
import { S } from './state';
import { buildUnlocked, mixPick, projectValue } from './economy';
import { rubbleRGB } from './geo';
import type { BuildEvent } from './construction';
import { drawScaffold, drawSiteCrew, updateSiteCrew } from './sitecrew';
import { pileLabel } from './draw';
import { FX, addPart, popup } from './fx';
import { playKnock, playSold, playSting, playCoin } from './audio';
import { duckMusic } from './music';
import { toast } from './toast';
import { ctx, faceScale, surfaceLayout, view } from './view';
import { hash, money, rgb, rnd } from './util';

const FONT_UI = "'Rubik',system-ui,sans-serif";
const FONT_D = "'Bungee',Impact,sans-serif";
const B = CFG.build;

/** Presentation-only site state (never saved). */
export const SITE = {
  sold: null as null | { t: number; project: number; value: number }, // SOLD hold + cleanup of the previous building
  lastStageDone: '',
};

// ---- block colour (pressed aggregate, from the material's geology) ----
let lastCol: [number, number, number] = [160, 152, 140];
function blockCol(): [number, number, number] {
  const l = S.build.material;
  if (l.qty <= 0) return lastCol;
  const m = rubbleRGB(mixPick(l, 0.5));
  return (lastCol = [m[0] * 0.55 + 150 * 0.45, m[1] * 0.55 + 146 * 0.45, m[2] * 0.55 + 140 * 0.45]);
}

/** Per-stage progress 0..1 for the current project (or all 1 for a finished/sold building). */
function stageProgress(project: number, full: boolean): number[] {
  const st = PROJECTS[project].stages;
  return st.map((s, i) => {
    if (full || S.build.done) return 1;
    if (i < S.build.stage) return 1;
    if (i === S.build.stage && S.build.active) return Math.min(1, S.build.used / s.blocks);
    return 0;
  });
}

export function presentBuild(events: BuildEvent[]) {
  const L = surfaceLayout(), u = L.u;
  const bx = L.plotX0 + 2.6 * u;
  for (const e of events) {
    // the BUILD tab reports meaningful changes wherever the player is (never progress ticks)
    const nm = (e.name ?? '').toUpperCase();
    if (e.type === 'stageStart') toast('build', `🏗 ${nm} STARTED`, '', 'event', 2.4);
    else if (e.type === 'stageDone') toast('build', `✓ ${nm} COMPLETE`, '+' + money(e.cash ?? 0), 'cash', 2.8);
    else if (e.type === 'complete') toast('build', `🏠 ${nm} COMPLETE`, 'PROPERTY READY', 'big', 3.6);
    if (e.type === 'stageStart') playKnock(0.8);
    else if (e.type === 'stageDone') {
      popup(bx + 1.8 * u, L.gy - 3.2 * u, '+' + money(e.cash ?? 0), '#ffd84a', 24 * Math.sqrt(faceScale() / CFG.fxScaleRef), { life: 2.2, pop: 0.5, sub: (e.name ?? '').toUpperCase() + ' ✓', rise: 0.5 });
      playCoin(0.9);
      dustBurst(bx + 1.8 * u, L.gy - 0.2 * u, 8, u);
    } else if (e.type === 'complete') {
      playSting();
      if (view.site === 'build') FX.banner = { s: (e.name ?? '').toUpperCase() + ' COMPLETE', sub: `Sell it for ${money(e.cash ?? 0)}`, t: 0 };
    } else if (e.type === 'sold') {
      SITE.sold = { t: 0, project: e.project ?? 0, value: e.cash ?? 0 };
      popup(bx + 1.8 * u, L.gy - 3.6 * u, '+' + money(e.cash ?? 0), '#ffd84a', 40 * Math.sqrt(faceScale() / CFG.fxScaleRef), { life: 3.2, pop: 0.8, sub: 'PROPERTY SOLD', rise: 0.3 });
      playSold(); duckMusic();
      for (let i = 0; i < 40; i++) {
        const cols = ['#ffd84a', '#7ee08a', '#ff7a5c', '#8ac8ff'];
        addPart({ kind: 'frag', x: bx + 1.8 * u + rnd(-u, u), y: L.gy - 2.6 * u, vx: rnd(-160, 160), vy: rnd(-420, -160), vr: rnd(-12, 12), size: rnd(3, 5), col: cols[i % 4], life: rnd(1, 1.6), floor: L.gy, bounce: 0.2, shape: true });
      }
    }
  }
}

function dustBurst(x: number, y: number, n: number, u: number) {
  for (let i = 0; i < n; i++) addPart({ kind: 'dust', x: x + rnd(-u, u), y: y + rnd(-4, 4), vx: rnd(-40, 40), vy: rnd(-40, -8), size: rnd(4, 8), col: 'rgba(200,180,150,1)', life: rnd(0.5, 0.9), floor: Infinity, bounce: 0 });
}

export function updateSite(dt: number) {
  if (SITE.sold) {
    SITE.sold.t += dt;
    const L = surfaceLayout();
    if (SITE.sold.t > B.soldHoldSecs && SITE.sold.t < B.soldHoldSecs + B.clearSecs && Math.random() < dt * 12) dustBurst(L.plotX0 + 4.4 * L.u, L.gy - 0.3 * L.u, 1, L.u * 1.6);
    if (SITE.sold.t > B.soldHoldSecs + B.clearSecs) SITE.sold = null;
  }
  // builders move to where the building is growing and hammer it (sounds come from their impacts)
  updateSiteCrew(dt, siteVisible());
}

function siteVisible() {
  const L = surfaceLayout();
  return L.plotX1 > view.vx0 && L.plotX0 < view.vx1 && L.gy > view.vy0 - 50 && L.gy < view.vy1 + 400;
}

// ---------- drawing ----------
export function drawSite() {
  if (!siteVisible()) return;
  const L = surfaceLayout(), u = L.u, gy = L.gy;
  const x0 = L.plotX0, x1 = L.plotX1;
  // plot: levelled dirt, corner posts, string line
  ctx.fillStyle = '#7a5d3e'; ctx.fillRect(x0, gy - 2, x1 - x0, 6);
  ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 14; i++) ctx.fillRect(x0 + hash(i * 3.3) * (x1 - x0), gy + hash(i) * 3, 3, 1.5);
  ctx.fillStyle = '#c99a5a';
  for (const px of [x0 + 0.1 * u, x1 - 0.1 * u]) ctx.fillRect(px - 2, gy - 0.5 * u, 4, 0.5 * u);
  ctx.strokeStyle = 'rgba(255,120,60,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 0.1 * u, gy - 0.45 * u); ctx.lineTo(x1 - 0.1 * u, gy - 0.45 * u); ctx.stroke();

  const bx = x0 + 2.6 * u;
  if (!buildUnlocked(S)) { drawLockedPlot(x0, x1, gy, u); return; } // foreshadowing: an empty, surveyed lot
  const sold = SITE.sold;
  if (sold) {
    // the finished building stands with a SOLD sign, then is cleared
    const clearK = Math.max(0, (sold.t - B.soldHoldSecs) / B.clearSecs);
    if (clearK < 1) {
      ctx.save();
      // sinks into the dust as it is cleared
      ctx.beginPath(); ctx.rect(x0 - u, gy - 8 * u, x1 - x0 + 2 * u, 8 * u); ctx.clip();
      ctx.translate(0, clearK * clearK * 4 * u);
      drawBuilding(sold.project, bx, gy, u, stageProgress(sold.project, true), false);
      ctx.restore();
      if (clearK > 0) drawDozer(x0 - 1.4 * u + (x1 - x0 + 1.4 * u) * clearK, gy, u);
    }
    if (clearK <= 0.15) drawSign(bx + 1.6 * u, gy, u, 'SOLD', '#c0392b', '#fff');
  } else {
    const prog = stageProgress(S.build.project, false);
    const any = prog.some((p) => p > 0);
    if (!any) drawBuilding(S.build.project, bx, gy, u, prog.map(() => 1), true); // blueprint of what will stand here
    else drawBuilding(S.build.project, bx, gy, u, prog, false);
    if (S.build.done) drawSign(bx - 0.2 * u, gy, u, 'FOR SALE', '#f2c64a', '#2a2100');
  }
  // project board at the plot's front
  const pr = PROJECTS[S.build.project];
  const bxs = x1 + 0.9 * u; // the project board stands just past the plot's right corner
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(bxs - 0.5 * u, gy - 0.9 * u, 3, 0.9 * u); ctx.fillRect(bxs + 0.5 * u - 3, gy - 0.9 * u, 3, 0.9 * u);
  ctx.fillStyle = '#2f3a2f'; ctx.fillRect(bxs - 0.75 * u, gy - 1.45 * u, 1.5 * u, 0.6 * u);
  ctx.font = `${Math.round(u * 0.13)}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe08a';
  ctx.fillText(`#${S.stats.sold + 1} ${pr.name.toUpperCase()}`, bxs, gy - 1.2 * u);
  ctx.font = `600 ${Math.round(u * 0.14)}px ${FONT_UI}`; ctx.fillStyle = '#e8f0e0';
  ctx.fillText(money(projectValue(S)), bxs, gy - 0.98 * u);

  drawStack(x0 + 1.0 * u, gy, u);
  drawScaffold(bx, gy, u);
  drawSiteCrew(bx, gy, u, rgb(blockCol(), 1));
}

/** Before BUILD unlocks: survey stakes with flags, a construction fence and a blank sign board. No crew, no stack. */
function drawLockedPlot(x0: number, x1: number, gy: number, u: number) {
  for (let i = 0; i < 4; i++) { // survey stakes with orange flags
    const sx = x0 + (x1 - x0) * (0.2 + i * 0.2);
    ctx.fillStyle = '#c99a5a'; ctx.fillRect(sx - 1.5, gy - 0.42 * u, 3, 0.42 * u);
    ctx.fillStyle = '#ff7a3c'; ctx.beginPath(); ctx.moveTo(sx + 1.5, gy - 0.42 * u); ctx.lineTo(sx + 0.16 * u, gy - 0.36 * u); ctx.lineTo(sx + 1.5, gy - 0.3 * u); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,140,60,.55)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
  ctx.strokeRect(x0 + (x1 - x0) * 0.2, gy - 0.3 * u, (x1 - x0) * 0.6, 0.3 * u); ctx.setLineDash([]);
  // construction fence panels along the front
  for (let x = x0 - 0.6 * u; x < x1 + 0.4 * u; x += 0.9 * u) {
    ctx.fillStyle = 'rgba(140,145,150,.8)'; ctx.fillRect(x, gy - 0.62 * u, 2, 0.62 * u);
    ctx.strokeStyle = 'rgba(170,175,180,.45)'; ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, gy - k * 0.15 * u); ctx.lineTo(x + 0.9 * u, gy - k * 0.15 * u); ctx.stroke(); }
  }
  // blank sign board: something will be built here
  const bxs = x1 + 0.9 * u;
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(bxs - 0.5 * u, gy - 0.9 * u, 3, 0.9 * u); ctx.fillRect(bxs + 0.5 * u - 3, gy - 0.9 * u, 3, 0.9 * u);
  ctx.fillStyle = '#2f3a2f'; ctx.fillRect(bxs - 0.75 * u, gy - 1.45 * u, 1.5 * u, 0.6 * u);
  ctx.font = `${Math.round(u * 0.14)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,224,138,.8)';
  ctx.fillText('FUTURE BUILD SITE', bxs, gy - 1.08 * u);
}

function drawStack(cx: number, gy: number, u: number) {
  const q = S.build.material.qty, col = blockCol();
  const per = 4, n = Math.min(36, Math.ceil(q / per)), cols = 4, bw = u * 0.3, bh = u * 0.18;
  ctx.fillStyle = '#8a6a44'; ctx.fillRect(cx - (cols * bw) / 2 - 2, gy - u * 0.06, cols * bw + 4, u * 0.06);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = cx - (cols * bw) / 2 + c * bw, y = gy - u * 0.06 - (r + 1) * bh;
    ctx.fillStyle = rgb(col, 0.92 + hash(i) * 0.12); ctx.fillRect(x + 1, y, bw - 2, bh - 1);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 1, y, bw - 2, bh * 0.22);
  }
  const top = gy - u * 0.06 - Math.ceil(Math.max(1, n) / cols) * bh;
  if (q >= 1 || S.build.project > 0 || S.stats.delivered > 0) {
    pileLabel(cx, top - u * 0.16, Math.floor(q), Math.round(12 + u * 0.08), false);
    ctx.font = `600 ${Math.round(9 + u * 0.05)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('blocks on site', cx, top + u * 0.04);
  }
}

function drawSign(x: number, gy: number, u: number, text: string, bg: string, fg: string) {
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(x - 2, gy - 1.2 * u, 4, 1.2 * u);
  ctx.fillStyle = bg; ctx.fillRect(x - 0.6 * u, gy - 1.5 * u, 1.2 * u, 0.45 * u);
  ctx.font = `${Math.round(u * 0.2)}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.fillStyle = fg;
  ctx.fillText(text, x, gy - 1.2 * u);
}

function drawDozer(x: number, gy: number, u: number) {
  ctx.fillStyle = '#23262a'; ctx.beginPath(); ctx.roundRect(x - 0.7 * u, gy - 0.32 * u, 1.4 * u, 0.32 * u, 0.14 * u); ctx.fill();
  ctx.fillStyle = '#eab01c'; ctx.fillRect(x - 0.55 * u, gy - 0.75 * u, 1.0 * u, 0.45 * u);
  ctx.fillStyle = '#9fd0ea'; ctx.fillRect(x - 0.4 * u, gy - 1.1 * u, 0.45 * u, 0.36 * u);
  ctx.fillStyle = '#d99a14'; ctx.fillRect(x - 0.45 * u, gy - 1.14 * u, 0.55 * u, 0.06 * u);
  ctx.fillStyle = '#5f666e'; ctx.fillRect(x + 0.7 * u, gy - 0.6 * u, 0.12 * u, 0.6 * u); // blade
}

// ---------- buildings ----------
const WOOD = '#b58a52', WOOD_D = '#8a6236', LOG = '#a4703e', CONC = '#9a958c';

/** Draw a project at per-stage progress `p` with its left-bottom corner at (bx, gy). `blueprint` = outline only. */
function drawBuilding(project: number, bx: number, gy: number, u: number, p: number[], blueprint: boolean) {
  ctx.save();
  ctx.translate(bx, gy);
  if (blueprint) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(140,200,255,.75)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(0,0,0,0)';
  }
  if (PROJECTS[project].id === 'cabin') cabin(u, p, blueprint); else home(u, p, blueprint);
  ctx.restore();
  if (blueprint) {
    ctx.setLineDash([]);
    ctx.font = `600 ${Math.round(9 + u * 0.06)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(160,210,255,.9)';
    ctx.fillText('BLUEPRINT', bx + (PROJECTS[project].id === 'cabin' ? 1.7 : 2.3) * u, gy - 0.35 * u);
  }
}

/** Fill helper: in blueprint mode strokes the outline instead. */
function box(x: number, y: number, w: number, h: number, col: string, bp: boolean) {
  if (bp) { ctx.strokeRect(x, y, w, h); return; }
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
}

function cabin(u: number, p: number[], bp: boolean) {
  const w = 3.4 * u, slab = 0.2 * u, H = 1.5 * u, y0 = -slab, top = y0 - H;
  // 0 FOUNDATION: slab poured left -> right
  if (p[0] > 0) box(-0.1 * u, y0, (w + 0.2 * u) * p[0], slab, CONC, bp);
  // 1 FRAME: studs one by one, then the top plate
  if (p[1] > 0) {
    const n = 7, shown = Math.ceil(p[1] * n);
    for (let i = 0; i < shown; i++) box((i / (n - 1)) * (w - 0.1 * u), top, 0.1 * u, H, WOOD, bp);
    if (p[1] > 0.85) box(0, top - 0.06 * u, w, 0.1 * u, WOOD_D, bp);
  }
  // 2 WALLS: log courses from the bottom up
  if (p[2] > 0 && !bp) {
    const h = H * p[2];
    ctx.fillStyle = LOG; ctx.fillRect(0, y0 - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = y0 - 0.18 * u; y > y0 - h; y -= 0.18 * u) ctx.fillRect(0, y, w, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, y0 - h, w, 2);
  }
  // 3 ROOF: gable filling from the eaves to the ridge
  if (p[3] > 0) {
    const ridge = top - 1.15 * u;
    ctx.save();
    if (!bp) { ctx.beginPath(); ctx.rect(-0.5 * u, top - (top - ridge) * p[3] - 2, w + u, (top - ridge) * p[3] + 0.2 * u); ctx.clip(); }
    ctx.beginPath(); ctx.moveTo(-0.3 * u, top + 0.05 * u); ctx.lineTo(w / 2, ridge); ctx.lineTo(w + 0.3 * u, top + 0.05 * u); ctx.closePath();
    if (bp) ctx.stroke(); else { ctx.fillStyle = '#7a3b2e'; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 1; i < 5; i++) ctx.fillRect(-0.3 * u, top - (i * (top - ridge)) / 5, w + 0.6 * u, 1.5); }
    ctx.restore();
  }
  // 4 FINISHING: door, window, chimney, porch, lantern
  const f = p[4];
  if (f > 0.05) box(w * 0.18, y0 - 0.95 * u, 0.42 * u, 0.95 * u, '#6b3f24', bp);
  if (f > 0.3) { box(w * 0.58, y0 - 1.1 * u, 0.62 * u, 0.48 * u, '#9fd0ea', bp); if (!bp) { ctx.fillStyle = '#f2ead8'; ctx.fillRect(w * 0.58 + 0.3 * u, y0 - 1.1 * u, 2, 0.48 * u); } }
  if (f > 0.5) box(w * 0.7, top - 1.05 * u, 0.28 * u, 0.7 * u, '#7d4b3a', bp);
  if (f > 0.7) box(w * 0.1, y0 - 0.02 * u, 0.7 * u, 0.12 * u, WOOD_D, bp);
  if (f > 0.9 && !bp) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(w * 0.12, y0 - 1.15 * u, 0.08 * u, 0.12 * u); ctx.fillStyle = '#5a9a4a'; ctx.fillRect(w * 0.58, y0 - 0.6 * u, 0.62 * u, 0.1 * u); }
}

function home(u: number, p: number[], bp: boolean) {
  const w = 4.6 * u, slab = 0.24 * u, F = 1.35 * u, y0 = -slab, y1 = y0 - F, y2 = y1 - 0.12 * u - F;
  // 0 FOUNDATION
  if (p[0] > 0) box(-0.12 * u, y0, (w + 0.24 * u) * p[0], slab, CONC, bp);
  // 1 GROUND FLOOR: brick courses
  if (p[1] > 0) {
    const h = F * (bp ? 1 : p[1]);
    box(0, y0 - h, w, h, '#a65a42', bp);
    if (!bp) { ctx.fillStyle = 'rgba(0,0,0,.14)'; for (let y = y0 - 0.12 * u; y > y0 - h; y -= 0.12 * u) ctx.fillRect(0, y, w, 1); }
  }
  // 2 UPPER FLOOR: floor slab, then studs
  if (p[2] > 0) {
    box(-0.1 * u, y1 - 0.12 * u, (w + 0.2 * u) * Math.min(1, p[2] * 2), 0.12 * u, CONC, bp);
    if (p[2] > 0.5) { const n = 9, shown = Math.ceil(((p[2] - 0.5) / 0.5) * n); for (let i = 0; i < shown; i++) box((i / (n - 1)) * (w - 0.1 * u), y2, 0.1 * u, F, WOOD, bp); }
  }
  // 3 WALLS & SIDING: siding over the upper floor
  if (p[3] > 0 && !bp) {
    const h = F * p[3];
    ctx.fillStyle = '#d9d2bf'; ctx.fillRect(0, y1 - 0.12 * u - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.1)'; for (let y = y1 - 0.12 * u - 0.1 * u; y > y1 - 0.12 * u - h; y -= 0.1 * u) ctx.fillRect(0, y, w, 1);
  }
  // 4 ROOF: hip roof, filled from the eaves up
  if (p[4] > 0) {
    const rt = y2 - 1.2 * u;
    ctx.save();
    if (!bp) { ctx.beginPath(); ctx.rect(-0.6 * u, y2 - (y2 - rt) * p[4] - 2, w + 1.2 * u, (y2 - rt) * p[4] + 0.2 * u); ctx.clip(); }
    ctx.beginPath(); ctx.moveTo(-0.35 * u, y2 + 0.05 * u); ctx.lineTo(0.8 * u, rt); ctx.lineTo(w - 0.8 * u, rt); ctx.lineTo(w + 0.35 * u, y2 + 0.05 * u); ctx.closePath();
    if (bp) ctx.stroke(); else { ctx.fillStyle = '#4a4f5a'; ctx.fill(); }
    ctx.restore();
  }
  // 5 WINDOWS & DOORS
  const k = p[5], items = [
    () => box(w * 0.42, y0 - 1.0 * u, 0.5 * u, 1.0 * u, '#5a3a22', bp), // front door
    () => box(w * 0.1, y0 - 1.0 * u, 0.62 * u, 0.5 * u, '#9fd0ea', bp),
    () => box(w * 0.72, y0 - 1.0 * u, 0.62 * u, 0.5 * u, '#9fd0ea', bp),
    () => box(w * 0.1, y1 - 1.05 * u, 0.62 * u, 0.55 * u, '#9fd0ea', bp),
    () => box(w * 0.42, y1 - 1.05 * u, 0.62 * u, 0.55 * u, '#9fd0ea', bp),
    () => box(w * 0.72, y1 - 1.05 * u, 0.62 * u, 0.55 * u, '#9fd0ea', bp),
  ];
  const shownW = bp ? items.length : Math.ceil(k * items.length);
  for (let i = 0; i < shownW; i++) items[i]();
  // 6 LANDSCAPING: lawn, path, bushes, tree, fence
  const g = bp ? 0 : p[6];
  if (g > 0.05) { ctx.fillStyle = '#5e8f45'; ctx.fillRect(-0.9 * u, -0.08 * u, w + 1.6 * u, 0.1 * u); }
  if (g > 0.25) { ctx.fillStyle = '#b9ad95'; ctx.fillRect(w * 0.42, -0.06 * u, 0.5 * u, 0.08 * u); }
  if (g > 0.45) { ctx.fillStyle = '#3f7a3a'; for (const bxx of [0.05, 0.75]) { ctx.beginPath(); ctx.ellipse(w * bxx + 0.3 * u, -0.2 * u, 0.32 * u, 0.22 * u, 0, 0, 6.283); ctx.fill(); } }
  if (g > 0.7) { ctx.fillStyle = '#6b4a2e'; ctx.fillRect(w + 0.55 * u, -1.1 * u, 0.12 * u, 1.1 * u); ctx.fillStyle = '#4c8a3c'; ctx.beginPath(); ctx.arc(w + 0.61 * u, -1.35 * u, 0.5 * u, 0, 6.283); ctx.fill(); }
  if (g > 0.9) { ctx.fillStyle = '#efe9da'; for (let x = -0.9 * u; x < -0.1 * u; x += 0.16 * u) ctx.fillRect(x, -0.42 * u, 0.06 * u, 0.42 * u); ctx.fillRect(-0.9 * u, -0.34 * u, 0.8 * u, 0.05 * u); }
}
