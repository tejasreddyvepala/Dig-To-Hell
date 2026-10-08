// Construction site (Spec §10): the plot along the road right of the yard. Blocks delivered by the truck stack on
// the left of the plot; builders carry them to the building, which visibly grows stage by stage. A finished
// property gets a SOLD sign, is cleared, and the next (bigger) project's blueprint appears.
// Drawing in surface virtual px (scale from the worker unit u); all state read from S + presentation-only SITE.
import { CFG, PROJECTS } from './config';
import { S } from './state';
import { buildUnlocked, mixPick, projectValue } from './economy';
import { rubbleRGB } from './geo';
import type { BuildEvent } from './construction';
import { drawBuilding as drawBuildingAt } from './buildings';
import { craneTarget, drawScaffold, drawSiteCrew, updateSiteCrew } from './sitecrew';
import { FX, addPart, popup } from './fx';
import { playKnock, playSold, playSting, playCoin } from './audio';
import { duckMusic } from './music';
import { nightness } from './landscape';
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
    else if (e.type === 'stagePay') { // a progress instalment: a small, quiet "+$" at the building (no toast)
      popup(bx + 1.8 * u, L.gy - 2.6 * u, '+' + money(e.cash ?? 0), '#ffe38a', 17 * Math.sqrt(faceScale() / CFG.fxScaleRef), { life: 1.6, pop: 0.2, sub: 'PROGRESS PAYMENT', rise: 0.5 });
      playCoin(0.5);
    } else if (e.type === 'stageDone') {
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
  if (!buildUnlocked(S)) { drawLockedPlot(x0, x1, gy, u); return; }
  drawTown(x0, x1, gy, u); // foreshadowing: an empty, surveyed lot
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
    if (S.build.done) drawSign(bx + (PROJECTS[S.build.project].w + 0.7) * u, gy, u, 'FOR SALE', '#f2c64a', '#2a2100');
    if (S.build.project >= 2 && !S.build.done) drawFloodlights(x0, x1, gy, u, bx);
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

}

/** The block stack sits on the plot BEHIND the road: drawn before the truck, so the truck drives in front of it. */
export function drawSiteStack() {
  if (!siteVisible() || !buildUnlocked(S)) return;
  const L = surfaceLayout();
  drawStack(L.plotX0 + 1.0 * L.u, L.gy, L.u);
}

/** The plot's working layer — scaffold, builders, crane and the block count — drawn AFTER the delivery truck, so a
 *  parked/unloading truck never hides the people building the house or the "N blocks on site" count. */
export function drawSiteFront() {
  if (!siteVisible() || !buildUnlocked(S)) return;
  const L = surfaceLayout(), u = L.u, gy = L.gy, x0 = L.plotX0, bx = x0 + 2.6 * u;
  drawScaffold(bx, gy, u);
  drawSiteCrew(bx, gy, u, rgb(blockCol(), 1));
  if (!SITE.sold && !S.build.done && S.build.project >= CRANE_FROM) drawCrane(bx, gy, u); // the crane comes down when the building is finished
  drawStackLabel(x0 + 1.0 * u, u);
  if (S.build.done && !SITE.sold) drawSellArrow(bx, gy, u);
}

/** A finished property waiting for its sale: a gold arrow bobs over the roof ("READY TO SELL") so the eye goes there. */
function drawSellArrow(bx: number, gy: number, u: number) {
  const pr = PROJECTS[S.build.project], t = view.t;
  const cx = bx + (pr.w * u) / 2, bob = Math.sin(t * 4) * 0.12 * u, tip = gy - (pr.h + 0.35) * u + bob;
  const a = 0.55 * u, glow = 0.5 + 0.5 * Math.sin(t * 3.2);
  ctx.save();
  ctx.shadowColor = `rgba(255,205,60,${(0.55 + 0.4 * glow).toFixed(2)})`; ctx.shadowBlur = 18 + 14 * glow;
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#5a3a02'; ctx.lineWidth = Math.max(2, u * 0.05); ctx.lineJoin = 'round';
  ctx.beginPath(); // a chunky down arrow
  ctx.moveTo(cx, tip); ctx.lineTo(cx - a, tip - a); ctx.lineTo(cx - a * 0.42, tip - a); ctx.lineTo(cx - a * 0.42, tip - a * 1.9);
  ctx.lineTo(cx + a * 0.42, tip - a * 1.9); ctx.lineTo(cx + a * 0.42, tip - a); ctx.lineTo(cx + a, tip - a); ctx.closePath();
  ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
  ctx.font = `${Math.round(u * 0.24)}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(3, u * 0.08);
  ctx.strokeStyle = 'rgba(40,24,0,.9)'; ctx.strokeText('READY TO SELL', cx, tip - a * 2.15);
  ctx.fillStyle = '#ffe680'; ctx.fillText('READY TO SELL', cx, tip - a * 2.15);
  ctx.restore();
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
  stackTop = gy - u * 0.06 - Math.ceil(Math.max(1, n) / cols) * bh;
}
let stackTop = 0;
/** The plot's block count: one pill ("18 blocks on site"), drawn AFTER the builders so they never hide it. */
function drawStackLabel(cx: number, u: number) {
  const q = S.build.material.qty;
  if (!(q >= 1 || S.build.project > 0 || S.stats.delivered > 0)) return;
  const t = `${Math.floor(q)} blocks on site`, size = Math.round(10 + u * 0.06), y = stackTop - u * 0.14;
  ctx.font = `700 ${size}px ${FONT_UI}`; ctx.textAlign = 'center';
  const w = ctx.measureText(t).width + size;
  ctx.fillStyle = 'rgba(14,9,6,.62)'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y - size, w, size * 1.4, size * 0.7); ctx.fill();
  ctx.fillStyle = '#f3e6cf'; ctx.fillText(t, cx, y);
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

// ---------- buildings (generic renderer in buildings.ts) ----------
/** Draw a project at per-stage progress `p` with its left-bottom corner at (bx, gy). `blueprint` = outline only. */
function drawBuilding(project: number, bx: number, gy: number, u: number, p: number[], blueprint: boolean) {
  ctx.save(); ctx.translate(bx, gy);
  drawBuildingAt(project, u, p, blueprint, view.t);
  ctx.restore();
  if (blueprint) {
    ctx.font = `600 ${Math.round(9 + u * 0.06)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(160,210,255,.9)';
    ctx.fillText('BLUEPRINT', bx + (PROJECTS[project].w / 2) * u, gy - 0.35 * u);
  }
}

// ---------- site drama: the town you have built, the tower crane, night floodlights ----------
/** Every project type already sold stands in the distance (hazy, small): the town the mine has built. */
const town = { key: '', cv: null as HTMLCanvasElement | null };
function drawTown(x0: number, x1: number, gy: number, u: number) {
  const n = Math.min(S.build.project, S.stats.sold); // project types already completed and sold
  if (n <= 0) return;
  const k = 0.3, su = u * k, night = nightness() > 0.35;
  const key = `${n}|${Math.round(u)}|${night}`;
  // lay the town out: older (smaller) buildings further from the plot, alternating sides
  const items: { p: number; x: number }[] = [];
  let lx = x0 - 1.4 * u, rx = x1 + 2.6 * u; // well clear of the plot and its project board: this is the town, not the next build
  for (let i = n - 1; i >= 0; i--) {
    const w = PROJECTS[i].w * su;
    if ((n - 1 - i) % 2 === 0) { items.push({ p: i, x: rx }); rx += w + 0.9 * su; } else { lx -= w + 0.9 * su; items.push({ p: i, x: lx }); }
  }
  const minX = Math.min(...items.map((t) => t.x)), maxX = Math.max(...items.map((t) => t.x + PROJECTS[t.p].w * su)) + su;
  const H = Math.max(...items.map((t) => PROJECTS[t.p].h)) * su + 2.4 * su;
  if (town.key !== key || !town.cv) { // re-render the distant town only when it changes
    const cv = town.cv ?? document.createElement('canvas');
    const hill = 0.55 * u; cv.width = Math.ceil(maxX - minX + 2 * su); cv.height = Math.ceil(H + hill);
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height);
    // the low hill the town stands on (rounded ends so it melts into the forest line)
    c.fillStyle = '#5d7f52';
    for (const t of items) { const x0t = t.x - minX + su, wt = PROJECTS[t.p].w * su; c.beginPath(); c.ellipse(x0t + wt / 2, cv.height, wt / 2 + su * 2.2, cv.height - H + su * 0.3, 0, Math.PI, 0); c.fill(); }
    for (const t of items) { c.save(); c.translate(t.x - minX + su, H); drawBuildingAt(t.p, su, PROJECTS[t.p].stages.map(() => 1), false, 0, c); c.restore(); }
    // atmospheric haze: pull everything toward the far-hill colour (lit windows survive at night)
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = night ? 'rgba(30,40,70,.7)' : 'rgba(160,190,218,.68)'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';
    town.cv = cv; town.key = key;
  }
  ctx.drawImage(town.cv, minX - su, gy - town.cv.height); // on a low hill behind the lot
}

const CRANE_FROM = 5; // Apartment Block onward: a project too big for ladders gets a tower crane
/** Yellow lattice tower crane right of the building: its trolley ferries pallets of blocks from the stack to the
 *  current work spot (presentation only; follows the same target the builders hammer). */
function drawCrane(bx: number, gy: number, u: number) {
  const pr = PROJECTS[S.build.project], mx = bx + (pr.w + 1.35) * u, top = gy - (pr.h + 1.9) * u, jibY = top + 0.35 * u;
  const jx0 = bx - 2.2 * u, jx1 = mx + 2.3 * u, Y = '#f2b51c', YD = '#b57d0e', INK = '#2a1d12';
  const lattice = (x: number, y0: number, y1: number, w: number) => { // vertical mast section
    ctx.fillStyle = Y; ctx.fillRect(x - w / 2, y1, 3, y0 - y1); ctx.fillRect(x + w / 2 - 3, y1, 3, y0 - y1);
    ctx.strokeStyle = YD; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let y = y0; y > y1 + w * 0.5; y -= w) { ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y - w); ctx.moveTo(x - w / 2, y - w); ctx.lineTo(x + w / 2, y - w); }
    ctx.stroke();
  };
  const mw = 0.42 * u;
  ctx.fillStyle = '#7d7d7d'; ctx.fillRect(mx - mw, gy - 0.18 * u, mw * 2, 0.18 * u); // concrete footing
  lattice(mx, gy - 0.18 * u, jibY + 0.2 * u, mw);
  // jib + counter-jib (horizontal lattice), tie rods to the A-frame peak
  ctx.fillStyle = Y; ctx.fillRect(jx0, jibY, jx1 - jx0, 3); ctx.fillRect(jx0, jibY + 0.26 * u, jx1 - jx0 - 1.0 * u, 3);
  ctx.strokeStyle = YD; ctx.lineWidth = 1.3; ctx.beginPath();
  for (let x = jx0; x < jx1 - 1.0 * u - 0.26 * u; x += 0.26 * u) { ctx.moveTo(x, jibY + 0.26 * u + 2); ctx.lineTo(x + 0.26 * u, jibY + 2); }
  ctx.stroke();
  const peakY = top - 0.7 * u;
  ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(mx - mw / 2, jibY); ctx.lineTo(mx, peakY); ctx.lineTo(mx + mw / 2, jibY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,20,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, peakY); ctx.lineTo(jx0 + 0.6 * u, jibY); ctx.moveTo(mx, peakY); ctx.lineTo(jx1 - 0.2 * u, jibY); ctx.stroke();
  // counterweight + operator cab
  ctx.fillStyle = '#8d8a84'; ctx.fillRect(jx1 - 0.95 * u, jibY + 3, 0.8 * u, 0.5 * u); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(jx1 - 0.95 * u, jibY + 3, 0.8 * u, 0.5 * u);
  ctx.fillStyle = '#e8eef2'; ctx.fillRect(mx - mw * 0.9 - 0.42 * u, jibY + 3, 0.42 * u, 0.44 * u); ctx.fillStyle = '#9fd0ea'; ctx.fillRect(mx - mw * 0.9 - 0.36 * u, jibY + 0.08 * u, 0.3 * u, 0.2 * u);
  ctx.strokeStyle = INK; ctx.strokeRect(mx - mw * 0.9 - 0.42 * u, jibY + 3, 0.42 * u, 0.44 * u);
  // company banner on the counter-jib side of the mast
  ctx.fillStyle = '#1f2a33'; ctx.fillRect(mx + mw * 0.6, jibY + 0.32 * u, 1.1 * u, 0.3 * u);
  ctx.font = `${Math.round(u * 0.17)}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.fillStyle = Y; ctx.fillText('DIG CO.', mx + mw * 0.6 + 0.55 * u, jibY + 0.53 * u);
  // aircraft warning light
  if (Math.floor(view.t * 1.4) % 2 === 0) { ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(mx, peakY - 2, 3, 0, 6.283); ctx.fill(); const g = ctx.createRadialGradient(mx, peakY, 0, mx, peakY, 14); g.addColorStop(0, 'rgba(255,60,40,.5)'); g.addColorStop(1, 'rgba(255,60,40,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 14, peakY - 14, 28, 28); }
  // the lift cycle: hook down at the stack → pallet up → trolley over → lowered to the work spot → back
  const tgt = craneTarget(), stackX = bx - 1.6 * u, stackY = gy - 0.5 * u;
  let hx = mx - 1.2 * u, hy = jibY + 1.2 * u, load = false;
  if (tgt) {
    const tx = bx + tgt.x * u, ty = gy - (tgt.h + 0.35) * u, cyc = 10, k = (view.t % cyc) / cyc, e = (a: number) => a * a * (3 - 2 * a);
    const hold = jibY + 0.8 * u;
    if (k < 0.15) { hx = stackX; hy = hold + (stackY - hold) * e(k / 0.15); }
    else if (k < 0.3) { hx = stackX; hy = stackY + (hold - stackY) * e((k - 0.15) / 0.15); load = true; }
    else if (k < 0.5) { hx = stackX + (tx - stackX) * e((k - 0.3) / 0.2); hy = hold; load = true; }
    else if (k < 0.62) { hx = tx; hy = hold + (Math.min(ty, gy - 0.4 * u) - hold) * e((k - 0.5) / 0.12); load = true; }
    else if (k < 0.75) { hx = tx; hy = Math.min(ty, gy - 0.4 * u) + (hold - Math.min(ty, gy - 0.4 * u)) * e((k - 0.62) / 0.13); }
    else { hx = tx + (stackX - tx) * e((k - 0.75) / 0.25); hy = hold; }
  }
  const sway = Math.sin(view.t * 1.7) * 0.04 * u;
  ctx.fillStyle = '#3b3f45'; ctx.fillRect(hx - 0.14 * u, jibY + 2, 0.28 * u, 0.12 * u); // trolley
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx - 2, jibY + 0.12 * u); ctx.lineTo(hx - 2 + sway, hy); ctx.moveTo(hx + 2, jibY + 0.12 * u); ctx.lineTo(hx + 2 + sway, hy); ctx.stroke();
  ctx.fillStyle = '#f2b51c'; ctx.fillRect(hx - 0.08 * u + sway, hy, 0.16 * u, 0.1 * u); ctx.strokeStyle = INK; ctx.strokeRect(hx - 0.08 * u + sway, hy, 0.16 * u, 0.1 * u);
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx + sway, hy + 0.17 * u, 0.06 * u, -0.3, Math.PI + 0.3, false); ctx.stroke(); // hook
  if (load) { // a strapped pallet of the plot's blocks
    const px = hx + sway, py = hy + 0.24 * u, col = blockCol();
    ctx.strokeStyle = 'rgba(40,30,20,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, hy + 0.2 * u); ctx.lineTo(px - 0.3 * u, py + 0.06 * u); ctx.moveTo(px, hy + 0.2 * u); ctx.lineTo(px + 0.3 * u, py + 0.06 * u); ctx.stroke();
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { ctx.fillStyle = rgb(col, 0.92 + hash(i + r * 3) * 0.12); ctx.fillRect(px - 0.3 * u + i * 0.2 * u + 1, py + 0.06 * u + r * 0.13 * u, 0.2 * u - 2, 0.13 * u - 1); }
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(px - 0.32 * u, py + 0.32 * u, 0.64 * u, 0.05 * u);
  }
}

/** Two light towers at the plot corners; after dusk they throw hard white cones onto the building (work goes on). */
function drawFloodlights(x0: number, x1: number, gy: number, u: number, bx: number) {
  const pr = PROJECTS[S.build.project], hgt = Math.max(2.6, pr.h * 0.75) * u, n = nightness();
  for (const [px, dir] of [[x0 + 0.35 * u, 1], [x1 - 0.35 * u, -1]] as const) {
    ctx.fillStyle = '#5d646d'; ctx.fillRect(px - 2, gy - hgt, 4, hgt);
    ctx.fillStyle = '#3d434a'; ctx.fillRect(px - 0.3 * u, gy - hgt - 0.14 * u, 0.6 * u, 0.16 * u);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = n > 0.15 ? '#fffbe0' : '#c9d2da'; ctx.fillRect(px - 0.26 * u + i * 0.19 * u, gy - hgt - 0.11 * u, 0.14 * u, 0.1 * u); }
    if (n > 0.15) {
      const a = Math.min(1, (n - 0.15) * 2.2), tx = bx + pr.w * 0.5 * u, g = ctx.createLinearGradient(px, gy - hgt, tx, gy - pr.h * 0.4 * u);
      g.addColorStop(0, `rgba(255,250,215,${(0.42 * a).toFixed(2)})`); g.addColorStop(1, 'rgba(255,250,215,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(px, gy - hgt); ctx.lineTo(tx + dir * pr.w * 0.1 * u, gy - (pr.h + 0.3) * u); ctx.lineTo(tx - dir * pr.w * 0.55 * u, gy); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}
