// Construction simulation: one plot, reused, ever-bigger projects. Pure logic (no DOM/audio).
// Blocks delivered by the truck stack on the plot; each stage STARTS AUTOMATICALLY once its blocks are on site;
// builders consume them; a completed stage pays a milestone; the finished property is sold for the main payout.
// This module and the tutorial contractor are the ONLY cash sources (Spec §3).
import { CFG, PROJECTS } from './config';
import { S, emptyLoad } from './state';
import { constructionRate, moveLoad, projectValue, stagePaymentFor } from './economy';

export type BuildEventType = 'stageStart' | 'stageDone' | 'complete' | 'sold' | 'consume';
export interface BuildEvent { type: BuildEventType; name?: string; cash?: number; qty?: number; project?: number }

const sink = emptyLoad();

export const currentProject = () => PROJECTS[S.build.project];
export const currentStage = () => currentProject().stages[S.build.stage];

/** Blocks the next stage still needs on the plot before it can start (0 = ready). */
export function stageShortfall() {
  const st = currentStage();
  if (!st || S.build.active || S.build.done) return 0;
  return Math.max(0, st.blocks - S.build.material.qty);
}

/** A stage starts as soon as ANY blocks are on the plot: the crew works with what they have and pauses mid-stage if
 *  the plot runs dry (the stage finishes when its full block count has been laid). */
export function canStartStage() {
  return !S.build.active && !S.build.done && !!currentStage() && S.build.material.qty >= 1 - 1e-6;
}
/** The crew is mid-stage but the plot is empty: waiting for the next delivery. */
export const waitingForBlocks = () => S.build.active && !S.build.done && S.build.material.qty < 1e-6;

export function startStage(out: BuildEvent[] = []): boolean {
  if (!canStartStage()) return false;
  S.build.active = true;
  S.build.used = 0;
  S.build.stageVal = 0;
  out.push({ type: 'stageStart', name: currentStage().name });
  return true;
}

let autoT = 0; // anticipation before a stage starts by itself (presentation beat; not saved)

export function updateConstruction(dt: number, out: BuildEvent[] = []): BuildEvent[] {
  const b = S.build;
  // AUTOMATIC STAGES: the site is a living part of the economy, not a menu. When the next stage's blocks are on the
  // plot and nothing is being built, it starts on its own (whatever site the player is looking at).
  if (!b.active && !b.done) {
    if (canStartStage()) { autoT += dt; if (autoT >= CFG.build.autoStartSecs) { autoT = 0; startStage(out); } }
    else autoT = 0;
  }
  if (!b.active || b.done) return out;
  // construction became a bottleneck (blocks wait on the plot while the crew works): reveal CONSTRUCTION CREW
  if (!S.flags.crewSeen && b.material.qty >= CFG.build.revealBacklog) S.flags.crewSeen = true;
  const st = currentStage();
  sink.qty = 0; sink.val = 0; sink.mix = {};
  const q = moveLoad(b.material, sink, Math.min(constructionRate(S) * dt, st.blocks - b.used));
  b.used += q;
  b.stageVal += sink.val; b.projVal += sink.val; b.projQty += q; // the value of the material built in stays with the house
  if (q > 0) out.push({ type: 'consume', qty: q });
  if (b.used >= st.blocks - 1e-6) {
    // milestone: the client pays for the finished stage — its size × the value of the blocks it used
    const pay = stagePaymentFor(S, b.stage, b.used > 0 ? b.stageVal / b.used : 1);
    S.cash += pay;
    S.stats.earned += pay;
    out.push({ type: 'stageDone', name: st.name, cash: pay });
    b.active = false;
    b.used = 0;
    b.stageVal = 0;
    b.stage++;
    if (b.stage >= currentProject().stages.length) {
      b.done = true;
      out.push({ type: 'complete', name: currentProject().name, cash: projectValue(S) });
    }
  }
  return out;
}

/** Sell the finished property: the main payout. The plot clears for the next (bigger) project. */
export function sellProperty(out: BuildEvent[] = []): number {
  const b = S.build;
  if (!b.done) return 0;
  const value = projectValue(S);
  const sold = b.project;
  S.cash += value;
  S.stats.earned += value;
  S.stats.sold++;
  b.project = Math.min(b.project + 1, PROJECTS.length - 1); // V2-1 stops at Project #2 (it repeats once sold)
  b.stage = 0; b.used = 0; b.active = false; b.done = false;
  b.stageVal = 0; b.projVal = 0; b.projQty = 0;
  out.push({ type: 'sold', cash: value, project: sold });
  return value;
}
