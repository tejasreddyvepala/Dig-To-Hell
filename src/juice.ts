// Presentation: maps sim results (strikes, cart events) to FX + audio.
// Impact hierarchy: normal hit (local) < chunk break (small camera impulse) < crit (hit-stop, star, ring, strongest).
// Digging feedback is impact, cracks, debris, depth and material — never cash.
import { AUDIO, CFG, RESOURCES, type Material } from './config';
import type { HitResult } from './sim';
import type { Chunk } from './digface';
import type { CartEvent } from './cart';
import { cartDepth } from './cart';
import { FX, addPart, hitStop, impulse, popup } from './fx';
import { playBreak, playBrake, playClack, playCrit, playDebris, playDump, playHit, playLoadTick, playRoll } from './audio';
import { cartScreen, faceScale, toScreen, view, yOf } from './view';
import { S } from './state';
import { rgb, rnd, rndi, rndr, rndri } from './util';

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

/** A piece of rubble flying on a ballistic arc from (x0,y0) to land at (x1,y1) after `t` seconds. */
function arc(x0: number, y0: number, x1: number, y1: number, t: number, col: string, size: number) {
  const g = CFG.gravity;
  addPart({
    kind: 'frag', x: x0, y: y0, vx: (x1 - x0) / t, vy: (y1 - y0 - 0.5 * g * t * t) / t, vr: rnd(-10, 10),
    size, col, life: t, floor: Infinity, bounce: 0, shape: true,
  });
}

/** Screen position of the rubble pile's top at the dig site. */
const pileTop = () => toScreen(CFG.cart.pileX + rnd(-10, 10), -4);
const rubbleCol = () => rgb(RESOURCES.rubble.color, rnd(0.75, 1.2));

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

  // LEVEL 2 — break: debris + material visibly flies into the rubble pile
  if (r.broke) {
    shatter(r.chunk, k * (r.crit ? CFG.critFx.debrisMult : 1));
    playBreak(mat.id, vol);
    playDebris(vol);
    if (player && !r.crit) impulse(CFG.impulse.break, rnd(-0.2, 0.2), 1);
    const n = Math.round(CFG.rubble.arcsPerBreak * (player ? 1 : 0.67) * (r.crit ? 1.5 : 1));
    for (let i = 0; i < n; i++) { const t = pileTop(); arc(p.x, p.y - 4, t.x, t.y, rnd(0.35, 0.55), rubbleCol(), rnd(2.2, 3.6) * faceScale()); }
  } else if (player && !r.crit) {
    impulse(CFG.impulse.hit, rnd(-0.2, 0.2), 1);
  }

  // text: material + depth for the player's breaks only (crew progress shows in the pile, not in numbers)
  if (!player || !r.broke) return;
  const sub = r.meters > 0 ? '▼ ' + r.meters.toFixed(2) + ' m' : undefined;
  const label = '+' + Math.round(r.rubble) + ' rubble';
  if (r.crit) popup(p.x + rnd(-8, 8), p.y - 32, label + '!', '#ffd84a', T.crit.size, { life: T.crit.life, pop: 0.6, sub });
  else popup(p.x + rnd(-8, 8), p.y - 26, label, '#ecdcc0', T.brk.size, { life: T.brk.life, alpha: T.brk.alpha, pop: 0.2, sub });
}

// ---- cart presentation ----
let loadArcT = 0, lastCartDepth = cartDepth(), clackDist = 0;

/** Off-screen cart sounds fade with camera distance. */
function cartVol() {
  const y = cartScreen().y, H = view.H;
  const off = y < 0 ? -y : y > H ? y - H : 0;
  return Math.max(0, 1 - off / (H * CFG.cart.soundRangeScreens));
}

export function presentCart(events: CartEvent[], dt: number) {
  const c = cartScreen(), s = faceScale(), vol = cartVol();
  for (const e of events) {
    if (e.type === 'depart') {
      playRoll(vol);
      for (let i = 0; i < 6; i++) addPart({ kind: 'dust', x: c.x + rnd(-14, 14) * s, y: c.y - 2, vx: rnd(-30, 30), vy: rnd(-40, -10), size: rnd(3, 6), col: 'rgba(190,160,120,1)', life: rnd(0.4, 0.7), floor: Infinity, bounce: 0 });
    } else if (e.type === 'arrive') {
      playBrake(vol);
      for (let i = 0; i < 4; i++) addPart({ kind: 'spark', x: c.x + rnd(-6, 6) * s, y: c.y, vx: rnd(-140, 140), vy: rnd(-160, -40), size: 1, col: '#ffd98a', life: rnd(0.12, 0.25), floor: Infinity, bounce: 0 });
    } else if (e.type === 'unloadStart') {
      playDump(vol);
    } else if (e.type === 'returnStart') {
      playRoll(vol * 0.6);
    } else if (e.type === 'back') {
      playClack(vol * 1.5);
    }
  }

  // loading: pieces arc from the pile into the cart
  if (S.cart.state === 'LOADING' && S.rubble.qty > 0.01) {
    loadArcT -= dt;
    if (loadArcT <= 0) {
      loadArcT = CFG.cart.loadArcSecs * Math.max(0.35, 2 / Math.max(2, S.upg.loadSpeed + 2));
      const from = pileTop();
      arc(from.x, from.y, c.x + rnd(-8, 8) * s, c.y - 18 * s, rnd(0.3, 0.42), rubbleCol(), rnd(2, 3.2) * s);
      if (Math.random() < 0.35) playLoadTick(vol);
    }
  }
  // unloading: rubble pours out of the tipped cart onto the surface stockpile
  if (S.cart.state === 'UNLOADING' && S.cart.load.qty > 0.01 && Math.random() < dt * 30) {
    const sx = c.x - 18 * s, sy = c.y - 16 * s;
    addPart({ kind: 'frag', x: sx, y: sy, vx: rnd(-90, -30), vy: rnd(-40, 20), vr: rnd(-8, 8), size: rnd(2, 3.4) * s, col: rubbleCol(), life: 0.9, floor: yOf(0) - 2, bounce: 0.2, shape: true });
  }
  // travelling: rail clacks spaced by distance actually covered
  const d = cartDepth();
  if (S.cart.state === 'TRAVELLING_UP' || S.cart.state === 'TRAVELLING_DOWN') {
    clackDist += Math.abs(d - lastCartDepth);
    if (clackDist >= CFG.cart.clackEveryM) { clackDist = 0; playClack(vol); }
  }
  lastCartDepth = d;
}

/** Crit without a break still throws a heavy spray from the impact point. */
function shatterBurst(mat: Material, x: number, y: number) {
  chips(mat, x, y, rndri(mat.debris.frags), mat.id === 'stone' ? 340 : 240);
  dust(mat, x, y, 4, 8);
  if (mat.id === 'stone' || mat.id === 'cave') sparks(x, y, rndi(2, 4));
}
