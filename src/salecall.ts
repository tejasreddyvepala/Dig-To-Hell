// SALE CALL-OUT: a finished property is the biggest payout in the game, so it must never go unnoticed. While one is
// ready, a gold call-out hangs under the BUILD tab on every site ("🏠 ONE-STORY HOUSE IS READY · SELL $3.55K"),
// the BUILD tab glows gold, and the panel's SELL button pulses. One click sells it: from another site the camera
// first flies to BUILD so the player sees the sale happen.
import { S } from './state';
import { PROJECTS } from './config';
import { projectValue } from './economy';
import { money } from './util';
import { view } from './view';
import { navigate } from './nav';
import { buildAction } from './panel';
import { SITE } from './site';
import { finaleRunning } from './finale';

let built = false, pending = 0;
const $ = (id: string) => document.getElementById(id)!;

function build() {
  if (built) return; built = true;
  const el = document.createElement('button');
  el.id = 'saleCall'; el.hidden = true; el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="sc-ic" aria-hidden="true">🏠</span><span class="sc-tx"><b></b><small></small></span><span class="sc-go">SELL ▸</span>';
  $('stage').appendChild(el);
  el.onclick = sellNow;
}

/** Sell the finished property from anywhere: on BUILD at once; elsewhere the camera flies there first (the player
 *  sees the SOLD moment). Used by the call-out and by the NEXT BEST card. */
export function sellNow() {
  if (!S.build.done || pending) return;
  if (view.site === 'build') { buildAction(); return; }
  navigate('build');
  pending = window.setTimeout(() => { pending = 0; if (S.build.done) buildAction(); }, 1100); // land, then sell in view
}

/** Called with the panel tick. */
export function updateSaleCall() {
  build();
  const el = $('saleCall'), ready = S.build.done && !SITE.sold && !finaleRunning() && !S.flags.finished; // nothing to sell once the lava comes
  const tab = document.querySelector<HTMLElement>('#nav .site[data-site="build"]');
  tab?.classList.toggle('forsale', ready);
  el.hidden = !ready;
  if (!ready || !tab) return;
  const name = PROJECTS[S.build.project].name.toUpperCase();
  el.querySelector('b')!.textContent = `${name} IS READY`;
  el.querySelector('small')!.textContent = `Sell it for ${money(projectValue(S))}`;
  // hang it under the BUILD tab (the top bar moves with the screen size)
  const st = $('stage').getBoundingClientRect(), r = tab.getBoundingClientRect();
  const w = el.offsetWidth, x = Math.max(8, Math.min(st.width - w - 8, r.left - st.left + r.width / 2 - w / 2));
  el.style.left = `${x}px`; el.style.top = `${r.bottom - st.top + 10}px`;
  el.style.setProperty('--ax', `${r.left - st.left + r.width / 2 - x}px`); // the pointer aims at the tab
}
