// Construction simulation: one plot, reused, ever-bigger projects. Pure logic (no DOM/audio).
// Blocks delivered by the truck stack on the plot; each stage STARTS AUTOMATICALLY once its blocks are on site;
// builders consume them; a completed stage pays a milestone; the finished property is sold for the main payout.
// This module and the tutorial contractor are the ONLY cash sources (Spec §3).
import { CFG, PROJECTS } from './config';
import { S, emptyLoad } from './state';
import { moveLoad, projectValue, stagePayment } from './economy';

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

export function canStartStage() {
  return !S.build.active && !S.build.done && !!currentStage() && S.build.material.qty >= currentStage().blocks - 1e-6;
}

export function startStage(out: BuildEvent[] = []): boolean {
  if (!canStartStage()) return false;
  S.build.active = true;
  S.build.used = 0;
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
  const st = currentStage();
  sink.qty = 0; sink.val = 0; sink.mix = {};
  const q = moveLoad(b.material, sink, Math.min(CFG.build.rate * dt, st.blocks - b.used));
  b.used += q;
  if (q > 0) out.push({ type: 'consume', qty: q });
  if (b.used >= st.blocks - 1e-6) {
    // milestone: the client pays for the finished stage
    const pay = stagePayment(S);
    S.cash += pay;
    S.stats.earned += pay;
    out.push({ type: 'stageDone', name: st.name, cash: pay });
    b.active = false;
    b.used = 0;
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
  out.push({ type: 'sold', cash: value, project: sold });
  return value;
}
