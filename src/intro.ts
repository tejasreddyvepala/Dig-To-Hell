// First-time introduction (Spec §6). No blocking modals: short lines over the world + one "follow" hint at a time.
//   0 LAND    "YOU BOUGHT THIS LAND FOR $1." / "Someone said there's something valuable underneath it." [START DIGGING]
//   1 DIG     first break -> "RUBBLE ISN'T MONEY."; enough rubble -> "GET IT TO THE SURFACE." (the cart starts)
//   2 CART    the cart loads and leaves -> YARD unlocks with "!" + "FOLLOW THE CART"
//   3 YARD    the contractor: "Raw rubble isn't worth much." / "But processed material is." -> seed money -> build yard
//   4 RECYCLE first block -> "Now this is useful." -> truck leaves -> BUILD unlocks with "!" + "FOLLOW THE TRUCK"
//   5 BUILD   the empty lot: "BUILD SOMETHING." -> first stage started
//   6 DONE    (existing saves migrate straight to a late step)
import { CFG } from './config';
import { S } from './state';
import { view } from './view';
import { attention, chainStarved } from './nav';

const box = document.getElementById('intro')!;
const text = document.getElementById('introText')!;
const btn = document.getElementById('introBtn') as HTMLButtonElement;
const hint = document.getElementById('hint')!;

let queue: { s: string; secs: number; big: boolean }[] = [];
let lineT = 0, cur: { s: string; secs: number; big: boolean } | null = null;
let shownBuild = false, firstBreak = false;

function line(s: string, big = true, secs: number = CFG.intro.lineSecs) { queue.push({ s, secs, big }); }
/** A short non-blocking line over the world (also used by later world moments, e.g. the first track overload). */
export const showLine = line;

export function initIntro(onStart: () => void) {
  btn.onclick = () => { startDigging(); onStart(); };
  if (S.tut === 0) {
    line('YOU BOUGHT THIS LAND FOR $1.', true, 2.4);
    line("Someone said there's something valuable underneath it.", false, 99);
  }
}

export function startDigging() {
  if (S.tut !== 0) return;
  S.tut = 1;
  queue = []; cur = null;
  btn.hidden = true;
}

/** Sim/presentation notifications. */
export function introEvent(e: 'break' | 'pressed' | 'stageStart') {
  if (e === 'break' && S.tut === 1 && !firstBreak) { firstBreak = true; line("RUBBLE ISN'T MONEY."); }
  if (e === 'pressed' && S.tut === 4 && S.stats.processed <= CFG.yard.pressBatch * 1.5) line('Now this is useful.', false);
  if (e === 'stageStart' && S.tut === 5) S.tut = 6;
}

export function updateIntro(dt: number) {
  // step transitions
  if (S.tut === 1 && S.rubble.qty + S.cart.load.qty >= CFG.intro.rubbleToCart) { S.tut = 2; line('GET IT TO THE SURFACE.'); }
  if (S.tut === 2 && S.flags.dispatched) S.tut = 3;
  if (S.tut === 3 && S.yard) S.tut = 4;
  if (S.tut === 4 && (S.truck.state === 'TO_SITE' || S.stats.delivered > 0)) S.tut = 5;
  if (S.tut === 5 && view.site === 'build' && !shownBuild && !view.tween) { shownBuild = true; line('BUILD SOMETHING.'); }

  // lines
  if (!cur && queue.length) { cur = queue.shift()!; lineT = 0; }
  if (cur) {
    lineT += dt;
    if (S.tut === 0 && lineT > 1.2 && cur.secs > 90) btn.hidden = false;
    if (lineT >= cur.secs) cur = null;
  }
  box.hidden = !(cur || S.tut === 0);
  if (cur) {
    const html = `<div class="${cur.big ? 'l big' : 'l'}">${cur.s}</div>`;
    if (text.dataset.k !== html) { text.innerHTML = html; text.dataset.k = html; }
    text.style.opacity = String(Math.min(1, lineT * 3, cur.secs > 90 ? 1 : (cur.secs - lineT) * 3));
  }
  if (S.tut === 0 && !cur) btn.hidden = false;

  // the one "follow" hint
  let h = '';
  if (S.tut === 3 && view.site !== 'yard') h = 'FOLLOW THE CART ▲  (YARD)';
  else if (S.tut === 5 && view.site !== 'build' && S.stats.sold === 0 && S.build.stage === 0 && !S.build.active && attention('build') && !S.build.material.qty) h = 'FOLLOW THE TRUCK ▶  (BUILD)';
  else if (S.tut === 5 && view.site !== 'build' && S.stats.sold === 0 && attention('build')) h = 'BLOCKS ARRIVED ▶  (BUILD)';
  else if (S.tut >= 4 && S.stats.sold === 0 && view.site !== 'mine' && chainStarved()) h = 'MORE BLOCKS NEEDED: DIG ▼  (MINE)';
  hint.hidden = !h;
  if (hint.textContent !== h) hint.textContent = h;
}

export const introActive = () => S.tut === 0;
