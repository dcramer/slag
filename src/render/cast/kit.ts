import { hash2 } from '../../core/rng';
import type { CharacterDef } from '../../gen/character';
import { line, type P, shadeOf, stroke } from '../ink';
import { inked, type Look, type Mood, oval, poly, type RunnerPose, toned, tonedOval } from '../ink-figure';
import type { Part } from '../fx';

/**
 * What every character's art is built from: the hooks a kind fills in (`KindArt`), what a hook is handed
 * (`D`), a few shared colors, and the shared parts (outlines, bands, stalks, rivets).
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
  /** Facing: -1 or 1. Kinds are authored facing right; multiply an x by `f` to put it on the front. */
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
  /** World position and scale of the body's origin. */
  wx: number;
  wy: number;
  sc: number;
  sd: number;
  /** How far the body's bend has carried the outline at height `u` (0 bottom, 1 top): hats and heads ride it. */
  bx: (u: number) => number;
  /** This frame's gait, for secondary motion (a lid lifting on the hop, a clapper swinging against the rock). */
  gait: Gait;
  /** Boot colors, lit and shade. */
  boot: [string, string];
  /** Drawn big (a lobby card, the menu): room for the details that would be noise at play scale. */
  detail: boolean;
  /** Which outline this frame uses: hooks that sit on a part that moves with the pose (a goose's head) follow it. */
  pose: 'rest' | 'run' | 'air';
}

/** What the frame hands a gait: the body's motion this frame. */
export interface GaitIn {
  m: Mood;
  /** Stride phase, in radians of travel. */
  ph: number;
  t: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Walking or running on the ground. */
  moving: boolean;
  /** 0 at a walk, 1 at a run. */
  run: number;
  seed: number;
}

/**
 * A kind's own way of moving, on top of the shared squash and stretch: animation and pose only, the
 * physics are everyone's. `pivot` is the height (0 bottom, 1 top, past 1 above) that `rot` turns about:
 * a bell rocks from its crown, a duck from its wheels.
 */
export interface Gait {
  hop?: number;
  rot?: number;
  pivot?: number;
  sx?: number;
  sy?: number;
  /** Extra bend of the body toward where it goes, as a fraction of its height at the top. */
  bend?: number;
  /** How much of the shared lean it takes: a marching soldier stays upright. */
  upright?: number;
  /** A free 0..1 for the kind's own secondary motion (a spring's stretch, a leap's extension). */
  k?: number;
}

export type Feet = 'peg' | 'web' | 'paw' | 'boot' | 'sneaker' | 'stilt' | 'none';
export type Arms = 'mitten' | 'flipper' | 'none';
/** A ribbon the rig trails: a bushy tail, a ringed one. */
export type Rope = { kind: 'tail' | 'ringtail'; len: number };
/** Where a tail hangs from, in world px from the feet, facing right. */
export type Anchor = { x: number; y: number };
/** What a character bursts into when it dies. */
export type { Part } from '../fx';

export interface KindArt {
  /** Body multipliers around the shared 14×15 envelope, inside the range every kind shares. */
  size: [number, number];
  /**
   * The silhouette, hand-inked facing right, in body units: x across -0.5..0.5 of the width, y from 0 at
   * the bottom up to -1 at the top. `M x y`, `L x y`, `Q cx cy x y`, `C x1 y1 x2 y2 x y`, `Z`.
   */
  outline: string;
  /** The outline in other poses, where the line of action changes the shape: a goose's neck thrust out on the run. */
  poses?: { run?: string; air?: string };
  /** How high the body's bottom sits above the floor: legs, wheels, a spring or a nozzle stand under it. */
  lift: number;
  feet: Feet;
  arms: Arms;
  gait: (g: GaitIn) => Gait;
  /** The face's shift toward where the character faces, as a fraction of its width (a fox's face is out on its snout). */
  faceX?: number;
  /** What the body is drawn in: the player's color, or the kind's own (`paint`), for a homage whose palette is how people know it. */
  fill?: 'player' | 'paint';
  /** A homage in its own palette carries the player's color on a ring at its feet. */
  ring?: boolean;
  /** A translucent body (alpha), drawn as glass: no ink mass under it. */
  glass?: number;
  /** A tail the rig trails behind it. */
  rope?: Rope;
  /**
   * The kind's own face (cartoon eyes, a side eye, a visor, goggles, a mask...): its eye count, style,
   * iris, place and mouth, the same on every character of the kind, acting out the mood.
   */
  paintFace: (d: D) => void;
  /** Shiny metal or a wet skin: one hard glint on the lit shoulder. Fur and feathers get none. */
  shine?: boolean;
  /** Mitten (or flipper) color: white gloves, the body, the kind's own color, steel. */
  hands?: 'glove' | 'body' | 'paint' | 'iron' | 'leather';
  /** Behind the body (keys, handles, legs, fins). */
  back?: (d: D) => void;
  /** Inside the body, before the shadow: a pale chest, overalls, the kind's own marks. */
  print?: (d: D) => void;
  /** Inside the body, after the shadow: seams, rivets, glints. */
  over?: (d: D) => void;
  /** On the body, before the face (hats, caps, spouts, stacks). */
  front?: (d: D) => void;
  /** Over the face (beaks, snouts, a mustache). */
  snout?: (d: D) => void;
  /** Held in the front hand, drawn under the mitten at the hand's position (a wrench). */
  tool?: (d: D, hx: number, hy: number) => void;
  /** Boot colors when they aren't the kind's own `paint`. */
  boots?: [string, string];
  parts: readonly Part[];
}

/**
 * The points of an authored outline at size W×H, facing right, bottom at y = 0. Curves are sampled
 * evenly enough for the pen to swell along them; the result is cached by the caller.
 */
export function outlinePts(spec: string, W: number, H: number): P[] {
  const tok = spec.trim().split(/[\s,]+/);
  const pts: P[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  const num = () => Number(tok[i++]);
  const at = (x: number, y: number): P => ({ x: x * W, y: y * H });
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M' || c === 'L') {
      cx = num();
      cy = num();
      pts.push(at(cx, cy));
    } else if (c === 'Q') {
      const [x1, y1, x, y] = [num(), num(), num(), num()];
      for (let j = 1; j <= 6; j++) {
        const t = j / 6;
        const u = 1 - t;
        pts.push(at(u * u * cx + 2 * u * t * x1 + t * t * x, u * u * cy + 2 * u * t * y1 + t * t * y));
      }
      cx = x;
      cy = y;
    } else if (c === 'C') {
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      for (let j = 1; j <= 8; j++) {
        const t = j / 8;
        const u = 1 - t;
        pts.push(
          at(
            u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
            u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
          ),
        );
      }
      cx = x;
      cy = y;
    }
  }
  // A closing point on top of the first would give the pen a zero-length joint.
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (pts.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 0.05) pts.pop();
  return pts;
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
  // Never below the body's own bottom: on a character standing low it would reach the floor.
  u0 = Math.max(u0, -0.4 / d.H);
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
