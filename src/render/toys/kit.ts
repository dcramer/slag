import { hash2 } from '../../core/rng';
import type { CharacterDef } from '../../gen/character';
import { line, type P, shadeOf, stroke } from '../ink';
import { inked, type Look, type Mood, oval, poly, type RunnerPose, toned, tonedOval } from '../ink-figure';
import type { Part } from '../fx';
import { glowDot } from '../kit';

/**
 * What every toy's art is built from: the hooks a kind fills in (`ToyArt`), what a hook is handed (`D`),
 * the toy shop's materials, and the shared parts (shapes, keys, rivets, wheels, bands).
 */

/** Everything a hook needs about this draw. Body space: feet at y = 0, body bottom at `by`, top at `top`. */
export interface D {
  s: CanvasRenderingContext2D;
  g: CanvasRenderingContext2D | null;
  c: CharacterDef;
  lk: Look;
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
  /** Stride phase: wheels and legs turn with the distance travelled. */
  ph: number;
  /** World position and scale of the body's origin, for emissive glows. */
  wx: number;
  wy: number;
  sc: number;
  sd: number;
}

export type Feet = 'peg' | 'web' | 'wheels' | 'spring' | 'none';
export type Arms = 'mitten' | 'none';
/** What a toy bursts into when it dies. */
export type { Part } from '../fx';

export interface ToyArt {
  /** Body multipliers around the shared 14×15 envelope, inside the range every kind shares. */
  size: [number, number];
  /** The body outline, standing on y = 0, top at -H. */
  shape: (W: number, H: number, v: readonly number[]) => P[];
  feet: Feet;
  arms: Arms;
  /** Where the body's bottom sits above the floor, when the feet don't decide it (a top stands on its point). */
  lift?: number;
  /** The face's shift toward where the toy faces, as a fraction of its width (a train's face is on its front). */
  faceX?: number;
  /** Precesses as it goes, like a spinning top. */
  spin?: boolean;
  /** Bounces along when it moves (footless and spring toys, and the wind-up hoppers). */
  hop?: boolean;
  /** Waddles side to side on the walk and run, the way a wind-up does. */
  waddle?: boolean;
  /** A trailing ribbon from the rig: a pull string, or a long scarf in the player's color. */
  rope?: { kind: 'string' | 'scarf'; len: number };
  /** Face overrides on the character's rolled one. */
  face?: (c: CharacterDef) => { eyes?: Partial<CharacterDef['eyes']>; mouth?: CharacterDef['mouth'] };
  /** Mitten color. */
  hands?: 'tin' | 'iron' | 'paint';
  /** Behind the body (keys, handles, spines, fins). */
  back?: (d: D) => void;
  /** Inside the body, before the shadow: the player's band, label or panel, and the toy's own marks. */
  print?: (d: D) => void;
  /** Inside the body, after the shadow: seams, rivets, glints, glowing cracks. */
  over?: (d: D) => void;
  /** On the body, before the face (hats, caps, ears, spouts). */
  front?: (d: D) => void;
  /** Over the face (beaks, snouts, grilles). */
  snout?: (d: D) => void;
  parts: readonly Part[];
}

// ------------------------------------------------------------------ materials

export const IRON = '#4b403a';
export const IRON_SH = '#2f2723';
export const STEEL = '#8e8a84';
export const STEEL_SH = '#5c5852';
export const TIN = '#d9d3c7';
export const TIN_SH = '#a39b8e';
export const BRASS = '#b58f45';
export const BRASS_SH = '#7f6128';
export const WOOD = '#a77b4f';
export const WOOD_SH = '#7a5534';
export const SKIN = '#efcfac';
export const ORANGE = '#d9894a';
export const ORANGE_SH = '#a35f2b';
export const HOT = { h: 30, s: 100, l: 58 };
export const HOT_CSS = '#ffb02e';
export const WHITE_HOT = '#fff1b8';

// ------------------------------------------------------------------ shapes

/** Body y at fraction `u` of its height (0 bottom, 1 top). */
export const Y = (d: D, u: number) => d.by - d.H * u;

/**
 * A superellipse body: `n` 2 is an oval, 4 a soft box. `top`/`bot` scale the upper and lower half's
 * width, `sag` drops the belly. Bottom at y = 0.
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

/** A dome: round on top, flat bottom with soft corners (shells, kettles). */
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

/** A closed outline through `pts` with each corner rounded by about `r`. */
export function rounded(pts: readonly P[], r = 1.6, steps = 3): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const la = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const lc = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const ra = Math.min(r, la / 2) / la;
    const rc = Math.min(r, lc / 2) / lc;
    const p0 = { x: b.x + (a.x - b.x) * ra, y: b.y + (a.y - b.y) * ra };
    const p1 = { x: b.x + (c.x - b.x) * rc, y: b.y + (c.y - b.y) * rc };
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p1.y });
    }
  }
  return out;
}

// ------------------------------------------------------------------ marks and parts

export { inked, line, oval, poly, stroke, toned, tonedOval };

/** A pen line in `color`. */
export function mark(s: CanvasRenderingContext2D, color: string, pts: readonly P[], w: number, seed: number, taper: [number, number] = [0.2, 0.4]) {
  s.fillStyle = color;
  stroke(s, pts, { w, seed, taper, press: 0.15 });
}

/** A hand-cut blob around (x, y), keyed to `seed`. */
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

/** A level band across the body from u0 to u1, cut off by the body's own edge (a print hook draws inside the clip). It stops just past the widest body, so nothing drawn reaches beyond it even unclipped. */
export function band(d: D, u0: number, u1: number, fill: string, tilt = 0) {
  poly(
    d.s,
    [
      { x: -d.W * 0.62, y: Y(d, u1) - tilt },
      { x: d.W * 0.62, y: Y(d, u1) + tilt },
      { x: d.W * 0.62, y: Y(d, u0) + tilt },
      { x: -d.W * 0.62, y: Y(d, u0) - tilt },
    ],
    fill,
  );
}

/** The player's band with a thin pale stripe along its top: painted livery, never a flat sticker. */
export function livery(d: D, u0: number, u1: number, tilt = 0) {
  band(d, u0, u1, d.lk.player, tilt);
  mark(
    d.s,
    d.lk.playerHi,
    [
      { x: -d.W * 0.62, y: Y(d, u1) - tilt + 0.6 },
      { x: d.W * 0.62, y: Y(d, u1) + tilt + 0.6 },
    ],
    0.8,
    d.sd,
    [0, 0],
  );
}

/** A stalk with a knob: antennae. */
export function stalk(d: D, x0: number, y0: number, x1: number, y1: number, r: number, fill: string, shade: string) {
  d.s.fillStyle = d.lk.ink;
  stroke(
    d.s,
    [
      { x: x0, y: y0 },
      { x: (x0 + x1) / 2 + d.wob * 0.3, y: (y0 + y1) / 2 },
      { x: x1, y: y1 },
    ],
    { w: 1.7 * d.k, seed: d.sd + x0, taper: [0, 0.3], press: 0.1 },
  );
  if (r > 0) tonedOval(d.s, x1, y1, r, r, 8, fill, shade, d.lk.ink, 0.6, 1 * d.k, 0.6);
}

export function rivet(d: D, x: number, y: number) {
  poly(d.s, oval(x, y, 0.7, 0.7, 6), IRON_SH);
  poly(d.s, oval(x - 0.2, y - 0.2, 0.32, 0.32, 5), TIN);
}

/** The mould's parting line down the middle. */
export function seam(d: D) {
  mark(
    d.s,
    d.lk.paintShade,
    [
      { x: 0.3, y: d.top - 1 },
      { x: 0, y: Y(d, 0.5) },
      { x: 0.3, y: d.by + 1 },
    ],
    0.7,
    d.sd,
    [0, 0],
  );
}

/**
 * The wind-up key in the back: small, in steel, turning as the toy goes, its bow foreshortening edge-on.
 * Quiet on purpose: the player's color is the loudest thing on a toy.
 */
export function key(d: D, u = 0.52) {
  const speed = d.m === 'run' ? 14 : d.m === 'walk' ? 7 : d.m === 'idle' ? 1.2 : 9;
  const a = d.t * speed + d.sd;
  const x0 = -d.f * d.W * 0.46;
  const y0 = Y(d, u);
  const x1 = x0 - d.f * 2.4;
  d.s.fillStyle = d.lk.ink;
  line(d.s, x0 + d.f, y0, x1, y0, { w: 1.7 * d.k, seed: 1, taper: [0, 0], press: 0 });
  const w = Math.max(0.6, Math.abs(Math.cos(a)) * 1.9);
  const cx = x1 - d.f * w * 0.5;
  const bow = [
    { x: cx, y: y0 },
    { x: cx - w, y: y0 - 1.8 },
    { x: cx - w * 0.5, y: y0 - 3.2 },
    { x: cx + w * 0.5, y: y0 - 3.2 },
    { x: cx + w, y: y0 - 1.8 },
    { x: cx, y: y0 },
    { x: cx + w, y: y0 + 1.8 },
    { x: cx + w * 0.5, y: y0 + 3.2 },
    { x: cx - w * 0.5, y: y0 + 3.2 },
    { x: cx - w, y: y0 + 1.8 },
  ];
  toned(d.s, bow, STEEL, STEEL_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.4);
}

/** A wheel at (x, y) turning with the stride: iron rim, brass hub, two spokes. */
export function wheel(d: D, x: number, y: number, r: number) {
  tonedOval(d.s, x, y, r, r, 12, IRON, IRON_SH, d.lk.ink, 0.5, 0.95 * d.k, 0.5);
  const a = -d.ph * (4.2 / r) * d.f;
  d.s.fillStyle = TIN_SH;
  for (const k of [0, Math.PI / 2]) {
    const c = Math.cos(a + k) * r * 0.7;
    const s = Math.sin(a + k) * r * 0.7;
    line(d.s, x - c, y - s, x + c, y + s, { w: 0.7, seed: k, taper: [0, 0], press: 0 });
  }
  poly(d.s, oval(x, y, r * 0.32, r * 0.32, 7), BRASS);
}

/** A small inked box: hats, slots, grilles, cabs. */
export function inkBox(d: D, x: number, y: number, w: number, h: number, fill: string, shade = IRON_SH) {
  toned(
    d.s,
    [
      { x, y },
      { x: x + w, y: y - 0.2 },
      { x: x + w, y: y + h },
      { x, y: y + h + 0.1 },
    ],
    fill,
    shade,
    d.lk.ink,
    0.5,
    0.9 * d.k,
    0.5,
  );
}

/** An ink ring with an open middle. */
export function inkLoop(d: D, pts: readonly P[], fill: string) {
  const ring = [...pts, pts[0], pts[1]];
  d.s.fillStyle = d.lk.ink;
  for (let i = 1; i < ring.length; i++) line(d.s, ring[i - 1].x, ring[i - 1].y, ring[i].x, ring[i].y, { w: 2.2 * d.k, seed: i, taper: [0, 0], press: 0 });
  d.s.fillStyle = fill;
  for (let i = 1; i < ring.length; i++) line(d.s, ring[i - 1].x, ring[i - 1].y, ring[i].x, ring[i].y, { w: 1, seed: i, taper: [0, 0], press: 0 });
}

/** A molten crack across the body, glowing on the emissive layer: hot things are the only things that glow. */
export function crack(d: D, pts: readonly P[], seed: number) {
  mark(d.s, '#3a1a0c', pts, 1.9, seed, [0.1, 0.4]);
  mark(d.s, HOT_CSS, pts, 1, seed, [0.1, 0.4]);
  if (d.g) {
    const m = pts[pts.length >> 1];
    glowDot(d.g, d.wx + m.x * d.sc, d.wy + m.y * d.sc, 6 * d.sc, HOT, 0.28 + 0.06 * Math.sin(d.t * 3 + seed));
  }
}

/** Where `mouth()` puts the mouth, in face space. */
export const mouthY = (d: D) => Math.min(d.by - 2.6, d.by - d.H * d.c.eyes.y + d.c.eyes.size * 1.24 * (d.c.eyes.count === 3 ? 1.2 : 1) + 2.9);
export const mouthX = (d: D) => Math.max(-d.W / 2 + 4, Math.min(d.W / 2 - 4, d.f * 1.5));

/** A ribbon along the rig's rope, fat to thin, toned and inked. */
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
  s.translate(-0.6, -0.5);
  s.fillStyle = fill;
  shape(0);
  s.fill();
  s.restore();
}
