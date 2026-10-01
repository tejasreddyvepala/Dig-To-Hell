// Surface simulation: the Recycling Yard production chain. Pure logic; presentation reacts to SurfaceEvents.
//   raw material --(crusher + auger + press)--> finished blocks --(delivery truck)--> CASH
// A loaded truck departing is the ONLY normal cash source. Before the yard exists, a contractor buys raw loads
// (the first-load tutorial, and a safety net so the player can always afford the yard).
import { CFG } from './config';
import { S, emptyLoad } from './state';
import { contractPrice, moveLoad, processRate } from './economy';

export type SurfaceEventType =
  | 'contractorSold' | 'firstSaleStart' | 'firstSaleDone'
  | 'pressed' | 'truckArrive' | 'truckLoad' | 'truckDepart' | 'truckGone';
export interface SurfaceEvent { type: SurfaceEventType; qty?: number; cash?: number }

const Y = CFG.yard, T = CFG.yard.truck;
const sink = emptyLoad();
let tutorial = { active: false, qty: 0, cash: 0 };
let pressAcc = 0;

/** Contractor buys raw material directly (pre-yard only). */
function contractorBuy(qty: number): { qty: number; cash: number } {
  sink.qty = 0; sink.val = 0; sink.mix = {};
  const q = moveLoad(S.raw, sink, qty);
  const cash = sink.val * contractPrice(S);
  S.cash += cash;
  S.stats.earned += cash;
  S.stats.delivered += q;
  return { qty: q, cash };
}

const cartBusyAtTop = () => S.cart.state === 'SURFACE_ARRIVAL' || S.cart.state === 'UNLOADING';

function enterTruck(state: typeof S.truck.state, dur: number) { S.truck.state = state; S.truck.t = 0; S.truck.dur = dur; }

export function updateSurface(dt: number, out: SurfaceEvent[] = []): SurfaceEvent[] {
  if (!S.yard) {
    // FIRST LOAD: a contractor is waiting above ground and buys the first delivery outright
    if (!S.flags.sold) {
      if (!S.flags.arrived || cartBusyAtTop() || S.raw.qty <= 0) {
        if (tutorial.active && S.raw.qty <= 0) finishTutorial(out);
        return out;
      }
      if (!tutorial.active) { tutorial = { active: true, qty: 0, cash: 0 }; out.push({ type: 'firstSaleStart' }); }
      const r = contractorBuy(Y.contractorRate * dt);
      tutorial.qty += r.qty; tutorial.cash += r.cash;
      out.push({ type: 'contractorSold', qty: r.qty, cash: r.cash });
      if (S.raw.qty <= 1e-6) finishTutorial(out);
      return out;
    }
    // safety net: while the player can't afford the yard, the contractor keeps buying (no soft-lock)
    if (S.cash < Y.cost && S.raw.qty > 0 && !cartBusyAtTop()) {
      const r = contractorBuy(Y.contractorRate * dt);
      if (r.qty > 0) out.push({ type: 'contractorSold', qty: r.qty, cash: r.cash });
    }
    return out;
  }

  // PROCESSING: crusher + auger + press turn raw material into finished blocks (no cash here)
  if (S.raw.qty > 0) {
    const moved = moveLoad(S.raw, S.goods, processRate(S) * dt);
    S.stats.processed += moved;
    pressAcc += moved;
    while (pressAcc >= Y.pressBatch) { pressAcc -= Y.pressBatch; out.push({ type: 'pressed', qty: Y.pressBatch }); }
  }

  // DELIVERY TRUCK: arrives when enough blocks are stacked, loads them, and pays when it drives off
  const tr = S.truck;
  tr.t += dt;
  switch (tr.state) {
    case 'NONE':
      if (S.goods.qty >= T.pickupMin) { tr.n++; tr.paid = 0; enterTruck('ARRIVING', T.arriveSecs); out.push({ type: 'truckArrive' }); }
      break;
    case 'ARRIVING':
      if (tr.t >= tr.dur) enterTruck('LOADING', 0);
      break;
    case 'LOADING': {
      const q = moveLoad(S.goods, tr.load, Math.min(T.loadRate * dt, T.capacity - tr.load.qty));
      if (q > 0) out.push({ type: 'truckLoad', qty: q });
      const full = tr.load.qty >= T.capacity - 1e-6;
      const done = tr.t >= T.minLoadSecs && S.goods.qty <= 1e-6 && (tr.load.qty >= T.pickupMin * 0.5 || tr.t >= T.waitSecs);
      if (full || (done && tr.load.qty > 0)) {
        // PAYDAY: the delivery leaves the yard
        const cash = tr.load.val * contractPrice(S);
        S.cash += cash;
        S.stats.earned += cash;
        S.stats.delivered += tr.load.qty;
        tr.paid = cash;
        tr.bed = tr.load.qty; // visual only: the delivered blocks ride off on the bed
        out.push({ type: 'truckDepart', qty: tr.load.qty, cash });
        tr.load = emptyLoad(); // delivered: the material has left the world
        enterTruck('DEPARTING', T.departSecs);
      }
      break;
    }
    case 'DEPARTING':
      if (tr.t >= tr.dur) { tr.bed = 0; enterTruck('NONE', 0); out.push({ type: 'truckGone' }); }
      break;
  }
  return out;
}

function finishTutorial(out: SurfaceEvent[]) {
  S.flags.sold = true;
  out.push({ type: 'firstSaleDone', qty: tutorial.qty, cash: tutorial.cash });
  tutorial.active = false;
}

export function buildYard(): boolean {
  if (S.yard || S.cash < Y.cost) return false;
  S.cash -= Y.cost;
  S.yard = true;
  return true;
}
