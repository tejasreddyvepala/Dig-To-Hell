// PLATFORM ADAPTER: the one place the game talks to a web portal (CrazyGames, Poki, GameDistribution, Yandex…).
// The default adapter is a no-op, so the game runs anywhere (own site, itch.io). A portal build registers its SDK
// with `setPortal()` before the game boots. No ads and no SDK are bundled here.
//
// The game calls:  loadingStart/loadingDone · gameplayStart/gameplayStop · happyTime (big wins)
// The portal calls: pauseForAd() / resumeAfterAd() — freezes the simulation and silences all audio.
import { holdAudio } from './audio';

export interface Portal {
  name: string;
  loadingStart?(): void;
  loadingDone?(): void;
  gameplayStart?(): void;
  gameplayStop?(): void;
  happyTime?(): void;
}
let portal: Portal = { name: 'web' };
let playing = false;
let adPause = false;

export function setPortal(p: Portal) { portal = p; }
export const portalName = () => portal.name;
const call = (f?: () => void) => { try { f?.call(portal); } catch (e) { console.warn('portal call failed', e); } };

export const loadingStart = () => call(portal.loadingStart);
export const loadingDone = () => call(portal.loadingDone);
/** The player is actively playing (idempotent). */
export function gameplayStart() { if (playing || adPause) return; playing = true; call(portal.gameplayStart); }
/** The player stopped playing: tab hidden, ad, end card (idempotent). */
export function gameplayStop() { if (!playing) return; playing = false; call(portal.gameplayStop); }
export const happyTime = () => call(portal.happyTime);

/** Portal ad break: the world freezes and goes silent until resumeAfterAd(). */
export function pauseForAd() { adPause = true; gameplayStop(); holdAudio('ad', true); }
export function resumeAfterAd() { adPause = false; holdAudio('ad', false); if (!document.hidden) gameplayStart(); }
/** True while the simulation must not advance (an ad is showing). */
export const simPaused = () => adPause;
