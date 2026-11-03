import type { P } from '../../ink';
import type { Mood } from '../../ink-figure';
import { inked, mark, oval, poly, stroke } from '../kit';
import type { SpriteSet } from './types';

/**
 * The cast's face, drawn on a rendered head: inked cartoon eyes with whites, an iris looking where it's
 * going, a pupil and a glint, brows that act, and a mouth. The model gives where the face is: the eyes
 * ride the head bone through every pose (tools/art3d/page/render.ts), near eye first, each sized by how
 * squarely it faces the camera, and the head's tilt turns brows, crosses and mouth with it. The face kit
 * gives how it acts, as every hand-drawn kind's does (`toonEyes` and `brows` in faces.ts): it blinks at
 * rest, squints into the run, goes wide on a fall, grins on a cheer and crosses out on a death.
 */

export type FaceMood = Mood | 'dead';

const WHITE = '#fbf8f2';
const GLINT = '#ffffff';
const INK = '#2a1f1a';
/** The rim round a white, toward the light and away from it (world px per world px of eye). */
const RIM_THIN = 0.16;
const RIM_THICK = 0.34;

const cross: P[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/**
 * Brows, as the cast's act (`brows` in faces.ts): set hard into the run and the wall, raised on the way
 * up, worried on the way down, gone at rest. `inner` is the side of the brow toward the other eye.
 */
function brow(s: CanvasRenderingContext2D, m: FaceMood, inner: number, r: number, seed: number) {
  if (m === 'cheer' || m === 'idle' || m === 'walk' || m === 'dead') return;
  const tilt = m === 'fall' ? -0.9 : m === 'up' ? 0 : 0.9;
  const lift = m === 'up' ? 0.5 : 0;
  const y = -r * 1.35 - lift;
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

/** One eye about the origin (the caller has moved to it and turned with the head). */
function eye(s: CanvasRenderingContext2D, iris: string, m: FaceMood, f: number, r: number, blink: boolean, inner: number, seed: number) {
  if (m === 'cheer') {
    const arc: P[] = [];
    for (let j = 0; j <= 6; j++) {
      const a = Math.PI * (1.1 + (j / 6) * 0.8);
      arc.push({ x: Math.cos(a) * r, y: 0.4 + Math.sin(a) * r * 0.85 });
    }
    s.fillStyle = INK;
    stroke(s, arc, { w: Math.max(0.95, r * 0.9), seed, taper: [0.2, 0.2], press: 0.1 });
    return;
  }
  if (m === 'dead') {
    s.fillStyle = INK;
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
      INK,
      [
        { x: -r, y: 0 },
        { x: r, y: 0 },
      ],
      0.8,
      seed,
      [0.2, 0.2],
    );
    return;
  }
  const wide = m === 'fall' ? 1.15 : 1;
  // Narrowed into the run, under the brow.
  const tall = m === 'run' ? 0.85 : 1.2 * wide;
  inked(s, oval(0, 0, r * wide, r * tall, 10), WHITE, INK, r * RIM_THIN, r * RIM_THICK);
  const px = f * r * 0.35;
  const py = m === 'up' ? -r * 0.3 : m === 'fall' ? r * 0.2 : 0;
  const pr = m === 'fall' ? 0.48 : 0.6;
  poly(s, oval(px, py, r * pr, r * Math.min(tall, pr + 0.15), 9), iris);
  poly(s, oval(px + f * 0.08, py, r * 0.32, r * Math.min(tall * 0.8, 0.42), 7), INK);
  poly(s, oval(px - r * 0.2, py - r * 0.35, r * 0.2, r * 0.2, 6), GLINT);
  brow(s, m, inner, r, seed);
}

/**
 * The face on one frame. `eyes` is the frame's x, y, radius triples (eighths of a world px, near eye
 * first) and `head` its head (middle, radius, tilt in degrees); a frame traced before heads were
 * recorded has no `head`, and its eyes are sized from the kit alone.
 */
export function drawFace(
  s: CanvasRenderingContext2D,
  face: NonNullable<SpriteSet['face']>,
  eyes: readonly number[],
  m: FaceMood,
  f: number,
  t: number,
  seed: number,
  head?: readonly number[],
) {
  const n = Math.floor(eyes.length / 3);
  if (!n) return;
  const blink = m === 'idle' && Math.sin(t * 1.3 + seed * 7) > 0.985;
  const tilt = head ? (head[3] * Math.PI) / 180 : 0;
  // Back to front, so the near eye overlaps the far one as it would on a turned head.
  for (let k = n - 1; k >= 0; k--) {
    const r = head ? eyes[k * 3 + 2] / 8 : face.r * (k ? 0.82 : 1);
    // The brow's inner end points at the other eye: the far eye of a turned head sits toward the front.
    const inner = n > 1 && k === 1 ? -f : f;
    s.save();
    s.translate(eyes[k * 3] / 8, eyes[k * 3 + 1] / 8);
    if (tilt) s.rotate(tilt);
    eye(s, face.iris, m, f, r, blink, inner, seed + k * 3);
    s.restore();
  }
  if (!face.mouth) return;
  s.save();
  s.translate(eyes[0] / 8, eyes[1] / 8);
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

/** A wide open grin, lopsided toward the front. */
function grin(x: number, y: number, f: number): P[] {
  const out: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    out.push({ x: x + Math.cos(a) * f * 1.25, y: y - 0.2 + Math.sin(a) * 0.95 });
  }
  return out;
}
