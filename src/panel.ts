// DOM side panel: upgrade groups (EXTRACTION / TRANSPORT / SURFACE, revealed progressively) + modal.
// Arrival cinematics are a later phase. Element updates are diffed; no per-frame DOM creation.
import { CFG, CREW, FINDS, TOOLS, UPGRADES, type UpgradeId } from './config';
import { S, saveState } from './state';
import { addTo, cartCapacity, cartSpeed, clickPower, crewCost, loadRate, unitValue, upgCost } from './economy';
import { syncWorkers } from './sim';
import { FX, popup } from './fx';
import { faceY, view } from './view';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;

const CART_LABEL: Record<string, string> = {
  BOTTOM_EMPTY: 'waiting for rubble', LOADING: 'loading', READY: 'departing', TRAVELLING_UP: 'heading up',
  SURFACE_ARRIVAL: 'arrived at the surface', UNLOADING: 'unloading', TRAVELLING_DOWN: 'heading back down',
};

function btn(attr: string, ic: string, name: string, ds: string) {
  return `<button class="btn" ${attr}><span class="ic" aria-hidden="true">${ic}</span>` +
    `<span><div class="nm">${name}</div><div class="ds">${ds}</div></span>` +
    `<span><div class="pr"></div><div class="ct"></div></span></button>`;
}

export function buildPanel() {
  $('crew').innerHTML = CREW.map((c) => btn(`data-crew="${c.id}"`, c.ic, c.name, c.ds)).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => {
    b.onclick = () => {
      const c = CREW.find((x) => x.id === b.dataset.crew)!;
      const cost = crewCost(S, c.id);
      if (S.cash < cost || S.depth < c.unlockDepth) return;
      S.cash -= cost;
      S.crew[c.id]++;
      syncWorkers();
      saveState();
      popup(view.W / 2, faceY() - 90, c.name + ' hired', '#7ee08a', 20, { life: 1.4 });
    };
  });
  $('transport').innerHTML = UPGRADES.map((u) => btn(`data-upg="${u.id}"`, u.ic, u.name, u.ds)).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-upg]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.upg as UpgradeId, u = UPGRADES.find((x) => x.id === id)!;
      const cost = upgCost(S, id);
      if (S.cash < cost || S.upg[id] >= u.maxLevel) return;
      S.cash -= cost;
      S.upg[id]++;
      saveState();
    };
  });
  if (import.meta.env.DEV) buildDebug();
}

/** Dev-only test controls (stripped from production). Not part of the economy. */
function buildDebug() {
  const d = $('debug');
  d.innerHTML = '<h2>Debug (dev only)</h2>' +
    '<button class="dbg" data-d="cash">+$1,000</button><button class="dbg" data-d="rubble">+50 rubble at dig site</button>' +
    '<button class="dbg" data-d="clear">Clear surface stock</button>';
  d.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.d === 'cash') S.cash += 1000;
      if (b.dataset.d === 'rubble') addTo(S.rubble, 50, unitValue(S.depth));
      if (b.dataset.d === 'clear') { S.surface.qty = 0; S.surface.val = 0; }
    };
  });
}

function buyTool() {
  const n = TOOLS[S.tool + 1];
  if (!n || S.cash < n.cost || S.depth < n.unlockDepth) return;
  S.cash -= n.cost;
  S.tool++;
  saveState();
  FX.banner = { s: 'New tool: ' + n.name, sub: `Hits ${(n.pow / TOOLS[S.tool - 1].pow).toFixed(0)}× harder (power ${clickPower(S).toFixed(1)})`, t: 0 };
}

function setText(id: string, v: string) { const e = $(id); if (e.textContent !== v) e.textContent = v; }

export function updatePanel() {
  setText('cash', money(S.cash));
  setText('depth', (S.depth < 100 ? S.depth.toFixed(1) : fmt(S.depth)) + ' m');
  setText('stock', fmt(S.surface.qty) + ' rubble');

  // EXTRACTION
  const nt = TOOLS[S.tool + 1], cur = TOOLS[S.tool];
  let th: string;
  if (nt && S.depth >= nt.unlockDepth) {
    th = `<button class="btn" id="up"${S.cash < nt.cost ? ' disabled' : ''}><span class="ic" aria-hidden="true">${nt.ic}</span>` +
      `<span><div class="nm">Upgrade to ${nt.name}</div><div class="ds">Hits ${(nt.pow / cur.pow).toFixed(0)}× harder</div></span>` +
      `<span><div class="pr">${money(nt.cost)}</div></span></button>`;
  } else {
    th = `<div class="ds" style="padding:0 6px 8px">${cur.ic} ${cur.name}${nt ? '. Something heavier arrives deeper down.' : '.'}</div>`;
  }
  const tool = $('tool');
  if (tool.dataset.k !== th) {
    tool.innerHTML = th;
    tool.dataset.k = th;
    const u = document.getElementById('up');
    if (u) u.onclick = buyTool;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b, i) => {
    const c = CREW[i];
    const cost = crewCost(S, c.id);
    b.hidden = S.depth < c.unlockDepth && S.crew[c.id] === 0;
    b.disabled = S.cash < cost;
    b.querySelector('.pr')!.textContent = money(cost);
    b.querySelector('.ct')!.textContent = S.crew[c.id] ? 'Own ' + S.crew[c.id] : '';
  });

  // TRANSPORT — revealed once the first load has been dispatched (the game teaches the UI)
  $('g-tr').hidden = !S.flags.dispatched;
  const cap = cartCapacity(S);
  setText('cartStatus', `Cart ${Math.floor(S.cart.load.qty)}/${cap}, ${CART_LABEL[S.cart.state]} · pile ${Math.floor(S.rubble.qty)}`);
  document.querySelectorAll<HTMLButtonElement>('[data-upg]').forEach((b) => {
    const id = b.dataset.upg as UpgradeId, u = UPGRADES.find((x) => x.id === id)!;
    const maxed = S.upg[id] >= u.maxLevel, cost = upgCost(S, id);
    b.disabled = maxed || S.cash < cost;
    b.querySelector('.pr')!.textContent = maxed ? 'MAX' : money(cost);
    const stat = id === 'cartCap' ? `${cap} per trip` : id === 'loadSpeed' ? `${loadRate(S).toFixed(1)}/s` : `${cartSpeed(S).toFixed(1)} m/s`;
    b.querySelector('.ct')!.textContent = `Lv ${S.upg[id]} · ${stat}`;
  });

  // SURFACE — revealed once the first load reaches the top. Selling arrives in Phase 3C.
  $('g-surf').hidden = !S.flags.arrived;
  setText('surfStatus', `Stockpile ${fmt(S.surface.qty)} rubble. No buyer yet.`);

  const fh =
    FINDS.map((f, i) =>
      i < S.found
        ? `<div class="disc"><span>★ ${f.name}</span><span>${fmt(f.d)} m</span></div>`
        : i === S.found
          ? `<div class="disc locked"><span>? ? ?</span><span>${fmt(f.d)} m</span></div>`
          : '',
    ).join('') +
    (S.found
      ? `<div class="ds" style="padding:8px">Each find adds ${Math.round(CFG.findMultBonus * 100)}% to all digging. Now +${Math.round(S.found * CFG.findMultBonus * 100)}%</div>`
      : '');
  const finds = $('finds');
  if (finds.dataset.k !== fh) {
    finds.innerHTML = fh;
    finds.dataset.k = fh;
  }
}

// ---- modal ----
let modalOpen = false;
export const isModalOpen = () => modalOpen;

export function showModal(html: string, btnLabel: string) {
  $('card').innerHTML = html + `<button id="ok">${btnLabel}</button>`;
  $('modal').classList.add('show');
  modalOpen = true;
  const ok = $('ok');
  ok.focus();
  ok.onclick = () => {
    $('modal').classList.remove('show');
    modalOpen = false;
    ok.blur();
  };
}
