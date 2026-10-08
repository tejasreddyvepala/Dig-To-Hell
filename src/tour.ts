// GUIDED TOUR: a skippable, replayable walkthrough of the whole game. A dim overlay with a spotlight on one element at
// a time and a speech bubble (Back / Next / Skip). Offered once when the Recycling Yard is built (the full UI exists);
// replay any time from the "Guide" tile or the Help card. Never changes the game state (it only moves the camera).
import { track } from './analytics';
import { S, type Site } from './state';
import { navigate } from './nav';
import { siteUnlocked } from './nav';

interface Step { title: string; text: string; target?: string; area?: () => DOMRect | null; site?: Site; need?: () => boolean }
const $ = (id: string) => document.getElementById(id)!;
const canvasArea = (fx: number, fy: number, fw: number, fh: number) => () => {
  const r = ($('c') as HTMLCanvasElement).getBoundingClientRect();
  return new DOMRect(r.left + r.width * fx, r.top + r.height * fy, r.width * fw, r.height * fh);
};

const STEPS: Step[] = [
  { title: 'Welcome to Dig to Hell', text: 'Dig a mine, turn the rubble into building blocks, build houses, sell them, and grow until you reach the Gates of Hell at 1,000 m. This tour takes about a minute.' },
  { title: 'Dig', site: 'mine', area: canvasArea(0.18, 0.55, 0.6, 0.3), text: 'Click the rock to dig. Every chunk you break becomes rubble, and every layer deeper is worth more: silver, gold, rubies, diamonds…' },
  { title: 'Digging speed', site: 'mine', area: canvasArea(0, 0.09, 0.2, 0.1), text: 'How fast your whole operation digs: you, every miner and every machine together.' },
  { title: 'Your money', target: '#panel .top', text: 'Digging never pays by itself. Money comes from selling the buildings your blocks become (and from trophy rewards).' },
  { title: 'Next Best Upgrade', target: '#bestCard', need: () => !$('bestCard').hidden, text: 'Not sure what to buy? This card always shows the purchase that raises your income the most. Gold = you can afford it, one tap buys it.' },
  { title: 'Miners and tools', site: 'mine', target: '.acc[data-acc="m-ext"]', text: 'Recruit miners, give them better tools and stamina. Each worksite has room for a limited crew: expand the mine to fit more (and machines).' },
  { title: 'The cart', site: 'mine', target: '#g-tr', need: () => !$('g-tr').hidden, text: 'The cart hauls rubble to the surface. Bigger, faster carts and stronger track keep up as you dig deeper.' },
  { title: 'Recycling Yard', site: 'yard', target: '#p-yard', need: () => siteUnlocked('yard'), text: 'Rubble is crushed and pressed into building blocks here. Faster processing, more storage and better block quality all mean more money.' },
  { title: 'Build and sell', site: 'build', target: '#p-build', need: () => siteUnlocked('build'), text: 'The truck brings blocks to the plot. Every finished stage pays, and selling the finished building pays the most. Then build something bigger: from a hut to a palace.' },
  { title: 'Bottlenecks', target: '#ecoBtn', text: 'Your money can only flow as fast as the slowest part of the operation. The Economy page shows it in red, and its upgrades pulse red on the panel: fix that one first.' },
  { title: 'Keep it level', target: '#panel .scroll', text: 'Upgrades grow together: none can get more than 2 levels ahead of your weakest one. A locked upgrade tells you what to raise first.' },
  { title: 'Trophies pay cash', target: '#achBtn', text: '50 achievements, each with a cash reward. A red number means rewards are waiting: open Trophies and claim them.' },
  { title: "You're ready", target: '#tourBtn', text: 'Dig deep and build big. Replay this tour any time from the Guide button.' },
];

let i = -1, built = false;
const SEEN = 'dth_tour';
const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } };

function build() {
  if (built) return; built = true;
  $('tourBtn').onclick = () => start();
  $('tourNext').onclick = () => go(i + 1);
  $('tourBack').onclick = () => go(i - 1);
  $('tourSkip').onclick = () => end();
  $('tourOfferGo').onclick = () => { $('tourOffer').hidden = true; start(); };
  $('tourOfferNo').onclick = () => { $('tourOffer').hidden = true; markSeen(); };
  window.addEventListener('keydown', (e) => {
    if ($('tour').hidden) return;
    if (e.key === 'Escape') end(); else if (e.key === 'ArrowRight' || e.key === 'Enter') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1);
  });
  window.addEventListener('resize', () => { if (!$('tour').hidden) place(); });
}

export function start() {
  build();
  track('tutorial_start');
  $('tourOffer').hidden = true;
  document.getElementById('modal')?.classList.remove('show');
  $('tour').hidden = false;
  go(0);
}
function end(done = false) { track(done ? 'tutorial_complete' : 'tutorial_skip', { step: i + 1 }); $('tour').hidden = true; i = -1; markSeen(); if (siteUnlocked('mine')) navigate('mine'); }

function go(n: number) {
  const dir = n >= i ? 1 : -1;
  while (n >= 0 && n < STEPS.length && STEPS[n].need && !STEPS[n].need!()) n += dir; // skip steps the player hasn't unlocked yet
  if (n >= STEPS.length) { end(true); return; }
  if (n < 0) n = 0;
  i = n;
  const st = STEPS[i];
  if (st.site && siteUnlocked(st.site) && S.site !== st.site) navigate(st.site);
  $('tourTitle').textContent = st.title;
  $('tourText').textContent = st.text;
  $('tourCount').textContent = `${i + 1} / ${STEPS.length}`;
  ($('tourBack') as HTMLButtonElement).disabled = i === 0;
  $('tourNext').textContent = i === STEPS.length - 1 ? "Let's dig!" : 'Next ›';
  // the target may sit inside a collapsed section / scrolled panel: bring it into view first
  const el = st.target ? document.querySelector<HTMLElement>(st.target) : null;
  el?.scrollIntoView({ block: 'nearest' });
  place();
  setTimeout(place, 450); // after the camera/panel settle
}

/** Spotlight + bubble placement for the current step. */
function place() {
  const st = STEPS[i]; if (!st) return;
  const spot = $('tourSpot'), bub = $('tourBubble');
  let r: DOMRect | null = null;
  if (st.area) r = st.area();
  else if (st.target) { const el = document.querySelector<HTMLElement>(st.target); if (el && el.offsetParent !== null) r = el.getBoundingClientRect(); }
  const W = window.innerWidth, H = window.innerHeight, pad = 8;
  if (!r) { // no target: centred bubble, whole screen dimmed
    spot.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
    bub.style.left = `${Math.max(16, W / 2 - 190)}px`; bub.style.top = `${H / 2 - 110}px`; return;
  }
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - x - 4, r.width + pad * 2), h = Math.min(H - y - 4, r.height + pad * 2);
  spot.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  const bw = Math.min(380, W - 32), bh = bub.offsetHeight || 190;
  let bx = x + w + 16, by = y; // right of the target, else left, else below/above
  if (bx + bw > W - 16) bx = x - bw - 16;
  if (bx < 16) { bx = Math.max(16, Math.min(W - bw - 16, x + w / 2 - bw / 2)); by = y + h + 16 + bh > H ? y - bh - 16 : y + h + 16; }
  bub.style.left = `${bx}px`; bub.style.top = `${Math.max(16, Math.min(H - bh - 16, by))}px`;
}

/** Offer the tour once, after the first property sale (the whole loop has happened once, and the busy opening minute
 *  is over). It is a small chip at the bottom-right of the world view, never over the dig floor, and after 10 s it
 *  shrinks to a "▶ Tour" pill until the player starts or dismisses it. */
let offered = false;
export function updateTour() {
  build();
  if (offered || seen() || !S.yard || S.stats.sold < 1 || !$('tour').hidden) return;
  offered = true;
  setTimeout(() => {
    if (!$('tour').hidden) return;
    const o = $('tourOffer'); o.classList.remove('mini'); o.hidden = false;
    setTimeout(() => o.classList.add('mini'), 10_000);
  }, 2500);
}
