// DOM side panel: accordion sections EXTRACTION / TRANSPORT / PROCESSING / FINDS.
// Big cards for the next meaningful action, compact rows for understood systems; the game reveals sections and
// rows as problems appear. Element updates are diffed; no per-frame DOM creation.
import { CFG, CREW, FINDS, TOOLS, UPGRADES, type Upgrade, type UpgradeId } from './config';
import { S, saveState } from './state';
import {
  addTo, cartCapacity, cartSpeed, contractPrice, crewCost, crewRubbleRate, loadRate, materialAt, processRate, rawCap, unitValue, upgCost,
} from './economy';
import { syncWorkers } from './sim';
import { buildYard } from './surface';
import { FX, popup } from './fx';
import { playPurchase } from './audio';
import { yardPurchased } from './juice';
import { faceY, toScreen } from './view';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;
const Y = CFG.yard;

const CART_LABEL: Record<string, string> = {
  BOTTOM_EMPTY: 'waiting', LOADING: 'loading', READY: 'departing', TRAVELLING_UP: 'heading up',
  SURFACE_ARRIVAL: 'at the top', UNLOADING: 'unloading', TRAVELLING_DOWN: 'heading down',
};
const TRUCK_LABEL: Record<string, string> = { NONE: 'waiting for blocks', ARRIVING: 'arriving', LOADING: 'loading', DEPARTING: 'delivering' };

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

// ---- accordion ----
const ACC_KEY = 'dth_acc';
let accOpen: Record<string, boolean> = { ext: true };
let accSeen: Record<string, boolean> = {};
try { const a = JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); if (a) { accOpen = a.open ?? accOpen; accSeen = a.seen ?? {}; } } catch { /* session-only */ }
const saveAcc = () => { try { localStorage.setItem(ACC_KEY, JSON.stringify({ open: accOpen, seen: accSeen })); } catch { /* ignore */ } };
const narrow = () => window.matchMedia('(max-width: 760px)').matches;

function setOpen(key: string, open: boolean) {
  accOpen[key] = open;
  if (open && narrow()) for (const k of Object.keys(accOpen)) if (k !== key) accOpen[k] = false; // mobile: one at a time
  document.querySelectorAll<HTMLElement>('.acc').forEach((sec) => {
    sec.querySelector('.acc-h')!.setAttribute('aria-expanded', String(!!accOpen[sec.dataset.acc!]));
  });
  saveAcc();
}

/** A section appears for the first time: open it once and flash the header (the game teaches the UI). */
function reveal(key: string, sectionId: string, visible: boolean) {
  const sec = $(sectionId);
  sec.hidden = !visible;
  if (visible && !accSeen[key]) {
    accSeen[key] = true;
    setOpen(key, true);
    sec.classList.add('flash');
    setTimeout(() => sec.classList.remove('flash'), 1300);
  }
}

export function buildPanel() {
  document.querySelectorAll<HTMLElement>('.acc').forEach((sec) => {
    const key = sec.dataset.acc!;
    sec.querySelector<HTMLButtonElement>('.acc-h')!.onclick = () => setOpen(key, !accOpen[key]);
  });
  setOpen('ext', accOpen.ext ?? true);
  $('tool').innerHTML = card('id="up"', '⛏️');
  $('up').onclick = buyTool;
  $('crew').innerHTML = CREW.map((c) => card(`data-crew="${c.id}"`, c.ic)).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => (b.onclick = () => hire(b.dataset.crew as 'dig' | 'exc')));
  $('yardCard').innerHTML = card('id="buildYard"', '🏭');
  $('buildYard').onclick = () => {
    if (!buildYard()) return;
    yardPurchased();
    saveState();
  };
  $('transport').innerHTML = UPGRADES.filter((u) => u.group === 'transport').map(row).join('');
  $('processing').innerHTML = UPGRADES.filter((u) => u.group === 'processing').map(row).join('');
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
  popup(toScreen(70, 0).x, faceY() - 130, c.name + ' hired', '#7ee08a', 20, { life: 1.4 });
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
    '<button class="dbg" data-d="clear">Clear raw material</button>';
  d.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.d === 'cash') S.cash += 1000;
      if (b.dataset.d === 'rubble') addTo(S.rubble, 50, unitValue(S.depth), materialAt(S.depth).id);
      if (b.dataset.d === 'clear') { S.raw.qty = 0; S.raw.val = 0; S.raw.mix = {}; }
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
    case 'processSpeed': return `${processRate(S).toFixed(1)}/s`;
    case 'contractValue': return `×${contractPrice(S).toFixed(2)}`;
    case 'rawStorage': return `${rawCap(S)}`;
  }
}

/** Which processing rows the game has taught so far. */
function procRowVisible(id: UpgradeId) {
  if (!S.yard) return false;
  if (id === 'processSpeed') return true;
  if (id === 'contractValue') return S.stats.delivered >= Y.revealValueAt || S.upg.contractValue > 0;
  if (id === 'rawStorage') return S.flags.storageSeen || S.upg.rawStorage > 0;
  return true;
}

export function updatePanel() {
  setText('depth', (S.depth < 100 ? S.depth.toFixed(1) : fmt(S.depth)) + ' m');
  setText('stock', S.yard ? `${fmt(S.raw.qty)} raw · ${fmt(S.goods.qty)} blocks` : `${fmt(S.raw.qty)} raw`);
  if (S.raw.qty >= rawCap(S) * Y.revealStorageFrac) S.flags.storageSeen = true;
  // until the Recycling Yard exists it is the only purchase (the tutorial's one forced step; prevents a soft-lock)
  const hasMoney = S.yard;

  // EXTRACTION
  setText('extStat', S.crew.dig ? `${S.crew.dig} crew · ${crewRubbleRate(S).toFixed(1)} rubble/s` : TOOLS[S.tool].name);
  $('extHint').hidden = hasMoney;
  setText('extHint', S.flags.sold ? 'Build the Recycling Yard (Processing) to start earning.' : 'Fill the cart and send the rubble up. Someone at the surface might want it.');
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

  // TRANSPORT
  reveal('tr', 'g-tr', S.flags.dispatched);
  setText('trStat', `Cart ${Math.floor(S.cart.load.qty)}/${cartCapacity(S)} ${CART_LABEL[S.cart.state]} · pile ${Math.floor(S.rubble.qty)}`);
  document.querySelectorAll<HTMLButtonElement>('#transport [data-upg]').forEach((b) => updRow(b, hasMoney));

  // PROCESSING
  reveal('proc', 'g-proc', S.flags.arrived);
  const cap = rawCap(S);
  setText('procStat', S.yard
    ? `Raw ${Math.floor(S.raw.qty)}/${cap} · Blocks ${Math.floor(S.goods.qty)} · Truck ${TRUCK_LABEL[S.truck.state]}`
    : `Raw ${Math.floor(S.raw.qty)}/${cap} · no yard`);
  const by = $('buildYard') as HTMLButtonElement;
  by.hidden = S.yard || !S.flags.sold;
  by.disabled = S.cash < Y.cost;
  set(by, '.nm', 'Build Recycling Yard');
  set(by, '.ds', 'Crush raw rubble into blocks; trucks pay on pickup');
  set(by, '.pr', money(Y.cost));
  set(by, '.ct', '');
  document.querySelectorAll<HTMLButtonElement>('#processing [data-upg]').forEach((b) => updRow(b, procRowVisible(b.dataset.upg as UpgradeId)));

  // FINDS
  setText('findStat', `${S.found}/${FINDS.length}`);
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
