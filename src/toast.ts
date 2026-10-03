// Short non-blocking notices that DROP FROM A SITE TAB (Spec §5): site unlocks, locked-site previews, and
// off-screen construction events. ~2.6 s, stacked under their tab, never a modal, never moves the camera.
import type { Site } from './state';

export type ToastKind = 'info' | 'event' | 'big' | 'cash';
const box = document.getElementById('toasts')!;
const hint = document.getElementById('hint')!;
const live: HTMLElement[] = [];

/** Show a toast under `site`'s tab. `sub` is an optional second line (cash, explanation). */
export function toast(site: Site, title: string, sub = '', kind: ToastKind = 'event', secs = 2.6) {
  const tab = document.querySelector<HTMLElement>(`#nav .site[data-site="${site}"]`);
  const stage = document.getElementById('stage')!.getBoundingClientRect();
  const r = tab?.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="tt">${title}</div>${sub ? `<div class="ts">${sub}</div>` : ''}`;
  const cx = r ? r.left + r.width / 2 - stage.left : stage.width / 2;
  el.style.left = `${Math.max(90, Math.min(stage.width - 90, cx))}px`;
  el.style.top = `${(r ? r.bottom - stage.top : 56) + 8 + live.length * 54}px`;
  box.appendChild(el);
  live.push(el);
  hint.classList.add('muted'); // the follow-hint steps aside while a toast is up
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => el.classList.add('out'), secs * 1000);
  setTimeout(() => {
    el.remove(); live.splice(live.indexOf(el), 1);
    live.forEach((t, i) => (t.style.top = `${(r ? r.bottom - stage.top : 56) + 8 + i * 54}px`));
    if (!live.length) hint.classList.remove('muted');
  }, secs * 1000 + 350);
}
