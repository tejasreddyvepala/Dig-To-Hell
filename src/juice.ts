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

let crewCash = 0, crewCashT = 0, crewAt = { x: 0, y: 0 };

/** Crew money is aggregated into one quiet popup every few seconds instead of a number per strike. */
export function updateJuice(dt: number) {
  crewCashT += dt;
  if (crewCashT < CFG.crewPopupSecs) return;
  crewCashT = 0;
  if (crewCash <= 0) return;
  const T = CFG.text.crew;
  popup(crewAt.x, crewAt.y - 34, '+' + money(crewCash), '#d8e6c8', T.size, { life: T.life, alpha: T.alpha, rise: 0.5 });
  crewCash = 0;
}

export function present(r: HitResult) {
  const p = toScreen(r.x, r.y);
  const mat = r.mat;
  const player = !r.crew;
  const k = player ? 1 : CFG.crewFxScale; // crew impacts are ~60% of the player's
  const vol = player ? 1 : AUDIO.crewVolume;
  const T = CFG.text;

  // LEVEL 1 — every hit: local chips + a puff when the crack advances (the crack itself lives in face state)
  const chipN = Math.max(player ? 1 : 0, Math.round(rndri(mat.hitChips) * k * (r.crit ? CFG.critFx.debrisMult : 1)));
  chips(mat, p.x, p.y, chipN, (mat.id === 'stone' ? 260 : 170) * (player ? 1 : 0.8));
  if (r.after > r.before) dust(mat, p.x, p.y, player ? 2 : 1, 4);

  // LEVEL 3 — crit
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

  // LEVEL 2 — break
  if (r.broke) {
    shatter(r.chunk, k * (r.crit ? CFG.critFx.debrisMult : 1));
    playBreak(mat.id, vol);
    playDebris(vol);
    if (player && !r.crit) impulse(CFG.impulse.break, rnd(-0.2, 0.2), 1);
  } else if (player && !r.crit) {
    impulse(CFG.impulse.hit, rnd(-0.2, 0.2), 1);
  }

  if (!player) {
    crewCash += r.cash; crewAt = p;
    return;
  }
  const sub = r.broke && r.meters > 0 ? '▼ ' + r.meters.toFixed(2) + ' m' : undefined;
  const px = p.x + rnd(-8, 8);
  if (r.crit) popup(px, p.y - 34, '+' + money(r.cash) + '!', '#ffd84a', T.crit.size, { life: T.crit.life, pop: 0.6, sub });
  else if (r.broke) popup(px, p.y - 28, '+' + money(r.cash), '#fff1c9', T.brk.size, { life: T.brk.life, pop: 0.2, sub });
  else popup(px, p.y - 20, '+' + money(r.cash), '#f1ede4', T.hit.size, { life: T.hit.life, alpha: T.hit.alpha, rise: 0.6 });
}

/** Crit without a break still throws a heavy spray from the impact point. */
function shatterBurst(mat: Material, x: number, y: number) {
  chips(mat, x, y, rndri(mat.debris.frags), mat.id === 'stone' ? 340 : 240);
  dust(mat, x, y, 4, 8);
  if (mat.id === 'stone' || mat.id === 'cave') sparks(x, y, rndi(2, 4));
}
