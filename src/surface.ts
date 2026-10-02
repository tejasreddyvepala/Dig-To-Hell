// Surface simulation: contractor (tutorial seed), Recycling Yard processing, and the delivery truck route.
//   raw material --(crusher + auger + press)--> finished blocks --(truck)--> construction plot
// The truck NEVER pays: it delivers building material. Cash is created by construction (construction.ts).
// Before the yard exists, a contractor buys raw loads once (seed money) and keeps buying only while the player
// cannot afford the Recycling Yard (no soft-lock).
import { CFG } from './config';
import { S, emptyLoad, type TruckState } from './state';
import { contractPrice, moveLoad, processRate } from './economy';

export type SurfaceEventType =
  | 'contractorSold' | 'firstSaleStart' | 'firstSaleDone'
  | 'pressed' | 'truckArrive' | 'truckLoad' | 'truckDepart' | 'truckAtSite' | 'siteUnload' | 'truckReturned';
export interface SurfaceEvent { type: SurfaceEventType; qty?: number; cash?: number }

const Y = CFG.yard, T = CFG.yard.truck;
const sink = emptyLoad();
let tutorial = { active: false, qty: 0, cash: 0, wait: 0 };
let pressAcc = 0;

/** Contractor buys raw material directly (pre-yard only). */
function contractorBuy(qty: number): { qty: number; cash: number } {
  sink.qty = 0; sink.val = 0; sink.mix = {};
  const q = moveLoad(S.raw, sink, qty);
  const cash = sink.val * contractPrice(S);
  S.cash += cash;
  S.stats.earned += cash;
  return { qty: q, cash };
}

const cartBusyAtTop = () => S.cart.state === 'SURFACE_ARRIVAL' || S.cart.state === 'UNLOADING';

function enterTruck(state: TruckState, dur: number) { S.truck.state = state; S.truck.t = 0; S.truck.dur = dur; }

/** Called when the yard is built: the truck drives in from the road to its bay. */
export function truckArrives() { if (S.truck.state === 'NONE') { S.truck.n++; enterTruck('ARRIVING', T.arriveSecs); } }

export function updateSurface(dt: number, out: SurfaceEvent[] = []): SurfaceEvent[] {
  if (!S.yard) {
    // FIRST LOAD: the contractor inspects the dumped rubble, then buys it (seed money)
    if (!S.flags.sold) {
      if (!S.flags.arrived || cartBusyAtTop() || S.raw.qty <= 0) {
        if (tutorial.active && S.raw.qty <= 0) finishTutorial(out);
        return out;
      }
      if (!tutorial.active) { tutorial = { active: true, qty: 0, cash: 0, wait: CFG.intro.contractorTalkSecs }; out.push({ type: 'firstSaleStart' }); }
      if (tutorial.wait > 0) { tutorial.wait -= dt; return out; }
      // he buys just enough to fund the yard; whatever is left becomes the yard's very first blocks
      const unitCash = S.raw.qty > 0 ? (S.raw.val / S.raw.qty) * contractPrice(S) : 1;
      const need = Math.max(0, (CFG.intro.seedCash - S.cash) / Math.max(1e-6, unitCash));
      const r = contractorBuy(Math.min(Y.contractorRate * dt, need + 1e-6));
      tutorial.qty += r.qty; tutorial.cash += r.cash;
      out.push({ type: 'contractorSold', qty: r.qty, cash: r.cash });
      if (S.raw.qty <= 1e-6 || S.cash >= CFG.intro.seedCash - 1e-6) finishTutorial(out);
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

  // DELIVERY TRUCK: yard bay -> road -> construction plot -> back (never pays)
  const tr = S.truck;
  tr.t += dt;
  switch (tr.state) {
    case 'NONE': truckArrives(); break;
    case 'ARRIVING':
      if (tr.t >= tr.dur) { enterTruck('PARKED', 0); out.push({ type: 'truckArrive' }); }
      break;
    case 'PARKED':
      if (S.goods.qty >= T.pickupMin) enterTruck('LOADING', 0);
      break;
    case 'LOADING': {
      const q = moveLoad(S.goods, tr.load, Math.min(T.loadRate * dt, T.capacity - tr.load.qty));
      if (q > 0) out.push({ type: 'truckLoad', qty: q });
      const full = tr.load.qty >= T.capacity - 1e-6;
      const done = tr.t >= T.minLoadSecs && S.goods.qty <= 1e-6 && (tr.load.qty >= T.pickupMin * 0.5 || tr.t >= T.waitSecs);
      if (full || (done && tr.load.qty > 0)) { enterTruck('TO_SITE', T.driveSecs); out.push({ type: 'truckDepart', qty: tr.load.qty }); }
      break;
    }
    case 'TO_SITE':
      if (tr.t >= tr.dur) { enterTruck('UNLOADING', 0); out.push({ type: 'truckAtSite' }); }
      break;
    case 'UNLOADING': {
      // blocks go onto the plot's material stack (material is conserved: the truck carries, the plot receives)
      const q = moveLoad(tr.load, S.build.material, T.unloadRate * dt);
      S.stats.delivered += q;
      if (q > 0) out.push({ type: 'siteUnload', qty: q });
      if (tr.load.qty <= 1e-6) { tr.load = emptyLoad(); tr.n++; enterTruck('RETURNING', T.driveSecs); }
      break;
    }
    case 'RETURNING':
      if (tr.t >= tr.dur) { enterTruck('PARKED', 0); out.push({ type: 'truckReturned' }); }
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
  truckArrives();
  return true;
}
