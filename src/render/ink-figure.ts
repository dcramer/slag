import { css, type HSL, shift, toRgb } from '../core/color';
import { hash2 } from '../core/rng';
import type { CharacterDef } from '../gen/character';
import { type P, shadeOf, stroke } from './ink';

/**
 * The figure kit every runner is drawn with: the pen (a contour on an ink mass that's thin toward the
 * light), flat two-tone parts, a face that acts out the body's mood, rubber-hose arms, and the colors a
 * character is drawn in. The runner itself, and the frame every kind fills in, are in ink-character.ts.
 */

export interface RunnerPose {
  facing: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Seconds, for idle motion and the boil. */
  t: number;
  celebrate?: boolean;
  /** Portraits draw the same runner bigger. */
  scale?: number;
  /** A wall touched in the air: -1 left, 1 right. */
  wall?: number;
  /** Seconds since dying: only a rendered kind (`cast/sprites`) draws a body then, its death clip. */
  dead?: number;
}

/** Where to draw: the albedo layer, and the emissive one when there is one. */
export interface InkTarget {
  s: CanvasRenderingContext2D;
  g: CanvasRenderingContext2D | null;
  /** In the world pass: every rendered figure as drawn, so the cel pass can leave its light bands off them (`Figure`). */
  figures?: Figure[];
}

/** A figure's bitmap as it was drawn on the foreground layer: the image, the layer's transform, and its box under it. */
export interface Figure {
  cv: HTMLCanvasElement;
  m: DOMMatrix;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Walk and run speeds' midpoint (world px/s): above it the runner pumps its arms and leans in. */
export const RUN_POSE = 160;
/** World px of travel per radian of stride, so feet plant instead of skating. */
export const STRIDE = 4.2;

/**
 * Colors and a hand of its own, rolled once per character: the per-frame draw builds no strings. `fill`
 * is what the body is drawn in (the player's color for most kinds, the kind's own color for one whose
 * palette is its identity); `paint` is the kind's natural color; `player` is the player's color, the
 * loudest note on the character either way.
 */
export interface Look {
  /** The pen: a dark of the body's own color, never near-black, so the line belongs to what it outlines. */
  ink: string;
  /** Eyes, nostrils, a mustache: the darkest marks, a warm dark brown rather than black. */
  eye: string;
  fill: string;
  fillShade: string;
  paint: string;
  paintShade: string;
  paintHi: string;
  /** Multiplied over the lit body it gives the shadow tone, so the shadow falls across bands and panels too. */
  shadow: string;
  player: string;
  playerShade: string;
  playerHi: string;
  /** A dark of the player's color, for its own marks. */
  playerDark: string;
  accent: string;
  accentShade: string;
  lid: string;
  hand: string;
  handShade: string;
  /** Pen weight: light, and a little different per character, the way a hand varies. */
  weight: number;
  /** Arm length in world px. */
  arm: number;
  /** The body leans its top this far toward where it faces (world px over its height). */
  skew: number;
  /** Grounded idle: fidgety or calm. */
  fidget: number;
}

const looks = new WeakMap<CharacterDef, Look>();

/** `playerFill`: the body is drawn in the player's color (most kinds), or in the kind's own (`paint`). */
export function lookOf(c: CharacterDef, playerFill = true): Look {
  const have = looks.get(c);
  if (have) return have;
  const r = (k: number) => hash2(c.seed, k, 0x1a7);
  const base = playerFill ? c.body : c.paint;
  const look: Look = {
    ink: inkOf(base),
    eye: '#2a1f1a',
    fill: css(base),
    fillShade: css(base, -14, 1, 4),
    paint: css(c.paint),
    paintShade: css(c.paint, -14, 1, 4),
    paintHi: css(c.paint, 10, 1, -6),
    shadow: ratio(base, shift(base, -14, 6)),
    player: css(c.body),
    playerShade: css(c.body, -14, 1, 4),
    playerHi: css(c.body, 16, 1, -8),
    playerDark: css(c.body, -26, 1, -10),
    accent: css(c.accent),
    accentShade: css(c.accent, -14, 1, 4),
    lid: css(base, -8),
    hand: '#efe8dc',
    handShade: '#c4baab',
    weight: 0.55 + r(3) * 0.15,
    arm: 3.2 + r(4) * 1,
    skew: (r(5) - 0.35) * 1.6,
    fidget: r(7),
  };
  looks.set(c, look);
  return look;
}

/** A dark of its own hue: the line belongs to what it outlines, and reads lighter than black. */
export const inkOf = (c: HSL) => css({ h: c.h, s: Math.min(45, c.s * 0.7), l: Math.min(26, c.l * 0.4) });

/**
 * The color that, multiplied over `lit`, gives about `dark`: one flat shadow that darkens whatever it falls
 * on. No channel drops far below the mean, or a red stripe on a blue body would go black in the shade.
 */
export function ratio(lit: HSL, dark: HSL): string {
  const a = toRgb(lit);
  const b = toRgb(dark);
  const r = [0, 1, 2].map((i) => Math.min(1, b[i] / Math.max(a[i], 0.02)));
  const floor = ((r[0] + r[1] + r[2]) / 3) * 0.8;
  const ch = (i: number) => Math.round(255 * Math.max(floor, r[i]));
  return `rgb(${ch(0)} ${ch(1)} ${ch(2)})`;
}

export function path(s: CanvasRenderingContext2D, pts: readonly P[]) {
  s.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) s.lineTo(pts[i].x, pts[i].y);
    else s.moveTo(pts[i].x, pts[i].y);
  }
  s.closePath();
}

export function poly(s: CanvasRenderingContext2D, pts: readonly P[], fill: string) {
  s.fillStyle = fill;
  path(s, pts);
  s.fill();
}

/** A shape on a solid ink mass that's thin toward the light (upper left) and heavy away from it. */
export function inked(s: CanvasRenderingContext2D, pts: readonly P[], fill: string, ink: string, thin: number, thick: number) {
  const c = centroid(pts);
  mass(s, pts, ink, thin, thick, c.x, c.y);
  poly(s, pts, fill);
}

const mid: P = { x: 0, y: 0 };

function centroid(pts: readonly P[]): P {
  mid.x = 0;
  mid.y = 0;
  for (const p of pts) {
    mid.x += p.x;
    mid.y += p.y;
  }
  mid.x /= pts.length;
  mid.y /= pts.length;
  return mid;
}

/** +1 or -1: the sign that turns a tangent's (y, -x) into the outward side of this outline. */
function winding(pts: readonly P[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  return a < 0 ? -1 : 1;
}

const nrm: P = { x: 0, y: 0 };

/**
 * Which way point `i` of an outline faces, into `nrm`: out from (cx, cy), the direction a blob's ink grows. Where
 * the outline runs toward the middle instead of round it (a wedge cut to the centre: a mouth, a notch), that
 * direction lies along the edge, not across it, and the ink there slid along the edge and lit the wrong side; there
 * it turns to the edge's own outward normal. Everywhere the two nearly agree it stays exactly the radial one.
 */
function facing(pts: readonly P[], i: number, cx: number, cy: number, wind: number): P {
  const p = pts[i];
  const d = Math.hypot(p.x - cx, p.y - cy) || 1;
  const rx = (p.x - cx) / d;
  const ry = (p.y - cy) / d;
  const a = pts[(i + pts.length - 1) % pts.length];
  const b = pts[(i + 1) % pts.length];
  const t = Math.hypot(b.x - a.x, b.y - a.y);
  nrm.x = rx;
  nrm.y = ry;
  if (!t) return nrm;
  const ex = ((b.y - a.y) / t) * wind;
  const ey = (-(b.x - a.x) / t) * wind;
  const u = Math.max(0, Math.min(1, (rx * ex + ry * ey - 0.3) / 0.4));
  if (u === 1) return nrm;
  const w = u * u * (3 - 2 * u);
  const mx = rx * w + ex * (1 - w);
  const my = ry * w + ey * (1 - w);
  const m = Math.hypot(mx, my) || 1;
  nrm.x = mx / m;
  nrm.y = my / m;
  return nrm;
}

/** The solid ink under a shape: each point pushed out the way it faces (`facing`), further the more it faces away from the light. */
function mass(s: CanvasRenderingContext2D, pts: readonly P[], ink: string, thin: number, thick: number, cx: number, cy: number) {
  s.fillStyle = ink;
  s.beginPath();
  const wind = winding(pts);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const { x: nx, y: ny } = facing(pts, i, cx, cy, wind);
    const k = thin + (thick - thin) * shadeOf(nx, ny);
    if (i) s.lineTo(p.x + nx * k, p.y + ny * k);
    else s.moveTo(p.x + nx * k, p.y + ny * k);
  }
  s.closePath();
  s.fill();
}

const penBuf: P[] = [];

/**
 * The body's line: `inked`'s continuous mass, a little lighter, then the pen over it in three strokes
 * that swell where they face away from the light and taper where they meet. The joints are lifts: the
 * line thins there but never breaks, so the silhouette stays as bold and closed as a solid outline.
 * The first lift sits on the lit side, nearest upper left, where a pen would start.
 */
export function contour(s: CanvasRenderingContext2D, pts: readonly P[], fill: string, ink: string, k: number, seed: number, glass = false) {
  const n = pts.length;
  const { x: cx, y: cy } = centroid(pts);
  // Glass (a translucent fill) has no ink mass under it, or the mass would show through: the fill goes
  // first and the pen over it.
  if (glass) poly(s, pts, fill);
  else mass(s, pts, ink, MASS[0] * k, MASS[1] * k, cx, cy);
  let lead = 0;
  let best = -2;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(pts[i].x - cx, pts[i].y - cy) || 1;
    const lit = -((pts[i].x - cx) * 0.55 + (pts[i].y - cy) * 0.83) / d;
    if (lit > best) {
      best = lit;
      lead = i;
    }
  }
  const span = Math.ceil(n / 3);
  const wind = winding(pts);
  s.fillStyle = ink;
  for (let j = 0; j < 3; j++) {
    let mid = 0;
    let sh = 0;
    for (let i = 0; i <= span; i++) {
      const at = (lead + j * span + i) % n;
      const p = pts[at];
      const { x: nx, y: ny } = facing(pts, at, cx, cy, wind);
      const m = (MASS[0] + (MASS[1] - MASS[0]) * shadeOf(nx, ny)) * k;
      // On the mass's outer half: the stroke's inside is hidden under the fill drawn after it.
      const q = penBuf[i] ?? (penBuf[i] = { x: 0, y: 0 });
      q.x = p.x + nx * m * 0.4;
      q.y = p.y + ny * m * 0.4;
      if (i === span >> 1) {
        mid = m;
        sh = shadeOf(nx, ny);
      }
    }
    penBuf.length = span + 1;
    // At its widest the stroke stands this far past the mass; at its ends it sinks back into it.
    const over = (PEN[0] + (PEN[1] - PEN[0]) * sh) * k;
    stroke(s, penBuf, { w: 2 * (mid * 0.6 + over), seed: seed + j, taper: [0.2, 0.26], press: 0.3 });
  }
  if (!glass) poly(s, pts, fill);
}

/**
 * `toned` for a small oval (a hand, a shoe, a bulb), without the clip: the lit tone is the oval shrunk
 * and pulled up-left inside itself, which cuts the same sliver for a fraction of the cost.
 */
export function tonedOval(
  s: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  n: number,
  fill: string,
  shade: string,
  ink: string,
  thin: number,
  thick: number,
  d: number,
) {
  inked(s, oval(x, y, rx, ry, n), shade, ink, thin, thick);
  poly(s, oval(x - d * 0.5, y - d * 0.43, rx - d * 0.5, ry - d * 0.43, n), fill);
}

/** The body's ink mass (lit side, shadow side) and how far the pen swells past it, per unit of pen weight. */
const MASS = [0.85, 1.65];
const PEN = [0.25, 0.5];

/**
 * `inked`, with the body's light: the shape in its shadow tone and the lit tone pulled up-left over it,
 * so a hard sliver of shadow is left along the side away from the light. `d` is that sliver's width.
 */
export function toned(s: CanvasRenderingContext2D, pts: readonly P[], fill: string, shade: string, ink: string, thin: number, thick: number, d: number) {
  inked(s, pts, shade, ink, thin, thick);
  s.save();
  path(s, pts);
  s.clip();
  s.translate(-d, -d * 0.87);
  poly(s, pts, fill);
  s.restore();
}

export function oval(cx: number, cy: number, rx: number, ry: number, n = 12, rot = 0): P[] {
  const out: P[] = [];
  const c = Math.cos(rot);
  const sn0 = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push({ x: cx + x * c - y * sn0, y: cy + x * sn0 + y * c });
  }
  return out;
}

/** What the body is doing, read off its motion: the face and arms both act it out. */
export type Mood = 'idle' | 'walk' | 'run' | 'up' | 'fall' | 'cheer' | 'wall';

export function moodOf(p: RunnerPose): Mood {
  if (p.celebrate) return 'cheer';
  if (!p.grounded) {
    if (p.wall) return 'wall';
    return p.vy > 200 ? 'fall' : 'up';
  }
  const v = Math.abs(p.vx);
  return v > RUN_POSE ? 'run' : v > 10 ? 'walk' : 'idle';
}

/** Where each hand goes, relative to its shoulder, for side -1 (left) and 1 (right). */
export function hand(m: Mood, side: number, f: number, ph: number, t: number, L: number, wall: number): P {
  switch (m) {
    case 'idle':
      return { x: side * 2.3, y: L * 0.78 + Math.sin(t * 2.2 + side) * 0.25 };
    case 'walk': {
      const sw = Math.sin(ph) * side;
      return { x: side * 2 + f * sw * L * 0.6, y: L * 0.78 - Math.abs(sw) * 0.5 };
    }
    case 'run': {
      // Pumping: the hand on the facing side drives forward and up, the other trails behind.
      const sw = Math.sin(ph) * side;
      return { x: side * 1.2 + f * sw * L * 0.95, y: L * 0.35 - Math.max(0, sw) * L * 0.5 };
    }
    case 'up':
      return { x: side * L * 0.55, y: -L * 0.85 };
    case 'fall':
      return { x: side * L * 0.95 + Math.sin(t * 31 + side * 2) * 0.7, y: -L * 0.55 + Math.cos(t * 27 + side) * 0.9 };
    case 'cheer':
      return { x: side * L * 0.45 + Math.sin(t * 13 + side) * 0.8, y: -L * 1.05 };
    case 'wall':
      // A palm flat on the wall, the other arm out for balance.
      return side === wall ? { x: side * L * 0.7, y: -L * 0.75 } : { x: side * L * 0.85, y: L * 0.2 };
  }
}

export function arm(s: CanvasRenderingContext2D, lk: Look, sx: number, sy: number, h: P, side: number, k: number) {
  const hx = sx + h.x;
  const hy = sy + h.y;
  // A little elbow, bent outward, so the arm is a gesture and not a stick.
  const mx = (sx + hx) / 2 + side * 0.6;
  const my = (sy + hy) / 2 + 0.3;
  const pts = [
    { x: sx, y: sy },
    { x: mx, y: my },
    { x: hx, y: hy },
  ];
  // A rubber-hose arm: one ink line, thick at the shoulder, and a mitten that reads as a hand at any size.
  s.fillStyle = lk.ink;
  stroke(s, pts, { w: 2 * k, seed: 1, taper: [0, 0.7], press: 0 });
  tonedOval(s, hx, hy, 1.95, 1.75, 9, lk.hand, lk.handShade, lk.ink, 0.6 * k, 1 * k, 0.6);
}
