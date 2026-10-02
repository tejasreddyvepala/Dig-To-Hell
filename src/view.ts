// Canvas, camera and face <-> screen geometry. Shared by rendering, input and FX.
// The camera frames one SITE at a time (MINE / YARD / BUILD, Spec §5). Switching sites is a short eased tween
// (vertical Mine <-> Yard, horizontal Yard <-> Build); afterwards the camera follows its site's target.
import { CFG } from './config';
import { S, type Site } from './state';
import { cartDepth } from './cart';
import { face } from './digface';
import { cartX } from './layout';

export const canvas = document.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d')!;

export const view = {
  W: 0,
  H: 0,
  dpr: 1,
  t: 0,
  camDepth: S.depth, // eased view depth; trails S.depth so each break visibly extends the shaft
  scrollOff: 0, // meters, <= 0 when the camera is above the dig face (surface sites, or exploring the shaft)
  explore: 0, // extra scroll the player added with the wheel while at the mine (<= 0)
  hideDigHint: false,
  cartRect: null as { x: number; y: number; w: number; h: number } | null, // last drawn cart, for tap-to-send
  // camera scale: the world is drawn in "virtual" px (zoom 1 = canvas px) scaled about a pivot
  zoom: 1,
  panX: 0, // horizontal camera offset (virtual px)
  vx0: 0, vx1: 0, vy0: 0, vy1: 0, // visible virtual-space bounds (for fills that must cover the view)
  site: S.site as Site, // the site being framed
  tween: null as null | { from: { s: number; z: number; p: number }; t: number; dur: number },
  lastSwitch: -10,
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
/** Screen width of the 260-unit shaft (the reference everything scales from). */
export const shaftW = () =>
  Math.min(CFG.shaftMaxW, Math.max(view.W * CFG.shaftWFrac, Math.min(CFG.shaftMinW, view.W * CFG.shaftNarrowFrac)));
/** Logical face px -> screen px scale. */
export const faceScale = () => shaftW() / CFG.face.logicalW;
export const viewTop = () => view.camDepth - faceY() / CFG.ppm + view.scrollOff;
export const yOf = (m: number) => (m - viewTop()) * CFG.ppm;
export const shaftCX = () => view.W * CFG.shaftCenterFrac;
/** Screen position of the work floor's top-left corner (the dig surface). The floor is centred on the shaft. */
export const faceOrigin = () => ({ x: shaftCX() - (face.w / 2) * faceScale(), y: yOf(view.camDepth) });

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
export const surfaceScroll = () => Math.min(0, -(view.H * CFG.surfaceGroundFrac) / CFG.ppm - view.camDepth + faceY() / CFG.ppm);

/** Camera target (scrollOff, zoom, panX) for a site. Targets move (depth grows, worksite widens), so they are
 *  recomputed every frame; the transition tween blends from the old camera to the live target. */
function target(site: Site): { s: number; z: number; p: number } {
  const Z = CFG.zoom, p = pivot();
  if (site === 'mine') {
    // fit the work floor (wider in the Work Chamber) with a margin; never zoom in past 1. When zoomed out, the
    // floor is centred on screen (the narrow shaft keeps its left-of-centre spot so the yard fits beside it).
    const need = face.w * faceScale() + 40;
    const z = Math.max(0.55, Math.min(Z.dig, (view.W * 0.97) / need));
    const centred = shaftCX() - (p.x + (view.W / 2 - p.x) / z);
    return { s: Math.min(0, view.explore), z, p: z < 0.999 ? centred : 0 };
  }
  const L = surfaceLayout();
  // YARD: from just left of the headframe to the end of the truck bay; BUILD: from the bay to the end of the plot
  const left = site === 'yard' ? L.right - L.u * 1.2 : L.plotX0 - L.u * 1.4; // BUILD: the plot fills the view; the truck drives in
  const right = site === 'yard' ? L.needRight + L.u * 0.5 : L.plotX1 + L.u * 1.9;
  const span = right - left;
  const z = Math.max(Z.surfaceMin, Math.min(site === 'build' ? Z.buildMax : Z.surfaceMax, (view.W * 0.96) / span));
  return { s: surfaceScroll(), z, p: (left + span / 2) - (p.x + (view.W / 2 - p.x) / z) };
}

/** Send the camera to a site (navigation). Repeated quick switches use the short tween. */
export function goSite(site: Site) {
  if (site === view.site && !view.tween) return;
  const quick = view.t - view.lastSwitch < CFG.nav.quickWithinSecs;
  view.lastSwitch = view.t;
  view.tween = { from: { s: view.scrollOff, z: view.zoom, p: view.panX }, t: 0, dur: quick ? CFG.nav.quickSecs : CFG.nav.transitSecs };
  view.site = site;
  if (site !== 'mine') view.explore = 0;
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function updateCamera(dt: number) {
  view.t += dt;
  const before = view.camDepth;
  view.camDepth += (S.depth - view.camDepth) * (1 - Math.exp(-CFG.cameraFollow * dt));
  if (Math.abs(S.depth - view.camDepth) > 20) view.camDepth = S.depth; // offline jumps, resets
  // while exploring the shaft, hold the view still in absolute depth even as the face deepens
  if (view.explore < 0) view.explore = Math.min(0, view.explore - (view.camDepth - before));
  const tg = target(view.site);
  if (view.tween) {
    const tw = view.tween;
    tw.t += dt;
    const k = ease(Math.min(1, tw.t / tw.dur));
    view.scrollOff = tw.from.s + (tg.s - tw.from.s) * k;
    view.zoom = tw.from.z + (tg.z - tw.from.z) * k;
    view.panX = tw.from.p + (tg.p - tw.from.p) * k;
    if (tw.t >= tw.dur) view.tween = null;
  } else {
    const k = 1 - Math.exp(-CFG.zoom.ease * dt);
    view.scrollOff = view.site === 'mine' ? tg.s : view.scrollOff + (tg.s - view.scrollOff) * Math.min(1, k * 3);
    view.zoom += (tg.z - view.zoom) * k;
    view.panX += (tg.p - view.panX) * k;
  }
  const z = view.zoom, p = pivot();
  view.vx0 = p.x + view.panX - p.x / z; view.vx1 = p.x + view.panX + (view.W - p.x) / z;
  view.vy0 = p.y - p.y / z; view.vy1 = p.y + (view.H - p.y) / z;
}

/** True while the camera is on its way somewhere. */
export const inTransit = () => !!view.tween;

/** Screen position of the cart's base: on the face while at the dig site, else at its true world depth. */
export function cartScreen() {
  const x = toScreen(cartX(), 0).x;
  const atFace = S.cart.state === 'BOTTOM_EMPTY' || S.cart.state === 'LOADING' || S.cart.state === 'READY';
  return { x, y: atFace ? toScreen(0, 0).y : yOf(cartDepth()) };
}

/** Surface worker unit: the on-screen height of a person at the surface (all surface scale derives from it). */
export const WU = () => faceScale() * CFG.yard.workerUnit;

/** Surface layout (virtual px): the Recycling Yard runs right from the shaft opening, road in front,
 *  and further along the road the construction plot. Independent of the worksite tier (the shaft never moves). */
export function surfaceLayout() {
  const gy = yOf(0), right = shaftCX() + shaftW() / 2, u = WU();
  const hopperX = right + 0.42 * u; // the cart tips straight into it
  const pressX = right + 2.45 * u;
  const stackX = right + 3.55 * u; // finished blocks
  const bayX = right + 4.25 * u; // truck's rear stops here
  const roadY = gy + 0.32 * u; // the road runs in front of the yard
  const hopperTop = yOf(-CFG.cart.surfaceLiftM + 0.6); // hopper mouth sits just under the cart's dump point
  const needRight = bayX + 3.75 * u;
  const plotX0 = needRight + CFG.build.plotOffsetU * u; // construction plot (left edge)
  const plotX1 = plotX0 + 7.2 * u;
  const siteTruckX = plotX0 - 0.2 * u; // the truck's rear stops here to unload at the plot
  return { gy, right, u, hopperX, hopperTop, pressX, stackX, bayX, roadY, needRight, plotX0, plotX1, siteTruckX };
}
