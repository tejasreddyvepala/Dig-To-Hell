// Canvas, camera and face <-> screen geometry. Shared by rendering, input and FX.
import { CFG } from './config';
import { S } from './state';

export const canvas = document.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d')!;

export const view = {
  W: 0,
  H: 0,
  dpr: 1,
  t: 0,
  camDepth: S.depth, // eased view depth; trails S.depth so each break visibly extends the shaft
  scrollOff: 0, // meters, <= 0 when the player scrolls up the shaft
  scrollIdle: 0,
  hideDigHint: false,
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

export function updateCamera(dt: number) {
  view.t += dt;
  view.camDepth += (S.depth - view.camDepth) * (1 - Math.exp(-CFG.cameraFollow * dt));
  if (Math.abs(S.depth - view.camDepth) > 20) view.camDepth = S.depth; // offline jumps, resets
  if (view.scrollIdle > 0) { view.scrollIdle -= dt; if (view.scrollIdle <= 0) view.scrollOff = 0; }
}
