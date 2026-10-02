// Transport simulation: the one permanent cart. Pure logic (no DOM/audio); presentation reacts to CartEvents.
// The cart's world position always derives from its journey progress, so it is visible wherever it really is.
//
//   BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN → (BOTTOM_EMPTY | LOADING)
import { CFG } from './config';
import { S, type CartState } from './state';
import { cartCapacity, loadRate, moveLoad, rawCap, trackSafe, trackStress, travelTime, type TrackStress } from './economy';

export type CartEventType = 'loaded' | 'ready' | 'depart' | 'arrive' | 'unloadStart' | 'unloaded' | 'returnStart' | 'back';
export interface CartEvent { type: CartEventType; qty?: number }

const C = CFG.cart;
const EPS = 1e-6;

const smooth = (p: number) => { const k = Math.min(1, Math.max(0, p)); return k * k * (3 - 2 * k); };

function enter(state: CartState, dur = 0) {
  S.cart.state = state;
  S.cart.t = 0;
  S.cart.dur = dur;
}

/** World depth of the cart (negative = above ground, parked in the headframe). */
export function cartDepth(): number {
  const c = S.cart, top = -C.surfaceLiftM;
  switch (c.state) {
    case 'TRAVELLING_UP': return c.from + (top - c.from) * smooth(c.dur ? c.t / c.dur : 1);
    case 'TRAVELLING_DOWN': return top + (S.depth - top) * smooth(c.dur ? c.t / c.dur : 1); // aims at the live face
    case 'SURFACE_ARRIVAL':
    case 'UNLOADING': return top;
    default: return S.depth;
  }
}

// ---- track load (Spec §7.8): the physical cart load decides how hard the track works ----
let lastTripOver = false; // the last trip up was overloaded (not saved: recomputed at the next departure)
/** Seconds for a loaded trip up from `from`; an overloaded track slows it (no damage, no material loss). */
function upTripSecs(from: number) {
  const over = trackStress(S, S.cart.load.qty) === 'over';
  return travelTime(S, from) / (over ? 1 - CFG.track.overloadPenalty : 1);
}
/** Stress on the track right now: only a loaded cart on its way up (or sitting loaded at the bottom) counts. */
export function cartTrackStress(): TrackStress {
  const st = S.cart.state;
  if (st !== 'TRAVELLING_UP' && st !== 'LOADING' && st !== 'READY') return 'safe';
  return trackStress(S, S.cart.load.qty);
}
/** A real, active transport problem: the cart is carrying (or keeps carrying) more than the track's safe load. */
export const trackOverloaded = () =>
  S.cart.load.qty > trackSafe(S) + 1e-9 || (lastTripOver && cartCapacity(S) > trackSafe(S) + 1e-9);
/** After a track upgrade: a cart already climbing continues at the new track's speed (same progress). */
export function retimeUpTrip() {
  lastTripOver = trackStress(S, S.cart.load.qty) === 'over' && S.cart.state === 'TRAVELLING_UP';
  if (S.cart.state !== 'TRAVELLING_UP' || S.cart.dur <= 0) return;
  const p = S.cart.t / S.cart.dur, dur = upTripSecs(S.cart.from);
  S.cart.dur = dur; S.cart.t = p * dur;
}

/** True while the cart is at the dig site (loading area). */
export const cartAtBottom = () => ['BOTTOM_EMPTY', 'LOADING', 'READY'].includes(S.cart.state);
export const cartFill = () => Math.min(1, S.cart.load.qty / cartCapacity(S));

/** Player taps the cart: dispatch early if it holds anything. */
export function sendCart(): boolean {
  const c = S.cart;
  if ((c.state === 'LOADING' || c.state === 'BOTTOM_EMPTY') && c.load.qty > EPS) {
    enter('READY');
    c.t = C.readySecs; // depart on the next update
    return true;
  }
  return false;
}

/** Advance the cart by dt seconds. Consumes leftover time across transitions so large offline steps stay exact. */
/** True while the cart is stuck at the top because surface storage is full. */
export const cartBlocked = () =>
  S.cart.state === 'UNLOADING' && S.cart.load.qty > EPS && S.raw.qty >= rawCap(S) - EPS;

export function updateCart(dt: number, out: CartEvent[] = []): CartEvent[] {
  const c = S.cart;
  let left = dt;
  for (let guard = 0; left > EPS && guard < 16; guard++) {
    switch (c.state) {
      case 'BOTTOM_EMPTY':
        if (S.rubble.qty > EPS) { enter('LOADING'); continue; }
        c.t += left; left = 0;
        break;
      case 'LOADING': {
        const cap = cartCapacity(S), rate = loadRate(S);
        const room = cap - c.load.qty;
        if (room <= EPS) { enter('READY'); out.push({ type: 'ready' }); continue; }
        if (S.rubble.qty <= EPS) { // nothing to load: wait (empty cart = extraction bottleneck)
          if (c.load.qty <= EPS) enter('BOTTOM_EMPTY');
          c.t += left; left = 0;
          break;
        }
        const can = Math.min(room, S.rubble.qty, rate * left);
        const moved = moveLoad(S.rubble, c.load, can);
        if (moved > 0) out.push({ type: 'loaded', qty: moved });
        const used = moved / rate;
        c.t += used;
        left -= Math.max(used, moved > 0 ? 0 : left);
        if (cap - c.load.qty <= EPS) { enter('READY'); out.push({ type: 'ready' }); }
        break;
      }
      case 'READY': {
        const need = C.readySecs - c.t;
        if (left < need) { c.t += left; left = 0; break; }
        left -= need;
        const from = S.depth;
        enter('TRAVELLING_UP', upTripSecs(from));
        c.from = from;
        S.flags.dispatched = true;
        lastTripOver = trackStress(S, c.load.qty) === 'over';
        out.push({ type: 'depart' });
        break;
      }
      case 'TRAVELLING_UP': {
        const need = c.dur - c.t;
        if (left < need) { c.t += left; left = 0; break; }
        left -= need;
        enter('SURFACE_ARRIVAL', C.arriveSecs);
        S.flags.arrived = true;
        out.push({ type: 'arrive' });
        break;
      }
      case 'SURFACE_ARRIVAL': {
        const need = c.dur - c.t;
        if (left < need) { c.t += left; left = 0; break; }
        left -= need;
        enter('UNLOADING', Math.max(0.5, C.unloadSecs * Math.min(1, c.load.qty / cartCapacity(S))));
        out.push({ type: 'unloadStart', qty: c.load.qty });
        break;
      }
      case 'UNLOADING': {
        // dump at a steady rate; if surface storage is full the cart WAITS holding its load (never destroys material).
        // c.t only advances while rubble actually moves, so the tip animation pauses too.
        const room = Math.max(0, rawCap(S) - S.raw.qty);
        const rate = Math.max(c.load.qty, EPS) / Math.max(EPS, c.dur - c.t);
        if (room <= EPS && c.load.qty > EPS) { left = 0; break; }
        const want = Math.min(rate * left, room);
        const moved = moveLoad(c.load, S.raw, want);
        const used = moved > 0 ? moved / rate : left;
        c.t = Math.min(c.dur, c.t + used); left -= used;
        if (c.load.qty <= 1e-4) {
          moveLoad(c.load, S.raw, c.load.qty); // never leave a crumb behind
          out.push({ type: 'unloaded' });
          enter('TRAVELLING_DOWN', travelTime(S, S.depth));
          out.push({ type: 'returnStart' });
        } else if (rawCap(S) - S.raw.qty <= EPS) {
          left = 0; // storage just filled: wait
        }
        break;
      }
      case 'TRAVELLING_DOWN': {
        const need = c.dur - c.t;
        if (left < need) { c.t += left; left = 0; break; }
        left -= need;
        enter(S.rubble.qty > EPS ? 'LOADING' : 'BOTTOM_EMPTY');
        out.push({ type: 'back' });
        break;
      }
    }
  }
  return out;
}
