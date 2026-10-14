// First-time introduction (Spec §6). No blocking modals: short lines over the world + one "follow" hint at a time.
//   0 LAND    "YOU BOUGHT THIS LAND FOR $1." + "Something valuable is buried down there." [START DIGGING] (shown at
//             once; START, a tap on the rock or Space all start AND strike)
//   1 DIG     first break -> "NICE! KEEP DIGGING." · objective "FILL THE CART n/50" (ready to send from 20)
//   2 CART    the cart loads ("CART READY! TAP IT TO SEND") and leaves -> "UP IT GOES!" -> YARD unlocks with "!" + "FOLLOW THE CART"
//   3 YARD    the contractor: "Raw rubble isn't worth much." / "But processed material is." -> seed money -> build yard
//   4 RECYCLE first block -> "Now this is useful." -> truck leaves -> BUILD unlocks with "!" + "FOLLOW THE TRUCK"
//   5 BUILD   the empty lot: "BUILD SOMETHING." -> first stage started
//   6 DONE    (existing saves migrate straight to a late step)
import { gameplayStart } from './platform';
import { CFG } from './config';
import { S } from './state';
import { view } from './view';
import { chainStarved } from './nav';
import { cartCapacity } from './economy';

const box = document.getElementById('intro')!;
const text = document.getElementById('introText')!;
const btn = document.getElementById('introBtn') as HTMLButtonElement;
const hint = document.getElementById('hint')!;
const touch = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

type Line = { s: string; secs: number; big: boolean; sub?: string };
let queue: Line[] = [];
let lineT = 0, cur: Line | null = null;
let shownBuild = false, firstBreak = false, cartGoalShown = 0;

function line(s: string, big = true, secs: number = CFG.intro.lineSecs, sub?: string) { queue.push({ s, secs, big, sub }); }
/** A short non-blocking line over the world (also used by later world moments, e.g. the first track overload). */
export const showLine = line;

export function initIntro(onStart: () => void) {
  btn.onclick = () => { startDigging(); onStart(); };
  if (S.tut === 0) {
    line('YOU BOUGHT THIS LAND FOR $1.', true, 999, 'Something valuable is buried down there. Dig it up!');
  }
}

export function startDigging() {
  if (S.tut !== 0) return;
  S.tut = 1;
  gameplayStart();
  queue = []; cur = null;
  btn.hidden = true;
}

/** Sim/presentation notifications. */
export function introEvent(e: 'break' | 'pressed' | 'stageStart') {
  if (e === 'break' && S.tut === 1 && !firstBreak) { firstBreak = true; line('NICE! KEEP DIGGING.', true, 1.8); }
  if (e === 'pressed' && S.tut === 4 && S.stats.processed <= CFG.yard.pressBatch * 1.5) { line('FIRST BLOCK', true, 1.8); line('Blocks build houses. Houses pay!', false, 2.4); }
  if (e === 'stageStart' && S.tut === 5) S.tut = 6;
}

export function updateIntro(dt: number) {
  // step transitions
  if (S.tut === 1 && S.rubble.qty + S.cart.load.qty >= CFG.intro.rubbleToCart) S.tut = 2; // the objective chip carries the cart's progress from here
  if (S.tut === 2 && S.flags.dispatched) { S.tut = 3; line('UP IT GOES!', true, 1.8); }
  if (S.tut === 3 && S.yard) S.tut = 4;
  if (S.tut === 4 && (S.truck.state === 'TO_SITE' || S.stats.delivered > 0)) S.tut = 5;
  if (S.tut === 5 && view.site === 'build' && !shownBuild && !view.tween) { shownBuild = true; line('BUILD SOMETHING.'); }

  // lines
  if (!cur && queue.length) { cur = queue.shift()!; lineT = 0; }
  if (cur) {
    lineT += dt;
    if (S.tut === 0) btn.hidden = false; // START is on screen with the opening line (no waiting)
    if (lineT >= cur.secs) cur = null;
  }
  box.hidden = !(cur || S.tut === 0);
  if (cur) {
    const html = `<div class="${cur.big ? 'l big' : 'l'}">${cur.s}</div>${cur.sub ? `<div class="l">${cur.sub}</div>` : ''}`;
    if (text.dataset.k !== html) { text.innerHTML = html; text.dataset.k = html; }
    text.style.opacity = String(Math.min(1, lineT * 3, cur.secs > 90 ? 1 : (cur.secs - lineT) * 3));
  }
  if (S.tut === 0 && !cur) btn.hidden = false;

  // the one "follow" hint
  let h = '', goal = -1;
  // the first cart can leave once it holds the contractor's sample (cart.ts: after an idle wait at ≥ sampleQty, or when
  // full, or when tapped); the chip counts to the cart's own capacity so it matches the cart's "n/50" label
  const ready = CFG.intro.sampleQty, need = cartCapacity(S);
  if ((S.tut === 1 || S.tut === 2) && !S.flags.dispatched && view.site === 'mine' && !view.tween) {
    const n = cartGoalShown = Math.max(cartGoalShown, Math.min(need, Math.floor(S.rubble.qty + S.cart.load.qty))); // never counts backwards
    goal = n / need;
    h = n >= ready && S.tut === 2 ? `CART READY! ${touch ? 'TAP' : 'CLICK'} IT TO SEND ▲  ${n}/${need}` : `⛏ FILL THE CART  ${n}/${need}`;
  }
  else if (S.tut === 3 && view.site !== 'yard') h = 'FOLLOW THE CART ▲  (YARD)';
  else if (S.tut === 5 && view.site !== 'build' && !S.flags.seenBuild && !S.build.material.qty && S.truck.state !== 'PARKED') h = 'FOLLOW THE TRUCK ▶  (BUILD)';
  else if (S.tut === 5 && view.site !== 'build' && !S.flags.seenBuild && S.build.material.qty > 0) h = 'BLOCKS ARRIVED ▶  (BUILD)';
  else if (S.tut >= 4 && S.stats.sold === 0 && view.site !== 'mine' && chainStarved()) h = 'MORE BLOCKS NEEDED: DIG ▼  (MINE)';
  hint.classList.toggle('goal', goal >= 0);
  if (goal >= 0) hint.style.setProperty('--p', goal.toFixed(3));
  hint.hidden = !h;
  if (hint.textContent !== h) hint.textContent = h;
}

export const introActive = () => S.tut === 0;
