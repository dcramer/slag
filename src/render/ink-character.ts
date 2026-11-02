import { css, type HSL, shift, toRgb } from '../core/color';
import { clamp } from '../core/geom';
import { hash2 } from '../core/rng';
import type { CharacterDef } from '../gen/character';
import type { Rig } from './character';
import { line, type P, shadeOf, sn, stroke } from './ink';
import { castMode, drawCastAccessory, drawCastRunner } from './cast';
import { glowDot } from './kit';

/**
 * A runner, inked. Players watch these more than anything else, and in a race they're about 40 screen
 * px tall: hatching and wobble vanish at that size, so the drawing is all silhouette and big shapes. One
 * heavy ink mass in a dark of the body's own hue, one hard shadow shape, a bold pattern, mitten arms
 * that act out what the body is doing, and eyes and a mouth that mean it.
 *
 * Everything distinct comes from the character's seed, so the same runner draws the same in the world,
 * on a lobby card and in a HUD chip. Purely cosmetic: all runners share one hitbox.
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

/** Colors and a hand of its own, rolled once per character: the per-frame draw builds no strings. */
export interface Look {
  ink: string;
  shade: string;
  base: string;
  hi: string;
  belly: string;
  stripe: string;
  accent: string;
  accentDark: string;
  hand: string;
  shoe: string;
  lid: string;
  /** Multiplied over the lit body it gives `shade`, so the shadow falls across the pattern as well. */
  shadow: string;
  /** Shadow tones of the small parts, which get the same light as the body. */
  handShade: string;
  shoeShade: string;
  bellyShade: string;
  accentShade: string;
  /** The trailing ribbon: its fill, its shadow tone, and the scarf's knit band. */
  rib: string;
  ribShade: string;
  ribBand: string;
  /** Pen weight: some characters are drawn heavier than others. */
  weight: number;
  /** Arm length in world px. */
  arm: number;
  /** The body leans its top this far toward where it faces (world px over its height). */
  skew: number;
  /** Wider at the bottom (+) or the top (-). */
  taper: number;
  /** Grounded idle: fidgety or calm. */
  fidget: number;
}

const looks = new WeakMap<CharacterDef, Look>();

export function lookOf(c: CharacterDef): Look {
  const have = looks.get(c);
  if (have) return have;
  const r = (k: number) => hash2(c.seed, k, 0x1a7);
  const gloves = r(1) < 0.3;
  const boots = r(2) < 0.5;
  const tail = c.accessory === 'tail';
  const rib = tail ? c.body : c.accessoryColor;
  const look: Look = {
    ink: inkOf(c.body),
    shade: css(c.body, -20, 1, 8),
    base: css(c.body),
    hi: css(c.body, 26, 1, -8),
    belly: css(c.belly),
    stripe: css(c.accent, -6),
    accent: css(c.accent),
    accentDark: css(c.accent, -16),
    hand: gloves ? '#f4efe4' : css(c.body),
    shoe: boots ? css(c.accent, -12) : css(c.body, -c.body.l * 0.45, 1, 6),
    lid: css(c.body, -10),
    shadow: ratio(c.body, shift(c.body, -20, 8)),
    handShade: gloves ? '#c9bfae' : css(c.body, -20, 1, 8),
    shoeShade: boots ? css(c.accent, -26, 1, 4) : css(c.body, -c.body.l * 0.45 - 9, 1, 6),
    bellyShade: css(c.belly, -18, 1, 6),
    accentShade: css(c.accent, -20, 1, 4),
    rib: css(rib, tail ? 0 : -4),
    ribShade: css(rib, tail ? -20 : -22, 1, 8),
    ribBand: css(rib, 22, 1, -10),
    weight: 0.95 + r(3) * 0.4,
    arm: 3.4 + r(4) * 1.4,
    skew: (r(5) - 0.35) * 2.2,
    taper: (r(6) - 0.5) * 0.26,
    fidget: r(7),
  };
  looks.set(c, look);
  return look;
}

/** Dark of its own hue, never one black: the line belongs to what it outlines. */
export const inkOf = (c: HSL) => css({ h: c.h, s: Math.min(70, c.s), l: 11 });

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

const bodyCache = new WeakMap<CharacterDef, P[]>();

/** The body's outline as points, standing on y = 0, so it can be inked, shaded and boiled. */
function bodyPoints(c: CharacterDef): P[] {
  const cached = bodyCache.get(c);
  if (cached) return cached;
  const W = 14 * c.sw;
  const H = 15 * c.sh;
  const by = 0;
  const top = by - H;
  const pts: P[] = [];
  const bez = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const u = 1 - t;
      pts.push({
        x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      });
    }
  };
  const rounded = (r0: number, r1 = r0) => {
    const corners: [number, number, number, number][] = [
      [W / 2, top, -Math.PI / 2, Math.min(r0, W / 2, H / 2)],
      [W / 2, by, 0, Math.min(r1, W / 2, H / 2)],
      [-W / 2, by, Math.PI / 2, Math.min(r1, W / 2, H / 2)],
      [-W / 2, top, Math.PI, Math.min(r0, W / 2, H / 2)],
    ];
    for (const [x, y, a0, r] of corners) {
      const cx = x - Math.sign(x) * r;
      const cy = y === top ? top + r : by - r;
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
    }
  };
  switch (c.shape) {
    case 'round':
      // Squat, not a coin: a blob sits on its weight.
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
        const sag = Math.sin(a) > 0 ? 1.06 : 1;
        pts.push({ x: (Math.cos(a) * W * sag) / 2, y: by - H / 2 + (Math.sin(a) * H) / 2 });
      }
      break;
    case 'box':
      rounded(3, 2.2);
      break;
    case 'capsule':
      rounded(W / 2, W / 3);
      break;
    case 'wide':
      rounded(H / 2.1, H / 3.2);
      break;
    case 'drop':
      bez(0, top - 2.5, W * 0.18, top + H * 0.22, W * 0.56, by - H * 0.5, W * 0.52, by - H * 0.25);
      bez(W * 0.52, by - H * 0.25, W * 0.48, by + 0.3, -W * 0.48, by + 0.3, -W * 0.52, by - H * 0.25);
      bez(-W * 0.52, by - H * 0.25, -W * 0.56, by - H * 0.5, -W * 0.18, top + H * 0.22, 0, top - 2.5);
      break;
    case 'pear':
      bez(0, top, W * 0.38, top, W * 0.26, by - H * 0.58, W * 0.58, by - H * 0.24);
      bez(W * 0.58, by - H * 0.24, W * 0.7, by + 0.3, -W * 0.7, by + 0.3, -W * 0.58, by - H * 0.24);
      bez(-W * 0.58, by - H * 0.24, -W * 0.26, by - H * 0.58, -W * 0.38, top, 0, top);
      break;
  }
  bodyCache.set(c, pts);
  return pts;
}

/** Bold pattern: one big shape, because three small ones read as dirt at this size. */
function pattern(s: CanvasRenderingContext2D, c: CharacterDef, lk: Look, W: number, H: number, by: number) {
  switch (c.pattern) {
    case 'belly':
      poly(s, oval(0, by - H * 0.18, W * 0.34, H * 0.3), lk.belly);
      break;
    case 'stripes':
      s.fillStyle = lk.stripe;
      for (let i = 0; i < 2; i++)
        line(s, -W * 0.65, by - H * (0.2 + i * 0.26), W * 0.65, by - H * (0.25 + i * 0.26), { w: 2.6, seed: c.seed + i, taper: [0, 0], press: 0.1 });
      break;
    case 'spots':
      for (let i = 0; i < 3; i++) {
        const a = c.seed * 0.001 + i * 2.1;
        poly(s, oval(Math.cos(a) * W * 0.28, by - H * (0.36 + 0.14 * Math.sin(a * 1.7)), 1.9 + (i % 2) * 0.7, 1.7 + (i % 2) * 0.6, 8), lk.belly);
      }
      break;
    case 'gradient':
      // A hard dip line: the color change a gradient would only whisper.
      poly(
        s,
        [
          { x: -W * 0.65, y: by - H * 0.36 },
          { x: -W * 0.2, y: by - H * 0.31 },
          { x: W * 0.3, y: by - H * 0.39 },
          { x: W * 0.65, y: by - H * 0.34 },
          { x: W * 0.65, y: by + 3 },
          { x: -W * 0.65, y: by + 3 },
        ],
        lk.accentDark,
      );
      break;
    case 'none':
      break;
  }
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

export function eyes(
  rc: { g: CanvasRenderingContext2D | null },
  s: CanvasRenderingContext2D,
  c: CharacterDef,
  lk: Look,
  W: number,
  H: number,
  by: number,
  p: RunnerPose,
  m: Mood,
  wx: number,
  wy: number,
  sc: number,
) {
  const f = p.facing;
  const look = f * 1.7;
  const lookY = m === 'up' ? -0.7 : m === 'fall' ? 0.5 : 0;
  const ey = by - H * c.eyes.y;
  const n = c.eyes.count;
  const spread = W * c.eyes.spread;
  const xs = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread * 1.25, 0, spread * 1.25];
  const wide = m === 'fall' ? 1.18 : 1;
  const blink = m === 'idle' && Math.sin(p.t * 1.3 + c.seed * 7) > 0.985;
  const ink = lk.ink;
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
    line(s, -spread * 0.5 + look + scan, ey + 0.5, spread * 0.5 + look + scan + 1.6, ey - 0.6, { w: 1.6, seed: c.seed, taper: [0.15, 0.3], press: 0.2 });
    if (rc.g) glowDot(rc.g, wx + (look + scan) * sc, wy + ey * sc, 4 * sc, c.accent, 0.3);
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
      stroke(s, arc, { w: 1.8, seed: i, taper: [0.2, 0.2], press: 0.1 });
      continue;
    }
    if (blink) {
      s.fillStyle = ink;
      line(s, cx - r, ey + 0.4, cx + r, ey - 0.2, { w: 1.6, seed: i, taper: [0.15, 0.15], press: 0.1 });
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
        w: 1.9,
        seed: i,
        taper: [0.1, 0.25],
        press: 0.1,
      });
    }
    // Small, so a glowing eye stays an eye: a big glow prints as an opaque patch over the face.
    if (c.eyes.glow && rc.g) glowDot(rc.g, wx + cx * sc, wy + ey * sc, r * 1.5 * sc, c.eyes.iris, 0.22);
  }
}

export function mouth(s: CanvasRenderingContext2D, c: CharacterDef, lk: Look, W: number, H: number, by: number, p: RunnerPose, m: Mood) {
  const r = c.eyes.size * 1.24 * (c.eyes.count === 3 ? 1.2 : 1);
  const my = Math.min(by - 2.6, by - H * c.eyes.y + r + 2.9);
  const mx = clamp(p.facing * 1.5, -W / 2 + 4, W / 2 - 4);
  const kind = m === 'cheer' ? 'grin' : m === 'fall' ? 'yell' : m === 'run' && c.mouth === 'smile' ? 'grit' : c.mouth;
  const ink = lk.ink;
  const arc = (rr: number, a0: number, a1: number): P[] =>
    Array.from({ length: 9 }, (_, i) => ({ x: mx + Math.cos(a0 + ((a1 - a0) * i) / 8) * rr, y: my - 1.6 + Math.sin(a0 + ((a1 - a0) * i) / 8) * rr }));
  s.fillStyle = ink;
  switch (kind) {
    case 'smile':
      stroke(s, arc(3, 0.15 * Math.PI, 0.85 * Math.PI), { w: 1.6, seed: c.seed, taper: [0.22, 0.22], press: 0.15 });
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
      line(s, mx - 3.2, my, mx + 3.2, my - 0.3, { w: 1.6, seed: c.seed, taper: [0.18, 0.18], press: 0.1 });
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
      line(s, mx - 2.9, my + 0.2, mx + 2.9, my - 0.2, { w: 1.6, seed: c.seed, taper: [0.15, 0.15], press: 0.1 });
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

/** What sticks out of the top, drawn big: at a glance this is who it is. */
function topper(
  rc: { g: CanvasRenderingContext2D | null },
  s: CanvasRenderingContext2D,
  c: CharacterDef,
  lk: Look,
  W: number,
  H: number,
  by: number,
  p: RunnerPose,
  wx: number,
  wy: number,
  sc: number,
  front: boolean,
) {
  const top = by - H + (c.shape === 'drop' ? 1.2 : 0);
  const wob = Math.sin(p.t * 6) * 1.1 - clamp(p.vx / 110, -2, 2) - clamp(p.vy / 300, -1, 1) * 0.5;
  const k = lk.weight;
  const ink = lk.ink;
  const onTop = c.topper === 'cap' || c.topper === 'crown';
  if (onTop !== front) return;
  switch (c.topper) {
    case 'antenna': {
      const tip = { x: wob * 1.6, y: top - 7.5 };
      const pts: P[] = [{ x: 0, y: top + 2 }, { x: wob * 0.4, y: top - 3 }, tip];
      s.fillStyle = ink;
      stroke(s, pts, { w: 2.3 * k, seed: c.seed, taper: [0, 0.45], press: 0.1 });
      tonedOval(s, tip.x, tip.y - 0.8, 2.4, 2.4, 8, lk.accent, lk.accentShade, ink, 0.7, 1.1 * k, 0.7);
      if (rc.g) glowDot(rc.g, wx + tip.x * sc, wy + (tip.y - 0.8) * sc, 5 * sc, c.accent, 0.4);
      break;
    }
    case 'horns':
      for (const sg of [-1, 1]) {
        toned(
          s,
          [
            { x: sg * W * 0.12, y: top + 3.4 },
            { x: sg * W * 0.3, y: top - 1.2 },
            { x: sg * W * 0.52, y: top - 7.2 },
            { x: sg * W * 0.47, y: top + 1 },
            { x: sg * W * 0.42, y: top + 3.8 },
          ],
          lk.belly,
          lk.bellyShade,
          ink,
          0.8,
          1.2 * k,
          0.9,
        );
      }
      break;
    case 'ears':
      for (const sg of [-1, 1]) {
        const tilt = sg * 0.3 - wob * 0.04;
        const e = oval(sg * W * 0.3, top - 0.6, 3.2, 6.1, 10, tilt);
        toned(s, e, lk.base, lk.shade, ink, 0.8, 1.2 * k, 0.9);
        poly(s, oval(sg * W * 0.3, top + 0.2, 1.5, 3.4, 8, tilt), lk.belly);
      }
      break;
    case 'tuft':
      for (const a of [-0.7, 0, 0.7]) {
        s.fillStyle = ink;
        line(s, 0, top + 2, a * 8 + wob, top - 6.2, { w: 4.4 * k, seed: c.seed, taper: [0, 0.8], press: 0 });
      }
      for (const a of [-0.7, 0, 0.7]) {
        s.fillStyle = lk.accent;
        line(s, 0, top + 2, a * 8 + wob, top - 5.3, { w: 2.6, seed: c.seed, taper: [0, 0.8], press: 0 });
      }
      break;
    case 'mohawk': {
      const pts: P[] = [{ x: -5.2, y: top + 2.6 }];
      for (let i = -2; i <= 2; i++) {
        pts.push({ x: i * 2.1 - 0.5 + wob * 0.4, y: top - 6.6 + Math.abs(i) * 1.1 });
        pts.push({ x: i * 2.1 + 0.8, y: top - 2 + Math.abs(i) * 0.7 });
      }
      pts.push({ x: 5.2, y: top + 2.6 });
      toned(s, pts, lk.accent, lk.accentShade, ink, 0.7, 1.1 * k, 0.9);
      break;
    }
    case 'cap': {
      const f = p.facing;
      const dome = oval(0, top + 2.8, W * 0.44, 5.2, 14).filter((q) => q.y <= top + 2.9);
      toned(s, dome, lk.accent, lk.accentShade, ink, 0.8, 1.15 * k, 1);
      s.fillStyle = ink;
      line(s, f * W * 0.02, top + 3.1, f * W * 0.74, top + 3.6, { w: 3.2 * k, seed: 2, taper: [0, 0.1], press: 0 });
      s.fillStyle = lk.accentDark;
      line(s, f * W * 0.04, top + 3, f * W * 0.69, top + 3.45, { w: 1.6, seed: 2, taper: [0, 0.1], press: 0 });
      break;
    }
    case 'crown':
      toned(
        s,
        [
          { x: -W * 0.36, y: top + 2.6 },
          { x: -W * 0.42, y: top - 5 },
          { x: -W * 0.18, y: top - 1 },
          { x: 0, y: top - 6.6 },
          { x: W * 0.18, y: top - 1 },
          { x: W * 0.42, y: top - 5 },
          { x: W * 0.36, y: top + 2.6 },
        ],
        '#f2b705',
        '#c27c00',
        ink,
        0.8,
        1.15 * k,
        1,
      );
      poly(s, oval(0, top + 0.3, 1.4, 1.4, 7), '#e8304a');
      break;
    case 'leaf': {
      const l = oval(wob * 0.8 + 3, top - 3.4, 5.4, 2.6, 10, -0.55 + wob * 0.05);
      s.fillStyle = ink;
      line(s, 0, top + 1.8, wob * 0.8 + 1, top - 2, { w: 2.1 * k, seed: 1, taper: [0, 0], press: 0 });
      toned(s, l, 'hsl(118 56% 44%)', 'hsl(122 60% 31%)', ink, 0.7, 1.1 * k, 0.8);
      s.fillStyle = 'hsl(118 50% 30%)';
      line(s, wob * 0.8 + 0.4, top - 1.8, wob * 0.8 + 6, top - 5, { w: 0.7, seed: 3, taper: [0.1, 0.6], press: 0 });
      break;
    }
    case 'halo': {
      const ring = oval(wob * 0.3, top - 4.8, W * 0.4, 2, 16);
      s.fillStyle = ink;
      stroke(s, [...ring, ring[0], ring[1]], { w: 2.8, seed: 1, taper: [0, 0], press: 0 });
      s.fillStyle = '#ffe680';
      stroke(s, [...ring, ring[0], ring[1]], { w: 1.4, seed: 1, taper: [0, 0], press: 0 });
      if (rc.g) glowDot(rc.g, wx + wob * 0.3 * sc, wy + (top - 4.8) * sc, 8 * sc, { h: 50, s: 100, l: 70 }, 0.4);
      break;
    }
    case 'none':
      break;
  }
}

/** Draw a runner with feet centered at (x, y). */
export function drawInkRunner(rc: InkTarget, c: CharacterDef, x: number, y: number, p: RunnerPose) {
  // Character-direction prototypes (`?cast=a|b|c`, docs/CHARACTERS.md): debug only, players never see them.
  if (castMode() && drawCastRunner(rc, c, x, y, p)) return;
  const s = rc.s;
  const lk = lookOf(c);
  const W = 14 * c.sw;
  const H = 15 * c.sh;
  const f = p.facing < 0 ? -1 : 1;
  const m = moodOf(p);
  const sc = p.scale ?? 1;
  const k = lk.weight;
  const ph = x / (STRIDE * sc);
  let sx = 1;
  let sy = 1;
  if (!p.grounded) {
    const q = clamp(-p.vy / 900, -0.2, 0.25);
    sy = 1 + q;
    sx = 1 - q * 0.6;
  } else if (m === 'run') {
    sy = 0.96 + Math.abs(Math.cos(ph)) * 0.04;
    sx = 1.04;
  } else {
    const b = Math.sin(p.t * (3.2 + lk.fidget * 2) + c.seed) * 0.03;
    sy = 1 + b;
    sx = 1 - b;
  }
  // Footless runners hop along instead of walking.
  const boing = !c.feet && (m === 'walk' || m === 'run') ? Math.abs(Math.sin(ph)) * (m === 'run' ? 2.2 : 1.4) : 0;
  const hop = ((p.celebrate ? Math.abs(Math.sin(p.t * 9)) * 5 : 0) + boing) * sc;
  const lean =
    m === 'run'
      ? clamp(p.vx / 215, -1, 1) * 0.2
      : p.grounded
        ? clamp(p.vx / 140, -1, 1) * 0.08
        : m === 'wall'
          ? -(p.wall ?? 0) * 0.1
          : clamp(p.vx / 200, -1, 1) * 0.12;
  s.save();
  s.translate(x, y - hop);
  s.scale(sx * sc, sy * sc);
  s.rotate(lean);

  // The body stands on the floor by the weight of its own ink when it has no feet.
  const by = c.feet ? -3.2 : -2.3;
  const shoulderY = by - H * 0.38;
  const shoulderX = W * 0.46;
  const L = lk.arm;
  const wall = p.wall ?? 0;
  const backSide = -f;

  arm(s, lk, backSide * shoulderX, shoulderY, hand(m, backSide, f, ph, p.t, L, wall), backSide, k);

  if (c.feet) {
    for (const side of [-1, 1]) {
      let fx = side * W * 0.24;
      let fy = -2.2;
      if (m === 'walk' || m === 'run') {
        const sw = Math.sin(ph) * side;
        fx += f * sw * (m === 'run' ? 2.8 : 1.8);
        fy -= Math.max(0, Math.cos(ph) * side) * (m === 'run' ? 2 : 1.2);
      } else if (m === 'up' || m === 'wall') {
        fx = side * W * 0.17;
        fy = -3.2 + (side === f ? -0.8 : 0);
      } else if (m === 'fall') {
        fx = side * W * 0.33 + Math.sin(p.t * 25 + side) * 0.6;
        fy = -1.2;
      }
      tonedOval(s, fx + f * 1, fy, 3.2, 2, 10, lk.shoe, lk.shoeShade, lk.ink, 0.6, Math.min(1.05 * k, 1.2), 0.7);
    }
  }

  topper(rc, s, c, lk, W, H, by, p, x, y - hop, sc, false);

  // A slow boil on threes: the drawing is alive even when the character stands still.
  const boil = Math.floor(p.t * 8) % 3;
  const sd = c.seed & 0xffff;
  const src = bodyPoints(c);
  const pts: P[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const q = src[i];
    const u = -q.y / H;
    pts[i] = {
      x: q.x * (1 + lk.taper * (0.5 - u)) + f * lk.skew * u + sn(i * 0.45, boil * 3.1, sd) * 0.2,
      y: q.y + by + sn(i * 0.45 + 9, boil * 3.1, sd) * 0.2,
    };
  }
  contour(s, pts, lk.base, lk.ink, k, sd);
  s.save();
  path(s, pts);
  s.clip();
  pattern(s, c, lk, W, H, by);
  // One hard shadow shape: the body less itself pulled up-left, a crescent below and right. It goes on
  // after the pattern and multiplies, so a belly or stripe sits in the same light as the body.
  path(s, pts);
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (i) s.lineTo(q.x - W * 0.16, q.y - H * 0.13);
    else s.moveTo(q.x - W * 0.16, q.y - H * 0.13);
  }
  s.closePath();
  s.globalCompositeOperation = 'multiply';
  s.fillStyle = lk.shadow;
  s.fill('evenodd');
  s.globalCompositeOperation = 'source-over';
  s.fillStyle = lk.hi;
  line(s, -W * 0.36 + f * lk.skew * 0.7, by - H * 0.7, -W * 0.12 + f * lk.skew * 0.85, by - H * 0.87, { w: 2, seed: sd, taper: [0.22, 0.45], press: 0.1 });
  s.restore();

  topper(rc, s, c, lk, W, H, by, p, x, y - hop, sc, true);
  s.save();
  // The face rides the body's lean toward where it's going.
  s.translate(f * lk.skew * 0.55, 0);
  eyes(rc, s, c, lk, W, H, by, p, m, x, y - hop, sc);
  mouth(s, c, lk, W, H, by, p, m);
  s.restore();

  arm(s, lk, f * shoulderX, shoulderY, hand(m, f, f, ph, p.t, L, wall), f, k);
  s.restore();
}

/**
 * The trailing accessory, in world space behind the body: a ribbon on an ink ribbon that is thin on its
 * lit edge and heavy on its shadowed one, in the body's two tones, so it is drawn by the same hand.
 */
export function drawInkAccessory(s: CanvasRenderingContext2D, c: CharacterDef, rig: Rig) {
  if (c.accessory === 'none' || rig.rope.length < 2) return;
  if (castMode() && drawCastAccessory(s, c, rig)) return;
  const lk = lookOf(c);
  const pts = rig.rope;
  const n = pts.length;
  const cape = c.accessory === 'cape';
  const tail = c.accessory === 'tail';
  const w0 = cape ? 4.8 : tail ? 2.6 : 2.4;
  const w1 = cape ? 7 : tail ? 0.9 : 2;
  const side = (i: number): [number, number, number] => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / d, (b.y - a.y) / d, w0 + (w1 - w0) * (i / (n - 1))];
  };
  // `ink` widens each edge by how far it faces from the light; 0 is the ribbon itself.
  const ribbon = (ink: number) => {
    s.beginPath();
    for (let i = 0; i < n; i++) {
      const [nx, ny, w] = side(i);
      const h = w / 2 + (ink ? ink * (0.45 + 0.9 * shadeOf(-ny, nx)) : 0);
      if (i) s.lineTo(pts[i].x - ny * h, pts[i].y + nx * h);
      else s.moveTo(pts[i].x - ny * h, pts[i].y + nx * h);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny, w] = side(i);
      const h = w / 2 + (ink ? ink * (0.45 + 0.9 * shadeOf(ny, -nx)) : 0);
      s.lineTo(pts[i].x + ny * h, pts[i].y - nx * h);
    }
    s.closePath();
  };
  s.fillStyle = lk.ink;
  ribbon(1);
  s.fill();
  s.fillStyle = lk.ribShade;
  ribbon(0);
  s.fill();
  // Everything lit is drawn pulled up-left and cut to the ribbon, leaving its shadowed edge in shade.
  s.save();
  s.clip();
  const d = cape ? 1.1 : 0.7;
  s.translate(-d, -d * 0.87);
  s.fillStyle = lk.rib;
  ribbon(0);
  s.fill();
  if (c.accessory === 'scarf') {
    // Bands across the knit, flat and hard.
    s.fillStyle = lk.ribBand;
    for (let i = 1; i + 1 < n; i += 2) {
      const [ax, ay, aw] = side(i);
      const [bx, by, bw] = side(i + 1);
      s.beginPath();
      s.moveTo(pts[i].x - ay * aw * 0.5, pts[i].y + ax * aw * 0.5);
      s.lineTo(pts[i + 1].x - by * bw * 0.5, pts[i + 1].y + bx * bw * 0.5);
      s.lineTo(pts[i + 1].x + by * bw * 0.5, pts[i + 1].y - bx * bw * 0.5);
      s.lineTo(pts[i].x + ay * aw * 0.5, pts[i].y - ax * aw * 0.5);
      s.closePath();
      s.fill();
    }
  }
  if (cape) {
    // A fold down the cape's length, in its shadow tone.
    s.fillStyle = lk.ribShade;
    s.beginPath();
    for (let i = 1; i < n; i++) {
      const [nx, ny, w] = side(i);
      const pt = { x: pts[i].x + ny * w * 0.5, y: pts[i].y - nx * w * 0.5 };
      if (i === 1) s.moveTo(pt.x, pt.y);
      else s.lineTo(pt.x, pt.y);
    }
    for (let i = n - 1; i >= 1; i--) {
      const [nx, ny, w] = side(i);
      s.lineTo(pts[i].x + ny * w * 0.1, pts[i].y - nx * w * 0.1);
    }
    s.closePath();
    s.fill();
  }
  s.restore();
  if (tail) {
    // A spade, not a ball: a round tip on a ribbon reads as a third arm.
    const tip = pts[n - 1];
    const [dx, dy] = side(n - 1);
    const px = -dy;
    const py = dx;
    toned(
      s,
      [
        { x: tip.x - dx * 0.6 + px * 2.4, y: tip.y - dy * 0.6 + py * 2.4 },
        { x: tip.x + dx * 4.2, y: tip.y + dy * 4.2 },
        { x: tip.x - dx * 0.6 - px * 2.4, y: tip.y - dy * 0.6 - py * 2.4 },
        { x: tip.x + dx * 0.8, y: tip.y + dy * 0.8 },
      ],
      lk.accent,
      lk.accentShade,
      lk.ink,
      0.6,
      1,
      0.7,
    );
  }
}
