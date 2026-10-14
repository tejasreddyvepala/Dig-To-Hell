// Entry point: wiring, input, and the frame loop. Simulation: sim/workers/cart/surface/construction/expansion;
// presentation: juice/site/render; UI: nav/panel/intro/music.
import './compat';
// fonts are bundled with the game (OFL; no third-party requests): latin subsets only
import '@fontsource/bungee/latin-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import './style.css';
import { CFG, MAX_DEPTH } from './config';
import { S, loadIssue, loadState, resetState, saveState } from './state';
import { materialAt } from './economy';
import { offlineAdvance, pendingFinds } from './sim';
import { initSim, ladderDemo, landings, syncWorkers, updateCrew, workers } from './workers';
import { cartDepth, sendCart, updateCart, type CartEvent } from './cart';
import { updateFace } from './digface';
import { miner, minerClick, minerKeyStrike, placeMiner, updateMiner } from './miner';
import { SV, present, presentCart, presentExpansion, presentLandings, presentSurface, say } from './juice';
import { updateSurface, type SurfaceEvent } from './surface';
import { updateConstruction, type BuildEvent } from './construction';
import { EXP, expanding, inputBlocked, updateExpansion, type ExpEvent } from './expansion';
import { trackBusy, updateTrackUpgrade, type TrackUpEvent } from './track';
import { updateTrackFx } from './trackfx';
import { SITE, presentBuild, updateSite } from './site';
import { FX, popup, updateFx } from './fx';
import { audioState, playSting, unlockAudio } from './audio';
import { applySettings, hushMusic, musicDebug, settings } from './music';
import { canvas, faceOrigin, faceScale, goSite, toLogical, toVirtual, updateCamera, view, yOf } from './view';
import { render, renderSplit, resetDigRate } from './render';
import { updateSiteHud } from './sitehud';
import { setToastQuiet } from './toast';
import { FIN, finaleRunning, maybeStartFromStrike, resumeFinished, startFinale, updateFinale } from './finale';
import { initDevMenu } from './devmenu';
import { start as startTour, updateTour } from './tour';
import { updateEconomy } from './econpage';
import { checkAchievements, initAchievements } from './achievements';
import { buildPanel, isModalOpen, showModal, tickCash, updatePanel } from './panel';
import { initNav, navigate, updateNav } from './nav';
import { initTopBar } from './topbar';
import { updateSaleCall } from './salecall';
import { checkMilestones, initAnalytics, resetMilestones } from './analytics';
import { initIntro, introEvent, startDigging, updateIntro } from './intro';
import { fmt } from './util';
import { gameplayStart, gameplayStop, loadingDone, loadingStart, pauseForAd, resumeAfterAd, setPortal, simPaused } from './platform';
import { holdAudio } from './audio';

// ---- load + offline ----
loadingStart();
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
let wasAtHell = S.depth >= MAX_DEPTH;
// presentation state that depends on the loaded save
SV.buildT = S.yard ? 1 : 0;
SV.contractorGone = S.yard ? 1 : 0;
if (S.flags.sold && !S.yard) say('Here. Build a Recycling Yard and press it into blocks.', true);

// ---- input ----
const TOUCH = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const HIT_PAD = TOUCH ? 10 : 0; // fingers: a slightly larger tap area around the cart (it's ~40 px on a landscape phone)
const inRect = (x: number, y: number, r: typeof view.cartRect) => !!r && x >= r.x - HIT_PAD && x <= r.x + r.w + HIT_PAD && y >= r.y - HIT_PAD && y <= r.y + r.h + HIT_PAD;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (S.tut === 0) startDigging(); // the first tap on the rock starts the game AND lands a strike
  if (view.site !== 'mine' || view.tween) return; // the surface sites are watched, not clicked
  const r = canvas.getBoundingClientRect();
  const v = toVirtual(e.clientX - r.left, e.clientY - r.top); // world input goes through the camera zoom
  const px = v.x, py = v.y;
  if (inRect(px, py, view.cartRect) && S.tut >= 2) { // tap the cart: send it early (never required)
    if (sendCart()) popup(px, py - 20, 'Sent!', '#ffd84a', 16, { life: 0.8 });
    return;
  }
  if (finaleRunning() || S.flags.finished) return;
  if (view.explore < -0.5) { view.explore = 0; return; } // a click while exploring the shaft returns to the dig site
  if (inputBlocked()) return;
  maybeStartFromStrike(); // a save already at 1,000 m: digging into Hell sets off the finale
  const p = toLogical(px, py);
  minerClick(p.x, p.y);
});
document.getElementById('app')!.addEventListener('contextmenu', (e) => e.preventDefault()); // no browser menu over the game (portal QA)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (view.site !== 'mine' || view.tween) return;
  view.explore = Math.min(0, view.explore + (e.deltaY / CFG.ppm) * CFG.scrollSpeed);
  view.explore = Math.max(-S.depth - CFG.scrollAboveM, view.explore);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (booting) return;
  unlockAudio();
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === document.body && !isModalOpen()) {
    e.preventDefault();
    if (S.tut === 0) startDigging();
    if (view.site === 'mine' && !inputBlocked()) minerKeyStrike();
  }
});

// ---- panel, nav, intro, settings ----
buildPanel();
initNav();
initIntro(() => { updatePanel(); if (view.site === 'mine' && !inputBlocked()) minerKeyStrike(); }); // START also swings the pick
initAchievements();
initAnalytics();
setToastQuiet(finaleRunning);
resumeFinished();
if (S.depth >= MAX_DEPTH && !S.flags.finished) setTimeout(startFinale, 2500); // at the bottom but the ending hasn't run (reloaded mid-ending, dev replay): run it
initDevMenu({ setSpeed: (k) => { devSpeed = k; }, setPhase: (p) => { view.t = (((p - CFG.daynight.startPhase) % 1) + 1) % 1 * CFG.daynight.cycleSecs; } });

initTopBar();
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
// fullscreen: only offered where the page (or the portal's iframe) allows it; portals often add their own button
const fsBtn = document.getElementById('fsBtn') as HTMLButtonElement;
fsBtn.hidden = !document.fullscreenEnabled;
const fsLabel = () => { fsBtn.textContent = document.fullscreenElement ? '⛶ Exit fullscreen' : '⛶ Fullscreen'; };
fsBtn.onclick = () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined); };
document.addEventListener('fullscreenchange', fsLabel);

// two-step in-page confirmation (browser confirm() dialogs are blocked in some embeds)
(document.getElementById('helpBtn') as HTMLButtonElement).onclick = () => showModal(
  `<div class="big">HOW TO DIG TO HELL</div>
  <p><b>⛏ MINE</b> · click the rock. Rubble piles up; the cart hauls it to the surface. Hire diggers, expand the worksite, bring in machines.</p>
  <p><b>♻ YARD</b> · rubble is crushed and pressed into building blocks. Deeper rock (silver, gold, rubies, diamonds…) makes far more valuable blocks.</p>
  <p><b>🏗 BUILD</b> · the truck brings blocks to the plot; every finished stage pays, and the sale pays the most. Then build something bigger.</p>
  <p>A red <b>!</b> means something is blocked right now. The goal: reach the Gates of Hell at <b>1,000 m</b>.</p>
  <p><button id="helpTour" class="helptour">▶ Take the guided tour</button></p>`, 'GOT IT');
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).id === 'helpTour') { document.getElementById('modal')?.classList.remove('show'); startTour(); } });

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
  resetMilestones();
  try { localStorage.removeItem(CFG.saveKey); localStorage.removeItem(CFG.saveKey + '_prev'); } catch { /* ignore */ }
  location.reload(); // a clean boot replays the introduction with fresh presentation state
};

function awayReport(offline: NonNullable<ReturnType<typeof offlineAdvance>>) {
  const h = Math.floor(offline.secs / 3600), m = Math.floor((offline.secs % 3600) / 60);
  showModal(
    `<p>While you were away for ${h ? h + 'h ' : ''}${h || m ? m + 'm' : Math.round(offline.secs) + 's'}</p><div class="big">Your crew dug ${fmt(offline.dm)} m</div>` +
    `<p>${fmt(offline.dug)} rubble dug, ${fmt(offline.delivered)} blocks delivered to the site</p>`,
    'Get back to work',
  );
}
if (offline) awayReport(offline);
if (loadIssue) showModal(loadIssue.kind === 'restored'
  ? `<div class="big">SAVE RESTORED</div><p>Your latest save couldn't be read, so we loaded the copy from about a minute earlier.</p><p class="small">The unreadable save was kept on this device as a backup.</p>`
  : `<div class="big">SAVE COULDN'T BE READ</div><p>Your save may come from a newer version of the game, or it was damaged, so a new mine has started.</p><p class="small">The old save was kept on this device as a backup and is not deleted.</p>`, 'OK');

// ---- background tabs: the mine keeps working while the player is in another tab ----
// Browsers stop requestAnimationFrame in hidden tabs, so on return the hidden time is simulated with the same
// (capped) offline model used for closed sessions. Audio is silenced while hidden.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    saveState();
    holdAudio('hidden', true);
    gameplayStop();
    return;
  }
  holdAudio('hidden', false);
  if (S.tut > 0 && !finaleRunning() && !S.flags.finished) gameplayStart();
  const secs = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0;
  hiddenAt = 0;
  if (secs < 2 || finaleRunning() || S.flags.finished || simPaused()) return;
  const d0 = S.depth, mat0 = materialAt(S.depth).id;
  const rep = offlineAdvance(secs, true);
  if (S.depth !== d0) { // the floor moved: rebuild the face at the new depth and bring the camera with it
    if (materialAt(S.depth).id !== mat0 || S.depth - d0 > 1) initSim();
    view.camDepth = S.depth;
  }
  resetDigRate();
  if (rep && secs >= 60) awayReport(rep);
  saveState();
});

// ---- loop ----
const cartEvents: CartEvent[] = [];
const surfEvents: SurfaceEvent[] = [];
const buildEvents: BuildEvent[] = [];
const expEvents: ExpEvent[] = [];
const trackEvents: TrackUpEvent[] = [];
let last = performance.now(), panelT = 0, devSpeed = 1;
const devSpeedNow = () => devSpeed;
const longFrames: { at: number; ms: number; depth: number; site: string; work?: string }[] = []; // dev-only stall log (soak tests): gaps between frames + slow frames split by section
let lastWork = '', lastHeap = 0;
const heapMB = () => Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1e6);
function frame(now: number) {
  if (import.meta.env.DEV && now - last > 150 && !document.hidden && longFrames.length < 500) longFrames.push({ at: Math.round(now / 1000), ms: Math.round(now - last), depth: Math.round(S.depth), site: view.site, work: lastWork + ` heap ${lastHeap}→${heapMB()}` });
  const w0 = import.meta.env.DEV ? performance.now() : 0;
  const realDt = simPaused() || booting ? 0 : Math.min(CFG.maxDt, (now - last) / 1000) * devSpeed;
  last = now;
  // crit hit-stop: the whole world freezes for a beat, rendering continues
  let dt = realDt;
  if (FX.freeze > 0) { const f = Math.min(FX.freeze, dt); FX.freeze -= f; dt -= f; }

  // once the Gates of Hell open, the lava has the mine: crew, cart, yard and construction stop (no more strikes,
  // rail clacks or hammering under the flood and behind the end card)
  const worldStopped = finaleRunning() || S.flags.finished === true;
  if (worldStopped) hushMusic(true);
  if (!worldStopped) {
    for (const r of updateMiner(dt)) { present(r); if (r.broke) introEvent('break'); }
    for (const r of updateCrew(dt, expanding())) present(r);
    expEvents.length = 0;
    updateExpansion(dt, expEvents);
    presentExpansion(expEvents);
    trackEvents.length = 0;
    updateTrackUpgrade(dt, trackEvents);
    cartEvents.length = 0;
    if (S.tut >= 2 && !trackBusy()) { // the cart waits while the crew reinforces the track
      updateCart(dt, cartEvents);
      presentCart(cartEvents, dt);
    }
    updateTrackFx(dt, cartEvents, trackEvents);
    surfEvents.length = 0;
    updateSurface(dt, surfEvents);
    presentSurface(surfEvents, dt);
    for (const e of surfEvents) if (e.type === 'pressed') introEvent('pressed');
    buildEvents.length = 0;
    updateConstruction(dt, buildEvents);
    presentBuild(buildEvents);
    for (const e of buildEvents) if (e.type === 'stageStart') introEvent('stageStart');
    updateSite(dt);
    presentLandings();
    updateFace(dt, CFG.cameraFollow);
  }
  updateCamera(dt);
  updateFx(dt, realDt / devSpeedNow());
  updateIntro(realDt);

  const mat = materialAt(S.depth);
  if (mat.id !== lastMat) {
    lastMat = mat.id;
    FX.banner = { s: mat.name.toUpperCase() + ' · ' + mat.from + ' m', sub: mat.desc, t: 0 };
  }
  if (!wasAtHell && S.depth >= MAX_DEPTH) { // THE END OF THE DIG: the Gates of Hell
    wasAtHell = true;
    FX.banner = { s: 'THE GATES OF HELL', sub: '1,000 m · the doors swing open…', t: 0 };
    playSting();
    setTimeout(startFinale, 2600); // then the ground erupts (finale.ts)
  }
  if (pendingFinds.length && !FX.banner) { // finds are a non-blocking banner until discoveries are rebuilt (V2-2)
    const p = pendingFinds.shift()!;
    FX.banner = { s: 'FOUND: ' + p.f.name.toUpperCase(), sub: `${p.f.note ? p.f.note + ' · ' : ''}all digging ${Math.round(CFG.findMultBonus * 100)}% faster`, t: 0 };
    playSting();
  }

  updateFinale(realDt / devSpeedNow());
  if (!finaleRunning() && S.flags.finished !== true) S.stats.playSecs = (S.stats.playSecs ?? 0) + realDt;
  const w1 = import.meta.env.DEV ? performance.now() : 0;
  render();
  const w2 = import.meta.env.DEV ? performance.now() : 0;
  tickCash(realDt);
  panelT -= realDt;
  if (panelT <= 0) { updatePanel(); updateNav(); checkAchievements(); updateTour(); updateSiteHud(); updateEconomy(performance.now()); checkMilestones(); updateSaleCall(); panelT = CFG.panelRefreshSecs; }
  if (import.meta.env.DEV) { const w3 = performance.now(); lastHeap = heapMB(); lastWork = `sim ${Math.round(w1 - w0)} render ${Math.round(w2 - w1)} [${renderSplit}] panel ${Math.round(w3 - w2)}`; }
  if (!manualClock) requestAnimationFrame(frame);
}
let manualClock = false, manualNow = 0; // dev-only: frame-stepped capture (trailer recording)
let booting = true; // the loading screen is up: nothing moves underneath it
requestAnimationFrame(frame);
// the loading screen (key art) lifts as soon as the game is ready: the canvas fonts are loaded (so the first frame
// doesn't flash fallback text) and a frame has been drawn. BOOT_MIN_MS stops a flash of the art on fast loads;
// BOOT_MAX_MS stops a slow font fetch from holding the player back. The world is frozen until it lifts.
const BOOT_MIN_MS = 400, BOOT_MAX_MS = 1200;
function liftBoot() {
  if (!booting) return;
  booting = false; last = performance.now();
  const boot = document.getElementById('boot'); if (boot) { boot.classList.add('out'); setTimeout(() => boot.remove(), 550); }
  loadingDone();
  if (S.tut > 0 && !S.flags.finished) gameplayStart();
}
const fontsReady = (() => {
  try { return Promise.all(['400 20px Bungee', '400 14px Rubik', '500 14px Rubik', '700 14px Rubik'].map((f) => document.fonts.load(f))); } catch { return Promise.resolve(); }
})();
Promise.race([fontsReady.catch(() => undefined), new Promise((r) => setTimeout(r, Math.max(0, BOOT_MAX_MS - performance.now())))])
  .then(() => requestAnimationFrame(() => setTimeout(liftBoot, Math.max(0, BOOT_MIN_MS - performance.now()))));
(document.getElementById('ver') as HTMLElement).textContent = `v${__VERSION__}`;

// dev-only hooks for automated smoke tests (stripped from production builds)
if (import.meta.env.DEV) {
  (window as any).__dig = {
    state: () => JSON.parse(JSON.stringify({ ...S, parts: FX.parts.length, audio: audioState(), music: musicDebug(), site: view.site, cam: { t: view.t, z: view.zoom, p: view.panX, s: view.scrollOff, tw: !!view.tween, vx0: view.vx0, vx1: view.vx1, vy0: view.vy0, vy1: view.vy1, depth: view.camDepth }, exp: EXP.phase, workers: workers.map((w) => ({ id: w.id, state: w.state, x: Math.round(w.x), y: Math.round(w.y), fatigue: Math.round(w.fatigue) })), sold: !!SITE.sold, fin: FIN.phase })),
    setCritChance: (v: number) => { CFG.critChance = v; },
    // video capture: stop the rAF loop and advance the game exactly `ms` per call (smooth footage at any capture speed)
    manual: (on: boolean) => { manualClock = on; manualNow = last; if (!on) { last = performance.now(); requestAnimationFrame(frame); } },
    tick: (ms: number) => { manualNow += ms; frame(manualNow); },
    ad: (on: boolean) => (on ? pauseForAd() : resumeAfterAd()),
    portalLog: () => { const log: string[] = []; setPortal({ name: 'test', loadingStart: () => log.push('loadingStart'), loadingDone: () => log.push('loadingDone'), gameplayStart: () => log.push('gameplayStart'), gameplayStop: () => log.push('gameplayStop'), happyTime: () => log.push('happyTime') }); return log; },
    scrollTo: (m: number) => { view.explore = Math.min(0, m - view.camDepth); },
    save: () => saveState(),
    cartDepth: () => cartDepth(),
    go: (s: 'mine' | 'yard' | 'build') => navigate(s),
    glide: (to: 'surface' | 'dig') => goSite(to === 'surface' ? 'yard' : 'mine'),
    setPhase: (p: number) => { view.t = (((p - CFG.daynight.startPhase) % 1) + 1) % 1 * CFG.daynight.cycleSecs; },
    tireAll: () => { for (const w of workers) w.fatigue = 0; },
    setSpeed: (k: number) => { devSpeed = k; },
    ladderDemo: () => ladderDemo(-(faceOrigin().y - yOf(0)) / faceScale()),
    // track-strain acceptance test: put a given load in the cart at the bottom and send it up
    sendLoad: (qty: number) => {
      S.cart.load.qty = qty; S.cart.load.val = qty * 2; S.cart.load.mix = { clay: qty * 0.7, dirt: qty * 0.3 };
      S.cart.state = 'READY'; S.cart.t = CFG.cart.readySecs; S.cart.dur = 0;
    },
    track: () => ({ tier: S.upg.rail, story: S.flags.trackStory, cart: S.cart.state, load: S.cart.load.qty, dur: S.cart.dur, t: S.cart.t }),
    setTruck: (state: typeof S.truck.state, k: number, qty: number) => { // visual testing: pose the truck exactly
      const T = CFG.yard.truck, dur = state === 'ARRIVING' ? T.arriveSecs : state === 'TO_SITE' || state === 'RETURNING' ? T.driveSecs : 0;
      S.truck.state = state; S.truck.dur = dur; S.truck.t = dur * k;
      S.truck.load.qty = qty; S.truck.load.val = qty * 2; S.truck.load.mix = qty ? { clay: qty * 0.6, dirt: qty * 0.4 } : {};
    },
    setCrew: (n: number) => { S.crew.dig = n; syncWorkers(); }, // perf A/B: crew size without a reload
    forceYard: () => { S.tut = Math.max(S.tut, 3); S.flags.dispatched = true; navigate('yard'); },
    miner: () => ({ x: miner.x, standX: miner.standX }),
    landings: () => landings.length,
    longFrames: () => longFrames,
    heap: () => Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1e6),
  };
}
