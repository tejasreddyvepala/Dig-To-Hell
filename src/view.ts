// Canvas, camera and face <-> screen geometry. Shared by rendering, input and FX.
import { CFG } from './config';
import { S } from './state';
import { cartDepth } from './cart';

export const canvas = document.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d')!;

export const view = {
  W: 0,
  H: 0,
  dpr: 1,
  t: 0,
  camDepth: S.depth, // eased view depth; trails S.depth so each break visibly extends the shaft
  scrollOff: 0, // meters, <= 0 when the player scrolls up the shaft (stays until they return)
  hideDigHint: false,
  cartRect: null as { x: number; y: number; w: number; h: number } | null, // last drawn cart, for tap-to-send
  glide: null as null | 'surface' | 'dig', // camera smoothly travelling to a location
};

function resize() {
  const r = canvas.getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.W = r.width;
  view.H = r.height;
  canvas.width = Math.round(view.W * view.dpr);
  canvas.height = Math.round(view.H * view.dpr);
}
new ResizeObserver(resize).observe(canvas);
resize();

export const faceY = () => view.H * CFG.faceYFrac;
export const shaftW = () =>
  Math.min(CFG.shaftMaxW, Math.max(view.W * CFG.shaftWFrac, Math.min(CFG.shaftMinW, view.W * CFG.shaftNarrowFrac)));
/** Logical face px -> screen px scale. */
export const faceScale = () => shaftW() / CFG.face.logicalW;
export const viewTop = () => view.camDepth - faceY() / CFG.ppm + view.scrollOff;
export const yOf = (m: number) => (m - viewTop()) * CFG.ppm;
/** Screen position of the face's top-left corner (the dig surface). */
export const faceOrigin = () => ({ x: view.W / 2 - shaftW() / 2, y: yOf(view.camDepth) });

export function toScreen(lx: number, ly: number) {
  const o = faceOrigin(), s = faceScale();
  return { x: o.x + lx * s, y: o.y + ly * s };
}
export function toLogical(px: number, py: number) {
  const o = faceOrigin(), s = faceScale();
  return { x: (px - o.x) / s, y: (py - o.y) / s };
}

/** scrollOff that puts the ground at CFG.surfaceGroundFrac of the screen. */
export const surfaceScroll = () => -(view.H * CFG.surfaceGroundFrac) / CFG.ppm - view.camDepth + faceY() / CFG.ppm;

export function updateCamera(dt: number) {
  view.t += dt;
  const before = view.camDepth;
  view.camDepth += (S.depth - view.camDepth) * (1 - Math.exp(-CFG.cameraFollow * dt));
  if (Math.abs(S.depth - view.camDepth) > 20) view.camDepth = S.depth; // offline jumps, resets
  // while exploring, hold the view still in absolute depth even as the face deepens
  if (view.scrollOff < 0 && view.glide !== 'dig') view.scrollOff = Math.min(0, view.scrollOff - (view.camDepth - before));
  if (view.glide) {
    const target = view.glide === 'surface' ? Math.min(0, surfaceScroll()) : 0;
    view.scrollOff += (target - view.scrollOff) * (1 - Math.exp(-CFG.cameraGlide * dt));
    if (Math.abs(target - view.scrollOff) < 0.05) { view.scrollOff = target; view.glide = null; }
  }
}

/** Screen position of the cart's base: on the face while at the dig site, else at its true world depth. */
export function cartScreen() {
  const x = toScreen(CFG.cart.cartX, 0).x;
  const atFace = S.cart.state === 'BOTTOM_EMPTY' || S.cart.state === 'LOADING' || S.cart.state === 'READY';
  return { x, y: atFace ? toScreen(0, 0).y : yOf(cartDepth()) };
}

/** Surface layout in screen space: everything sits right of the shaft opening (the transport side), clamped on screen. */
export function surfaceLayout() {
  const gy = yOf(0), right = view.W / 2 + shaftW() / 2;
  const stockX = Math.min(right + CFG.surface.stockOffsetPx, view.W - 140);
  const stallX = Math.min(right + CFG.surface.stallOffsetPx, view.W - 58);
  return { gy, right, stockX, stallX };
}
