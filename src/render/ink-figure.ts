import { css, type HSL, shift, toRgb } from '../core/color';
import { clamp } from '../core/geom';
import { hash2 } from '../core/rng';
import type { CharacterDef } from '../gen/character';
import { line, type P, shadeOf, stroke } from './ink';

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
}

/** Where to draw: the albedo layer, and the emissive one when there is one. */
export interface InkTarget {
  s: CanvasRenderingContext2D;
  g: CanvasRenderingContext2D | null;
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

/** The solid ink under a shape: each point pushed out from (cx, cy), further the more it faces away from the light. */
function mass(s: CanvasRenderingContext2D, pts: readonly P[], ink: string, thin: number, thick: number, cx: number, cy: number) {
  s.fillStyle = ink;
  s.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const d = Math.hypot(p.x - cx, p.y - cy) || 1;
    const nx = (p.x - cx) / d;
    const ny = (p.y - cy) / d;
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
export function contour(s: CanvasRenderingContext2D, pts: readonly P[], fill: string, ink: string, k: number, seed: number) {
  const n = pts.length;
  const { x: cx, y: cy } = centroid(pts);
  mass(s, pts, ink, MASS[0] * k, MASS[1] * k, cx, cy);
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
  s.fillStyle = ink;
  for (let j = 0; j < 3; j++) {
    let mid = 0;
    let sh = 0;
    for (let i = 0; i <= span; i++) {
      const p = pts[(lead + j * span + i) % n];
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      const nx = (p.x - cx) / d;
      const ny = (p.y - cy) / d;
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
  poly(s, pts, fill);
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

export function eyes(s: CanvasRenderingContext2D, c: CharacterDef, lk: Look, W: number, H: number, by: number, p: RunnerPose, m: Mood) {
  const f = p.facing;
  const look = f * 1.7;
  const lookY = m === 'up' ? -0.7 : m === 'fall' ? 0.5 : 0;
  const ey = by - H * c.eyes.y;
  const n = c.eyes.count;
  const spread = W * c.eyes.spread;
  const xs = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread * 1.25, 0, spread * 1.25];
  const wide = m === 'fall' ? 1.18 : 1;
  const blink = m === 'idle' && Math.sin(p.t * 1.3 + c.seed * 7) > 0.985;
  const ink = lk.eye;
  if (c.eyes.style === 'visor' && m !== 'cheer') {
    inked(
      s,
      [
        { x: -spread - 3.6 + look, y: ey - 2.4 },
        { x: spread + 3.6 + look, y: ey - 2.8 },
        { x: spread + 3.3 + look, y: ey + 2.5 },
        { x: -spread - 3.3 + look, y: ey + 2.8 },
      ],
      '#17161f',
      ink,
      0.5,
      0.9,
    );
    s.fillStyle = lk.accent;
    const scan = Math.sin(p.t * 3) * spread * 0.6;
    line(s, -spread * 0.5 + look + scan, ey + 0.5, spread * 0.5 + look + scan + 1.6, ey - 0.6, { w: 1.1, seed: c.seed, taper: [0.15, 0.3], press: 0.2 });
    return;
  }
  for (let i = 0; i < xs.length; i++) {
    const big = n === 3 && i === 1 ? 1.2 : 1;
    const r = c.eyes.size * 1.24 * big * wide;
    // Eyes may bulge past the body's edge a little, never fall off it.
    const cx = clamp(xs[i] + look, -W / 2 - 0.3 + r * 0.6, W / 2 + 0.3 - r * 0.6);
    if (m === 'cheer') {
      // Happy eyes: a fat upturned arc each.
      s.fillStyle = ink;
      const arc: P[] = [];
      for (let j = 0; j <= 6; j++) {
        const a = Math.PI * (1.1 + (j / 6) * 0.8);
        arc.push({ x: cx + Math.cos(a) * r * 0.95, y: ey + 0.8 + Math.sin(a) * r * 0.85 });
      }
      stroke(s, arc, { w: 1.2, seed: i, taper: [0.2, 0.2], press: 0.1 });
      continue;
    }
    if (blink) {
      s.fillStyle = ink;
      line(s, cx - r, ey + 0.4, cx + r, ey - 0.2, { w: 1.1, seed: i, taper: [0.15, 0.15], press: 0.1 });
      continue;
    }
    const px = cx + f * r * 0.32;
    const py = ey + lookY * r * 0.35;
    if (c.eyes.style === 'dot') {
      // No white at all: a solid ink eye with one glint reads furthest away.
      poly(s, oval(cx + f * 0.2, ey, r * 0.86, r * 1.08, 10), ink);
      poly(s, oval(cx + f * r * 0.28 - r * 0.12, ey - r * 0.42, r * 0.32, r * 0.32, 6), '#fff');
    } else {
      inked(s, oval(cx, ey, r, r * 1.1, 12), '#f6f1e6', ink, 0.45, 0.85);
      const pr = m === 'fall' ? 0.3 : 0.46;
      if (c.eyes.style === 'ring') poly(s, oval(px, py, r * 0.66, r * 0.7, 10), css(c.eyes.iris));
      poly(s, oval(px, py + 0.2, r * pr, r * (pr + 0.05), 8), ink);
      poly(s, oval(px - r * 0.2, py - r * 0.28, r * 0.17, r * 0.17, 6), '#fff');
      if (c.eyes.style === 'sleepy' && m !== 'fall') {
        // A heavy lid, cut straight across: it only flies open when something goes wrong.
        poly(
          s,
          [
            { x: cx - r - 0.9, y: ey - r - 1.2 },
            { x: cx + r + 0.9, y: ey - r - 1.2 },
            { x: cx + r + 0.9, y: ey - 0.2 },
            { x: cx - r - 0.9, y: ey + 0.3 },
          ],
          lk.lid,
        );
        s.fillStyle = ink;
        line(s, cx - r - 0.9, ey + 0.3, cx + r + 0.9, ey - 0.2, { w: 1.5, seed: i, taper: [0.1, 0.1], press: 0.1 });
      }
    }
    // Brows: angry eyes always have them, and anyone gets them when they mean business.
    if (c.eyes.style === 'angry' || m === 'run' || m === 'wall') {
      const inner = n === 1 ? f : xs[i] < 0 ? 1 : xs[i] > 0 ? -1 : f;
      const lift = c.eyes.style === 'angry' ? 1 : 0.7;
      s.fillStyle = ink;
      line(s, cx - r * 1.2, ey - r * (inner > 0 ? 1.0 + 0.5 * lift : 1.0) - 0.4, cx + r * 1.2, ey - r * (inner > 0 ? 1.0 : 1.0 + 0.5 * lift) - 0.4, {
        w: 1.3,
        seed: i,
        taper: [0.1, 0.25],
        press: 0.1,
      });
    }
  }
}

export function mouth(s: CanvasRenderingContext2D, c: CharacterDef, lk: Look, W: number, H: number, by: number, p: RunnerPose, m: Mood) {
  const r = c.eyes.size * 1.24 * (c.eyes.count === 3 ? 1.2 : 1);
  const my = Math.min(by - 2.6, by - H * c.eyes.y + r + 2.9);
  const mx = clamp(p.facing * 1.5, -W / 2 + 4, W / 2 - 4);
  const kind = m === 'cheer' ? 'grin' : m === 'fall' ? 'yell' : m === 'run' && c.mouth === 'smile' ? 'grit' : c.mouth;
  const ink = lk.eye;
  const arc = (rr: number, a0: number, a1: number): P[] =>
    Array.from({ length: 9 }, (_, i) => ({ x: mx + Math.cos(a0 + ((a1 - a0) * i) / 8) * rr, y: my - 1.6 + Math.sin(a0 + ((a1 - a0) * i) / 8) * rr }));
  s.fillStyle = ink;
  switch (kind) {
    case 'smile':
      stroke(s, arc(3, 0.15 * Math.PI, 0.85 * Math.PI), { w: 1.1, seed: c.seed, taper: [0.22, 0.22], press: 0.15 });
      break;
    case 'grin':
      poly(s, [{ x: mx - 3.7, y: my - 1.5 }, { x: mx + 3.7, y: my - 1.5 }, ...arc(3.7, 0.05 * Math.PI, 0.95 * Math.PI)], ink);
      poly(s, oval(mx, my + 1.1, 1.9, 0.95, 8), '#e8566b');
      break;
    case 'yell':
      poly(s, oval(mx, my, 2.2, 2.7, 10), ink);
      poly(s, oval(mx, my + 1.3, 1.3, 0.8, 8), '#e8566b');
      break;
    case 'grit':
      poly(
        s,
        [
          { x: mx - 3.2, y: my - 1.2 },
          { x: mx + 3.2, y: my - 1.5 },
          { x: mx + 3, y: my + 1.2 },
          { x: mx - 3, y: my + 1.4 },
        ],
        ink,
      );
      s.fillStyle = '#fff';
      s.fillRect(mx - 2.4, my - 0.6, 4.8, 1.1);
      break;
    case 'fang':
      line(s, mx - 3.2, my, mx + 3.2, my - 0.3, { w: 1.1, seed: c.seed, taper: [0.18, 0.18], press: 0.1 });
      poly(
        s,
        [
          { x: mx + p.facing * 0.3, y: my - 0.1 },
          { x: mx + p.facing * 1.5, y: my + 2.9 },
          { x: mx + p.facing * 2.7, y: my - 0.2 },
        ],
        '#fff',
      );
      break;
    case 'o':
      poly(s, oval(mx, my, 1.9, 2.3, 9), ink);
      break;
    case 'flat':
      line(s, mx - 2.9, my + 0.2, mx + 2.9, my - 0.2, { w: 1.1, seed: c.seed, taper: [0.15, 0.15], press: 0.1 });
      break;
    case 'teeth':
      poly(
        s,
        [
          { x: mx - 3.7, y: my - 1.7 },
          { x: mx + 3.7, y: my - 1.7 },
          { x: mx + 3.3, y: my + 2 },
          { x: mx - 3.3, y: my + 2 },
        ],
        ink,
      );
      s.fillStyle = '#fff';
      s.fillRect(mx - 3, my - 1.6, 2.4, 1.8);
      s.fillRect(mx + 0.6, my - 1.6, 2.4, 1.8);
      break;
    case 'none':
      break;
  }
  if (c.mouth !== 'none' || m === 'cheer') {
    // Blush: two flat dabs, the one soft note on a hard-inked face.
    for (const side of [-1, 1]) poly(s, oval(mx + side * W * 0.32, my - 1.6, 1.7, 0.95, 8), 'rgba(255,96,128,0.42)');
  }
}
