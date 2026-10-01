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
  // camera scale: the world is drawn in "virtual" px (zoom 1 = canvas px) scaled about a pivot
  zoom: 1,
  panX: 0, // horizontal camera offset (virtual px): the surface view pans to frame the yard
  vx0: 0, vx1: 0, vy0: 0, vy1: 0, // visible virtual-space bounds (for fills that must cover the view)
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
export const shaftCX = () => view.W * CFG.shaftCenterFrac;
export const faceOrigin = () => ({ x: shaftCX() - shaftW() / 2, y: yOf(view.camDepth) });

/** Zoom pivot: shaft centre, at the height where the ground sits when viewing the surface. */
export const pivot = () => ({ x: shaftCX(), y: view.H * CFG.surfaceGroundFrac });
/** Canvas px -> virtual px (inverse of the camera zoom). */
export function toVirtual(px: number, py: number) {
  const p = pivot();
  return { x: p.x + view.panX + (px - p.x) / view.zoom, y: p.y + (py - p.y) / view.zoom };
}
/** Apply the camera zoom + pan to a context (world drawing happens in virtual px). */
export function applyZoom(c: CanvasRenderingContext2D) {
  const p = pivot();
  c.translate(p.x, p.y); c.scale(view.zoom, view.zoom); c.translate(-p.x - view.panX, -p.y);
}

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
  // zoom: close at the dig site; wider when the surface is in view so the yard + truck fit
  const groundVisible = yOf(0) > -view.H * 0.05;
  const atSurface = (view.scrollOff < -1 || view.glide === 'surface') && groundVisible && view.glide !== 'dig';
  const Z = CFG.zoom, p = pivot();
  // surface framing: from just left of the headframe to the end of the truck bay, centred on screen
  const L = surfaceLayout(), left = L.right - L.u * 1.2, span = L.needRight + L.u * 0.5 - left;
  const fit = Math.max(Z.surfaceMin, Math.min(Z.surfaceMax, (view.W * 0.96) / span));
  const targetZ = atSurface ? fit : Z.dig;
  const targetPan = atSurface ? (left + span / 2) - (p.x + (view.W / 2 - p.x) / fit) : 0;
  const k = 1 - Math.exp(-Z.ease * dt);
  view.zoom += (targetZ - view.zoom) * k;
  view.panX += (targetPan - view.panX) * k;
  const z = view.zoom;
  view.vx0 = p.x + view.panX - p.x / z; view.vx1 = p.x + view.panX + (view.W - p.x) / z;
  view.vy0 = p.y - p.y / z; view.vy1 = p.y + (view.H - p.y) / z;
}

/** Screen position of the cart's base: on the face while at the dig site, else at its true world depth. */
export function cartScreen() {
  const x = toScreen(CFG.cart.cartX, 0).x;
  const atFace = S.cart.state === 'BOTTOM_EMPTY' || S.cart.state === 'LOADING' || S.cart.state === 'READY';
  return { x, y: atFace ? toScreen(0, 0).y : yOf(cartDepth()) };
}

/** Surface worker unit: the on-screen height of a person at the surface (all surface scale derives from it). */
export const WU = () => faceScale() * CFG.yard.workerUnit;

/** Surface layout (virtual px): the Recycling Yard runs right from the shaft opening, road in front. */
export function surfaceLayout() {
  const gy = yOf(0), right = shaftCX() + shaftW() / 2, u = WU();
  const hopperX = right + 0.42 * u; // the cart tips straight into it
  const pressX = right + 2.45 * u;
  const stackX = right + 3.55 * u; // finished blocks
  const bayX = right + 4.25 * u; // truck's rear stops here
  const roadY = gy + 0.32 * u; // the road runs in front of the yard
  const hopperTop = yOf(-CFG.cart.surfaceLiftM + 0.6); // hopper mouth sits just under the cart's dump point
  return { gy, right, u, hopperX, hopperTop, pressX, stackX, bayX, roadY, needRight: bayX + 3.75 * u };
}
