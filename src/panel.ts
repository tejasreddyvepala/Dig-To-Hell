// DOM side panel + modal. Buying lives here; arrival cinematics are Step 4.
import { CFG, CREW, FINDS, TOOLS } from './config';
import { S, saveState } from './state';
import { crewCost, crewIncome, hitCash, clickPower } from './economy';
import { syncWorkers } from './sim';
import { FX, popup } from './fx';
import { faceY, view } from './view';
import { fmt, money } from './util';

const $ = (id: string) => document.getElementById(id)!;

export function buildPanel() {
  $('crew').innerHTML = CREW.map(
    (c) =>
      `<button class="btn" data-crew="${c.id}"><span class="ic" aria-hidden="true">${c.ic}</span>` +
      `<span><div class="nm">${c.name}</div><div class="ds">${c.ds}</div></span>` +
      `<span><div class="pr"></div><div class="ct"></div></span></button>`,
  ).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => {
    b.onclick = () => {
      const c = CREW.find((x) => x.id === b.dataset.crew)!;
      const cost = crewCost(S, c.id);
      if (S.cash < cost || S.depth < c.unlockDepth) return;
      S.cash -= cost;
      S.crew[c.id]++;
      syncWorkers();
      saveState();
      popup(view.W / 2, faceY() - 70, c.name + ' hired', '#7ee08a', 20, 1.4);
    };
  });
}

function buyTool() {
  const n = TOOLS[S.tool + 1];
  if (!n || S.cash < n.cost || S.depth < n.unlockDepth) return;
  S.cash -= n.cost;
  S.tool++;
  saveState();
  FX.banner = { s: 'New tool: ' + n.name, sub: 'Every hit now earns about ' + money(hitCash(clickPower(S), S.depth)), t: 0 };
}

export function updatePanel() {
  $('cash').textContent = money(S.cash);
  $('depth').textContent = (S.depth < 100 ? S.depth.toFixed(1) : fmt(S.depth)) + ' m';
  $('rate').textContent = money(crewIncome(S)) + '/s';

  const nt = TOOLS[S.tool + 1], cur = TOOLS[S.tool];
  let th: string;
  if (nt && S.depth >= nt.unlockDepth) {
    th = `<button class="btn" id="up"${S.cash < nt.cost ? ' disabled' : ''}><span class="ic" aria-hidden="true">${nt.ic}</span>` +
      `<span><div class="nm">Upgrade to ${nt.name}</div><div class="ds">Hits ${(nt.pow / cur.pow).toFixed(0)}× harder</div></span>` +
      `<span><div class="pr">${money(nt.cost)}</div></span></button>`;
  } else {
    th = `<div class="ds" style="padding:0 6px">${cur.ic} ${cur.name}${nt ? '. Something heavier arrives deeper down.' : '.'}</div>`;
  }
  const tool = $('tool');
  if (tool.dataset.k !== th) {
    tool.innerHTML = th;
    tool.dataset.k = th;
    const u = document.getElementById('up');
    if (u) u.onclick = buyTool;
  }

  document.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b, i) => {
    const c = CREW[i];
    const cost = crewCost(S, c.id);
    b.hidden = S.depth < c.unlockDepth && S.crew[c.id] === 0;
    b.disabled = S.cash < cost;
    b.querySelector('.pr')!.textContent = money(cost);
    b.querySelector('.ct')!.textContent = S.crew[c.id] ? 'Own ' + S.crew[c.id] : '';
  });

  const fh =
    FINDS.map((f, i) =>
      i < S.found
        ? `<div class="disc"><span>★ ${f.name}</span><span>${fmt(f.d)} m</span></div>`
        : i === S.found
          ? `<div class="disc locked"><span>? ? ?</span><span>${fmt(f.d)} m</span></div>`
          : '',
    ).join('') +
    (S.found
      ? `<div class="ds" style="padding:8px">Each find adds ${Math.round(CFG.findMultBonus * 100)}% to all digging. Now +${Math.round(S.found * CFG.findMultBonus * 100)}%</div>`
      : '');
  const finds = $('finds');
  if (finds.dataset.k !== fh) {
    finds.innerHTML = fh;
    finds.dataset.k = fh;
  }
}

// ---- modal ----
let modalOpen = false;
export const isModalOpen = () => modalOpen;

export function showModal(html: string, btn: string) {
  $('card').innerHTML = html + `<button id="ok">${btn}</button>`;
  $('modal').classList.add('show');
  modalOpen = true;
  const ok = $('ok');
  ok.focus();
  ok.onclick = () => {
    $('modal').classList.remove('show');
    modalOpen = false;
    ok.blur();
  };
}
