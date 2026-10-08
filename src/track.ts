// Track Strength (Spec §7.8): buying a stronger track is a short physical job, not a label change.
//   cart pauses -> old track sections come off, new sleepers + rails go on section by section (hammering, dust)
//   -> final rail locks -> operation resumes (a cart already climbing continues at the new track's speed).
// The purchase is saved immediately; on reload the new track is simply there.
import { CFG } from './config';
import { S, saveState } from './state';
import { nextTrack } from './economy';
import { retimeUpTrip } from './cart';
import { rnd } from './util';

export const TRACKUP = { active: false, t: 0, from: 0, to: 0, nextHammer: 0 };
export type TrackUpEvent = 'start' | 'hammer' | 'done';

/** The cart (and its sim) waits while the crew reinforces the track. */
export const trackBusy = () => TRACKUP.active;
/** 0..1 progress of the reinforcement (section boundary sweeps bottom -> top). */
export const trackUpK = () => Math.min(1, TRACKUP.t / (CFG.track.upgradeSecs * 0.85));

export function buyTrack(): boolean {
  const n = nextTrack(S);
  if (!n || TRACKUP.active || S.cash < n.cost) return false;
  S.cash -= n.cost;
  TRACKUP.from = S.upg.rail;
  S.upg.rail++;
  TRACKUP.to = S.upg.rail;
  TRACKUP.active = true; TRACKUP.t = 0; TRACKUP.nextHammer = 0.15;
  saveState();
  return true;
}

export function updateTrackUpgrade(dt: number, out: TrackUpEvent[] = []): TrackUpEvent[] {
  if (!TRACKUP.active) return out;
  if (TRACKUP.t === 0) out.push('start');
  TRACKUP.t += dt;
  if (TRACKUP.t >= TRACKUP.nextHammer && TRACKUP.t < CFG.track.upgradeSecs * 0.85) { out.push('hammer'); TRACKUP.nextHammer = TRACKUP.t + rnd(0.13, 0.24); }
  if (TRACKUP.t >= CFG.track.upgradeSecs) {
    TRACKUP.active = false;
    retimeUpTrip();
    out.push('done');
  }
  return out;
}
