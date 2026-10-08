// Surface simulation: contractor (tutorial seed), Recycling Yard processing, and the delivery truck route.
//   raw material --(crusher + auger + press)--> finished blocks --(truck)--> construction plot
// The truck NEVER pays: it delivers building material. Cash is created by construction (construction.ts).
// Before the yard exists, the contractor inspects the first load, buys a small SAMPLE at market price (that is what
// raw rubble is worth), then pays a CONTRACT ADVANCE that tops the player up to the Recycling Yard's cost (a bootstrap,
// not the rubble's value). The rest of the load stays for the yard's first blocks. If the player still can't afford
// the yard (shouldn't happen), he keeps buying raw at market price: no soft-lock.
import { CFG } from './config';
import { S, emptyLoad, type TruckState } from './state';
import { blockQualityMult, contractPrice, moveLoad, processRate, truckCapacity, truckLoadRate, truckUnloadRate } from './economy';

export type SurfaceEventType =
  | 'contractorSold' | 'firstSaleStart' | 'firstSaleDone' | 'advance'
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
      // a small sample at market price; then the advance (finishTutorial)
      const r = contractorBuy(Math.min(Y.contractorRate * dt, CFG.intro.sampleQty - tutorial.qty));
      tutorial.qty += r.qty; tutorial.cash += r.cash;
      out.push({ type: 'contractorSold', qty: r.qty, cash: r.cash });
      if (S.raw.qty <= 1e-6 || tutorial.qty >= CFG.intro.sampleQty - 1e-6) finishTutorial(out);
      return out;
    }
    // safety net: while the player can't afford the yard, the contractor keeps buying (no soft-lock)
    if (S.cash < Y.cost && S.raw.qty > 0 && !cartBusyAtTop()) {
      const r = contractorBuy(Y.contractorRate * dt);
      if (r.qty > 0) out.push({ type: 'contractorSold', qty: r.qty, cash: r.cash });
    }
    return out;
  }

  // PROCESSING: crusher + auger + press turn raw material into finished blocks (no cash here). Block Quality is stamped
  // onto the blocks pressed NOW (their value travels on to the building; earlier blocks keep theirs).
  if (S.raw.qty > 0) {
    sink.qty = 0; sink.val = 0; sink.mix = {};
    moveLoad(S.raw, sink, processRate(S) * dt);
    sink.val *= blockQualityMult(S);
    const moved = moveLoad(sink, S.goods, sink.qty);
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
      const cap = truckCapacity(S);
      const q = moveLoad(S.goods, tr.load, Math.min(truckLoadRate(S) * dt, cap - tr.load.qty));
      if (q > 0) out.push({ type: 'truckLoad', qty: q });
      const full = tr.load.qty >= cap - 1e-6;
      const done = tr.t >= T.minLoadSecs && S.goods.qty <= 1e-6 && (tr.load.qty >= T.pickupMin * 0.5 || tr.t >= T.waitSecs);
      if (full || (done && tr.load.qty > 0)) { enterTruck('TO_SITE', T.driveSecs); out.push({ type: 'truckDepart', qty: tr.load.qty }); }
      break;
    }
    case 'TO_SITE':
      if (tr.t >= tr.dur) { enterTruck('UNLOADING', 0); out.push({ type: 'truckAtSite' }); }
      break;
    case 'UNLOADING': {
      // blocks go onto the plot's material stack (material is conserved: the truck carries, the plot receives)
      const q = moveLoad(tr.load, S.build.material, truckUnloadRate(S) * dt);
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
  // CONTRACT ADVANCE: the contractor bankrolls the first Recycling Yard (paid back in blocks, narratively)
  const adv = Math.max(0, Y.cost - S.cash);
  if (adv > 0) { S.cash += adv; S.stats.earned += adv; out.push({ type: 'advance', cash: adv }); }
  tutorial.active = false;
}

export function buildYard(): boolean {
  if (S.yard || S.cash < Y.cost) return false;
  S.cash -= Y.cost;
  S.yard = true;
  truckArrives();
  return true;
}
