// Site navigation bar (Spec §5): MINE / YARD / BUILD, always visible once unlocked, active state, and attention:
//   red "!"  = something needs the player there (blocked, ready to act, tutorial "follow" step)
//   yellow • = an optional upgrade there is affordable
//   nothing  = routine operation. Badges never show on the site you are looking at.
import { CFG } from './config';
import { S, type Site } from './state';
import { worksiteAvailable, nextWorksite } from './economy';
import { cartBlocked, trackOverloaded } from './cart';
import { canStartStage } from './construction';
import { expanding } from './expansion';
import { optionalAffordable, showSitePanel, updatePanel } from './panel';
import { goSite, view } from './view';
import { setMusicState } from './music';
import { unlockAudio } from './audio';

let buildVisited = false;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('#nav .site')];

export const siteUnlocked = (site: Site) =>
  site === 'mine' ? true : site === 'yard' ? S.tut >= 3 || S.flags.dispatched : S.tut >= 5 || S.stats.delivered > 0 || S.yard && S.truck.state === 'TO_SITE';

/** Red attention: only real reasons (Spec §5). */
export function attention(site: Site): boolean {
  if (site === 'yard') {
    if (S.tut === 3 && !S.flags.sold) return true; // FOLLOW THE CART
    if (S.flags.sold && !S.yard && S.cash >= CFG.yard.cost) return true; // the yard can be built
    return S.yard && cartBlocked(); // storage full: the mine is stalled
  }
  if (site === 'build') {
    if (S.tut === 5 && !buildVisited && (S.truck.state !== 'PARKED' || S.build.material.qty > 0)) return true; // FOLLOW THE TRUCK
    return S.build.done || canStartStage();
  }
  if (trackOverloaded()) return true; // a real active problem: the cart carries more than the track safely can
  const n = nextWorksite(S);
  if (n && worksiteAvailable(S) && S.cash >= n.cost && !expanding()) return true;
  return chainStarved();
}

/** The whole chain is idle because nothing is being dug (no crew yet, nothing in the pipeline): go dig. */
export function chainStarved() {
  return S.yard && S.crew.dig === 0 && S.rubble.qty < 1 && S.raw.qty < 1 && S.goods.qty < CFG.yard.truck.pickupMin &&
    S.truck.state === 'PARKED' && (S.cart.state === 'BOTTOM_EMPTY' || S.cart.state === 'LOADING') && !S.build.active && !S.build.done && !canStartStage();
}

export function navigate(site: Site) {
  if (!siteUnlocked(site)) return;
  unlockAudio();
  goSite(site);
  S.site = site;
  if (site === 'build') buildVisited = true;
  showSitePanel(site);
  setMusicState(site);
  updatePanel();
  updateNav();
}

export function initNav() {
  for (const b of buttons) b.onclick = () => navigate(b.dataset.site as Site);
  addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement !== document.body && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
    const k = { Digit1: 'mine', Digit2: 'yard', Digit3: 'build' }[e.code] as Site | undefined;
    if (k) navigate(k);
  });
  showSitePanel(view.site);
  setMusicState(view.site);
}

export function updateNav() {
  for (const b of buttons) {
    const site = b.dataset.site as Site;
    const unlocked = siteUnlocked(site);
    if (b.hidden === unlocked) {
      b.hidden = !unlocked;
      if (unlocked && site !== 'mine') { b.classList.add('new'); setTimeout(() => b.classList.remove('new'), 1600); }
    }
    const here = view.site === site;
    b.classList.toggle('on', here);
    b.setAttribute('aria-current', here ? 'page' : 'false');
    const badge = b.querySelector<HTMLElement>('.badge')!;
    const red = !here && attention(site), dot = !here && !red && optionalAffordable(site);
    const cls = red ? 'badge red' : dot ? 'badge dot' : 'badge';
    if (badge.className !== cls) { badge.className = cls; badge.textContent = red ? '!' : ''; }
    b.setAttribute('aria-label', `${site}${red ? ' — needs attention' : dot ? ' — upgrade available' : ''}`);
  }
}
