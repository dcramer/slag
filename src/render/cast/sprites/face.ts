import type { P } from '../../ink';
import { type Mood, path } from '../../ink-figure';
import { inked, mark, oval, poly, stroke } from '../kit';
import type { EyeStyle, FaceKit } from './types';

/**
 * The cast's face, drawn on a rendered head: each kind's own eye (its homage's: the mug's tall black ovals,
 * the miner's blocks, the king's glare), looking where it's going, brows that act, and a mouth. The model gives
 * where the face is: the eyes ride the head through every pose, near eye first, and the head's tilt turns
 * brows, crosses and mouth with it. The face kit gives how it acts, as every hand-drawn kind's does (`toonEyes`
 * and `brows` in faces.ts): it blinks at rest, squints into the run, goes wide on a fall, grins on a cheer and
 * crosses out on a death. An eye is a few screen px at play scale, so each style is one or two bold shapes: a
 * white and a big pupil, or a dark with a glint. A coloured iris shows only where the eye is big enough to
 * carry it; smaller, it would be a grey smudge.
 */

export type FaceMood = Mood | 'dead';

const WHITE = '#fbf8f2';
const GLINT = '#ffffff';
const INK = '#2a1f1a';
/** The hot middle of a `glow` eye. */
const CORE = '#fff4c4';
/** The rim round a white, toward the light and away from it (world px per world px of eye). */
const RIM_THIN = 0.16;
const RIM_THICK = 0.34;
/** The least pupil radius (world px) that carries an iris's colour, a ring round an ink core; smaller, the pupil is ink. */
const IRIS_MIN = 0.45;
/** A side-on head's far eye: this narrow beside the near one, most of it behind it. */
const SLIVER = 0.5;
/** A three-quarter face's far eye (`far: 'turned'`): this narrow, where it was drawn. */
const TURNED = 0.7;
/** A googly eye's far one against the near (with the kit's own 0.85 for the far eye's size): the pair mismatched. */
const GOOGLY_FAR = 2.3;

/** One style of eye (`EyeStyle`), drawn about the origin, already turned with the head. */
interface EyeArt {
  /** The open eye, `r` its size, `f` the way it looks (±1), `far` the far one (the googly eye's pupils sit askew). */
  open(s: CanvasRenderingContext2D, r: number, m: FaceMood, f: number, iris: string, far: boolean): void;
  /** Its half width and height at rest, in `r`: how much of the head it takes. */
  extent: readonly [number, number];
  /** The kit's brows act over it; a style without draws its act in the eye alone. */
  brow: boolean;
  /** Drawn under it first (the puffball's blush). */
  under?(s: CanvasRenderingContext2D, r: number, f: number, far: boolean): void;
  /** The drawing keeps its own smile under these eyes: the kit draws a mouth only opened, on a cheer or a fall. */
  smile?: boolean;
  /** It shines out of a dark face, where ink is lost: its shut eyes, cheer arcs and crosses are drawn in its own colour. */
  lit?: boolean;
  /** It never shuts (a stuck-on googly eye): no blink, and `open` draws the cheer and the death too. */
  stuck?: boolean;
}

/** How wide a white opens and how tall in each mood: narrowed into the run, wide on a fall. */
const wideOf = (m: FaceMood) => (m === 'fall' ? 1.15 : 1);
const squintOf = (m: FaceMood) => (m === 'run' ? 0.8 : m === 'fall' ? 1.12 : 1);
/** Where the pupil looks: up on the way up, down on the fall. */
const lookY = (m: FaceMood) => (m === 'up' ? -0.3 : m === 'fall' ? 0.22 : 0);

/** Draws `draw` clipped to `pts`: a pupil or a lid that reaches the white's edge stays inside it. */
function within(s: CanvasRenderingContext2D, pts: readonly P[], draw: () => void) {
  s.save();
  path(s, pts);
  s.clip();
  draw();
  s.restore();
}

/** A pupil: ink, or the iris round an ink core where it's big enough to carry the colour, and its glint. */
function pupil(s: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, iris: string, f: number) {
  if (Math.min(rx, ry) >= IRIS_MIN) {
    poly(s, oval(x, y, rx, ry, 10), iris);
    poly(s, oval(x + f * rx * 0.12, y + ry * 0.05, rx * 0.5, ry * 0.52, 8), INK);
  } else poly(s, oval(x, y, rx, ry, 10), INK);
  glint(s, x + f * rx * 0.3, y - ry * 0.42, Math.max(rx, ry) * 0.34);
}

function glint(s: CanvasRenderingContext2D, x: number, y: number, r: number) {
  poly(s, oval(x, y, r, r, 7), GLINT);
}

/** A white inked round, as wide and tall as given. */
function white(s: CanvasRenderingContext2D, pts: readonly P[], r: number) {
  inked(s, pts, WHITE, INK, r * RIM_THIN, r * RIM_THICK);
}

/** A lid across a white's top, its edge from `back` to `front` (y, in `r`, at the white's back and front edge). */
function lid(s: CanvasRenderingContext2D, rx: number, ry: number, r: number, f: number, back: number, front: number) {
  const pts: P[] = [
    { x: -f * rx * 1.2, y: -ry * 1.3 },
    { x: f * rx * 1.2, y: -ry * 1.3 },
    { x: f * rx * 1.2, y: front * r },
    { x: -f * rx * 1.2, y: back * r },
  ];
  poly(s, pts, INK);
}

/**
 * The eyes the cast's homages have. Each acts every mood: the shut eyes, the cheer's arcs and the death's
 * crosses are the kit's for all of them (`eye` below), the rest each style's own.
 */
export const EYES: Record<EyeStyle, EyeArt> = {
  // A white and one big pupil looking where it goes: the hopper's, the limbless hero's, the robot boy's.
  round: {
    extent: [1, 1.12],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * wideOf(m);
      const ry = r * 1.08 * squintOf(m);
      const pts = oval(0, 0, rx, ry, 12);
      white(s, pts, r);
      const pr = r * (m === 'fall' ? 0.5 : 0.64);
      within(s, pts, () => pupil(s, f * r * 0.3, lookY(m) * r + r * 0.05, pr, pr * 1.08, iris, f));
    },
  },
  // One solid black oval twice as tall as wide with one big glint, no white: the mug's and the puffball's.
  tall: {
    extent: [1, 2],
    brow: false,
    smile: true,
    under: blush,
    open(s, r, m, f) {
      const wide = m === 'fall' ? 1.15 : 1;
      const tall = m === 'fall' ? 2.25 : m === 'run' ? 1.8 : 2;
      poly(s, oval(0, 0, r * wide, r * tall, 10), INK);
      const sy = -r * tall * (m === 'up' ? 0.5 : 0.38);
      poly(s, oval(f * r * 0.12, sy, r * 0.52, r * 0.78, 8), GLINT);
    },
  },
  // A small round black eye with a glint up toward the front, no white: the electric mouse's, the dot-eater's.
  dot: {
    extent: [1, 1.05],
    brow: false,
    open(s, r, m, f) {
      const wide = m === 'fall' ? 1.15 : 1;
      const tall = m === 'fall' ? 1.25 : m === 'run' ? 0.85 : 1.05;
      poly(s, oval(0, 0, r * wide, r * tall, 10), INK);
      poly(s, oval(f * r * 0.28, -r * tall * (m === 'up' ? 0.45 : 0.32), r * 0.42, r * 0.42, 7), GLINT);
    },
  },
  // A mask's eye hole: a big black oval, taller than wide, with a small glint and no white and no blush (the tall
  // eye's blush read as cheeks painted on the mask): the horned bug's. Black, it acts in its shape: narrowed into
  // the run, wide on a fall.
  hole: {
    extent: [0.9, 1.3],
    brow: false,
    open(s, r, m, f) {
      const rx = r * 0.85 * (m === 'fall' ? 1.12 : 1);
      const ry = r * 1.25 * (m === 'run' ? 0.8 : m === 'fall' ? 1.12 : 1);
      poly(s, oval(0, 0, rx, ry, 12), INK);
      poly(s, oval(f * r * 0.26, -ry * (m === 'up' ? 0.5 : 0.36), r * 0.24, r * 0.3, 7), GLINT);
    },
  },
  // A glow in a dark face: a round all its own colour (the iris), no white and no pupil, a paler core up toward the
  // front: the black mage's, whose face is only darkness and two eyes. It acts in its shape: narrowed into the run,
  // lifted on the way up, wide on a fall; shut, its marks glow too (`lit`).
  glow: {
    extent: [1, 1.05],
    brow: false,
    lit: true,
    open(s, r, m, f, iris) {
      const rx = r * (m === 'fall' ? 1.15 : m === 'run' ? 1.06 : 1);
      const ry = r * (m === 'fall' ? 1.25 : m === 'run' ? 0.68 : m === 'up' ? 1.12 : 1.05);
      poly(s, oval(0, 0, rx, ry, 12), iris);
      poly(s, oval(f * rx * 0.24, -ry * 0.26, rx * 0.42, ry * 0.4, 8), CORE);
    },
  },
  // A lit bulb in an inked socket, a pinprick pupil staring out of it: the animatronic bear's. The glow alone sank
  // into a light fur; the socket's ink keeps it a shape on any colour. A stare, so it narrows only a little into the
  // run, and the pinprick shrinks on a fall.
  bulb: {
    extent: [1, 1.05],
    brow: true,
    open(s, r, m, f, iris) {
      const pts = oval(0, 0, r * wideOf(m), r * 1.05 * (m === 'run' ? 0.88 : m === 'fall' ? 1.12 : 1), 12);
      inked(s, pts, iris, INK, r * RIM_THICK, r * RIM_THICK * 1.4);
      const p = r * (m === 'fall' ? 0.16 : 0.24);
      poly(s, oval(f * r * 0.12, lookY(m) * r * 0.6, p, p, 7), INK);
    },
  },
  // A tall white with a tall pupil toward the front: the plumber's, the saddled dino's.
  pill: {
    extent: [0.78, 1.5],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * 0.78 * wideOf(m);
      const ry = r * 1.5 * squintOf(m);
      const pts = oval(0, 0, rx, ry, 12);
      white(s, pts, r);
      const k = m === 'fall' ? 0.78 : 1;
      within(s, pts, () => pupil(s, f * r * 0.24, lookY(m) * r * 1.4 + r * 0.1, r * 0.5 * k, r * 0.92 * k, iris, f));
    },
  },
  // A head side on: a white with the pupil pressed to its front rim, the way the head looks: the horse's, the dragon's.
  profile: {
    extent: [0.92, 1.1],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * 0.92 * wideOf(m);
      const ry = r * 1.1 * squintOf(m);
      const pts = oval(0, 0, rx, ry, 12);
      white(s, pts, r);
      const k = m === 'fall' ? 0.75 : 1;
      within(s, pts, () => pupil(s, f * r * 0.42, lookY(m) * r + r * 0.08, r * 0.6 * k, r * 0.82 * k, iris, f));
    },
  },
  // An almond under a hard lid slanting down to the front, round a slit: the turtle king's glare. The lid is its
  // brow: set lower into the run, lifted on the way up, and gone, the slit a round pupil, on a fall.
  scowl: {
    extent: [1.05, 0.82],
    brow: false,
    open(s, r, m, f) {
      const rx = r * 1.05 * wideOf(m);
      const ry = r * 0.82 * (m === 'fall' ? 1.25 : 1);
      const pts = almond(rx, ry, f);
      white(s, pts, r);
      within(s, pts, () => {
        const y = lookY(m) * r;
        if (m === 'fall') poly(s, oval(f * r * 0.2, y, r * 0.34, r * 0.38, 9), INK);
        else poly(s, oval(f * r * 0.24, y + r * 0.08, r * 0.2, r * 0.66, 8), INK);
        if (m !== 'fall') {
          const drop = m === 'run' || m === 'wall' ? 0.18 : m === 'up' ? -0.2 : 0;
          lid(s, rx, ry, r, f, -0.55 + drop, 0.02 + drop);
        }
      });
      glint(s, f * r * 0.02, -r * 0.08, r * 0.16);
    },
  },
  // An almond all iris, no white, round a tall slit pupil: the monster slayer's cat's eyes, whose colour is the
  // trait, so the iris fills the eye at any size. The kit's brows set the glare; on a fall the slit opens round.
  cat: {
    extent: [1.05, 0.8],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * 1.05 * wideOf(m);
      const ry = r * 0.8 * squintOf(m);
      const pts = almond(rx, ry, f);
      inked(s, pts, iris, INK, r * RIM_THIN, r * RIM_THICK);
      within(s, pts, () => {
        const y = lookY(m) * r;
        if (m === 'fall') poly(s, oval(f * r * 0.18, y, r * 0.32, r * 0.42, 9), INK);
        else poly(s, oval(f * r * 0.2, y, r * 0.17, r * 0.72, 8), INK);
      });
      glint(s, f * r * 0.36, -r * 0.22, r * 0.14);
    },
  },
  // A round white half hidden under a flat heavy lid, a big pupil below it: the ape's, the mercenary's brood, the
  // puppy's eyes under the beanie. The lid lifts on the way up and is gone on a fall.
  heavy: {
    extent: [1, 1.05],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * wideOf(m);
      const ry = r * 1.05 * (m === 'fall' ? 1.12 : 1);
      const pts = oval(0, 0, rx, ry, 12);
      white(s, pts, r);
      within(s, pts, () => {
        const pr = r * (m === 'fall' ? 0.5 : 0.62);
        pupil(s, f * r * 0.28, lookY(m) * r + r * 0.22, pr, pr * 1.05, iris, f);
        if (m === 'fall') return;
        const y = m === 'run' || m === 'wall' ? -0.02 : m === 'up' ? -0.5 : -0.2;
        lid(s, rx, ry, r, f, y - 0.06, y + 0.06);
      });
    },
  },
  // A big iris filling a white under a thick lash that sweeps past its back corner: the elf hero's.
  anime: {
    extent: [0.95, 1.15],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * 0.95 * wideOf(m);
      const ry = r * 1.15 * squintOf(m);
      const pts = oval(0, 0, rx, ry, 12);
      white(s, pts, r);
      const k = m === 'fall' ? 0.8 : 1;
      within(s, pts, () => pupil(s, f * r * 0.22, lookY(m) * r + r * 0.18, r * 0.7 * k, r * 0.88 * k, iris, f));
      const lash: P[] = [];
      for (let j = 0; j <= 6; j++) {
        const a = Math.PI * (1.08 + (j / 6) * 0.84);
        lash.push({ x: -f * Math.cos(a) * rx * 1.05, y: Math.sin(a) * ry * 0.98 });
      }
      lash.push({ x: -f * rx * 1.35, y: -ry * 0.55 });
      s.fillStyle = INK;
      stroke(s, lash, { w: r * 0.55, seed: 3, taper: [0.5, 0.15], press: 0.1 });
    },
  },
  // A white block and an iris block toward the way it looks, no glint: the voxel miner's.
  square: {
    extent: [1, 0.85],
    brow: true,
    open(s, r, m, f, iris) {
      const rx = r * wideOf(m);
      const ry = r * 0.85 * (m === 'run' ? 0.7 : m === 'fall' ? 1.15 : 1);
      const box = (x0: number, y0: number, x1: number, y1: number): P[] => [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      white(s, box(-rx, -ry, rx, ry), r);
      // Shocked on a fall: a smaller block in the middle, staring.
      const half = m === 'fall' ? [-rx * 0.4, rx * 0.4] : [0, f * rx];
      const lift = m === 'up' ? -ry * 0.35 : 0;
      const [x0, x1] = [Math.min(...half), Math.max(...half)];
      const dark = m === 'fall' ? INK : iris;
      poly(s, box(x0, -ry + Math.max(0, lift), x1, ry + lift), dark);
    },
  },
  // A stuck-on craft eye: a flat white disc round a loose pupil, the puffball's, a knock-off's in place of the
  // original's tall black ovals. The pupils roll the way a googly eye's do, so the face acts by falling about:
  // askew at rest (the near one sunk to the bottom, the far one up in its corner), flung back into the run,
  // dropped on the way up and floated to the top on a fall. A plastic glint sits over the pupil.
  googly: {
    extent: [1, 1],
    brow: false,
    smile: true,
    stuck: true,
    under: googlyBlush,
    open(s, r, m, f, _iris, far) {
      // Mismatched, as a cheap pair glued on: the far eye, toward the front, a size bigger than the near one.
      const k = (m === 'fall' ? 1.08 : 1) * (far ? GOOGLY_FAR : 1);
      const pts = oval(0, 0, r * k, r * k, 14);
      inked(s, pts, WHITE, INK, r * 0.14, r * 0.22);
      const [px, py] = googlyAt(m, far);
      const rr = r * k;
      const pr = rr * 0.5;
      if (m === 'dead') {
        // A cross scratched on each disc: the eye can't shut.
        s.fillStyle = INK;
        for (const sg of [-1, 1]) {
          cross[0].x = -rr * 0.55;
          cross[0].y = -sg * rr * 0.55;
          cross[1].x = rr * 0.55;
          cross[1].y = sg * rr * 0.55;
          stroke(s, cross, { w: Math.max(0.5, rr * 0.3), seed: 5 + sg, taper: [0.2, 0.2], press: 0.1 });
        }
        return;
      }
      within(s, pts, () => poly(s, oval(f * px * rr, py * rr, pr, pr, 10), INK));
      glint(s, -f * rr * 0.42, -rr * 0.44, rr * 0.17);
    },
  },
  // A hole cut through the figure, the level showing in it: the box creeper's square eyes, which are its frame's own
  // holes (`map.holes`), since in black his outline alone is a post. Open, the kit draws nothing over the hole; it
  // acts in the brows, and shuts the hole with the body's colour (`face.lid`) under the blink, the cheer's arcs and
  // the death's crosses.
  cutout: {
    extent: [1, 1],
    brow: true,
    open() {},
  },
};

/** An almond, pointed at the back and round at the front. */
function almond(rx: number, ry: number, f: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const c = Math.cos(a);
    // Toward the back the curve pinches to a corner.
    const pinch = f * c < 0 ? 1 - 0.55 * (f * -c) ** 2 : 1;
    out.push({ x: c * rx, y: Math.sin(a) * ry * pinch });
  }
  return out;
}

const cross: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/**
 * Brows, as the cast's act (`brows` in faces.ts): set hard into the run and the wall, raised on the way
 * up, worried on the way down, gone at rest. `inner` is the side of the brow toward the other eye, and
 * `top` how far above the eye's middle the white ends (in `r`).
 */
function brow(s: CanvasRenderingContext2D, m: FaceMood, inner: number, r: number, top: number, seed: number) {
  if (m === 'cheer' || m === 'idle' || m === 'walk' || m === 'dead') return;
  const tilt = m === 'fall' ? -0.9 : m === 'up' ? 0 : 0.9;
  const lift = m === 'up' ? 0.5 : 0;
  const y = -r * (top + 0.3) - lift;
  mark(
    s,
    INK,
    [
      { x: -inner * r * 1.05, y: y - tilt * r * 0.42 },
      { x: inner * r * 0.95, y: y + tilt * r * 0.42 },
    ],
    Math.max(0.6, r * 0.62),
    seed,
    [0.15, 0.3],
  );
}

/** One eye about the origin (the caller has moved to it and turned with the head); `far` is the far one. */
function eye(s: CanvasRenderingContext2D, face: FaceKit, m: FaceMood, f: number, r: number, blink: boolean, far: boolean, seed: number) {
  const art = EYES[face.eye ?? 'round'];
  const ink = art.lit ? face.iris : INK;
  if (art.under && m !== 'dead') art.under(s, r, f, far);
  if (art.stuck) return art.open(s, r, m, f, face.iris, far);
  if (m === 'cheer') {
    const arc: P[] = [];
    for (let j = 0; j <= 6; j++) {
      const a = Math.PI * (1.1 + (j / 6) * 0.8);
      arc.push({ x: Math.cos(a) * r, y: 0.4 + Math.sin(a) * r * 0.85 });
    }
    s.fillStyle = ink;
    // A thin arc, with the eye's size: as thick as the eye is wide, the two of a small face merged into one
    // dark bar, a squint; with a high floor, a small eye's arc was a dot.
    stroke(s, arc, { w: Math.max(face.mark ?? 0.35, r * 0.5), seed, taper: [0.2, 0.2], press: 0.1 });
    return;
  }
  if (m === 'dead') {
    s.fillStyle = ink;
    for (const sg of [-1, 1]) {
      cross[0].x = -r * 0.85;
      cross[0].y = -sg * r * 0.85;
      cross[1].x = r * 0.85;
      cross[1].y = sg * r * 0.85;
      stroke(s, cross, { w: Math.max(0.75, r * 0.7), seed: seed + sg, taper: [0.2, 0.2], press: 0.1 });
    }
    return;
  }
  if (blink) {
    mark(
      s,
      ink,
      [
        { x: -r, y: 0 },
        { x: r, y: 0 },
      ],
      // With the eye's size: a fixed 0.8 on a small eye was a bar like a moustache.
      Math.max(face.mark ?? 0.4, r * 0.6),
      seed,
      [0.2, 0.2],
    );
    return;
  }
  art.open(s, r, m, f, face.iris, far);
}

/** Clips to the figure's outlines. */
function clipTo(s: CanvasRenderingContext2D, rings: readonly (readonly P[])[]) {
  s.beginPath();
  for (const pts of rings) {
    for (let i = 0; i < pts.length; i++) {
      if (i) s.lineTo(pts[i].x, pts[i].y);
      else s.moveTo(pts[i].x, pts[i].y);
    }
    s.closePath();
  }
  s.clip();
}

/** Where one eye is drawn: its middle and size (world px), and how wide it is drawn (1 whole, less a sliver). */
export interface EyeAt {
  x: number;
  y: number;
  r: number;
  w: number;
}

/**
 * The eyes a frame shows, near first: its `eyes` (x, y, radius triples in eighths of a world px) as the face
 * draws them. A side-on head's far eye (`far`) is a sliver tucked behind the near one, toward where the
 * traced far eye sits but never further, or isn't drawn: never a second full eye beside it, which read as
 * goggles stuck on the side of the head. A three-quarter face's (`turned`) keeps its place, foreshortened.
 */
export function eyesOf(face: FaceKit, eyes: readonly number[]): EyeAt[] {
  const n = Math.floor(eyes.length / 3);
  const out: EyeAt[] = [];
  for (let k = 0; k < n; k++) out.push({ x: eyes[k * 3] / 8, y: eyes[k * 3 + 1] / 8, r: eyes[k * 3 + 2] / 8, w: 1 });
  if (n < 2 || !face.far) return out;
  if (face.far === 'none') return out.slice(0, 1);
  if (face.far === 'turned') {
    out[1].w = TURNED;
    return out;
  }
  const [near, far] = out;
  const ex = EYES[face.eye ?? 'round'].extent[0];
  const dx = far.x - near.x;
  const reach = near.r * ex * 0.95 + far.r * ex * SLIVER * 0.5;
  far.x = near.x + Math.sign(dx) * Math.min(Math.abs(dx), reach);
  far.y = near.y + (far.y - near.y) * Math.min(1, reach / Math.max(Math.abs(dx), 1e-6));
  far.w = SLIVER;
  return out;
}

/**
 * The face on one frame. `eyes` is the frame's x, y, radius triples (eighths of a world px, near eye
 * first) and `head` its head (middle, radius, tilt in degrees), which turns the face with it. `figure` is the
 * frame's outline: the eyes are drawn inside it, so one set near the head's edge never pokes past the line
 * (the brows may stand clear of it, as a cartoon's do). `lid` is the colour `face.lid` paints over a drawn white when
 * the eyes shut.
 */
export function drawFace(
  s: CanvasRenderingContext2D,
  face: FaceKit,
  eyes: readonly number[],
  m: FaceMood,
  f: number,
  t: number,
  seed: number,
  head?: readonly number[],
  figure?: readonly (readonly P[])[],
  lid?: string,
) {
  const at = eyesOf(face, eyes);
  if (!at.length) return;
  const art = EYES[face.eye ?? 'round'];
  const blink = m === 'idle' && Math.sin(t * 1.3 + seed * 7) > 0.985;
  const tilt = head ? (head[3] * Math.PI) / 180 : 0;
  const shut = blink || m === 'cheer' || m === 'dead';
  // Back to front, so the near eye overlaps the far one as it would on a turned head.
  for (let k = at.length - 1; k >= 0; k--) {
    const e = at[k];
    const to = () => {
      s.translate(e.x, e.y);
      if (tilt) s.rotate(tilt);
      if (e.w !== 1) s.scale(e.w, 1);
    };
    s.save();
    if (figure) clipTo(s, figure);
    to();
    if (shut && lid && face.lid) poly(s, oval(0, 0, e.r * face.lid.r, e.r * face.lid.r * 1.15, 12), lid);
    eye(s, face, m, f, e.r, blink, k > 0, seed + k * 3);
    s.restore();
    if (!art.brow || blink) continue;
    // The brow's inner end points at the other eye: the far eye of a turned head sits toward the front.
    s.save();
    to();
    brow(s, m, at.length > 1 && k === 1 ? -f : f, e.r, art.extent[1], seed + k * 3);
    s.restore();
  }
  if (!face.mouth) return;
  if (art.smile && m !== 'cheer' && m !== 'fall') return;
  s.save();
  s.translate(at[0].x, at[0].y);
  if (tilt) s.rotate(tilt);
  const mx = f * face.mouth[0];
  const my = face.mouth[1];
  if (m === 'cheer' || m === 'fall') {
    // Open: a grin on the cheer, an O on the fall.
    poly(s, m === 'cheer' ? grin(mx, my, f) : oval(mx, my, 0.6, 0.75, 8), INK);
  } else {
    const curve = m === 'dead' ? -0.5 : m === 'run' || m === 'wall' ? 0.1 : 0.5;
    mark(
      s,
      INK,
      [
        { x: mx - f * 1, y: my - curve * 0.3 },
        { x: mx, y: my + curve * 0.4 },
        { x: mx + f * 1, y: my - curve * 0.6 },
      ],
      0.75,
      seed,
      [0.2, 0.2],
    );
  }
  s.restore();
}

/**
 * The puffball's blush, one pink on any body colour: see-through, it took the body's hue, and on a green or
 * a teal ball the cheek over the body went grey while the one over the open mouth stayed pink.
 */
const BLUSH = '#ec7a94';

/** A soft blush under a tall eye toward its cheek; the far one nearer the front, foreshortened. */
function blush(s: CanvasRenderingContext2D, r: number, f: number, far: boolean) {
  poly(s, oval(f * (far ? 1.1 : -1.9) * r, 2.5 * r, (far ? 0.75 : 1.25) * r, 0.6 * r, 8), BLUSH);
}

/** Where a googly eye's pupil has rolled to (in `r`, x toward the way it looks): never the same in both eyes. */
function googlyAt(m: FaceMood, far: boolean): readonly [number, number] {
  if (m === 'run') return far ? [-0.4, -0.12] : [-0.36, 0.18];
  if (m === 'up') return far ? [0.12, 0.38] : [-0.08, 0.4];
  if (m === 'fall') return far ? [0.16, -0.42] : [-0.2, -0.38];
  if (m === 'wall') return far ? [0.4, 0.1] : [0.38, -0.16];
  if (m === 'cheer') return far ? [0.2, -0.4] : [-0.3, -0.3];
  return far ? [0.3, -0.3] : [-0.06, 0.4];
}

/** The googly eye's blush, just under its disc toward the cheek: one pink on any ball, as the tall eye's. */
function googlyBlush(s: CanvasRenderingContext2D, r: number, f: number, far: boolean) {
  poly(s, oval(f * (far ? 0.55 : -0.7) * r, 1.25 * r, (far ? 0.45 : 0.72) * r, 0.36 * r, 8), BLUSH);
}

/** A wide open grin, lopsided toward the front. */
function grin(x: number, y: number, f: number): P[] {
  const out: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    out.push({ x: x + Math.cos(a) * f * 1.25, y: y - 0.2 + Math.sin(a) * 0.95 });
  }
  return out;
}
