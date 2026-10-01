import './style.css';
import { CFG, TOOLS } from './config';
import {
  S, checkFinds, clickVal, crewTick, hardAt, incomePerSec, layerAt, load, mult,
  pendingFinds, resetState, save, valAt,
} from './state';
import { V, addText, burst, canvas, faceY, render, updateFx } from './view';
import { buildPanel, isModalOpen, showModal, updatePanel } from './panel';
import { fmt, money, rgb, rnd } from './util';

// ---- load + offline ----
const offline = load();
V.hideDigHint = !!offline;
setInterval(save, CFG.saveIntervalMs);
addEventListener('beforeunload', save);

let lastLayer = layerAt(S.depth).name;

// ---- input ----
function dig(px: number, py: number) {
  const n = V.nugget, N = CFG.nugget;
  if (n && Math.hypot(px - n.x, py - n.y) < N.hitRadius) {
    const b = Math.max(N.bonus.min, incomePerSec() * N.bonus.incomeSecs, clickVal() * N.bonus.clicks);
    S.cash += b;
    burst(n.x, n.y, '#ffd84a', CFG.burst.nugget.n, CFG.burst.nugget.speed);
    addText(n.x, n.y - 20, 'Gold nugget +' + money(b), '#ffd84a', true);
    V.nugget = null;
    V.nuggetT = rnd(N.respawnMin, N.respawnMax);
    return;
  }
  const L = layerAt(S.depth);
  const m = (TOOLS[S.tool].pow * mult()) / hardAt(S.depth);
  let gain = m * valAt(S.depth);
  const lucky = Math.random() < CFG.luckyChance;
  if (lucky) gain *= CFG.luckyMult;
  S.depth += m;
  S.cash += gain;
  S.clicks++;
  V.swing = 1;
  V.shake = Math.max(V.shake, lucky ? CFG.shake.lucky : CFG.shake.normal);
  const cx = V.W / 2, fy = faceY() - V.scrollOff * CFG.ppm;
  const B = CFG.burst;
  burst(cx + rnd(-30, 30), fy, rgb(L.col, 1.25), lucky ? B.lucky.n : B.dig.n, lucky ? B.lucky.speed : B.dig.speed);
  if (lucky) burst(cx, fy, L.ore, B.luckyOre.n, B.luckyOre.speed);
  addText(cx + rnd(-110, 110), fy - 30 - rnd(0, 40), (lucky ? 'Lucky strike +' : '+') + money(gain), lucky ? L.ore : '#f1ede4', lucky);
  V.scrollOff = 0;
  checkFinds(false);
}

canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  dig(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  V.scrollOff = Math.min(0, V.scrollOff + (e.deltaY / CFG.ppm) * CFG.scrollSpeed);
  V.scrollOff = Math.max(-S.depth - CFG.scrollExtraM, V.scrollOff);
  V.scrollIdle = CFG.scrollIdleSecs;
}, { passive: false });
addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === document.body) {
    e.preventDefault();
    dig(V.W / 2, faceY());
  }
});

// ---- panel ----
buildPanel();
document.getElementById('reset')!.onclick = () => {
  if (confirm('Start over from the surface? This erases your progress.')) {
    resetState();
    save();
    lastLayer = layerAt(0).name;
    V.parts.length = 0;
    V.texts.length = 0;
  }
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
  const dt = Math.min(CFG.maxDt, (now - last) / 1000);
  last = now;

  crewTick(dt);
  checkFinds(false);

  const L = layerAt(S.depth);
  if (L.name !== lastLayer) {
    lastLayer = L.name;
    V.banner = { s: L.name, sub: 'Rock gets harder, but every meter pays more', t: 0 };
  }

  if (pendingFinds.length && !isModalOpen()) {
    const p = pendingFinds.shift()!;
    showModal(
      `<p>You hit something at ${fmt(p.f.d)} m</p><div class="big">${p.f.name}</div><p>Sold for ${money(p.bonus)}. All digging is now ${Math.round(CFG.findMultBonus * 100)}% faster.</p>`,
      'Keep digging',
    );
    burst(V.W / 2, faceY(), '#ffcf3a', CFG.burst.find.n, CFG.burst.find.speed);
  }

  const N = CFG.nugget;
  V.nuggetT -= dt;
  if (!V.nugget && V.nuggetT <= 0 && S.clicks > N.minClicks) {
    V.nugget = { ox: rnd(-N.offsetX, N.offsetX), oy: rnd(N.offsetYMin, N.offsetYMax), x: 0, y: 0, life: N.life };
  }
  if (V.nugget) {
    V.nugget.life -= dt;
    if (V.nugget.life <= 0) { V.nugget = null; V.nuggetT = rnd(N.respawnMin, N.respawnMax); }
  }

  updateFx(dt);
  render();

  panelT -= dt;
  if (panelT <= 0) { updatePanel(); panelT = CFG.panelRefreshSecs; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
