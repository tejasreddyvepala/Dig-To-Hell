// Surface simulation: the tutorial Scrap Buyer and the Scrap Stall seller turn surface stock into cash.
// This is the ONLY normal cash source in the game. Pure logic; presentation reacts to SurfaceEvents.
import { CFG } from './config';
import { S, emptyLoad } from './state';
import { moveLoad, sellPrice, sellRate } from './economy';

export type SurfaceEventType = 'sold' | 'firstSaleStart' | 'firstSaleDone' | 'stallBuilt';
export interface SurfaceEvent { type: SurfaceEventType; qty?: number; cash?: number }

const SF = CFG.surface;
const sink = emptyLoad();
let tutorial = { active: false, qty: 0, cash: 0 };

/** Sell up to `qty` units from the surface stock; cash = carried value × price. */
function sell(qty: number): { qty: number; cash: number } {
  sink.qty = 0; sink.val = 0;
  const q = moveLoad(S.surface, sink, qty);
  const cash = sink.val * sellPrice(S);
  S.cash += cash;
  S.stats.earned += cash;
  S.stats.sold += q;
  return { qty: q, cash };
}

/** The tutorial buyer only deals once the cart has finished dumping the first load. */
const cartBusyAtTop = () => S.cart.state === 'SURFACE_ARRIVAL' || S.cart.state === 'UNLOADING';

export function updateSurface(dt: number, out: SurfaceEvent[] = []): SurfaceEvent[] {
  if (!S.flags.sold) {
    // FIRST LOAD: a scrap buyer is waiting above ground and buys the first delivery
    if (!S.flags.arrived || cartBusyAtTop() || S.surface.qty <= 0) {
      if (tutorial.active && S.surface.qty <= 0) finishTutorial(out);
      return out;
    }
    if (!tutorial.active) { tutorial = { active: true, qty: 0, cash: 0 }; out.push({ type: 'firstSaleStart' }); }
    const r = sell(SF.buyerRate * dt);
    tutorial.qty += r.qty; tutorial.cash += r.cash;
    out.push({ type: 'sold', qty: r.qty, cash: r.cash });
    if (S.surface.qty <= 1e-6) finishTutorial(out);
    return out;
  }
  // safety net: until the stall exists, the buyer keeps buying whenever the player can't afford it (no soft-lock)
  if (!S.stall && S.cash < SF.stallCost && S.surface.qty > 0 && !cartBusyAtTop()) {
    const r = sell(SF.buyerRate * dt);
    if (r.qty > 0) out.push({ type: 'sold', qty: r.qty, cash: r.cash });
    return out;
  }
  if (S.stall && S.surface.qty > 0) {
    const r = sell(sellRate(S) * dt);
    if (r.qty > 0) out.push({ type: 'sold', qty: r.qty, cash: r.cash });
  }
  return out;
}

function finishTutorial(out: SurfaceEvent[]) {
  S.flags.sold = true;
  out.push({ type: 'firstSaleDone', qty: tutorial.qty, cash: tutorial.cash });
  tutorial.active = false;
}

export function buildStall(): boolean {
  if (S.stall || S.cash < SF.stallCost) return false;
  S.cash -= SF.stallCost;
  S.stall = true;
  return true;
}
