// Crew behaviour (simulation side of the visible workforce): strike timing, lightweight fatigue + rest, personality
// idles, arrival. Pure logic (no canvas). Positions are face-logical (x from the work floor's left wall, y up < 0).
//   WORKING --(tired)--> TO_REST (walk, climb the left-wall switchback stairs) --> RESTING (bench) --> RETURNING --> WORKING
// Phases are staggered so the mine never stops; if every seat is taken a tired worker keeps going a little longer.
import { CFG, CREW, WORKSITES, type CrewId } from './config';
import { S } from './state';
import { chunkHp, crewTypeDps, materialAt } from './economy';
import { face, chunkAtX, clampHitX, initFace } from './digface';
import { strike, type HitResult } from './sim';
import { rnd } from './util';

export type WState = 'arrive' | 'work' | 'idle' | 'toRest' | 'rest' | 'back';
export type IdleKind = 'wipe' | 'helmet' | 'drink' | 'look';
const IDLES: IdleKind[] = ['wipe', 'helmet', 'drink', 'look'];

export interface Worker {
  id: CrewId;
  seed: number; // deterministic look (skin, clothes, hair...) for this worker
  homeX: number; // floor slot
  x: number; y: number; dir: 1 | -1;
  timer: number; period: number; since: number; // strike cadence
  state: WState; t: number;
  fatigue: number; // secs of work left before getting tired
  path: number[]; pathT: number; pathDur: number; // flat x,y points + travel time along them
  seat: number; restLeft: number;
  idle: IdleKind; idleDur: number; idleCool: number;
}

export const workers: Worker[] = [];
/** Workers that finished arriving this frame (presentation: dust, lamp click). */
export const landings: Worker[] = [];
const seats: (Worker | null)[] = [];

const R = CFG.rest;
const ws = () => WORKSITES[face.tier];

// ---- paths along the left wall: floor -> stair foot -> landing -> platform -> seat ----
function restPath(homeX: number, seatX: number): number[] {
  return [homeX, 0, R.stairFootX, 0, R.landingX, R.landingY, R.platformW - 8, R.platformY, seatX, R.platformY];
}
/** The rest platform exists once the shaft is deep enough. */
export const restAreaBuilt = () => S.depth >= R.minDepth;
function arrivalPath(homeX: number): number[] {
  // new hires come down the access ladder on the left wall: to the platform, then the stairs (or straight to the floor)
  if (!restAreaBuilt()) return [R.ladderX, -70, R.ladderX, 0, homeX, 0];
  return [R.ladderX, R.platformY - 70, R.ladderX, R.platformY, R.platformW - 8, R.platformY, R.landingX, R.landingY, R.stairFootX, 0, homeX, 0];
}
function reversePath(p: number[]) { const r: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); return r; }
/** Travel time: walking on the floor/platform, slower on stairs/ladder. */
function pathTime(p: number[]) {
  let t = 0;
  for (let i = 2; i < p.length; i += 2) {
    const dx = p[i] - p[i - 2], dy = p[i + 1] - p[i - 1], d = Math.hypot(dx, dy);
    t += d / (Math.abs(dy) > 1 ? R.climb : R.walk);
  }
  return t;
}
/** Position at time `t` along a path (constant speed per segment). */
export function pathPos(p: number[], t: number): { x: number; y: number; climbing: boolean; dir: 1 | -1 } {
  for (let i = 2; i < p.length; i += 2) {
    const dx = p[i] - p[i - 2], dy = p[i + 1] - p[i - 1], d = Math.hypot(dx, dy);
    const seg = d / (Math.abs(dy) > 1 ? R.climb : R.walk);
    if (t <= seg || i === p.length - 2) {
      const k = seg > 0 ? Math.min(1, t / seg) : 1;
      return { x: p[i - 2] + dx * k, y: p[i - 1] + dy * k, climbing: Math.abs(dy) > 1, dir: dx >= 0 ? 1 : -1 };
    }
    t -= seg;
  }
  return { x: p[p.length - 2], y: p[p.length - 1], climbing: false, dir: 1 };
}

function setPath(w: Worker, p: number[], state: WState) { w.path = p; w.pathT = 0; w.pathDur = pathTime(p); w.state = state; w.t = 0; }

function make(id: CrewId, homeX: number, arrive: boolean): Worker {
  const c = CREW.find((x) => x.id === id)!;
  const w: Worker = {
    id, seed: Math.floor(rnd(1, 1e6)), homeX, x: homeX, y: 0, dir: homeX < face.w / 2 ? 1 : -1,
    timer: rnd(0.25, 1) * c.swingSecs, period: c.swingSecs * rnd(0.9, 1.1), since: 1,
    state: 'work', t: 0,
    fatigue: rnd(R.work[0], R.work[1]) * rnd(0.25, 1), // staggered: nobody gets tired at the same moment
    path: [], pathT: 0, pathDur: 0, seat: -1, restLeft: 0,
    idle: 'look', idleDur: 0, idleCool: rnd(R.idleEvery[0], R.idleEvery[1]),
  };
  if (arrive && id === 'dig') { setPath(w, arrivalPath(homeX), 'arrive'); const p = pathPos(w.path, 0); w.x = p.x; w.y = p.y; }
  return w;
}

/** Sync the visible workforce with owned crew and the current worksite tier. Existing workers keep their state. */
export function syncWorkers(animateNew = false) {
  const site = ws(), hasExc = S.crew.exc > 0 && face.tier >= 1;
  const digSlots = hasExc ? site.slotsWithExc : site.slots;
  const keep: Worker[] = [];
  for (const c of CREW) {
    const slots = c.id === 'dig' ? digSlots : [site.excX];
    const want = Math.min(S.crew[c.id], slots.length, c.id === 'dig' ? site.visible : 1, c.id === 'exc' && face.tier < c.needsTier ? 0 : 99);
    for (let k = 0; k < want; k++) {
      const homeX = slots[k];
      const old = workers.find((w) => w.id === c.id && w.homeX === homeX) ?? workers.find((w) => w.id === c.id && !keep.includes(w));
      if (old) { old.homeX = homeX; old.dir = homeX < face.w / 2 ? 1 : -1; if (old.state === 'work' || old.state === 'idle') old.x = homeX; keep.push(old); }
      else keep.push(make(c.id, homeX, animateNew));
    }
  }
  for (const w of workers) if (!keep.includes(w) && w.seat >= 0) seats[w.seat] = null;
  workers.length = 0;
  workers.push(...keep);
  seats.length = R.seats;
  for (let i = 0; i < R.seats; i++) if (seats[i] && !workers.includes(seats[i]!)) seats[i] = null;
}

export const restingCount = () => workers.filter((w) => w.state === 'rest').length;
export const seatsTotal = () => R.seats;

const SWING_WINDOW = (CFG.miner.windupMs + CFG.miner.downswingMs) / 1000 + 0.05;

/** Advance crew behaviour; returns strikes that landed this frame. `paused` = expansion sequence (crew stand clear). */
export function updateCrew(dt: number, paused = false): HitResult[] {
  const out: HitResult[] = [];
  const working = (id: CrewId) => workers.filter((o) => o.id === id && o.state === 'work').length;
  for (const w of workers) {
    w.t += dt;
    switch (w.state) {
      case 'arrive': case 'toRest': case 'back': {
        w.pathT += dt;
        const p = pathPos(w.path, w.pathT);
        w.x = p.x; w.y = p.y; w.dir = p.dir;
        if (w.pathT >= w.pathDur) {
          if (w.state === 'toRest') { w.state = 'rest'; w.t = 0; w.restLeft = rnd(R.rest[0], R.rest[1]); w.dir = 1; }
          else {
            if (w.state === 'arrive') landings.push(w);
            w.state = 'work'; w.t = 0; w.x = w.homeX; w.y = 0; w.dir = w.homeX < face.w / 2 ? 1 : -1;
            w.fatigue = rnd(R.work[0], R.work[1]);
          }
        }
        continue;
      }
      case 'rest':
        w.restLeft -= dt;
        if (w.restLeft <= 0) { const seatX = R.seatX[Math.max(0, w.seat)]; if (w.seat >= 0) seats[w.seat] = null; w.seat = -1; setPath(w, reversePath(restPath(w.homeX, seatX)), 'back'); }
        continue;
      case 'idle':
        if (w.t >= w.idleDur) { w.state = 'work'; w.t = 0; }
        continue;
    }
    // WORKING
    if (paused) continue;
    w.since += dt;
    w.timer -= dt;
    if (w.id === 'dig') {
      if (restAreaBuilt()) w.fatigue -= dt;
      w.idleCool -= dt;
      const midSwing = w.timer < SWING_WINDOW;
      if (w.fatigue <= 0 && !midSwing) {
        const free = seats.findIndex((x) => !x);
        if (free >= 0) { seats[free] = w; w.seat = free; setPath(w, restPath(w.homeX, R.seatX[free]), 'toRest'); continue; }
        w.fatigue = 12; // every seat taken: keep going a bit longer
      }
      if (w.idleCool <= 0 && !midSwing) {
        w.idleCool = rnd(R.idleEvery[0], R.idleEvery[1]);
        w.state = 'idle'; w.t = 0; w.idle = IDLES[Math.floor(Math.random() * IDLES.length)]; w.idleDur = rnd(R.idleSecs[0], R.idleSecs[1]);
        continue;
      }
    }
    if (w.timer > 0) continue;
    w.timer += w.period * rnd(0.85, 1.15);
    w.since = 0;
    const c = CREW.find((x) => x.id === w.id)!;
    const reach = w.id === 'exc' ? CFG.excavatorReach : CFG.miner.reach * CFG.crewScale;
    const hx = w.x + w.dir * reach;
    const idx = chunkAtX(hx);
    // total crew output is shared by whoever is currently working (resting workers' share moves to the others)
    let power = (crewTypeDps(S, w.id) * (w.id === 'dig' ? R.uptime : 1) * w.period) / Math.max(1, working(w.id));
    if (w.id === 'exc') { const ch = face.chunks[idx]; power = Math.max(power, ch.maxHp - ch.hp + 0.01); } // a bucket bites a whole chunk
    out.push(strike(idx, clampHitX(idx, hx), rnd(CFG.face.hitYMin, CFG.face.hitYMax), power, false, w.id, c.yield));
  }
  return out;
}

/** Build the dig face for the saved worksite tier and the visible workforce. */
export function initSim() {
  const site = WORKSITES[S.worksite];
  initFace(materialAt(S.depth), chunkHp(S.depth), site.width, site.chunks, S.worksite);
  syncWorkers();
}

/** Worksite expansion lands (the BOOM moment): rebuild a wider face and spread the crew into the chamber. */
export function applyWorksite() {
  const site = WORKSITES[S.worksite];
  initFace(materialAt(S.depth), chunkHp(S.depth), site.width, site.chunks, S.worksite);
  for (const w of workers) { if (w.seat >= 0) seats[w.seat] = null; w.seat = -1; w.state = 'work'; w.y = 0; }
  syncWorkers();
  for (const w of workers) { w.x = w.homeX; w.dir = w.homeX < face.w / 2 ? 1 : -1; }
}
