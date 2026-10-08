// ECONOMY PAGE: every money-making link of the operation in one place, connected left → right
//   DIG (crew) → HAUL (cart) → YARD (crusher + press) → TRUCK → BUILD (builders) → $
// Each link shows its live throughput (units/s), a bar on one shared scale, and its upgrades (buy right here). The
// slowest link is the BOTTLENECK (red): money can only flow as fast as it. Income per minute on top.
// Rates are the same pure formulas the game runs on (economy.ts). Presentation + purchases only.
import { CFG, CREW, UPGRADES, type UpgradeId } from './config';
import { S } from './state';
import {
  cartCapacity, chainGate, crewAvailable, nextGear, CHAIN, nextWorksite, worksiteAvailable, constructionRate, crewCost, crewRubbleRate, loadRate, operationLevel, processRate, projectBlocks,
  projectValue, trackGrace, trackSafe, travelTime, truckCapacity, truckLoadRate, truckUnloadRate, upgCost, nextTrack, chainVisible,
} from './economy';
import { buyGear, buyUpgrade, hire } from './panel';
import { buyTrack, trackBusy } from './track';
import { buyExpansion, expanding } from './expansion';
import { playPurchase } from './audio';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;

/** Live throughput of each link (units or blocks per second) + $ per block + $ per minute. */
export function flowRates() {
  const C = CFG.cart, T = CFG.yard.truck;
  const cap = cartCapacity(S), over = cap > trackSafe(S) && !trackGrace(S) ? 1 / (1 - CFG.track.overloadPenalty) : 1;
  const trip = 2 * travelTime(S, S.depth) * over + cap / loadRate(S) + C.readySecs + C.arriveSecs + C.unloadSecs;
  const tcap = truckCapacity(S), ttrip = 2 * T.driveSecs + tcap / truckLoadRate(S) + tcap / truckUnloadRate(S) + T.minLoadSecs;
  const pb = projectValue(S) * (1 + CFG.build.milestoneShare) / projectBlocks(S.build.project);
  const r = { dig: crewRubbleRate(S), cart: cap / trip, yard: S.yard ? processRate(S) : 0, truck: S.yard ? tcap / ttrip : 0, build: constructionRate(S), perBlock: pb, perMin: 0, slow: 'dig' as Link };
  const links: Link[] = ['dig', 'cart', 'yard', 'truck', 'build'];
  r.slow = links.reduce((a, b) => (r[b] < r[a] ? b : a));
  r.perMin = r[r.slow] * pb * 60;
  return r;
}
type Link = 'dig' | 'cart' | 'yard' | 'truck' | 'build';

// ---- DOM ----
interface Btn { label: string; lv: string; price: number; can: boolean; held: string; buy: () => void; note?: string }
const NODES: { id: Link; ic: string; name: string; unit: string }[] = [
  { id: 'dig', ic: '⛏️', name: 'Dig', unit: 'rubble/s' },
  { id: 'cart', ic: '🛒', name: 'Haul', unit: 'units/s' },
  { id: 'yard', ic: '♻️', name: 'Yard', unit: 'blocks/s' },
  { id: 'truck', ic: '🚚', name: 'Truck', unit: 'blocks/s' },
  { id: 'build', ic: '🏗️', name: 'Build', unit: 'blocks/s' },
];
function upgBtn(id: UpgradeId): Btn | null {
  const u = UPGRADES.find((x) => x.id === id)!;
  if (!chainVisible(S, id)) return null;
  const maxed = S.upg[id] >= u.maxLevel, g = chainGate(S, id), held = !maxed && S.upg[id] >= g.cap;
  return { label: u.name, lv: maxed ? 'MAX' : `Lv ${S.upg[id]}`, price: maxed ? 0 : upgCost(S, id), can: !maxed && !held && S.cash >= upgCost(S, id), held: held && g.blocker ? `needs ${UPGRADES.find((x) => x.id === g.blocker)!.name}` : '', buy: () => buyUpgrade(id) };
}
function buttonsFor(l: Link): Btn[] {
  const out: (Btn | null)[] = [];
  if (l === 'dig') {
    const c = CREW[0];
    if (S.yard) out.push({ label: 'Recruit Miner', lv: `${S.crew.dig}`, price: crewCost(S, 'dig'), can: S.cash >= crewCost(S, 'dig') && !expanding() && crewAvailable(S, 'dig'), held: crewAvailable(S, 'dig') ? '' : 'needs more room', buy: () => hire(c.id) });
    const ng = nextGear(S);
    if (ng && S.crew.dig > 0) out.push({ label: ng.name, lv: 'gear', price: ng.cost, can: S.cash >= ng.cost && S.depth >= ng.unlockDepth, held: S.depth < ng.unlockDepth ? `reach ${ng.unlockDepth} m` : '', buy: () => { buyGear(); } });
    out.push(upgBtn('crewTools'), upgBtn('crewStamina'));
  }
  if (l === 'cart') {
    out.push(upgBtn('cartCap'), upgBtn('cartSpeed'), upgBtn('loadSpeed'));
    const nt = nextTrack(S);
    if (nt && S.flags.dispatched) out.push({ label: nt.name, lv: 'track', price: nt.cost, can: S.cash >= nt.cost && !trackBusy(), held: '', buy: () => { if (buyTrack()) playPurchase(); } });
  }
  if (l === 'yard') out.push(upgBtn('processSpeed'), upgBtn('rawStorage'), upgBtn('contractValue'));
  if (l === 'truck' || l === 'build') out.push(upgBtn('crew'));
  return out.filter((b): b is Btn => !!b);
}

let built = false, actions: (() => void)[] = [];
function build() {
  if (built) return; built = true;
  $('ecoBtn').onclick = open;
  $('ecoClose').onclick = close;
  $('ecoPage').addEventListener('click', (e) => {
    if (e.target === $('ecoPage')) { close(); return; }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]');
    if (b && !b.disabled) { actions[+b.dataset.a!]?.(); render(); }
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ecoPage').hidden) close(); });
}
function open() { render(); const p = $('ecoPage'); p.hidden = false; p.classList.remove('out'); void p.offsetWidth; p.classList.add('in'); }
function close() { const p = $('ecoPage'); p.classList.remove('in'); p.classList.add('out'); setTimeout(() => { if (p.classList.contains('out')) p.hidden = true; }, 220); }

/** NEXT BEST: of everything you could buy, the purchase that adds the most income per dollar right now — measured
 *  by applying it to the state, re-running the same flow formulas, and undoing it. Covers the chain upgrades, a new
 *  miner, the machines, the track and the worksite expansion (valued by what the bigger room lets you add next).
 *  `can` = affordable now. Used by the panel's top card. */
export function bestNext(): (Btn & { ic: string; link: string; key: string }) | null {
  if (!S.yard) return null;
  // value = income now + a share of how much the WHOLE operation grows (geometric mean of the five stations), so an
  // upgrade to a station that isn't the bottleneck yet still counts (it is the next one) and gear/tools aren't ignored
  const value = () => { const r = flowRates(); const gm = Math.pow(Math.max(1e-6, r.dig * r.cart * r.yard * r.truck * r.build), 0.2); return r.perMin + 0.35 * gm * r.perBlock * 60; };
  const base = value();
  const gain = (apply: () => void, undo: () => void) => { apply(); const v = value(); undo(); return v - base; };
  type C = { b: Btn; ic: string; link: string; score: number; key: string }; // key = the panel button (data-upg / data-crew / id)
  const cands: C[] = [];
  const add = (key: string, b: Btn | null, ic: string, link: string, g: number, price = b?.price ?? 0) => { if (b && !b.held && price > 0 && g > 0) cands.push({ b, ic, link, score: g / price, key }); };
  for (const id of CHAIN) {
    const u = upgBtn(id); if (!u || !u.price) continue;
    const g = gain(() => S.upg[id]++, () => S.upg[id]--);
    if (!u.held) { add(id, u, UPGRADES.find((x) => x.id === id)!.ic, u.label, g); continue; }
    // held by the chain: the upgrade that unlocks it carries its value (raise the weak link first)
    const bl = chainGate(S, id).blocker, bu = bl ? upgBtn(bl) : null;
    if (bl && bu && !bu.held && bu.price) add(bl, { ...bu, note: `unlocks ${u.label}` }, UPGRADES.find((x) => x.id === bl)!.ic, bu.label, g + gain(() => S.upg[bl]++, () => S.upg[bl]--), bu.price + u.price);
  }
  if (crewAvailable(S, 'dig')) add('dig', { label: 'Recruit Miner', lv: '', price: crewCost(S, 'dig'), can: S.cash >= crewCost(S, 'dig') && !expanding(), held: '', buy: () => hire('dig') }, '👷', 'Dig', gain(() => S.crew.dig++, () => S.crew.dig--));
  for (const m of CREW.filter((c) => c.machine)) {
    if (!crewAvailable(S, m.id)) continue;
    add(m.id, { label: m.name, lv: '', price: crewCost(S, m.id), can: S.cash >= crewCost(S, m.id) && !expanding(), held: '', buy: () => hire(m.id) }, m.ic, 'Dig', gain(() => S.crew[m.id]++, () => S.crew[m.id]--));
  }
  const ng = nextGear(S);
  if (ng && S.depth >= ng.unlockDepth && S.crew.dig > 0) add('gearBuy', { label: `Crew gear: ${ng.name.replace(/^Crew /, '')}`, lv: '', price: ng.cost, can: S.cash >= ng.cost, held: '', buy: () => buyGear() }, ng.ic, 'Dig', gain(() => S.crewGear++, () => S.crewGear--));
  const nt = nextTrack(S);
  if (nt) add('tkBuy', { label: nt.name, lv: '', price: nt.cost, can: S.cash >= nt.cost && !trackBusy(), held: '', buy: () => { if (buyTrack()) playPurchase(); } }, '🛤️', 'Haul', gain(() => S.upg.rail++, () => S.upg.rail--));
  const nw = nextWorksite(S);
  if (nw && worksiteAvailable(S)) { // value the room by the best thing it unlocks: its machine, or more miners
    const mach = CREW.find((c) => c.machine && c.needsTier === S.worksite + 1);
    const g = gain(() => { S.worksite++; if (mach) S.crew[mach.id]++; else S.crew.dig += 4; }, () => { S.worksite--; if (mach) S.crew[mach.id]--; else S.crew.dig -= 4; });
    add('expand', { label: `Expand to ${nw.name}`, lv: '', price: nw.cost, can: S.cash >= nw.cost && !expanding(), held: '', buy: () => { if (buyExpansion()) playPurchase(); } }, '💥', 'Dig', g, nw.cost + (mach ? crewCost(S, mach.id) : 4 * crewCost(S, 'dig')));
  }
  if (!cands.length) return null;
  // the best value; but if it's far off (more than ~2× your cash), prefer the best affordable one so the card keeps moving
  // one entry per actual purchase: a blocker that unlocks several things keeps its best score
  const byBuy = new Map<string, C>();
  for (const c of cands) { const key = c.key; const o = byBuy.get(key); if (!o || c.score > o.score) byBuy.set(key, c); }
  cands.length = 0; cands.push(...byBuy.values());
  cands.sort((x, y) => y.score - x.score);
  if (import.meta.env.DEV) (window as any).__best = cands.slice(0, 8).map((c) => `${c.b.label} $${Math.round(c.b.price)} score ${(c.score * 1000).toFixed(3)}`);
  const top = cands[0], aff = cands.find((c) => c.b.can);
  const pick = !top.b.can && aff && top.b.price > S.cash * 2 + 1 ? aff : top;
  return { ...pick.b, ic: pick.ic, link: pick.link, key: pick.key };
}

/** The one upgrade a station offers: the cheapest you can buy now, else the cheapest still to save for. */
function bestFor(l: Link): Btn | null {
  const list = buttonsFor(l);
  const can = list.filter((x) => x.can).sort((x, y) => x.price - y.price)[0];
  return can ?? list.filter((x) => !x.held && x.price > 0).sort((x, y) => x.price - y.price)[0] ?? list[0] ?? null;
}

function render() {
  const r = flowRates(), max = Math.max(0.01, r.dig, r.cart, r.yard, r.truck, r.build);
  actions = [];
  $('ecoIncome').textContent = money(r.perMin) + ' / min';
  $('ecoLevel').textContent = `Operation Level ${operationLevel(S)}`;
  const st = NODES.map((n, i) => {
    const v = r[n.id], slow = n.id === r.slow, b = bestFor(n.id);
    let btn = '';
    if (b) { actions.push(b.buy); btn = `<button class="sbtn${slow ? ' big' : ''}${b.can ? ' can' : ''}" data-a="${actions.length - 1}" ${b.can ? '' : 'disabled'} title="${b.label}">${b.held ? '🔒 ' + b.held.replace('needs ', '') + ' first' : '▲ ' + (slow ? b.label + ' ' : '') + money(b.price)}</button>`; }
    const pipe = i ? `<div class="pipe${slow ? ' hot' : ''}"><i style="animation-duration:${(2.4 - 1.8 * Math.min(1, r[NODES[i - 1].id] / max)).toFixed(2)}s"></i></div>` : '';
    return `${pipe}<div class="station${slow ? ' slow' : ''}">${slow ? '<em class="ribbon">TOO SLOW!</em>' : ''}
      <div class="sbadge">${n.ic}</div><b class="sname">${n.name}</b>
      <div class="sspeed">${v >= 10 ? fmt(v) : v.toFixed(1)}<small>/s</small></div>
      <div class="sgauge"><i style="width:${Math.max(4, (v / max) * 100).toFixed(1)}%"></i></div>${btn}</div>`;
  }).join('');
  $('ecoFlow').innerHTML = st + `<div class="pipe gold"><i></i></div><div class="station money"><div class="sbadge">💰</div><b class="sname">Money</b><div class="sspeed">${money(r.perMin)}<small>/min</small></div><div class="ssub">${money(r.perBlock)} per block</div></div>`;
  $('ecoTip').innerHTML = `Everything moves at the speed of the <b>slowest station</b>. Upgrade the red one to earn more.`;
}

/** Per-frame hook: income sampling + live refresh while the page is open. */
export function updateEconomy(_now: number) {
  build();
  if (!$('ecoPage').hidden) render();
}
