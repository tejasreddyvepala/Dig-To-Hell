// ACHIEVEMENTS: 50 goals across the whole game, a full-screen trophy page (🏆 button, top-left) and an animated
// unlock banner. Stored in their own key (`dth_ach`) so they survive "Start over". Pure read of game state — never
// changes the economy.
import { FINDS, TOOLS } from './config';
import { S } from './state';
import { playCoin, playSting } from './audio';
import { saveState } from './state';
import { fmt, money } from './util';

type Cat = 'Depth' | 'Hands' | 'Crew' | 'Haulage' | 'Industry' | 'Construction' | 'Wealth' | 'Discovery';
interface Ach { id: string; cat: Cat; ic: string; name: string; desc: string; prog: () => [number, number] }

const n = (v: number, goal: number): [number, number] => [Math.min(v, goal), goal];
const flag = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const sold = () => S.stats.sold;

export const ACHS: Ach[] = [
  // ---- depth ----
  { id: 'd1', cat: 'Depth', ic: '🕳️', name: 'First Scratch', desc: 'Dig your first metre', prog: () => n(S.depth, 1) },
  { id: 'd10', cat: 'Depth', ic: '🥾', name: 'Ankle Deep', desc: 'Reach 10 m', prog: () => n(S.depth, 10) },
  { id: 'd50', cat: 'Depth', ic: '🔦', name: 'Lights On', desc: 'Reach 50 m', prog: () => n(S.depth, 50) },
  { id: 'd100', cat: 'Depth', ic: '💯', name: 'Century Shaft', desc: 'Reach 100 m', prog: () => n(S.depth, 100) },
  { id: 'd200', cat: 'Depth', ic: '🦇', name: 'Into the Caves', desc: 'Reach 200 m', prog: () => n(S.depth, 200) },
  { id: 'd300', cat: 'Depth', ic: '🪙', name: 'Silver Lining', desc: 'Reach the Silver Vein (270 m)', prog: () => n(S.depth, 270) },
  { id: 'd410', cat: 'Depth', ic: '🥇', name: 'Gold Rush', desc: 'Reach the Gold Seam (410 m)', prog: () => n(S.depth, 410) },
  { id: 'd620', cat: 'Depth', ic: '💎', name: 'Diamonds Are Forever', desc: 'Reach the Diamond Pipe (620 m)', prog: () => n(S.depth, 620) },
  { id: 'd700', cat: 'Depth', ic: '🌈', name: 'Over the Rainbow', desc: 'Reach the Prismatic Opal (700 m)', prog: () => n(S.depth, 700) },
  { id: 'd860', cat: 'Depth', ic: '🌋', name: 'Feel the Heat', desc: 'Reach the Magma Rock (860 m)', prog: () => n(S.depth, 860) },
  { id: 'hell', cat: 'Depth', ic: '😈', name: 'Dig to Hell', desc: 'Reach the Gates of Hell (1,000 m)', prog: () => n(S.depth, 1000) },
  // ---- the player's own hands ----
  { id: 'c100', cat: 'Hands', ic: '✋', name: 'Callused Hands', desc: 'Strike the rock 100 times', prog: () => n(S.clicks, 100) },
  { id: 'c1k', cat: 'Hands', ic: '⛏️', name: 'Pick Whisperer', desc: 'Strike the rock 1,000 times', prog: () => n(S.clicks, 1000) },
  { id: 'c5k', cat: 'Hands', ic: '💪', name: 'Rock Breaker', desc: 'Strike the rock 5,000 times', prog: () => n(S.clicks, 5000) },

  { id: 't1', cat: 'Hands', ic: '⛏️', name: 'Iron Will', desc: `Buy the ${TOOLS[1].name}`, prog: () => n(S.tool, 1) },
  { id: 't2', cat: 'Hands', ic: '⚒️', name: 'Heavy Hitter', desc: `Buy the ${TOOLS[2].name}`, prog: () => n(S.tool, 2) },
  { id: 't3', cat: 'Hands', ic: '🔨', name: 'Rattle and Roll', desc: `Buy the ${TOOLS[3].name}`, prog: () => n(S.tool, 3) },
  { id: 't4', cat: 'Hands', ic: '💎', name: 'Diamond Hands', desc: `Buy the ${TOOLS[4].name}`, prog: () => n(S.tool, 4) },
  { id: 't5', cat: 'Hands', ic: '🔥', name: 'Forged in Fire', desc: `Buy the ${TOOLS[5].name}`, prog: () => n(S.tool, 5) },
  // ---- crew ----
  { id: 'h1', cat: 'Crew', ic: '👷', name: 'Not Alone', desc: 'Recruit your first miner', prog: () => n(S.crew.dig, 1) },
  { id: 'h5', cat: 'Crew', ic: '👥', name: 'Shift Crew', desc: 'Run a crew of 5 miners', prog: () => n(S.crew.dig, 5) },

  { id: 'ws', cat: 'Crew', ic: '💥', name: 'Fire in the Hole', desc: 'Blast out the Work Chamber', prog: () => n(S.worksite, 1) },
  { id: 'exc', cat: 'Crew', ic: '🚜', name: 'Heavy Metal', desc: 'Lower an Excavator into the mine', prog: () => n(S.crew.exc, 1) },
  { id: 'saw', cat: 'Crew', ic: '💠', name: 'Cutting Edge', desc: 'Run a Diamond Saw Rig', prog: () => n(S.crew.saw, 1) },
  { id: 'borer', cat: 'Crew', ic: '🔩', name: 'Drill, Baby, Drill', desc: 'Run the Deep Drill Rig', prog: () => n(S.crew.borer, 1) },
  { id: 'hall', cat: 'Crew', ic: '🏛️', name: 'Great Hall', desc: 'Expand to the Great Hall', prog: () => n(S.worksite, 2) },
  // ---- haulage ----
  { id: 'cart', cat: 'Haulage', ic: '🛒', name: 'Special Delivery', desc: 'Send your first cart to the surface', prog: () => flag(S.flags.arrived) },

  { id: 'rail1', cat: 'Haulage', ic: '🛤️', name: 'Hold Together', desc: 'Reinforce the track', prog: () => n(S.upg.rail, 1) },
  { id: 'rail3', cat: 'Haulage', ic: '🚂', name: 'Man of Steel', desc: 'Lay Steel Rail', prog: () => n(S.upg.rail, 3) },
  // ---- industry ----
  { id: 'yard', cat: 'Industry', ic: '🏭', name: 'Open for Business', desc: 'Build the Recycling Yard', prog: () => flag(S.yard) },

  { id: 'p1k', cat: 'Industry', ic: '🏗️', name: 'Production Line', desc: 'Process 1,000 units', prog: () => n(S.stats.processed, 1000) },
  { id: 'p10k', cat: 'Industry', ic: '🌆', name: 'Heavy Industry', desc: 'Process 10,000 units', prog: () => n(S.stats.processed, 10000) },
  { id: 'q5', cat: 'Industry', ic: '💎', name: 'Quality Control', desc: 'Block Quality level 5', prog: () => n(S.upg.contractValue, 5) },
  { id: 'st5', cat: 'Industry', ic: '🛢️', name: 'Silo Skyline', desc: 'Raw Storage level 5', prog: () => n(S.upg.rawStorage, 5) },
  { id: 'dl1k', cat: 'Industry', ic: '🛣️', name: 'Trucker', desc: 'Deliver 1,000 blocks', prog: () => n(S.stats.delivered, 1000) },
  { id: 'dl10k', cat: 'Industry', ic: '🏁', name: 'Logistics Empire', desc: 'Deliver 10,000 blocks', prog: () => n(S.stats.delivered, 10000) },
  // ---- construction ----
  { id: 's1', cat: 'Construction', ic: '🛖', name: 'Home Sweet Hut', desc: 'Sell your first property', prog: () => n(sold(), 1) },
  { id: 's3', cat: 'Construction', ic: '🏠', name: 'Realtor', desc: 'Sell 3 properties', prog: () => n(sold(), 3) },
  { id: 's5', cat: 'Construction', ic: '🏡', name: 'Developer', desc: 'Sell 5 properties', prog: () => n(sold(), 5) },
  { id: 'apt', cat: 'Construction', ic: '🏗️', name: 'Crane Season', desc: 'Start the Apartment Block', prog: () => n(S.build.project, 5) },
  { id: 'off', cat: 'Construction', ic: '🏙️', name: 'Skyline', desc: 'Start the Skyscraper', prog: () => n(S.build.project, 9) },
  { id: 'wh', cat: 'Construction', ic: '🏛️', name: 'Mr. President', desc: 'Sell The White House', prog: () => n(sold(), 9) },

  { id: 'cr10', cat: 'Construction', ic: '🦾', name: 'Building Machine', desc: 'Construction Crew level 10', prog: () => n(S.upg.crew, 10) },
  // ---- wealth ----
  { id: 'e1k', cat: 'Wealth', ic: '💵', name: 'Payday', desc: 'Earn $1,000 in total', prog: () => n(S.stats.earned, 1000) },
  { id: 'e10k', cat: 'Wealth', ic: '💰', name: 'Comfortable', desc: 'Earn $10,000 in total', prog: () => n(S.stats.earned, 1e4) },
  { id: 'e100k', cat: 'Wealth', ic: '🤑', name: 'Tycoon', desc: 'Earn $100,000 in total', prog: () => n(S.stats.earned, 1e5) },
  { id: 'e1m', cat: 'Wealth', ic: '👑', name: 'Mining Magnate', desc: 'Earn $1,000,000 in total', prog: () => n(S.stats.earned, 1e6) },
  // ---- discovery ----
  { id: 'f1', cat: 'Discovery', ic: '🪙', name: 'Finders Keepers', desc: 'Dig up your first find', prog: () => n(S.found, 1) },
  { id: 'fall', cat: 'Discovery', ic: '🧭', name: 'Treasure Hunter', desc: 'Dig up every find', prog: () => n(S.found, FINDS.length) },
  { id: 'palace', cat: 'Construction', ic: '🏰', name: 'Prince of Darkness', desc: 'Sell the Obsidian Palace', prog: () => n(sold(), 12) },
];
const CAT_IC: Record<Cat, string> = { Depth: '🕳️', Hands: '⛏️', Crew: '👷', Haulage: '🛒', Industry: '🏭', Construction: '🏗️', Wealth: '💰', Discovery: '🧭' };
type Tier = 'bronze' | 'silver' | 'gold';
/** Difficulty tier from the goal's place in its category (first third bronze, last third gold). */
const TIER: Record<string, Tier> = {};
for (const c of new Set(ACHS.map((a) => a.cat))) {
  const list = ACHS.filter((a) => a.cat === c);
  list.forEach((a, i) => { const k = list.length > 1 ? i / (list.length - 1) : 1; TIER[a.id] = k < 0.34 ? 'bronze' : k < 0.67 ? 'silver' : 'gold'; });
}

// ---- cash rewards: about a minute of income at the moment a typical player gets there (minute estimates from the
// 60-min pacing run), rounded to 2 significant figures ----
const MIN: Record<string, number> = {
  d1: 0.5, d10: 1.5, d50: 5, d100: 9.5, d200: 14, d300: 17, d410: 23, d620: 34, d700: 40, d860: 50, hell: 58,
  c100: 3, c1k: 15, c5k: 40, t1: 4, t2: 7, t3: 9, t4: 20, t5: 42, h1: 5, h5: 9, ws: 6, exc: 12, saw: 25, borer: 40, hall: 19,
  cart: 1, rail1: 7, rail3: 25, yard: 1.3, p1k: 12, p10k: 30, q5: 30, st5: 25, dl1k: 15, dl10k: 35,
  s1: 3.5, s3: 9, s5: 16, apt: 25, off: 42, wh: 40, cr10: 45, palace: 65, e1k: 5, e10k: 13, e100k: 22, e1m: 38, f1: 1, fall: 55,
};
const nice = (v: number) => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.round(v / p) * p; };
export const rewardOf = (id: string) => nice(150 * Math.pow(1.15, MIN[id] ?? 10) * (TIER[id] === 'gold' ? 1.5 : 1));

// ---- persistence (separate key: achievements are forever) ----
const KEY = 'dth_ach';
let got: Record<string, number> = {}, seen = 0, claimed: Record<string, boolean> = {};
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { got = o.got ?? {}; seen = o.seen ?? 0; claimed = o.claimed ?? {}; } } catch { /* session only */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ got, seen, claimed })); } catch { /* ignore */ } };
const claimable = () => ACHS.filter((a) => got[a.id] && !claimed[a.id]);
/** Pay out an unlocked achievement's reward (once, ever). */
function claim(id: string, x?: number, y?: number) {
  if (!got[id] || claimed[id]) return;
  claimed[id] = true; S.cash += rewardOf(id); persist(); playCoin(); saveState();
  if (x !== undefined && y !== undefined) burst(x, y, money(rewardOf(id)));
}
function burst(x: number, y: number, txt: string) { // coin text flying up from the button
  const el = document.createElement('div'); el.className = 'claimfly'; el.textContent = '+' + txt;
  el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
}
const count = () => ACHS.filter((a) => got[a.id]).length;

// ---- DOM ----
const $ = (id: string) => document.getElementById(id)!;
let built = false, filter: Cat | 'All' = 'All';
function build() {
  if (built) return; built = true;
  $('achBtn').onclick = () => openPage();
  $('achClose').onclick = closePage;
  $('achPage').addEventListener('click', (e) => { if (e.target === $('achPage')) closePage(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('achPage').hidden) closePage(); });
  $('achGrid').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-claim]'); if (!b) return;
    const r = b.getBoundingClientRect(); claim(b.dataset.claim!, r.left + r.width / 2, r.top); renderGrid(); updateBadge();
  });
  $('achClaimAll').onclick = (e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); let tot = 0; for (const a of claimable()) { tot += rewardOf(a.id); claim(a.id); } if (tot) burst(r.left + r.width / 2, r.top, money(tot)); renderGrid(); updateBadge(); };
  $('achTabs').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.achcat'); if (!b) return;
    filter = b.dataset.cat as Cat | 'All'; renderGrid();
  });
}

const medal = (a: Ach, on: boolean) => `<span class="shield ${on ? TIER[a.id] : 'off'}"><span>${a.ic}</span></span>`;
function renderGrid() {
  const cats = ['All', ...new Set(ACHS.map((a) => a.cat))] as (Cat | 'All')[];
  $('achTabs').innerHTML = cats.map((c) => {
    const list = ACHS.filter((a) => c === 'All' || a.cat === c), done = list.filter((a) => got[a.id]).length;
    return `<button class="achcat${c === filter ? ' on' : ''}${done === list.length ? ' full' : ''}" data-cat="${c}"><span class="ci">${c === 'All' ? '🏆' : CAT_IC[c]}</span><span class="cn">${c}</span><span class="cc">${done}/${list.length}</span></button>`;
  }).join('');
  // order: ready to claim → in progress (closest first) → claimed
  const rank = (a: Ach) => (got[a.id] && !claimed[a.id] ? 0 : got[a.id] ? 2 : 1);
  const list = ACHS.filter((a) => filter === 'All' || a.cat === filter)
    .sort((x, y) => rank(x) - rank(y) || (rank(x) === 1 ? y.prog()[0] / y.prog()[1] - x.prog()[0] / x.prog()[1] : 0));
  $('achGrid').innerHTML = list.map((a, i) => {
    const [cur, goal] = a.prog(), t = got[a.id], c = claimed[a.id], p = t ? 1 : cur / goal, isNew = !!t && t > seen;
    const val = a.cat === 'Wealth' ? `${money(cur)} / ${money(goal)}` : goal > 1 ? `${fmt(Math.floor(cur))} / ${fmt(goal)}` : `0 / 1`;
    const foot = c ? `<span class="aclaimed">✓ Claimed ${money(rewardOf(a.id))}</span>`
      : t ? `<button class="aclaim" data-claim="${a.id}">CLAIM ${money(rewardOf(a.id))}</button>`
        : `<span class="apbar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="apval">${val}</span><span class="arew">reward ${money(rewardOf(a.id))}</span>`;
    return `<div class="acard ${t ? 'got ' + TIER[a.id] : 'locked'}${t && !c ? ' ready' : ''}${isNew ? ' new' : ''}" style="--d:${Math.min(0.5, i * 0.015).toFixed(3)}s">
      ${isNew && !c ? '<em class="newtag">NEW</em>' : ''}${medal(a, !!t)}<b class="aname">${a.name}</b><span class="adesc">${a.desc}</span><div class="afoot">${foot}</div></div>`;
  }).join('');
  const n = claimable().length, tot = claimable().reduce((s2, a) => s2 + rewardOf(a.id), 0);
  $('achClaimAll').hidden = n < 2; $('achClaimAll').textContent = `CLAIM ALL ${money(tot)}`;
  const c = count();
  $('achCount').textContent = `${c} of ${ACHS.length} unlocked`;
  ($('achRing') as HTMLElement).style.setProperty('--p', String(c / ACHS.length));
  const tiers = (['gold', 'silver', 'bronze'] as Tier[]).map((tr) => `<span class="tierc ${tr}">${ACHS.filter((a) => got[a.id] && TIER[a.id] === tr).length}</span>`).join('');
  $('achTiers').innerHTML = tiers;
}

function openPage() {
  renderGrid();
  const pg = $('achPage');
  pg.hidden = false; pg.classList.remove('out'); void pg.offsetWidth; pg.classList.add('in');
  $('achGrid').scrollTop = 0;
  seen = Date.now(); persist(); updateBadge();
}
function closePage() {
  const pg = $('achPage');
  pg.classList.remove('in'); pg.classList.add('out');
  setTimeout(() => { if (pg.classList.contains('out')) pg.hidden = true; }, 260);
}
function updateBadge() {
  const fresh = claimable().length; // rewards waiting to be claimed
  const b = $('achBadge'); b.textContent = String(fresh); b.hidden = fresh === 0;
}

// ---- unlock banner queue ----
// At most one banner per BANNER_GAP: unlocks that arrive together share one banner ("+2 more trophies"), so the
// first session isn't a constant stream of banners and stings.
const queue: Ach[] = [];
let showing = false, lastEnd = -1e9;
const BANNER_GAP = 10_000;
const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2 };
function showNext() {
  if (!queue.length) { showing = false; return; }
  const batch = queue.splice(0, queue.length).sort((x, y) => (TIER_RANK[TIER[y.id]] ?? 0) - (TIER_RANK[TIER[x.id]] ?? 0));
  const a = batch[0], more = batch.length - 1;
  showing = true;
  const el = document.createElement('div');
  el.className = 'achpop';
  el.classList.add(TIER[a.id]);
  el.innerHTML = `<span class="popmedal">${medal(a, true)}${Array.from({ length: 10 }, (_, i) => `<i class="spark" style="--a:${(i * 36).toFixed(0)}deg;--dl:${(0.25 + (i % 3) * 0.05).toFixed(2)}s"></i>`).join('')}</span>` +
    `<span class="poptx"><span class="popk">Achievement unlocked · ${TIER[a.id]}</span><b>${a.name}</b><span>${more ? `+${more} more ${more === 1 ? 'trophy' : 'trophies'} · rewards ${money(batch.reduce((t, x) => t + rewardOf(x.id), 0))}` : `Reward ${money(rewardOf(a.id))}`} · tap to claim</span></span>`;
  el.onclick = () => { openPage(); };
  $('achPops').appendChild(el);
  playSting();
  ($('achBtn')).classList.remove('bump'); void ($('achBtn')).offsetWidth; $('achBtn').classList.add('bump');
  setTimeout(() => el.classList.add('out'), 3400);
  setTimeout(() => { el.remove(); showing = false; lastEnd = performance.now(); }, 3800);
}

/** Check every goal (call a few times a second). The first call after boot unlocks silently what a save already met. */
let booted = false;
export function checkAchievements() {
  build();
  let changed = false;
  for (const a of ACHS) {
    if (got[a.id]) continue;
    const [cur, goal] = a.prog();
    if (cur >= goal) { got[a.id] = Date.now(); changed = true; if (booted) queue.push(a); else seen = Math.max(seen, got[a.id]); }
  }
  booted = true;
  if (changed) { persist(); updateBadge(); if (!$('achPage').hidden) renderGrid(); }
  if (queue.length && !showing && performance.now() - lastEnd >= BANNER_GAP) showNext();
}
export function initAchievements() { build(); updateBadge(); renderGrid(); }
