import type { P } from '../ink';
import { type D, mark, oval, poly, stroke, tonedOval, Y } from './kit';

/**
 * Faces, drawn small and by hand: a few dark marks rather than a sticker of big white eyes. Each kind
 * picks the face that belongs to it (a beady side eye, a visor slit, goggles, a raccoon's mask, a
 * plumber's nose and mustache) and every one still acts out the mood: it blinks at rest, squints happy
 * on a cheer and goes wide on a fall.
 *
 * Drawn in face space: the frame has already shifted it toward where the character faces.
 */

/** Blinks are seeded per character so a lobby doesn't blink in unison. */
const blinking = (d: D) => d.m === 'idle' && Math.sin(d.t * 1.3 + d.c.seed * 7) > 0.985;

/** A happy squint: an upturned arc. */
export function squint(d: D, x: number, y: number, r: number, w = 0.9) {
  const arc: P[] = [];
  for (let j = 0; j <= 6; j++) {
    const a = Math.PI * (1.1 + (j / 6) * 0.8);
    arc.push({ x: x + Math.cos(a) * r, y: y + 0.5 + Math.sin(a) * r * 0.8 });
  }
  d.s.fillStyle = d.lk.eye;
  stroke(d.s, arc, { w, seed: x, taper: [0.2, 0.2], press: 0.1 });
}

/** One eye: a small dark oval with a pinprick of light, or the mood's version of it. */
export function eye(d: D, x: number, y: number, r: number, glint = true) {
  if (d.m === 'cheer') return squint(d, x, y, r * 1.2);
  if (blinking(d))
    return mark(
      d.s,
      d.lk.eye,
      [
        { x: x - r, y },
        { x: x + r, y },
      ],
      0.8,
      x,
      [0.2, 0.2],
    );
  const wide = d.m === 'fall' ? 1.3 : 1;
  poly(d.s, oval(x, y, r * wide, r * 1.2 * wide, 9), d.lk.eye);
  if (glint) poly(d.s, oval(x + d.f * r * 0.3 - r * 0.15, y - r * 0.45, r * 0.3, r * 0.3, 6), '#fffaf0');
}

/** A kind's resting mouth: a smile, a flat line, or none. */
export type MouthKind = 'smile' | 'flat' | 'none';

/** A small mouth, the kind's own at rest: a smile on a cheer and an O on a fall, whatever it is. */
export function mouthMark(d: D, x: number, y: number, w: number, rest: MouthKind) {
  const kind = d.m === 'cheer' ? 'smile' : d.m === 'fall' ? 'o' : rest;
  if (kind === 'none') return;
  if (kind === 'o') {
    poly(d.s, oval(x, y, w * 0.28, w * 0.34, 8), d.lk.eye);
    return;
  }
  const curve = kind === 'smile' ? 0.8 : 0;
  mark(
    d.s,
    d.lk.eye,
    [
      { x: x - w / 2, y: y - curve * 0.4 },
      { x, y: y + curve * 0.5 },
      { x: x + w / 2, y: y - curve * 0.4 },
    ],
    0.8,
    d.sd,
    [0.2, 0.2],
  );
}

/** Two eyes and the kind's mouth `mouthAt` of the height below them: the plain face. */
export function pair(d: D, u: number, spread: number, r: number, mouth: MouthKind = 'none', mouthAt = 0.2) {
  const y = Y(d, u);
  for (const sd of [-1, 1]) eye(d, sd * d.W * spread + d.f * 0.5, y, r);
  if (mouth !== 'none') mouthMark(d, d.f * 0.8, y + d.H * mouthAt, 2.4, mouth);
}

/** A robot's visor: a dark slit with two pale lamps that slide toward where it's going. */
export function slit(d: D, u: number) {
  const y = Y(d, u);
  const w = d.W * 0.34;
  poly(
    d.s,
    [
      { x: -w, y: y - 1.3 },
      { x: w, y: y - 1.5 },
      { x: w, y: y + 1.2 },
      { x: -w, y: y + 1.4 },
    ],
    d.lk.eye,
  );
  if (blinking(d)) return;
  for (const sd of [-1, 1]) {
    const x = sd * w * 0.45 + d.f * w * 0.3;
    if (d.m === 'cheer')
      mark(
        d.s,
        '#f4e7c2',
        [
          { x: x - 0.9, y: y + 0.4 },
          { x, y: y - 0.6 },
          { x: x + 0.9, y: y + 0.4 },
        ],
        0.8,
        sd,
        [0, 0],
      );
    else poly(d.s, oval(x, y, d.m === 'fall' ? 1.1 : 0.8, d.m === 'fall' ? 1.1 : 0.7, 7), '#f4e7c2');
  }
}

/** Welding goggles: two round lenses on a strap, the eyes showing small behind the glass. */
export function goggles(d: D, u: number, spread: number) {
  const y = Y(d, u);
  mark(
    d.s,
    d.lk.eye,
    [
      { x: -d.W * 0.5, y: y + 0.2 },
      { x: d.W * 0.5, y: y - 0.2 },
    ],
    1.1,
    d.sd,
    [0, 0],
  );
  for (const sd of [-1, 1]) {
    const x = sd * d.W * spread + d.f * 0.6;
    tonedOval(d.s, x, y, 2.1, 1.9, 12, '#7d8a8c', '#56605f', d.lk.ink, 0.4, 0.7 * d.k, 0.4);
    poly(d.s, oval(x, y, 1.4, 1.3, 10), '#cfdde0');
    if (d.m === 'cheer') squint(d, x, y, 0.8, 0.8);
    else if (!blinking(d)) poly(d.s, oval(x + d.f * 0.4, y + 0.1, 0.55, d.m === 'fall' ? 0.8 : 0.6, 7), d.lk.eye);
    mark(
      d.s,
      '#fffaf0',
      [
        { x: x - 0.9, y: y - 0.2 },
        { x: x - 0.5, y: y - 0.8 },
      ],
      0.4,
      sd,
      [0.2, 0.2],
    );
  }
}

/** A raccoon's mask: a dark band across the eyes, the eyes bright inside it. */
export function mask(d: D, u: number, spread: number) {
  const y = Y(d, u);
  const w = d.W * (spread + 0.16);
  poly(
    d.s,
    [
      { x: -w, y: y - 0.6 },
      { x: -w * 0.4, y: y - 1.8 },
      { x: 0, y: y - 1 },
      { x: w * 0.4, y: y - 1.8 },
      { x: w, y: y - 0.6 },
      { x: w * 0.5, y: y + 1.6 },
      { x: 0, y: y + 0.8 },
      { x: -w * 0.5, y: y + 1.6 },
    ].map((q) => ({ x: q.x + d.f * 0.5, y: q.y })),
    d.lk.playerDark,
  );
  for (const sd of [-1, 1]) {
    const x = sd * d.W * spread + d.f * 0.5;
    if (d.m === 'cheer') {
      squint(d, x, y, 0.9, 0.8);
      continue;
    }
    poly(d.s, oval(x, y, 1, 1.05, 8), '#f4ede2');
    if (!blinking(d)) poly(d.s, oval(x + d.f * 0.3, y + 0.1, 0.5, d.m === 'fall' ? 0.75 : 0.55, 7), d.lk.eye);
  }
}

/** A puffball's tall oval eyes with a shine at the top, and two blush marks. */
export function tallEyes(d: D, u: number, spread: number) {
  const y = Y(d, u);
  for (const sd of [-1, 1]) {
    const x = sd * d.W * spread + d.f * 0.6;
    if (d.m === 'cheer') {
      squint(d, x, y, 1, 0.9);
      continue;
    }
    if (blinking(d)) {
      mark(
        d.s,
        d.lk.eye,
        [
          { x: x - 0.9, y },
          { x: x + 0.9, y },
        ],
        0.8,
        sd,
        [0.2, 0.2],
      );
      continue;
    }
    poly(d.s, oval(x, y, 0.9, d.m === 'fall' ? 2.2 : 1.9, 10), d.lk.eye);
    poly(d.s, oval(x - 0.1, y - 0.9, 0.5, 0.75, 8), '#fffaf0');
    poly(d.s, oval(x + sd * 1.8, y + 2.2, 1.2, 0.6, 8), 'rgba(232,96,120,0.55)');
  }
  // The tiny mouth of the roster entry.
  mouthMark(d, d.f * 0.6, y + 2.6, 1.8, 'smile');
}

/** A side-on bird's eye, near the front of the head. */
export function sideEye(d: D, u: number, x: number, r = 0.85) {
  eye(d, x, Y(d, u), r);
}

/** Brows that act: set hard on a run or a wall, raised on a jump, worried on a fall, gone at rest. */
export function brows(d: D, xs: readonly number[], y: number, r: number) {
  if (d.m === 'cheer' || d.m === 'idle' || d.m === 'walk') return;
  const tilt = d.m === 'fall' ? -0.9 : d.m === 'up' ? 0 : 0.9;
  const lift = d.m === 'up' ? 0.8 : 0;
  for (const x of xs) {
    // The brow's inner end is the one toward the other eye.
    const inner = xs.length > 1 && x === Math.max(...xs) ? -1 : 1;
    const yi = y - r * 1.3 - lift + tilt * 0.6;
    const yo = y - r * 1.3 - lift - tilt * 0.6;
    mark(
      d.s,
      d.lk.eye,
      [
        { x: x - inner * r, y: yo },
        { x: x + inner * r * 0.9, y: yi },
      ],
      0.9,
      x,
      [0.15, 0.3],
    );
  }
}

/**
 * Cartoon eyes: whites, an iris looking where it's going, a highlight, and brows that act. `joined` runs
 * the whites together into one shape, the speedster's way.
 */
export function toonEyes(d: D, u: number, spread: number, r: number, iris: string, joined = false) {
  const y = Y(d, u);
  const xs = [-d.W * spread + d.f * 0.6, d.W * spread + d.f * 0.6];
  if (d.m === 'cheer') {
    for (const x of xs) squint(d, x, y, r, 0.9);
    return;
  }
  const wide = d.m === 'fall' ? 1.15 : 1;
  if (joined) {
    // One white shape across both eyes, pinched in the middle.
    const pts: P[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI * 2;
      const x = Math.cos(a) * (xs[1] - xs[0] + r * 2) * 0.5;
      const pinch = 1 - 0.25 * Math.exp(-((x / r) ** 2));
      pts.push({ x: (xs[0] + xs[1]) / 2 + x, y: y + Math.sin(a) * r * 1.25 * wide * pinch });
    }
    poly(d.s, pts, '#fbf8f2');
  }
  for (const x of xs) {
    if (!joined) poly(d.s, oval(x, y, r * wide, r * 1.2 * wide, 10), '#fbf8f2');
    if (blinking(d)) {
      mark(
        d.s,
        d.lk.eye,
        [
          { x: x - r, y },
          { x: x + r, y },
        ],
        0.8,
        x,
        [0.2, 0.2],
      );
      continue;
    }
    const px = x + d.f * r * 0.35;
    const py = y + (d.m === 'up' ? -r * 0.3 : d.m === 'fall' ? r * 0.2 : 0);
    poly(d.s, oval(px, py, r * 0.6, r * 0.75, 9), iris);
    poly(d.s, oval(px + d.f * 0.1, py, r * 0.32, r * 0.42, 7), d.lk.eye);
    poly(d.s, oval(px - r * 0.2, py - r * 0.35, r * 0.2, r * 0.2, 6), '#ffffff');
  }
  brows(d, xs, y, r);
}
