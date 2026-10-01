import type { RGB } from './config';

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const rgb = (c: RGB, k: number) =>
  'rgb(' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',') + ')';

/** Deterministic 0..1 noise for stable per-meter texture. */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n: number): string {
  if (n < 10) return (Math.floor(n * 10) / 10).toString();
  if (n < 1000) return Math.floor(n).toString();
  let i = -1;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + UNITS[i];
}

export const money = (n: number) => '$' + fmt(n);
