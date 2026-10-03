// Construction crew presentation (Spec §10.6): builders physically work WHERE the building is growing.
// Presentation only — construction timing, block use, payments and saves are untouched (construction.ts).
//   Each stage exposes a few WORK TARGETS on its advancing edge (from the same geometry site.ts draws). A builder walks
//   — or climbs the scaffold ladder — to a standing spot within reach of a target, hammers it for a few seconds (the
//   hammer head lands ON the target, with a puff of dust), then moves to another target. High work gets a simple
//   scaffold: planks at the needed heights + a ladder, present only while someone needs it.
// Coordinates: building space in worker units u — x from the building's left edge, h = height above the ground.
import { CFG, PROJECTS } from './config';
import { S } from './state';
import { builders } from './economy';
import { HAMMER_IMPACT, RIG_H, drawRig, lookFor, type Look } from './rig';
import { ladderFrame, rungHeights, LADDER_HALF_W } from './ladder';
import { addPart } from './fx';
import { playHammer } from './audio';
import { ctx, view } from './view';
import { rnd } from './util';

const LOOKS: Look[] = [31, 58, 77, 104, 139, 163, 191, 222].map((seed) => lookFor('builder', seed));
const MAX_SHOWN = 8;
const STACK_X = -1.6, LADDER_X = -0.85; // the block stack and the scaffold ladder, left of the building
const WALK = 0.9, CLIMB = 0.5; // u per second
const REACH_H = 1.05, PLANK_STEP = 0.7; // highest target reachable from the ground; plank height step

interface Pt { x: number; h: number }
interface Agent {
  i: number; x: number; h: number; dir: 1 | -1;
  path: Pt[]; mode: 'move' | 'work' | 'idle';
  target: Pt | null; stand: Pt | null; left: number; key: string;
  ph: number; rate: number; cycle: number; carry: boolean;
}
const crew: Agent[] = [];
let lastHit = 0;

// ---- work targets: the advancing edge of the current stage (mirrors cabin()/home() in site.ts) ----
const CABIN = { w: 3.4, slab: 0.2, H: 1.5 }, HOME = { w: 4.6, slab: 0.24, F: 1.35 };
const clampX = (x: number, w: number) => Math.max(0.15, Math.min(w - 0.15, x));

function workTargets(): Pt[] {
  const b = S.build, proj = PROJECTS[b.project], st = proj.stages[b.stage];
  if (!st) return [];
  const p = b.active ? Math.min(1, b.used / st.blocks) : 0;
  if (proj.id === 'cabin') {
    const { w, slab, H } = CABIN, top = slab + H;
    switch (b.stage) {
      case 0: { const e = -0.1 + (w + 0.2) * p; return [e, e - 0.7, e - 1.4].map((x) => ({ x: clampX(x, w), h: slab })); } // slab poured left → right
      case 1: { const n = Math.max(1, Math.ceil(p * 7)), sx = (i: number) => (i / 6) * (w - 0.1) + 0.05; // studs going up one by one
        return [{ x: sx(n - 1), h: 0.9 }, { x: sx(Math.max(0, n - 2)), h: 0.5 }, { x: sx(n - 1), h: top - 0.1 }]; }
      case 2: { const hw = slab + H * p; return [0.5, 1.7, 2.9].map((x) => ({ x, h: Math.max(0.35, hw) })); } // log courses rising
      case 3: { const ridge = 1.15, hr = top + ridge * p, half = (w / 2 + 0.3) * (1 - (hr - top) / ridge); // roof filling up
        return [{ x: w / 2 - half * 0.6, h: hr }, { x: w / 2 + half * 0.6, h: hr }, { x: w / 2, h: hr }]; }
      default: { const items: Pt[] = [{ x: 0.18 * w + 0.21, h: 0.5 }, { x: 0.58 * w + 0.31, h: 0.95 }, { x: 0.7 * w + 0.14, h: top + 0.7 }, { x: 0.1 * w + 0.35, h: 0.15 }, { x: 0.12 * w + 0.04, h: 1.05 }];
        const k = Math.min(items.length - 1, Math.floor(p * items.length)); return [items[k], items[Math.min(items.length - 1, k + 1)]]; } // finishing item by item
    }
  }
  const { w, slab, F } = HOME, y1 = slab + F, y2 = y1 + 0.12 + F;
  switch (b.stage) {
    case 0: { const e = -0.12 + (w + 0.24) * p; return [e, e - 0.8, e - 1.6].map((x) => ({ x: clampX(x, w), h: slab })); }
    case 1: { const hb = slab + F * p; return [0.5, 1.7, 2.9, 4.1].map((x) => ({ x, h: Math.max(0.35, hb) })); } // brick courses
    case 2: { if (p < 0.5) { const e = -0.1 + (w + 0.2) * p * 2; return [e, e - 0.9].map((x) => ({ x: clampX(x, w), h: y1 + 0.06 })); } // floor slab
      const n = Math.max(1, Math.ceil(((p - 0.5) / 0.5) * 9)), sx = (i: number) => (i / 8) * (w - 0.1) + 0.05; // upper studs
      return [{ x: sx(n - 1), h: y1 + 0.6 }, { x: sx(n - 1), h: y2 - 0.15 }, { x: sx(Math.max(0, n - 2)), h: y1 + 0.9 }]; }
    case 3: { const hs = y1 + 0.12 + F * p; return [0.6, 1.9, 3.2, 4.2].map((x) => ({ x, h: hs })); } // siding rising
    case 4: { const rise = 1.2, hr = y2 + rise * p, k = (hr - y2) / rise, l = -0.35 + 1.15 * k, r = w + 0.35 - 1.15 * k; // hip roof
      return [{ x: l + 0.35, h: hr }, { x: (l + r) / 2, h: hr }, { x: r - 0.35, h: hr }]; }
    case 5: { const items: Pt[] = [{ x: 0.42 * w + 0.25, h: 0.5 }, { x: 0.1 * w + 0.31, h: 0.74 }, { x: 0.72 * w + 0.31, h: 0.74 },
        { x: 0.1 * w + 0.31, h: y1 + 0.77 }, { x: 0.42 * w + 0.31, h: y1 + 0.77 }, { x: 0.72 * w + 0.31, h: y1 + 0.77 }];
      const k = Math.min(items.length - 1, Math.floor(p * items.length)); return [items[k], items[Math.min(items.length - 1, k + 1)]]; }
    default: { const items: Pt[] = [{ x: 0.8, h: 0.08 }, { x: 0.42 * w + 0.25, h: 0.06 }, { x: 0.05 * w + 0.3, h: 0.25 }, { x: w + 0.61, h: 0.7 }, { x: -0.5, h: 0.3 }];
      const k = Math.min(items.length - 1, Math.floor(p * items.length)); return [items[k], items[(k + 1) % items.length]]; } // landscaping
  }
}

/** Where a builder must stand (and at what height) to hit `t`: on the ground if within reach, else on a plank. */
function standFor(t: Pt, w: number): Pt & { dir: 1 | -1 } {
  const h = t.h <= REACH_H ? 0 : Math.ceil((t.h - REACH_H + 0.05) / PLANK_STEP) * PLANK_STEP;
  const minX = h > 0 ? LADDER_X + 0.25 : -1.2, maxX = h > 0 ? w + 0.3 : w + 1.1;
  let x = t.x - 0.42, dir: 1 | -1 = 1;
  if (x < minX) { x = t.x + 0.42; dir = -1; }
  return { x: Math.min(maxX, x), h, dir };
}

function routeTo(a: Agent, to: Pt) {
  a.path = a.h === to.h ? [to] : [{ x: LADDER_X, h: a.h }, { x: LADDER_X, h: to.h }, to];
  a.mode = 'move';
}

const projW = () => (PROJECTS[S.build.project].id === 'cabin' ? CABIN.w : HOME.w);

export function updateSiteCrew(dt: number, visible: boolean) {
  const n = Math.min(MAX_SHOWN, builders(S));
  while (crew.length < n) { const i = crew.length; crew.push({ i, x: STACK_X + 0.4 + i * 0.3, h: 0, dir: 1, path: [], mode: 'idle', target: null, stand: null, left: 0, key: '', ph: rnd(0, 1), rate: rnd(1.35, 1.65), cycle: i, carry: false }); }
  crew.length = n;
  const b = S.build, working = b.active && !b.done;
  const targets = working ? workTargets() : [];
  const key = `${b.project}|${b.stage}|${working}`;
  const w = projW();
  const taken = new Set<string>();
  for (const a of crew) {
    // move along the path (walk on the level, climb at the ladder)
    if (a.mode === 'move') {
      const to = a.path[0];
      if (!to) { a.mode = a.target ? 'work' : 'idle'; continue; }
      if (Math.abs(to.x - a.x) > 1e-3) { const d = Math.sign(to.x - a.x); a.dir = d > 0 ? 1 : -1; a.x += d * Math.min(Math.abs(to.x - a.x), WALK * dt); }
      else if (Math.abs(to.h - a.h) > 1e-3) { a.h += Math.sign(to.h - a.h) * Math.min(Math.abs(to.h - a.h), CLIMB * dt); }
      else { a.x = to.x; a.h = to.h; a.path.shift(); if (!a.path.length) { a.mode = a.target ? 'work' : 'idle'; a.carry = false; if (a.stand) a.dir = (a.target!.x >= a.x ? 1 : -1); } }
      continue;
    }
    if (a.mode === 'work') {
      a.left -= dt;
      const prev = a.ph;
      a.ph = (a.ph + dt * a.rate) % 1;
      if (prev < HAMMER_IMPACT && a.ph >= HAMMER_IMPACT && a.target) impact(a.target, visible);
      if (a.target) taken.add(`${a.target.x.toFixed(2)},${a.target.h.toFixed(2)}`);
    }
    // need a (new) job: the stage changed, the spot is done, or there is no work → pick a target / go idle
    if (a.mode !== 'work' || a.left <= 0 || a.key !== key) {
      a.key = key;
      if (targets.length) {
        let pick = targets[(a.i + a.cycle) % targets.length];
        for (let k = 0; k < targets.length; k++) { const c = targets[(a.i + a.cycle + k) % targets.length]; if (!taken.has(`${c.x.toFixed(2)},${c.h.toFixed(2)}`)) { pick = c; break; } }
        a.cycle++;
        // spread out: slide along the same course/row so no two builders share a spot on the same level
        let st = standFor(pick, w), tgt = pick;
        for (const off of [0, 0.65, -0.65, 1.3, -1.3, 1.95]) {
          const tx = pick.x + off;
          if (off && (tx < 0.15 || tx > w - 0.15)) continue;
          const cand = standFor({ x: tx, h: pick.h }, w);
          if (!crew.some((o) => o !== a && o.stand && Math.abs(o.stand.h - cand.h) < 0.01 && Math.abs(o.stand.x - cand.x) < 0.6)) { st = cand; tgt = { x: tx, h: pick.h }; break; }
        }
        a.target = tgt; a.stand = st; a.left = rnd(2.6, 4.8);
        pick = tgt;
        taken.add(`${pick.x.toFixed(2)},${pick.h.toFixed(2)}`);
        // the occasional block run from the stack (only for ground work)
        if (st.h === 0 && a.h === 0 && Math.random() < 0.35) { a.carry = true; a.path = [{ x: STACK_X + 0.25, h: 0 }, { x: st.x, h: 0 }]; a.mode = 'move'; }
        else routeTo(a, st);
      } else {
        const idle = { x: STACK_X + 0.7 + (a.i % 4) * 0.45 + Math.floor(a.i / 4) * 0.2, h: 0 };
        a.target = null; a.stand = null;
        if (Math.abs(a.x - idle.x) > 0.01 || a.h > 0) routeTo(a, idle); else a.mode = 'idle';
      }
    }
  }
}

function impact(t: Pt, visible: boolean) {
  if (!visible) return;
  const o = siteOrigin; if (!o) return;
  const x = o.bx + t.x * o.u, y = o.gy - t.h * o.u;
  for (let i = 0; i < 3; i++) addPart({ kind: 'dust', x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-30, 30), vy: rnd(-35, -5), size: rnd(2, 4), col: 'rgba(205,185,150,1)', life: rnd(0.3, 0.55), floor: Infinity, bounce: 0 });
  if (view.t - lastHit > 0.12) { lastHit = view.t; playHammer(0.6); }
}

let siteOrigin: { bx: number; gy: number; u: number } | null = null;

/** Plank heights currently needed (anyone standing on, or heading to, a plank). */
function plankLevels(): number[] {
  const s = new Set<number>();
  for (const a of crew) {
    if (a.stand && a.stand.h > 0) s.add(+a.stand.h.toFixed(2));
    if (a.h > 0 && Math.abs(a.x - LADDER_X) > 1e-3) s.add(+a.h.toFixed(2)); // standing or walking on a plank: keep it under their feet
    for (const p of a.path) if (p.h > 0 && p.x !== LADDER_X) s.add(+p.h.toFixed(2));
  }
  return [...s].sort((x, y) => x - y);
}

/** Scaffold (only while someone needs height): poles, planks at the working heights, and the access ladder. */
export function drawScaffold(bx: number, gy: number, u: number) {
  const levels = plankLevels();
  const climbing = crew.some((a) => a.h > 0);
  if (!levels.length && !climbing) return;
  const top = Math.max(...levels, ...crew.map((a) => a.h), 0.7);
  const w = projW(), X = (x: number) => bx + x * u, Y = (h: number) => gy - h * u;
  ctx.fillStyle = '#7d858f';
  for (const px of [LADDER_X + 0.12, w / 2, w + 0.32]) ctx.fillRect(X(px) - 1.5, Y(top + 0.35), 3, (top + 0.35) * u); // poles
  for (const lv of levels) { // planks: a walkway from the ladder to the far end at each working height
    ctx.fillStyle = '#a4703e'; ctx.fillRect(X(LADDER_X), Y(lv) - 1, (w + 0.42 - LADDER_X) * u, 0.07 * u);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X(LADDER_X), Y(lv) - 1 + 0.07 * u, (w + 0.42 - LADDER_X) * u, 2);
    ctx.strokeStyle = 'rgba(160,170,180,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(LADDER_X + 0.12), Y(lv + 0.45)); ctx.lineTo(X(w + 0.32), Y(lv + 0.45)); ctx.stroke(); // guard rail
  }
  // access ladder (rungs match the climbing animation)
  const sc = u / RIG_H, s = sc / CFG.crewScale, half = LADDER_HALF_W * s, lx = X(LADDER_X), lt = (top + 0.3) * u;
  ctx.strokeStyle = '#8a6238'; ctx.lineWidth = Math.max(2, 2.4 * s);
  ctx.beginPath(); ctx.moveTo(lx - half, gy); ctx.lineTo(lx - half, gy - lt); ctx.moveTo(lx + half, gy); ctx.lineTo(lx + half, gy - lt); ctx.stroke();
  for (const rh of rungHeights(lt, s)) { ctx.beginPath(); ctx.moveTo(lx - half, gy - rh); ctx.lineTo(lx + half, gy - rh); ctx.stroke(); }
}

/** Builders (drawn after the scaffold): walking, climbing, hammering their target, carrying, idling. */
export function drawSiteCrew(bx: number, gy: number, u: number, blockCol: string) {
  siteOrigin = { bx, gy, u };
  const sc = u / RIG_H, s = sc / CFG.crewScale;
  const top = (Math.max(0.7, ...plankLevels(), ...crew.map((a) => a.h)) + 0.3) * u;
  for (const a of crew) {
    const look = LOOKS[a.i % LOOKS.length], wx = bx + a.x * u, wy = gy - a.h * u;
    const climbing = a.mode === 'move' && Math.abs(a.x - LADDER_X) < 1e-3 && a.path[0] && Math.abs(a.path[0].h - a.h) > 1e-3;
    if (climbing || (a.h > 0 && Math.abs(a.x - LADDER_X) < 1e-3 && a.mode === 'move')) {
      const f = ladderFrame(a.h * u, top, look, s, sc);
      drawRig(bx + LADDER_X * u, gy - f.base, sc, 1, look, f.pose);
    } else if (a.mode === 'move') {
      drawRig(wx, wy, sc, a.dir, look, a.carry ? { k: 'carry', t: view.t * 1.6 + a.i, carryCol: blockCol } : { k: 'walk', t: view.t * 1.6 + a.i });
    } else if (a.mode === 'work' && a.target) {
      const k = RIG_H / (look.height); // u → rig units
      drawRig(wx, wy, sc, a.dir, look, { k: 'hammer', t: a.ph, aim: { x: Math.abs(a.target.x - a.x) * k, y: (a.target.h - a.h) * k } });
    } else {
      const cheer = S.build.done, lookAround = Math.floor((view.t + a.i * 2.3) / 7) % 3 === 0;
      drawRig(wx, wy, sc, a.dir, look, cheer ? { k: 'cheer', t: 0 } : lookAround ? { k: 'look', t: ((view.t + a.i * 2.3) % 7) / 2.5 } : { k: 'stand', t: 0 });
    }
  }
}
