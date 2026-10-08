// Short non-blocking notices that DROP FROM A SITE TAB (Spec §5): site unlocks, locked-site previews, and
// off-screen construction events. ~2.6 s, stacked under their tab, never a modal, never moves the camera.
import type { Site } from './state';

export type ToastKind = 'info' | 'event' | 'big' | 'cash';
const box = document.getElementById('toasts')!;
const hint = document.getElementById('hint')!;
const live: HTMLElement[] = [];
let quiet = () => false;
/** Silence toasts while something must not be interrupted (the finale). */
export function setToastQuiet(f: () => boolean) { quiet = f; }

const timers = new Map<HTMLElement, number[]>();

/** Show a toast under `site`'s tab. `sub` is an optional second line (cash, explanation). */
export function toast(site: Site, title: string, sub = '', kind: ToastKind = 'event', secs = 2.6) {
  if (quiet()) return; // nothing interrupts the ending
  // the same notice already showing (e.g. tapping a locked tab again): keep that one up longer, never stack copies
  const key = `${site}|${title}|${sub}`;
  const same = live.find((t) => t.dataset.key === key);
  if (same) { same.classList.remove('out'); schedule(same, secs); return; }
  const tab = document.querySelector<HTMLElement>(`#nav .site[data-site="${site}"]`);
  const stage = document.getElementById('stage')!.getBoundingClientRect();
  const r = tab?.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="tt">${title}</div>${sub ? `<div class="ts">${sub}</div>` : ''}`;
  el.dataset.key = key;
  const cx = r ? r.left + r.width / 2 - stage.left : stage.width / 2;
  el.style.left = `${Math.max(90, Math.min(stage.width - 90, cx))}px`;
  box.appendChild(el);
  live.push(el);
  el.dataset.top = String(r ? r.bottom - stage.top : 56);
  while (live.length > 3) { const old = live.shift()!; for (const id of timers.get(old) ?? []) clearTimeout(id); timers.delete(old); old.remove(); } // at most 3 at once
  layout();
  hint.classList.add('muted'); // the follow-hint steps aside while a toast is up
  requestAnimationFrame(() => el.classList.add('in'));
  schedule(el, secs);
}

/** Stack live toasts by their REAL heights (two-line toasts are taller than one-line ones): never overlapping. */
function layout() {
  let y = 0;
  live.forEach((t, i) => {
    if (i === 0) y = +(t.dataset.top ?? 56) + 8;
    t.style.top = `${y}px`;
    y += t.offsetHeight + 6;
  });
}

/** (Re)start a toast's hide timers. */
function schedule(el: HTMLElement, secs: number) {
  for (const id of timers.get(el) ?? []) clearTimeout(id);
  timers.set(el, [
    window.setTimeout(() => el.classList.add('out'), secs * 1000),
    window.setTimeout(() => {
      el.remove(); if (live.includes(el)) live.splice(live.indexOf(el), 1); timers.delete(el);
      layout();
      if (!live.length) hint.classList.remove('muted');
    }, secs * 1000 + 350),
  ]);
}
