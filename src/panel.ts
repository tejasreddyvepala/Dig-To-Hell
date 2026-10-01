// DOM side panel: EXTRACTION / TRANSPORT / SURFACE. Big cards for the next meaningful action, compact rows for
// systems the player already understands; groups and rows are revealed by the game (problems teach upgrades).
// Element updates are diffed; no per-frame DOM creation.
import { CFG, CREW, FINDS, TOOLS, UPGRADES, type Upgrade, type UpgradeId } from './config';
import { S, saveState } from './state';
import {
  addTo, cartCapacity, cartSpeed, crewCost, crewRubbleRate, loadRate, sellPrice, sellRate, storageCap, unitValue, upgCost,
} from './economy';
import { syncWorkers } from './sim';
import { buildStall } from './surface';
import { FX, popup } from './fx';
import { playPurchase } from './audio';
import { stallPurchased } from './juice';
import { faceY, view } from './view';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;
const SF = CFG.surface;

const CART_LABEL: Record<string, string> = {
  BOTTOM_EMPTY: 'waiting for rubble', LOADING: 'loading', READY: 'departing', TRAVELLING_UP: 'heading up',
  SURFACE_ARRIVAL: 'at the surface', UNLOADING: 'unloading', TRAVELLING_DOWN: 'heading down',
};

function card(attr: string, ic: string) {
  return `<button class="btn" ${attr}><span class="ic" aria-hidden="true">${ic}</span>` +
    `<span><div class="nm"></div><div class="ds"></div></span><span><div class="pr"></div><div class="ct"></div></span></button>`;
}
function row(u: Upgrade) {
  return `<button class="row" data-upg="${u.id}" hidden><span class="ic" aria-hidden="true">${u.ic}</span>` +
    `<span class="rn">${u.name} <small></small></span><span class="rp"></span></button>`;
}
const set = (el: Element, sel: string, v: string) => { const e = el.querySelector(sel)!; if (e.textContent !== v) e.textContent = v; };
function setText(id: string, v: string) { const e = $(id); if (e.textContent !== v) e.textContent = v; }

export function buildPanel() {
  $('tool').innerHTML = card('id="up"', '⛏️');
  $('up').onclick = buyTool;
  $('crew').innerHTML = CREW.map((c) => card(`data-crew="${c.id}"`, c.ic)).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => (b.onclick = () => hire(b.dataset.crew as 'dig' | 'exc')));
  $('stall').innerHTML = card('id="buildStall"', '🏚️');
  $('buildStall').onclick = () => {
    if (!buildStall()) return;
    stallPurchased();
    saveState();
  };
  $('transport').innerHTML = UPGRADES.filter((u) => u.group === 'transport').map(row).join('');
  $('surface').innerHTML = UPGRADES.filter((u) => u.group === 'surface').map(row).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-upg]').forEach((b) => (b.onclick = () => buyUpgrade(b.dataset.upg as UpgradeId)));
  if (import.meta.env.DEV) buildDebug();
}

function hire(id: 'dig' | 'exc') {
  const c = CREW.find((x) => x.id === id)!;
  const cost = crewCost(S, id);
  if (S.cash < cost || S.depth < c.unlockDepth) return;
  S.cash -= cost;
  S.crew[id]++;
  syncWorkers(true); // a new visible worker rappels in; extras join the "+N crew" row
  saveState();
  playPurchase();
  popup(view.W * 0.3, faceY() - 110, c.name + ' hired', '#7ee08a', 18, { life: 1.4 });
}

function buyTool() {
  const n = TOOLS[S.tool + 1];
  if (!n || S.cash < n.cost || S.depth < n.unlockDepth) return;
  S.cash -= n.cost;
  S.tool++;
  saveState();
  playPurchase();
  const prev = TOOLS[S.tool - 1];
  FX.banner = { s: n.name.toUpperCase(), sub: n.kind === 'jack' ? 'Every click rattles a burst of hits' : `${(n.pow / prev.pow).toFixed(1)}× the impact of the ${prev.name}`, t: 0 };
}

function buyUpgrade(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)!;
  const cost = upgCost(S, id);
  if (S.cash < cost || S.upg[id] >= u.maxLevel) return;
  S.cash -= cost;
  S.upg[id]++;
  saveState();
  playPurchase();
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

/** HUD cash counts up toward the real value (spending snaps down). */
let shownCash = S.cash;
export function tickCash(dt: number) {
  if (S.cash < shownCash || S.cash - shownCash < 0.5) shownCash = S.cash;
  else shownCash += (S.cash - shownCash) * Math.min(1, dt * 7);
  setText('cash', money(shownCash));
}

function upgStat(id: UpgradeId): string {
  switch (id) {
    case 'cartCap': return `${cartCapacity(S)}/trip`;
    case 'cartSpeed': case 'rail': return `${cartSpeed(S).toFixed(1)} m/s`;
    case 'loadSpeed': return `${loadRate(S).toFixed(1)}/s`;
    case 'sellSpeed': return `${sellRate(S).toFixed(1)}/s`;
    case 'sellValue': return `×${sellPrice(S).toFixed(2)}`;
    case 'storage': return `${storageCap(S)}`;
  }
}

/** Which surface rows the game has taught so far. */
function surfaceRowVisible(id: UpgradeId) {
  if (!S.stall) return false;
  if (id === 'sellSpeed') return true;
  if (id === 'sellValue') return S.stats.sold >= SF.revealSellValueAt || S.upg.sellValue > 0;
  if (id === 'storage') return S.flags.storageSeen || S.upg.storage > 0;
  return true;
}

export function updatePanel() {
  setText('depth', (S.depth < 100 ? S.depth.toFixed(1) : fmt(S.depth)) + ' m');
  setText('stock', fmt(S.surface.qty) + ' rubble');
  if (S.surface.qty >= storageCap(S) * SF.revealStorageFrac) S.flags.storageSeen = true;
  // until the Scrap Stall exists it is the only purchase (the tutorial's one forced step; prevents a soft-lock)
  const hasMoney = S.stall || (!S.flags.sold && S.cash > 0 && S.flags.arrived);

  // EXTRACTION — the player's own power and the crew. Revealed as purchases once there is money.
  setText('extStat', S.crew.dig ? `${S.crew.dig} crew · ${crewRubbleRate(S).toFixed(1)} rubble/s` : TOOLS[S.tool].name);
  $('extHint').hidden = hasMoney;
  setText('extHint', 'Fill the cart and get the rubble to the surface. Someone up there might buy it.');
  const nt = TOOLS[S.tool + 1];
  const up = $('up') as HTMLButtonElement;
  up.hidden = !hasMoney || !nt;
  if (nt) {
    const locked = S.depth < nt.unlockDepth;
    up.disabled = locked || S.cash < nt.cost;
    set(up, '.ic', nt.ic);
    set(up, '.nm', `Upgrade to ${nt.name}`);
    set(up, '.ds', locked ? `Reach ${nt.unlockDepth} m to unlock` : nt.kind === 'jack' ? 'Each click becomes a burst of hits' : `${(nt.pow / TOOLS[S.tool].pow).toFixed(1)}× impact per swing`);
    set(up, '.pr', money(nt.cost));
    set(up, '.ct', `now: ${TOOLS[S.tool].name}`);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => {
    const c = CREW.find((x) => x.id === b.dataset.crew)!;
    const cost = crewCost(S, c.id);
    b.hidden = !hasMoney || (S.depth < c.unlockDepth && S.crew[c.id] === 0);
    b.disabled = S.cash < cost;
    set(b, '.nm', c.id === 'dig' ? 'Hire Digger' : c.name);
    set(b, '.ds', c.ds);
    set(b, '.pr', money(cost));
    set(b, '.ct', S.crew[c.id] ? 'Own ' + S.crew[c.id] : '');
  });

  // TRANSPORT — compact rows; revealed after the first dispatch, purchasable once there is money
  $('g-tr').hidden = !S.flags.dispatched;
  setText('trStat', `Cart ${Math.floor(S.cart.load.qty)}/${cartCapacity(S)} ${CART_LABEL[S.cart.state]} · pile ${Math.floor(S.rubble.qty)}`);
  document.querySelectorAll<HTMLButtonElement>('#transport [data-upg]').forEach((b) => updRow(b, hasMoney));

  // SURFACE — revealed at the first arrival; the stall is the big next action until it exists
  $('g-surf').hidden = !S.flags.arrived;
  const cap = storageCap(S);
  setText('surfStat', S.stall ? `Stock ${Math.floor(S.surface.qty)}/${cap} · selling ${sellRate(S).toFixed(1)}/s` : `Stock ${Math.floor(S.surface.qty)}/${cap} · no seller`);
  const bs = $('buildStall') as HTMLButtonElement;
  bs.hidden = S.stall || !S.flags.sold;
  bs.disabled = S.cash < SF.stallCost;
  set(bs, '.nm', 'Build Scrap Stall');
  set(bs, '.ds', 'A seller who turns surface rubble into cash');
  set(bs, '.pr', money(SF.stallCost));
  set(bs, '.ct', '');
  document.querySelectorAll<HTMLButtonElement>('#surface [data-upg]').forEach((b) => updRow(b, surfaceRowVisible(b.dataset.upg as UpgradeId)));

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

function updRow(b: HTMLButtonElement, visible: boolean) {
  const id = b.dataset.upg as UpgradeId, u = UPGRADES.find((x) => x.id === id)!;
  b.hidden = !visible;
  if (!visible) return;
  const maxed = S.upg[id] >= u.maxLevel, cost = upgCost(S, id);
  b.disabled = maxed || S.cash < cost;
  set(b, 'small', `Lv ${S.upg[id]} · ${upgStat(id)}`);
  set(b, '.rp', maxed ? 'MAX' : money(cost));
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
