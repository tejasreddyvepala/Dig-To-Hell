// Draws the world, the destructible dig face, miner/crew, FX and HUD overlays. Reads state; never mutates sim.
import { CFG, FINDS, MATERIALS, MAX_DEPTH, TOOLS, type Find } from './config';
import { S } from './state';
import { cartCapacity, mixPick, tierOf, trackSafe } from './economy';
import { materialAt, rubbleRGB } from './geo';
import { drawSurface, drawTruckLayer, flushGlows } from './yard';
import { bubble, drawPile, pileHeight, pileLabel } from './draw';
import { cartBlocked, cartDepth, cartFill, cartTrackStress } from './cart';
import { TRACKUP } from './track';
import { reinforceY } from './trackfx';
import { drawExcavator, drawExcavatorLight, drawLampBeam } from './characters';
import { RIG_H, drawRig, lookFor, type Look, type Pose } from './rig';
import { ladderFrame } from './ladder';
import { face, type Chunk, type Crack, type Mark } from './digface';
import { pathPos, restAreaBuilt, restingCount, seatsTotal, workers, type Worker } from './workers';
import { pileX, railX, shaftOff, worksiteDef } from './layout';
import { EXP, chargeSpots, expanding } from './expansion';
import { drawSite } from './site';
import { miner, minerSwingAngle, swingAngle } from './miner';
import { FX, drawPopups, drawWorldFx } from './fx';
import { applyZoom, cartScreen, ctx, faceOrigin, faceScale, faceY, shaftCX, shaftW, toScreen, view, viewTop, yOf } from './view';
import { drawGeology } from './geo';
import { drawGround, drawLandscape, drawSurfaceGrade } from './landscape';
import { fmt, hash, rgb, rgba } from './util';

const FONT_DISPLAY = "'Bungee',Impact,sans-serif";
const FONT_UI = "'Rubik',system-ui,sans-serif";
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
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const k of c.cracks) {
    if (k.style === 'deep') {
      ctx.strokeStyle = 'rgba(90,110,210,.22)';
      ctx.lineWidth = k.w * 2; strokeCrack(k);
      ctx.strokeStyle = 'rgba(2,2,8,.95)'; ctx.lineWidth = k.w; strokeCrack(k);
    } else if (k.style === 'thick') {
      ctx.strokeStyle = 'rgba(30,8,2,.92)'; ctx.lineWidth = k.w; strokeCrack(k);
      ctx.save(); ctx.translate(0.8, 0.9); ctx.strokeStyle = 'rgba(255,190,150,.22)'; ctx.lineWidth = 0.8; strokeCrack(k); ctx.restore();
    } else if (k.style === 'radial') {
      ctx.strokeStyle = c.mat.crack; ctx.lineWidth = k.w; strokeCrack(k);
      ctx.save(); ctx.translate(0.7, 0.7); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.6; strokeCrack(k); ctx.restore();
    } else {
      ctx.strokeStyle = c.mat.crack; ctx.lineWidth = k.w; strokeCrack(k);
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
  const id = c.mat.id;
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
  gm.addColorStop(0, rgb(cur.face, 0.3)); gm.addColorStop(1, rgba(cur.face, 0.45, 0));
  ctx.fillStyle = gm;
  ctx.fillRect(0, F.edgeJitter, W, F.craterDepth - F.edgeJitter);

  // chunks share one face-space gradient per material, have no outlines, and differ only by damage
  const grads = new Map<string, CanvasGradient>();
  const grad = (c: Chunk) => {
    let g = grads.get(c.mat.id);
    if (!g) {
      // lit lip -> body -> fades out into the surrounding ground, so the face is the top of a mass, not a strip
      g = ctx.createLinearGradient(0, -4, 0, F.height);
      g.addColorStop(0, rgb(c.mat.face, 1.16)); g.addColorStop(0.22, rgb(c.mat.face, 1));
      g.addColorStop(0.6, rgba(c.mat.face, 0.92, 0.85)); g.addColorStop(1, rgba(c.mat.face, 0.85, 0));
      grads.set(c.mat.id, g);
    }
    return g;
  };
  const polys = face.chunks.map((c) => dippedPoly(c, s));
  face.chunks.forEach((c, i) => {
    const b = bbox(polys[i]);
    polyPath(polys[i]);
    ctx.fillStyle = grad(c);
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawTexture(c, b);
    for (const m of c.marks) drawMark(m);
    // damage cracks belong to the working face only: they fade out before the face blends into untouched ground
    ctx.beginPath(); ctx.rect(b.x0 - 4, b.y0 - 8, b.x1 - b.x0 + 8, F.height * F.crackDepthFrac + 8); ctx.clip();
    drawCracks(c);
    if (c.reveal > 0) {
      // freshly exposed rock: a soft dark bowl around the crater, never a rectangle
      const cx = (b.x0 + b.x1) / 2, r = (b.x1 - b.x0) * 0.75;
      const g = ctx.createRadialGradient(cx, b.y0 + c.dip, 0, cx, b.y0 + c.dip, r);
      g.addColorStop(0, `rgba(12,6,0,${((0.6 * c.reveal) / F.revealSecs).toFixed(3)})`); g.addColorStop(1, 'rgba(12,6,0,0)');
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
      const col = PULSE[c.mat.id];
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
  lip(); ctx.strokeStyle = rgba(cur.face, 1.5, 0.75); ctx.lineWidth = 1.5; ctx.stroke();
}

// ---------- figures (people: rig.ts; machines: characters.ts) ----------
function workerAngle(timer: number, since: number) {
  return timer < IMPACT_AT ? swingAngle(IMPACT_AT - timer) : swingAngle(IMPACT_AT + since);
}
/** 0..1 swing progress for machines (0 raised, 1 at impact), derived from the same timing as the miners. */
const machineK = (timer: number, since: number) => Math.max(0, Math.min(1, (workerAngle(timer, since) + 0.5) / 1.55));

const PLAYER_LOOK = lookFor('player', 1);
const looks = new Map<number, Look>();
const minerLook = (seed: number) => { let l = looks.get(seed); if (!l) looks.set(seed, (l = lookFor('miner', seed))); return l; };
const RS = CFG.rest;

// ---------- wall-ladder climbing: rung-locked (shared with the construction site, ladder.ts) ----------

/** Pose for a crew member from its behaviour state. */
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
    case 'idle': return { k: w.idle, t: w.t / w.idleDur };
    default: return { k: 'swing', t: 0, a: workerAngle(w.timer, w.since), tool: TOOLS[0] };
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

/** Owned diggers beyond the visible few: a quiet note by the rest platform (they dig at the full rate). */
function drawReserve() {
  const extra = S.crew.dig - workers.filter((w) => w.id === 'dig').length;
  if (extra <= 0) return;
  ctx.font = `700 9px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e8dcc0';
  ctx.fillText(`+${extra} more crew working`, 4, RS.platformY - 40);
}

const TIMBER = '#6e4a2a', TIMBER_D = '#4e341d', TIMBER_L = '#8a6238';

/** Work Chamber: the carved-out cavity, ceiling, and timber supports (supports go up after the blast). */
function drawChamber() {
  const site = worksiteDef();
  if (!site.ceiling) return;
  const w = face.w, h = site.ceiling, off = shaftOff();
  // cavity: carved rock in shadow, a little lighter toward the floor (work lights)
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, 'rgba(10,7,5,.78)'); g.addColorStop(1, 'rgba(30,20,12,.55)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h + 14);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, -h + (x > off - 6 && x < off + CFG.face.logicalW + 6 ? -2 : hash(x * 0.37) * 10));
  ctx.lineTo(w, -h + 12); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
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
    ctx.fillStyle = TIMBER; ctx.fillRect(x - 3.5, -h * kk, 7, h * kk);
    ctx.fillStyle = TIMBER_D; ctx.fillRect(x - 3.5, -h * kk, 1.6, h * kk);
    if (kk >= 1) { ctx.fillStyle = TIMBER_L; ctx.fillRect(x - 12, -h + 2, 24, 6); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 12, -h + 7, 24, 1.5); }
  });
  if (k >= 1) { // cap beams between the posts over the side bays
    ctx.fillStyle = TIMBER;
    ctx.fillRect(70, -h + 2, off - 64, 5); ctx.fillRect(off + CFG.face.logicalW - 6, -h + 2, w - 8 - (off + CFG.face.logicalW - 6), 5);
    // hanging work lamps in the bays
    for (const lx of [(70 + off) / 2, (off + CFG.face.logicalW + w) / 2]) {
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, -h + 7); ctx.lineTo(lx, -h + 30); ctx.stroke();
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(lx, -h + 32, 3, 0, 6.283); ctx.fill();
    }
  }
}

/** People route on the LEFT wall: an access ladder to the surface; once the shaft is deep enough, switchback
 *  wooden stairs up to the rest platform. */
function drawRestArea(groundY: number) {
  const fy = RS.landingY, py = RS.platformY, pw = RS.platformW, built = restAreaBuilt();
  // access ladder: surface -> platform (or the floor while the shaft is shallow)
  ctx.strokeStyle = TIMBER_L; ctx.lineWidth = 1.6;
  const lx = RS.ladderX, top = Math.max(groundY, -2400), bot = built ? py : 0;
  if (bot > top) {
    ctx.beginPath(); ctx.moveTo(lx - 5, top); ctx.lineTo(lx - 5, bot); ctx.moveTo(lx + 5, top); ctx.lineTo(lx + 5, bot); ctx.stroke();
    for (let y = bot - 6; y > top; y -= 8) { ctx.beginPath(); ctx.moveTo(lx - 5, y); ctx.lineTo(lx + 5, y); ctx.stroke(); }
  }
  if (top === groundY && top < bot - 20) { // shaft collar: planks at the surface where the ladder starts
    ctx.fillStyle = TIMBER; ctx.fillRect(-18, top - 1, lx + 12 + 18, 4);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let x = -12; x < lx + 10; x += 8) ctx.fillRect(x, top - 1, 1, 4);
    ctx.fillStyle = TIMBER_D; ctx.fillRect(lx + 6, top - 1, 3, 10);
  }
  if (!built) return;
  // flight 1: floor (stairFootX, 0) -> landing (landingX, landingY)
  const flight = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.strokeStyle = TIMBER_D; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x1, y1 + 2); ctx.stroke();
    const n = Math.round(Math.abs(y1 - y0) / 6);
    ctx.fillStyle = TIMBER_L;
    for (let i = 1; i <= n; i++) { const k = i / (n + 1); ctx.fillRect(x0 + (x1 - x0) * k - 4, y0 + (y1 - y0) * k - 1, 8, 2.2); }
    ctx.strokeStyle = 'rgba(200,170,120,.6)'; ctx.lineWidth = 1; // hand rail
    ctx.beginPath(); ctx.moveTo(x0, y0 - 14); ctx.lineTo(x1, y1 - 14); ctx.stroke();
  };
  flight(RS.stairFootX, 0, RS.landingX, fy);
  ctx.fillStyle = TIMBER; ctx.fillRect(0, fy - 1, RS.landingX + 12, 4); // landing
  flight(RS.landingX + 8, fy, pw - 8, py);
  // platform: planks on brackets, railing on the open side
  ctx.fillStyle = TIMBER; ctx.fillRect(0, py - 1, pw + 4, 5);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 6; x < pw; x += 8) ctx.fillRect(x, py - 1, 1, 5);
  ctx.strokeStyle = TIMBER_D; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, py + 4); ctx.lineTo(16, py + 18); ctx.moveTo(pw - 4, py + 4); ctx.lineTo(pw - 18, py + 18); ctx.stroke();
  ctx.strokeStyle = TIMBER_L; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pw + 3, py); ctx.lineTo(pw + 3, py - 15); ctx.lineTo(pw - 26, py - 15); ctx.stroke();
  // bench, water barrel, lamp
  ctx.fillStyle = TIMBER_L; ctx.fillRect(4, py - 11, 48, 3);
  ctx.fillStyle = TIMBER_D; ctx.fillRect(6, py - 8, 2.5, 8); ctx.fillRect(48, py - 8, 2.5, 8);
  ctx.fillStyle = '#4b6b7a'; ctx.beginPath(); ctx.roundRect(pw - 12, py - 13, 9, 13, 2); ctx.fill();
  ctx.fillStyle = '#7fb0c4'; ctx.fillRect(pw - 11, py - 13, 7, 2);
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, py - 40); ctx.lineTo(30, py - 30); ctx.stroke();
  ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(30, py - 28, 2.6, 0, 6.283); ctx.fill();
  // REST sign
  ctx.fillStyle = '#2f3a2f'; ctx.fillRect(2, py - 26, 26, 10);
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
      const y = -site.ceiling + 32;
      const gl = ctx.createRadialGradient(lx, y, 0, lx, y, 90);
      gl.addColorStop(0, 'rgba(255,214,140,.22)'); gl.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, y, 90, 0, 6.283); ctx.fill();
    }
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
  if (o.y < view.vy0 - 260 * s || o.y > view.vy1 + 200) return;
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(s, s);
  drawChamber();
  drawRestArea(groundY);
  drawFace(s);
  // rubble waiting at the dig site, coloured by what it is, with its count right on the pile
  const px = pileX();
  drawPile(px, 0, S.rubble, CFG.rubble.pileVisualMax, 1, 17);
  if (S.rubble.qty >= 1) pileLabel(px, -pileHeight(S.rubble.qty, CFG.rubble.pileVisualMax, 1) - 5, Math.floor(S.rubble.qty), 10, S.rubble.qty > CFG.rubble.pileVisualMax);
  const ES = CFG.excavatorScale;
  for (const w of workers) {
    if (w.id === 'exc') {
      ctx.save(); ctx.translate(w.x, 0); ctx.scale(ES, ES);
      drawExcavator(0, w.dir, expanding() ? 0 : machineK(w.timer, w.since), CFG.excavatorReach / ES, w.since < 0.4 ? Math.sin(w.since * 25) * (0.4 - w.since) * 2.5 : 0);
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
        drawRig(w.x, w.y, CFG.crewScale, w.dir, look, { k: 'walk', t: 0.25 + (p.segT / 0.35) * 0.25 });
      } else drawRig(w.x, w.y, CFG.crewScale, w.dir, look, workerPose(w));
    }
  }
  drawReserve();
  drawRig(miner.x, 0, CFG.playerScale, miner.dir, PLAYER_LOOK, playerPose());
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
    const ceil = -worksiteDef().ceiling, off = shaftOff();
    ctx.fillStyle = `rgba(4,4,10,${dark})`;
    if (ceil < 0) {
      ctx.fillRect(off, top, CFG.face.logicalW, Math.max(0, ceil - top));
      ctx.fillRect(0, Math.max(top, ceil), face.w, bot - 18 - Math.max(top, ceil));
    } else ctx.fillRect(0, top, face.w, bot - 18 - top);
    const g = ctx.createLinearGradient(0, bot - 18, 0, bot);
    g.addColorStop(0, `rgba(4,4,10,${dark})`); g.addColorStop(1, 'rgba(4,4,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, bot - 18, face.w, 18);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const boost = 1 + dark * 1.4;
  drawPracticalLights();
  for (const w of workers) {
    if (w.id === 'exc') drawExcavatorLight(w.x, w.dir, 0.12 * boost);
    else if (w.state === 'work') drawLampBeam(w.x, w.dir, CFG.crewScale, 0.1 * boost, CFG.miner.reach);
  }
  drawLampBeam(miner.x, miner.dir, CFG.playerScale, 0.2 * boost, CFG.miner.reach);
  ctx.restore();
  if (EXP.flash > 0) { ctx.fillStyle = `rgba(255,240,210,${(EXP.flash * 0.8).toFixed(3)})`; ctx.fillRect(-40, -260, face.w + 80, 320); }
  ctx.restore();
}

// ---------- world ----------
function drawFind(f: Find, x: number, y: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (f.kind === 'coin') {
    ctx.translate(x, y);
    ctx.fillStyle = '#d9a62e'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6414'; ctx.fillRect(-2, -5, 4, 10);
  } else drawBuriedCar(x, y, f.d);
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
  { rail: '#5e4127', w: 3.4, tie: '#3e2a17', tieW: 3.6, step: 0.8, rough: false, bolts: true, plates: true, brace: 'rgba(110,78,44,.9)', upright: '#4a3420', bracket: '#7d858f', metal: false, guard: false, hazard: false, lamps: 0 },
  { rail: '#9aa3ad', w: 3.1, tie: '#4e3620', tieW: 3.2, step: 0.7, rough: false, bolts: true, plates: false, brace: 'rgba(160,170,180,.55)', upright: '#59616a', bracket: '#7d858f', metal: true, guard: false, hazard: false, lamps: 0 },
  { rail: '#c4ccd4', w: 3.9, tie: '#3b3f45', tieW: 3.4, step: 0.55, rough: false, bolts: true, plates: false, brace: 'rgba(170,180,190,.6)', upright: '#59616a', bracket: '#e0b322', metal: true, guard: true, hazard: true, lamps: 8 },
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
  { w: 24, h: 13, body: '#8a5a3a', band: '#5b3a22', rim: '#a9764f', wheel: 3.2 }, // tiny rusty hand cart
  { w: 28, h: 15, body: '#7a5233', band: '#3d3d3d', rim: '#9a6c45', wheel: 3.6 }, // reinforced
  { w: 32, h: 17, body: '#6f7780', band: '#4b5157', rim: '#9aa3ad', wheel: 4 }, // metal mining cart
  { w: 36, h: 19, body: '#d9a520', band: '#2c2f33', rim: '#f2c64a', wheel: 4.4 }, // heavy industrial
];

/** The cart in screen space, base centred at (x, y). */
function drawCartAt(x: number, y: number, s: number, fill: number, tip: number, roll: number, heap = 0) {
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  const w = b.w * s, h = b.h * s, r = b.wheel * s;
  ctx.save();
  ctx.translate(x, y);
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
      ctx.fillStyle = rgb(rubbleRGB(mixPick(S.cart.load, hash(i * 2.9))), 0.78 + hash(i * 5.3) * 0.45);
      ctx.beginPath(); ctx.ellipse(px, py, (2 + hash(i) * 1.3) * s, (1.6 + hash(i * 2) * 1) * s, hash(i * 9) * 3, 0, 6.283); ctx.fill();
    }
  }
  // body (slightly tapered tub)
  ctx.fillStyle = b.body;
  ctx.beginPath(); ctx.moveTo(-w / 2, -r - h); ctx.lineTo(w / 2, -r - h); ctx.lineTo(w / 2 - 2.5 * s, -r); ctx.lineTo(-w / 2 + 2.5 * s, -r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b.band; ctx.fillRect(-w / 2 + 1.5 * s, -r - h * 0.55, w - 3 * s, 2 * s);
  ctx.fillStyle = b.rim; ctx.fillRect(-w / 2 - 1 * s, -r - h - 1.5 * s, w + 2 * s, 2.2 * s);
  if (b === CART_BODIES[2] || b === CART_BODIES[3]) { // rivets
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + (4 + i * (w / s - 8) / 3) * s - 1, -r - h * 0.3, 2, 2);
  }
  // wheels with turning spokes
  for (const wx of [-w / 2 + r + 1.5 * s, w / 2 - r - 1.5 * s]) {
    ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(wx, -r, r, 0, 6.283); ctx.fill();
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
  drawCartAt(c.x + rx, c.y + bump, s, cartFill(), tip, roll, heap);
  const b = CART_BODIES[tierOf(S.upg.cartCap, C.bodyTiers)];
  view.cartRect = { x: c.x - (b.w / 2 + 6) * s, y: c.y - (b.h + b.wheel * 2 + 12) * s, w: (b.w + 12) * s, h: (b.h + b.wheel * 2 + 16) * s };
  // "tap to send" hint while it holds something but is not yet full
  if ((st === 'LOADING' || st === 'BOTTOM_EMPTY') && cs.load.qty > 0.5) {
    const cap = cartCapacity(S);
    ctx.font = `700 ${Math.round(9 * s)}px ${FONT_UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText(`${Math.floor(cs.load.qty)}/${cap}`, c.x, c.y - (b.h + b.wheel * 2 + 6) * s);
  }
  if (cartBlocked()) bubble(c.x - 30, c.y - (b.h + b.wheel * 2 + 14) * s, 'STORAGE FULL', '#ff9a7a');
}


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
  if (gy > view.vy0 - 20 && gy < view.vy1) drawGround(gy, X0, XW);
  // shaft interior: the same rock, in shadow, down to the face
  const sTop = Math.max(view.vy0, gy), sBot = faceOrigin().y;
  if (sBot > sTop) {
    ctx.fillStyle = 'rgba(12,8,6,.62)';
    ctx.fillRect(cx - sw / 2, sTop, sw, sBot - sTop);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(cx - sw / 2, sTop, 10, sBot - sTop); ctx.fillRect(cx + sw / 2 - 10, sTop, 10, sBot - sTop);
    // depth: the shaft darkens upward, and the work light pools on the face so the action is the focus
    const L = CFG.light;
    const gd = ctx.createLinearGradient(0, sBot - H * L.fadeSpan, 0, sBot);
    gd.addColorStop(0, `rgba(0,0,0,${L.shaftDark})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gd; ctx.fillRect(cx - sw / 2, sTop, sw, sBot - sTop);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, sBot - 6, 0, cx, sBot - 6, sw * L.radius);
    gl.addColorStop(0, `rgba(255,196,120,${L.glow})`); gl.addColorStop(1, 'rgba(255,196,120,0)');
    const gTop = Math.max(sTop, sBot - sw * L.radius); // never leak above ground into the sky
    ctx.fillStyle = gl; ctx.fillRect(cx - sw / 2, gTop, sw, sBot - gTop);
    ctx.restore();
    ctx.font = `600 12px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    const stepM = S.depth > 80 ? 25 : 10;
    const mEnd = Math.min(view.camDepth, top + view.vy1 / PPM);
    for (let m = Math.max(stepM, Math.ceil(Math.max(0, top + view.vy0 / PPM) / stepM) * stepM); m < mEnd; m += stepM) {
      const y = yOf(m);
      ctx.fillRect(cx + sw / 2 - 24, y, 16, 2); ctx.fillText(fmt(m) + ' m', cx + sw / 2 + 6, y + 4);
    }
  }
  FINDS.forEach((f, i) => {
    const y = yOf(f.d); if (y < view.vy0 - 120 || y > view.vy1 + 120) return;
    const edge = cx + f.side * Math.max(sw / 2, (face.w / 2) * faceScale());
    const x = f.kind === 'car' ? edge + f.side * RIG_H * CFG.crewScale * faceScale() * 0.55 : edge + f.side * 55; // car: front bumper clear of the depth marks
    if (i < S.found) drawFind(f, x, y, 1);
    else if (i === S.found && f.d - S.depth < CFG.findTeaseM) {
      drawFind(f, x, y, 0.12 + 0.06 * Math.sin(t * 3));
      ctx.font = `700 14px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('Something is down here…', x, y - 40);
    }
  });
  drawRails(yOf(-C.surfaceLiftM - 1.5), faceOrigin().y + 2);
  drawSurface(gy);
  drawSite();
  drawTruckLayer(gy);
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
    ctx.fillRect(gx, gt + (a / MAX_DEPTH) * gh, 8, ((b - a) / MAX_DEPTH) * gh + 1);
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
  if (S.clicks < 3 && !view.hideDigHint && S.tut >= 1 && view.site === 'mine' && !view.tween) {
    ctx.textAlign = 'center'; ctx.font = `700 18px ${FONT_UI}`; ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4);
    ctx.fillText('Click the rock to dig', W / 2, faceY() + 90);
    ctx.globalAlpha = 1;
  }
  if (S.depth >= MAX_DEPTH) {
    ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT_UI}`; ctx.fillStyle = 'rgba(255,190,180,.9)';
    ctx.fillText('300 m: digging deeper arrives in a later build.', W / 2, H - 38);
  }

}

export function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#191c20'; ctx.fillRect(0, 0, view.W, view.H);
  ctx.save();
  ctx.translate(FX.cam.x, FX.cam.y);
  applyZoom(ctx);
  drawWorld();
  drawFaceAndCrew();
  drawCart();
  drawSurfaceLight();
  drawWorldFx(ctx);
  drawPopups(ctx);
  ctx.restore();
  drawGauge();
  drawOverlays();
}
