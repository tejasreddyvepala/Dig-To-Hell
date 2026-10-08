// MINE DARKNESS + WORK LAMPS (Visual Pass 3A). Underground is dark; light comes from physical lamps.
//   • A darkness mask (half resolution, rebuilt each frame: one gradient fill + a handful of radial "holes") is laid
//     over everything below ground. Each lamp punches a soft pool out of it, so light falls off with distance and the
//     shaft reads DARK → warm pool → DARK.
//   • Lamps are physical fixtures attached to structure (cross beams, wall caps, posts, the rest platform), placed at
//     an irregular world-anchored rhythm; one strong work lamp hangs over the active floor.
//   • After the mask: a small warm halo per bulb (additive) and the fixture itself, so the bulb stays the brightest
//     point and the light reads as attached to it. No blur, no bloom.
import { fossilSpots } from './hellscene';
import { CFG, FINDS } from './config';
import { FX } from './fx';
import { PAL, beam } from './art';
import { hash } from './util';
import { ctx, faceScale, shaftCX, shaftW, toScreen, view, viewTop, yOf } from './view';
import { chamberM, deepFindPos, LEDGE_CREW, LEDGES, pocketH, worksiteDef, shaftOff } from './layout';
import { S } from './state';
import { face } from './digface';
import { restAreaBuilt, workers } from './workers';
import { miner } from './miner';
import { materialAt, materialAtXY } from './geo';

const DARK = 0.62; // underground darkness away from any lamp (grows a little with depth: see darkAt)
const darkAt = () => DARK + 0.14 * Math.min(1, view.camDepth / 300); // descent gets darker
/** 1 when the view is underground, fading to 0 as the surface fills the frame (Yard/Build views stay untouched). */
export function undergroundK() {
  const gy = yOf(0), h = view.vy1 - view.vy0;
  return Math.max(0, Math.min(1, 1 - (gy - view.vy0) / (h * 0.7)));
}
const LEVEL = 8; // matches the timber levels in rockwall.ts

interface Lamp { x: number; y: number; r: number; s: number; fx: 'hang' | 'wall' | 'bulb' | 'none'; cable: number; dir: number; warm: number; arm?: number }

/** Lamps visible this frame (screen/virtual coords). `spanM`: depth below which there are no spreaders/ledges. */
export function mineLamps(spanM: number): Lamp[] {
  const k = faceScale(), cx = shaftCX(), sw = shaftW(), X = (lx: number) => cx - sw / 2 + lx * k;
  const lamps: Lamp[] = [];
  const floorM = view.camDepth, top = viewTop() + view.vy0 / CFG.ppm, bot = viewTop() + view.vy1 / CFG.ppm;
  const ceil = worksiteDef().ceiling, wallBotM = floorM - (pocketH() * k) / CFG.ppm, cm = chamberM();
  const roomTopM = cm === null ? NaN : cm - (ceil * k) / CFG.ppm;
  // structural lamps on the timber levels (placement rule shared with the timber: see structuralLamp)
  const S0 = { r: 72 * k, s: 0.88, cable: 0, warm: 0.8 };
  for (let j = Math.max(0, Math.floor(top / LEVEL) - 1); j * LEVEL < Math.min(bot, wallBotM - 5); j++) {
    const at = structuralLamp(j, spanM);
    if (!at || (cm !== null && j * LEVEL + 2.5 > roomTopM - 4 && j * LEVEL + 2.5 < cm + 2)) continue; // none inside the room
    const m = j * LEVEL + 2.5, y = yOf(m), yl = yOf(m + 3.2);
    // level 2 (work ledge / transport landing): a clear pocket; level 3 (wall cap): a small accent
    const L2 = { ...S0, r: 92 * k, s: 0.95, warm: 1 };
    if (at === 'ledge') lamps.push({ ...L2, x: X(52), y: yl + 12 * k, fx: 'wall', dir: -1 }); // under the work ledge, by the ladder
    else if (at === 'landing') lamps.push({ ...L2, x: X(182), y: yl + 12 * k, fx: 'wall', dir: 1 }); // under the transport landing
    else if (at === 'left') lamps.push({ ...S0, x: X(14), y: y + 13 * k, fx: 'wall', dir: 1 }); // left wall cap
    else lamps.push({ ...S0, x: X(246), y: y + 13 * k, fx: 'wall', dir: -1 }); // transport-side wall cap
  }
  // the active floor: one strong work lamp on a bracket off the transport guide post, over the miners
  const fy = yOf(floorM), lampY = fy - (ceil ? Math.min(ceil - 20, 92) : 92) * k;
  if (lampY > yOf(4)) lamps.push({ x: X(150), y: fy - (ceil ? Math.min(ceil - 20, 92) : 92) * k, r: 90 * k, s: 1, fx: 'hang', cable: 14 * k, dir: 0, warm: 1, arm: X(209) });
  if (lampY > yOf(4)) lamps.push({ x: X(128), y: fy - 30 * k, r: 140 * k, s: 1, fx: 'none', cable: 0, dir: 0, warm: 1.25 }); // where that light lands
  // headlamps: a small warm patch where each working miner's cone reaches the face
  const o = toScreen(0, 0);
  for (const w of workers) if (w.id === 'dig' && w.state === 'work')
    lamps.push({ x: o.x + (w.x + w.dir * CFG.miner.reach * CFG.crewScale) * k, y: o.y + 2 * k, r: 20 * k, s: 0.4, fx: 'none', cable: 0, dir: 0, warm: 0.35 });
  lamps.push({ x: o.x + (miner.x + miner.dir * CFG.miner.reach * CFG.playerScale) * k, y: o.y + 2 * k, r: 20 * k, s: 0.4, fx: 'none', cable: 0, dir: 0, warm: 0.35 });
  // floor work lamps: on the stair post (left) and the transport post (right), at the work level
  for (const [lx, d, h] of [[18, 1, 46], [214, -1, 74]] as const) { // (the transport post ends 62 above the floor)
    const ly = fy - h * k;
    if (ly > yOf(4) && ly > view.vy0 - 80 && ly < view.vy1 + 80) lamps.push({ x: X(lx), y: ly, r: 78 * k, s: 0.85, fx: 'wall', cable: 0, dir: d, warm: 0.85 });
  }
  // rest platform: the existing hanging bulb gets its cozy pool (secondary focal point)
  if (restAreaBuilt()) {
    const p = toScreen(30, CFG.rest.platformY - 28);
    lamps.push({ x: p.x, y: p.y, r: 70 * k, s: 0.9, fx: 'hang', cable: 0, dir: 0, warm: 0.8 }); // rest lantern
    const q = toScreen(34, CFG.rest.platformY - 6); // boards, bench and sign under the bulb
    lamps.push({ x: q.x, y: q.y, r: 42 * k, s: 0.6, fx: 'none', cable: 0, dir: 0, warm: 0.5 });
  }
  // Work Chamber bay lamps (existing fixtures)
  if (ceil) {
    const off = shaftOff();
    for (const lx of [(70 + off) / 2, (off + CFG.face.logicalW + face.w) / 2]) {
      const p = toScreen(lx, (cm === null ? 0 : (yOf(cm) - toScreen(0, 0).y) / k) - ceil + 32);
      lamps.push({ x: p.x, y: p.y, r: 100 * k, s: 0.8, fx: 'hang', cable: 10 * k, dir: 0, warm: 0.8 }); // chamber bay lamp on its chain
    }
  }
  { // the Gates of Hell light the bottom of the mine (from 940 m; blazing once open)
    const p = Math.max(0, Math.min(1, (S.depth - 940) / 60));
    if (p > 0) { const fy = yOf(S.depth), w = sw * 0.62; lamps.push({ x: cx, y: fy - w * 0.45, r: w * (0.8 + 0.4 * p), s: Math.min(1, 0.5 + 0.5 * p), fx: 'none', cable: 0, dir: 0, warm: 1.2 }); }
  }
  { // the Hell layer: lava light from below + light on the giant fossils (hellscene.ts)
    const hk = Math.max(0, Math.min(1, (S.depth - 930) / 30));
    if (hk > 0) {
      const fy = yOf(S.depth), R = Math.max(sw / 2, (face.w / 2) * k);
      for (let i = 0; i < 5; i++) lamps.push({ x: cx + (-0.9 + i * 0.45) * R, y: fy + 70 * k, r: 150 * k, s: 0.5 * hk, fx: 'none', cable: 0, dir: 0, warm: 1.3 });
      const fs = fossilSpots(); // the side caverns with the giant fossils glow with lava light
      lamps.push({ x: fs.ribs.x, y: fs.ribs.y, r: 170 * k, s: 0.95 * hk, fx: 'none', cable: 0, dir: 0, warm: 1.15 });
      lamps.push({ x: fs.skull.x - 20 * k, y: fs.skull.y, r: 175 * k, s: 0.95 * hk, fx: 'none', cable: 0, dir: 0, warm: 1.15 });
    }
  }
  // every bridge carries a lantern under its deck (the frame reads as a structure all the way down)
  for (const L of LEDGES) if (L.kind === 'bridge') lamps.push({ x: L.x0 + (L.x1 - L.x0) * 0.52, y: L.y + 17 * k, r: 82 * k, s: 0.85, fx: 'hang', cable: 6 * k, dir: 0, warm: 0.8 });
  // miners on the shaft ledges: their headlamps light a little of the rock they work
  for (const c of LEDGE_CREW) lamps.push({ x: c.x + c.dir * 10 * k, y: c.y - 30 * k, r: 30 * k, s: 0.55, fx: 'none', cable: 0, dir: 0, warm: 0.4 });
  // discovered finds get a small display lamp (they stay visible in the dark: the crew put a light on them)
  FINDS.forEach((f, i) => {
    if (i >= S.found || f.kind === 'coin' || f.kind === 'car') return;
    const p = deepFindPos(f);
    if (p.y > view.vy0 - 80 && p.y < view.vy1 + 80) lamps.push({ x: p.x, y: p.y, r: 48 * k, s: 0.95, fx: 'none', cable: 0, dir: 0, warm: 0.7 });
  });
  for (const rg of FX.rings) { const q = 1 - rg.t / CFG.critFx.ringSecs; if (q > 0) lamps.push({ x: rg.x, y: rg.y, r: 60 * k, s: 0.7 * q, fx: 'none', cable: 0, dir: 0, warm: 0.9 * q }); }
  return lamps.filter((l) => l.y > view.vy0 - l.r && l.y < view.vy1 + l.r);
}

/** Where (if anywhere) the structural lamp on timber level j hangs: under a work ledge (by the ladder), under a
 *  transport landing, or under a wall cap — never mid-shaft. Irregular (~4 in 10 levels). The left wall from the rest
 *  platform down is reserved for the rest bulb. Shared with rockwall.ts so the timber exists exactly where it's needed. */
const baseLamp = (j: number) => hash(j * 2.71 + 0.3) >= 0.45; // ~half the levels carry a lamp
export function structuralLamp(j: number, spanM: number): 'ledge' | 'landing' | 'left' | 'right' | null {
  const m = j * LEVEL + 2.5;
  // the base rhythm is irregular; a level after two dark ones always gets a lamp, so the shaft never goes dead for long
  // (a pure function of the world level — the same lamps every visit)
  if (m < 10 || !(baseLamp(j) || (!baseLamp(j - 1) && !baseLamp(j - 2) && j > 1))) return null;
  const upper = m < spanM, k = faceScale(), y = yOf(m), rz = restZoneY();
  if (upper && j % 2 === 1 && yOf(m + 3.2) + 12 * k < rz) return 'ledge';
  if (upper && j % 4 === 2) return 'landing';
  if (hash(j * 5.3 + 1.1) >= 0.6) return 'right';
  return y + 13 * k > rz ? 'right' : 'left';
}
/** Screen y below which the left wall belongs to the rest nook (no structural lamps or work ledges). */
export function restZoneY() {
  return restAreaBuilt() ? toScreen(0, CFG.rest.platformY - 75).y - 20 * faceScale() : Infinity;
}

let mask: HTMLCanvasElement | null = null;
const RES = 0.75; // darkness mask resolution (smooth pool edges on hi-dpi)

/** Darkness over everything underground, with soft pools punched out at each lamp. */
export function drawMineDarkness(lamps: Lamp[]) {
  const gy = yOf(0), x0 = view.vx0, y0 = view.vy0, w = view.vx1 - view.vx0, h = view.vy1 - view.vy0;
  const f = undergroundK();
  if (gy > view.vy1 || f < 0.02) return; // all sky / surface view
  const mw = Math.ceil(w * RES), mh = Math.ceil(h * RES);
  if (!mask) mask = document.createElement('canvas');
  if (mask.width !== mw || mask.height !== mh) { mask.width = mw; mask.height = mh; }
  const m = mask.getContext('2d')!;
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, mw, mh);
  m.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
  // darkness grows over the first metres below the surface, then holds
  const g = m.createLinearGradient(0, gy + 3 * CFG.ppm, 0, gy + 14 * CFG.ppm); // daylight → dim → dark
  const dc = (materialAt(view.camDepth).dark ?? [10, 6, 4]).join(','); // each layer has its own darkness colour
  g.addColorStop(0, `rgba(${dc},0)`); g.addColorStop(1, `rgba(${dc},${darkAt() * f})`);
  m.fillStyle = g; m.fillRect(x0, Math.max(y0, gy), w, y0 + h - Math.max(y0, gy));
  // light pools: falloff with distance from each lamp
  m.globalCompositeOperation = 'destination-out';
  { // the rock walls keep a little ambient (bounce) light; the open shaft centre stays dark
    const cx = shaftCX(), sw = shaftW(), top = Math.max(y0, gy + 3 * CFG.ppm);
    m.fillStyle = 'rgba(0,0,0,.2)';
    m.fillRect(x0, top, cx - sw / 2 + 30 * faceScale() - x0, y0 + h - top);
    m.fillRect(cx + sw / 2 - 30 * faceScale(), top, x0 + w - (cx + sw / 2 - 30 * faceScale()), y0 + h - top);
  }
  for (const l of lamps) {
    // pools are a little wider than tall: they hug the walls and the floor
    m.save(); m.translate(l.x, l.y); m.scale(1.12, 0.88);
    const rg = m.createRadialGradient(0, 0, 0, 0, 0, l.r);
    rg.addColorStop(0, `rgba(0,0,0,${l.s})`); rg.addColorStop(0.5, `rgba(0,0,0,${l.s * 0.7})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = rg; m.beginPath(); m.arc(0, 0, l.r, 0, 6.283); m.fill(); m.restore();
  }
  // lamp arms are structure: drawn before the darkness so they sit in the same light as the timber
  for (const l of lamps) if (l.arm !== undefined) {
    const k = faceScale(), ya = l.y - l.cable - 3 * k - 5 * k;
    beam(Math.min(l.x, l.arm) - 3 * k, ya, Math.abs(l.arm - l.x) + 3 * k, 5 * k, PAL.wood, 'mid');
    ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 2.4 * k;
    ctx.beginPath(); ctx.moveTo(l.arm - 2 * k, ya + 22 * k); ctx.lineTo(l.arm - 22 * k, ya + 5 * k); ctx.stroke(); // knee brace
  }
  ctx.drawImage(mask, x0, y0, w, h);
  // warm light in the pools + the bulb halo (additive, small)
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = f;
  const red = Math.max(0, Math.min(1, (view.camDepth - 200) / 100));
  for (const l of lamps) {
    const og = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    const a = Math.min(0.85, 0.55 * l.warm);
    og.addColorStop(0, `rgba(255,${(214 - red * 30) | 0},${(150 - red * 40) | 0},${a})`); og.addColorStop(0.35, `rgba(244,${(178 - red * 30) | 0},${(104 - red * 30) | 0},${a * 0.75})`); og.addColorStop(1, 'rgba(190,130,80,0)'); // amber; redder deep down
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.283); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lamps) {
    if (l.fx === 'none') continue;
    const fl = 1 + 0.03 * Math.sin(view.t * 2.3 + l.x * 0.07), hr = 19 * faceScale() * (0.7 + 0.3 * l.warm) * fl;
    const hg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, hr);
    hg.addColorStop(0, 'rgba(255,220,140,.62)'); hg.addColorStop(0.35, 'rgba(255,170,80,.28)'); hg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(l.x, l.y, hr, 0, 6.283); ctx.fill();
  }
  // a few slow dust motes drifting in each lamp's light
  ctx.fillStyle = 'rgba(255,226,170,.35)';
  for (const l of lamps) {
    if (l.fx === 'none') continue;
    for (let q = 0; q < 5; q++) {
      const ph = hash(l.x * 0.13 + q * 7.1), a = view.t * (0.15 + ph * 0.2) + ph * 6.28;
      const mx = l.x + Math.cos(a) * l.r * (0.2 + ph * 0.4), my = l.y + l.r * 0.15 + Math.sin(a * 1.3) * l.r * 0.3;
      ctx.beginPath(); ctx.arc(mx, my, 0.9 * faceScale(), 0, 6.283); ctx.fill();
    }
  }
  ctx.restore();
  // fixtures on top: cable/bracket, cap, cage, bright bulb
  for (const l of lamps) if (l.fx !== 'none') drawFixture(l);
}

// world-anchored gem glints are a pure function of their cell: cache them (the geology lookup is the costly part)
interface Glint { m: number; wx: number; col: string; r: number; sp: number; ph: number }
const glints = new Map<number, Glint | null>();
function glintAt(mj: number, xi: number, cell: number): Glint | null {
  const key = mj * 4096 + xi;
  let g = glints.get(key);
  if (g !== undefined) return g;
  const hsh = hash(mj * 31.7 + xi * 7.13);
  g = null;
  if (hsh <= 0.06) {
    const m = (mj + hash(hsh * 9.1)) * cell, wx = (xi + hash(hsh * 5.3)) * cell, mat = materialAtXY(m, wx);
    if (mat.ore) g = { m, wx, col: mat.ore[Math.floor(hash(hsh * 3.7) * mat.ore.length)].join(','), r: 1.4 + hash(hsh * 2.2) * 1.6, sp: 1.2 + hash(hsh) * 1.5, ph: hsh * 40 };
  }
  if (glints.size > 40000) glints.clear();
  glints.set(key, g);
  return g;
}

/** The deep layers glitter in the dark: world-anchored gems in the walls twinkle (drawn after the darkness, so they
 *  read as catching the light), hot layers glow from below and drift embers. Presentation only. */
export function drawLayerMagic() {
  const f = undergroundK();
  if (f < 0.05) return;
  const k = faceScale(), cx = shaftCX(), sw = shaftW(), top = viewTop() + view.vy0 / CFG.ppm, bot = viewTop() + view.vy1 / CFG.ppm;
  const cell = 1.6, floorY = yOf(view.camDepth), inner0 = cx - sw / 2 + 34 * k, inner1 = cx + sw / 2 - 34 * k;
  ctx.save(); ctx.globalAlpha = f;
  for (let mj = Math.max(1, Math.floor(top / cell)); mj * cell < bot; mj++) {
    const mBand = materialAt(mj * cell);
    if (!mBand.ore && !(materialAt(mj * cell + 30).ore)) continue;
    for (let xi = Math.floor((view.vx0 - cx) / (cell * CFG.ppm)) - 1; (xi * cell * CFG.ppm) + cx < view.vx1; xi++) {
      const g = glintAt(mj, xi, cell);
      if (!g) continue;
      const x = cx + g.wx * CFG.ppm, y = yOf(g.m);
      if (x > inner0 && x < inner1 && y < floorY) continue; // nothing floats in the open shaft
      const r = g.r * k * 0.6, tw = Math.max(0, Math.sin(view.t * g.sp + g.ph));
      ctx.fillStyle = `rgba(${g.col},${(0.35 + 0.35 * tw).toFixed(2)})`;
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
      if (tw > 0.96) { // an occasional small glint (rare: a mine, not a starfield)
        const s = (tw - 0.96) * 25 * r * 1.6;
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(0.5, 0.3 * k);
        ctx.beginPath(); ctx.moveTo(x - s, y - r * 0.3); ctx.lineTo(x + s, y - r * 0.3); ctx.moveTo(x, y - r * 0.3 - s); ctx.lineTo(x, y - r * 0.3 + s); ctx.stroke();
      }
    }
  }
  // hot layers: a red heat glow rising from below + embers drifting up
  const heat = Math.max(0, Math.min(1, (view.camDepth - 840) / 80));
  if (heat > 0) {
    const g = ctx.createLinearGradient(0, view.vy1, 0, view.vy0);
    g.addColorStop(0, `rgba(255,70,20,${(0.28 * heat).toFixed(3)})`); g.addColorStop(0.5, `rgba(255,60,10,${(0.08 * heat).toFixed(3)})`); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(view.vx0, view.vy0, view.vx1 - view.vx0, view.vy1 - view.vy0);
    for (let i = 0; i < 18 * heat; i++) {
      const ph = hash(i * 3.3), life = 4 + ph * 4, t = ((view.t + ph * life) % life) / life;
      const ex = view.vx0 + hash(i * 7.7) * (view.vx1 - view.vx0) + Math.sin(view.t * 0.8 + i) * 20, ey = view.vy1 - t * (view.vy1 - view.vy0) * 0.9;
      ctx.fillStyle = `rgba(255,${150 + (ph * 80) | 0},60,${(0.8 * (1 - t)).toFixed(3)})`; ctx.fillRect(ex, ey, 2 * k * 0.6, 2 * k * 0.6);
    }
  }
  ctx.restore();
}

function drawFixture(l: Lamp) {
  const k = faceScale(), b = 2.6 * k;
  ctx.strokeStyle = '#1e1a16'; ctx.fillStyle = '#26211c'; ctx.lineWidth = Math.max(1, 0.7 * k);
  if (l.fx === 'hang') {
    ctx.beginPath(); ctx.moveTo(l.x, l.y - l.cable - 3 * k); ctx.lineTo(l.x, l.y - 3 * k); ctx.stroke();
    ctx.fillRect(l.x - 2.4 * k, l.y - 4 * k, 4.8 * k, 2 * k); // cap
  } else if (l.fx === 'wall') {
    ctx.lineWidth = Math.max(1.2, 1.1 * k);
    ctx.beginPath(); ctx.moveTo(l.x - l.dir * 7 * k, l.y - 4 * k); ctx.lineTo(l.x, l.y - 4 * k); ctx.lineTo(l.x, l.y - 2.5 * k); ctx.stroke(); // bracket
    ctx.fillRect(l.x - 2.4 * k, l.y - 4 * k, 4.8 * k, 2 * k);
  }
  ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.arc(l.x, l.y, b, 0, 6.283); ctx.fill(); // bulb
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(l.x - 0.6 * k, l.y - 0.6 * k, b * 0.45, 0, 6.283); ctx.fill();
  if (l.fx !== 'bulb') { // wire cage
    ctx.strokeStyle = 'rgba(40,34,28,.85)'; ctx.lineWidth = Math.max(0.8, 0.5 * k);
    ctx.beginPath(); ctx.moveTo(l.x - b, l.y - 1 * k); ctx.lineTo(l.x - b * 0.6, l.y + b); ctx.lineTo(l.x + b * 0.6, l.y + b); ctx.lineTo(l.x + b, l.y - 1 * k);
    ctx.moveTo(l.x, l.y - 2 * k); ctx.lineTo(l.x, l.y + b); ctx.stroke();
  }
}

/** The same grade as a colour transform (rubble, cart load): desaturated toward the ground's earthy darks. */
export function undergroundGrade(c: [number, number, number]): [number, number, number] {
  const k = undergroundK();
  if (k < 0.01) return c;
  const lum = (c[0] + c[1] + c[2]) / 3, d = 1 - 0.22 * k;
  return [0, 1, 2].map((i) => (c[i] * (1 - 0.45 * k) + lum * 0.45 * k) * d) as [number, number, number];
}

/** Pull the underground geology / dig face toward neutral (the orange slab blends into the rock mass). */
export function desaturate(x: number, y: number, w: number, h: number, a: number) {
  a *= undergroundK();
  if (w <= 0 || h <= 0 || a < 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128,128,128,${a})`; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.fillStyle = `rgba(22,14,9,${a * 0.5})`; ctx.fillRect(x, y, w, h); // and a little darker/earthier
}

