// In-world site cards (Visual Reference Sheet, Construction Site panel): CURRENT PROJECT with a % bar, and NEXT
// PROJECT (PREVIEW) with a small painted picture of the next building — the goal the player is building toward.
// DOM overlay on the stage, shown only at BUILD. Presentation only.
import { PROJECTS } from './config';
import { S } from './state';
import { buildUnlocked } from './economy';
import { drawBuilding } from './buildings';
import { view } from './view';
import { money } from './util';

const $ = (id: string) => document.getElementById(id)!;
let thumbFor = -1;

/** Paint a project into a small canvas (sky, hills, lawn, the finished building). */
function paintThumb(project: number) {
  const cv = $('nextImg') as HTMLCanvasElement, dpr = Math.min(2, window.devicePixelRatio || 1), W = 200, H = 120;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5fa6e6'); sky.addColorStop(1, '#cfe6f6');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = '#9fb7cf'; c.beginPath(); c.moveTo(0, 86); c.lineTo(40, 50); c.lineTo(70, 74); c.lineTo(110, 40); c.lineTo(150, 70); c.lineTo(200, 46); c.lineTo(200, 100); c.lineTo(0, 100); c.fill();
  c.fillStyle = '#3d6b46'; for (let x = 0; x < W; x += 9) { const h = 14 + ((x * 37) % 11); c.beginPath(); c.moveTo(x - 5, 100); c.lineTo(x, 100 - h); c.lineTo(x + 5, 100); c.fill(); }
  c.fillStyle = '#6fae4f'; c.fillRect(0, 100, W, 20);
  const p = PROJECTS[project], u = Math.min((W - 40) / (p.w + 1.6), (H - 30) / (p.h + 1.6));
  c.save(); c.translate(W / 2 - (p.w * u) / 2, 104);
  drawBuilding(project, u, p.stages.map(() => 1), false, 0, c);
  c.restore();
}

export function updateSiteHud() {
  const show = view.site === 'build' && buildUnlocked(S) && !view.tween;
  const hud = $('siteHud');
  hud.classList.toggle('show', show);
  if (!show) return;
  const pr = PROJECTS[S.build.project], b = S.build;
  const total = pr.stages.reduce((a, s) => a + s.blocks, 0);
  const done = b.done ? total : pr.stages.slice(0, b.stage).reduce((a, s) => a + s.blocks, 0) + (b.active ? b.used : 0);
  const pct = Math.round((done / total) * 100);
  $('curName').textContent = pr.name;
  $('curPct').textContent = `${pct}%`;
  ($('curBar') as HTMLElement).style.width = `${pct}%`;
  const st = pr.stages[Math.min(b.stage, pr.stages.length - 1)];
  $('curMat').textContent = b.done ? 'Ready to sell' : `${Math.floor(b.material.qty)} blocks on site · ${st.name}`;
  const next = Math.min(PROJECTS.length - 1, S.build.project + 1), last = S.build.project >= PROJECTS.length - 1;
  $('nextCard').hidden = last;
  if (!last) {
    if (thumbFor !== next) { paintThumb(next); thumbFor = next; }
    $('nextName').textContent = PROJECTS[next].name;
    $('nextVal').textContent = `worth ~${money(PROJECTS[next].value)}+`;
  }
}
