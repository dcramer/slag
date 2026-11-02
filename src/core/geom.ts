import { dcos } from './dmath';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Cell = readonly [number, number];
export type Vec = readonly [number, number];

const EPS = 1e-4;

/** Strict overlap (touching edges do not count), with a small epsilon for float drift. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
}

export function rectCircle(r: Rect, cx: number, cy: number, rad: number): boolean {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < rad * rad;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

export function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : Math.min(v, hi);
}

export function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export function frac(t: number): number {
  return t - Math.floor(t);
}

/** Smooth 0 → 1 → 0 oscillation over one cycle of t. */
export function pingPong(t: number): number {
  return (1 - dcos(frac(t) * Math.PI * 2)) / 2;
}

/** Shift cells so the minimum x and y are 0, and sort for stable comparison. */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of cells) {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
  }
  return cells.map(([x, y]) => [x - mx, y - my] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function cellsBounds(cells: readonly Cell[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const [x, y] of cells) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { w, h };
}
