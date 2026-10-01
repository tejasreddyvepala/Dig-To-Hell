// Entry point: wiring, input, and the frame loop. Game logic lives in sim/digface/miner; presentation in juice/render.
import './style.css';
import { CFG } from './config';
import { S, loadState, resetState, saveState } from './state';
import { materialAt } from './economy';
import { initSim, offlineAdvance, pendingFinds, updateCrew, workers } from './sim';
import { updateFace } from './digface';
import { miner, minerClick, minerKeyStrike, updateMiner } from './miner';
import { present } from './juice';
import { FX, clearFx, updateFx } from './fx';
import { audioState, unlockAudio } from './audio';
import { canvas, toLogical, updateCamera, view } from './view';
import { render } from './render';
import { buildPanel, isModalOpen, showModal, updatePanel } from './panel';
import { fmt, money } from './util';

// ---- load + offline ----
const away = loadState();
const offline = offlineAdvance(away);
view.camDepth = S.depth;
view.hideDigHint = !!offline;
initSim();
setInterval(saveState, CFG.saveIntervalMs);
addEventListener('beforeunload', saveState);
addEventListener('pagehide', saveState);

let lastMat = materialAt(S.depth).id;

// ---- input ----
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (view.scrollOff < 0) { view.scrollOff = 0; return; } // first click while scrolled up returns to the face
  const r = canvas.getBoundingClientRect();
  const p = toLogical(e.clientX - r.left, e.clientY - r.top);
  minerClick(p.x, p.y);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.scrollOff = Math.min(0, view.scrollOff + (e.deltaY / CFG.ppm) * CFG.scrollSpeed);
  view.scrollOff = Math.max(-S.depth - CFG.scrollExtraM, view.scrollOff);
  view.scrollIdle = CFG.scrollIdleSecs;
}, { passive: false });
addEventListener('keydown', (e) => {
  unlockAudio();
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === document.body && !isModalOpen()) {
    e.preventDefault();
    minerKeyStrike();
  }
});

// ---- panel ----
buildPanel();
document.getElementById('reset')!.onclick = () => {
  if (!confirm('Start over from the surface? This erases your progress.')) return;
  resetState();
  workers.length = 0;
  pendingFinds.length = 0;
  miner.pending.length = 0;
  clearFx();
  view.camDepth = 0;
  lastMat = materialAt(0).id;
  initSim();
  saveState();
};

if (offline) {
  const h = Math.floor(offline.secs / 3600), m = Math.floor((offline.secs % 3600) / 60);
  showModal(
    `<p>While you were away for ${h ? h + 'h ' : ''}${m}m</p><div class="big">Your crew dug ${fmt(offline.dm)} m</div><p>and earned ${money(offline.dc)}</p>`,
    'Get back to digging',
  );
}

// ---- loop ----
let last = performance.now(), panelT = 0;
function frame(now: number) {
  const realDt = Math.min(CFG.maxDt, (now - last) / 1000);
  last = now;
  // crit hit-stop: the whole world freezes for a beat, rendering continues
  let dt = realDt;
  if (FX.freeze > 0) { const f = Math.min(FX.freeze, dt); FX.freeze -= f; dt -= f; }

  for (const r of updateMiner(dt)) present(r);
  for (const r of updateCrew(dt)) present(r);
  updateFace(dt, CFG.cameraFollow);
  updateCamera(dt);
  updateFx(dt);

  const mat = materialAt(S.depth);
  if (mat.id !== lastMat) {
    lastMat = mat.id;
    FX.banner = { s: mat.name.toUpperCase() + ' · ' + mat.from + ' m', sub: 'Harder to break, but every meter pays more', t: 0 };
  }
  if (pendingFinds.length && !isModalOpen()) {
    const p = pendingFinds.shift()!;
    showModal(
      `<p>You hit something at ${fmt(p.f.d)} m</p><div class="big">${p.f.name}</div><p>Sold for ${money(p.bonus)}. All digging is now ${Math.round(CFG.findMultBonus * 100)}% faster.</p>`,
      'Keep digging',
    );
  }

  render();
  panelT -= realDt;
  if (panelT <= 0) { updatePanel(); panelT = CFG.panelRefreshSecs; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// dev-only hooks for automated smoke tests (stripped from production builds)
if (import.meta.env.DEV) {
  (window as any).__dig = {
    state: () => ({ ...S, crew: { ...S.crew }, parts: FX.parts.length, audio: audioState() }),
    setCritChance: (v: number) => { CFG.critChance = v; },
  };
}
