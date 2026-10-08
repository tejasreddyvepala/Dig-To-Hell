// ANALYTICS HOOKS: one event bus for the whole game. The default sink does nothing and nothing leaves the browser; a
// portal build (or a privacy-reviewed analytics service, later) plugs in with setAnalyticsSink(). Session counts and
// lengths are kept locally in `dth_meta` so the events can carry them.
//
// Events: game_start (every boot) · session_start {n} · tutorial_start / tutorial_complete / tutorial_skip ·
// first_dig · first_upgrade · first_worker · yard_unlock · first_processing · build_unlock · first_property_sale ·
// depth_{100..1000} · game_complete {secs} · game_reset · session_end {secs, depth, site} (the quit point)
import { S } from './state';
import { view } from './view';

export type Props = Record<string, string | number | boolean>;
type Sink = (event: string, props: Props) => void;
let sink: Sink = () => undefined;
export function setAnalyticsSink(f: Sink) { sink = f; }

const KEY = 'dth_meta';
const meta = { sessions: 0, firsts: {} as Record<string, number>, totalSecs: 0 };
try { Object.assign(meta, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* session only */ } };
const t0 = performance.now();
const sessionSecs = () => Math.round((performance.now() - t0) / 1000);

export function track(event: string, props: Props = {}) {
  const p = { ...props, session: meta.sessions, depth: Math.floor(S.depth) };
  if (import.meta.env.DEV) console.debug('[analytics]', event, p);
  try { sink(event, p); } catch (e) { console.warn('analytics sink failed', e); }
}
/** Fire an event only once per player (ever), e.g. first_upgrade. */
function once(event: string, props: Props = {}) {
  if (meta.firsts[event]) return;
  meta.firsts[event] = Date.now(); save();
  track(event, props);
}

export function initAnalytics() {
  meta.sessions++; save();
  track('game_start', { returning: meta.sessions > 1 });
  track('session_start', { n: meta.sessions });
  let ended = false;
  const end = () => {
    if (ended) return; ended = true;
    meta.totalSecs += sessionSecs(); save();
    track('session_end', { secs: sessionSecs(), site: view.site, playSecs: Math.round(S.stats.playSecs ?? 0) });
  };
  addEventListener('pagehide', end);
}

/** Milestones are read from the state (called with the panel tick, a few times a second): no hooks scattered around. */
export function checkMilestones() {
  if (S.clicks > 0) once('first_dig');
  if (S.tool > 0 || Object.values(S.upg).some((v) => v > 0)) once('first_upgrade');
  if (S.crew.dig > 0) once('first_worker');
  if (S.yard) once('yard_unlock');
  if (S.stats.processed > 0) once('first_processing');
  if (S.flags.annBuild) once('build_unlock');
  if (S.stats.sold > 0) once('first_property_sale', { secs: Math.round(S.stats.playSecs ?? 0) });
  for (let d = 100; d <= 1000; d += 100) if (S.depth >= d) once(`depth_${d}`, { secs: Math.round(S.stats.playSecs ?? 0) });
}
/** Starting over clears the per-player "firsts" so a new run reports its own funnel. */
export function resetMilestones() { meta.firsts = {}; save(); track('game_reset'); }
