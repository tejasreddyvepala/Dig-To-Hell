// DOM side panel, CONTEXTUAL per site (Spec §17): MINE (extraction, worksite, transport, finds) · YARD (recycling,
// processing, logistics) · BUILD (the current project: stages, start/sell). Accordions inside each site panel.
// Big cards for transformations, compact rows for understood efficiency. Element updates are diffed.
import { CFG, CREW, FINDS, PROJECTS, TOOLS, UPGRADES, WORKSITES, type CrewId, type Upgrade, type UpgradeId } from './config';
import { S, saveState, type Site } from './state';
import {
  cartCapacity, cartSpeed, pileCap, crewRoom, gearOf, nextGear, crewToolMult, crewUptime, chainGate, upgDef, crewAvailable, crewCost, crewRubbleRate, loadRate, nextWorksite, processRate,
  nextTrack, blockQualityMult, builders, constructionRate, projectValue, rawCap, repeatFactor, stagePayment,
  trackDef, trackSafe, truckCapacity, unitValue, upgCost, worksiteAvailable,
} from './economy';
import { syncWorkers, restingCount, workers } from './workers';
import { buildYard } from './surface';
import { canStartStage, currentProject, currentStage, sellProperty, waitingForBlocks, type BuildEvent } from './construction';
import { buyExpansion, expanding } from './expansion';
import { buyTrack, trackBusy } from './track';
import { trackOverloaded } from './cart';
import { FX, popup } from './fx';
import { playPurchase } from './audio';
import { yardPurchased } from './juice';
import { SITE, presentBuild } from './site';
import { sellNow } from './salecall';
import { finaleRunning } from './finale';
import { bestNext, flowRates } from './econpage';
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

/** Big transformation card: icon, name, one short line, price pill, affordability fill. */
function card(attr: string, ic: string) {
  return `<button class="btn big" ${attr}><span class="ic" aria-hidden="true">${ic}</span>` +
    `<span class="tx"><span class="nm"></span><span class="ds"></span></span><span class="pr"></span><span class="ct" hidden></span><i class="fill" aria-hidden="true"></i></button>`;
}
/** Upgrade button: icon, name + level, "now → next" effect, price pill, affordability fill. */
function row(u: Upgrade) {
  return `<button class="btn up" data-upg="${u.id}" hidden><span class="ic" aria-hidden="true">${u.ic}</span>` +
    `<span class="tx"><span class="nm">${u.name}</span><span class="ds"><em class="lv"></em><span class="ef"></span></span></span><span class="pr"></span><i class="fill" aria-hidden="true"></i></button>`;
}
/** Progress of cash toward a price (the bottom fill of a button) + the ready glow. */
function afford(el: HTMLElement, cost: number) {
  const p = cost > 0 ? Math.min(1, S.cash / cost) : 1, v = p.toFixed(3);
  if (el.style.getPropertyValue('--p') !== v) el.style.setProperty('--p', v);
  el.classList.toggle('can', !(el as HTMLButtonElement).disabled);
}
function setHTML(id: string, v: string) { const e = $(id); if (e.dataset.k !== v) { e.innerHTML = v; e.dataset.k = v; } }
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
  $('gearCard').innerHTML = card('id="gearBuy"', '⛏️');
  $('gearBuy').onclick = () => { if (buyGear()) updatePanel(); };
  $('excCard').innerHTML = card('data-crew="exc"', '🚜');
  $('sawCard').innerHTML = card('data-crew="saw"', '💠');
  $('borerCard').innerHTML = card('data-crew="borer"', '🔩');
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
      <div class="chips"><span class="chip">🛤️ <b id="tkName"></b></span><span class="chip">safe <b id="tkSafe"></b></span><span class="chip">🛒 <b id="tkCart"></b></span></div>
      <div class="tk-warn" id="tkWarn" hidden></div>
      ${card('id="tkBuy"', '🛤️')}
    </div>` + UPGRADES.filter((u) => u.group === 'transport' && u.id !== 'rail').map(row).join('');
  $('tkBuy').onclick = () => { if (buyTrack()) { playPurchase(); updatePanel(); } };
  $('processing').innerHTML = UPGRADES.filter((u) => u.group === 'processing').map(row).join('');
  $('workers').innerHTML = UPGRADES.filter((u) => u.group === 'workers').map(row).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-upg]').forEach((b) => (b.onclick = () => buyUpgrade(b.dataset.upg as UpgradeId)));
  $('buildAct').onclick = buildAction;
  $('crewCard').innerHTML = card('id="crewBuy"', '👷');
  $('crewBuy').onclick = () => buyUpgrade('crew');
}

export function hire(id: CrewId) {
  const c = CREW.find((x) => x.id === id)!;
  const cost = crewCost(S, id);
  if (S.cash < cost || !crewAvailable(S, id) || expanding()) return;
  S.cash -= cost;
  S.crew[id]++;
  syncWorkers(true); // a new visible worker climbs down the ladder and stairs; extras dig unseen
  saveState();
  playPurchase();
  popup(toScreen(70, 0).x, faceY() - 130, id === 'dig' ? 'Miner recruited!' : c.name + ' delivered', '#7ee08a', 20, { life: 1.4 });
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

/** Crew Gear: the next tool tier for every miner (a big card, like the player's tool ladder). */
export function buyGear(): boolean {
  const n = nextGear(S);
  if (!n || S.cash < n.cost || S.depth < n.unlockDepth) return false;
  S.cash -= n.cost; S.crewGear++;
  saveState(); playPurchase();
  FX.banner = { s: n.name.toUpperCase(), sub: `every miner: ×${n.power} power · ×${n.yield} rubble per break`, t: 0 };
  return true;
}

export function buyUpgrade(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)!;
  const cost = upgCost(S, id);
  if (S.cash < cost || S.upg[id] >= u.maxLevel || S.upg[id] >= chainGate(S, id).cap) return;
  S.cash -= cost;
  S.upg[id]++;
  saveState();
  playPurchase();
  updatePanel();
}

/** BUILD panel's single action: start the next stage, or sell the finished property. */
export function buildAction() {
  const ev: BuildEvent[] = [];
  if (S.build.done) { sellProperty(ev); }
  else return;
  presentBuild(ev);
  saveState();
  updatePanel();
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
    case 'contractValue': return `×${blockQualityMult(S).toFixed(2)}`;
    case 'rawStorage': return `${rawCap(S)}`;
    case 'crew': return `${constructionRate(S).toFixed(1)}/s`;
    case 'crewTools': return `×${crewToolMult(S).toFixed(2)} power`;
    case 'crewStamina': return `${Math.round(crewUptime(S) * 100)}% on shift`;
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

/** Why no blocks are arriving: the real bottleneck in the chain, as one short instruction. */
function supplyNote() {
  const T = CFG.yard.truck;
  if (S.truck.state === 'TO_SITE' || S.truck.state === 'UNLOADING') return 'blocks on the way';
  if (S.goods.qty >= T.pickupMin) return 'the truck is loading at the yard';
  if (S.raw.qty >= 1) return `the press is making blocks (${Math.floor(S.goods.qty)}/${T.pickupMin} for the next truck)`;
  if (S.rubble.qty >= 1 || (S.cart.state !== 'BOTTOM_EMPTY' && S.cart.state !== 'LOADING')) return 'rubble is on its way up';
  return `dig more at the MINE — the truck leaves with ${T.pickupMin} blocks (${Math.floor(S.goods.qty)} at the yard)`;
}

/** BOTTLENECK tag: one purchase at a time, the same one as NEXT BEST, and only when it fixes the slowest station.
 *  (Tagging every row of the slow station made most of the panel pulse red; nothing then read as important.) */
const LINK_OF: Record<string, string> = { dig: 'dig', exc: 'dig', saw: 'dig', borer: 'dig', expand: 'dig', gearBuy: 'dig', crewTools: 'dig', crewStamina: 'dig', up: 'dig', cartCap: 'cart', cartSpeed: 'cart', loadSpeed: 'cart', tkBuy: 'cart',
  processSpeed: 'yard', rawStorage: 'yard', contractValue: 'yard', crew: 'build', crewBuy: 'build' };
function tagBottleneck(best: ReturnType<typeof bestNext>) {
  const slow = S.yard ? flowRates().slow : '';
  const hot = slow === 'truck' ? 'build' : slow; // the truck grows with the Construction Crew
  const key = best && hot && LINK_OF[best.key] === hot ? best.key : '';
  document.querySelectorAll<HTMLElement>('#panel .btn').forEach((b) => {
    const k = b.dataset.upg ?? b.dataset.crew ?? b.id;
    b.classList.toggle('hot', !!key && k === key && !b.hidden && !(b.querySelector('.pr')?.textContent === 'MAX'));
  });
  // the Economy tile pulses red only while that fix is affordable right now
  $('ecoBtn').classList.toggle('hot', !!key && !!best?.can);
}

/** 2.5 → '2.5', 3 → '3' (rounding to whole numbers hid real gains: '+3 → +3'). */
const dec1 = (v: number) => String(Math.round(v * 10) / 10);
/** Crew gear always says it's for the crew: 'Crew gear: Iron Picks' (never confused with your own pickaxe). */
export const gearLabel = (name: string) => `Crew gear: ${name.replace(/^Crew /, '')}`;
function updateBest(b: ReturnType<typeof bestNext>) {
  const el = $('bestCard') as HTMLButtonElement;
  if (S.build.done && !SITE.sold && !finaleRunning() && !S.flags.finished) { // a finished property beats any upgrade: the card says so
    el.hidden = false; el.disabled = false; el.classList.add('can');
    set(el, '.bi', '🏠'); set(el, '.bn', `Sell the ${PROJECTS[S.build.project].name}`); set(el, '.bs', 'your biggest payout · ready now'); set(el, '.bp', '+' + money(projectValue(S)));
    el.style.setProperty('--p', '1');
    el.onclick = sellNow;
    return;
  }
  el.hidden = !b;
  if (!b) return;
  set(el, '.bi', b.ic); set(el, '.bn', b.label); set(el, '.bs', b.note ? `${b.note} · best value now` : 'best value for your income right now'); set(el, '.bp', money(b.price));
  el.disabled = !b.can; el.classList.toggle('can', b.can);
  el.style.setProperty('--p', Math.min(1, S.cash / Math.max(1, b.price)).toFixed(3));
  el.onclick = () => { const x = bestNext(); if (x?.can) { x.buy(); updatePanel(); } };
}

export function updatePanel() {
  const best = bestNext();
  tagBottleneck(S.build.done && !SITE.sold ? null : best); // while a property waits to be sold, nothing competes with it
  updateBest(best);
  setText('depth', (S.depth < 100 ? S.depth.toFixed(1) : Math.floor(S.depth).toLocaleString('en-US')) + ' m');
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
    set(up, '.nm', nt.name);
    set(up, '.ds', locked ? `🔒 reach ${nt.unlockDepth} m` : `rubble ×${TOOLS[S.tool].yield} → ×${nt.yield}`);
    set(up, '.pr', money(nt.cost));
    afford(up, nt.cost);
  }
  const dig = document.querySelector<HTMLButtonElement>('[data-crew="dig"]')!;
  dig.hidden = !hasMoney;
  const room = crewRoom(S), full = S.crew.dig >= room;
  dig.disabled = full || S.cash < crewCost(S, 'dig') || expanding();
  dig.classList.toggle('held', full);
  dig.classList.toggle('done', full && !nextWorksite(S)); // the biggest room is full: nothing more to hire, ever
  set(dig, '.nm', S.crew.dig ? `Recruit Miner #${S.crew.dig + 1}` : 'Recruit a Miner');
  set(dig, '.ds', full ? (nextWorksite(S) ? `🔒 mine is full (${S.crew.dig}/${room}): expand the worksite` : `🔒 full crew (${room})`) : `one more pick swinging · ${S.crew.dig}/${room} room`);
  set(dig, '.pr', money(crewCost(S, 'dig')));
  afford(dig, crewCost(S, 'dig'));

  // player tool vs crew purchases sit under their own small headings (they were easy to mix up in one list)
  $('subTool').hidden = !hasMoney || up.hidden;
  $('subCrew').hidden = !hasMoney;
  const gb = $('gearBuy') as HTMLButtonElement, ng = nextGear(S), g0 = gearOf(S);
  gb.hidden = !hasMoney || S.crew.dig < 1 || !ng;
  if (ng) {
    const lockedG = S.depth < ng.unlockDepth;
    gb.disabled = lockedG || S.cash < ng.cost;
    set(gb, '.ic', ng.ic); set(gb, '.nm', gearLabel(ng.name));
    set(gb, '.ds', lockedG ? `🔒 reach ${ng.unlockDepth} m` : `crew gear · +${dec1(CFG.rubble.perBreak * g0.yield)} → +${dec1(CFG.rubble.perBreak * ng.yield)} rubble per break`);
    set(gb, '.pr', money(ng.cost)); afford(gb, ng.cost);
  }

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
    set(ex, '.ds', ready ? `blast a ${nw.name}` : `🔒 ${S.crew.dig}/${nw.unlockCrew} miners`);
    set(ex, '.pr', money(nw.cost));
    afford(ex, nw.cost);
  }
  // machines: each needs a worksite tier (room); the next one is shown locked once the previous is owned
  for (const m of CREW.filter((c) => c.machine)) {
    const b = document.querySelector<HTMLButtonElement>(`[data-crew="${m.id}"]`)!, owned = S.crew[m.id] >= m.max;
    const prevOwned = m.id === 'exc' ? S.crew.dig >= 1 : m.id === 'saw' ? S.crew.exc > 0 : S.crew.saw > 0;
    b.hidden = !hasMoney || !prevOwned;
    b.classList.toggle('done', owned);
    if (b.hidden) continue;
    b.disabled = owned || !crewAvailable(S, m.id) || S.cash < crewCost(S, m.id) || expanding();
    set(b, '.nm', owned ? `${m.name} (working)` : m.name);
    set(b, '.ds', S.worksite < m.needsTier ? `🔒 needs the ${WORKSITES[m.needsTier].name}` : `whole chunk every ${m.swingSecs}s · ×${m.yield} rubble`);
    set(b, '.pr', owned ? '✓' : money(crewCost(S, m.id)));
    afford(b, owned ? 0 : crewCost(S, m.id));
  }

  reveal('m-tr', $('g-tr'), S.flags.dispatched);
  setText('trStat', `Cart ${Math.floor(S.cart.load.qty)}/${cartCapacity(S)} ${CART_LABEL[S.cart.state]} · ${S.rubble.qty >= pileCap(S) - 1 ? 'PILE FULL' : 'pile ' + Math.floor(S.rubble.qty)}`);
  document.querySelectorAll<HTMLButtonElement>('#transport [data-upg]').forEach((b) => updRow(b, hasMoney));
  // track strength: the world already showed the strain; this confirms it with numbers
  const tk = trackDef(S), nt2 = nextTrack(S), over = trackOverloaded(), cap2 = cartCapacity(S);
  const shown = S.cart.load.qty > 0.5 ? S.cart.load.qty : cap2;
  setText('tkName', tk.name);
  setText('tkSafe', `${tk.safe}`);
  setText('tkCart', S.cart.load.qty > 0.5 ? `${Math.floor(S.cart.load.qty)}/${cap2}` : `${cap2}`);
  $('trackBox').classList.toggle('over', over);
  const warn = $('tkWarn');
  warn.hidden = !over;
  if (over) setText('tkWarn', `⚠ OVERLOADED  ${Math.floor(Math.max(shown, cap2))} / ${tk.safe} · transport −${Math.round(CFG.track.overloadPenalty * 100)}%`);
  const tb = $('tkBuy') as HTMLButtonElement;
  tb.hidden = !nt2 || !S.yard; // the contractor's advance is for the Recycling Yard: nothing else to spend it on first
  if (nt2) {
    tb.disabled = S.cash < nt2.cost || trackBusy();
    set(tb, '.nm', trackBusy() ? 'Reinforcing…' : over ? 'REINFORCE TRACK' : nt2.name);
    set(tb, '.ds', `safe load ${tk.safe} → ${nt2.safe}`);
    set(tb, '.pr', money(nt2.cost));
    afford(tb, nt2.cost);
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
  setText('yardHint', S.flags.sold ? 'The contractor bought a sample and advanced you the money for a Recycling Yard: it presses rubble into building blocks.' : 'The contractor is looking at your rubble…');
  const by = $('buildYard') as HTMLButtonElement;
  by.hidden = S.yard || !S.flags.sold;
  by.disabled = S.cash < Y.cost;
  set(by, '.nm', 'Build Recycling Yard');
  set(by, '.ds', 'rubble → building blocks');
  set(by, '.pr', money(Y.cost));
  afford(by, Y.cost);
  document.querySelectorAll<HTMLButtonElement>('#processing [data-upg]').forEach((b) => updRow(b, procRowVisible(b.dataset.upg as UpgradeId)));
  document.querySelectorAll<HTMLButtonElement>('#workers [data-upg]').forEach((b) => updRow(b, hasMoney && (S.crew.dig >= 1 || S.upg[b.dataset.upg as UpgradeId] > 0) && (b.dataset.upg !== 'crewStamina' || S.crew.dig >= 3)));
  reveal('y-log', $('g-log'), S.yard);
  setText('logStat', `Truck ${TRUCK_LABEL[S.truck.state]}`);
  setHTML('logInfo', `<span class="chip">🚚 <b>${truckCapacity(S)}</b>/trip</span><span class="chip">📦 <b>${fmt(S.stats.delivered)}</b> delivered</span><span class="chip">💰 block value <b>×${(unitValue(S.depth) * blockQualityMult(S)).toFixed(2)}</b></span>`);

  // ===== BUILD =====
  const pr = currentProject(), b = S.build;
  setText('projName', `#${S.stats.sold + 1} ${pr.name}`);
  setText('projValue', (b.done ? '' : '≈ ') + money(projectValue(S)));
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
  act.classList.toggle('sellnow', b.done); // the one decision on this site: it pulses until taken
  const sellLabel = `SELL PROPERTY · ${money(projectValue(S))}`;
  if (b.done && act.textContent !== sellLabel) act.textContent = sellLabel;
  setText('buildState', b.done ? '' : b.active ? `🏗 ${st.name} ${Math.floor(b.used + 1e-6)}/${st.blocks}${waitingForBlocks() ? ' · ' + supplyNote() : ''}`
    : canStartStage() ? `🏗 ${st.name} starting…` : `⏳ ${st.name} · ${supplyNote()}`);
  $('buildState').hidden = b.done;
  setHTML('buildInfo', b.done ? '' : `<span class="chip">🧱 site <b>${Math.floor(b.material.qty)}</b></span><span class="chip">🚚 <b>${Math.floor(S.truck.load.qty)}</b></span><span class="chip">🏭 <b>${Math.floor(S.goods.qty)}</b></span><span class="chip">stage pays <b>${money(stagePayment(S))}</b></span>` +
      (S.build.project === PROJECTS.length - 1 && S.stats.sold >= PROJECTS.length ? `<span class="chip">repeat ×${repeatFactor(S).toFixed(1)}</span>` : ''));
  // CONSTRUCTION CREW: revealed when blocks pile up faster than the builders lay them (an opportunity, never red)
  const crewU = UPGRADES.find((u) => u.id === 'crew')!;
  const cb = $('crewBuy') as HTMLButtonElement;
  $('g-crew').hidden = !(S.flags.crewSeen || S.upg.crew > 0);
  if (S.site === 'build' && S.flags.crewSeen) S.flags.crewAck = true;
  const crewMax = S.upg.crew >= crewU.maxLevel, crewPrice = upgCost(S, 'crew');
  const cGate = chainGate(S, 'crew'), cHeld = !crewMax && S.upg.crew >= cGate.cap;
  cb.disabled = crewMax || cHeld || S.cash < crewPrice;
  set(cb, '.nm', crewMax ? 'Construction Crew (full)' : `Hire builder #${builders(S) + 1}`);
  set(cb, '.ds', cHeld && cGate.blocker ? `🔒 first: ${upgDef(cGate.blocker).name} Lv ${S.upg.crew - CFG.chainSlack + 1}` : `${constructionRate(S).toFixed(1)} → ${(constructionRate(S) + CFG.build.perBuilder).toFixed(1)} blocks/s`);
  set(cb, '.pr', crewMax ? 'MAX' : money(crewPrice));
  afford(cb, crewMax ? 0 : crewPrice);
  setText('crewStat', `${constructionRate(S).toFixed(1)} blocks/s`);
  // crew status for the extraction header
  if (S.crew.dig) setText('extStat', `${S.crew.dig} crew${restingCount() ? ` · ${restingCount()} resting` : ''} · ${crewRubbleRate(S).toFixed(1)} rubble/s`);
}

function updRow(b: HTMLButtonElement, visible: boolean) {
  const id = b.dataset.upg as UpgradeId, u = UPGRADES.find((x) => x.id === id)!;
  b.hidden = !visible;
  if (!visible) return;
  const maxed = S.upg[id] >= u.maxLevel, cost = upgCost(S, id), gate = chainGate(S, id), held = !maxed && S.upg[id] >= gate.cap;
  b.disabled = maxed || held || S.cash < cost;
  b.classList.toggle('held', held);
  b.classList.toggle('done', maxed); // finished rows shrink to one slim line
  // a bigger cart is not pure upside: say when the next level's full load will exceed the track (still buyable)
  const capWarn = id === 'cartCap' && Math.round(CFG.cart.capacity.base * (1 + CFG.cart.capacity.perLevel * (S.upg.cartCap + 1))) > trackSafe(S);
  const now = upgStat(id);
  let next = '';
  if (!maxed) { S.upg[id]++; next = upgStat(id); S.upg[id]--; } // preview the next level with the same pure formulas
  set(b, '.lv', `Lv ${S.upg[id]}`);
  set(b, '.ef', maxed ? now : held && gate.blocker ? `🔒 first: ${upgDef(gate.blocker).name} Lv ${S.upg[id] - CFG.chainSlack + 1}` : `${now} → ${next}${capWarn ? ' ⚠ track' : ''}`);
  set(b, '.pr', maxed ? 'MAX' : money(cost));
  afford(b, maxed ? 0 : cost);
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
