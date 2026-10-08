// Visual effects state + drawing: debris, dust, sparks, popups, crit star/ring, camera impulse, hit-stop.
// Screen-space coordinates. Knows nothing about the economy.
import { CFG } from './config';
import { rnd } from './util';

export type PartKind = 'frag' | 'dust' | 'grain' | 'spark';
export interface Part {
  kind: PartKind;
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number;
  size: number;
  col: string;
  life: number; max: number;
  floor: number; // y of first bounce (Infinity = none)
  bounced: boolean;
  bounce: number;
  shape?: number[]; // frag polygon (unit radius)
}
export interface Popup { x: number; y: number; s: string; col: string; size: number; t: number; life: number; pop: number; alpha: number; rise: number; sub?: string }
export interface Ring { x: number; y: number; t: number; s: number }
export interface Star { x: number; y: number; t: number; size: number }
export interface Banner { s: string; sub: string; t: number }

export const FX = {
  under: 0, // 0..1: how underground the view is (debris takes the mine's value treatment)
  parts: [] as Part[],
  popups: [] as Popup[],
  rings: [] as Ring[],
  stars: [] as Star[],
  banner: null as Banner | null,
  cam: { x: 0, y: 0, vx: 0, vy: 0 },
  freeze: 0, // secs of hit-stop remaining
};

export function clearFx() {
  FX.parts.length = 0; FX.popups.length = 0; FX.rings.length = 0; FX.stars.length = 0;
}

/** Directional camera kick (not a random shake). Magnitude in px. */
export function impulse(mag: number, dirX = 0, dirY = 1) {
  const k = Math.hypot(dirX, dirY) || 1;
  const v = mag * CFG.impulse.damping; // velocity that peaks near `mag` px with this damping
  FX.cam.vx += (dirX / k) * v;
  FX.cam.vy += (dirY / k) * v;
}

export function hitStop(ms: number) { FX.freeze = Math.max(FX.freeze, ms / 1000); }

function fragShape(): number[] {
  const n = 4 + Math.floor(Math.random() * 3), pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), r = rnd(0.6, 1);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

export function addPart(p: Omit<Part, 'rot' | 'vr' | 'bounced' | 'max' | 'shape'> & { vr?: number; shape?: boolean }) {
  if (FX.parts.length >= CFG.maxParticles) return;
  FX.parts.push({
    ...p, rot: rnd(0, 6.28), vr: p.vr ?? 0, bounced: false, max: p.life,
    shape: p.shape ? fragShape() : undefined,
  });
}

export interface PopupOpts { life?: number; pop?: number; alpha?: number; rise?: number; sub?: string }
export function popup(x: number, y: number, s: string, col: string, size: number, o: PopupOpts = {}) {
  if (FX.popups.length >= CFG.text.max) FX.popups.shift(); // never let rapid clicks pile into an unreadable stack
  FX.popups.push({ x, y, s, col, size, t: 0, life: o.life ?? 0.9, pop: o.pop ?? 0, alpha: o.alpha ?? 1, rise: o.rise ?? 1, sub: o.sub });
}

export function updateFx(dt: number, bannerDt = dt) {
  const c = FX.cam, I = CFG.impulse;
  // substepped: the stiff spring is only stable for small steps (long frames / hitches would explode it)
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const h = Math.min(left, 1 / 120);
    c.vx += (-I.spring * c.x - I.damping * c.vx) * h; c.vy += (-I.spring * c.y - I.damping * c.vy) * h;
    c.x += c.vx * h; c.y += c.vy * h;
  }

  const g = CFG.gravity;
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= dt;
    if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    if (p.kind === 'dust') {
      p.vx *= Math.exp(-3 * dt); p.vy = p.vy * Math.exp(-3 * dt) - 12 * dt; p.size += 14 * dt;
    } else {
      p.vy += g * (p.kind === 'spark' ? 0.5 : 1) * dt;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (!p.bounced && p.y > p.floor && p.vy > 0) {
      p.bounced = true;
      p.y = p.floor;
      p.vy *= -p.bounce; p.vx *= 0.6; p.vr *= 0.5;
      if (p.bounce < 0.15) { p.vx *= 0.2; p.vy = 0; } // sticky clay: thuds and stays
    } else if (p.bounced && p.bounce < 0.15 && p.y >= p.floor) {
      p.y = p.floor; p.vy = 0; p.vx *= Math.exp(-8 * dt);
    }
  }
  for (let i = FX.popups.length - 1; i >= 0; i--) {
    const q = FX.popups[i];
    q.t += dt; q.y -= CFG.text.rise * q.rise * dt * (q.t < 0.15 ? 2.2 : 0.7);
    if (q.t > q.life) FX.popups.splice(i, 1);
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) if ((FX.rings[i].t += dt) > CFG.critFx.ringSecs) FX.rings.splice(i, 1);
  for (let i = FX.stars.length - 1; i >= 0; i--) if ((FX.stars[i].t += dt) > CFG.critFx.starSecs) FX.stars.splice(i, 1);
  if (FX.banner) { FX.banner.t += bannerDt; if (FX.banner.t > CFG.bannerSecs) FX.banner = null; } // banners age in real time (readable at any game speed)
}

const FONT_DISPLAY = "'Bungee',Impact,sans-serif";

/** Particles + crit flashes (drawn inside the camera transform). */
export function drawWorldFx(ctx: CanvasRenderingContext2D) {
  for (const p of FX.parts) {
    const a = Math.min(1, (p.life / p.max) * 2.2);
    ctx.globalAlpha = p.kind === 'dust' ? a * 0.45 : a;
    ctx.fillStyle = p.col;
    if (p.kind === 'frag' && p.shape) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.size, p.size);
      ctx.beginPath(); ctx.moveTo(p.shape[0], p.shape[1]);
      for (let k = 2; k < p.shape.length; k += 2) ctx.lineTo(p.shape[k], p.shape[k + 1]);
      ctx.closePath(); ctx.fill();
      if (FX.under > 0.01) { ctx.fillStyle = `rgba(34,24,18,${0.45 * FX.under})`; ctx.fill(); } // underground value
      ctx.restore();
    } else if (p.kind === 'dust') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      if (FX.under > 0.01) { ctx.fillStyle = `rgba(34,24,18,${0.45 * FX.under})`; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    }
  }
  ctx.globalAlpha = 1;

  const C = CFG.critFx;
  for (const r of FX.rings) {
    const k = r.t / C.ringSecs;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, C.ringSize * r.s * Math.sqrt(k), C.ringSize * r.s * Math.sqrt(k) * 0.55, 0, 0, 6.283); ctx.stroke();
  }
  for (const s of FX.stars) {
    const k = s.t / C.starSecs, R = s.size * (0.6 + k * 0.7);
    ctx.globalAlpha = 1 - k * k;
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.35, 'rgba(255,220,120,.8)'); g.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2, rr = i % 2 === 0 ? R : R * 0.22;
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center';
  for (const q of FX.popups) {
    const fade = q.t > q.life * 0.6 ? 1 - (q.t - q.life * 0.6) / (q.life * 0.4) : 1;
    const scale = q.pop && q.t < 0.12 ? 1 + q.pop * (1 - q.t / 0.12) : 1;
    ctx.globalAlpha = Math.max(0, fade) * q.alpha;
    ctx.font = `${Math.round(q.size * scale)}px ${FONT_DISPLAY}`;
    ctx.lineWidth = Math.max(2.5, q.size * 0.2); ctx.strokeStyle = 'rgba(20,12,6,.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(q.s, q.x, q.y);
    ctx.fillStyle = q.col; ctx.fillText(q.s, q.x, q.y);
    if (q.sub) {
      const ss = Math.round(q.size * 0.55);
      ctx.font = `${ss}px ${FONT_DISPLAY}`; ctx.lineWidth = 2.5;
      ctx.strokeText(q.sub, q.x, q.y + ss + 3);
      ctx.fillStyle = 'rgba(200,222,255,.95)'; ctx.fillText(q.sub, q.x, q.y + ss + 3);
    }
  }
  ctx.globalAlpha = 1;
}
