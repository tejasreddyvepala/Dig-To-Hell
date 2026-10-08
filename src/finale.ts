// THE FINALE: the bottom of the mine is alive (lava falls down the walls from 960 m; old bones lie in the rock).
// At 1,000 m the Gates of Hell swing open, lava pours through them across the floor, then rises up the whole mine at
// 50 m/s (the camera rides it), spills out of the shaft over the land both ways and sets into solid black rock; the
// screen goes black and a summary card shows how the game was finished (time, money, buildings, crew, trophies) with
// "Start a new mine". Achievements and the best record survive the restart.
import { CFG, MAX_DEPTH, PROJECTS, WORKSITES } from './config';
import { S, saveState, resetState } from './state';
import { FX, impulse } from './fx';
import { playBlast, playThud, playSting } from './audio';
import { ctx, faceScale, shaftCX, shaftW, view, yOf } from './view';
import { hash, money } from './util';
import { drawLava } from './lava';
import { gameplayStop, happyTime } from './platform';
import { resetMilestones, track } from './analytics';
import { face } from './digface';

type Phase = 'idle' | 'gate' | 'pour' | 'rise' | 'flow' | 'black' | 'done';
/** door 0..1 = how far the Gates of Hell have swung open; spread 0..1 = how far the lava has run out over the ground;
 *  cool 0..1 = how solid it has set. */
export const FIN = { phase: 'idle' as Phase, t: 0, lavaM: MAX_DEPTH, door: 0, pour: 0, spread: 0, cool: 0 };
export const finaleRunning = () => FIN.phase !== 'idle' && FIN.phase !== 'done';
/** How far the gate doors are open (render.drawHellGate). */
export const gateOpen = () => (FIN.phase === 'idle' ? 0 : FIN.door);

const GATE_SECS = 4.5, POUR_SECS = 6.5, RISE_MPS = 50, FLOW_SECS = 6, COOL_SECS = 3.5;

/** Begin the ending (once per game): the gates swing open. */
export function startFinale() {
  if (finaleRunning() || S.flags.finished) return;
  Object.assign(FIN, { phase: 'gate', t: 0, lavaM: MAX_DEPTH + 1, door: 0, pour: 0, spread: 0, cool: 0 });
  FX.banner = { s: 'THE GATES OF HELL ARE OPENING', sub: 'something is coming through', t: 0 };
  playThud(1);
}

/** Advance the ending (real seconds). */
export function updateFinale(dt: number) {
  if (!finaleRunning()) return;
  FIN.t += dt;
  const P = FIN.phase;
  if (P === 'gate') { // the doors grind open, a little rumble
    const k = Math.min(1, FIN.t / GATE_SECS); FIN.door = k * k * (3 - 2 * k);
    if (Math.random() < dt * 5) impulse(0.35, (Math.random() - 0.5) * 2, 1);
    if (Math.random() < dt * 1.2) playThud(0.4);
    if (k >= 1) { FIN.phase = 'pour'; FIN.t = 0; playBlast(); FX.banner = { s: 'LAVA', sub: 'it pours through the gate', t: 0 }; }
  } else if (P === 'pour') { // lava pours out of the gate and runs across the floor
    FIN.pour = Math.min(1, FIN.t / POUR_SECS);
    FIN.lavaM = MAX_DEPTH + 1 - FIN.pour * FIN.pour * 9; // it pools on the floor, deeper and deeper
    if (Math.random() < dt * 4) impulse(0.4, (Math.random() - 0.5) * 2, 1);
    if (FIN.pour >= 1) { FIN.phase = 'rise'; FIN.t = 0; FX.banner = { s: 'THE MINE IS FLOODING', sub: 'lava rising 50 m/s', t: 0 }; }
  } else if (P === 'rise') { // up the whole mine at 50 m per second, the camera riding just above it
    FIN.lavaM = Math.max(0, FIN.lavaM - RISE_MPS * dt);
    view.explore = Math.min(0, FIN.lavaM - view.camDepth - 7);
    if (Math.random() < dt * 3) impulse(0.4, (Math.random() - 0.5) * 2, 1);
    if (Math.random() < dt * 0.8) playThud(0.35);
    if (FIN.lavaM <= 0) { FIN.phase = 'flow'; FIN.t = 0; playBlast(); FX.banner = { s: 'THE MINE IS GONE', sub: 'the lava spills over the land', t: 0 }; }
  } else if (P === 'flow') { // it spills out of the shaft and runs over the ground both ways, then sets solid
    view.explore = Math.min(0, -view.camDepth - 2); // ground in the middle of the screen: watch it spread
    const k = Math.min(1, FIN.t / FLOW_SECS); FIN.spread = 1 - (1 - k) * (1 - k);
    FIN.cool = Math.max(0, Math.min(1, (FIN.t - FLOW_SECS * 0.7) / COOL_SECS));
    FIN.lavaM = 0;
    if (FIN.t > FLOW_SECS * 0.7 + COOL_SECS + 1.2) { FIN.phase = 'black'; FIN.t = 0; }
  } else if (P === 'black') {
    if (FIN.t > 1.6) finish();
  }
}

/** Lava, skeletons and lava falls in world space (call after the world, before the darkness overlay). */
export function drawHellLife() {
  const k = faceScale(), cx = shaftCX(), sw = shaftW();
  const near = S.depth >= 960 || finaleRunning();
  if (near) { // lava falls down both walls near the bottom + skeletons crawling over the rock
    const fy = yOf(Math.max(960, S.depth)), top = yOf(Math.max(940, S.depth - 60));
    if (fy > view.vy0 && top < view.vy1) {
      for (const [side, seed] of [[-1, 1], [1, 2]] as const) for (let f = 0; f < 2; f++) {
        const x = cx + side * (Math.max(sw / 2, (face.w / 2) * k) + (16 + f * 30) * k), w = (6 + f * 3) * k; // down the rock walls, past the room
        const g = ctx.createLinearGradient(0, top, 0, fy); g.addColorStop(0, 'rgba(255,90,20,.15)'); g.addColorStop(0.3, '#ff7a1a'); g.addColorStop(1, '#ffcf5a');
        ctx.fillStyle = g; ctx.fillRect(x - w / 2, top, w, fy - top);
        ctx.fillStyle = 'rgba(255,240,170,.75)'; // bright flowing streaks
        for (let i = 0; i < 6; i++) { const ph = ((view.t * 0.9 + hash(seed * 7 + f * 3 + i)) % 1), yy = top + ph * (fy - top); ctx.fillRect(x - w * 0.2, yy, w * 0.4, 14 * k); }
        ctx.fillStyle = 'rgba(255,120,40,.5)'; ctx.beginPath(); ctx.ellipse(x, fy, w * 2.2, 4 * k, 0, 0, 6.283); ctx.fill(); // splash pool
      }

    }
  }
  if (near) bonesInRock(cx, sw, k);
  if (!finaleRunning() && FIN.phase !== 'done') return;
  if (FIN.phase === 'gate') return;
  const R = Math.max(sw / 2, (face.w / 2) * k), F = yOf(S.depth), roomTop = F - 200 * k;
  const x0 = view.vx0 - 40, x1 = view.vx1 + 40, wav = (x: number) => Math.sin(x * 0.03 + view.t * 4) * 4 * k + Math.sin(x * 0.011 - view.t * 2.3) * 5 * k;
  // ---- inside the mine: the lava fills the excavated space (the room at the bottom, the shaft above it) ----
  {
    const gw = sw * 0.62, ly = yOf(FIN.lavaM), half = FIN.phase === 'pour' ? Math.max(gw * 0.3, R * (1 - (1 - FIN.pour) * (1 - FIN.pour))) : R; // pouring: it runs out from the gate
    if (ly < view.vy1 + 20) {
      ctx.save(); ctx.beginPath(); // the mine's interior below the lava surface
      const sx0 = cx - sw / 2, sx1 = cx + sw / 2;
      ctx.moveTo(cx - half, view.vy1 + 30); ctx.lineTo(cx - half, Math.max(ly, roomTop));
      if (ly < roomTop) { ctx.lineTo(sx0, roomTop); ctx.lineTo(sx0, ly); }
      for (let x = (ly < roomTop ? sx0 : cx - half); x <= (ly < roomTop ? sx1 : cx + half); x += 14) ctx.lineTo(x, ly + wav(x));
      if (ly < roomTop) { ctx.lineTo(sx1, ly); ctx.lineTo(sx1, roomTop); }
      ctx.lineTo(cx + half, Math.max(ly, roomTop)); ctx.lineTo(cx + half, view.vy1 + 30); ctx.closePath(); ctx.clip();
      const top = Math.max(view.vy0 - 20, ly - 10 * k);
      ctx.fillStyle = '#7a1a06'; ctx.fillRect(x0, top, x1 - x0, view.vy1 + 40 - top);
      drawLava(ctx, 'flood', x0, top, x1 - x0, Math.min(view.vy1 + 40 - top, 900), view.t * 1.4 * (1 - FIN.cool * 0.9), { mode: 'pool', wx: x0 * 0.3, wy: FIN.lavaM * 4, scale: 0.28, heat: 0.2 - FIN.cool * 0.6, top: 0.1 });
      if (FIN.cool > 0) { ctx.fillStyle = `rgba(26,14,12,${(0.88 * FIN.cool).toFixed(2)})`; ctx.fillRect(x0, top, x1 - x0, view.vy1 + 40 - top); } // it sets solid in the shaft too
      ctx.restore();
      // bright surface line + heat glow + embers just above it
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lx0 = ly < roomTop ? sx0 : cx - half, lx1 = ly < roomTop ? sx1 : cx + half;
      ctx.strokeStyle = 'rgba(255,235,170,.8)'; ctx.lineWidth = 2.6 * k; ctx.beginPath();
      for (let x = lx0; x <= lx1; x += 14) { const y = ly + wav(x); x === lx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      const hg = ctx.createLinearGradient(0, ly - 180 * k, 0, ly); hg.addColorStop(0, 'rgba(255,90,20,0)'); hg.addColorStop(1, 'rgba(255,110,30,.5)');
      ctx.fillStyle = hg; ctx.fillRect(lx0, ly - 180 * k, lx1 - lx0, 180 * k);
      for (let i = 0; i < 24; i++) { const ph = (view.t * 0.6 + hash(i * 1.3)) % 1, px = lx0 + hash(i * 7.9) * (lx1 - lx0); ctx.fillStyle = `rgba(255,${160 + (hash(i) * 80) | 0},60,${(1 - ph).toFixed(2)})`; ctx.fillRect(px, ly - ph * 200 * k, 2.5 * k, 2.5 * k); }
      ctx.restore();
    }
  }
  // ---- the torrent pouring out of the gate (while the lava is still below the doorway's top) ----
  if (FIN.phase === 'pour' || FIN.phase === 'rise') {
    const floorY = F - 4 * k, gw = sw * 0.62, gh = Math.min(gw * 1.05, (floorY - view.vy0) * 0.86), mouth = floorY - gh * 0.62;
    const ly = yOf(FIN.lavaM), bottom = Math.min(floorY, ly + 6 * k);
    if (ly > mouth + 10 * k && bottom > view.vy0 && mouth < view.vy1) {
      const tw = gw * 0.5, a = Math.max(view.vy0, mouth), b = Math.min(view.vy1, bottom);
      ctx.save(); ctx.beginPath(); // a thick sheet of lava flaring out of the doorway down to the pool
      ctx.moveTo(cx - tw * 0.42, a);
      for (let y = a; y <= b; y += 10) { const f = (y - mouth) / Math.max(1, bottom - mouth); ctx.lineTo(cx - tw * (0.42 + f * 0.3) + Math.sin(y * 0.05 + view.t * 4) * 5 * k, y); }
      for (let y = b; y >= a; y -= 10) { const f = (y - mouth) / Math.max(1, bottom - mouth); ctx.lineTo(cx + tw * (0.42 + f * 0.3) + Math.sin(y * 0.05 + view.t * 4.4 + 2) * 5 * k, y); }
      ctx.closePath(); ctx.clip();
      drawLava(ctx, 'gush', cx - tw, a, tw * 2, b - a, view.t, { mode: 'fall', wx: 900, wy: (a - mouth) / 2, scale: 0.5, heat: 0.2 });
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(cx, mouth, 0, cx, mouth, tw); lg.addColorStop(0, 'rgba(255,230,150,.6)'); lg.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, mouth, tw, 0, 6.283); ctx.fill();
      for (let i = 0; i < 18; i++) { // spray where it crashes into the pool
        const life = 0.6 + hash(i * 3.1) * 0.5, ph = ((view.t + hash(i * 1.7) * life) % life) / life, vx = (hash(i * 7) - 0.5) * tw * 3, vy = -(0.5 + hash(i * 11) * 0.8) * tw;
        ctx.fillStyle = `rgba(255,${180 + (hash(i) * 70) | 0},90,${(1 - ph).toFixed(2)})`; ctx.beginPath(); ctx.arc(cx + vx * ph, bottom + vy * ph + tw * 2.2 * ph * ph, (1.5 + hash(i * 5) * 2) * k, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
    if (FIN.phase === 'pour') { // the rolling fronts of the tongue as it runs out across the floor
      const half = Math.max(gw * 0.3, R * (1 - (1 - FIN.pour) * (1 - FIN.pour))), fy = yOf(FIN.lavaM);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1]) {
        const fx = cx + side * half, g = ctx.createRadialGradient(fx, F - 6 * k, 0, fx, F - 6 * k, 40 * k);
        g.addColorStop(0, 'rgba(255,230,140,.85)'); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(fx, (F + fy) / 2, 30 * k, Math.max(10 * k, (F - fy) * 0.7), 0, 0, 6.283); ctx.fill();
        for (let i = 0; i < 4; i++) { const ph = (view.t * 1.3 + i / 4) % 1; ctx.fillStyle = `rgba(255,200,90,${(0.8 * (1 - ph)).toFixed(2)})`; ctx.beginPath(); ctx.arc(fx + side * ph * 22 * k, F - 8 * k - ph * 26 * k + ph * ph * 30 * k, 2.2 * k, 0, 6.283); ctx.fill(); }
      }
      ctx.restore();
    }
  }
  // ---- out of the shaft: it runs over the ground both ways, then cools into solid black rock ----
  if (FIN.phase === 'flow' || FIN.phase === 'black' || FIN.phase === 'done') {
    const gy = yOf(0), sheet = 38 * k, reach = sw / 2 + (Math.max(cx - x0, x1 - cx) - sw / 2) * FIN.spread;
    const fl = cx - reach, fr = cx + reach;
    ctx.save(); ctx.beginPath(); ctx.moveTo(fl, gy + 4);
    for (let x = fl; x <= fr; x += 12) { const edge = Math.min(1, Math.min(x - fl, fr - x) / (70 * k)), lump = 0.82 + 0.18 * Math.sin(x * 0.02 + hash(Math.floor(x / 40)) * 3); ctx.lineTo(x, gy - sheet * (0.3 + 0.7 * Math.sqrt(edge)) * lump + wav(x) * 0.5 * (1 - FIN.cool)); }
    ctx.lineTo(fr, gy + 4); ctx.closePath(); ctx.clip();
    drawLava(ctx, 'sheet', fl, gy - sheet - 6, fr - fl, sheet + 40 * k, view.t * (1 - FIN.cool * 0.9), { mode: 'pool', wx: fl * 0.3, wy: 0, scale: 0.4, heat: 0.15 - FIN.cool * 0.6 });
    if (FIN.cool > 0) { // setting solid: dark basalt crust grows over it, only a few cracks keep glowing
      ctx.fillStyle = `rgba(26,14,12,${(0.92 * FIN.cool).toFixed(2)})`; ctx.fillRect(fl, gy - sheet - 6, fr - fl, sheet + 50 * k);
      ctx.strokeStyle = `rgba(255,${110 + (60 * Math.sin(view.t * 2)) | 0},30,${(0.7 * (1 - FIN.cool * 0.6)).toFixed(2)})`; ctx.lineWidth = 1.3 * k;
      for (let i = 0; i < 30; i++) { const x = fl + hash(i * 3.7) * (fr - fl), y = gy - sheet * (0.2 + hash(i * 5.1) * 0.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash(i) - 0.5) * 18 * k, y + 5 * k); ctx.lineTo(x + (hash(i * 2) - 0.5) * 26 * k, y + 2 * k); ctx.stroke(); }
    }
    ctx.restore();
    if (FIN.cool < 1) { // the flow fronts: bright rolling lobes + fire where it touches the grass and trees
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const fx of [fl, fr]) {
        const fg = ctx.createRadialGradient(fx, gy - sheet * 0.4, 0, fx, gy - sheet * 0.4, 50 * k); fg.addColorStop(0, `rgba(255,220,120,${(0.8 * (1 - FIN.cool)).toFixed(2)})`); fg.addColorStop(1, 'rgba(255,80,10,0)');
        ctx.fillStyle = fg; ctx.fillRect(fx - 50 * k, gy - sheet - 50 * k, 100 * k, 100 * k);
        for (let i = 0; i < 5; i++) { const h = (40 + hash(i * 3) * 70) * k * (0.6 + 0.4 * Math.sin(view.t * 7 + i)), px = fx + (fx < cx ? -1 : 1) * (8 + i * 9) * k * -1;
          const ff = ctx.createLinearGradient(0, gy - h, 0, gy); ff.addColorStop(0, 'rgba(255,200,80,0)'); ff.addColorStop(1, `rgba(255,90,20,${(0.8 * (1 - FIN.cool)).toFixed(2)})`);
          ctx.fillStyle = ff; ctx.beginPath(); ctx.moveTo(px - 10 * k, gy); ctx.quadraticCurveTo(px - 4 * k, gy - h * 0.6, px, gy - h); ctx.quadraticCurveTo(px + 4 * k, gy - h * 0.6, px + 10 * k, gy); ctx.fill(); }
      }
      ctx.restore();
    }
    // smoke darkening the sky as it burns, thinning as it cools
    ctx.fillStyle = `rgba(30,18,14,${(0.55 * Math.min(1, FIN.spread * 1.5) * (1 - FIN.cool * 0.4)).toFixed(2)})`; ctx.fillRect(x0, view.vy0, x1 - x0, gy - view.vy0);
  }
}

/** Old bones set into the rock near the bottom: in both shaft walls (from 940 m) and in the floor bed under the work
 *  floor. Half-buried, ivory with soft shading, never moving — world-anchored (same bones every visit). */
function bonesInRock(cx: number, sw: number, k: number) {
  const top = Math.max(940, S.depth - 70), bot = Math.min(MAX_DEPTH + 30, S.depth + 40);
  for (let m = Math.floor(top / 3) * 3; m < bot; m += 3) {
    for (const side of [-1, 1]) {
      const h = hash(m * 3.17 + side * 11.3);
      if (h > (m > S.depth + 2 ? 0.8 : 0.55)) continue; // not every cell (the floor bed is a bone bed)
      const y = yOf(m + hash(h * 7) * 3);
      if (y < view.vy0 - 40 || y > view.vy1 + 40) continue;
      const inFloor = m > S.depth + 2; // below the work floor: across the whole width, else in the walls
      const room = Math.max(sw / 2, (face.w / 2) * k); // the rock starts past the room's walls
      const x = inFloor ? cx + (hash(h * 5.1) - 0.5) * room * 1.9 : cx + side * (room + (14 + hash(h * 3.3) * 110) * k);
      if (!inFloor && m > S.depth - 8) continue; // the floor level itself is the work area
      bone(x, y, k * (0.55 + hash(h * 9.9) * 0.4), Math.floor(hash(h * 13.1) * 4), (hash(h * 17.7) - 0.5) * 2.4);
    }
  }
}
/** One bone, rock-embedded: 0 femur, 1 rib arc, 2 skull (half-buried), 3 vertebra pair. */
function bone(x: number, y: number, s: number, kind: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= 0.95;
  const base = '#b5a688', lit = '#d4c6a4', sh = '#7a6e58'; // old, stained bone
  ctx.fillStyle = 'rgba(10,4,2,.45)'; ctx.beginPath(); ctx.ellipse(1, 2, 13, 5.5, 0, 0, 6.283); ctx.fill(); // the hollow it lies in
  if (kind === 0) { // femur: shaft + knobbed ends
    ctx.fillStyle = base; ctx.fillRect(-9, -1.4, 18, 2.8);
    for (const ex of [-9.5, 9.5]) { ctx.beginPath(); ctx.arc(ex, -1.6, 2.1, 0, 6.283); ctx.arc(ex, 1.6, 2.1, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = lit; ctx.fillRect(-8, -1.4, 16, 0.9); ctx.fillStyle = sh; ctx.fillRect(-8, 0.8, 16, 0.6);
  } else if (kind === 1) { // ribs: three arcs sticking out of the rock
    ctx.strokeStyle = base; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(0, 4 + r * 0.5, 7 - r * 1.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.strokeStyle = sh; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 4.6, 7, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  } else if (kind === 2) { // skull, half in the rock
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 4.4, 0, Math.PI, 0); ctx.lineTo(4.2, 1.6); ctx.lineTo(-4.2, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit; ctx.beginPath(); ctx.ellipse(-1.5, -2.6, 2.2, 1.2, -0.3, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(-1.8, -0.4, 1.2, 1, 0, 0, 6.283); ctx.ellipse(1.8, -0.4, 1.2, 1, 0, 0, 6.283); ctx.fill(); // sockets
    ctx.fillStyle = 'rgba(20,10,6,.6)'; ctx.fillRect(-5, 1.4, 10, 1.4); // where the rock covers it
  } else { // two vertebrae
    for (const vx of [-3, 3]) { ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(vx, 0, 2.4, 1.8, 0, 0, 6.283); ctx.fill(); ctx.fillRect(vx - 0.5, -3.4, 1, 2); ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(vx + 0.6, 0.6, 1.4, 0.8, 0, 0, 6.283); ctx.fill(); }
  }
  ctx.restore();
}

/** Full-screen black fade during the last beat (screen space). */
export function drawFinaleOverlay() {
  if (FIN.phase === 'black') { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, FIN.t / 1.2).toFixed(2)})`; ctx.fillRect(0, 0, view.W, view.H); }
}

const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60); return h ? `${h}h ${m}m` : `${m}m ${sec}s`; };

/** The end: record it, show the summary card, then start a new mine. */
function finish(again = false) {
  FIN.phase = 'done';
  S.flags.finished = true;
  gameplayStop();
  if (!again) { happyTime(); track('game_complete', { secs: Math.round(S.stats.playSecs ?? 0) }); }
  const time = S.stats.playSecs ?? 0, achN = (() => { try { return Object.keys(JSON.parse(localStorage.getItem('dth_ach') || '{}').got ?? {}).length; } catch { return 0; } })();
  let best = Infinity; try { best = +(localStorage.getItem('dth_best') || Infinity); } catch { /* ignore */ }
  const record = !again && time < best;
  try { if (record) localStorage.setItem('dth_best', String(Math.round(time))); } catch { /* ignore */ }
  saveState();
  if (!again) playSting();
  const top = PROJECTS[Math.min(S.build.project, PROJECTS.length - 1)].name;
  const row = (ic: string, k: string, v: string) => `<div class="fr"><span>${ic} ${k}</span><b>${v}</b></div>`;
  const el = document.getElementById('finale')!;
  el.innerHTML = `<div class="fcard"><div class="fk">🔥 YOU DUG TO HELL 🔥</div><h2>Game complete</h2>
    <p class="fsub">Lava swallowed the mine, the yard and the town. It was worth it.</p>
    <div class="frows">
      ${row('⏱', 'Finished in', fmtTime(time) + (record ? ' <em>NEW BEST!</em>' : Number.isFinite(best) ? ` (best ${fmtTime(best)})` : ''))}
      ${row('💰', 'Money earned', money(S.stats.earned))}
      ${row('🏠', 'Buildings sold', `${S.stats.sold} (last: ${top})`)}
      ${row('🧱', 'Blocks delivered', Math.floor(S.stats.delivered).toLocaleString('en-US'))}
      ${row('👷', 'Crew', `${S.crew.dig} miners · ${['exc', 'saw', 'borer'].filter((m) => S.crew[m as 'exc']).length} machines`)}
      ${row('⛏', 'Worksite', WORKSITES[S.worksite].name)}
      ${row('🧭', 'Finds', String(S.found))}
      ${row('🏆', 'Trophies', `${achN} / 50`)}
      ${row('⬇', 'Depth', '1,000 m')}
    </div>
    <button id="finaleNew">Start a new mine</button><p class="fnote">Your trophies stay with you.</p></div>`;
  el.hidden = false;
  document.getElementById('finaleNew')!.onclick = () => {
    resetState();
    resetMilestones();
    try { localStorage.removeItem(CFG.saveKey); localStorage.removeItem(CFG.saveKey + '_prev'); } catch { /* ignore */ }
    location.reload();
  };
}

/** A save that already finished the game (reloaded on the end card): the game is over — show the card again. */
export function resumeFinished() { if (S.flags.finished) finish(true); }

/** Saves already at 1,000 m from before the finale existed: the next strike at the bottom sets it off. */
export function maybeStartFromStrike() { if (S.depth >= MAX_DEPTH && !S.flags.finished) startFinale(); }
