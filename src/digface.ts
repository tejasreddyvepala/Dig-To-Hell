// Dig-face state: chunk geometry, damage, and the crack/dent marks that communicate damage.
// Pure data + logic (no canvas). Coordinates are logical face px: x in [0, logicalW], y down from the surface.
import { CFG, type Material, type MaterialId } from './config';
import { rnd, rndi } from './util';

const F = CFG.face;

export type CrackStyle = 'hair' | 'branch' | 'thick' | 'radial' | 'deep';
export interface Crack { pts: number[]; w: number; style: CrackStyle; grow: number }
export type MarkKind = 'indent' | 'dent' | 'impact' | 'scuff';
export interface Mark { x: number; y: number; r: number; kind: MarkKind }

export interface Chunk {
  idx: number;
  mat: Material;
  poly: number[]; // flat x,y list (closed)
  top: number[]; // indices into poly (vertex numbers) forming the top edge, for clay dents
  hp: number;
  maxHp: number;
  stageHp: number;
  stage: number; // visible damage stage reached (0..stages-1); reaching `stages` = break
  cracks: Crack[];
  marks: Mark[];
  seed: number;
  flinch: number; // current push (logical px)
  flinchV: number;
  flash: number; // secs remaining of hit flash
  reveal: number; // secs remaining of fresh-material tint
  recess: number; // screen px: fresh chunk sits lower until the camera catches up
  squash: number; // clay compression 0..1 (animated)
}

export interface Face { chunks: Chunk[]; seams: number[][] }

export const face: Face = { chunks: [], seams: [] };

const chunkW = () => F.logicalW / F.chunks;
const SEAM_SAMPLES = 4;

function buildSeams() {
  // Seam k is a wandering vertical polyline (x per sample, top..bottom). Outer seams are the shaft walls.
  face.seams = [];
  for (let k = 0; k <= F.chunks; k++) {
    const base = k * chunkW();
    const xs: number[] = [];
    for (let j = 0; j <= SEAM_SAMPLES; j++) {
      xs.push(k === 0 || k === F.chunks ? base : base + rnd(-1, 1) * chunkW() * F.seamJitter);
    }
    face.seams.push(xs);
  }
}

function buildPoly(i: number): { poly: number[]; top: number[] } {
  const L = face.seams[i], R = face.seams[i + 1];
  const pts: number[] = [];
  const top: number[] = [];
  // top edge left -> right with jagged intermediate points
  const n = 4;
  for (let j = 0; j <= n; j++) {
    const x = L[0] + ((R[0] - L[0]) * j) / n;
    const y = j === 0 || j === n ? rnd(0, F.edgeJitter * 0.5) : rnd(-F.edgeJitter * 0.4, F.edgeJitter);
    top.push(pts.length / 2);
    pts.push(x, y);
  }
  // right seam down
  for (let j = 1; j <= SEAM_SAMPLES; j++) pts.push(R[j], (F.height * j) / SEAM_SAMPLES);
  // left seam up
  for (let j = SEAM_SAMPLES; j >= 1; j--) pts.push(L[j], (F.height * j) / SEAM_SAMPLES);
  return { poly: pts, top };
}

function makeChunk(i: number, mat: Material, hp: number): Chunk {
  const { poly, top } = buildPoly(i);
  return {
    idx: i, mat, poly, top, hp: 0, maxHp: hp, stageHp: hp / mat.stages, stage: 0,
    cracks: [], marks: [], seed: Math.random() * 1000,
    flinch: 0, flinchV: 0, flash: 0, reveal: 0, recess: 0, squash: 0,
  };
}

export function initFace(mat: Material, hp: number) {
  buildSeams();
  face.chunks = [];
  for (let i = 0; i < F.chunks; i++) face.chunks.push(makeChunk(i, mat, hp));
}

/** Replace a broken chunk with fresh material. */
export function renewChunk(i: number, mat: Material, hp: number, recessPx: number): Chunk {
  const c = makeChunk(i, mat, hp);
  c.reveal = F.revealSecs;
  c.recess = recessPx;
  face.chunks[i] = c;
  return c;
}

export function chunkCenterX(i: number) {
  const L = face.seams[i], R = face.seams[i + 1];
  return (L[0] + R[0] + L[SEAM_SAMPLES] + R[SEAM_SAMPLES]) / 4;
}

/** Chunk whose top span contains logical x (clamped to the face). */
export function chunkAtX(x: number): number {
  for (let i = 0; i < F.chunks; i++) if (x < face.seams[i + 1][0]) return i;
  return F.chunks - 1;
}

/** Clamp a hit point so it lands inside chunk i's top span. */
export function clampHitX(i: number, x: number) {
  const a = face.seams[i][0] + 4, b = face.seams[i + 1][0] - 4;
  return Math.min(b, Math.max(a, x));
}

// ---- crack generation ----
function crackLine(x: number, y: number, ang: number, len: number, segs: number, wobble: number, w: number, style: CrackStyle): Crack {
  const pts = [x, y];
  let a = ang;
  for (let s = 0; s < segs; s++) {
    a += rnd(-wobble, wobble);
    x += (Math.cos(a) * len) / segs;
    y += (Math.sin(a) * len) / segs;
    pts.push(x, y);
  }
  return { pts, w, style, grow: 0 };
}

/** Downward-biased random angle (cracks run into the rock, not into the air). */
const downAng = () => rnd(0.15, Math.PI - 0.15);
const anyAng = () => rnd(-Math.PI, Math.PI);

function addBranching(c: Chunk, x: number, y: number, count: number, len: number, w: number) {
  for (let k = 0; k < count; k++) {
    const main = crackLine(x, y, downAng(), len * rnd(0.7, 1.2), 5, 0.5, w, 'branch');
    c.cracks.push(main);
    if (Math.random() < 0.7) {
      const m = 2 + rndi(0, 2);
      c.cracks.push(crackLine(main.pts[m * 2], main.pts[m * 2 + 1], downAng(), len * 0.5, 3, 0.6, w * 0.7, 'hair'));
    }
  }
}

function addRadial(c: Chunk, x: number, y: number, count: number, len: number, w: number, style: CrackStyle) {
  const a0 = rnd(0, Math.PI * 2);
  for (let k = 0; k < count; k++) {
    const a = a0 + (k / count) * Math.PI * 2 + rnd(-0.25, 0.25);
    c.cracks.push(crackLine(x, y, a, len * rnd(0.6, 1.15), 2, 0.12, w, style));
  }
}

function dent(c: Chunk, x: number, amount: number) {
  // Push top-edge vertices near x downward: clay deforms before it cracks.
  for (const v of c.top) {
    const vx = c.poly[v * 2];
    const fall = Math.max(0, 1 - Math.abs(vx - x) / (chunkW() * 0.6));
    c.poly[v * 2 + 1] += amount * fall;
  }
}

/** Visual features for reaching stage `k` (1-based) on chunk c at hit point (x,y). */
function addStageFeatures(c: Chunk, k: number, x: number, y: number) {
  const id: MaterialId = c.mat.id;
  const W = chunkW();
  if (id === 'dirt') {
    if (k === 1) {
      c.marks.push({ x, y, r: rnd(5, 7), kind: 'indent' });
      for (let n = rndi(1, 2); n > 0; n--) c.cracks.push(crackLine(x, y, downAng(), W * 0.35, 4, 0.6, 0.9, 'hair'));
    } else {
      addBranching(c, x, y, rndi(3, 5), W * 0.55, 1.4);
    }
  } else if (id === 'clay') {
    if (k <= 2) {
      dent(c, x, F.dentPx * k);
      c.marks.push({ x, y: y * 0.6, r: rnd(7, 9) + k * 2, kind: 'dent' });
    } else {
      c.cracks.push(crackLine(x, y * 0.5, downAng(), F.height * 0.9, 4, 0.35, 3.4, 'thick'));
      c.cracks.push(crackLine(x, y * 0.5, rnd(-0.3, 0.3) + (Math.random() < 0.5 ? 0 : Math.PI), W * 0.4, 3, 0.3, 2.2, 'thick'));
    }
  } else if (id === 'stone') {
    if (k === 1) c.marks.push({ x, y, r: rnd(5, 7), kind: 'impact' });
    else if (k === 2) addRadial(c, x, y, rndi(5, 6), W * 0.5, 1.3, 'radial');
    else {
      addRadial(c, x, y, rndi(3, 4), W * 0.8, 1.6, 'radial');
      for (let n = 0; n < 4; n++) {
        const px = x + rnd(-W * 0.4, W * 0.4), py = rnd(6, F.height - 6);
        c.cracks.push(crackLine(px, py, anyAng(), W * 0.35, 2, 0.2, 1.1, 'radial'));
      }
    }
  } else {
    // cave rock: cracks progressively open onto darkness behind the wall
    if (k === 1) c.cracks.push(crackLine(x, y, downAng(), W * 0.4, 4, 0.5, 1, 'hair'));
    else if (k === 2) addRadial(c, x, y, 4, W * 0.45, 1.4, 'radial');
    else {
      const count = k === 3 ? 2 : 3;
      for (let n = 0; n < count; n++) c.cracks.push(crackLine(x, y, downAng(), W * (0.45 + k * 0.08), 4, 0.45, 2 + k * 0.9, 'deep'));
      c.marks.push({ x, y, r: 3 + k * 2, kind: 'indent' });
    }
  }
}

export interface DamageResult { before: number; after: number; broke: boolean }

/** Apply damage at (x,y). Every hit leaves a local mark; stage thresholds add material features. */
export function damageChunk(c: Chunk, dmg: number, x: number, y: number): DamageResult {
  const before = c.stage;
  c.hp += dmg;
  const after = Math.min(c.mat.stages, Math.floor(c.hp / c.stageHp + 1e-9));
  const broke = after >= c.mat.stages;
  if (!broke) {
    for (let k = before + 1; k <= after; k++) addStageFeatures(c, k, x, y);
    if (after === before) {
      // sub-stage hit: still visibly marks the rock where it landed
      const kind: MarkKind = c.mat.id === 'stone' ? 'impact' : c.mat.id === 'clay' ? 'dent' : 'scuff';
      c.marks.push({ x: x + rnd(-3, 3), y: y + rnd(-2, 2), r: rnd(2, 3.5), kind });
      if (c.mat.id === 'clay') dent(c, x, F.dentPx * 0.35);
    }
    c.stage = after;
  }
  c.flinchV += F.flinchPx * F.flinchDecay;
  c.flash = F.flashSecs;
  if (c.mat.id === 'clay') c.squash = 1;
  return { before, after, broke };
}

export function updateFace(dt: number, recessDecay: number) {
  for (const c of face.chunks) {
    // critically-damped-ish spring back to rest
    c.flinchV -= c.flinch * F.flinchDecay * F.flinchDecay * dt;
    c.flinchV *= Math.exp(-F.flinchDecay * dt);
    c.flinch += c.flinchV * dt;
    c.flash = Math.max(0, c.flash - dt);
    c.reveal = Math.max(0, c.reveal - dt);
    c.squash = Math.max(0, c.squash - dt * 6);
    c.recess *= Math.exp(-recessDecay * dt);
    for (const k of c.cracks) k.grow = Math.min(1, k.grow + dt * 18);
  }
}
