// Worksite-relative layout (face-logical units, x = 0 at the work floor's left wall, y up is negative).
// The shaft (CFG.face.logicalW wide) is centred over the work floor; a Work Chamber is wider than the shaft.
// LEFT wall: stairs + rest platform (people route). RIGHT of the shaft: rail, cart, rubble pile (material route).
import { CFG, WORKSITES } from './config';
import { face } from './digface';
import { S } from './state';
import { faceScale, shaftCX, shaftW, view, yOf } from './view';
import type { Find } from './config';

export const worksiteDef = () => WORKSITES[face.tier];
/** Offset of the shaft column inside the work floor. */
export const shaftOff = () => (face.w - CFG.face.logicalW) / 2;
export const railX = () => shaftOff() + CFG.cart.railX;
export const cartX = () => shaftOff() + CFG.cart.cartX;
export const pileX = () => shaftOff() + CFG.cart.pileX;

/** World depth (m) of the work room's floor, or null in the Narrow Shaft. The expanded room is CARRIED FORWARD: it is
 *  widened as the crew digs, so it always stands at the active floor (S.chamberM keeps where it was first blasted). */
export const chamberM = () => (S.worksite >= 1 ? view.camDepth : null);
/** With a wider worksite, the active floor is a low work pocket (logical height: left bay holds the rest nook, right bay
 *  the transport side). It follows the floor; the tall room stays where it was blasted. */
export const POCKET_L = 112, POCKET_R = 84;
/** Shaft work ledges / transport landings visible this frame (virtual px; filled by rockwall.drawTimberSets). */
export const LEDGES: { x0: number; x1: number; y: number; j: number; kind: 'ledge' | 'landing' | 'bridge' }[] = [];
/** Extra (off-floor) miners drawn on those ledges this frame — their headlamps light a little rock (minelight). */
export const LEDGE_CREW: { x: number; y: number; dir: number }[] = [];
/** Where a deep find sits in the wall (virtual px): in a wide room, in its side bay's back wall; else just outside the shaft. */
export function deepFindPos(f: Find) {
  const cx = shaftCX(), sw = shaftW(), edge = cx + f.side * Math.max(sw / 2, (face.w / 2) * faceScale());
  const bay = (face.w / 2) * faceScale() - sw / 2;
  return { x: bay > 80 ? cx + f.side * (sw / 2 + bay * 0.5) : edge + f.side * 55, y: yOf(f.d) };
}
export const pocketH = () => (worksiteDef().ceiling ? POCKET_L : 0);
