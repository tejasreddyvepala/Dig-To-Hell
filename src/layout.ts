// Worksite-relative layout (face-logical units, x = 0 at the work floor's left wall, y up is negative).
// The shaft (CFG.face.logicalW wide) is centred over the work floor; a Work Chamber is wider than the shaft.
// LEFT wall: stairs + rest platform (people route). RIGHT of the shaft: rail, cart, rubble pile (material route).
import { CFG, WORKSITES } from './config';
import { face } from './digface';

export const worksiteDef = () => WORKSITES[face.tier];
/** Offset of the shaft column inside the work floor. */
export const shaftOff = () => (face.w - CFG.face.logicalW) / 2;
export const railX = () => shaftOff() + CFG.cart.railX;
export const cartX = () => shaftOff() + CFG.cart.cartX;
export const pileX = () => shaftOff() + CFG.cart.pileX;
