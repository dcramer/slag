import { css, type HSL, hsl3 } from '../core/color';
import { hash2 } from '../core/rng';
import { type P, shadeOf, sn, stroke } from './ink';

/**
 * The backdrop's pen: the same tapered line and flat tones as the play layer (docs/ART.md, World art),
 * quieter. A layer's weight comes from its depth, so the farthest ridge is a hairline and the nearest
 * one nearly a terrain contour; its ink is a dark of what it outlines, and the layer's haze, laid over
 * the whole bake, lightens it further. Everything here runs once per bake, never per frame.
 */

/** Pen width for a layer at parallax `depth`: a hairline far off, close to terrain weight up front. */
export const penW = (depth: number) => Math.max(0.45, Math.min(1.25, 0.42 + depth * 2.3));

/** A shape's ink: a deep, slightly richer dark of its own color, never one black. */
export function inkOf(c: HSL, k = 0.36): string {
  return css(hsl3(c.h, Math.min(70, c.s + 12), Math.max(2, c.l * k)));
}

export interface PenOpts {
  w: number;
  col: string;
  seed: number;
  /** Typical length of one stroke before the pen lifts, in world px. */
  run?: number;
  /** Chance a joint between strokes is left undrawn. */
  lift?: number;
  /** Thin-to-heavy spread by facing: 0 even, 1 full (thin toward the light). */
  facing?: number;
  /** Reference point inside a closed shape; open paths take their normal from the direction of travel. */
  inside?: P;
}

const piece: P[] = [];

/**
 * Pen along a path, many strokes and not one: it lifts every `run` px or so, some joints are left
 * undrawn, and each stroke swells and tapers, thin where its edge faces the light (upper left).
 * An open path is drawn with its outside on the left of travel: left to right along a crest.
 */
export function penPath(g: CanvasRenderingContext2D, pts: readonly P[], closed: boolean, o: PenOpts) {
  const n = pts.length;
  if (n < 2) return;
  const run = o.run ?? 34;
  const lift = o.lift ?? 0.3;
  const facing = o.facing ?? 0.8;
  g.fillStyle = o.col;
  const total = closed ? n + 1 : n;
  let i = 0;
  let k = 0;
  while (i < total - 1) {
    const want = run * (0.55 + 0.9 * hash2(k, 11, o.seed));
    piece.length = 0;
    let len = 0;
    let j = i;
    piece.push(pts[j % n]);
    while (j < total - 1 && len < want) {
      const a = pts[j % n];
      const b = pts[(j + 1) % n];
      len += Math.hypot(b.x - a.x, b.y - a.y);
      j++;
      piece.push(b);
    }
    if (piece.length >= 2 && hash2(k, 5, o.seed) >= lift * 0.4) {
      const a = piece[0];
      const b = piece[piece.length - 1];
      const m = piece[piece.length >> 1];
      const nx = o.inside ? m.x - o.inside.x : b.y - a.y;
      const ny = o.inside ? m.y - o.inside.y : -(b.x - a.x);
      const d = Math.hypot(nx, ny) || 1;
      const sh = shadeOf(nx / d, ny / d);
      const w = o.w * (1 - facing * 0.45 + facing * 0.85 * sh * sh);
      stroke(g, piece.slice(), { w, seed: o.seed + k * 7, taper: [0.16, 0.26], press: 0.4, wobble: Math.min(0.4, w * 0.3) });
    }
    // A lifted pen skips a little paper before the next stroke.
    const skip = hash2(k, 9, o.seed) < lift ? 1 : 0;
    i = Math.max(i + 1, j + skip);
    k++;
  }
}

/** Points along `f(x)` from x0 to x1, every `step` px: a ridge or a roof line to pen or fill under. */
export function along(x0: number, x1: number, step: number, f: (x: number) => number): P[] {
  const pts: P[] = [];
  for (let x = x0; x < x1; x += step) pts.push({ x, y: f(x) });
  pts.push({ x: x1, y: f(x1) });
  return pts;
}

/** The same points, last first: a crest walked the other way, or the far side of a closed band. */
export function backward(pts: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = pts.length - 1; i >= 0; i--) out.push(pts[i]);
  return out;
}

/**
 * Ground under a ridge: one flat tone, a second cut along a hand-drawn line below the crest, and the
 * pen along the crest. It stands in for a vertical gradient: the shade is a shape.
 */
export function ridgeGround(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  f: (x: number) => number,
  base: HSL,
  pen: number,
  seed: number,
  band = 14,
  shade = -5,
) {
  const top = along(-4, W + 4, 4, f);
  fillPts(g, [...top, { x: W + 4, y: H + 2 }, { x: -4, y: H + 2 }], css(base));
  if (band > 0) {
    const low = along(-4, W + 4, 6, (x) => f(x) + band * (0.7 + 0.6 * (0.5 + 0.5 * sn(x * 0.02, 1.3, seed))));
    fillPts(g, [...low, { x: W + 4, y: H + 2 }, { x: -4, y: H + 2 }], css(base, shade));
  }
  if (pen > 0) penPath(g, top, false, { w: pen, col: inkOf(base), seed, run: 40, lift: 0.3 });
  return top;
}

/** Points along a quadratic Bézier, `n` segments, without its start point when `skipFirst`. */
export function quad(out: P[], ax: number, ay: number, cx: number, cy: number, bx: number, by: number, n = 8, skipFirst = true) {
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by });
  }
  return out;
}

/** Points along a cubic Bézier, `n` segments, without its start point. */
export function cubic(out: P[], a: P, c1: P, c2: P, b: P, n = 10) {
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  return out;
}

export function tracePts(g: CanvasRenderingContext2D, pts: readonly P[]) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) g.lineTo(pts[i].x, pts[i].y);
    else g.moveTo(pts[i].x, pts[i].y);
  }
  g.closePath();
}

/** A filled polygon. */
export function fillPts(g: CanvasRenderingContext2D, pts: readonly P[], col: string) {
  g.fillStyle = col;
  tracePts(g, pts);
  g.fill();
}

function box(pts: readonly P[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

export interface ShapeOpts {
  /** Lightness shift of the shadow side; 0 for none. */
  shade?: number;
  /** Where across the shape the shadow side starts, 0..1 from the left. */
  cut?: number;
  /** Lift chance and stroke length for the pen. */
  lift?: number;
  run?: number;
  /** Only pen where y is above this (the foot that stands in the ground). */
  foot?: number;
}

/**
 * A backdrop shape: one flat tone, its shadow side cut as a slanted hard shape down the right, and the
 * pen round it (thin toward the light), stopping at `foot` where it stands in the ground.
 */
export function shape(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, pen: number, seed: number, o: ShapeOpts = {}) {
  fillPts(g, pts, css(base));
  const b = box(pts);
  const w = b.x1 - b.x0;
  if (o.shade && w > 3) {
    const cx = b.x0 + w * (o.cut ?? 0.66 + 0.1 * hash2(1, 2, seed));
    const lean = Math.min(6, w * 0.15);
    g.save();
    tracePts(g, pts);
    g.clip();
    g.fillStyle = css(base, o.shade);
    g.beginPath();
    g.moveTo(cx, b.y0 - 2);
    g.lineTo(b.x1 + 2, b.y0 - 2);
    g.lineTo(b.x1 + 2, b.y1 + 2);
    g.lineTo(cx - lean, b.y1 + 2);
    g.fill();
    g.restore();
  }
  if (pen > 0) {
    const inside = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
    const po = { w: pen, col: inkOf(base), seed, run: o.run ?? 26, lift: o.lift ?? 0.3, inside };
    if (o.foot === undefined) penPath(g, pts, true, po);
    else {
      // Pen the outline above the foot only, starting after a run that dips under it so the stroke is unbroken.
      const n = pts.length;
      let start = pts.findIndex((p, i) => p.y > o.foot! && pts[(i + 1) % n].y <= o.foot!);
      if (start < 0) start = 0;
      const run: P[] = [];
      for (let i = 1; i <= n; i++) {
        const p = pts[(start + i) % n];
        if (p.y > o.foot + 0.5) {
          if (run.length > 1) penPath(g, run, false, po);
          run.length = 0;
        } else run.push(p);
      }
      if (run.length > 1) penPath(g, run, false, po);
    }
  }
}

/**
 * A rectangle cut by hand: corners nicked a little, sides wandering a touch, so a backdrop building
 * never reads as a ruled box. Points run up the left, across the top and down the right.
 */
export function slabPts(x: number, top: number, w: number, bottom: number, seed: number, wander = 0.45): P[] {
  const pts: P[] = [];
  const h = bottom - top;
  const nick = Math.min(1.2, w * 0.1, h * 0.1);
  const side = (u: number, k: number) => sn(u * 0.09, k * 3.1, seed) * wander;
  const vstep = Math.max(5, h / 5);
  const hstep = Math.max(5, w / 4);
  for (let y = bottom; y > top + nick + 1; y -= vstep) pts.push({ x: x + side(y, 1), y });
  pts.push({ x: x + side(top, 1), y: top + nick });
  pts.push({ x: x + nick, y: top + side(x, 2) * 0.4 });
  for (let xx = x + hstep; xx < x + w - nick - 1; xx += hstep) pts.push({ x: xx, y: top + side(xx, 2) * 0.4 });
  pts.push({ x: x + w - nick, y: top + side(x + w, 2) * 0.4 });
  pts.push({ x: x + w + side(top, 3), y: top + nick });
  for (let y = top + vstep; y < bottom; y += vstep) pts.push({ x: x + w + side(y, 3), y });
  pts.push({ x: x + w, y: bottom });
  return pts;
}

/** How far anything that stands runs on below where it meets the ground (more than a ridge can fall across the widest building): the ground, drawn after it, hides the rest. */
export const SINK = 80;

/**
 * A building or a beam on a backdrop: a hand-cut slab with its shadow side, penned down to `foot`. It runs
 * `sink` px on below that, so on a slope, or with its layer's ground drawn lower, it still stands in the
 * ground and never floats; something hung in the air passes a small `sink`.
 */
export function slab(
  g: CanvasRenderingContext2D,
  x: number,
  top: number,
  w: number,
  foot: number,
  base: HSL,
  pen: number,
  seed: number,
  shade = -7,
  sink = SINK,
) {
  const pts = slabPts(x, top, w, foot + sink, seed);
  shape(g, pts, base, pen, seed, { shade, foot, run: 22 });
  return pts;
}

/** A slab's top cut into merlons: the outline of a crenellated wall or tower, for `shape`. */
export function crenPts(x: number, top: number, w: number, bottom: number, mw: number, mh: number, seed: number): P[] {
  const pts: P[] = [{ x, y: bottom }];
  let cx = x;
  let up = true;
  while (cx < x + w - 0.5) {
    const nx = Math.min(x + w, cx + mw);
    const yy = up ? top - mh + sn(cx * 0.3, 1, seed) * 0.3 : top;
    pts.push({ x: cx + 0.2, y: yy }, { x: nx - 0.2, y: yy });
    cx = nx;
    up = !up;
  }
  pts.push({ x: x + w, y: bottom });
  return pts;
}

export interface Puff {
  x: number;
  y: number;
  r: number;
}

/**
 * A crown of puffs (a tree, a bush, a hedge): its shadow tone, the lit puffs again smaller and pulled
 * up-left so the shade under them is scalloped, and the pen along the crest. `hang` turns it over, for
 * a canopy hanging from the top of the view, inked along its underside.
 */
export function puffs(g: CanvasRenderingContext2D, ps: readonly Puff[], shadeCol: HSL, litCol: HSL, pen: number, seed: number, hang = false) {
  if (!ps.length) return;
  const x0 = Math.min(...ps.map((p) => p.x - p.r));
  const x1 = Math.max(...ps.map((p) => p.x + p.r));
  const edge = (x: number) => {
    let y = hang ? -Infinity : Infinity;
    for (const p of ps) {
      const dx = x - p.x;
      if (Math.abs(dx) >= p.r) continue;
      const h = Math.sqrt(p.r * p.r - dx * dx);
      y = hang ? Math.max(y, p.y + h) : Math.min(y, p.y - h);
    }
    return y;
  };
  g.fillStyle = css(shadeCol);
  g.beginPath();
  for (const p of ps) {
    g.moveTo(p.x + p.r, p.y);
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  }
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = css(litCol);
  g.beginPath();
  for (const p of ps) {
    const r = p.r * 0.78;
    const cx = p.x - p.r * 0.14;
    const cy = p.y - p.r * 0.24;
    g.moveTo(cx + r, cy);
    g.arc(cx, cy, r, 0, Math.PI * 2);
  }
  g.fill();
  g.restore();
  if (pen > 0) {
    const step = Math.max(1, (x1 - x0) / 40);
    const crest = along(x0 + 0.3, x1 - 0.3, step, edge).filter((p) => Number.isFinite(p.y));
    penPath(g, hang ? backward(crest) : crest, false, { w: pen, col: inkOf(shadeCol, 0.45), seed, run: 18, lift: 0.3 });
  }
}

/** Sparse short strokes hanging down off an edge, in the shade: what hatching becomes far off. */
export function ticks(g: CanvasRenderingContext2D, pts: readonly P[], col: string, w: number, seed: number, every = 22, len = 5) {
  g.fillStyle = col;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    if (acc < every * (0.6 + 0.8 * hash2(i, 3, seed))) continue;
    acc = 0;
    const l = len * (0.6 + 0.6 * hash2(i, 4, seed));
    stroke(
      g,
      [
        { x: b.x + 0.4, y: b.y + 1.4 },
        { x: b.x + l * 0.25, y: b.y + 1.4 + l * 0.5 },
        { x: b.x + l * 0.4, y: b.y + 1.4 + l },
      ],
      { w, seed: seed + i, taper: [0.1, 0.6], press: 0.2 },
    );
  }
}

/** One short tapered mark in `col`: a band on a silo, a crevasse, a furrow's end. */
export function mark(g: CanvasRenderingContext2D, pts: readonly P[], col: string, w: number, seed: number) {
  g.fillStyle = col;
  stroke(g, pts, { w, seed, taper: [0.2, 0.3], press: 0.3 });
}
