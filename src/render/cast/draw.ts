import { css, type HSL, shift } from '../../core/color';
import { clamp } from '../../core/geom';
import { hash2 } from '../../core/rng';
import type { CharacterDef } from '../../gen/character';
import type { Rig } from '../character';
import { line, type P, shadeOf, sn, stroke } from '../ink';
import {
  arm,
  contour,
  eyes,
  hand,
  type InkTarget,
  inked,
  inkOf,
  type Look,
  lookOf,
  type Mood,
  moodOf,
  mouth,
  oval,
  path,
  poly,
  ratio,
  type RunnerPose,
  STRIDE,
  toned,
  tonedOval,
} from '../ink-character';

/**
 * The prototype runner: `drawInkRunner`'s body, pose and pen, with every place a direction wants to
 * differ opened as a hook. One `Art` per kind fills the hooks; the frame (squash, lean, stride, arms,
 * face, the boil, the one hard shadow) is shared, so all three directions animate the same and keep
 * the same footprint around the one hitbox.
 */

/** Everything a hook needs about this draw. Body space: feet at y = 0, body bottom at `by`, top at `top`. */
export interface D {
  s: CanvasRenderingContext2D;
  g: CanvasRenderingContext2D | null;
  c: CharacterDef;
  lk: Look;
  pal: Pal;
  W: number;
  H: number;
  by: number;
  top: number;
  /** Facing: -1 or 1. */
  f: number;
  m: Mood;
  p: RunnerPose;
  t: number;
  /** A small sway (world px) driven by speed and time, for things that hang or bob. */
  wob: number;
  /** Pen weight. */
  k: number;
  v: readonly number[];
  /** Stride phase. */
  ph: number;
  /** World position and scale of the body's origin, for emissive glows. */
  wx: number;
  wy: number;
  sc: number;
  sd: number;
}

export interface Pal {
  base: string;
  shade: string;
  hi: string;
  /** A dark of the body's hue for marks: stripes, spots, masks. */
  dark: string;
  darkShade: string;
  /** A pale of the body's hue for bellies, muzzles and light patches. */
  light: string;
  lightShade: string;
  ink: string;
  acc: string;
  accShade: string;
  /** Multiplied over the lit body for the hard shadow. */
  shadow: string;
  hand: string;
  handShade: string;
  foot: string;
  footShade: string;
}

export type Feet = 'shoe' | 'paw' | 'web' | 'peg' | 'none' | 'spring';
export type Arms = 'mitten' | 'paw' | 'flipper' | 'claw' | 'none';

export interface Art {
  /** Body multipliers around the shared 14×15 envelope. Kept inside the range today's blobs use. */
  size?: (v: readonly number[]) => [number, number];
  /** The body outline, standing on y = 0, top at -H. */
  shape: (W: number, H: number, v: readonly number[]) => P[];
  feet?: Feet | ((v: readonly number[]) => Feet);
  arms?: Arms;
  /** The trailing ribbon this kind wants from the renderer's rig, and how to draw it if not the default. */
  rope?: {
    kind: 'tail' | 'scarf' | 'cape' | 'none';
    len: number;
    draw?: (s: CanvasRenderingContext2D, pts: readonly P[], d: Pick<D, 'pal' | 'k' | 'v' | 'c'>) => void;
  };
  /** Colors: the body is always the player's color, so the HUD still matches; marks may differ. */
  pal?: (c: CharacterDef, v: readonly number[], p: Pal) => Partial<Pal>;
  /** Face overrides on the character's rolled one (eye style, mouth). */
  face?: (c: CharacterDef, v: readonly number[]) => { eyes?: Partial<CharacterDef['eyes']>; mouth?: CharacterDef['mouth'] };
  /** Behind the body (wings, shells, tails that don't swing). */
  back?: (d: D) => void;
  /** Inside the body, before the shadow: the print. */
  print?: (d: D) => void;
  /** Inside the body, after the shadow: things the light doesn't reach the same way (glints, seams). */
  over?: (d: D) => void;
  /** On the body, before the face (ears, horns, rivets, a key). */
  front?: (d: D) => void;
  /** Over the face (beaks, snouts, a visor). */
  snout?: (d: D) => void;
  /** Footless kinds hop; some never hop even without feet (a jelly glides on its fringe). */
  hop?: boolean;
}

const pals = new Map<string, Pal>();

export function palOf(c: CharacterDef, art: Art, v: readonly number[], key: string): Pal {
  const have = pals.get(key);
  if (have) return have;
  const lk = lookOf(c);
  const b = c.body;
  const dark: HSL = { h: b.h + 8, s: Math.min(70, b.s), l: 19 };
  const light: HSL = { h: b.h + 10, s: Math.min(55, b.s * 0.5), l: 86 };
  const base: Pal = {
    base: lk.base,
    shade: lk.shade,
    hi: lk.hi,
    dark: css(dark),
    darkShade: css(dark, -6),
    light: css(light),
    lightShade: css(light, -16, 1, 6),
    ink: lk.ink,
    acc: lk.accent,
    accShade: lk.accentShade,
    shadow: lk.shadow,
    hand: lk.hand,
    handShade: lk.handShade,
    foot: lk.shoe,
    footShade: lk.shoeShade,
  };
  const pal = { ...base, ...art.pal?.(c, v, base) };
  pals.set(key, pal);
  return pal;
}

/** Shadow color for a fill, for kinds that repaint the body in another color. */
export const shadowFor = (lit: HSL) => ratio(lit, shift(lit, -20, 8));

// ------------------------------------------------------------------ shapes

/**
 * A superellipse body: `n` 2 is an oval, 4 a soft box. `top`/`bot` scale the upper and lower half's
 * width, `sag` drops the belly. Points start at the top and run clockwise, bottom at y = 0.
 */
export function sup(W: number, H: number, n = 2.4, top = 1, bot = 1, sag = 0, steps = 30): P[] {
  const pts: P[] = [];
  const e = 2 / n;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** e;
    const y = Math.sign(s) * Math.abs(s) ** e;
    const hw = (W / 2) * (y < 0 ? top + (1 - top) * (1 + y) : bot + (1 - bot) * (1 - y)) * (y > 0 ? 1 + sag * (1 - y) * y * 2 : 1);
    pts.push({ x: x * hw, y: -H / 2 + (y * H) / 2 });
  }
  return pts;
}

/** A dome: round on top, flat bottom with soft corners (shells, caps, bells). */
export function dome(W: number, H: number, corner = 2.4, flare = 1): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI;
    const w = (W / 2) * (1 + (flare - 1) * (1 - Math.abs(Math.sin(a))) ** 2);
    pts.push({ x: Math.cos(a) * w, y: -corner + Math.sin(a) * (H - corner) });
  }
  const r = corner;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push({ x: (W / 2) * flare - r + Math.cos(a) * r, y: -r + Math.sin(a) * r });
  }
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push({ x: (-W / 2) * flare + r + Math.cos(a) * r, y: -r + Math.sin(a) * r });
  }
  return pts;
}

// ------------------------------------------------------------------ kit for the arts

export { inked, line, oval, path, poly, stroke, toned, tonedOval };

/** A bold ink line in the current pen: the kit's one-liner for marks. */
export function mark(s: CanvasRenderingContext2D, color: string, pts: readonly P[], w: number, seed: number, taper: [number, number] = [0.2, 0.4]) {
  s.fillStyle = color;
  stroke(s, pts, { w, seed, taper, press: 0.15 });
}

/** A filled hand-cut blob of `r` around (x, y), keyed to `seed`: spots, patches, rosettes. */
export function spot(s: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, seed: number, fill: string, lump = 0.22, rot = 0) {
  const n = 9;
  const pts: P[] = [];
  const c = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (hash2(seed, i, 77) - 0.5) * 2 * lump;
    const px = Math.cos(a) * rx * k;
    const py = Math.sin(a) * ry * k;
    pts.push({ x: x + px * c - py * sr, y: y + px * sr + py * c });
  }
  poly(s, pts, fill);
}

/** A pointed ear or horn standing on the body's top: base at (x, top), leaning `lean`. */
export function ear(d: D, x: number, w: number, h: number, lean: number, fill: string, shade: string, inner?: string) {
  const { s, top } = d;
  const pts: P[] = [
    { x: x - w / 2, y: top + 3 },
    { x: x + lean - w * 0.08, y: top - h },
    { x: x + lean + w * 0.12, y: top - h + 0.6 },
    { x: x + w / 2, y: top + 3 },
  ];
  toned(s, pts, fill, shade, d.pal.ink, 0.7, 1.15 * d.k, 0.8);
  if (inner)
    poly(
      s,
      [
        { x: x - w * 0.22, y: top + 1.5 },
        { x: x + lean * 0.8, y: top - h * 0.65 },
        { x: x + w * 0.22, y: top + 1.5 },
      ],
      inner,
    );
}

/** A stalk with a bulb: antennae, eye stalks. */
export function stalk(d: D, x0: number, y0: number, x1: number, y1: number, r: number, fill: string, shade: string) {
  d.s.fillStyle = d.pal.ink;
  stroke(
    d.s,
    [
      { x: x0, y: y0 },
      { x: (x0 + x1) / 2 + d.wob * 0.3, y: (y0 + y1) / 2 },
      { x: x1, y: y1 },
    ],
    { w: 1.7 * d.k, seed: d.sd + x0, taper: [0, 0.3], press: 0.1 },
  );
  if (r > 0) tonedOval(d.s, x1, y1, r, r, 8, fill, shade, d.pal.ink, 0.6, 1 * d.k, 0.6);
}

/** A ribbon tail along the rig's rope, fat to thin, toned like the body: shared by every tailed kind. */
export function ribbon(s: CanvasRenderingContext2D, pts: readonly P[], w0: number, w1: number, fill: string, shade: string, ink: string) {
  const n = pts.length;
  const side = (i: number): [number, number, number] => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dd = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / dd, (b.y - a.y) / dd, w0 + (w1 - w0) * (i / (n - 1))];
  };
  const shape = (ink: number) => {
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
  s.fillStyle = ink;
  shape(1);
  s.fill();
  s.fillStyle = shade;
  shape(0);
  s.fill();
  s.save();
  s.clip();
  s.translate(-0.7, -0.6);
  s.fillStyle = fill;
  shape(0);
  s.fill();
  s.restore();
}

// ------------------------------------------------------------------ the frame

const shapes = new Map<string, P[]>();
const faces = new Map<string, CharacterDef>();

function faceDef(c: CharacterDef, art: Art, v: readonly number[], key: string): CharacterDef {
  const have = faces.get(key);
  if (have) return have;
  const o = art.face?.(c, v);
  const fc = o ? { ...c, eyes: { ...c.eyes, ...o.eyes }, mouth: o.mouth ?? c.mouth } : { ...c, eyes: { ...c.eyes } };
  // A visor hides the face, and an animal's face is half its read.
  if (key.startsWith('b:') && fc.eyes.style === 'visor') fc.eyes.style = 'ring';
  faces.set(key, fc);
  return fc;
}

/** Hands that aren't mittens: the same rubber-hose arm with a different end. */
function limb(d: D, kind: Arms, sx: number, sy: number, h: P, side: number) {
  const { s, pal, k } = d;
  if (kind === 'none') return;
  if (kind === 'mitten' || kind === 'paw') {
    const lk2 = kind === 'paw' ? { ...d.lk, ink: pal.ink, hand: pal.hand, handShade: pal.handShade } : { ...d.lk, ink: pal.ink };
    arm(s, lk2, sx, sy, h, side, k);
    return;
  }
  const hx = sx + h.x;
  const hy = sy + h.y;
  if (kind === 'flipper') {
    // A blade from the shoulder: wings and flippers flap instead of reaching.
    const dx = hx - sx;
    const dy = hy - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    toned(
      s,
      [
        { x: sx + nx * 1.8, y: sy + ny * 1.8 },
        { x: hx + dx * 0.15 + nx * 0.6, y: hy + dy * 0.15 + ny * 0.6 },
        { x: hx + dx * 0.25, y: hy + dy * 0.25 },
        { x: sx - nx * 1.8, y: sy - ny * 1.8 },
      ],
      pal.hand,
      pal.handShade,
      pal.ink,
      0.6,
      1 * k,
      0.6,
    );
    return;
  }
  // claw: an arm and a pincer, open when the body is busy.
  s.fillStyle = pal.ink;
  stroke(
    s,
    [
      { x: sx, y: sy },
      { x: (sx + hx) / 2 + side * 0.6, y: (sy + hy) / 2 + 0.3 },
      { x: hx, y: hy },
    ],
    { w: 2 * k, seed: 1, taper: [0, 0.6], press: 0 },
  );
  const open = d.m === 'idle' ? 0.25 + Math.sin(d.t * 3 + side) * 0.15 : 0.6;
  const a = Math.atan2(hy - sy, hx - sx);
  for (const j of [-1, 1]) {
    const aa = a + j * open;
    toned(
      s,
      [
        { x: hx - Math.cos(a) * 0.8 + Math.cos(a + Math.PI / 2) * 2.2, y: hy - Math.sin(a) * 0.8 + Math.sin(a + Math.PI / 2) * 2.2 },
        { x: hx + Math.cos(aa) * 4.8, y: hy + Math.sin(aa) * 4.8 },
        { x: hx - Math.cos(a) * 0.8 - Math.cos(a + Math.PI / 2) * 2.2, y: hy - Math.sin(a) * 0.8 - Math.sin(a + Math.PI / 2) * 2.2 },
      ],
      pal.hand,
      pal.handShade,
      pal.ink,
      0.55,
      0.95 * k,
      0.5,
    );
  }
}

function feetOf(d: D, feet: Feet, sx: number) {
  const { s, pal, m, f, ph, p, W, k } = d;
  if (feet === 'none') return;
  if (feet === 'spring') {
    // A coil from the floor to the body: the toy bounces along on it.
    const lift = -d.by;
    s.fillStyle = pal.ink;
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) pts.push({ x: (i % 2 ? 2.2 : -2.2) * (0.6 + 0.4 * sx), y: -(i / 8) * lift });
    stroke(s, pts, { w: 1.6 * k, seed: 3, taper: [0, 0], press: 0 });
    s.fillStyle = '#c9c1b4';
    stroke(s, pts, { w: 0.7, seed: 3, taper: [0, 0], press: 0 });
    tonedOval(s, 0, -0.6, 3, 1.1, 8, pal.foot, pal.footShade, pal.ink, 0.5, 0.9 * k, 0.4);
    return;
  }
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
    if (feet === 'shoe') tonedOval(s, fx + f, fy, 3.2, 2, 10, pal.foot, pal.footShade, pal.ink, 0.6, Math.min(1.05 * k, 1.2), 0.7);
    else if (feet === 'paw') tonedOval(s, fx + f * 0.6, fy + 0.3, 2.5, 1.7, 9, pal.foot, pal.footShade, pal.ink, 0.55, 1 * k, 0.6);
    else if (feet === 'web')
      toned(
        s,
        [
          { x: fx - f * 0.6, y: fy - 1.4 },
          { x: fx + f * 3.6, y: fy + 0.9 },
          { x: fx + f * 2.2, y: fy + 1.6 },
          { x: fx + f * 0.8, y: fy + 1 },
          { x: fx - f * 1.4, y: fy + 1.5 },
        ],
        pal.foot,
        pal.footShade,
        pal.ink,
        0.5,
        0.9 * k,
        0.5,
      );
    else {
      // peg: a cast stub leg and a flat iron foot, the way a tin toy stands.
      s.fillStyle = pal.ink;
      line(s, fx, fy - 2.4, fx, fy, { w: 2.2 * k, seed: side, taper: [0, 0], press: 0 });
      inked(
        s,
        [
          { x: fx - 1.8, y: fy - 0.6 },
          { x: fx + f * 3, y: fy - 0.7 },
          { x: fx + f * 3, y: fy + 1.2 },
          { x: fx - 1.8, y: fy + 1.2 },
        ],
        pal.foot,
        pal.ink,
        0.5,
        0.9 * k,
      );
    }
  }
}

/** Draw a prototype runner, feet centered at (x, y). */
export function drawCast(rc: InkTarget, c: CharacterDef, x: number, y: number, p: RunnerPose, art: Art, v: readonly number[], key: string) {
  const s = rc.s;
  const lk = lookOf(c);
  const fc = faceDef(c, art, v, key);
  const pal = palOf(c, art, v, key);
  const [sw, sh] = art.size?.(v) ?? [1, 1];
  const W = 14 * sw;
  const H = 15 * sh;
  const f = p.facing < 0 ? -1 : 1;
  const m = moodOf(p);
  const sc = p.scale ?? 1;
  const k = lk.weight;
  const ph = x / (STRIDE * sc);
  const feet = typeof art.feet === 'function' ? art.feet(v) : (art.feet ?? 'shoe');
  const hops = feet === 'none' || feet === 'spring' ? (art.hop ?? true) : false;
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
  const boing = hops && (m === 'walk' || m === 'run') ? Math.abs(Math.sin(ph)) * (m === 'run' ? 2.2 : 1.4) : 0;
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

  const by = feet === 'shoe' || feet === 'peg' ? -3.2 : feet === 'paw' || feet === 'web' ? -2.8 : feet === 'spring' ? -6 : -2.3;
  const top = by - H;
  const wob = Math.sin(p.t * 6) * 1.1 - clamp(p.vx / 110, -2, 2) - clamp(p.vy / 300, -1, 1) * 0.5;
  const sd = c.seed & 0xffff;
  const d: D = { s, g: rc.g, c: fc, lk, pal, W, H, by, top, f, m, p, t: p.t, wob, k, v, ph, wx: x, wy: y - hop, sc, sd };
  const shoulderY = by - H * 0.38;
  const shoulderX = W * 0.46;
  const L = lk.arm;
  const wall = p.wall ?? 0;
  const backSide = -f;
  const arms = art.arms ?? 'mitten';

  limb(d, arms, backSide * shoulderX, shoulderY, hand(m, backSide, f, ph, p.t, L, wall), backSide);
  feetOf(d, feet, sx);
  art.back?.(d);

  const boil = Math.floor(p.t * 8) % 3;
  const shapeKey = `${key}:${W.toFixed(2)}:${H.toFixed(2)}`;
  let src = shapes.get(shapeKey);
  if (!src) {
    src = art.shape(W, H, v);
    shapes.set(shapeKey, src);
  }
  const pts: P[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const q = src[i];
    const u = -q.y / H;
    pts[i] = {
      x: q.x * (1 + lk.taper * 0.5 * (0.5 - u)) + f * lk.skew * u + sn(i * 0.45, boil * 3.1, sd) * 0.2,
      y: q.y + by + sn(i * 0.45 + 9, boil * 3.1, sd) * 0.2,
    };
  }
  contour(s, pts, pal.base, pal.ink, k, sd);
  s.save();
  path(s, pts);
  s.clip();
  // The print rides the body's lean with the face.
  s.save();
  s.translate(f * lk.skew * 0.4, 0);
  art.print?.(d);
  s.restore();
  path(s, pts);
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (i) s.lineTo(q.x - W * 0.16, q.y - H * 0.13);
    else s.moveTo(q.x - W * 0.16, q.y - H * 0.13);
  }
  s.closePath();
  s.globalCompositeOperation = 'multiply';
  s.fillStyle = pal.shadow;
  s.fill('evenodd');
  s.globalCompositeOperation = 'source-over';
  s.fillStyle = pal.hi;
  line(s, -W * 0.36 + f * lk.skew * 0.7, by - H * 0.7, -W * 0.12 + f * lk.skew * 0.85, by - H * 0.87, { w: 2, seed: sd, taper: [0.22, 0.45], press: 0.1 });
  art.over?.(d);
  s.restore();

  art.front?.(d);
  s.save();
  s.translate(f * lk.skew * 0.55, 0);
  eyes(rc, s, fc, { ...lk, ink: pal.ink }, W, H, by, p, m, x, y - hop, sc);
  mouth(s, fc, { ...lk, ink: pal.ink }, W, H, by, p, m);
  art.snout?.(d);
  s.restore();

  limb(d, arms, f * shoulderX, shoulderY, hand(m, f, f, ph, p.t, L, wall), f);
  s.restore();
}

/** The trailing ribbon for a kind that draws its own (a bushy tail, a curl). False: draw the default. */
export function drawCastRope(s: CanvasRenderingContext2D, c: CharacterDef, rig: Rig, art: Art, v: readonly number[], key: string): boolean {
  const draw = art.rope?.draw;
  if (!draw) return art.rope?.kind === 'none';
  draw(s, rig.rope, { pal: palOf(c, art, v, key), k: lookOf(c).weight, v, c });
  return true;
}

export { inkOf };
