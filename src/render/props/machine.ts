import { css, type HSL } from '../../core/color';
import type { Module, Resolved } from '../../sim/props';
import { line, type P } from '../ink';
import { boxPts, dot, INK, ovalPts, part, path } from '../ink-props';
import type { MetalPalette } from '../kit';

/**
 * The hazard machines' housings (docs/ART.md, World art: ink). A launcher, a jet, an emitter or a fan sits
 * on a one-tile block, and drawn as a block it read as a box with a gadget stuck on. Here the block *is*
 * the machine: its art draws the part in the cell, so the body block isn't drawn under it (`housed`). Its
 * outline is the machine's own shape (a gas bottle, a dome, a lantern), inside the hitbox but never its
 * square. Everything is drawn in a local frame whose business end faces -y and mapped to the way
 * the part faces, so a jet turned on its side keeps its flange at the back and its lit side up-left.
 */

/** Module types whose art draws the block they stand on. */
const HOUSED = new Set<Module['type']>(['launcher', 'sentry', 'flame', 'laser', 'tesla', 'piston', 'fan', 'magnet']);

/**
 * Whether this prop's body is drawn by its machine. A set piece brings its own housing (a `deco`: the
 * press, the AC unit, the antenna) and keeps its block.
 */
export function housed(r: Resolved): boolean {
  let body = false;
  let machine = false;
  for (const m of r.mods) {
    if (m.type === 'deco') return false;
    if (m.type === 'body') body = true;
    else if (HOUSED.has(m.type)) machine = true;
  }
  return body && machine;
}

/** Which way the business end faces: 0 up, 1 right, 2 down, 3 left. */
export type Face = 0 | 1 | 2 | 3;

export function faceOf(dx: number, dy: number): Face {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}

/**
 * Local (face toward -y) to the part's own frame. Turned sideways the local right goes up, and turned
 * over it stays right: whatever sits on one side of a housing lands on the lit side, never under it.
 */
export function tf(k: Face, x: number, y: number): P {
  switch (k) {
    case 0:
      return { x, y };
    case 1:
      return { x: -y, y: -x };
    case 2:
      return { x, y: -y };
    case 3:
      return { x: y, y: -x };
  }
}

/** Points along a local polyline [x, y, x, y, ...], turned to face `k`. */
export function lp(k: Face, ...xy: number[]): P[] {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push(tf(k, xy[i], xy[i + 1]));
  return out;
}

/** A local box cut by hand, turned to face `k`. */
export function lbox(k: Face, x: number, y: number, w: number, h: number, r: number, seed: number, bow = 0.2): P[] {
  return boxPts(x, y, w, h, r, seed, bow).map((p) => tf(k, p.x, p.y));
}

/** A short pen line in local coordinates. */
export function ltick(
  g: CanvasRenderingContext2D,
  k: Face,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number,
  seed: number,
  col = INK,
  taper: [number, number] = [0.15, 0.3],
) {
  const a = tf(k, ax, ay);
  const b = tf(k, bx, by);
  g.fillStyle = col;
  line(g, a.x, a.y, b.x, b.y, { w, seed, taper, press: 0.2 });
}

/** A bolt head: ink, a body tone and a lit fleck, at local (x, y). */
export function bolt(g: CanvasRenderingContext2D, k: Face, x: number, y: number, r: number, pal: MetalPalette, seed: number) {
  const p = tf(k, x, y);
  dot(g, p.x, p.y, r, seed, css(pal.light, 6));
}

/** A round path with enough points that it never reads as a polygon at card size; fill it yourself. */
export function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  path(g, ovalPts(x, y, r, r, seed, 0.03, Math.max(14, Math.round(r * 6))));
}

/** A smooth ball for a machine's big round parts (a dome, a terminal): `ball` from the kit, without its lumps at size. */
export function orb(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL, seed: number) {
  g.fillStyle = INK;
  disc(g, x + 0.25, y + 0.3, r + Math.min(1.1, r * 0.22), seed);
  g.fill();
  g.fillStyle = css(base, -14, 1, 4);
  disc(g, x, y, r, seed + 1);
  g.fill();
  g.save();
  disc(g, x, y, r, seed + 1);
  g.clip();
  g.fillStyle = css(base);
  disc(g, x - r * 0.2, y - r * 0.24, r * 0.88, seed + 2);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  line(g, x - r * 0.62, y - r * 0.02, x - r * 0.2, y - r * 0.6, { w: Math.max(0.5, r * 0.2), seed, taper: [0.25, 0.4], press: 0.1 });
}

/** Fill a shape inside a clip: tone without a shadow, for bands and panels that belong to a body. */
export function flat(g: CanvasRenderingContext2D, pts: readonly P[], col: string) {
  g.fillStyle = col;
  path(g, pts);
  g.fill();
}

/** Clip to a shape, draw, and restore. */
export function within(g: CanvasRenderingContext2D, pts: readonly P[], draw: () => void) {
  g.save();
  path(g, pts);
  g.clip();
  draw();
  g.restore();
}

/** Iron that never sinks into the night: a metal's base, lifted if it's too dark to read against the sky. */
export function iron(pal: MetalPalette, min = 36): HSL {
  return { ...pal.base, l: Math.max(pal.base.l, min) };
}

/**
 * A mounting flange across the back of a housing, local y from `y0` to the cell's back edge at 8: a
 * darker plate with a bolt at each end, the visible proof the machine is fixed to something.
 */
export function flange(g: CanvasRenderingContext2D, k: Face, x0: number, x1: number, y0: number, pal: MetalPalette, seed: number) {
  const pts = lbox(k, x0, y0, x1 - x0, 8 - y0, 1.8, seed, 0.15);
  part(g, pts, { ...pal.dark, l: Math.max(26, pal.dark.l + 12), s: Math.min(35, pal.dark.s) }, seed, { depth: 0.7, thin: 0.5, thick: 1.3, shade: -9 });
  const mid = (y0 + 8) / 2;
  for (const x of [x0 + 2.4, x1 - 2.4]) bolt(g, k, x, mid, 0.95, pal, seed + x);
}

/**
 * Chiselled bevels round a dressed stone's face, `b` deep: lit on top and left, in shade below and right,
 * mitred at the corners, with the face's shadowed edges inked. Draw it clipped to the stone.
 */
export function bevel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, b: number, stone: HSL) {
  const x1 = x + w;
  const y1 = y + h;
  const facet = (dl: number, ...xy: number[]) => {
    g.fillStyle = css(stone, dl, 1, dl < 0 ? 4 : -2);
    g.beginPath();
    for (let i = 0; i < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1]);
    g.closePath();
    g.fill();
  };
  facet(13, x - 1, y - 1, x1 + 1, y - 1, x1 - b, y + b, x + b, y + b);
  facet(6, x - 1, y - 1, x + b, y + b, x + b, y1 - b, x - 1, y1 + 1);
  facet(-12, x1 + 1, y - 1, x1 + 1, y1 + 1, x1 - b, y1 - b, x1 - b, y + b);
  facet(-20, x - 1, y1 + 1, x + b, y1 - b, x1 - b, y1 - b, x1 + 1, y1 + 1);
  g.fillStyle = css(stone, -30, 1, 6);
  for (const [ax, ay, bx, by] of [
    [x, y, x + b, y + b],
    [x1, y, x1 - b, y + b],
    [x, y1, x + b, y1 - b],
    [x1, y1, x1 - b, y1 - b],
  ])
    line(g, ax, ay, bx, by, { w: 0.5, seed: ax + ay, taper: [0.1, 0.1], press: 0 });
  g.fillStyle = INK;
  line(g, x1 - b, y + b + 0.4, x1 - b, y1 - b, { w: 0.7, seed: 3, taper: [0.2, 0.1], press: 0.3 });
  line(g, x + b + 0.4, y1 - b, x1 - b, y1 - b, { w: 0.8, seed: 4, taper: [0.2, 0.1], press: 0.3 });
}
