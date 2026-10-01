// Transport simulation: the one permanent cart. Pure logic (no DOM/audio); presentation reacts to CartEvents.
// The cart's world position always derives from its journey progress, so it is visible wherever it really is.
//
//   BOTTOM_EMPTY → LOADING → READY → TRAVELLING_UP → SURFACE_ARRIVAL → UNLOADING → TRAVELLING_DOWN → (BOTTOM_EMPTY | LOADING)
import { CFG } from './config';
import { S, type CartState } from './state';
import { cartCapacity, loadRate, moveLoad, travelTime } from './economy';

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
        enter('TRAVELLING_UP', travelTime(S, from));
        c.from = from;
        S.flags.dispatched = true;
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
        enter('UNLOADING', C.unloadSecs);
        out.push({ type: 'unloadStart', qty: c.load.qty });
        break;
      }
      case 'UNLOADING': {
        // dump at a steady rate so the whole load lands in unloadSecs (Phase 3C: blocked when storage is full)
        const rate = Math.max(c.load.qty, EPS) / Math.max(EPS, c.dur - c.t);
        const need = c.dur - c.t;
        const step = Math.min(left, need);
        const moved = moveLoad(c.load, S.surface, rate * step);
        c.t += step; left -= step;
        if (c.t >= c.dur - EPS || c.load.qty <= EPS) {
          moveLoad(c.load, S.surface, c.load.qty); // never leave a remainder behind
          out.push({ type: 'unloaded', qty: moved });
          enter('TRAVELLING_DOWN', travelTime(S, S.depth));
          out.push({ type: 'returnStart' });
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
