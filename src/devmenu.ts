// DEV MENU (`npm run dev` and tester builds `npm run build:test` only; public builds compile it out): a DEV tile in the top-left bar opens quick test
// controls: cash, jump to any layer / the ending, game speed, skip the opening, give rooms and machines, time of day,
// resets. Never shipped to players.
import { CREW_GEAR, WORKSITES } from './config';
import { S, saveState } from './state';
import { addTo, materialAt, unitValue } from './economy';

export interface DevHooks { setSpeed: (k: number) => void; setPhase: (p: number) => void }
/** Builds that may contain the menu at all: dev server and tester builds. A public `npm run build` has neither. */
const ALLOWED = import.meta.env.DEV || import.meta.env.VITE_TESTER === '1';
/** Inside an allowed build: shown in dev, with `?dev` in the URL, or after Shift + D (remembered). */
const devOn = () => { try { return import.meta.env.DEV || new URLSearchParams(location.search).has('dev') || localStorage.getItem('dth_dev') === '1'; } catch { return import.meta.env.DEV; } };
export function initDevMenu(hooks: DevHooks) {
  if (!ALLOWED) return;
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'D' || e.key === 'd') && !(e.target instanceof HTMLInputElement)) {
      try { localStorage.setItem('dth_dev', localStorage.getItem('dth_dev') === '1' ? '0' : '1'); } catch { /* ignore */ }
      location.reload();
    }
  });
  if (!devOn()) return;
  const corner = document.getElementById('corner')!;
  const btn = document.createElement('button');
  btn.id = 'devBtn'; btn.setAttribute('aria-label', 'Developer options');
  btn.innerHTML = '<span class="cic" style="font:700 15px Rubik,sans-serif;color:#ff8a72">DEV</span><span class="clb">Test</span>';
  corner.appendChild(btn);
  const box = document.createElement('div');
  box.id = 'devPanel'; box.hidden = true;
  const dig = hooks;
  const reload = () => { S.last = Date.now(); saveState(); location.reload(); };
  const finishOpening = () => { S.flags.finished = false; /* a dev jump always gives a playable game (the ending can run again) */ S.tut = Math.max(S.tut, 6); Object.assign(S.flags, { dispatched: true, arrived: true, sold: true, storageSeen: true, annYard: true, annBuild: true, seenYard: true, seenBuild: true }); S.yard = true; if (S.truck.state === 'NONE') S.truck.state = 'PARKED'; };
  const groups: [string, [string, () => void][]][] = [
    ['Money', [['+$1K', () => (S.cash += 1e3)], ['+$10K', () => (S.cash += 1e4)], ['+$100K', () => (S.cash += 1e5)], ['+$1M', () => (S.cash += 1e6)]]],
    ['Jump to depth', [...[50, 150, 300, 450, 620, 760, 900].map((d) => [`${d} m · ${materialAt(d).name}`, () => { finishOpening(); S.depth = d; reload(); }] as [string, () => void]),
      ['990 m · the ending', () => { finishOpening(); S.depth = 990; reload(); }], ['Replay the ending now', () => { finishOpening(); S.depth = 1000; reload(); }]]],
    ['Game speed', [['×1', () => dig?.setSpeed(1)], ['×4', () => dig?.setSpeed(4)], ['×16', () => dig?.setSpeed(16)]]],
    ['Unlock', [['Skip the opening (Yard built)', () => { finishOpening(); reload(); }],
      ['Next worksite room', () => { if (S.worksite < WORKSITES.length - 1) { if (S.worksite === 0) S.chamberM = S.depth; S.worksite++; reload(); } }],
      ['+5 miners', () => { S.crew.dig += 5; reload(); }],
      ['All machines', () => { S.worksite = WORKSITES.length - 1; S.crew.exc = S.crew.saw = S.crew.borer = 1; reload(); }],
      ['Next crew gear', () => { if (S.crewGear < CREW_GEAR.length - 1) S.crewGear++; }]]],
    ['Material', [['+50 rubble at the dig site', () => addTo(S.rubble, 50, unitValue(S.depth), materialAt(S.depth).id)], ['+200 blocks on the plot', () => addTo(S.build.material, 200, unitValue(S.depth), materialAt(S.depth).id)],
      ['Clear raw material', () => { S.raw.qty = 0; S.raw.val = 0; S.raw.mix = {}; }]]],
    ['Time of day', [['Morning', () => dig?.setPhase(0.15)], ['Sunset', () => dig?.setPhase(0.56)], ['Night', () => dig?.setPhase(0.85)]]],
    ['Reset', [['Show the tour offer again', () => { localStorage.removeItem('dth_tour'); location.reload(); }], ['Reset achievements', () => { localStorage.removeItem('dth_ach'); location.reload(); }], ['Hide dev menu (Shift + D)', () => { localStorage.setItem('dth_dev', '0'); location.reload(); }]]],
  ];
  const acts: (() => void)[] = [];
  box.innerHTML = `<div class="dvh"><b>Developer options</b><small>testing only · Shift + D hides</small></div>` + groups.map(([g, items]) => `<div class="dvg"><span>${g}</span><div>${items.map(([l, f]) => { acts.push(f); return `<button data-a="${acts.length - 1}">${l}</button>`; }).join('')}</div></div>`).join('');
  document.getElementById('stage')!.appendChild(box);
  box.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]'); if (b) acts[+b.dataset.a!](); });
  btn.onclick = () => { box.hidden = !box.hidden; };
}
