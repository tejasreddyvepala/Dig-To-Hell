// DOM side panel, CONTEXTUAL per site (Spec §17): MINE (extraction, worksite, transport, finds) · YARD (recycling,
// processing, logistics) · BUILD (the current project: stages, start/sell). Accordions inside each site panel.
// Big cards for transformations, compact rows for understood efficiency. Element updates are diffed.
import { CFG, CREW, FINDS, PROJECTS, TOOLS, UPGRADES, WORKSITES, type CrewId, type Upgrade, type UpgradeId } from './config';
import { S, saveState, type Site } from './state';
import {
  addTo, cartCapacity, cartSpeed, crewAvailable, crewCost, crewRubbleRate, loadRate, materialAt, nextWorksite, processRate,
  nextTrack, projectValue, rawCap, stagePayment, trackDef, trackSafe, unitValue, upgCost, worksiteAvailable,
} from './economy';
import { syncWorkers, restingCount, workers } from './workers';
import { buildYard } from './surface';
import { canStartStage, currentProject, currentStage, sellProperty, type BuildEvent } from './construction';
import { buyExpansion, expanding } from './expansion';
import { buyTrack, trackBusy } from './track';
import { trackOverloaded } from './cart';
import { FX, popup } from './fx';
import { playPurchase } from './audio';
import { yardPurchased } from './juice';
import { presentBuild } from './site';
import { faceY, toScreen } from './view';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;
const Y = CFG.yard;

const CART_LABEL: Record<string, string> = {
  BOTTOM_EMPTY: 'waiting', LOADING: 'loading', READY: 'departing', TRAVELLING_UP: 'heading up',
  SURFACE_ARRIVAL: 'at the top', UNLOADING: 'unloading', TRAVELLING_DOWN: 'heading down',
};
const TRUCK_LABEL: Record<string, string> = {
  NONE: 'not here yet', ARRIVING: 'arriving', PARKED: 'waiting for blocks', LOADING: 'loading blocks',
  TO_SITE: 'driving to the site', UNLOADING: 'unloading at the site', RETURNING: 'driving back',
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

// ---- accordion ----
const ACC_KEY = 'dth_acc2';
let accOpen: Record<string, boolean> = { 'm-ext': true, 'y-rec': true, 'y-log': true, 'b-proj': true };
let accSeen: Record<string, boolean> = {};
try { const a = JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); if (a) { accOpen = { ...accOpen, ...(a.open ?? {}) }; accSeen = a.seen ?? {}; } } catch { /* session-only */ }
const saveAcc = () => { try { localStorage.setItem(ACC_KEY, JSON.stringify({ open: accOpen, seen: accSeen })); } catch { /* ignore */ } };
const narrow = () => window.matchMedia('(max-width: 760px)').matches;

function setOpen(key: string, open: boolean) {
  accOpen[key] = open;
  const sec = document.querySelector<HTMLElement>(`.acc[data-acc="${key}"]`);
  if (open && narrow() && sec) { // mobile: one open section per site panel
    sec.parentElement!.querySelectorAll<HTMLElement>('.acc').forEach((o) => { if (o !== sec) accOpen[o.dataset.acc!] = false; });
  }
  document.querySelectorAll<HTMLElement>('.acc').forEach((s) => {
    s.querySelector('.acc-h')!.setAttribute('aria-expanded', String(!!accOpen[s.dataset.acc!]));
  });
  saveAcc();
}

/** A section appears for the first time: open it once and flash the header (the game teaches the UI). */
function reveal(key: string, el: HTMLElement, visible: boolean) {
  el.hidden = !visible;
  if (visible && !accSeen[key]) {
    accSeen[key] = true;
    setOpen(key, true);
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1300);
  }
}

/** Show the panel for a site. */
export function showSitePanel(site: Site) {
  document.querySelectorAll<HTMLElement>('.sitepanel').forEach((p) => (p.hidden = p.dataset.site !== site));
  setText('siteName', site === 'mine' ? 'Mine' : site === 'yard' ? 'Recycling Yard' : 'Construction');
}

export function buildPanel() {
  document.querySelectorAll<HTMLElement>('.acc').forEach((sec) => {
    const key = sec.dataset.acc!;
    sec.querySelector<HTMLButtonElement>('.acc-h')!.onclick = () => setOpen(key, !accOpen[key]);
  });
  setOpen('m-ext', accOpen['m-ext'] ?? true);
  $('tool').innerHTML = card('id="up"', '⛏️');
  $('up').onclick = buyTool;
  $('crew').innerHTML = card('data-crew="dig"', '👷');
  $('excCard').innerHTML = card('data-crew="exc"', '🚜');
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => (b.onclick = () => hire(b.dataset.crew as CrewId)));
  $('expandCard').innerHTML = card('id="expand"', '💥');
  $('expand').onclick = () => { if (buyExpansion()) { playPurchase(); updatePanel(); } };
  $('yardCard').innerHTML = card('id="buildYard"', '🏭');
  $('buildYard').onclick = () => {
    if (!buildYard()) return;
    yardPurchased();
    saveState();
    updatePanel();
  };
  // TRACK: what it is, what it safely carries, what the cart weighs now; the reinforce card; then the minor rows
  $('transport').innerHTML = `<div class="track" id="trackBox">
      <div class="tk-r"><span>Track</span><b id="tkName"></b></div>
      <div class="tk-r"><span>Safe load</span><b id="tkSafe"></b></div>
      <div class="tk-r"><span>Current cart</span><b id="tkCart"></b></div>
      <div class="tk-warn" id="tkWarn" hidden></div>
      ${card('id="tkBuy"', '🛤️')}
    </div>` + UPGRADES.filter((u) => u.group === 'transport' && u.id !== 'rail').map(row).join('');
  $('tkBuy').onclick = () => { if (buyTrack()) { playPurchase(); updatePanel(); } };
  $('processing').innerHTML = UPGRADES.filter((u) => u.group === 'processing').map(row).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-upg]').forEach((b) => (b.onclick = () => buyUpgrade(b.dataset.upg as UpgradeId)));
  $('buildAct').onclick = buildAction;
  if (import.meta.env.DEV) buildDebug();
}

function hire(id: CrewId) {
  const c = CREW.find((x) => x.id === id)!;
  const cost = crewCost(S, id);
  if (S.cash < cost || !crewAvailable(S, id) || expanding()) return;
  S.cash -= cost;
  S.crew[id]++;
  syncWorkers(true); // a new visible worker climbs down the ladder and stairs; extras dig unseen
  saveState();
  playPurchase();
  popup(toScreen(70, 0).x, faceY() - 130, c.name + (id === 'exc' ? ' delivered' : ' hired'), '#7ee08a', 20, { life: 1.4 });
  updatePanel();
}

function buyTool() {
  const n = TOOLS[S.tool + 1];
  if (!n || S.cash < n.cost || S.depth < n.unlockDepth) return;
  S.cash -= n.cost;
  S.tool++;
  saveState();
  playPurchase();
  const prev = TOOLS[S.tool - 1];
  FX.banner = { s: n.name.toUpperCase(), sub: `×${n.yield} rubble per break · ${(n.pow / prev.pow).toFixed(1)}× impact`, t: 0 };
  updatePanel();
}

function buyUpgrade(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)!;
  const cost = upgCost(S, id);
  if (S.cash < cost || S.upg[id] >= u.maxLevel) return;
  S.cash -= cost;
  S.upg[id]++;
  saveState();
  playPurchase();
  updatePanel();
}

/** BUILD panel's single action: start the next stage, or sell the finished property. */
function buildAction() {
  const ev: BuildEvent[] = [];
  if (S.build.done) { sellProperty(ev); }
  else return;
  presentBuild(ev);
  saveState();
  updatePanel();
}

/** Dev-only test controls (stripped from production). Not part of the economy. */
function buildDebug() {
  const d = $('debug');
  d.innerHTML = '<h2>Debug (dev only)</h2>' +
    '<button class="dbg" data-d="cash">+$1,000</button><button class="dbg" data-d="rubble">+50 rubble at dig site</button>' +
    '<button class="dbg" data-d="blocks">+60 blocks on site</button><button class="dbg" data-d="clear">Clear raw material</button>';
  d.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.d === 'cash') S.cash += 1000;
      if (b.dataset.d === 'rubble') addTo(S.rubble, 50, unitValue(S.depth), materialAt(S.depth).id);
      if (b.dataset.d === 'blocks') addTo(S.build.material, 60, unitValue(S.depth), materialAt(S.depth).id);
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
    case 'cartSpeed': return `${cartSpeed(S).toFixed(1)} m/s`;
    case 'rail': return trackDef(S).name;
    case 'loadSpeed': return `${loadRate(S).toFixed(1)}/s`;
    case 'processSpeed': return `${processRate(S).toFixed(1)}/s`;
    case 'contractValue': return `+${Math.round(Y.price.perLevel * S.upg.contractValue * 100)}% property value`;
    case 'rawStorage': return `${rawCap(S)}`;
  }
}

/** Which processing rows the game has taught so far. */
function procRowVisible(id: UpgradeId) {
  if (!S.yard) return false;
  if (id === 'processSpeed') return true;
  if (id === 'contractValue') return S.stats.sold >= 1 || S.upg.contractValue > 0;
  if (id === 'rawStorage') return S.flags.storageSeen || S.upg.rawStorage > 0;
  return true;
}

/** First overload story beat: open TRANSPORT and draw the eye to the track card (no modal). */
export function highlightTrack() {
  setOpen('m-tr', true);
  const box = $('trackBox');
  box.classList.add('pulse');
  setTimeout(() => box.classList.remove('pulse'), 4200);
  updatePanel();
}

/** Affordable optional purchases per site (the nav's yellow dot). */
export function optionalAffordable(site: Site): boolean {
  if (!S.yard) return false;
  const rowOk = (id: UpgradeId) => { const u = UPGRADES.find((x) => x.id === id)!; return S.upg[id] < u.maxLevel && S.cash >= upgCost(S, id); };
  if (site === 'mine') {
    const nt = TOOLS[S.tool + 1];
    if (nt && S.depth >= nt.unlockDepth && S.cash >= nt.cost) return true;
    if (S.cash >= crewCost(S, 'dig')) return true;
    if (crewAvailable(S, 'exc') && S.cash >= crewCost(S, 'exc')) return true;
    return S.flags.dispatched && UPGRADES.filter((u) => u.group === 'transport').some((u) => rowOk(u.id));
  }
  if (site === 'yard') return UPGRADES.filter((u) => u.group === 'processing' && procRowVisible(u.id)).some((u) => rowOk(u.id));
  return false;
}

export function updatePanel() {
  setText('depth', (S.depth < 100 ? S.depth.toFixed(1) : fmt(S.depth)) + ' m');
  if (S.raw.qty >= rawCap(S) * Y.revealStorageFrac) S.flags.storageSeen = true;
  const hasMoney = S.yard; // until the Recycling Yard exists it is the only purchase (the tutorial's forced step)

  // ===== MINE =====
  const visibleDig = workers.filter((w) => w.id === 'dig').length;
  setText('extStat', S.crew.dig ? `${S.crew.dig} crew · ${crewRubbleRate(S).toFixed(1)} rubble/s` : TOOLS[S.tool].name);
  $('extHint').hidden = hasMoney && S.crew.dig > 0;
  setText('extHint', !S.flags.dispatched ? 'Break rock. The rubble piles up; the cart hauls it to the surface.'
    : !S.yard ? (S.flags.sold ? 'Build the Recycling Yard (YARD) to turn rubble into blocks.' : 'The cart is taking your rubble up. Follow it to the YARD.')
      : `Crew dig on their own and take short breaks on the rest platform.${S.crew.dig > visibleDig ? ` ${S.crew.dig - visibleDig} more work out of sight.` : ''}`);
  const nt = TOOLS[S.tool + 1];
  const up = $('up') as HTMLButtonElement;
  up.hidden = !hasMoney || !nt;
  if (nt) {
    const locked = S.depth < nt.unlockDepth;
    up.disabled = locked || S.cash < nt.cost;
    set(up, '.ic', nt.ic);
    set(up, '.nm', `Upgrade to ${nt.name}`);
    set(up, '.ds', locked ? `Reach ${nt.unlockDepth} m to unlock` : `×${nt.yield} rubble per break · ${nt.kind === 'jack' ? 'bursts of hits' : (nt.pow / TOOLS[S.tool].pow).toFixed(1) + '× impact'}`);
    set(up, '.pr', money(nt.cost));
    set(up, '.ct', `now: ×${TOOLS[S.tool].yield}`);
  }
  const dig = document.querySelector<HTMLButtonElement>('[data-crew="dig"]')!;
  dig.hidden = !hasMoney;
  dig.disabled = S.cash < crewCost(S, 'dig') || expanding();
  set(dig, '.nm', 'Hire Digger');
  set(dig, '.ds', CREW[0].ds);
  set(dig, '.pr', money(crewCost(S, 'dig')));
  set(dig, '.ct', S.crew.dig ? `Own ${S.crew.dig}` : '');

  // worksite: the Work Chamber is a transformation card; the Excavator needs it
  reveal('m-site', $('g-site'), hasMoney && (S.crew.dig >= 1 || S.worksite > 0));
  const ws = WORKSITES[S.worksite], nw = nextWorksite(S);
  setText('siteStat', ws.name);
  const ex = $('expand') as HTMLButtonElement;
  ex.hidden = !nw;
  if (nw) {
    const ready = worksiteAvailable(S);
    ex.disabled = !ready || S.cash < nw.cost || expanding();
    set(ex, '.nm', 'Expand Worksite');
    set(ex, '.ds', ready ? `Blast out a ${nw.name}: room for ${nw.visible} diggers and an Excavator` : `Needs ${nw.unlockCrew} diggers (you have ${S.crew.dig})`);
    set(ex, '.pr', money(nw.cost));
    set(ex, '.ct', `now: ${ws.name}`);
  }
  const exc = document.querySelector<HTMLButtonElement>('[data-crew="exc"]')!;
  const excDef = CREW[1];
  exc.hidden = !hasMoney || S.crew.dig < 1;
  exc.disabled = !crewAvailable(S, 'exc') || S.cash < crewCost(S, 'exc') || expanding();
  set(exc, '.nm', S.crew.exc ? 'Excavator (working)' : 'Excavator');
  set(exc, '.ds', S.worksite < excDef.needsTier ? 'Needs a Work Chamber: machines need room' : S.crew.exc >= excDef.max ? `Bites a whole chunk: ×${excDef.yield} rubble per bucket` : excDef.ds + ` (×${excDef.yield} rubble)`);
  set(exc, '.pr', S.crew.exc >= excDef.max ? '' : money(crewCost(S, 'exc')));
  set(exc, '.ct', '');

  reveal('m-tr', $('g-tr'), S.flags.dispatched);
  setText('trStat', `Cart ${Math.floor(S.cart.load.qty)}/${cartCapacity(S)} ${CART_LABEL[S.cart.state]} · pile ${Math.floor(S.rubble.qty)}`);
  document.querySelectorAll<HTMLButtonElement>('#transport [data-upg]').forEach((b) => updRow(b, hasMoney));
  // track strength: the world already showed the strain; this confirms it with numbers
  const tk = trackDef(S), nt2 = nextTrack(S), over = trackOverloaded(), cap2 = cartCapacity(S);
  const shown = S.cart.load.qty > 0.5 ? S.cart.load.qty : cap2;
  setText('tkName', tk.name);
  setText('tkSafe', `${tk.safe} rubble`);
  setText('tkCart', S.cart.load.qty > 0.5 ? `${Math.floor(S.cart.load.qty)} / ${cap2} carried` : `holds ${cap2}`);
  $('trackBox').classList.toggle('over', over);
  const warn = $('tkWarn');
  warn.hidden = !over;
  if (over) setText('tkWarn', `⚠ OVERLOADED  ${Math.floor(Math.max(shown, cap2))} / ${tk.safe} · transport −${Math.round(CFG.track.overloadPenalty * 100)}%`);
  const tb = $('tkBuy') as HTMLButtonElement;
  tb.hidden = !nt2;
  if (nt2) {
    tb.disabled = S.cash < nt2.cost || trackBusy();
    set(tb, '.nm', trackBusy() ? 'Reinforcing…' : over ? 'REINFORCE TRACK' : `Upgrade to ${nt2.name}`);
    set(tb, '.ds', `${nt2.name} · safe load ${nt2.safe} · transport +${Math.round((nt2.speed / tk.speed - 1) * 100)}%`);
    set(tb, '.pr', money(nt2.cost));
    set(tb, '.ct', '');
    tb.classList.toggle('urgent', over);
  }

  setText('findStat', `${S.found}/${FINDS.length}`);
  const fh =
    FINDS.map((f, i) =>
      i < S.found
        ? `<div class="disc"><span>★ ${f.name}</span><span>${fmt(f.d)} m</span></div>`
        : i === S.found ? `<div class="disc locked"><span>? ? ?</span><span>${fmt(f.d)} m</span></div>` : '',
    ).join('') +
    (S.found ? `<div class="ds" style="padding:8px">Each find adds ${Math.round(CFG.findMultBonus * 100)}% to all digging. Now +${Math.round(S.found * CFG.findMultBonus * 100)}%</div>` : '');
  const finds = $('finds');
  if (finds.dataset.k !== fh) { finds.innerHTML = fh; finds.dataset.k = fh; }

  // ===== YARD =====
  const cap = rawCap(S);
  setText('recStat', S.yard ? `Raw ${Math.floor(S.raw.qty)}/${cap} · Blocks ${Math.floor(S.goods.qty)}` : `Raw ${Math.floor(S.raw.qty)}`);
  $('yardHint').hidden = S.yard;
  setText('yardHint', S.flags.sold ? 'The contractor paid you seed money. A Recycling Yard presses rubble into building blocks.' : 'The contractor is looking at your rubble…');
  const by = $('buildYard') as HTMLButtonElement;
  by.hidden = S.yard || !S.flags.sold;
  by.disabled = S.cash < Y.cost;
  set(by, '.nm', 'Build Recycling Yard');
  set(by, '.ds', 'Crush rubble and press it into building blocks');
  set(by, '.pr', money(Y.cost));
  set(by, '.ct', '');
  document.querySelectorAll<HTMLButtonElement>('#processing [data-upg]').forEach((b) => updRow(b, procRowVisible(b.dataset.upg as UpgradeId)));
  reveal('y-log', $('g-log'), S.yard);
  setText('logStat', `Truck ${TRUCK_LABEL[S.truck.state]}`);
  setText('logInfo', `The truck takes finished blocks (${Y.truck.pickupMin}+) to the construction site, ${Y.truck.capacity} per trip. Delivered so far: ${fmt(S.stats.delivered)}.`);

  // ===== BUILD =====
  const pr = currentProject(), b = S.build;
  setText('projName', `#${S.stats.sold + 1} ${pr.name}`);
  setText('projValue', money(projectValue(S)));
  const total = pr.stages.reduce((a, s) => a + s.blocks, 0);
  const doneBlocks = pr.stages.slice(0, b.stage).reduce((a, s) => a + s.blocks, 0) + (b.active ? b.used : 0);
  ($('projBar') as HTMLElement).style.width = `${b.done ? 100 : Math.round((doneBlocks / total) * 100)}%`;
  setText('projStat', b.done ? 'complete' : `stage ${Math.min(b.stage + 1, pr.stages.length)}/${pr.stages.length}`);
  const sh = pr.stages.map((st, i) => {
    const cls = b.done || i < b.stage ? 'done' : i === b.stage ? (b.active ? 'now' : 'next') : '';
    const right = cls === 'done' ? '✓' : i === b.stage && b.active ? `${Math.floor(b.used)}/${st.blocks}` : `${st.blocks} blocks`;
    return `<li class="${cls}"><span>${st.name}</span><span>${right}</span></li>`;
  }).join('');
  const stages = $('stages');
  if (stages.dataset.k !== sh) { stages.innerHTML = sh; stages.dataset.k = sh; }
  // stages start by themselves; the only button left is the decision to SELL a finished property
  const act = $('buildAct') as HTMLButtonElement;
  const st = currentStage();
  act.hidden = !b.done;
  act.classList.toggle('sell', b.done);
  const sellLabel = `SELL PROPERTY · ${money(projectValue(S))}`;
  if (b.done && act.textContent !== sellLabel) act.textContent = sellLabel;
  setText('buildState', b.done ? '' : b.active ? `🏗 Building ${st.name}… ${Math.floor(b.used)}/${st.blocks}`
    : canStartStage() ? `🏗 ${st.name} starting…` : `Next: ${st.name} · ${Math.floor(b.material.qty)}/${st.blocks} blocks on site · starts automatically`);
  $('buildState').hidden = b.done;
  setText('buildInfo', b.done ? 'Sell it, clear the plot, start something bigger.'
    : `Blocks on site ${Math.floor(b.material.qty)} · on the truck ${Math.floor(S.truck.load.qty)} · at the yard ${Math.floor(S.goods.qty)}. Each finished stage pays ${money(stagePayment(S))}; the sale pays ${money(projectValue(S))}.` +
      (S.build.project === PROJECTS.length - 1 && S.stats.sold >= PROJECTS.length ? ' (More projects arrive in a later build.)' : ''));
  // crew status for the extraction header
  if (S.crew.dig) setText('extStat', `${S.crew.dig} crew${restingCount() ? ` · ${restingCount()} resting` : ''} · ${crewRubbleRate(S).toFixed(1)} rubble/s`);
}

function updRow(b: HTMLButtonElement, visible: boolean) {
  const id = b.dataset.upg as UpgradeId, u = UPGRADES.find((x) => x.id === id)!;
  b.hidden = !visible;
  if (!visible) return;
  const maxed = S.upg[id] >= u.maxLevel, cost = upgCost(S, id);
  b.disabled = maxed || S.cash < cost;
  // a bigger cart is not pure upside: say when the next level's full load will exceed the track (still buyable)
  const capWarn = id === 'cartCap' && Math.round(CFG.cart.capacity.base * (1 + CFG.cart.capacity.perLevel * (S.upg.cartCap + 1))) > trackSafe(S);
  set(b, 'small', `Lv ${S.upg[id]} · ${upgStat(id)}${capWarn ? ' · ⚠ full load may exceed track strength' : ''}`);
  set(b, '.rp', maxed ? 'MAX' : money(cost));
}

// ---- modal (finds placeholder until discoveries are rebuilt) ----
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
