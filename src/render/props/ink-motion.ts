import { type P, stroke } from '../ink';

/**
 * Shapes and marks for parts that move: saws, maces, wheels, ropes, kegs, portals. The pen and the flat
 * tones are `ink-props.ts`; this is what a moving part adds on top: shapes cut along an axis (a link, a
 * stave, a sausage), arcs for spin and swing, and the motion lines a turning thing trails.
 */

/**
 * A sausage along +x from (0,0) to (len,0), `r` half-thick: a superellipse, fat through the middle,
 * with `pinch` narrowing it to a twist at each end and `belly` how square its shoulders are (0 oval, 1 boxy).
 */
export function capsulePts(len: number, r: number, belly = 0.5, pinch = 0.35, n = 28): P[] {
  const pts: P[] = [];
  const e = 2 / (2 + belly * 2.5);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = Math.sign(s) * Math.pow(Math.abs(s), e) * (1 - pinch * Math.pow(Math.abs(c), 8));
    pts.push({ x: len / 2 + (x * len) / 2, y: y * r });
  }
  return pts;
}

/** Points along a circular arc. */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 10, out: P[] = []): P[] {
  out.length = 0;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

const scratchArc: P[] = [];

/**
 * A motion line round a turning thing: a tapered stroke trailing `sweep` radians behind angle `a`,
 * fat at the head and lifting off the page at its tail.
 */
export function whoosh(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number, sweep: number, w: number, col: string, seed: number) {
  g.fillStyle = col;
  stroke(g, arcPts(cx, cy, r, a - sweep, a, Math.max(4, Math.ceil(Math.abs(sweep) * r * 0.25)), scratchArc), { w, seed, taper: [0.85, 0.08], press: 0 });
}

/** Transform points by a rotation about the origin and a move. */
export function place(pts: readonly P[], x: number, y: number, a: number, sy = 1): P[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map((p) => ({ x: x + p.x * c - p.y * sy * s, y: y + p.x * s + p.y * sy * c }));
}

/** A regular star or gear outline: `n` points alternating between radii `ro` and `ri`, starting at angle `a0`. */
export function starPts(cx: number, cy: number, n: number, ro: number, ri: number, a0 = 0): P[] {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = a0 + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? ri : ro;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}
