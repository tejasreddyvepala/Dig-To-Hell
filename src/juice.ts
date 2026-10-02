// Presentation: maps sim results (strikes, cart events) to FX + audio.
// Impact hierarchy: normal hit (local) < chunk break (small camera impulse) < crit (hit-stop, star, ring, strongest).
// Digging feedback is impact, cracks, debris, depth and material — never cash.
import { AUDIO, CFG, TOOLS, type Material } from './config';
import { rubbleRGB } from './geo';
import { mixPick } from './economy';
import type { Load } from './state';
import type { HitResult } from './sim';
import { landings } from './workers';
import { pileX } from './layout';
import type { SurfaceEvent } from './surface';
import type { Chunk } from './digface';
import type { CartEvent } from './cart';
import { cartDepth } from './cart';
import { FX, addPart, hitStop, impulse, popup } from './fx';
import { playBeep, playBlast, playWhistle, playBreak, playBrake, playClack, playCrit, playDebris, playDump, playHit, playKnock, playLoadTick, playPurchase, playRoll, playSting, playThud } from './audio';
import { cartScreen, faceScale, surfaceLayout, toScreen, view, yOf } from './view';
import { face } from './digface';
import { materialAt } from './geo';
import { duckMusic } from './music';
import type { ExpEvent } from './expansion';
import { S } from './state';
import { fmt, money, rgb, rnd, rndi, rndr, rndri } from './util';

/** Effects grow with the work area (authored at CFG.fxScaleRef face scale). */
const fxk = () => faceScale() / CFG.fxScaleRef;

function fragColor(mat: Material) {
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
      size: rnd(3, 7) * fxk(), col: mat.dust + '1)', life: rnd(0.4, 0.8), floor: Infinity, bounce: 0,
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
const pileTop = () => toScreen(pileX() + rnd(-10, 10), -4);
/** A piece of rubble coloured by the load's material composition (stone looks gray, clay red-brown...). */
const rubbleCol = (l: Load = S.rubble) => rgb(rubbleRGB(mixPick(l, Math.random())), rnd(0.8, 1.15));

export function present(r: HitResult) {
  const p = toScreen(r.x, r.y);
  const mat = r.mat;
  const player = !r.crew;
  const tool = TOOLS[S.tool];
  const k = player ? tool.fx : CFG.crewFxScale; // crew impacts are ~60% of the player's; heavier tools hit harder
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
    FX.rings.push({ x: p.x, y: p.y, t: 0, s: fxk() });
    if (!r.broke) shatterBurst(mat, p.x, p.y);
    impulse(CFG.impulse.crit, rnd(-0.3, 0.3), 1);
    playCrit(mat.id);
  } else {
    playHit(mat.id, player && tool.kind === 'jack' ? 0.55 : vol);
    if (player && tool.kind === 'pick') playThud(tool.thud);
  }

  // LEVEL 2 — break: debris + material visibly flies into the rubble pile
  if (r.broke) {
    shatter(r.chunk, k * (r.crit ? CFG.critFx.debrisMult : 1));
    playBreak(mat.id, vol);
    playDebris(vol);
    if (player && !r.crit) impulse(CFG.impulse.break * (0.85 + 0.15 * tool.fx), rnd(-0.2, 0.2), 1);
    // more material per break (tool / machine yield) = visibly more pieces flying into the pile
    const n = Math.round(CFG.rubble.arcsPerBreak * Math.sqrt(r.rubble / CFG.rubble.perBreak) * (player ? 1 : 0.67));
    for (let i = 0; i < n; i++) { const t = pileTop(); arc(p.x, p.y - 4, t.x, t.y, rnd(0.35, 0.55), rgb(rubbleRGB(mat.id), rnd(0.85, 1.15)), rnd(2.2, 3.6) * faceScale()); }
  } else if (player && !r.crit) {
    impulse(CFG.impulse.hit, rnd(-0.2, 0.2), 1);
  }

  // text: material + depth for the player's breaks only (crew progress shows in the pile, not in numbers)
  if (!player || !r.broke) return;
  const sub = r.meters > 0 ? '▼ ' + r.meters.toFixed(2) + ' m' : undefined;
  const label = '+' + Math.round(r.rubble) + ' RUBBLE';
  if (r.crit) popup(p.x + rnd(-8, 8), p.y - 32, label + '!', '#ffd84a', T.crit.size * Math.sqrt(fxk()), { life: T.crit.life, pop: 0.6, sub });
  else popup(p.x + rnd(-8, 8), p.y - 26, label, '#ecdcc0', T.brk.size * Math.sqrt(fxk()), { life: T.brk.life, alpha: T.brk.alpha, pop: 0.2, sub });
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
      arc(from.x, from.y, c.x + rnd(-8, 8) * s, c.y - 18 * s, rnd(0.3, 0.42), rubbleCol(S.rubble), rnd(2, 3.2) * s);
      if (Math.random() < 0.35) playLoadTick(vol);
    }
  }
  // unloading: rubble pours out of the tipped cart down onto the surface stockpile beside it
  if (S.cart.state === 'UNLOADING' && S.cart.load.qty > 0.01 && Math.random() < dt * 30) {
    const L = surfaceLayout();
    arc(c.x + 14 * s, c.y - 20 * s, L.hopperX + rnd(-L.u * 0.25, L.u * 0.25), S.yard ? L.hopperTop + 6 : L.gy - 6, rnd(0.3, 0.45), rubbleCol(S.cart.load), rnd(2, 3.4) * s);
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

// ---- crew arrival: landing dust + lamp click ----
export function presentLandings() {
  for (const w of landings) {
    const p = toScreen(w.x, 0);
    for (let i = 0; i < 7; i++) addPart({ kind: 'dust', x: p.x + rnd(-10, 10), y: p.y - 2, vx: rnd(-50, 50), vy: rnd(-40, -5), size: rnd(3, 6), col: 'rgba(196,170,130,1)', life: rnd(0.4, 0.7), floor: Infinity, bounce: 0 });
    playClack(0.8);
  }
  landings.length = 0;
}

// ---- surface: contractor (tutorial), Recycling Yard, delivery truck ----
/** Presentation-only surface state (never saved). */
export const SV = {
  speech: null as { text: string; t: number; hold: boolean } | null,
  buildT: 0, // 0..1 Recycling Yard construction progress
  contractorGone: 0, // 0..1 contractor driving off once the yard is built
  pressT: 1, // secs since the last press THUMP (drives the ram animation)
  knockT: 0,
  spin: 0, // auger / crusher rotation (advances only while processing)
  blocksIn: 0, // blocks flying from the stack to the truck (visual count)
  blocksOut: 0, // blocks flying from the truck onto the construction stack
};

export function say(text: string, hold = false) { SV.speech = { text, t: 0, hold }; }

const exhaust = (x: number, y: number, n: number) => {
  for (let i = 0; i < n; i++) addPart({ kind: 'dust', x: x + rnd(-3, 3), y: y + rnd(-2, 2), vx: rnd(20, 50), vy: rnd(-30, -12), size: rnd(4, 7) * fxk(), col: 'rgba(150,150,150,1)', life: rnd(0.7, 1.2), floor: Infinity, bounce: 0 });
};

/** Truck pose on the road (virtual px), derived only from the sim's truck state + timer (presentation; the sim's
 *  states and timings are untouched). The truck always faces its direction of travel:
 *    ARRIVING  : drives in cab-first from the right, turns, reverses the last stretch into the bay
 *    TO_SITE   : drives forward (cab right) to the plot      UNLOADING: parked at the plot, cab right
 *    RETURNING : turns at the plot, drives back cab-first, turns short of the bay, reverses in
 *  `face` is the horizontal facing in [-1, 1] (a turn sweeps it through 0 — the side-view turnaround);
 *  `cx` is the truck's centre; `bed` is the world x-range of the cargo bed. */
export const TRUCK_LEN_U = 4.5;
export function truckPose() {
  const L = surfaceLayout(), u = L.u, tr = S.truck;
  const len = TRUCK_LEN_U * u, park = L.bayX, site = L.siteTruckX, turnX = park + 1.4 * u;
  const offRight = Math.max(view.vx1, L.plotX1) + 0.6 * u;
  const sm = (k: number) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const seg = (k: number, a: number, b: number) => (k - a) / (b - a);
  let x0 = park, face = 1, speed = 0; // speed: px/s along +x (wheel roll + pitch)
  const k = tr.dur > 0 ? Math.min(1, tr.t / tr.dur) : 0;
  switch (tr.state) {
    case 'ARRIVING':
      if (k < 0.62) { x0 = offRight + (turnX - offRight) * (1 - Math.pow(1 - seg(k, 0, 0.62), 2)); face = -1; speed = -1; }
      else if (k < 0.76) { x0 = turnX; face = -Math.cos(Math.PI * sm(seg(k, 0.62, 0.76))); }
      else { x0 = turnX + (park - turnX) * sm(seg(k, 0.76, 1)); face = 1; speed = -1; }
      break;
    case 'TO_SITE': x0 = park + (site - park) * sm(k); speed = k < 1 ? 1 : 0; break;
    case 'UNLOADING': x0 = site; break;
    case 'RETURNING':
      if (k < 0.12) { x0 = site; face = Math.cos(Math.PI * sm(seg(k, 0, 0.12))); }
      else if (k < 0.72) { x0 = site + (turnX - site) * sm(seg(k, 0.12, 0.72)); face = -1; speed = -1; }
      else if (k < 0.84) { x0 = turnX; face = -Math.cos(Math.PI * sm(seg(k, 0.72, 0.84))); }
      else { x0 = turnX + (park - turnX) * sm(seg(k, 0.84, 1)); face = 1; speed = -1; }
      break;
    case 'NONE': x0 = offRight + len * 2; break;
  }
  const cx = x0 + len / 2;
  // bed occupies the rear 66% of the truck: behind the cab on whichever side the truck faces
  const bedW = len * 0.66 * Math.max(0.05, Math.abs(face));
  const bed: [number, number] = face >= 0 ? [cx - len / 2 * Math.abs(face), cx - len / 2 * Math.abs(face) + bedW] : [cx + len / 2 * Math.abs(face) - bedW, cx + len / 2 * Math.abs(face)];
  return { x0, cx, len, y: L.roadY, u, face, speed, moving: speed !== 0, bed, visible: tr.state !== 'NONE', rear: face >= 0 ? x0 : x0 + len, front: face >= 0 ? x0 + len : x0 };
}

export function presentSurface(events: SurfaceEvent[], dt: number) {
  const L = surfaceLayout(), s = faceScale();
  const near = surfaceVol();
  for (const e of events) {
    if (e.type === 'firstSaleStart') { say("Raw rubble isn't worth much."); setTimeout(() => say('But processed material is.'), 1600); }
    else if (e.type === 'contractorSold') {
      if (Math.random() < Math.min(0.9, (e.qty ?? 0) * 0.6)) arc(L.hopperX + rnd(-10, 10), L.gy - 10, L.stackX + L.u * 0.6 + rnd(-8, 8), L.roadY - L.u * 0.7, rnd(0.35, 0.45), rubbleCol(S.raw), rnd(2, 3) * s);
    } else if (e.type === 'firstSaleDone') {
      popup(L.stackX, L.gy - L.u * 2.2, '+' + money(e.cash ?? 0), '#ffd84a', 30 * Math.sqrt(fxk()), { life: 2.6, pop: 0.6, sub: `SEED MONEY · ${fmt(e.qty ?? 0)} RUBBLE`, rise: 0.4 });
      playSting();
      setTimeout(() => { if (!S.yard) say('Here. Build a Recycling Yard and press it into blocks.', true); }, 1800);
    } else if (e.type === 'pressed') {
      SV.pressT = 0;
      playThud(0.5 * near);
      for (let i = 0; i < 5; i++) addPart({ kind: 'dust', x: L.pressX + rnd(-L.u * 0.3, L.u * 0.3), y: L.gy - L.u * 0.35, vx: rnd(-40, 40), vy: rnd(-30, -5), size: rnd(3, 6) * fxk(), col: rubbleCol(S.goods).replace('rgb', 'rgba').replace(')', ',1)'), life: rnd(0.4, 0.7), floor: Infinity, bounce: 0 });
    } else if (e.type === 'truckArrive') {
      playRoll(near * 0.7);
    } else if (e.type === 'truckLoad') {
      SV.blocksIn += e.qty ?? 0;
      while (SV.blocksIn >= 2) { // one flying block per couple of units
        SV.blocksIn -= 2;
        const p = truckPose();
        arc(L.stackX + rnd(-L.u * 0.3, L.u * 0.3), L.gy - L.u * 0.5, p.bed[0] + (p.bed[1] - p.bed[0]) * rnd(0.1, 0.9), p.y - L.u * 1.05, rnd(0.35, 0.5), rubbleCol(S.truck.load), L.u * 0.12);
      }
    } else if (e.type === 'truckDepart') {
      const p = truckPose();
      exhaust(p.cx - p.face * p.len * 0.17, p.y - L.u * 1.95, 4); // the stack behind the cab
      playRoll(near * 0.8);
    } else if (e.type === 'truckAtSite') {
      playBrake(near * 0.6);
    } else if (e.type === 'siteUnload') {
      SV.blocksOut += e.qty ?? 0;
      while (SV.blocksOut >= 2) { // blocks fly from the bed onto the plot's material stack
        SV.blocksOut -= 2;
        const p = truckPose();
        arc(p.bed[0] + (p.bed[1] - p.bed[0]) * rnd(0.1, 0.9), p.y - L.u * 1.05, L.plotX0 + L.u * rnd(0.6, 1.5), L.gy - L.u * 0.3, rnd(0.35, 0.5), rubbleCol(S.build.material), L.u * 0.12);
      }
    } else if (e.type === 'truckReturned') {
      playBrake(near * 0.4);
    }
  }
  // exhaust puffs while the truck slows into the bay
  if (S.truck.state === 'ARRIVING' && S.truck.t > S.truck.dur * 0.6 && Math.random() < dt * 3) { const p = truckPose(); exhaust(p.cx - p.face * p.len * 0.17, p.y - L.u * 1.95, 1); }
  // machines turn only while there is material to process
  const working = S.yard && SV.buildT >= 1 && S.raw.qty > 0.01;
  if (working) SV.spin += dt * (2.4 + 0.5 * S.upg.processSpeed);
  SV.pressT += dt;
  if (working && Math.random() < dt * 2.5) {
    addPart({ kind: 'dust', x: L.hopperX + rnd(-L.u * 0.3, L.u * 0.3), y: L.gy - L.u * 1.2, vx: rnd(-20, 20), vy: rnd(-25, -5), size: rnd(3, 6) * fxk(), col: rubbleCol(S.raw).replace('rgb', 'rgba').replace(')', ',1)'), life: rnd(0.4, 0.7), floor: Infinity, bounce: 0 });
  }
  if (SV.speech && !SV.speech.hold) { SV.speech.t += dt; if (SV.speech.t > 3) SV.speech = null; }
  // yard construction: frame, hopper, drum, auger, press, lights — with hammer knocks
  if (S.yard && SV.buildT < 1) {
    SV.buildT = Math.min(1, SV.buildT + dt / CFG.yard.buildSecs);
    SV.knockT -= dt;
    if (SV.knockT <= 0 && SV.buildT < 0.92) { SV.knockT = 0.2; playKnock(near); }
    if (SV.buildT >= 1) playSting();
  }
  if (S.yard && SV.buildT >= 1 && SV.contractorGone < 1) SV.contractorGone = Math.min(1, SV.contractorGone + dt / 3);
}

/** Called by the panel when the Recycling Yard is bought. */
export function yardPurchased() {
  SV.buildT = 0; SV.knockT = 0;
  say("Now we're in business.");
  playPurchase();
}

/** Surface sounds fade when the camera is deep underground. */
function surfaceVol() {
  const gy = yOf(0), H = view.H;
  const off = gy < 0 ? -gy : gy > H ? gy - H : 0;
  return Math.max(0.15, 1 - off / (H * 1.5));
}

// ---- worksite expansion: whistle, beeps, the BOOM ----
export function presentExpansion(events: ExpEvent[]) {
  for (const e of events) {
    if (e === 'whistle') playWhistle();
    else if (e === 'beep') playBeep();
    else if (e === 'boom') {
      playBlast(); duckMusic();
      hitStop(90);
      impulse(CFG.impulse.crit * 3.2, rnd(-0.4, 0.4), 1);
      const mat = materialAt(S.depth), s = faceScale();
      // dust fills the new chamber; rocks fly off the old walls
      for (let i = 0; i < 70; i++) {
        const p = toScreen(rnd(0, face.w), rnd(-140, 0));
        addPart({ kind: 'dust', x: p.x, y: p.y, vx: rnd(-90, 90), vy: rnd(-60, 20), size: rnd(8, 18) * fxk(), col: mat.dust + '1)', life: rnd(1.2, 2.4), floor: Infinity, bounce: 0 });
      }
      for (const side of [0, face.w]) {
        for (let i = 0; i < 26; i++) {
          const p = toScreen(side + rnd(-30, 30), rnd(-130, -10));
          const a = side ? rnd(-Math.PI * 0.9, -Math.PI * 0.55) : rnd(-Math.PI * 0.45, -Math.PI * 0.1), v = rnd(200, 460);
          addPart({ kind: 'frag', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: rnd(-14, 14), size: rnd(2.5, 5) * s, col: fragColor(mat), life: rnd(0.8, 1.3), floor: toScreen(0, 0).y + rnd(0, 6), bounce: 0.25, shape: true });
        }
      }
      FX.banner = { s: 'WORK CHAMBER', sub: 'Room for a bigger crew — and an Excavator', t: 0 };
    }
  }
}
