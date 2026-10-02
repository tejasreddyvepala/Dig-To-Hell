// Entry point: wiring, input, and the frame loop. Game logic lives in sim/cart/digface/miner; presentation in juice/render.
import './style.css';
import { CFG } from './config';
import { S, loadState, resetState, saveState } from './state';
import { materialAt } from './economy';
import { initSim, offlineAdvance, pendingFinds, updateCrew, workers } from './sim';
import { cartDepth, sendCart, updateCart, type CartEvent } from './cart';
import { updateFace } from './digface';
import { miner, minerClick, minerKeyStrike, updateMiner } from './miner';
import { SV, present, presentCart, presentLandings, presentSurface, say } from './juice';
import { updateSurface, type SurfaceEvent } from './surface';
import { FX, clearFx, popup, updateFx } from './fx';
import { audioState, unlockAudio } from './audio';
import { canvas, toLogical, toVirtual, updateCamera, view } from './view';
import { render } from './render';
import { buildPanel, isModalOpen, showModal, tickCash, updatePanel } from './panel';
import { fmt, money } from './util';

// ---- load + offline ----
const away = loadState();
const offline = offlineAdvance(away);
view.camDepth = S.depth;
view.hideDigHint = !!offline || S.clicks >= 3;
initSim();
setInterval(saveState, CFG.saveIntervalMs);
addEventListener('beforeunload', saveState);
addEventListener('pagehide', saveState);

let lastMat = materialAt(S.depth).id;
// presentation state that depends on the loaded save
SV.buildT = S.yard ? 1 : 0;
SV.contractorGone = S.yard ? 1 : 0;
if (S.flags.sold && !S.yard) say("I can't haul this forever. Build a recycling yard.", true);

// ---- input ----
const inRect = (x: number, y: number, r: typeof view.cartRect) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const r = canvas.getBoundingClientRect();
  const v = toVirtual(e.clientX - r.left, e.clientY - r.top); // world input goes through the camera zoom
  const px = v.x, py = v.y;
  if (inRect(px, py, view.cartRect)) { // tap the cart: send it early (never required)
    if (sendCart()) popup(px, py - 20, 'Sent!', '#ffd84a', 16, { life: 0.8 });
    return;
  }
  if (view.scrollOff < -0.5) { view.glide = 'dig'; return; } // a click while exploring the shaft returns to the dig site
  const p = toLogical(px, py);
  minerClick(p.x, p.y);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.glide = null;
  view.scrollOff = Math.min(0, view.scrollOff + (e.deltaY / CFG.ppm) * CFG.scrollSpeed);
  view.scrollOff = Math.max(-S.depth - CFG.scrollAboveM, view.scrollOff);
}, { passive: false });
addEventListener('keydown', (e) => {
  unlockAudio();
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === document.body && !isModalOpen()) {
    e.preventDefault();
    minerKeyStrike();
  }
});

// ---- minimal navigation prompt (full Surface / Dig Site navigation is Phase 3D) ----
const navBtn = document.getElementById('navBtn') as HTMLButtonElement;
navBtn.onclick = () => { unlockAudio(); view.glide = navBtn.dataset.to as 'surface' | 'dig'; };
function updateNav() {
  const away = view.scrollOff < -3;
  const cartUp = ['TRAVELLING_UP', 'SURFACE_ARRIVAL', 'UNLOADING'].includes(S.cart.state);
  let label = '', to = '';
  if (away) { label = '▼ Back to the dig site'; to = 'dig'; }
  else if (cartUp && !S.flags.sold) { label = '▲ Follow the cart to the surface'; to = 'surface'; }
  else if (S.flags.sold && !S.yard) { label = '▲ Surface: the contractor is waiting'; to = 'surface'; }
  navBtn.hidden = !label || !!view.glide;
  if (navBtn.textContent !== label) navBtn.textContent = label;
  navBtn.dataset.to = to;
}

// ---- panel ----
buildPanel();
// two-step in-page confirmation (browser confirm() dialogs are blocked in some embeds)
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
let resetArmed = 0;
resetBtn.onclick = () => {
  if (Date.now() - resetArmed > 4000) {
    resetArmed = Date.now();
    resetBtn.textContent = 'Click again to erase all progress';
    setTimeout(() => { if (Date.now() - resetArmed >= 4000) resetBtn.textContent = 'Start over'; }, 4100);
    return;
  }
  resetArmed = 0;
  resetBtn.textContent = 'Start over';
  resetState();
  workers.length = 0;
  pendingFinds.length = 0;
  miner.pending.length = 0;
  clearFx();
  view.camDepth = 0;
  view.scrollOff = 0;
  SV.buildT = 0; SV.contractorGone = 0; SV.speech = null;
  lastMat = materialAt(0).id;
  initSim();
  saveState();
};

if (offline) {
  const h = Math.floor(offline.secs / 3600), m = Math.floor((offline.secs % 3600) / 60);
  showModal(
    `<p>While you were away for ${h ? h + 'h ' : ''}${m}m</p><div class="big">Your crew dug ${fmt(offline.dm)} m</div>` +
    `<p>${fmt(offline.dug)} rubble dug, ${fmt(offline.delivered)} hauled up, ${money(offline.earned)} earned from deliveries</p>`,
    'Get back to digging',
  );
}

// ---- loop ----
const cartEvents: CartEvent[] = [];
const surfEvents: SurfaceEvent[] = [];
let last = performance.now(), panelT = 0;
function frame(now: number) {
  const realDt = Math.min(CFG.maxDt, (now - last) / 1000);
  last = now;
  // crit hit-stop: the whole world freezes for a beat, rendering continues
  let dt = realDt;
  if (FX.freeze > 0) { const f = Math.min(FX.freeze, dt); FX.freeze -= f; dt -= f; }

  for (const r of updateMiner(dt)) present(r);
  for (const r of updateCrew(dt)) present(r);
  cartEvents.length = 0;
  updateCart(dt, cartEvents);
  presentCart(cartEvents, dt);
  surfEvents.length = 0;
  updateSurface(dt, surfEvents);
  presentSurface(surfEvents, dt);
  presentLandings();
  updateFace(dt, CFG.cameraFollow);
  updateCamera(dt);
  updateFx(dt);

  const mat = materialAt(S.depth);
  if (mat.id !== lastMat) {
    lastMat = mat.id;
    FX.banner = { s: mat.name.toUpperCase() + ' · ' + mat.from + ' m', sub: 'Harder to break, but deeper material is worth more', t: 0 };
  }
  if (pendingFinds.length && !isModalOpen()) {
    const p = pendingFinds.shift()!;
    showModal(
      `<p>You hit something at ${fmt(p.f.d)} m</p><div class="big">${p.f.name}</div><p>All digging is now ${Math.round(CFG.findMultBonus * 100)}% faster.</p>`,
      'Keep digging',
    );
  }

  render();
  tickCash(realDt);
  panelT -= realDt;
  if (panelT <= 0) { updatePanel(); updateNav(); panelT = CFG.panelRefreshSecs; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// dev-only hooks for automated smoke tests (stripped from production builds)
if (import.meta.env.DEV) {
  (window as any).__dig = {
    state: () => JSON.parse(JSON.stringify({ ...S, parts: FX.parts.length, audio: audioState() })),
    setCritChance: (v: number) => { CFG.critChance = v; },
    scrollTo: (m: number) => { view.glide = null; view.scrollOff = Math.min(0, m - view.camDepth); },
    save: () => saveState(),
    cartDepth: () => cartDepth(),
    glide: (to: 'surface' | 'dig') => { view.glide = to; },
    setPhase: (p: number) => { view.t = (((p - CFG.daynight.startPhase) % 1) + 1) % 1 * CFG.daynight.cycleSecs; },
  };
}
