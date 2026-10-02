// Entry point: wiring, input, and the frame loop. Simulation: sim/workers/cart/surface/construction/expansion;
// presentation: juice/site/render; UI: nav/panel/intro/music.
import './style.css';
import { CFG } from './config';
import { S, loadState, resetState, saveState } from './state';
import { materialAt } from './economy';
import { offlineAdvance, pendingFinds } from './sim';
import { initSim, landings, updateCrew, workers } from './workers';
import { cartDepth, sendCart, updateCart, type CartEvent } from './cart';
import { updateFace } from './digface';
import { miner, minerClick, minerKeyStrike, placeMiner, updateMiner } from './miner';
import { SV, present, presentCart, presentExpansion, presentLandings, presentSurface, say } from './juice';
import { updateSurface, type SurfaceEvent } from './surface';
import { updateConstruction, type BuildEvent } from './construction';
import { EXP, expanding, inputBlocked, updateExpansion, type ExpEvent } from './expansion';
import { SITE, presentBuild, updateSite } from './site';
import { FX, popup, updateFx } from './fx';
import { audioState, playSting, unlockAudio } from './audio';
import { applySettings, musicDebug, settings } from './music';
import { canvas, goSite, toLogical, toVirtual, updateCamera, view } from './view';
import { render } from './render';
import { buildPanel, isModalOpen, showModal, tickCash, updatePanel } from './panel';
import { initNav, navigate, updateNav } from './nav';
import { initIntro, introEvent, startDigging, updateIntro } from './intro';
import { fmt } from './util';

// ---- load + offline ----
const away = loadState();
const offline = offlineAdvance(away);
view.camDepth = S.depth;
view.site = S.site;
view.hideDigHint = !!offline || S.clicks >= 3;
initSim();
placeMiner();
setInterval(saveState, CFG.saveIntervalMs);
addEventListener('beforeunload', saveState);
addEventListener('pagehide', saveState);

let lastMat = materialAt(S.depth).id;
// presentation state that depends on the loaded save
SV.buildT = S.yard ? 1 : 0;
SV.contractorGone = S.yard ? 1 : 0;
if (S.flags.sold && !S.yard) say('Here. Build a Recycling Yard and press it into blocks.', true);

// ---- input ----
const inRect = (x: number, y: number, r: typeof view.cartRect) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (S.tut === 0) { startDigging(); return; }
  if (view.site !== 'mine' || view.tween) return; // the surface sites are watched, not clicked
  const r = canvas.getBoundingClientRect();
  const v = toVirtual(e.clientX - r.left, e.clientY - r.top); // world input goes through the camera zoom
  const px = v.x, py = v.y;
  if (inRect(px, py, view.cartRect) && S.tut >= 2) { // tap the cart: send it early (never required)
    if (sendCart()) popup(px, py - 20, 'Sent!', '#ffd84a', 16, { life: 0.8 });
    return;
  }
  if (view.explore < -0.5) { view.explore = 0; return; } // a click while exploring the shaft returns to the dig site
  if (inputBlocked()) return;
  const p = toLogical(px, py);
  minerClick(p.x, p.y);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (view.site !== 'mine' || view.tween) return;
  view.explore = Math.min(0, view.explore + (e.deltaY / CFG.ppm) * CFG.scrollSpeed);
  view.explore = Math.max(-S.depth - CFG.scrollAboveM, view.explore);
}, { passive: false });
addEventListener('keydown', (e) => {
  unlockAudio();
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === document.body && !isModalOpen()) {
    e.preventDefault();
    if (S.tut === 0) { startDigging(); return; }
    if (view.site === 'mine' && !inputBlocked()) minerKeyStrike();
  }
});

// ---- panel, nav, intro, settings ----
buildPanel();
initNav();
initIntro(() => updatePanel());

const setBtn = document.getElementById('setBtn') as HTMLButtonElement;
const setBox = document.getElementById('settings')!;
const volMusic = document.getElementById('volMusic') as HTMLInputElement;
const volSfx = document.getElementById('volSfx') as HTMLInputElement;
const mute = document.getElementById('mute') as HTMLInputElement;
volMusic.value = String(settings.music); volSfx.value = String(settings.sfx); mute.checked = settings.mute;
setBtn.onclick = () => { unlockAudio(); setBox.hidden = !setBox.hidden; setBtn.setAttribute('aria-expanded', String(!setBox.hidden)); };
volMusic.oninput = () => { settings.music = +volMusic.value; applySettings(); };
volSfx.oninput = () => { settings.sfx = +volSfx.value; applySettings(); };
mute.onchange = () => { settings.mute = mute.checked; applySettings(); };

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
  saveState();
  resetState();
  try { localStorage.removeItem(CFG.saveKey); } catch { /* ignore */ }
  location.reload(); // a clean boot replays the introduction with fresh presentation state
};

if (offline) {
  const h = Math.floor(offline.secs / 3600), m = Math.floor((offline.secs % 3600) / 60);
  showModal(
    `<p>While you were away for ${h ? h + 'h ' : ''}${h || m ? m + 'm' : Math.round(offline.secs) + 's'}</p><div class="big">Your crew dug ${fmt(offline.dm)} m</div>` +
    `<p>${fmt(offline.dug)} rubble dug, ${fmt(offline.delivered)} blocks delivered to the site</p>`,
    'Get back to work',
  );
}

// ---- loop ----
const cartEvents: CartEvent[] = [];
const surfEvents: SurfaceEvent[] = [];
const buildEvents: BuildEvent[] = [];
const expEvents: ExpEvent[] = [];
let last = performance.now(), panelT = 0, devSpeed = 1;
function frame(now: number) {
  const realDt = Math.min(CFG.maxDt, (now - last) / 1000) * devSpeed;
  last = now;
  // crit hit-stop: the whole world freezes for a beat, rendering continues
  let dt = realDt;
  if (FX.freeze > 0) { const f = Math.min(FX.freeze, dt); FX.freeze -= f; dt -= f; }

  for (const r of updateMiner(dt)) { present(r); if (r.broke) introEvent('break'); }
  for (const r of updateCrew(dt, expanding())) present(r);
  expEvents.length = 0;
  updateExpansion(dt, expEvents);
  presentExpansion(expEvents);
  if (S.tut >= 2) {
    cartEvents.length = 0;
    updateCart(dt, cartEvents);
    presentCart(cartEvents, dt);
  }
  surfEvents.length = 0;
  updateSurface(dt, surfEvents);
  presentSurface(surfEvents, dt);
  for (const e of surfEvents) if (e.type === 'pressed') introEvent('pressed');
  buildEvents.length = 0;
  updateConstruction(dt, buildEvents);
  presentBuild(buildEvents);
  updateSite(dt);
  presentLandings();
  updateFace(dt, CFG.cameraFollow);
  updateCamera(dt);
  updateFx(dt);
  updateIntro(realDt);

  const mat = materialAt(S.depth);
  if (mat.id !== lastMat) {
    lastMat = mat.id;
    FX.banner = { s: mat.name.toUpperCase() + ' · ' + mat.from + ' m', sub: 'Harder to break — new material colours your blocks', t: 0 };
  }
  if (pendingFinds.length && !FX.banner) { // finds are a non-blocking banner until discoveries are rebuilt (V2-2)
    const p = pendingFinds.shift()!;
    FX.banner = { s: 'FOUND: ' + p.f.name.toUpperCase(), sub: `at ${fmt(p.f.d)} m · all digging ${Math.round(CFG.findMultBonus * 100)}% faster`, t: 0 };
    playSting();
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
    state: () => JSON.parse(JSON.stringify({ ...S, parts: FX.parts.length, audio: audioState(), music: musicDebug(), site: view.site, cam: { t: view.t, z: view.zoom, p: view.panX, s: view.scrollOff, tw: !!view.tween, vx0: view.vx0, vx1: view.vx1, vy0: view.vy0, vy1: view.vy1, depth: view.camDepth }, exp: EXP.phase, workers: workers.map((w) => ({ id: w.id, state: w.state, x: Math.round(w.x), y: Math.round(w.y), fatigue: Math.round(w.fatigue) })), sold: !!SITE.sold })),
    setCritChance: (v: number) => { CFG.critChance = v; },
    scrollTo: (m: number) => { view.explore = Math.min(0, m - view.camDepth); },
    save: () => saveState(),
    cartDepth: () => cartDepth(),
    go: (s: 'mine' | 'yard' | 'build') => navigate(s),
    glide: (to: 'surface' | 'dig') => goSite(to === 'surface' ? 'yard' : 'mine'),
    setPhase: (p: number) => { view.t = (((p - CFG.daynight.startPhase) % 1) + 1) % 1 * CFG.daynight.cycleSecs; },
    tireAll: () => { for (const w of workers) w.fatigue = 0; },
    setSpeed: (k: number) => { devSpeed = k; },
    forceYard: () => { S.tut = Math.max(S.tut, 3); S.flags.dispatched = true; navigate('yard'); },
    miner: () => ({ x: miner.x, standX: miner.standX }),
    landings: () => landings.length,
  };
}
