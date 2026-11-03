import type { P } from '../../ink';
import type { Mood } from '../../ink-figure';
import { mark, oval, poly, stroke } from '../kit';
import type { SpriteSet } from './types';

/**
 * The cast's face, drawn on a traced head: cartoon eyes with whites, an iris looking where it's going, a
 * pupil and a glint, brows that act, and a mouth, at the eyes the tracer found (`VFrame.eyes`). The model
 * gives where the face is; the face kit gives how it acts, as every hand-drawn kind's does (`toonEyes` in
 * faces.ts): it blinks at rest, squints into the run, goes wide on a fall, grins on a cheer and crosses
 * out on a death.
 */

export type FaceMood = Mood | 'dead';

const WHITE = '#fbf8f2';
const GLINT = '#ffffff';
const INK = '#2a1f1a';

const cross: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/** Brows: set hard into the run and the wall, raised on the way up, worried on the way down. */
function brow(s: CanvasRenderingContext2D, m: FaceMood, f: number, x: number, y: number, r: number, seed: number) {
  if (m === 'cheer' || m === 'idle' || m === 'walk' || m === 'dead') return;
  // Tilt of the brow's inner end (toward the face's front): down when set, up when worried.
  const tilt = m === 'fall' ? -0.8 : m === 'up' ? 0.1 : 0.8;
  const lift = m === 'up' || m === 'fall' ? 0.7 : 0;
  const yb = y - r * 1.45 - lift;
  mark(
    s,
    INK,
    [
      { x: x - f * r * 0.9, y: yb - tilt * 0.45 },
      { x: x + f * r * 0.9, y: yb + tilt * 0.45 },
    ],
    0.85,
    seed,
    [0.15, 0.3],
  );
}

export function drawFace(
  s: CanvasRenderingContext2D,
  face: NonNullable<SpriteSet['face']>,
  eyes: readonly number[],
  m: FaceMood,
  f: number,
  t: number,
  seed: number,
) {
  const blink = m === 'idle' && Math.sin(t * 1.3 + seed * 7) > 0.985;
  for (let i = 0; i + 2 < eyes.length; i += 3) {
    const x = eyes[i] / 8;
    const y = eyes[i + 1] / 8;
    // The far eye is a little smaller: the head is turned.
    const r = face.r * (i ? 0.82 : 1);
    if (face.eye === 'tall' && m !== 'dead') blush(s, x, y, r, f, i > 0);
    if (m === 'cheer') {
      const arc: P[] = [];
      for (let j = 0; j <= 6; j++) {
        const a = Math.PI * (1.1 + (j / 6) * 0.8);
        arc.push({ x: x + Math.cos(a) * r, y: y + 0.4 + Math.sin(a) * r * 0.85 });
      }
      s.fillStyle = INK;
      stroke(s, arc, { w: 1, seed: seed + i, taper: [0.2, 0.2], press: 0.1 });
      continue;
    }
    if (m === 'dead') {
      s.fillStyle = INK;
      for (const sg of [-1, 1]) {
        cross[0].x = x - r * 0.8;
        cross[0].y = y - sg * r * 0.8;
        cross[1].x = x + r * 0.8;
        cross[1].y = y + sg * r * 0.8;
        stroke(s, cross, { w: 0.85, seed: seed + i + sg, taper: [0.2, 0.2], press: 0.1 });
      }
      continue;
    }
    if (blink) {
      mark(
        s,
        INK,
        [
          { x: x - r, y },
          { x: x + r, y },
        ],
        0.8,
        seed + i,
        [0.2, 0.2],
      );
      continue;
    }
    if (face.eye === 'tall') {
      tallEye(s, x, y, r, m, f);
      continue;
    }
    const wide = m === 'fall' ? 1.2 : 1;
    // Narrowed into the run, under the brow.
    const tall = m === 'run' ? 0.78 : 1.15 * wide;
    poly(s, oval(x, y, r * wide, r * tall, 10), WHITE);
    const px = x + f * r * 0.35;
    const py = y + (m === 'up' ? -r * 0.3 : m === 'fall' ? r * 0.25 : 0);
    const pr = m === 'fall' ? 0.48 : 0.62;
    poly(s, oval(px, py, r * pr, r * Math.min(tall, pr + 0.14), 9), face.iris);
    poly(s, oval(px + f * 0.08, py, r * pr * 0.52, r * Math.min(tall * 0.8, pr * 0.62), 7), INK);
    poly(s, oval(px - r * 0.2, py - r * 0.32, r * 0.2, r * 0.2, 6), GLINT);
    brow(s, m, f, x, y, r, seed + i);
  }
  if (!face.mouth || eyes.length < 3) return;
  // Tall eyes come with the model's own painted smile; the kit opens the mouth over it.
  if (face.eye === 'tall' && m !== 'cheer' && m !== 'fall') return;
  const mx = eyes[0] / 8 + f * face.mouth[0];
  const my = eyes[1] / 8 + face.mouth[1];
  if (m === 'cheer' || m === 'fall') {
    // Open: a grin on the cheer, an O on the fall.
    poly(s, m === 'cheer' ? grin(mx, my, f) : oval(mx, my, 0.6, 0.75, 8), INK);
    return;
  }
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

/** The puffball's blush, soft on any body colour. */
const BLUSH = 'rgba(232,96,120,0.55)';

/** A soft blush under a tall eye toward its cheek; the far one nearer the front, foreshortened. */
function blush(s: CanvasRenderingContext2D, x: number, y: number, r: number, f: number, far: boolean) {
  poly(s, oval(x + f * (far ? 1.1 : -1.9) * r, y + 2.5 * r, (far ? 0.75 : 1.25) * r, 0.6 * r, 8), BLUSH);
}

/**
 * A tall black oval eye with a shine at the top and no white (the puffball's): taller and wider on a fall,
 * the shine riding up on the way up.
 */
function tallEye(s: CanvasRenderingContext2D, x: number, y: number, r: number, m: FaceMood, f: number) {
  const wide = m === 'fall' ? 1.15 : 1;
  const tall = m === 'fall' ? 2.25 : m === 'run' ? 1.8 : 2;
  poly(s, oval(x, y, r * wide, r * tall, 10), INK);
  const sy = y - r * tall * (m === 'up' ? 0.5 : 0.38);
  poly(s, oval(x + f * r * 0.12, sy, r * 0.52, r * 0.78, 8), GLINT);
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
