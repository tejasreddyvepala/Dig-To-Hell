// Draws the world, the destructible dig face, miner/crew, FX and HUD overlays. Reads state; never mutates sim.
import { CFG, FINDS, MATERIALS, MAX_DEPTH, TOOLS, type Find, type Tool } from './config';
import { S } from './state';
import { cartCapacity, mixPick, pileCap, tierOf, trackSafe, gearOf } from './economy';
import { materialAt, rubbleRGB } from './geo';
import { DUG } from './sim';
import { drawSurface, drawTruckLayer, flushGlows } from './yard';
import { bubble, pileHeight, pileLabel } from './draw';
import { cartBlocked, cartDepth, cartFill, cartTrackStress } from './cart';
import { TRACKUP } from './track';
import { reinforceY } from './trackfx';
import { drawDrill, drawExcavator, drawExcavatorLight, drawLampBeam, drawSaw } from './characters';
import { RIG_H, drawRig, lookFor, type Look, type Pose } from './rig';
import { ladderFrame } from './ladder';
import { PAL, beam, contactShadow, outline, post, texture } from './art';
import { bedRock, rockEdge, rockiness } from './rockwall';
import { cluster, dimPal, drawCluster, palAt, palById, palOf, setRockLights, setRockSpace } from './bedrock';
import { desaturate, drawLayerMagic, drawMineDarkness, mineLamps, undergroundGrade, undergroundK } from './minelight';
import { drawWallDepthRamp } from './rockwall';
import { drawCollar, drawEdgeRocks, drawInnerCut, drawRearFrame, drawRearWall, drawRockMass, drawTimberSets, drawRoomCatwalk, interiorPath, type ShaftGeom } from './rockwall';
import { face, type Chunk, type Crack, type Mark } from './digface';
import { drawFinaleOverlay, drawHellLife, gateOpen } from './finale';
import { drawLava } from './lava';
import { drawHellBack, drawHellFront } from './hellscene';
import { crewPops, pathPos, restAreaBuilt, restingCount, seatsTotal, workers, type Worker } from './workers';
import { cartX, chamberM, pileX, pocketH, POCKET_L, POCKET_R, railX, shaftOff, worksiteDef, deepFindPos, LEDGES, LEDGE_CREW } from './layout';
import { EXP, chargeSpots, expanding } from './expansion';
import { drawSite, drawSiteFront, drawSiteStack } from './site';
import { miner, minerSwingAngle, swingAngle } from './miner';
import { FX, addPart, drawPopups, drawWorldFx, popup } from './fx';
import { applyZoom, cartScreen, ctx, faceOrigin, faceScale, faceY, shaftCX, shaftW, toScreen, view, viewTop, yOf } from './view';
import { drawGeology } from './geo';
import { drawGround, drawLandscape, drawSurfaceGrade, nightness } from './landscape';
import { fmt, hash, rgb, rgba, rnd } from './util';

const FONT_DISPLAY = "'Bungee',Impact,sans-serif";
const FONT_UI = "'Rubik',system-ui,sans-serif";
const TOUCH = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })(); // 'Tap' vs 'Click' wording
const M = CFG.miner;
const IMPACT_AT = (M.windupMs + M.downswingMs) / 1000;

// ---------- dig face ----------
function polyPath(p: number[]) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
  ctx.closePath();
}

function bbox(p: number[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < p.length; k += 2) {
    x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]);
  }
  return { x0, x1, y0, y1 };
}

function strokeCrack(k: Crack) {
  const n = k.pts.length / 2 - 1;
  const segs = k.grow * n;
  ctx.beginPath();
  ctx.moveTo(k.pts[0], k.pts[1]);
  for (let i = 1; i <= Math.ceil(segs); i++) {
    const f = Math.min(1, segs - (i - 1));
    const ax = k.pts[i * 2 - 2], ay = k.pts[i * 2 - 1], bx = k.pts[i * 2], by = k.pts[i * 2 + 1];
    ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
  }
  ctx.stroke();
}

function drawCracks(c: Chunk) {
  // fractures in THIS rock: the bedrock crevice colour (dark warm brown, never black ink), a touch thinner, with a
  // faint warm lit edge — they read as cracks in stone, not scribbles over it
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const cv = palOf(c.mat).crev, crack = `rgba(${cv.map((v) => (v * 1.25) | 0).join(',')},.8)`;
  for (const k of c.cracks) {
    const w = k.w * 0.75;
    if (k.style === 'deep') {
      ctx.strokeStyle = 'rgba(90,110,210,.16)'; ctx.lineWidth = w * 2; strokeCrack(k);
      ctx.strokeStyle = crack; ctx.lineWidth = w; strokeCrack(k);
    } else {
      ctx.strokeStyle = crack; ctx.lineWidth = w; strokeCrack(k);
      if (k.style !== 'hair') { ctx.save(); ctx.translate(0.7, 0.8); ctx.strokeStyle = 'rgba(255,200,150,.16)'; ctx.lineWidth = 0.6; strokeCrack(k); ctx.restore(); }
    }
  }
}

function drawMark(m: Mark) {
  if (m.kind === 'indent') {
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
  } else if (m.kind === 'dent') {
    ctx.fillStyle = 'rgba(40,10,0,.26)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.55, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,160,.2)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, m.r, m.r * 0.55, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (m.kind === 'impact') {
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + m.x, r = m.r * (0.6 + hash(m.y + i) * 0.6);
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.3, 0, 6.283); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
  }
}

function drawTexture(c: Chunk, b: ReturnType<typeof bbox>) {
  const id = c.mat.fam, ore = c.mat.ore;
  if (ore) for (let k = 0; k < 2; k++) { // a couple of gems in the face: faceted, with a rare twinkle
    const hx = b.x0 + hash(c.seed + k * 5.3) * (b.x1 - b.x0), hy = b.y0 + (0.25 + hash(c.seed + k * 2.9) * 0.6) * (b.y1 - b.y0);
    const col = ore[k % ore.length], r = 1.6 + hash(c.seed + k) * 1.8;
    ctx.fillStyle = `rgb(${col.map((v) => v * 0.6 | 0).join(',')})`; ctx.beginPath(); ctx.moveTo(hx, hy - r * 1.4); ctx.lineTo(hx + r, hy); ctx.lineTo(hx, hy + r); ctx.lineTo(hx - r, hy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgb(${col.join(',')})`; ctx.beginPath(); ctx.moveTo(hx, hy - r * 1.4); ctx.lineTo(hx + r, hy); ctx.lineTo(hx, hy + r * 0.2); ctx.closePath(); ctx.fill();
    const tw = Math.sin(view.t * 2.3 + c.seed + k * 1.7);
    if (tw > 0.95) { const s = (tw - 0.95) * 20 * r * 1.2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(hx - s, hy - r * 0.6); ctx.lineTo(hx + s, hy - r * 0.6); ctx.moveTo(hx, hy - r * 0.6 - s); ctx.lineTo(hx, hy - r * 0.6 + s); ctx.stroke(); }
  }
  for (let k = 0; k < 12; k++) {
    const hx = b.x0 + hash(c.seed + k * 3.1) * (b.x1 - b.x0);
    const hy = b.y0 + hash(c.seed + k * 7.7) * (b.y1 - b.y0);
    const r = 0.8 + hash(c.seed + k * 1.3) * (id === 'clay' ? 4 : 2.2);
    if (id === 'stone') ctx.fillStyle = k % 3 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.22)';
    else if (id === 'cave') ctx.fillStyle = k % 4 ? 'rgba(0,0,10,.22)' : 'rgba(150,170,255,.2)';
    else if (id === 'clay') ctx.fillStyle = k % 2 ? 'rgba(90,30,10,.16)' : 'rgba(255,170,120,.12)';
    else ctx.fillStyle = k % 2 ? 'rgba(40,24,10,.25)' : 'rgba(220,180,130,.18)';
    ctx.beginPath();
    if (id === 'clay') ctx.ellipse(hx, hy, r * 1.8, r * 0.6, 0, 0, 6.283);
    else if (id === 'stone') { ctx.moveTo(hx - r, hy); ctx.lineTo(hx, hy - r); ctx.lineTo(hx + r, hy + r * 0.4); }
    else ctx.arc(hx, hy, r, 0, 6.283);
    ctx.fill();
  }
}

/** Chunk polygon with its top edge dipped into a bowl (break crater + camera-sync recess).
 *  Seam endpoints never move, so the face stays one continuous surface. */
function dippedPoly(c: Chunk, s: number): number[] {
  const d = c.recess / s + c.dip;
  if (d < 0.05) return c.poly;
  const p = c.poly.slice(), n = c.top.length - 1;
  c.top.forEach((v, j) => { p[v * 2 + 1] += d * Math.sin((Math.PI * j) / n); });
  return p;
}

const PULSE: Record<string, string> = {
  dirt: 'rgba(255,226,180,', clay: 'rgba(55,14,0,', stone: 'rgba(255,255,255,', cave: 'rgba(170,190,255,',
};

/** The working face: a continuous mass of earth whose top band holds the logical damage regions. */
function drawFace(s: number) {
  const F = CFG.face, W = face.w, cur = materialAt(S.depth);
  // dark inner earth just under the surface: only visible where a break leaves a crater
  const gm = ctx.createLinearGradient(0, F.edgeJitter, 0, F.craterDepth);
  gm.addColorStop(0, rgb(palOf(cur).shadow, 0.8)); gm.addColorStop(1, rgba(palOf(cur).shadow, 0.9, 0));
  ctx.fillStyle = gm;
  ctx.fillRect(0, F.edgeJitter, W, F.craterDepth - F.edgeJitter);

  // chunks share one face-space gradient per material, have no outlines, and differ only by damage
  const grads = new Map<string, CanvasGradient>();
  const grad = (c: Chunk) => {
    let g = grads.get(c.mat.id);
    if (!g) {
      // lit lip -> body -> fades out into the surrounding ground, so the face is the top of a mass, not a strip
      const P = palOf(c.mat), m = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
      g = ctx.createLinearGradient(0, -4, 0, F.height);
      g.addColorStop(0, rgb(m(P.mid, P.lit, 0.55), 1)); g.addColorStop(0.25, rgb(m(P.mid, P.lit, 0.2), 1));
      g.addColorStop(0.65, rgba(P.mid, 0.85, 0.9)); g.addColorStop(1, rgba(P.shadow, 1, 0));
      grads.set(c.mat.id, g);
    }
    return g;
  };
  const polys = face.chunks.map((c) => dippedPoly(c, s));
  // state 4 (about to break): the chunk separates — a dark gap opens around it
  ctx.save(); ctx.beginPath(); ctx.rect(-10, -20, face.w + 20, 20 + F.height * F.crackDepthFrac); ctx.clip(); // only the worked top
  face.chunks.forEach((c, i) => {
    if (c.stage < c.mat.stages - 1 || c.stage < 2) return;
    polyPath(polys[i]); ctx.strokeStyle = 'rgba(14,8,5,.8)'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
  });
  ctx.restore();
  face.chunks.forEach((c, i) => {
    const b = bbox(polys[i]);
    polyPath(polys[i]);
    ctx.fillStyle = grad(c);
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawTexture(c, b);
    texture('rock', b.x0 - 2, b.y0 - 6, b.x1 - b.x0 + 4, F.height + 6, 0.12); // shared rock mottling (face space: never slides)
    const P = palOf(c.mat), stones = c.mat.fam === 'clay' ? 3 : c.mat.fam === 'dirt' ? 4 : 6; // cobbles in the face (clay: fewer)
    for (let q = 0; q < stones; q++) {
      const sx = b.x0 + 3 + hash(c.seed * 3.1 + q * 7.7) * (b.x1 - b.x0 - 6), sy = b.y0 + 4 + hash(c.seed * 5.9 + q * 3.3) * F.height * 0.55;
      const r = (c.mat.fam === 'stone' || c.mat.fam === 'cave' ? 3 : 2.2) + hash(c.seed + q * 1.9) * 3;
      drawCluster(cluster(4000 + (c.seed % 997) * 13 + q, r * 2.4, r * 1.8, hash(c.seed * q) - 0.5, 3, 0), sx, sy, P, 1.3, 1.1);
    }
    for (const m of c.marks) drawMark(m);
    // damage cracks belong to the working face only: they fade out before the face blends into untouched ground
    ctx.beginPath(); ctx.rect(b.x0 - 4, b.y0 - 8, b.x1 - b.x0 + 8, F.height * F.crackDepthFrac + 8); ctx.clip();
    drawCracks(c);
    if (c.reveal > 0) {
      // freshly exposed rock: briefly lighter (fresh stone), fading back
      const cx = (b.x0 + b.x1) / 2, r = (b.x1 - b.x0) * 0.75;
      const g = ctx.createRadialGradient(cx, b.y0 + c.dip, 0, cx, b.y0 + c.dip, r);
      g.addColorStop(0, `rgba(255,214,160,${((0.35 * c.reveal) / F.revealSecs).toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,160,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, b.y0 - 2, r * 2, r + 2);
    }
    ctx.restore();
  });

  // local impact pulses, clipped to the whole face (not to a chunk) so nothing reveals the grid
  if (face.chunks.some((c) => c.pulse)) {
    ctx.save();
    ctx.beginPath();
    for (const p of polys) { ctx.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]); ctx.closePath(); }
    ctx.clip();
    for (const c of face.chunks) {
      const p = c.pulse; if (!p) continue;
      const k = p.t / F.pulseSecs, r = F.pulseRadius * (0.55 + 0.6 * k) * (0.7 + 0.3 * Math.min(1.6, p.k));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const col = PULSE[c.mat.fam];
      g.addColorStop(0, col + (0.65 * Math.min(1, p.k) * (1 - k)).toFixed(3) + ')'); g.addColorStop(1, col + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // one continuous lit lip along the top of the face, with a soft shadow just under it
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lip = () => {
    ctx.beginPath();
    face.chunks.forEach((c, i) => c.top.forEach((v, j) => {
      const x = polys[i][v * 2], y = polys[i][v * 2 + 1];
      i === 0 && j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }));
  };
  ctx.save(); ctx.translate(0, 2.2); lip(); ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  const PC = palOf(cur);
  lip(); ctx.strokeStyle = rgba(PC.lit, 1.05, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
  { const f = FINDS[S.found]; if (f && f.d - S.depth < CFG.findTeaseM && f.d > S.depth) { // something glints in the rock
    const gx = W * (0.3 + 0.4 * hash(S.found * 3.7)), gy = F.height * 0.45, a = 0.35 + 0.35 * Math.sin(view.t * 3);
    ctx.fillStyle = `rgba(255,236,170,${a.toFixed(2)})`; ctx.beginPath();
    ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 1, gy - 1); ctx.lineTo(gx + 4, gy); ctx.lineTo(gx + 1, gy + 1); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 1, gy + 1); ctx.lineTo(gx - 4, gy); ctx.lineTo(gx - 1, gy - 1); ctx.closePath(); ctx.fill(); } }
  face.chunks.forEach((c, i) => { // half-buried stones along the top edge (they belong to their chunk)
    const t = c.top, n = c.mat.fam === 'clay' ? 1 : 2;
    for (let q = 0; q < n && t.length > 1; q++) {
      const v = t[Math.floor(hash(c.seed * 2.3 + q) * t.length)], x = polys[i][v * 2] + (hash(c.seed + q * 4.1) - 0.5) * 8, y = polys[i][v * 2 + 1];
      const r = 2.4 + hash(c.seed * 6.1 + q) * 2.6;
      drawCluster(cluster(4600 + (c.seed % 997) * 7 + q, r * 2.6, r * 2, hash(c.seed * 3.7 + q) - 0.5, 3, 0, 1, true), x, y + r * 0.35, palOf(c.mat), 1.4, 1.15);
    }
  });
}

// ---------- figures (people: rig.ts; machines: characters.ts) ----------
function workerAngle(timer: number, since: number) {
  return timer < IMPACT_AT ? swingAngle(IMPACT_AT - timer) : swingAngle(IMPACT_AT + since);
}
/** Crew pick swing with a human rhythm (presentation only; the strike still lands when the timer hits 0):
 *  a heavier wind-up (0.42 s, ease-out), a fast strike (0.11 s, accelerating), a 0.35 s recovery, then a breath. */
const CW = 0.42, CD = 0.11, CR = 0.35;
function crewAngle(timer: number, since: number) {
  const REST = -0.5, RAISED = -2.5, IMPACT = 1.05;
  if (timer <= CW + CD) { // wind-up then strike, ending exactly at impact (timer 0)
    const t = CW + CD - Math.max(0, timer);
    if (t < CW) { const k = t / CW; return REST + (RAISED - REST) * (1 - (1 - k) ** 3); }
    const k = (t - CW) / CD; return RAISED + (IMPACT - RAISED) * k * k * k;
  }
  if (since < CR) { const k = since / CR; return IMPACT + (REST - IMPACT) * (1 - (1 - k) ** 2); } // recover
  return REST;
}
/** 0..1 swing progress for machines (0 raised, 1 at impact), derived from the same timing as the miners. */
const machineK = (timer: number, since: number) => Math.max(0, Math.min(1, (workerAngle(timer, since) + 0.5) / 1.55));

const PLAYER_LOOK = lookFor('player', 1);
const looks = new Map<number, Look>();
const minerLook = (seed: number) => { let l = looks.get(seed); if (!l) looks.set(seed, (l = lookFor('miner', seed))); return l; };
const RS = CFG.rest;

// ---------- wall-ladder climbing: rung-locked (shared with the construction site, ladder.ts) ----------

/** Pose for a crew member from its behaviour state. */
/** The crew's pick follows Crew Tools: steel → iron → heavy → diamond (same rig, a visibly better tool). */
/** The crew's tool: their GEAR tier picks the tool (picks → jackhammers → diamond drills → hellforge breakers, the same
 *  models the player uses); CREW TOOLS levels make it visibly better within the tier (a bigger head, then a gold, then a
 *  diamond-blue finish). Cached per (gear, level). */
const crewTools = new Map<string, Tool>();
function crewPick(): Tool {
  const g = gearOf(S), lv = S.upg.crewTools, key = `${g.tool}|${lv}`;
  let t = crewTools.get(key);
  if (!t) {
    const base = TOOLS[g.tool], grade = tierOf(lv, CFG.workers.pickTiers); // 0 plain · 1 big · 2 gold · 3 diamond-blue
    t = { ...base, headScale: base.kind === 'pick' ? base.headScale * (1 + 0.04 * Math.min(lv, 15)) : base.headScale * 0.8, head: base.kind === 'pick' ? [base.head, base.head, '#e8b830', '#9be8ff'][grade] : base.head, handle: grade >= 2 && base.kind === 'pick' ? '#2a3a52' : base.handle };
    crewTools.set(key, t);
  }
  return t;
}

function workerPose(w: Worker): Pose {
  switch (w.state) {
    case 'arrive': case 'toRest': case 'back': {
      const p = pathPos(w.path, w.pathT);
      return { k: p.climbing ? 'climb' : 'walk', t: w.pathT * 1.7, lit: w.state !== 'arrive' || w.pathT > 0.3 };
    }
    case 'rest': {
      const c = w.t % 7; // a sip of water now and then
      return { k: 'sit', t: 0, a: c > 3 && c < 5 ? Math.sin(((c - 3) / 2) * Math.PI) : 0, lit: false };
    }
    case 'idle': return { k: w.idle, t: w.t / w.idleDur, tired: restAreaBuilt() ? Math.max(0, Math.min(1, (14 - w.fatigue) / 14)) : 0 };
    default: return { k: crewPick().kind === 'jack' ? 'jack' : 'swing', t: 0, a: crewAngle(w.timer, w.since), tool: crewPick(), tired: restAreaBuilt() ? Math.max(0, Math.min(1, (14 - w.fatigue) / 14)) : 0 };
  }
}

/** Player pose: swinging while digging; after a few quiet seconds, small personality idles. */
function playerPose(): Pose {
  const tool = TOOLS[S.tool];
  const quiet = miner.clock - miner.lastInput;
  if (!miner.pending.length && quiet > 6 && S.tut >= 1) {
    const cyc = (quiet - 6) % 9;
    if (cyc < 2.6) {
      const kinds: Pose['k'][] = ['wipe', 'look', 'helmet', 'drink'];
      return { k: kinds[Math.floor((quiet - 6) / 9) % 4], t: cyc / 2.6 };
    }
    return { k: 'stand', t: 0 };
  }
  return { k: tool.kind === 'jack' ? 'jack' : 'swing', t: 0, a: minerSwingAngle(), tool };
}

/** Miners beyond the few on the work floor are IN the mine: up on the shaft's work ledges and transport landings
 *  (nearest the floor first), chipping at the wall, repairing rails and posts, or checking the rock with a lamp.
 *  Presentation only — they dig at the full rate in the economy. Virtual coords (after drawTimberSets). */
let lastGeom: ShaftGeom | null = null;
function drawLedgeCrew() {
  LEDGE_CREW.length = 0;
  let extra = Math.min(16, S.crew.dig - workers.filter((w) => w.id === 'dig').length); // (at most 16 drawn: the rest are out of sight)
  if (extra <= 0) return;
  const k = faceScale(), sc = CFG.crewScale * k, ladX = shaftCX() - shaftW() / 2 + RS.ladderX * k;
  // FIXED posts in the world: the room catwalk first, then the bridges counted from the floor upward. The assignment
  // depends only on the mine (depth), never on where the camera is — scrolling up shows the same people in the same spots.
  const want = (j: number) => (j < 0 ? 2 + Math.floor(hash(j * 3.71) * 3) : Math.floor(hash(j * 3.71) * 5)); // 0–4 per bridge
  const posts = new Map<number, number>();
  if (worksiteDef().ceiling >= 170) { const n = Math.min(extra, want(-7)); posts.set(-7, n); extra -= n; }
  const LEVEL = 8, lowest = Math.floor((S.depth - (140 * k) / CFG.ppm - 3.2 - 2.5) / LEVEL);
  for (let j = lowest - (lowest % 2 === 0 ? 0 : 1); j >= 2 && extra > 0; j -= 2) { const n = Math.min(extra, want(j)); if (n) posts.set(j, n); extra -= n; }
  for (const L of LEDGES) {
    const n = L.kind === 'bridge' ? posts.get(L.j) ?? 0 : 0;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) { // spread along the deck, clear of the ladder opening and of each other (stable per level)
      for (let tries = 0; tries < 6; tries++) {
        const x = L.x0 + (10 + hash(L.j * 13.1 + i * 7.3 + tries * 2.9) * ((L.x1 - L.x0) / k - 26)) * k;
        if (Math.abs(x - ladX) > 12 * k && xs.every((o) => Math.abs(o - x) > 20 * k)) { xs.push(x); break; }
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i++) {
      // upper crew keep the mine standing: shoring and repairs, carrying timber, wiring and checking the electrics
      const seed = L.j * 7.7 + i * 3.1 + 50, look = minerLook(Math.floor(hash(seed) * 1000) + 3), r = hash(seed * 1.9);
      let x = xs[i], pose: Pose, dir: 1 | -1;
      if (r < 0.3) { // carrying a timber along the bridge
        const span = 22 * k, ph = view.t * 0.35 + hash(seed) * 6.28;
        x += Math.sin(ph) * span; dir = Math.cos(ph) > 0 ? 1 : -1;
        pose = { k: 'carry', t: view.t * 1.6 + seed, carryCol: '#8a6a44' };
      } else if (r < 0.75) { // hammering a post / bracing the deck / fixing a cable hanger
        pose = { k: 'hammer', t: (view.t * 1.1 + hash(seed)) % 1, aim: { x: 13, y: r < 0.5 ? 6 : 18 } }; dir = hash(seed * 3) < 0.5 ? 1 : -1;
      } else { pose = { k: 'look', t: (view.t * 0.25 + hash(seed)) % 1 }; dir = hash(seed * 2) < 0.5 ? 1 : -1; } // inspecting with the lamp
      contactShadow(x, L.y + 0.5, 7 * k, 1.4 * k, 0.35);
      drawRig(x, L.y, sc, dir, look, pose);
      LEDGE_CREW.push({ x, y: L.y, dir });
    }
  }
}

const TIMBER_D = '#4e341d', TIMBER_L = '#8a6238';

/** Face-local y offset of the Work Chamber's floor (0 while the dig floor is still at the blast depth). */
const chamberDy = () => { const cm = chamberM(); return cm === null ? 0 : (yOf(cm) - faceOrigin().y) / faceScale(); };

/** Work Chamber: the carved-out cavity, ceiling, and timber supports (supports go up after the blast) — drawn at the
 *  WORLD depth where it was blasted, never at the moving dig floor. Once the floor has gone on down, the room's bay
 *  floors are rock ledges and the narrow shaft continues out of its middle. */
function drawChamber() {
  const site = worksiteDef();
  if (!site.ceiling) return;
  const dy = chamberDy(), sc = faceScale();
  if (faceOrigin().y + (dy - site.ceiling - 40) * sc > view.vy1 || faceOrigin().y + (dy + 40) * sc < view.vy0) return;
  ctx.save(); ctx.translate(0, dy);
  drawChamberRoom(dy);
  ctx.restore();
}
function drawChamberRoom(dy: number) {
  const site = worksiteDef();
  const w = face.w, h = site.ceiling, off = shaftOff();
  // cavity: carved rock in shadow, a little lighter toward the floor (work lights)
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, 'rgba(10,7,5,.5)'); g.addColorStop(1, 'rgba(30,20,12,.32)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h + 14);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, -h + (x > off - 6 && x < off + CFG.face.logicalW + 6 ? -2 : hash(x * 0.37) * 10));
  ctx.lineTo(w, -h + 12); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
  { const p = dimPal(palAt(S.depth), 0.42); // back-wall stones in the bays (same quiet rock as the shaft's back wall)
    for (const [x0, x1] of [[4, off - 4], [off + CFG.face.logicalW + 4, w - 4]] as const)
      for (let q = 0, n = Math.max(1, Math.round((x1 - x0) / 40)); q < n * 3; q++) {
        const cx = x0 + ((q % n) + 0.5) * ((x1 - x0) / n) + (hash(q * 3.3 + x0) - 0.5) * 10, cy = -h + 20 + Math.floor(q / n) * (h - 30) / 3 + hash(q * 5.1) * 12;
        drawCluster(cluster(9300 + x0 * 3 + q, 44 + hash(q) * 14, 36 + hash(q * 2) * 10, hash(q * 4) - 0.5, 3, 0), cx, cy, p, 0.6, 0.5);
      } }
  // carved into rock: rock masses along the bay ceilings and the chamber's side walls (visual only)
  const mC = S.depth - (h * faceScale()) / CFG.ppm;
  rockEdge(-4, -h + 6, off - 4, -h + 2, 0, -1, 11, mC);
  rockEdge(off + CFG.face.logicalW + 4, -h + 2, w + 4, -h + 6, 0, -1, 23, mC);
  rockEdge(-2, -h + 4, -2, -8, -1, 0, 37, S.depth, 0.9);
  rockEdge(w + 2, -h + 4, w + 2, -8, 1, 0, 51, S.depth, 0.9);
  if (dy < -6) { // the dig floor has moved on: the bays end in rock ledges; the shaft carries on down the middle
    const mF = chamberM() ?? S.depth;
    rockEdge(-6, 2, off + 2, 2, 0, 1, 61, mF, 0.9);
    rockEdge(off + CFG.face.logicalW - 2, 2, w + 6, 2, 0, 1, 67, mF, 0.9);
    // the bays keep their plank decks (the crew worked here), with a crate and a barrel left on the left bay
    for (const [x0, x1] of [[4, off - 4], [off + CFG.face.logicalW + 4, w - 4]] as const) {
      beam(x0, -4, x1 - x0, 4, PAL.wood, 'mid', 41);
      ctx.fillStyle = 'rgba(30,18,8,.5)'; for (let px = x0 + 9; px < x1 - 3; px += 9) ctx.fillRect(px, -3.4, 0.8, 3);
    }
    beam(16, -14, 11, 10, PAL.wood, 'fg', 43, 0.8);
    ctx.fillStyle = '#4b6b7a'; ctx.beginPath(); ctx.roundRect(31, -16, 9, 12, 2); ctx.fill();
    ctx.fillStyle = '#365260'; ctx.fillRect(36, -15, 2.4, 10);
  }
  // rough ceiling edge (the shaft keeps going up through the middle)
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -h + 14);
  for (let x = 0; x <= off; x += 20) ctx.lineTo(x, -h + hash(x * 0.37) * 10);
  ctx.moveTo(off + CFG.face.logicalW, -h + 6);
  for (let x = off + CFG.face.logicalW; x <= w; x += 20) ctx.lineTo(x, -h + hash(x * 0.37) * 10);
  ctx.stroke();
  // timber supports: posts + cap beams, rising after the blast
  const k = EXP.supports;
  if (k <= 0) return;
  const posts = [70, off + 6, off + CFG.face.logicalW - 6, w - 8];
  posts.forEach((x, i) => {
    const kk = Math.max(0, Math.min(1, k * posts.length - i));
    if (kk <= 0) return;
    post(x - 3.5, -h * kk, 7, h * kk, PAL.wood, 'mid', 11 + i);
    if (kk >= 1) beam(x - 12, -h + 2, 24, 6, PAL.wood, 'mid', -1, 1);
    contactShadow(x, 0.5, 6, 1.4, 0.3);
  });
  if (k >= 1) { // cap beams between the posts over the side bays
    beam(70, -h + 2, off - 64, 5, PAL.wood, 'mid', 3); beam(off + CFG.face.logicalW - 6, -h + 2, w - 8 - (off + CFG.face.logicalW - 6), 5, PAL.wood, 'mid', 7);
    // hanging work lamps in the bays
    for (const lx of [(70 + off) / 2, (off + CFG.face.logicalW + w) / 2]) {
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, -h + 7); ctx.lineTo(lx, -h + 30); ctx.stroke();
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(lx, -h + 32, 3, 0, 6.283); ctx.fill();
    }
  }
}

/** With a wider worksite the active floor is a LOW work pocket (follows the dig): the crew keeps a wide footing for
 *  diggers, Excavator and the rest nook, with no room ceiling, supports or bay lamps — those belong to the chamber. */
function drawWorkPocket() {
  const site = worksiteDef();
  if (!site.ceiling || chamberDy() > -6) return; // still inside the blasted room
  const w = face.w, off = shaftOff(), R = off + CFG.face.logicalW;
  const g = ctx.createLinearGradient(0, -POCKET_L, 0, 0);
  g.addColorStop(0, 'rgba(10,7,5,.6)'); g.addColorStop(1, 'rgba(30,20,12,.38)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -POCKET_L + 10);
  for (let x = 0; x <= off; x += 20) ctx.lineTo(x, -POCKET_L + hash(x * 0.53) * 8);
  ctx.lineTo(off, -POCKET_L - 30); ctx.lineTo(R, -POCKET_L - 30); // the open shaft above
  for (let x = R; x <= w; x += 20) ctx.lineTo(x, -POCKET_R + hash(x * 0.53) * 8);
  ctx.lineTo(w, -POCKET_R + 10); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
  const m = S.depth - (POCKET_L * faceScale()) / CFG.ppm;
  rockEdge(-4, -POCKET_L + 4, off - 2, -POCKET_L + 2, 0, -1, 71, m);
  rockEdge(R + 2, -POCKET_R + 2, w + 4, -POCKET_R + 4, 0, -1, 79, m);
  rockEdge(-2, -POCKET_L + 6, -2, -8, -1, 0, 87, S.depth, 0.9);
  rockEdge(w + 2, -POCKET_R + 6, w + 2, -8, 1, 0, 93, S.depth, 0.9);
}

/** The rest nook's rock (behind the ladder): a pocket carved into the wall and a rock canopy over the platform,
 *  so the rest area reads as a protected nook built into the mine, not a floating balcony. */
function drawRestNookBack() {
  if (!restAreaBuilt()) return;
  const py = RS.platformY, m = S.depth - (-py * faceScale()) / CFG.ppm;
  ctx.fillStyle = 'rgba(8,5,3,.62)';
  ctx.beginPath(); ctx.moveTo(6, py + 5); ctx.lineTo(-20, py + 3); ctx.lineTo(-30, py - 16); ctx.lineTo(-24, py - 44); ctx.lineTo(-4, py - 54); ctx.lineTo(14, py - 50); ctx.lineTo(8, py - 30); ctx.closePath(); ctx.fill();
  // canopy: an overhang of bedrock above the bench (the lamp hangs from it) — only when it is really underground
  const groundY = -(faceOrigin().y - yOf(0)) / faceScale();
  if (py - 100 < groundY + 6) return;
  ctx.fillStyle = 'rgba(14,10,7,.95)';
  ctx.beginPath(); ctx.moveTo(-34, py - 92); ctx.lineTo(80, py - 92); ctx.lineTo(76, py - 62); ctx.lineTo(58, py - 54); ctx.lineTo(40, py - 58); ctx.lineTo(22, py - 50); ctx.lineTo(4, py - 56); ctx.lineTo(-30, py - 50); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 6; i++) bedRock(-26 + i * 19 + (i % 2) * 4, py - 70 - (i % 3) * 6, 400 + i, 13 + (i % 3) * 3, 10 + (i % 2) * 3, m, i % 3 === 1 ? 10 : 0);
  rockEdge(-30, py + 9, 4, py + 9, 0, 1, 83, m, 0.7); // ledge under the beam ends
}

/** The access ladder on the LEFT wall, surface -> rest platform (or the floor while shallow). Drawn for the whole
 *  visible route, independent of whether the work floor is on screen, so a climbing worker is never off a ladder.
 *  In the Work Chamber tier the route rises through rock: a carved raise is drawn around it. Logical coords. */
function drawAccessLadder(groundY: number) {
  const s = faceScale(), o = faceOrigin(), py = RS.platformY, built = restAreaBuilt(), lx = RS.ladderX;
  const top = groundY, bot = built ? py : 0;
  const t0 = Math.max(top, (view.vy0 - o.y) / s - 10), b0 = Math.min(bot, (view.vy1 - o.y) / s + 10);
  if (b0 <= t0) return;
  const ceil = worksiteDef().ceiling;
  if (ceil) { // the raise: a narrow shaft cut through the rock, surface -> work pocket, open where it crosses the room
    const rb = Math.min(b0, -pocketH() + 8), dy = chamberDy(), cT = dy - ceil, cB = dy;
    const parts: [number, number][] = [[t0, Math.min(rb, cT + 6)], [Math.max(t0, cB - 2), rb]];
    const yW = (M: number) => (yOf(M) - o.y) / s, step = 3; // world-anchored 3 m cells: the raise's rock never re-shuffles
    for (const [a, b] of parts) {
      if (b <= a) continue;
      ctx.fillStyle = 'rgba(10,7,5,.9)'; ctx.fillRect(lx - 14, a, 28, b - a);
      for (let M = Math.floor((view.camDepth + (a * s) / CFG.ppm) / step) * step; yW(M) < b; M += step) {
        const y = Math.max(a, yW(M)), y2 = Math.min(b, yW(M + step));
        if (y2 <= y) continue;
        rockEdge(lx - 14, y, lx - 14, y2, -1, 0, 300 + M * 7, M, 0.7);
        rockEdge(lx + 14, y, lx + 14, y2, 1, 0, 600 + M * 7, M, 0.7);
      }
    }
  }
  { // timber lining behind the ladder through the loose first metres of the shaft
    const lt = Math.max(t0, top), lb = Math.min(b0, top + (6 * CFG.ppm) / s);
    if (lb > lt) for (let x = lx - 11; x < lx + 10; x += 7) { post(x, lt, 6.2, lb - lt, PAL.wood, 'mid', 90 + x); } // 3 boards, just behind the ladder
  }
  // mounts into the rock every 22 m (world-anchored) + the ladderway post
  const mpl = CFG.ppm / s;
  for (let mm = 9; groundY + mm * mpl < b0 - 12; mm += 22) {
    const y = groundY + mm * mpl;
    if (y < t0 + 6) continue;
    ctx.fillStyle = 'rgba(6,4,3,.6)'; ctx.fillRect(-6, y - 2.5, 6, 5);
    beam(-4, y - 2, lx + 16, 4, PAL.wood, 'mid');
  }
  post(lx + 7, t0, 5, b0 - t0, PAL.wood, 'mid', 61);
  // rails + rungs (rungs anchored to the ladder's foot, matching the climbing rig's rung lock)
  for (const [col, lw] of [[PAL.wood.dark, 3.4], [PAL.wood.light, 2.1]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(lx - 5, t0); ctx.lineTo(lx - 5, b0); ctx.moveTo(lx + 5, t0); ctx.lineTo(lx + 5, b0);
    for (let y = bot - 6 - Math.max(0, Math.ceil((bot - 6 - b0) / 8)) * 8; y > t0; y -= 8) { ctx.moveTo(lx - 5, y); ctx.lineTo(lx + 5, y); }
    ctx.stroke();
  }
  if (bot <= b0 + 1) beam(lx - 8, bot - 2.5, 16, 3, PAL.wood, 'mid'); // the ladder's foot block on its deck/floor
  if (top >= t0 && top < bot - 20) { // shaft collar: planks at the surface where the ladder starts
    beam(-18, top - 1, lx + 12 + 18, 4, PAL.wood, 'mid', 5);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let x = -12; x < lx + 10; x += 8) ctx.fillRect(x, top - 1, 1, 4);
    ctx.fillStyle = TIMBER_D; ctx.fillRect(lx + 6, top - 1, 3, 10);
  }
}

/** People route on the LEFT wall: switchback wooden stairs up to the rest platform (the ladder is drawn separately). */
function drawRestArea() {
  const fy = RS.landingY, py = RS.platformY, pw = RS.platformW, built = restAreaBuilt();
  if (!built) return;
  // access frame: posts carrying the platform and the landing down to the floor (behind the stairs)
  post(pw - 5, py + 3, 6, fy - py, PAL.wood, 'mid', 63);
  post(14, fy + 2, 6, -fy - 2, PAL.wood, 'mid', 65);
  ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(pw - 4, fy - 4); ctx.lineTo(20, py + 10); ctx.stroke();
  ctx.strokeStyle = PAL.wood.base; ctx.lineWidth = 2; ctx.stroke();
  // flight 1: floor (stairFootX, 0) -> landing (landingX, landingY)
  const flight = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 5.2; // stringer: outline, then wood
    ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x1, y1 + 2); ctx.stroke();
    ctx.strokeStyle = PAL.wood.shadow; ctx.lineWidth = 3.4; ctx.stroke();
    const n = Math.round(Math.abs(y1 - y0) / 6);
    for (let i = 1; i <= n; i++) { const k = i / (n + 1); beam(x0 + (x1 - x0) * k - 4, y0 + (y1 - y0) * k - 1.2, 8, 2.6, PAL.wood, 'mid'); }
    ctx.strokeStyle = PAL.wood.base; ctx.lineWidth = 1.8; // hand rail
    ctx.beginPath(); ctx.moveTo(x0, y0 - 14); ctx.lineTo(x1, y1 - 14); ctx.stroke();
  };
  flight(RS.stairFootX, 0, RS.landingX, fy);
  ctx.fillStyle = 'rgba(6,4,3,.6)'; ctx.fillRect(-9, fy - 3, 9, 8); // landing joist pocket
  beam(-7, fy - 1, RS.landingX + 19, 4, PAL.wood, 'mid', 9); // landing
  flight(RS.landingX + 8, fy, pw - 8, py);
  // platform: planks on brackets, railing on the open side
  beam(-16, py - 1, pw + 20, 5, PAL.wood, 'fg', 21); // joists run into the rock pocket
  ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let x = 6; x < pw; x += 8) ctx.fillRect(x, py - 1, 1, 5);
  ctx.strokeStyle = TIMBER_D; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, py + 4); ctx.lineTo(16, py + 18); ctx.moveTo(pw - 4, py + 4); ctx.lineTo(pw - 18, py + 18); ctx.stroke();
  ctx.strokeStyle = TIMBER_L; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pw + 3, py); ctx.lineTo(pw + 3, py - 15); ctx.lineTo(pw - 26, py - 15); ctx.stroke();
  // bench, water barrel, lamp
  post(6, py - 8, 2.5, 8, PAL.wood, 'mid'); post(48, py - 8, 2.5, 8, PAL.wood, 'mid');
  beam(4, py - 11, 48, 3, PAL.wood, 'fg', 4);
  post(4, py - 22, 2.4, 11, PAL.wood, 'mid'); beam(3, py - 21, 46, 2.4, PAL.wood, 'mid'); // backrest
  contactShadow(pw - 22, py - 0.4, 6, 1, 0.3); beam(pw - 27, py - 9, 10, 9, PAL.wood, 'fg', 33, 0.8); // crate
  ctx.strokeStyle = PAL.wood.dark; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(pw - 27, py - 9); ctx.lineTo(pw - 17, py); ctx.stroke();
  contactShadow(pw - 7.5, py - 0.6, 5.5, 1.2, 0.35);
  ctx.fillStyle = '#4b6b7a'; ctx.beginPath(); ctx.roundRect(pw - 12, py - 13, 9, 13, 2); ctx.fill();
  ctx.fillStyle = '#365260'; ctx.fillRect(pw - 6, py - 12, 2.6, 11); // barrel shadow side
  ctx.fillStyle = '#7fb0c4'; ctx.fillRect(pw - 11, py - 13, 7, 2);
  ctx.beginPath(); ctx.roundRect(pw - 12, py - 13, 9, 13, 2); outline('#4b6b7a', 'mid');
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, py - 54); ctx.lineTo(30, py - 30); ctx.stroke();
  ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(30, py - 28, 2.6, 0, 6.283); ctx.fill();
  // REST sign
  beam(0, py - 28, 30, 13, PAL.wood, 'fg', 77, 1.5);
  ctx.fillStyle = 'rgba(40,24,12,.55)'; ctx.fillRect(2, py - 26, 26, 9); // board face
  ctx.fillStyle = '#2a2420'; for (const nx of [2.2, 27.8]) { ctx.beginPath(); ctx.arc(nx, py - 21.5, 0.8, 0, 6.283); ctx.fill(); }
  ctx.font = `700 7px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe08a';
  ctx.fillText(`REST ${restingCount()}/${seatsTotal()}`, 15, py - 18.5);
}

/** Warm glow from the rest lamp and chamber lamps (after the darkness pass). */
function drawPracticalLights() {
  const py = RS.platformY;
  if (!restAreaBuilt()) return;
  const g = ctx.createRadialGradient(30, py - 28, 0, 30, py - 28, 46);
  g.addColorStop(0, 'rgba(255,214,140,.28)'); g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(30, py - 28, 46, 0, 6.283); ctx.fill();
  const site = worksiteDef();
  if (site.ceiling && EXP.supports >= 1) {
    const off = shaftOff();
    for (const lx of [(70 + off) / 2, (off + CFG.face.logicalW + face.w) / 2]) {
      const y = chamberDy() - site.ceiling + 32;
      const gl = ctx.createRadialGradient(lx, y, 0, lx, y, 90);
      gl.addColorStop(0, 'rgba(255,214,140,.22)'); gl.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, y, 90, 0, 6.283); ctx.fill();
    }
  }
}

/** Half-buried boulders in the floor surface (drawn BEFORE the face, so the face covers their lower halves): a few
 *  raised stones and shoulders breaking the flat floor line, away from where the miners stand. Logical coords. */
function drawEmbeddedRocks() {
  const W = face.w, p = palAt(S.depth), q = 0.45 + 0.55 * rockiness(S.depth); // small stones near the surface
  const spots: [number, number, number][] = [[W * 0.2, 16, 11], [W * 0.66, 22 * q, 13 * q], [W * 0.84, 14, 9]];
  spots.forEach(([x, w, h], i) => drawCluster(cluster(800 + i, w, h * 1.5, (hash(i * 3.3) - 0.5) * 0.8, 5, 1, 1, true), x, 5 - h * 0.12, p, 1.4, 1.1));
}

/** The excavation floor in the same boulder language as the walls (presentation only; the face's chunks and click
 *  targets are untouched): an upper bed of interlocking chunky boulders under the working face, a lower bed of larger
 *  darker masses, small fillers in the gaps, a fade to near-black deep rock, and large corner masses that carry both
 *  walls into the floor. Seeds are fixed per position, so the floor never re-shuffles. */
function drawFloorBed() {
  const F = CFG.face, W = face.w, m = S.depth, p = palAt(m + 2), pd = dimPal(palAt(m + 5), 0.62);
  // near the surface this is soil with stones in it; the rock bed grows in over the first ~15 m (visual only)
  const R = rockiness(m + 1), sz = 0.35 + 0.65 * R, keepK = (i: number, b = 0) => hash(i * 9.17 + 0.5) < R + b;
  const deep = p.crev.map((v) => v | 0).join(',');
  const gd = ctx.createLinearGradient(0, F.height + 30, 0, F.height + 140);
  gd.addColorStop(0, `rgba(${deep},0)`); gd.addColorStop(1, `rgba(${deep},${(0.94 * R).toFixed(3)})`);
  ctx.fillStyle = gd; ctx.fillRect(-120, F.height + 30, W + 240, 110);
  for (let i = 0, x = -70; x < W + 80; i++) { // lower bed
    const w = (52 + hash(i * 3.7) * 34) * sz;
    if (!keepK(i, -0.15)) { x += w * (0.8 + hash(i * 4.9) * 0.6); continue; }
    // never a stone border: sizes, depths and spacing all vary; gaps of earth between masses
    const f = 0.7 + hash(i * 8.7) * 0.6;
    drawCluster(cluster(1200 + i, w * f, (38 + hash(i * 6.3) * 14) * sz * f, (hash(i * 2.1) - 0.5) * 0.8, 5, 1), x, F.height + 38 + hash(i * 5.1) * 26, pd, 1, 0.8);
    x += w * (0.55 + hash(i * 3.1) * 0.35);
  }
  for (let i = 0, x = -60; x < W + 70; i++) { // upper bed
    const w = (30 + hash(i * 2.9) * 22) * sz;
    if (!keepK(i + 50, 0.3)) { x += w * 0.9; continue; } // gaps of soil between the stones near the surface
    drawCluster(cluster(1000 + i, w, (22 + hash(i * 7.3) * 10) * sz, (hash(i * 4.3) - 0.5) * 0.8, 5 + (i % 2), 1), x, F.height + 12 + hash(i * 8.9) * 7, p, 1.4, 1.05);
    x += w * 0.6 + hash(i * 9.1) * 5;
  }
  for (let i = 0; i < 12; i++) { // small fillers in the gaps
    const x = -30 + hash(i * 13.1) * (W + 60), w = 6 + hash(i * 3.9) * 8;
    drawCluster(cluster(1700 + i, w, w * 0.75, 0, 3, 0), x, F.height + 26 + hash(i * 6.7) * 12, p, 1.3, 1);
  }
  for (let i = 0; i < 8; i++) { // chips on the floor (accent only)
    const x = 8 + hash(i * 11.3) * (W - 16), r = 2.2 + hash(i * 4.4) * 2.2;
    drawCluster(cluster(1600 + i, r * 2.4, r * 1.8, 0, 3, 0, 1, true), x, -r * 0.45, palAt(m), 1.4, 1.2);
  }
}

/** The rubble pile, built from small pieces of the same rock (same palette, planes, contact shadows, light). */
function drawMinePile(cx: number, l: typeof S.rubble, max: number, seed: number) {
  const qty = l.qty;
  if (qty < 0.05) return;
  const f = Math.min(1.5, qty / max), w = 10 + 46 * Math.min(f, 1.25), h = 3 + 24 * Math.min(f, 1.3);
  const pm = palById(mixPick(l, 0.5));
  ctx.fillStyle = `rgb(${pm.shadow.map((v) => v | 0).join(',')})`; // mound body (shadowed base)
  ctx.beginPath(); ctx.moveTo(cx - w / 2, 0);
  for (let i = 0; i <= 10; i++) { const k = i / 10; ctx.lineTo(cx - w / 2 + w * k, -h * Math.sin(Math.PI * k) * (0.92 + (hash(seed + i * 3.3) - 0.5) * 0.18)); }
  ctx.closePath(); ctx.fill();
  const n = Math.min(40, Math.max(3, Math.round(f * 30)));
  for (let i = 0; i < n; i++) {
    const k = hash(seed + i * 7.1), lift = hash(seed + i * 2.3);
    const px = cx - w / 2 + w * (0.08 + 0.84 * k), py = -h * Math.sin(Math.PI * (0.08 + 0.84 * k)) * (0.3 + 0.6 * lift);
    const r = 2 + hash(seed + i * 5.9) * 3.2;
    drawCluster(cluster(2000 + i, r * 2.4, r * 1.9, hash(seed + i) - 0.5, 3 + (i % 2), 0), px, py, palById(mixPick(l, hash(seed + i * 4.1))), 1.3, 1.2);
  }
  if (f > 1) for (let i = 0; i < Math.round((f - 1) * 16); i++) { // overflowing: pieces spill out
    const side = i % 2 ? 1 : -1, px = cx + side * (w / 2 + hash(seed + i * 4.4) * 10), r = 1.6 + hash(seed + i * 3.1) * 1.8;
    drawCluster(cluster(2100 + i, r * 2.4, r * 1.9, 0.3, 3, 0, 1, true), px, -r * 0.8, palById(mixPick(l, hash(seed + i * 6.6))), 1.3, 1.2);
  }
}

/** True if the segment before the current one was the ladder (the worker has just stepped off it). */
function isLadderEnd(path: number[], t: number) {
  const now = pathPos(path, t), prev = pathPos(path, Math.max(0, t - now.segT - 0.02));
  return prev.ladder && prev.seg !== now.seg && (prev.seg[2] === now.seg[0] && prev.seg[3] === now.seg[1]);
}

function drawFaceAndCrew() {
  const o = faceOrigin(), s = faceScale();
  const groundY = -(o.y - yOf(0)) / s; // logical y of the surface above the work floor
  if (o.y < view.vy0 - 260 * s || o.y > view.vy1 + 200) { // work floor off screen: the ladder still shows its route
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); setRockSpace(o.x, o.y, s); drawChamber(); drawAccessLadder(groundY); ctx.restore();
    setRockSpace(0, 0, 1);
    return;
  }
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(s, s);
  setRockSpace(o.x, o.y, s);
  drawChamber();
  drawWorkPocket();
  drawRestNookBack();
  drawAccessLadder(groundY);
  drawRestArea();
  drawEmbeddedRocks(); // their lower halves disappear under the face: half-buried bedrock
  drawFace(s);
  desaturate(0, -2, face.w, CFG.face.height + 4, 0.12); // a touch, so the face sits in the same ground
  drawFloorBed();
  { // the face's ends tuck under the wall rock: soft dark falloff instead of a hard vertical edge
    const sh = palOf(materialAt(S.depth)).shadow.map((v) => v | 0).join(','), E = 26, A = (0.85 * rockiness(S.depth)).toFixed(2);
    for (const [x0, d] of [[0, 1], [face.w, -1]] as const) {
      const g = ctx.createLinearGradient(x0, 0, x0 + d * E, 0);
      g.addColorStop(0, `rgba(${sh},${A})`); g.addColorStop(1, `rgba(${sh},0)`);
      ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x0 + d * E), -4, E, CFG.face.height + 8);
    }
  }
  { // the cart's loading rails on the floor (two rails on sleepers, under where the cart stands)
    const x0 = cartX() - 22, x1 = cartX() + 26;
    for (let x = x0 + 3; x < x1; x += 9) { ctx.fillStyle = PAL.wood.shadow; ctx.fillRect(x, -1.6, 5, 2.4); }
    ctx.fillStyle = '#4a4f55'; ctx.fillRect(x0, -2.6, x1 - x0, 1.4);
    ctx.fillStyle = 'rgba(220,226,232,.5)'; ctx.fillRect(x0, -2.6, x1 - x0, 0.5);
  }
  // rubble waiting at the dig site, coloured by what it is, with its count right on the pile
  const px = pileX();
  if (S.rubble.qty > 0.05) contactShadow(px, 0.6, (12 + 26 * Math.min(1.25, S.rubble.qty / CFG.rubble.pileVisualMax)), 2.4, 0.4);
  drawMinePile(px, S.rubble, CFG.rubble.pileVisualMax, 17);
  const ES = CFG.excavatorScale;
  for (const w of workers) {
    if (w.id !== 'dig') {
      contactShadow(w.x, 0.8, (w.id === 'borer' ? 42 : 36) * ES, 2.6, 0.42);
      ctx.save(); ctx.translate(w.x, 0); ctx.scale(ES, ES);
      const mk = expanding() ? 0 : machineK(w.timer, w.since), bo = w.since < 0.4 ? Math.sin(w.since * 25) * (0.4 - w.since) * 2.5 : 0, reach = CFG.machineReach[w.id] / ES;
      if (w.id === 'exc') drawExcavator(0, w.dir, mk, reach, bo);
      else if (w.id === 'saw') drawSaw(0, w.dir, mk, reach, bo, view.t);
      else drawDrill(0, w.dir, mk, reach, bo, view.t);
      ctx.restore();
    } else {
      const look = minerLook(w.seed);
      const p = w.state === 'arrive' || w.state === 'toRest' || w.state === 'back' ? pathPos(w.path, w.pathT) : null;
      if (p?.ladder) {
        const bot = Math.max(p.seg[1], p.seg[3]); // the ladder's foot (platform or floor)
        const f = ladderFrame(bot - w.y, bot - groundY, look);
        ctx.save();
        if (w.state === 'arrive' && w.pathT < 0.5) ctx.globalAlpha = w.pathT / 0.5; // climbs into view from above
        drawRig(p.seg[0], bot - f.base, CFG.crewScale, 1, look, f.pose);
        ctx.restore();
      } else if (p && !p.climbing && p.segT < 0.35 && isLadderEnd(w.path, w.pathT)) {
        // stepping off the ladder: the planted foot stays, the other swings across into the first stride
        contactShadow(w.x, w.y + 0.6, 8, 1.6, 0.38);
        drawRig(w.x, w.y, CFG.crewScale, w.dir, look, { k: 'walk', t: 0.25 + (p.segT / 0.35) * 0.25 });
      } else { contactShadow(w.x, w.y + 0.6, 8, 1.6, 0.38); drawRig(w.x, w.y, CFG.crewScale, w.dir, look, workerPose(w)); }
    }
  }
  drawRig(miner.x, 0, CFG.playerScale, miner.dir, PLAYER_LOOK, playerPose());
  if (S.rubble.qty >= 1) pileLabel(px, -pileHeight(S.rubble.qty, CFG.rubble.pileVisualMax, 1) - 5, Math.floor(S.rubble.qty), 10, S.rubble.qty >= pileCap(S) - 1); // on top of the crew and the player (red = FULL: transport is the bottleneck)
  drawBackfill(px, -pileHeight(S.rubble.qty, CFG.rubble.pileVisualMax, 1));
  if (EXP.phase === 'whistle' || EXP.phase === 'clear') bubble(miner.x - 24, -64, 'STAND CLEAR!', '#7a1f12', true);
  if (EXP.phase === 'charges') {
    for (const [cx, cy] of chargeSpots()) {
      ctx.fillStyle = '#b8402a'; ctx.fillRect(cx - 3, cy - 6, 6, 9);
      if (Math.floor(view.t * 6) % 2) { ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(cx, cy - 8, 2, 0, 6.283); ctx.fill(); }
    }
  }
  // underground light: the deeper, the darker — helmet lamps carve out the work area
  const dark = Math.min(CFG.light.maxDark, S.depth / CFG.light.darkAtM * CFG.light.maxDark);
  if (dark > 0.01) {
    // only inside the shaft/chamber (never over the sky), fading out through the face band into the ground
    const top = -(o.y - Math.max(view.vy0, yOf(0))) / s, bot = CFG.face.height * 0.75;
    const off = shaftOff(), R = off + CFG.face.logicalW, ph = pocketH(), ch = worksiteDef().ceiling;
    ctx.fillStyle = `rgba(4,4,10,${dark})`;
    ctx.fillRect(off, top, CFG.face.logicalW, bot - 18 - top); // the shaft column
    const bays = (a: number, b: number) => { a = Math.max(top, a); if (b > a) { ctx.fillRect(0, a, off, b - a); ctx.fillRect(R, a, face.w - R, b - a); } };
    if (ph) bays(chamberDy() > -6 ? chamberDy() - ch : -ph, bot - 18); // the work pocket (or the room while still in it)
    if (ch && chamberDy() <= -6) bays(chamberDy() - ch, Math.min(chamberDy(), -ph)); // the room, up where it was blasted
    const g = ctx.createLinearGradient(0, bot - 18, 0, bot);
    g.addColorStop(0, `rgba(4,4,10,${dark})`); g.addColorStop(1, 'rgba(4,4,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, bot - 18, face.w, 18);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const boost = 1 + dark * 1.4;
  drawPracticalLights();
  for (const w of workers) {
    if (w.id !== 'dig') drawExcavatorLight(w.x, w.dir, 0.12 * boost);
    else if (w.state === 'work') drawLampBeam(w.x, w.dir, CFG.crewScale, 0.05 * boost, CFG.miner.reach);
  }
  drawLampBeam(miner.x, miner.dir, CFG.playerScale, 0.075 * boost, CFG.miner.reach);
  ctx.restore();
  if (EXP.flash > 0) { ctx.fillStyle = `rgba(255,240,210,${(EXP.flash * 0.8).toFixed(3)})`; ctx.fillRect(-40, -260, face.w + 80, 320); }
  ctx.restore();  setRockSpace(0, 0, 1);
}

// ---------- world ----------
/** The deep finds, drawn in logical units (≈ a worker is 46 tall) facing out of the wall. Origin = the find's centre. */
function drawDeepFind(kind: string) {
  const ink = 'rgba(20,12,8,.85)';
  const blob = (pts: number[][], fill: string) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke(); };
  // dark cavity in the rock behind every find
  ctx.fillStyle = 'rgba(8,5,3,.7)'; ctx.beginPath(); ctx.ellipse(6, 2, 30, 18, 0.1, 0, 6.283); ctx.fill();
  if (kind === 'fossil') { // T-rex skull + a run of vertebrae
    blob([[-22, -2], [-14, -14], [6, -16], [22, -8], [26, 0], [16, 6], [2, 4], [-6, 10], [-18, 8]], '#e8dcc0');
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(-6, -6, 4, 3, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -6, 6, 4, -0.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff6e0'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 6, 5 - (i > 3 ? 1 : 0)); ctx.lineTo(-12 + i * 6, 10); ctx.lineTo(-10 + i * 6, 5); ctx.fill(); } // teeth
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#d8ccb0'; ctx.beginPath(); ctx.ellipse(-30 - i * 7, 6 + i * 1.5, 3, 2.4, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke(); }
  } else if (kind === 'geode') { // cracked stone egg full of purple crystals
    ctx.fillStyle = '#5a5560'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#2a1640'; ctx.beginPath(); ctx.ellipse(1, 0, 15, 10.5, 0, 0, 6.283); ctx.fill();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283, r0 = 10, r1 = 3 + (i % 3) * 2; ctx.fillStyle = i % 2 ? '#c49bff' : '#9a6cf0'; ctx.beginPath(); ctx.moveTo(1 + Math.cos(a) * r0 * 1.4, Math.sin(a) * r0); ctx.lineTo(1 + Math.cos(a + 0.2) * r1, Math.sin(a + 0.2) * r1 * 0.7); ctx.lineTo(1 + Math.cos(a - 0.2) * r1, Math.sin(a - 0.2) * r1 * 0.7); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-4, -4, 2, 2); ctx.fillRect(5, 2, 1.5, 1.5);
  } else if (kind === 'nugget') {
    blob([[-16, 2], [-12, -9], [-2, -13], [10, -10], [17, -2], [14, 8], [2, 11], [-10, 9]], '#e8b22c');
    ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.ellipse(-5, -6, 6, 3, -0.4, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -3, 3, 2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#a4740c'; ctx.beginPath(); ctx.ellipse(4, 6, 6, 2.5, 0.2, 0, 6.283); ctx.fill();
  } else if (kind === 'chest') { // iron-banded chest spilling gems
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(-16, -6, 32, 16); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.strokeRect(-16, -6, 32, 16);
    blob([[-17, -6], [-14, -14], [14, -14], [17, -6]], '#8d5a2c');
    ctx.fillStyle = '#3b3f45'; for (const bx of [-11, 9]) ctx.fillRect(bx, -14, 3, 24);
    ctx.fillStyle = '#e8c45a'; ctx.fillRect(-2.5, -4, 5, 6);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#52f098', '#ff4a6a', '#5fc8ff', '#ffd84a'][i % 4]; ctx.beginPath(); ctx.arc(-12 + i * 5, -14 - (i % 2) * 2, 2.2, 0, 6.283); ctx.fill(); }
  } else if (kind === 'idol') { // squat stone head, glowing green eyes
    blob([[-12, 14], [-14, -6], [-10, -16], [10, -16], [14, -6], [12, 14]], '#7d8a74');
    ctx.fillStyle = '#5f6b58'; ctx.fillRect(-12, -2, 24, 3); ctx.fillRect(-8, 6, 16, 2.5);
    ctx.fillStyle = '#62ff8a'; ctx.beginPath(); ctx.arc(-5, -7, 2.4, 0, 6.283); ctx.arc(5, -7, 2.4, 0, 6.283); ctx.fill();
    const g = ctx.createRadialGradient(0, -7, 0, 0, -7, 16); g.addColorStop(0, 'rgba(98,255,138,.35)'); g.addColorStop(1, 'rgba(98,255,138,0)'); ctx.fillStyle = g; ctx.fillRect(-16, -23, 32, 32);
  } else if (kind === 'skull') { // horned skull with ember eyes
    blob([[-12, 8], [-14, -4], [-8, -14], [8, -14], [14, -4], [12, 8], [6, 12], [-6, 12]], '#d8cbb4');
    blob([[-10, -11], [-24, -24], [-20, -10]], '#3a2a24'); blob([[10, -11], [24, -24], [20, -10]], '#3a2a24');
    ctx.fillStyle = '#ff3a1a'; ctx.beginPath(); ctx.ellipse(-5, -3, 3.5, 3, 0, 0, 6.283); ctx.ellipse(5, -3, 3.5, 3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-2, 5); ctx.lineTo(2, 5); ctx.fill();
    const g = ctx.createRadialGradient(0, -3, 0, 0, -3, 20); g.addColorStop(0, 'rgba(255,60,20,.35)'); g.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = g; ctx.fillRect(-20, -23, 40, 40);
  }
}

function drawFind(f: Find, x: number, y: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (f.kind === 'coin') {
    ctx.translate(x, y);
    ctx.fillStyle = '#d9a62e'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6414'; ctx.fillRect(-2, -5, 4, 10);
  } else if (f.kind === 'car') drawBuriedCar(x, y, f.d);
  else { ctx.translate(x, y); const k = faceScale(); ctx.scale(k * f.side, k); drawDeepFind(f.kind); }
  ctx.restore();
}

/** A real compact car buried in the shaft wall, sized from the worker: length ≈ 2.45 worker heights, roof ≈ 0.78,
 *  wheels ≈ 0.34 across. `x` = front bumper (nearest the shaft), `y` = the find's depth line. Nose dips toward the
 *  shaft; the rear disappears into the earth. */
function drawBuriedCar(x: number, y: number, d: number) {
  const U = RIG_H * CFG.crewScale * faceScale(); // one worker height in screen px
  const Lc = 2.45 * U, Hc = 0.78 * U, r = 0.17 * U;
  const fa = 0.2 * Lc, ra = 0.79 * Lc; // axles
  ctx.save();
  ctx.translate(x, y + 0.42 * U); ctx.rotate(-0.07);
  const P = (fx: number, fy: number) => [fx * Lc, -fy * U] as const;
  // the pocket of disturbed earth around it
  const pk = ctx.createRadialGradient(Lc * 0.45, -Hc * 0.4, Hc * 0.3, Lc * 0.45, -Hc * 0.4, Lc * 0.55);
  pk.addColorStop(0, 'rgba(20,12,6,.32)'); pk.addColorStop(1, 'rgba(20,12,6,0)');
  ctx.fillStyle = pk; ctx.beginPath(); ctx.ellipse(Lc * 0.45, -Hc * 0.4, Lc * 0.6, Hc * 0.9, 0, 0, 6.283); ctx.fill();
  // body silhouette: bumper, hood, windshield, roof, rear window, trunk
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(...P(0.01, 0.12));
    ctx.quadraticCurveTo(...P(-0.005, 0.25), ...P(0.012, 0.38)); // front bumper
    ctx.lineTo(...P(0.05, 0.43)); ctx.lineTo(...P(0.29, 0.47)); // hood
    ctx.lineTo(...P(0.43, 0.76)); ctx.quadraticCurveTo(...P(0.45, 0.785), ...P(0.48, 0.78)); // windshield
    ctx.lineTo(...P(0.72, 0.775)); ctx.quadraticCurveTo(...P(0.75, 0.77), ...P(0.76, 0.75)); // roof
    ctx.lineTo(...P(0.86, 0.52)); ctx.lineTo(...P(0.985, 0.5)); // rear window, trunk deck
    ctx.quadraticCurveTo(...P(1.0, 0.36), ...P(0.99, 0.13)); // tail
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(0, -Hc, 0, 0);
  g.addColorStop(0, '#a8402c'); g.addColorStop(0.55, '#8c2f20'); g.addColorStop(1, '#5a2418');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip();
  // glass (dusty), B-pillar
  ctx.fillStyle = '#5f7a80';
  ctx.beginPath(); ctx.moveTo(...P(0.315, 0.5)); ctx.lineTo(...P(0.435, 0.735)); ctx.lineTo(...P(0.575, 0.735)); ctx.lineTo(...P(0.575, 0.5)); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(...P(0.605, 0.5)); ctx.lineTo(...P(0.605, 0.735)); ctx.lineTo(...P(0.73, 0.735)); ctx.lineTo(...P(0.83, 0.52)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath(); ctx.moveTo(...P(0.35, 0.52)); ctx.lineTo(...P(0.44, 0.71)); ctx.lineTo(...P(0.47, 0.71)); ctx.lineTo(...P(0.38, 0.52)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(70,45,25,.45)'; ctx.fillRect(...P(0.3, 0.6), 0.55 * Lc, 0.1 * U); // dirt caked on the lower glass
  // belt line, sill, door seams, handles, mirror, lights, bumpers
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(...P(0.04, 0.4), 0.95 * Lc, 0.012 * U); ctx.fillRect(...P(0.04, 0.17), 0.95 * Lc, 0.03 * U);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (const sx of [0.31, 0.59, 0.83]) ctx.fillRect(...P(sx, 0.5), Math.max(1, 0.004 * Lc), 0.33 * U);
  ctx.fillStyle = '#c9c2b4'; ctx.fillRect(...P(0.5, 0.43), 0.045 * Lc, 0.025 * U); ctx.fillRect(...P(0.73, 0.43), 0.045 * Lc, 0.025 * U);
  ctx.fillStyle = '#e8d9a8'; ctx.fillRect(...P(0.0, 0.37), 0.035 * Lc, 0.07 * U); // headlight
  ctx.fillStyle = '#b8402a'; ctx.fillRect(...P(0.965, 0.46), 0.03 * Lc, 0.09 * U); // taillight
  ctx.fillStyle = '#3a3330'; ctx.fillRect(...P(-0.005, 0.22), 0.05 * Lc, 0.07 * U); ctx.fillRect(...P(0.955, 0.24), 0.05 * Lc, 0.07 * U); // bumpers
  // rust + grime
  ctx.fillStyle = 'rgba(120,60,20,.55)';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(Lc * (0.1 + hash(i * 3.3) * 0.8), -U * (0.15 + hash(i * 7.1) * 0.25), U * (0.03 + hash(i) * 0.05), U * (0.02 + hash(i * 2) * 0.03), 0, 0, 6.283); ctx.fill(); }
  const gr = ctx.createLinearGradient(0, -0.35 * U, 0, 0); gr.addColorStop(0, 'rgba(60,40,22,0)'); gr.addColorStop(1, 'rgba(60,40,22,.65)');
  ctx.fillStyle = gr; ctx.fillRect(-10, -0.35 * U, Lc + 20, 0.35 * U);
  ctx.restore();
  ctx.fillStyle = '#7a2a1c'; ctx.beginPath(); ctx.ellipse(...P(0.335, 0.52), 0.022 * Lc, 0.04 * U, 0, 0, 6.283); ctx.fill(); // mirror
  // wheel arches + wheels
  for (const ax of [fa, ra]) {
    ctx.fillStyle = '#1a1310'; ctx.beginPath(); ctx.arc(ax, -r, r * 1.2, Math.PI, 0); ctx.lineTo(ax + r * 1.2, -0.12 * U); ctx.lineTo(ax - r * 1.2, -0.12 * U); ctx.fill();
    ctx.fillStyle = '#1c1c1e'; ctx.beginPath(); ctx.arc(ax, -r, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(ax, -r, r * 0.86, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#7d8086'; ctx.beginPath(); ctx.arc(ax, -r, r * 0.55, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5a5d62'; ctx.beginPath(); ctx.arc(ax, -r, r * 0.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3e4146';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + 0.3; ctx.beginPath(); ctx.arc(ax + Math.cos(a) * r * 0.36, -r + Math.sin(a) * r * 0.36, r * 0.05, 0, 6.283); ctx.fill(); }
  }
  // the earth still holds the rear of the car and packs around the wheels
  const wall = materialAt(d).wall;
  ctx.fillStyle = `rgb(${wall.map((v) => Math.round(v * 0.97)).join(',')})`;
  ctx.beginPath(); ctx.moveTo(Lc * 0.74, U * 0.2);
  for (let i = 0; i <= 12; i++) { const yy = -Hc * 1.15 + (i / 12) * (Hc * 1.15 + U * 0.2); ctx.lineTo(Lc * (0.78 + (hash(i * 4.7) - 0.5) * 0.06 + (i / 12) * 0.06), yy); }
  ctx.lineTo(Lc * 1.15, U * 0.2); ctx.lineTo(Lc * 1.15, -Hc * 1.2); ctx.lineTo(Lc * 0.78, -Hc * 1.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-U * 0.1, U * 0.15);
  for (let i = 0; i <= 16; i++) ctx.lineTo((i / 16) * Lc * 0.8, -U * (0.05 + hash(i * 2.9) * 0.07));
  ctx.lineTo(Lc * 0.8, U * 0.15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(Lc * (0.06 + hash(i * 5.1) * 0.6), -Hc * (0.62 + hash(i * 1.9) * 0.1) - (i % 2 ? 0 : 0.18 * U), U * 0.035, 0, 6.283); ctx.fill(); } // dirt clods on hood/roof
  ctx.restore();
}

// ---------- transport: rails, cart, piles, headframe ----------
const C = CFG.cart;
// Track Strength tiers (Spec §7.8) — each one is visibly a different build:
//   Wood: thin rough rails, sparse thin sleepers, small wooden brackets
//   Reinforced Wood: thick rails, dense thick sleepers, steel fastener plates + bolts, diagonal timber braces, upright
//   Iron: metal rails with a highlight, bolted sleepers, iron brackets, steel cross bracing, steel upright
//   Steel: heavy bright rails, steel sleepers, yellow brackets, guard rail, hazard paint, wall lamps
interface TrackStyle { rail: string; w: number; tie: string; tieW: number; step: number; rough: boolean; bolts: boolean; plates: boolean; brace: string; upright: string; bracket: string; metal: boolean; guard: boolean; hazard: boolean; lamps: number }
const TRACK_STYLES: TrackStyle[] = [
  { rail: '#7a5634', w: 2.2, tie: '#4e3620', tieW: 2.2, step: 1.15, rough: true, bolts: false, plates: false, brace: '', upright: '', bracket: '#5b3d22', metal: false, guard: false, hazard: false, lamps: 0 },
  { rail: '#5e4127', w: 3.4, tie: '#3e2a17', tieW: 3.6, step: 0.8, rough: false, bolts: true, plates: true, brace: 'rgba(110,78,44,.5)', upright: '#4a3420', bracket: '#7d858f', metal: false, guard: false, hazard: false, lamps: 0 },
  { rail: '#9aa3ad', w: 3.1, tie: '#4e3620', tieW: 3.2, step: 0.7, rough: false, bolts: true, plates: false, brace: 'rgba(160,170,180,.55)', upright: '#59616a', bracket: '#7d858f', metal: true, guard: false, hazard: false, lamps: 0 },
  { rail: '#c4ccd4', w: 3.9, tie: '#3b3f45', tieW: 3.4, step: 0.55, rough: false, bolts: true, plates: false, brace: 'rgba(170,180,190,.6)', upright: '#59616a', bracket: '#e0b322', metal: true, guard: true, hazard: true, lamps: 8 },
  { rail: '#5fc8ff', w: 4.2, tie: '#24303c', tieW: 3.6, step: 0.5, rough: false, bolts: true, plates: true, brace: 'rgba(95,200,255,.45)', upright: '#3a4a5a', bracket: '#5fc8ff', metal: true, guard: true, hazard: false, lamps: 6 },
  { rail: '#ff7a3a', w: 4.6, tie: '#2a1410', tieW: 3.8, step: 0.45, rough: false, bolts: true, plates: true, brace: 'rgba(255,110,50,.5)', upright: '#4a2018', bracket: '#ffb04a', metal: true, guard: true, hazard: true, lamps: 6 },
];

export const railCableW = () => 1.1 + 0.3 * S.upg.rail;

/** The track along the transport wall from the headframe to the dig face. While a loaded cart strains it, the rails
 *  bow locally around the cart; during a reinforcement the new tier replaces the old one section by section. */
function drawRails(yTop: number, yBot: number) {
  const top = Math.max(view.vy0 - 20, yTop), bot = Math.min(view.vy1 + 20, yBot);
  if (bot <= top) return;
  // local flex: only around a climbing loaded cart, scaled by how hard it works the track
  const stress = S.cart.state === 'TRAVELLING_UP' && !TRACKUP.active ? cartTrackStress() : 'safe';
  const cy = cartScreen().y - 10 * faceScale(), R = 3.2 * CFG.ppm;
  const amp = stress === 'over' ? 3.2 + Math.sin(view.t * 47) * 0.9 : stress === 'strained' ? 1.0 + Math.sin(view.t * 31) * 0.25 : 0;
  const flex = (y: number) => (amp ? -amp * Math.exp(-(((y - cy) / R) ** 2)) : 0);
  const shake = stress === 'over' ? 1 : 0;
  const by = reinforceY();
  if (by === null) { drawTrackTier(S.upg.rail, top, bot, flex, shake); return; }
  // reinforcement: new track below the moving work section, old (loosening) track above it
  ctx.save(); ctx.beginPath(); ctx.rect(view.vx0 - 10, top, view.vx1 - view.vx0 + 20, by - top); ctx.clip();
  drawTrackTier(TRACKUP.from, top, bot, (y) => (y > by - 40 ? Math.sin(view.t * 60 + y) * 1.2 : 0), 0); // loosening
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(view.vx0 - 10, by, view.vx1 - view.vx0 + 20, bot - by); ctx.clip();
  drawTrackTier(TRACKUP.to, top, bot, () => 0, 0);
  ctx.restore();
  const s = faceScale(), x = toScreen(railX(), 0).x;
  ctx.fillStyle = 'rgba(255,230,160,.85)'; ctx.fillRect(x - 10 * s, by - 1, 20 * s, 2); // the section being fixed
  bubble(x + 14 * s, by - 14, 'REINFORCING TRACK', '#2a2420', true);
}

function drawTrackTier(tier: number, top: number, bot: number, flex: (y: number) => number, shake: number) {
  const st = TRACK_STYLES[Math.min(tier, TRACK_STYLES.length - 1)];
  const s = faceScale(), x = toScreen(railX(), 0).x, half = 6 * s;
  const mTop = viewTop() + Math.max(view.vy0, top) / CFG.ppm, mBot = viewTop() + Math.min(view.vy1, bot) / CFG.ppm;
  ctx.lineCap = 'butt';
  if (st.upright) { ctx.fillStyle = st.upright; ctx.fillRect(x + half + 4 * s, top, st.metal ? 3 : 2.6, bot - top); } // side upright tying track to wall
  // sleepers (anchored in world metres)
  for (let i = Math.floor(mTop / st.step); i * st.step <= mBot; i++) {
    const m = i * st.step;
    let y = yOf(m) + (st.rough ? (hash(i * 1.7) - 0.5) * 3 : 0);
    if (y < top || y > bot) continue;
    const dx = flex(y);
    if (shake && Math.abs(dx) > 0.5) y += Math.sin(view.t * 53 + i) * 0.6; // sleepers rattle under the cart
    ctx.strokeStyle = st.tie; ctx.lineWidth = st.tieW;
    ctx.beginPath(); ctx.moveTo(x - half - 3 + dx, y); ctx.lineTo(x + half + 3 + dx * 0.6, y); ctx.stroke();
    if (st.bolts) { ctx.fillStyle = st.metal ? '#d6dde4' : '#b4bcc4'; ctx.fillRect(x - half - 2 + dx, y - 1.5, 3, 3); ctx.fillRect(x + half - 1 + dx * 0.6, y - 1.5, 3, 3); }
    if (st.plates) { ctx.fillStyle = '#8a9198'; ctx.fillRect(x - half - 2.5 + dx, y - 2.5, 5, 5); ctx.fillRect(x + half - 2.5 + dx * 0.6, y - 2.5, 5, 5); }
  }
  // per-metre structure: brackets (joints) every 4 m, diagonal bracing every 3 m, hazard paint, lamps
  for (let m = Math.max(0, Math.floor(mTop)); m <= mBot; m++) {
    const y0 = yOf(m);
    if (y0 < top || y0 > bot) continue;
    const dx = flex(y0), jit = shake && Math.abs(dx) > 0.6 ? Math.sin(view.t * 70 + m) * 1.1 : 0; // joints shake near the cart
    if (m % 4 === 0) { ctx.fillStyle = st.bracket; ctx.fillRect(x + half + 2 + dx * 0.5 + jit, y0 - 3 + jit, (st.metal ? 4 : 3) * s * 0.6 + 2, 6); }
    if (st.brace && m % 3 === 0) {
      ctx.strokeStyle = st.brace; ctx.lineWidth = st.metal ? 1.2 : 1.8;
      const y2 = yOf(m + 3);
      ctx.beginPath(); ctx.moveTo(x - half + dx, y0); ctx.lineTo(x + half + flex(y2), y2); ctx.moveTo(x + half + dx, y0); ctx.lineTo(x - half + flex(y2), y2); ctx.stroke();
    }
    if (st.hazard && m % 2 === 0) { ctx.fillStyle = m % 4 ? '#1d1d1d' : '#e0b322'; ctx.fillRect(x - half - st.w / 2, y0, st.w, 6); }
  }
  // rails: sampled so they can bow around a straining cart
  const rail = (ox: number, k: number) => {
    ctx.beginPath();
    for (let y = top, first = true; y <= bot + 8; y += 8, first = false) { const yy = Math.min(y, bot); const px = x + ox + flex(yy) * k; first ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy); }
    ctx.stroke();
  };
  ctx.save(); ctx.translate(1.6, 0.6); ctx.strokeStyle = 'rgba(8,5,3,.45)'; ctx.lineWidth = st.w + 0.6; rail(-half, 1); rail(half, 0.6); ctx.restore();
  ctx.strokeStyle = st.rail; ctx.lineWidth = st.w;
  rail(-half, 1); rail(half, 0.6);
  if (st.metal) { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.8; rail(-half + 1, 1); rail(half + 1, 0.6); }
  if (st.guard) { ctx.strokeStyle = '#e0b322'; ctx.lineWidth = 2; rail(-half - 5.4 * s, 1); }
  if (st.lamps) {
    ctx.save();
    for (let m = Math.ceil(Math.max(0, mTop) / st.lamps) * st.lamps; m <= mBot; m += st.lamps) {
      const y = yOf(m);
      if (y < top || y > bot) continue;
      ctx.fillStyle = '#3b3f45'; ctx.fillRect(x + half + 6, y - 2, 6, 4);
      ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x + half + 9, y - 1.5, 3, 3);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x + half + 10, y, 0, x + half + 10, y, 46);
      g.addColorStop(0, 'rgba(255,210,140,.22)'); g.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + half + 10, y, 46, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

function shadeHex(c: string, k: number) {
  const n = parseInt(c.slice(1), 16);
  return `rgb(${Math.min(255, Math.round(((n >> 16) & 255) * k))},${Math.min(255, Math.round(((n >> 8) & 255) * k))},${Math.min(255, Math.round((n & 255) * k))})`;
}

const CART_BODIES = [
  { w: 24, h: 13, body: '#6e5c50', band: '#3e3530', rim: '#8f7d6e', wheel: 3.2 }, // tiny rusty iron hand cart
  { w: 28, h: 15, body: '#646468', band: '#3d3d3d', rim: '#8e8f94', wheel: 3.6 }, // reinforced
  { w: 32, h: 17, body: '#6f7780', band: '#4b5157', rim: '#9aa3ad', wheel: 4 }, // metal mining cart
  { w: 36, h: 19, body: '#d9a520', band: '#2c2f33', rim: '#f2c64a', wheel: 4.4 }, // heavy industrial
];

/** The cart in screen space, base centred at (x, y). */
function drawCartAt(x: number, y: number, s: number, fill: number, tip: number, roll: number, heap = 0) {
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  const w = b.w * s, h = b.h * s, r = b.wheel * s;
  ctx.save();
  ctx.translate(x, y);
  if (tip < 0.05) contactShadow(0, 0.6 * s, w * 0.55, 1.8 * s, 0.4);
  ctx.translate(w / 2, -r); ctx.rotate(tip); ctx.translate(-w / 2, r); // tips over its right wheel, toward the stockpile
  // open top (seen slightly from above): back lip + dark interior; the load fills it so 25/50/75/100% read at a glance,
  // and an overloaded cart is heaped well above the rim
  const ob = h * 0.38, rimY = -r - h, backY = rimY - ob;
  ctx.fillStyle = shadeHex(b.body, 0.62);
  ctx.beginPath(); ctx.moveTo(-w / 2 + 1 * s, rimY); ctx.lineTo(-w / 2 + 3 * s, backY); ctx.lineTo(w / 2 - 3 * s, backY); ctx.lineTo(w / 2 - 1 * s, rimY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(20,14,10,.9)';
  ctx.beginPath(); ctx.moveTo(-w / 2 + 2.6 * s, rimY); ctx.lineTo(-w / 2 + 4 * s, backY + 1.4 * s); ctx.lineTo(w / 2 - 4 * s, backY + 1.4 * s); ctx.lineTo(w / 2 - 2.6 * s, rimY); ctx.closePath(); ctx.fill();
  if (fill > 0.001) {
    const level = Math.min(1, fill) * ob; // inside the opening
    const mound = Math.max(0, (fill - 0.75) / 0.25) * h * 0.3 + heap * h * 0.32; // above the back lip
    const cols = Math.max(3, Math.round(w / (3.6 * s))), rows = Math.max(1, Math.ceil((level + mound) / (2.6 * s)));
    for (let rI = 0; rI < rows; rI++) for (let c = 0; c < cols; c++) {
      const k = (c + 0.5) / cols, prof = Math.sin(Math.PI * k);
      const yTopHere = rimY - level - mound * prof;
      const py = rimY - 1.2 * s - rI * 2.6 * s - hash(rI * 7.1 + c) * 1.2 * s;
      if (py < yTopHere) continue;
      const i = rI * cols + c, px = -w / 2 + 3 * s + (w - 6 * s) * k + (hash(i * 3.3) - 0.5) * 2 * s;
      ctx.fillStyle = rgb(undergroundGrade(rubbleRGB(mixPick(S.cart.load, hash(i * 2.9)))), 0.78 + hash(i * 5.3) * 0.45);
      ctx.beginPath(); ctx.ellipse(px, py, (2 + hash(i) * 1.3) * s, (1.6 + hash(i * 2) * 1) * s, hash(i * 9) * 3, 0, 6.283); ctx.fill();
    }
  }
  // body (slightly tapered tub)
  ctx.fillStyle = b.body;
  ctx.beginPath(); ctx.moveTo(-w / 2, -r - h); ctx.lineTo(w / 2, -r - h); ctx.lineTo(w / 2 - 2.5 * s, -r); ctx.lineTo(-w / 2 + 2.5 * s, -r); ctx.closePath(); ctx.fill();
  outline(b.body, 'fg', s * 0.8);
  ctx.fillStyle = shadeHex(b.body, 0.72); // shadow side (light from the upper-left)
  ctx.beginPath(); ctx.moveTo(w / 2 - w * 0.22, -r - h); ctx.lineTo(w / 2, -r - h); ctx.lineTo(w / 2 - 2.5 * s, -r); ctx.lineTo(w / 2 - w * 0.22 - 1.5 * s, -r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b.band; ctx.fillRect(-w / 2 + 1.5 * s, -r - h * 0.55, w - 3 * s, 2 * s);
  ctx.fillStyle = b.rim; ctx.fillRect(-w / 2 - 1 * s, -r - h - 1.5 * s, w + 2 * s, 2.2 * s);
  ctx.fillStyle = 'rgba(255,240,215,.35)'; ctx.fillRect(-w / 2 - 0.5 * s, -r - h - 1.5 * s, w * 0.7, 0.8 * s); // lit rim
  if (b === CART_BODIES[2] || b === CART_BODIES[3]) { // rivets
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + (4 + i * (w / s - 8) / 3) * s - 1, -r - h * 0.3, 2, 2);
  }
  // chassis: a heavy frame under the tub, axles at the wheels (industrial, not an icon)
  ctx.fillStyle = '#2a2622'; ctx.fillRect(-w / 2 + 1.5 * s, -r - 1.6 * s, w - 3 * s, 2.6 * s);
  ctx.fillStyle = 'rgba(255,240,215,.18)'; ctx.fillRect(-w / 2 + 1.5 * s, -r - 1.6 * s, w - 3 * s, 0.7 * s);
  // wheels with turning spokes
  for (const wx of [-w / 2 + r + 1.5 * s, w / 2 - r - 1.5 * s]) {
    ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(wx, -r, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5a5e64'; ctx.beginPath(); ctx.arc(wx, -r, r * 0.38, 0, 6.283); ctx.fill(); // hubcap
    ctx.strokeStyle = '#777'; ctx.lineWidth = Math.max(1, 0.8 * s);
    ctx.beginPath(); ctx.moveTo(wx + Math.cos(roll) * r * 0.8, -r + Math.sin(roll) * r * 0.8); ctx.lineTo(wx - Math.cos(roll) * r * 0.8, -r - Math.sin(roll) * r * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function drawCart() {
  const s = faceScale(), c = cartScreen(), st = S.cart.state, cs = S.cart;
  if (c.y < -80 || c.y > view.H + 80) { view.cartRect = null; return; }
  let tip = 0, bump = 0;
  if (st === 'SURFACE_ARRIVAL') bump = Math.sin(Math.min(1, cs.t / cs.dur) * Math.PI) * 3 * s;
  if (st === 'UNLOADING') {
    const p = Math.min(1, cs.t / cs.dur);
    tip = 0.95 * (p < 0.75 ? Math.sin(Math.min(1, p / 0.3) * Math.PI / 2) : (1 - p) / 0.25);
  }
  const roll = cartDepth() * 1.6;
  // a strained/overloaded cart rattles on the track while it climbs
  const stress = st === 'TRAVELLING_UP' && !TRACKUP.active ? cartTrackStress() : 'safe';
  const rat = stress === 'over' ? 1 : stress === 'strained' ? 0.35 : 0;
  const rx = rat * Math.sin(view.t * 53) * 1.3 * s;
  tip += rat * Math.sin(view.t * 37) * 0.035;
  const heap = Math.min(1, Math.max(0, (cs.load.qty / trackSafe(S) - 1) * 3)); // load beyond the track's safe load
  // cable from the headframe pulley to the cart
  const pulleyY = yOf(-C.headframeM);
  ctx.strokeStyle = 'rgba(40,36,30,.8)'; ctx.lineWidth = railCableW();
  ctx.beginPath(); ctx.moveTo(c.x, Math.max(view.vy0 - 10, pulleyY)); ctx.lineTo(c.x, c.y - 22 * s + bump); ctx.stroke();
  drawCartAt(c.x + rx, c.y + bump, s * 1.12, cartFill(), tip, roll, heap); // drawn a bit bigger (tap rect unchanged)
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  view.cartRect = { x: c.x - (b.w / 2 + 6) * s, y: c.y - (b.h + b.wheel * 2 + 12) * s, w: (b.w + 12) * s, h: (b.h + b.wheel * 2 + 16) * s };
  // "tap to send" hint while it holds something but is not yet full
  if ((st === 'LOADING' || st === 'BOTTOM_EMPTY') && cs.load.qty > 0.5) {
    const cap = cartCapacity(S);
    ctx.font = `700 ${Math.round(9 * s)}px ${FONT_UI}`; ctx.textAlign = 'center';
    const txt = `${Math.floor(cs.load.qty)}/${cap}`, tw = ctx.measureText(txt).width + 10 * s, ty = c.y - (b.h + b.wheel * 2 + 6) * s;
    ctx.fillStyle = 'rgba(14,9,6,.62)'; ctx.beginPath(); ctx.roundRect(c.x - tw / 2, ty - 9.5 * s, tw, 13 * s, 6 * s); ctx.fill(); // pill
    ctx.fillStyle = 'rgba(255,248,235,.95)';
    ctx.fillText(txt, c.x, ty);
  }
  if (cartBlocked()) bubble(c.x - 30, c.y - (b.h + b.wheel * 2 + 14) * s, 'STORAGE FULL', '#ff9a7a');
}


let frameLamps: ReturnType<typeof mineLamps> = [];
let spanM = 0; // depth below which the shaft has no spreaders/ledges (lamps follow the same structure)
function drawWorld() {
  const { H, t } = view;
  const PPM = CFG.ppm;
  const top = viewTop(), cx = shaftCX(), sw = shaftW();
  const X0 = view.vx0 - 10, XW = view.vx1 - view.vx0 + 20;
  const gy = yOf(0);
  // sky + surface landscape (only when the ground line is in view)
  if (gy > view.vy0) drawLandscape(gy, X0, XW);
  // painted, deterministic geology
  drawGeology(ctx, cx, yOf, Math.max(0, top + view.vy0 / PPM), top + view.vy1 / PPM, view.vx0, view.vx1);
  // background earth: muted + world-anchored mottling so it reads as one mass behind the gameplay (art rule: bg recedes)
  const eTop = Math.max(view.vy0, gy + 6);
  if (view.vy1 > eTop) {
    ctx.fillStyle = PAL.bgMute; ctx.fillRect(X0, eTop, XW, view.vy1 - eTop);
    texture('earth', X0, eTop, XW, view.vy1 - eTop, 0.1, cx, gy);
    desaturate(X0, eTop, XW, view.vy1 - eTop, materialAt(view.camDepth).ore ? 0.15 : 0.45); // underground earth: dark, earthy, not orange (precious layers keep their hue)
  }
  // shaft: excavated rock around the (unchanged) logical shaft — rockwall.ts
  const sTop = Math.max(view.vy0, gy), sBot = faceOrigin().y;
  const fs = faceScale(), ceil = worksiteDef().ceiling;
  const cmW = chamberM(), chBot = cmW === null ? NaN : yOf(cmW), chTop = chBot - ceil * fs;
  const g: ShaftGeom = { cx, sw, k: fs, sTop, sBot, floorM: view.camDepth, wallBot: sBot - pocketH() * fs, chTop, chBot };
  spanM = view.camDepth + (restAreaBuilt() ? RS.platformY - 60 : -70) * fs / PPM - pocketH() * fs / PPM;
  frameLamps = mineLamps(spanM);
  setRockLights(undergroundK() > 0.02 ? frameLamps : []);
  setRockSpace(0, 0, 1);
  if (sBot > sTop) drawRockMass(g);
  if (gy > view.vy0 - 20 && gy < view.vy1) drawGround(gy, X0, XW);
  if (sBot > sTop) {
    ctx.save(); interiorPath(g); ctx.clip();
    const ix = cx - sw / 2 - 40 * fs, iw = sw + 80 * fs;
    ctx.fillStyle = 'rgba(12,8,6,.62)';
    ctx.fillRect(ix, sTop, iw, sBot - sTop);
    texture('rock', ix, sTop, iw, sBot - sTop, 0.06, cx, gy); // kept faint: a dark backdrop must not sparkle
    drawRearWall(g);
    drawRearFrame(g, view.camDepth - (restAreaBuilt() ? 40 : 30) * fs / PPM - ceil * fs / PPM);
    // depth: the shaft darkens upward, and the work light pools on the face so the action is the focus
    const L = CFG.light;
    const gd = ctx.createLinearGradient(0, sBot - H * L.fadeSpan, 0, sBot);
    gd.addColorStop(0, `rgba(0,0,0,${L.shaftDark})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gd; ctx.fillRect(ix, sTop, iw, sBot - sTop);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, sBot - 6, 0, cx, sBot - 6, sw * L.radius);
    gl.addColorStop(0, `rgba(255,196,120,${L.glow})`); gl.addColorStop(1, 'rgba(255,196,120,0)');
    const gTop = Math.max(sTop, sBot - sw * L.radius); // never leak above ground into the sky
    ctx.fillStyle = gl; ctx.fillRect(ix, gTop, iw, sBot - gTop);
    ctx.restore();
    drawInnerCut(g);
    ctx.restore();
    drawEdgeRocks(g);
    drawWallDepthRamp(g);
    // timber: keep the left wall clear above the rest platform/stairs; spreaders stay above the work area
    const platM = spanM;
    // (no rock bulges: the centre of an excavated shaft is empty air — the wall panels carry the rock)
    drawTimberSets(g, platM, platM);
    lastGeom = g;
    drawCollar(g, gy);
    // (depth labels: drawDepthLabels, after the darkness so they stay readable)
  }
  FINDS.forEach((f, i) => {
    const y = yOf(f.d); if (y < view.vy0 - 120 || y > view.vy1 + 120) return;
    const edge = cx + f.side * Math.max(sw / 2, (face.w / 2) * faceScale());
    const x = f.kind === 'car' ? edge + f.side * RIG_H * CFG.crewScale * faceScale() * 0.55 : deepFindPos(f).x; // car: front bumper clear of the depth marks; deep finds sit in the room's side bay
    if (i < S.found && (f.kind === 'coin' || f.kind === 'car')) {
      if (f.kind !== 'car') { ctx.fillStyle = 'rgba(10,6,4,.75)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 16, 9, 0.2, 0, 6.283); ctx.fill(); } // a crevice
      drawFind(f, x, y, 1);
      if (f.kind === 'car') { const k = faceScale(), p = palAt(f.d); setRockSpace(0, 0, 1);
        drawCluster(cluster(9100 + i, 28 * k, 18 * k, 0.2, 4, 1), x - f.side * 6 * k, y + 14 * k, p, 1, 1.1);
        drawCluster(cluster(9110 + i, 38 * k, 26 * k, -0.3, 4, 0), x + f.side * 70 * k, y - 14 * k, p, 1, 1); }
    }
    else if (i === S.found && f.d - S.depth < CFG.findTeaseM) {
      drawFind(f, x, y, 0.12 + 0.06 * Math.sin(t * 3));
      ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center';
      const tw = ctx.measureText('Something is down here…').width + 16;
      if (x > view.vx0 - tw && x < view.vx1 + tw && y > view.vy0 && y < view.vy1 + 60) teaseAt = { x: Math.max(view.vx0 + tw / 2 + 8, Math.min(view.vx1 - tw / 2 - 30, x)), y, tw }; // only when its find is on screen; drawn over the darkness
    }
  });
  drawRails(yOf(-C.surfaceLiftM - 1.5), faceOrigin().y + 2);
  drawSurface(gy);
  drawSite();
  drawSiteStack(); // the block pile is on the plot, behind the road
  drawTruckLayer(gy); // the truck drives on the road in front of it
  drawSiteFront(); // scaffold, builders, crane and the block count stay in front of the parked truck
}

/** Depth marks on the right wall: drawn over the darkness, light text with a dark shadow (readable on rock). */
let teaseAt: { x: number; y: number; tw: number } | null = null;
function drawDepthLabels() {
  if (teaseAt) { // "Something is down here…" (kept on screen, readable)
    const { x, y, tw } = teaseAt; teaseAt = null;
    ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(14,9,6,.75)'; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 56, tw, 22, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,215,.92)'; ctx.fillText('Something is down here…', x, y - 40);
  }
  const top = viewTop(), cx = shaftCX(), sw = shaftW(), PPM = CFG.ppm;
  const stepM = S.depth > 80 ? 25 : 10, mEnd = Math.min(view.camDepth, top + view.vy1 / PPM);
  ctx.font = `700 12px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  for (let m = Math.max(stepM, Math.ceil(Math.max(0, top + view.vy0 / PPM) / stepM) * stepM); m < mEnd; m += stepM) {
    const y = yOf(m), t = fmt(m) + ' m';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx + sw / 2 - 23, y + 1, 14, 2);
    ctx.fillStyle = 'rgba(240,226,200,.85)'; ctx.fillRect(cx + sw / 2 - 24, y, 14, 2);
    ctx.strokeStyle = 'rgba(10,6,4,.8)'; ctx.lineWidth = 3; ctx.strokeText(t, cx + sw / 2 + 6, y + 4);
    ctx.fillStyle = 'rgba(240,226,200,.9)'; ctx.fillText(t, cx + sw / 2 + 6, y + 4);
  }
}

/** Night/sunset grade over the surface, then the practical lights (yard lamps, headframe, headlights). */
function drawSurfaceLight() {
  const gy = yOf(0);
  if (gy > view.vy0 - 50) drawSurfaceGrade(gy, view.vx0 - 10, view.vx1 - view.vx0 + 20);
  flushGlows();
}

// ---------- HUD overlays ----------
function drawGauge() {
  const { W, H } = view;
  const gx = W - 22, gt = 20, gh = H - 40;
  for (let i = 0; i < MATERIALS.length; i++) {
    const a = MATERIALS[i].from, b = i + 1 < MATERIALS.length ? MATERIALS[i + 1].from : MAX_DEPTH;
    ctx.fillStyle = rgb(MATERIALS[i].wall, 1.1);
    ctx.fillRect(gx + 1, gt + (a / MAX_DEPTH) * gh, 6, ((b - a) / MAX_DEPTH) * gh + 1);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(gx - 5, gt + (S.depth / MAX_DEPTH) * gh - 1, 18, 3);
  // the cart's live position on its journey
  const cd = Math.max(0, cartDepth());
  ctx.fillStyle = '#ffcf3a'; ctx.fillRect(gx - 9, gt + (cd / MAX_DEPTH) * gh - 3, 6, 6);
  ctx.font = `700 11px ${FONT_UI}`; ctx.textAlign = 'right';
  FINDS.forEach((f, i) => {
    ctx.fillStyle = i < S.found ? '#ffcf3a' : 'rgba(255,255,255,.75)';
    ctx.fillText(i < S.found ? '★' : '?', gx - 5, gt + (f.d / MAX_DEPTH) * gh + 4);
  });
}

/** Discovered deep finds, drawn over the darkness in their little display light (the crew left a lamp on each). */
function drawFoundFinds() {
  FINDS.forEach((f, i) => {
    if (i >= S.found || f.kind === 'coin' || f.kind === 'car') return;
    const p = deepFindPos(f);
    if (p.y < view.vy0 - 80 || p.y > view.vy1 + 80) return;
    drawFind(f, p.x, p.y, 1);
  });
}

/** THE GATES OF HELL: below 940 m a colossal arch glows up through the floor; at 1,000 m its doors stand open. */
function drawHellGate() {
  const p = Math.max(0, Math.min(1, (S.depth - 940) / 60));
  if (p <= 0) return;
  const k = faceScale(), floorY = yOf(S.depth) - 4 * k, w = shaftW() * 0.62, h = Math.min(w * 1.05, (floorY - view.vy0) * 0.86), top = floorY - h, cx = shaftCX(), x0 = cx - w / 2;
  if (floorY < view.vy0 || top > view.vy1) return;
  const open = gateOpen() > 0.3 || S.flags.finished === true, pulse = 0.75 + 0.25 * Math.sin(view.t * 2.2);
  ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * p;
  // fire light behind / through the doorway
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, top + h * 0.45, 0, cx, top + h * 0.45, w * 0.9);
  g.addColorStop(0, `rgba(255,120,40,${(0.55 * pulse * (open ? 1.4 : 0.7)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,60,10,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - w, top - h * 0.6, w * 2, h * 2);
  ctx.globalCompositeOperation = 'source-over';
  // the arch: dark stone frame with glowing runes
  const arch = (ins: number) => { ctx.beginPath(); ctx.moveTo(x0 + ins, top + h); ctx.lineTo(x0 + ins, top + w * 0.5); ctx.arc(cx, top + w * 0.5, w / 2 - ins, Math.PI, 0); ctx.lineTo(x0 + w - ins, top + h); ctx.closePath(); };
  arch(0); const sg = ctx.createLinearGradient(x0, 0, x0 + w, 0); sg.addColorStop(0, '#4a3430'); sg.addColorStop(0.5, '#2a1c1a'); sg.addColorStop(1, '#1a1010'); ctx.fillStyle = sg; ctx.fill(); // carved basalt frame
  ctx.strokeStyle = `rgba(255,90,40,${(0.6 + 0.4 * pulse).toFixed(2)})`; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 + 2, top + h * i / 6); ctx.lineTo(x0 + w * 0.09, top + h * i / 6); ctx.moveTo(x0 + w - w * 0.09, top + h * i / 6); ctx.lineTo(x0 + w - 2, top + h * i / 6); ctx.stroke(); } // stone courses
  const ins = w * 0.09;
  arch(ins); ctx.save(); ctx.clip();
  const door = S.flags.finished ? 1 : gateOpen(), half = (w - ins * 2) / 2, dx0 = x0 + ins;
  if (door > 0) { // behind the doors: a wall of churning lava, brighter the wider they open
    ctx.fillStyle = '#5a1004'; ctx.fillRect(x0, top, w, h);
    drawLava(ctx, 'gate', x0, top, w, h, view.t, { mode: 'pool', wx: 400, wy: 300, scale: 0.4, heat: 0.15 + door * 0.25 });
  }
  if (door < 1) for (const side of [-1, 1]) { // two studded iron doors swinging inward (they narrow as they turn)
    const dw = half * (1 - door), ex = side < 0 ? dx0 : x0 + w - ins - dw;
    const dg = ctx.createLinearGradient(0, top, 0, top + h); dg.addColorStop(0, door > 0 ? '#3a1410' : '#5a2018'); dg.addColorStop(1, '#1e0806');
    ctx.fillStyle = dg; ctx.fillRect(ex, top, dw, h);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let yy = top + h * 0.15; yy < top + h; yy += h * 0.18) ctx.fillRect(ex, yy, dw, 3);
    ctx.fillStyle = '#c86a3a'; for (let yy = top + h * 0.15; yy < top + h; yy += h * 0.18) for (let q = 0.15; q < 1; q += 0.24) { ctx.beginPath(); ctx.arc(ex + dw * q, yy + 1.5, 1.6 * (1 - door * 0.6), 0, 6.283); ctx.fill(); }
    ctx.fillStyle = `rgba(0,0,0,${(0.5 * door).toFixed(2)})`; ctx.fillRect(ex, top, dw, h); // turning away from the light
  }
  if (door <= 0) { // closed: light leaks through the seam
    const sg2 = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0); sg2.addColorStop(0, 'rgba(255,120,40,0)'); sg2.addColorStop(0.5, `rgba(255,${(170 + 60 * pulse) | 0},80,${(0.8 * p).toFixed(2)})`); sg2.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = sg2; ctx.fillRect(cx - 10, top, 20, h);
  }
  ctx.restore();
  ctx.font = `${Math.round(w * 0.05)}px 'Bungee',Impact,sans-serif`; ctx.textAlign = 'center';
  for (let i = 0; i < 9; i++) { // runes around the arch, flickering
    const a = Math.PI + (i + 0.5) / 9 * Math.PI, r = w / 2 - ins / 2;
    ctx.fillStyle = `rgba(255,${120 + (Math.sin(view.t * 3 + i) * 60) | 0},40,${(0.6 + 0.4 * Math.sin(view.t * 4 + i * 1.7)).toFixed(2)})`;
    ctx.fillText('ᛟᚺᛖᛚᛚᛞᚱᚷᛒ'[i], cx + Math.cos(a) * r, top + w * 0.5 + Math.sin(a) * r + w * 0.018);
  }
  ctx.restore();
}

/** Live dig rate of the whole operation (player + crew + machines), measured over the last ~6 s: metres per second
 *  and rubble per second, top-left under the tile bar. */
const rateHist: { t: number; d: number; r: number }[] = [];
let shownMps = 0, shownRps = 0;
/** PILE FULL: rubble the crew breaks while the pile is at capacity is shovelled back into the floor. Show it happening
 *  (spill sliding off the pile + a grey "−N backfilled") so lost output is visible in the world, not only a red number. */
let lostShown = -1, lostT = 0;
function drawBackfill(px: number, top: number) {
  if (lostShown < 0 || DUG.lost < lostShown) lostShown = DUG.lost;
  const pending = DUG.lost - lostShown;
  if (pending < 1 || view.t - lostT < 1.6) return;
  const n = Math.floor(pending);
  lostShown += n; lostT = view.t;
  const at = toScreen(px + 18, top - 26), base = toScreen(px, top), k = faceScale(); // popups + particles live in screen space
  popup(at.x, at.y, `−${fmt(n)} backfilled`, '#c7d0db', 15, { life: 1.6, alpha: 0.95, rise: 0.5, sub: 'PILE FULL · the cart can\'t keep up' });
  for (let i = 0; i < 10; i++) addPart({ kind: 'dust', x: base.x + rnd(-16, 16) * k, y: base.y + rnd(0, 8) * k, vx: rnd(-50, 50), vy: rnd(10, 50), size: rnd(3, 6) * k, col: 'rgba(150,130,110,1)', life: rnd(0.5, 0.9), floor: Infinity, bounce: 0 });
}

/** Forget the rate history (after a background-tab catch-up jump, which isn't digging speed). */
export function resetDigRate() { rateHist.length = 0; shownMps = 0; shownRps = 0; }
function drawDigRate(W: number) {
  const now = view.t;
  if (!rateHist.length || now - rateHist[rateHist.length - 1].t >= 0.25) rateHist.push({ t: now, d: S.depth, r: DUG.rubble });
  while (rateHist.length > 2 && now - rateHist[0].t > 6) rateHist.shift();
  const a = rateHist[0], b = rateHist[rateHist.length - 1], dt = Math.max(0.5, b.t - a.t);
  const mps = S.depth >= MAX_DEPTH ? 0 : Math.max(0, (b.d - a.d) / dt), rps = Math.max(0, (b.r - a.r) / dt);
  shownMps += (mps - shownMps) * 0.08; shownRps += (rps - shownRps) * 0.08; // smooth the readout
  const fmtR = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const x = 12, y = 84, w = W < 600 ? 140 : 160, h = 66;
  ctx.fillStyle = 'rgba(9,14,22,.82)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#2a3a52'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'left';
  const hell = S.depth >= MAX_DEPTH;
  ctx.font = `600 11px ${FONT_UI}`; ctx.fillStyle = hell ? '#ff9a6a' : '#9eb3cf'; ctx.fillText(hell ? '🔥 QUARRYING HELLSTONE' : '⛏ DIGGING SPEED', x + 10, y + 16);
  ctx.font = `${W < 600 ? 17 : 21}px ${FONT_DISPLAY}`; ctx.fillStyle = '#ffcf3a'; ctx.fillText(hell ? '1,000 m' : `${fmtR(shownMps)} m/s`, x + 10, y + 40);
  ctx.font = `600 12px ${FONT_UI}`; ctx.fillStyle = '#c9d3e0'; ctx.fillText(`${fmtR(shownRps)} rubble/s`, x + 10, y + 57);
}

/** "+N" over each miner / machine whose strike broke a chunk (N = rubble per break). Drawn AFTER the mine darkness so
 *  the numbers stay bright, in the work floor's logical coordinates. */
function drawCrewPops() {
  if (!crewPops.length) return;
  const o = faceOrigin(), s = faceScale();
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
  // "+N" over each miner's head when their strike breaks a chunk (N = rubble per break: grows with Crew Gear)
  for (let i = crewPops.length - 1; i >= 0; i--) {
    const c = crewPops[i]; if (!c.t) c.t = view.t; // birth time (set on first draw)
    const age = view.t - c.t;
    if (age > 0.9) { crewPops.splice(i, 1); continue; }
    const a = age < 0.1 ? age / 0.1 : age < 0.6 ? 1 : 1 - (age - 0.6) / 0.3, y = (c.y ?? -58) - age * 16;
    ctx.globalAlpha = Math.max(0, a); ctx.font = `700 ${c.n >= 20 ? 16 : c.n >= 6 ? 12.5 : 11}px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
    ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(20,10,4,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(`+${c.n}`, c.x, y);
    ctx.fillStyle = c.n >= 20 ? '#ff9a4a' : c.n >= 6 ? '#9be8ff' : c.n >= 4 ? '#ffd84a' : '#f3e6cf'; ctx.fillText(`+${c.n}`, c.x, y);
    ctx.globalAlpha = 1;
  }
  if (crewPops.length > 30) crewPops.splice(0, crewPops.length - 30);
  ctx.restore();
}

function drawOverlays() {
  const { W, H, t } = view;
  const b = FX.banner;
  if (b) {
    ctx.globalAlpha = Math.min(1, b.t * 3, Math.max(0, CFG.bannerSecs - b.t));
    ctx.textAlign = 'center'; ctx.font = `34px ${FONT_DISPLAY}`;
    const by = 118;
    ctx.font = `${W < 600 ? 22 : 34}px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(b.s, W / 2 + 2, by + 2);
    ctx.fillStyle = '#ffcf3a'; ctx.fillText(b.s, W / 2, by);
    ctx.font = `500 15px ${FONT_UI}`; ctx.fillStyle = '#fff'; ctx.fillText(b.sub, W / 2, by + 26);
    ctx.globalAlpha = 1;
  }
  if (S.clicks < 3 && !view.hideDigHint && view.site === 'mine' && !view.tween) {
    // the first interaction, made obvious: pulsing tap rings where a strike lands + a readable label on a plate
    const cx = shaftCX(), cy = faceY() + 7.5 * faceScale();
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.9 + i * 0.5) % 1;
      ctx.strokeStyle = `rgba(255,207,58,${(0.85 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 10 + 34 * k, 0, 6.283); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,207,58,.9)'; ctx.beginPath(); ctx.arc(cx, cy, 5 + Math.sin(t * 6), 0, 6.283); ctx.fill();
    const label = `${TOUCH ? 'Tap' : 'Click'} the rock to dig`;
    ctx.textAlign = 'center'; ctx.font = `700 ${W < 600 ? 16 : 18}px ${FONT_UI}`;
    const tw = ctx.measureText(label).width + 24, ly = cy + 62;
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 4);
    ctx.fillStyle = 'rgba(12,9,6,.78)'; ctx.beginPath(); ctx.roundRect(cx - tw / 2, ly - 20, tw, 30, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, cx, ly + 1);
    ctx.globalAlpha = 1;
  }
  if (view.site === 'mine' && !view.tween && S.tut >= 1) drawDigRate(W);
  if (view.site === 'mine' && !view.tween && S.tut >= 6) { // what lies below: the next layer, always one goal ahead
    const next = MATERIALS.find((m) => m.from > S.depth);
    const txt = S.depth >= MAX_DEPTH ? '🔥 THE GATES OF HELL · 1,000 m' : next ? `▼ ${next.name.toUpperCase()} in ${Math.ceil(next.from - S.depth)} m` : `▼ THE GATES OF HELL in ${Math.ceil(MAX_DEPTH - S.depth)} m`;
    ctx.font = `400 ${W < 600 ? 12 : 15}px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
    const w = ctx.measureText(txt).width + 26, y = H - 30;
    ctx.fillStyle = 'rgba(10,8,14,.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 18, w, 27, 13.5); ctx.fill();
    ctx.strokeStyle = next ? `rgba(${(next.ore?.[0] ?? next.chip).join(',')},.8)` : 'rgba(255,90,40,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = next ? `rgb(${(next.ore?.[0] ?? [255, 224, 150]).join(',')})` : '#ff7a4a'; ctx.fillText(txt, W / 2, y + 1);
  }

}

/** dev-only: the slowest render stages of the last frame (main.ts logs it with long frames) */
export let renderSplit = '';
const RSPLIT: [string, number][] = [];
const tm = (name: string, f: () => void) => { if (!import.meta.env.DEV) { f(); return; } const t = performance.now(); f(); RSPLIT.push([name, performance.now() - t]); };
export function render() {
  if (import.meta.env.DEV) RSPLIT.length = 0;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#191c20'; ctx.fillRect(0, 0, view.W, view.H);
  ctx.save();
  ctx.translate(FX.cam.x, FX.cam.y);
  applyZoom(ctx);
  tm('drawWorld', () => drawWorld());
  tm('drawHellBack', () => drawHellBack()); // the Hell layer: back lavafalls, giant fossils, heat haze (from 930 m)
  tm('drawHellGate', () => drawHellGate()); // the Gates of Hell stand in the back wall at the bottom, behind the crew
  tm('drawFoundFinds', () => drawFoundFinds()); // in the back wall, behind the crew (their display lamp lights them through the darkness)
  tm('drawFaceAndCrew', () => drawFaceAndCrew());
  if (lastGeom) { drawRoomCatwalk(lastGeom); drawLedgeCrew(); lastGeom = null; } // after the room is drawn (it would cover them), before the darkness
  tm('drawCart', () => drawCart());
  tm('drawSurfaceLight', () => drawSurfaceLight());
  FX.under = undergroundK();
  tm('worldFx', () => drawWorldFx(ctx)); // debris sits in the same underground light as everything else
  tm('drawHellLife', () => drawHellLife()); // lava falls, crawling skeletons, and the finale's lava flood
  tm('darkness', () => drawMineDarkness(frameLamps)); // underground darkness + work lamps (Pass 3A/3B)
  tm('drawHellFront', () => drawHellFront()); // the lava sea under the floor (emissive: after the darkness)
  tm('drawCrewPops', () => drawCrewPops());
  tm('drawLayerMagic', () => drawLayerMagic()); // deep layers: gems twinkle in the dark, the hot layers glow
  if (yOf(0) < view.vy1) drawDepthLabels();
  { // daylight falls into the opening: a soft sunbeam down the first ~12 m (gone at night)
    const gy = yOf(0), day = 1 - nightness(), cx = shaftCX(), sw = shaftW();
    if (day > 0.05 && gy < view.vy1 && gy + 12 * CFG.ppm > view.vy0) {
      const g = ctx.createLinearGradient(0, gy, 0, gy + 12 * CFG.ppm);
      g.addColorStop(0, `rgba(255,236,190,${(0.1 * day).toFixed(3)})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.fillRect(cx - sw / 2, gy, sw, 12 * CFG.ppm); // soft fall-off, no hard wedge edges
      ctx.restore();
    }
  }
  drawPopups(ctx);
  ctx.restore();
  drawGauge();
  drawOverlays();
  drawFinaleOverlay();
  if (import.meta.env.DEV) renderSplit = RSPLIT.filter((x) => x[1] > 4).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `${n} ${Math.round(v)}`).join(', ');
}
