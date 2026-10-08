// Browser compatibility shims (imported first by main.ts). Modern Chrome/Firefox/Safari don't need them; they keep the
// game drawing on older engines (Safari < 16, Firefox < 112) instead of throwing every frame.
type RR = (x: number, y: number, w: number, h: number, r?: number | DOMPointInit | (number | DOMPointInit)[]) => void;
function roundRectPoly(this: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number | DOMPointInit | (number | DOMPointInit)[] = 0) {
  const first = Array.isArray(r) ? r[0] ?? 0 : r;
  let rad = typeof first === 'number' ? first : first.x ?? 0;
  rad = Math.max(0, Math.min(rad, Math.abs(w) / 2, Math.abs(h) / 2));
  this.moveTo(x + rad, y);
  this.arcTo(x + w, y, x + w, y + h, rad);
  this.arcTo(x + w, y + h, x, y + h, rad);
  this.arcTo(x, y + h, x, y, rad);
  this.arcTo(x, y, x + w, y, rad);
  this.closePath();
}
for (const proto of [window.CanvasRenderingContext2D?.prototype, window.Path2D?.prototype] as ({ roundRect?: RR } | undefined)[]) {
  if (proto && typeof proto.roundRect !== 'function') proto.roundRect = roundRectPoly as RR;
}
export {};
