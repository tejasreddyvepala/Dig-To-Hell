// Presentation of a resolved strike: maps a HitResult to FX + audio, following the impact hierarchy
// normal hit (local) < chunk break (small camera impulse) < crit (hit-stop, star, ring, strongest).
import { AUDIO, CFG, type Material } from './config';
import type { HitResult } from './sim';
import type { Chunk } from './digface';
import { FX, addPart, hitStop, impulse, popup } from './fx';
import { playBreak, playCrit, playDebris, playHit } from './audio';
import { faceScale, toScreen } from './view';
import { S } from './state';
import { money, rgb, rnd, rndi, rndr, rndri } from './util';

const RED_FLECK = 'rgb(120,18,16)';

function fragColor(mat: Material) {
  if (S.depth >= CFG.face.redFleckDepth && Math.random() < 0.18 + (S.depth - CFG.face.redFleckDepth) * 0.03) return RED_FLECK;
  return rgb(mat.chip, rnd(0.8, 1.2));
}

function chips(mat: Material, x: number, y: number, n: number, speed: number) {
  const s = faceScale();
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), v = rnd(0.4, 1) * speed;
    addPart({
      kind: 'frag', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: rnd(-12, 12), size: rnd(1.6, 3) * s,
      col: fragColor(mat), life: 0.5, floor: y + rnd(2, 6), bounce: mat.debris.bounce, shape: true,
    });
  }
}

function dust(mat: Material, x: number, y: number, n: number, spread: number) {
  for (let i = 0; i < n; i++) {
    addPart({
      kind: 'dust', x: x + rnd(-spread, spread), y: y + rnd(-4, 4), vx: rnd(-40, 40), vy: rnd(-50, -10),
      size: rnd(3, 7), col: mat.dust + '1)', life: rnd(0.4, 0.8), floor: Infinity, bounce: 0,
    });
  }
}

function sparks(x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(220, 420);
    addPart({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1, col: '#ffd98a', life: rnd(0.15, 0.3), floor: Infinity, bounce: 0 });
  }
}

/** The chunk shatters: fragments spawn across its body and launch outward. */
function shatter(c: Chunk, mult: number) {
  const D = c.mat.debris, s = faceScale();
  let minX = Infinity, maxX = -Infinity;
  for (let k = 0; k < c.poly.length; k += 2) { minX = Math.min(minX, c.poly[k]); maxX = Math.max(maxX, c.poly[k]); }
  const top = toScreen(0, 0).y;
  const n = Math.round(rndri(D.frags) * mult);
  for (let i = 0; i < n; i++) {
    const lx = rnd(minX + 3, maxX - 3), ly = rnd(2, CFG.face.height * 0.6);
    const p = toScreen(lx, ly);
    const cxl = (minX + maxX) / 2;
    const a = -Math.PI / 2 + (lx - cxl) / (maxX - minX) * 1.4 + rnd(-0.35, 0.35);
    const v = rndr(D.speed);
    addPart({
      kind: 'frag', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: rnd(-D.spin, D.spin),
      size: rndr(D.fragSize) * s, col: fragColor(c.mat), life: D.life * rnd(0.85, 1.15),
      floor: D.fallThrough ? Infinity : top + rnd(0, 6), bounce: D.bounce, shape: true,
    });
  }
  const mid = toScreen((minX + maxX) / 2, 8);
  dust(c.mat, mid.x, mid.y, Math.round(rndri(D.dust) * mult), (maxX - minX) * s * 0.4);
  const g = Math.round(rndri(D.grains) * mult);
  for (let i = 0; i < g; i++) {
    const p = toScreen(rnd(minX, maxX), rnd(0, 10));
    addPart({
      kind: 'grain', x: p.x, y: p.y, vx: rnd(-90, 90), vy: rnd(-260, -80), size: rnd(1.2, 2.4),
      col: fragColor(c.mat), life: rnd(0.4, 0.8), floor: D.fallThrough ? Infinity : top + rnd(0, 5), bounce: 0.3,
    });
  }
  if (Math.random() < D.sparkChance * mult) sparks(mid.x, mid.y, rndi(1, 4));
}

export function present(r: HitResult) {
  const p = toScreen(r.x, r.y);
  const mat = r.mat;
  const player = !r.crew;
  const vol = player ? 1 : AUDIO.crewVolume;
  const T = CFG.text;

  // impact: local chips, crack change happened in the face state already
  const chipN = Math.round(rndri(mat.hitChips) * (player ? 1 : 0.5) * (r.crit ? CFG.critFx.debrisMult : 1));
  chips(mat, p.x, p.y, chipN, mat.id === 'stone' ? 260 : 170);
  if (r.after > r.before) dust(mat, p.x, p.y, player ? 2 : 1, 4);

  if (r.crit) {
    hitStop(CFG.hitStopMs);
    FX.stars.push({ x: p.x, y: p.y, t: 0, size: CFG.critFx.starSize * faceScale() });
    FX.rings.push({ x: p.x, y: p.y, t: 0 });
    if (!r.broke) shatterBurst(mat, p.x, p.y);
    impulse(CFG.impulse.crit, rnd(-0.3, 0.3), 1);
    playCrit(mat.id);
  } else {
    playHit(mat.id, vol);
  }

  if (r.broke) {
    shatter(r.chunk, (player ? 1 : 0.6) * (r.crit ? CFG.critFx.debrisMult : 1));
    playBreak(mat.id, vol);
    playDebris(vol);
    if (player) impulse(Math.max(CFG.impulse.break, r.crit ? CFG.impulse.crit : 0), rnd(-0.2, 0.2), 1);
    else impulse(CFG.impulse.hit);
  } else if (player && !r.crit) {
    impulse(CFG.impulse.hit, rnd(-0.2, 0.2), 1);
  }

  if (player) {
    const px = p.x + rnd(-14, 14);
    if (r.crit) popup(px, p.y - 30, '+' + money(r.cash) + '!', '#ffd84a', T.critSize, T.life * 1.4, 0.5);
    else if (r.broke) popup(px, p.y - 24, '+' + money(r.cash), '#fff1c9', T.breakSize, T.life, 0.25);
    else popup(px, p.y - 20, '+' + money(r.cash), '#f1ede4', T.hitSize, T.life * 0.8);
    if (r.broke && r.meters > 0) popup(p.x + rnd(-10, 10), p.y + 22, '▼ ' + r.meters.toFixed(2) + ' m', 'rgba(200,220,255,.9)', T.hitSize * 0.8, T.life);
  }
}

/** Crit without a break still throws a heavy spray from the impact point. */
function shatterBurst(mat: Material, x: number, y: number) {
  chips(mat, x, y, rndri(mat.debris.frags), mat.id === 'stone' ? 340 : 240);
  dust(mat, x, y, 4, 8);
  if (mat.id === 'stone' || mat.id === 'cave') sparks(x, y, rndi(2, 4));
}
