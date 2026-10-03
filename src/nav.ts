// Site navigation bar (Spec §5): MINE / YARD / BUILD are ALL visible from the first second. Locked sites show a lock;
// tapping one explains what it will do, how it unlocks, and gives a brief camera peek at the (inactive) site.
// Attention (one rule set, Spec §5):
//   RED !    = an active problem that is reducing operation RIGHT NOW (track overloaded, yard storage full).
//   YELLOW ! = an opportunity / new content worth looking at (a site just unlocked, the Recycling Yard can be built,
//              a finished property is ready to sell).
//   nothing  = everything else — including any ordinary affordable upgrade.
// If any red exists, yellows are suppressed. Badges never show on the site being viewed.
import { CFG } from './config';
import { S, type Site } from './state';
import { buildUnlocked, yardUnlocked } from './economy';
import { cartBlocked, trackOverloaded } from './cart';
import { canStartStage } from './construction';
import { showSitePanel, updatePanel } from './panel';
import { goSite, view } from './view';
import { setMusicState } from './music';
import { unlockAudio, playSting } from './audio';
import { toast } from './toast';

const buttons = [...document.querySelectorAll<HTMLButtonElement>('#nav .site')];

export const siteUnlocked = (site: Site) => (site === 'mine' ? true : site === 'yard' ? yardUnlocked(S) : buildUnlocked(S));

export type Attention = 'red' | 'yellow' | '';
/** Every condition that can light a badge lives here (and only here). */
export function siteAttention(site: Site): Attention {
  if (!siteUnlocked(site)) return '';
  if (site === 'mine') return trackOverloaded() ? 'red' : '';
  if (site === 'yard') {
    if (S.yard && cartBlocked()) return 'red'; // raw storage full: the cart can't unload, the mine stalls
    if (!S.flags.seenYard) return 'yellow'; // new site
    if (S.flags.sold && !S.yard && S.cash >= CFG.yard.cost) return 'yellow'; // the Recycling Yard can be built
    return '';
  }
  if (!S.flags.seenBuild) return 'yellow'; // new site
  if (S.build.done) return 'yellow'; // property ready to sell
  return '';
}

/** The whole chain is idle because nothing is being dug (no crew yet, nothing in the pipeline). Used only by the
 *  introduction's follow-hint, never for a badge. */
export function chainStarved() {
  return S.yard && S.crew.dig === 0 && S.rubble.qty < 1 && S.raw.qty < 1 && S.goods.qty < CFG.yard.truck.pickupMin &&
    S.truck.state === 'PARKED' && (S.cart.state === 'BOTTOM_EMPTY' || S.cart.state === 'LOADING') && !S.build.active && !S.build.done && !canStartStage();
}

const LOCKED: Record<'yard' | 'build', { title: string; what: string; how: string }> = {
  yard: { title: 'YARD', what: 'Turn what you dig up into building material.', how: 'Send your first cart to the surface.' },
  build: { title: 'BUILD', what: 'Turn recycled blocks into real buildings.', how: 'Produce your first construction blocks.' },
};

let peekTimer = 0;
/** Locked tab: explain it, and glance at the inactive site for a moment (the camera comes back on its own). */
function previewLocked(site: 'yard' | 'build') {
  const l = LOCKED[site];
  toast(site, `🔒 ${l.title}`, `${l.what}<br><b>${l.how}</b>`, 'info', 3.4);
  if (peekTimer || view.tween || S.tut === 0) return;
  const back = view.site;
  goSite(site);
  peekTimer = window.setTimeout(() => { goSite(back); peekTimer = 0; }, 2100);
}
export const peeking = () => !!peekTimer;

export function navigate(site: Site) {
  unlockAudio();
  if (!siteUnlocked(site)) { previewLocked(site as 'yard' | 'build'); return; }
  if (peekTimer) { clearTimeout(peekTimer); peekTimer = 0; }
  goSite(site);
  S.site = site;
  showSitePanel(site);
  setMusicState(site);
  updatePanel();
  updateNav();
}

const ORDER: Site[] = ['mine', 'yard', 'build'];
/** Swipe left/right on the game view: next/previous site (a locked one just explains itself). */
function initSwipe() {
  const stage = document.getElementById('stage')!;
  let sx = 0, sy = 0, st = 0, id = -1;
  stage.addEventListener('pointerdown', (e) => { id = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); });
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = -1;
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - st;
    const min = Math.max(50, stage.clientWidth * 0.12);
    if (dt > 700 || Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = ORDER.indexOf(S.site) + (dx < 0 ? 1 : -1); // swipe left = go right along the road
    if (i >= 0 && i < ORDER.length) navigate(ORDER[i]);
  });
  stage.addEventListener('pointercancel', () => { id = -1; });
}

export function initNav() {
  initSwipe();
  for (const b of buttons) b.onclick = () => navigate(b.dataset.site as Site);
  addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement !== document.body && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
    const k = { Digit1: 'mine', Digit2: 'yard', Digit3: 'build' }[e.code] as Site | undefined;
    if (k) navigate(k);
  });
  showSitePanel(S.site);
  setMusicState(S.site);
}

/** A site opening is an event: a big toast from its tab, a glow, and a yellow ! until the player looks. */
function announceUnlocks() {
  if (yardUnlocked(S) && !S.flags.annYard) {
    S.flags.annYard = true;
    toast('yard', 'YARD UNLOCKED', 'Turn your rubble into building blocks.', 'big', 3.2);
    pulse('yard'); playSting();
  }
  if (buildUnlocked(S) && !S.flags.annBuild) {
    S.flags.annBuild = true;
    toast('build', 'BUILD SITE UNLOCKED', 'Your recycled material can become something bigger.', 'big', 3.2);
    pulse('build'); playSting();
  }
}
function pulse(site: Site) {
  const b = buttons.find((x) => x.dataset.site === site);
  if (!b) return;
  b.classList.remove('new'); void b.offsetWidth; b.classList.add('new');
  setTimeout(() => b.classList.remove('new'), 1700);
}

export function updateNav() {
  announceUnlocks();
  // a site counts as seen once the camera has actually arrived there (not during a locked peek)
  if (!view.tween && !peekTimer) {
    if (view.site === 'yard' && yardUnlocked(S)) S.flags.seenYard = true;
    if (view.site === 'build' && buildUnlocked(S)) S.flags.seenBuild = true;
  }
  const att = buttons.map((b) => siteAttention(b.dataset.site as Site));
  const anyRed = att.includes('red');
  buttons.forEach((b, i) => {
    const site = b.dataset.site as Site;
    const unlocked = siteUnlocked(site);
    b.hidden = false;
    b.classList.toggle('locked', !unlocked);
    const lbl = b.querySelector<HTMLElement>('.lbl')!;
    const text = unlocked ? site.toUpperCase() : `🔒 ${site.toUpperCase()}`;
    if (lbl.textContent !== text) lbl.textContent = text;
    const here = S.site === site;
    b.classList.toggle('on', here);
    b.setAttribute('aria-current', here ? 'page' : 'false');
    let a = here ? '' : att[i];
    if (anyRed && a === 'yellow') a = ''; // a real problem outranks opportunities
    const badge = b.querySelector<HTMLElement>('.badge')!;
    const cls = a ? `badge ${a}` : 'badge';
    if (badge.className !== cls) { badge.className = cls; badge.textContent = a ? '!' : ''; }
    b.setAttribute('aria-label', `${site}${!unlocked ? ' (locked)' : a === 'red' ? ' — problem' : a === 'yellow' ? ' — something new' : ''}`);
  });
}
