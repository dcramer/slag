import type { P } from '../ink';
import { type D, HOT_CSS, IRON_SH, mark, oval, poly, stroke, TIN, TIN_SH, tonedOval, Y } from './kit';

/**
 * Faces in the toy's own material: dots painted on a tin label, a visor slit, a headlamp, eyes stamped
 * into tin, beady pig eyes, a porthole, lines engraved in bronze, slits of molten slag. One shared
 * cartoon face on every toy made them read alike; each kind picks the face that belongs to it. Every
 * face still acts out the mood: it blinks at rest, squints happy on a cheer and goes wide on a fall.
 *
 * Drawn in face space: the frame has already shifted it toward where the toy faces.
 */

/** Blinks are seeded per character so a lobby doesn't blink in unison. */
const blinking = (d: D) => d.m === 'idle' && Math.sin(d.t * 1.3 + d.c.seed * 7) > 0.985;

/** A happy squint: an upturned arc. */
function squint(d: D, x: number, y: number, r: number, w = 1.3) {
  const arc: P[] = [];
  for (let j = 0; j <= 6; j++) {
    const a = Math.PI * (1.1 + (j / 6) * 0.8);
    arc.push({ x: x + Math.cos(a) * r, y: y + 0.6 + Math.sin(a) * r * 0.8 });
  }
  d.s.fillStyle = d.lk.ink;
  stroke(d.s, arc, { w, seed: x, taper: [0.2, 0.2], press: 0.1 });
}

/** A small painted mouth from the character's rolled one: a line, a smile or an O, never a sticker. */
function painted(d: D, x: number, y: number, w: number, color = d.lk.ink) {
  const kind = d.m === 'cheer' ? 'smile' : d.m === 'fall' ? 'o' : d.c.mouth;
  if (kind === 'none') return;
  if (kind === 'o' || kind === 'grin' || kind === 'teeth') {
    poly(d.s, oval(x, y, w * 0.32, w * 0.4, 8), color);
    return;
  }
  const curve = kind === 'smile' || kind === 'fang' ? 0.9 : 0;
  mark(
    d.s,
    color,
    [
      { x: x - w / 2, y: y - curve * 0.4 },
      { x, y: y + curve * 0.5 },
      { x: x + w / 2, y: y - curve * 0.4 },
    ],
    1,
    d.sd,
    [0.2, 0.2],
  );
}

/** Painted dots: no whites and no glints, the way a face is printed on a tin label. */
export function dots(d: D, u: number, spread: number, r: number, mouthAt = 0.22) {
  const y = Y(d, u);
  for (const side of [-1, 1]) {
    const x = side * d.W * spread + d.f * 0.5;
    if (d.m === 'cheer') squint(d, x, y, r * 1.2, 1.1);
    else if (blinking(d))
      mark(
        d.s,
        d.lk.ink,
        [
          { x: x - r, y },
          { x: x + r, y },
        ],
        1,
        side,
        [0.2, 0.2],
      );
    else poly(d.s, oval(x, y, r * (d.m === 'fall' ? 1.25 : 1), r * (d.m === 'fall' ? 1.45 : 1.2), 8), d.lk.ink);
  }
  painted(d, d.f * 0.8, y + d.H * mouthAt, 2.8);
}

/** A robot's visor: a dark slit with two pale lamps that slide toward where it's going. */
export function slit(d: D, u: number) {
  const y = Y(d, u);
  const w = d.W * 0.36;
  poly(
    d.s,
    [
      { x: -w, y: y - 1.5 },
      { x: w, y: y - 1.7 },
      { x: w, y: y + 1.4 },
      { x: -w, y: y + 1.6 },
    ],
    d.lk.ink,
  );
  if (blinking(d)) return;
  for (const side of [-1, 1]) {
    const x = side * w * 0.45 + d.f * w * 0.3;
    if (d.m === 'cheer')
      mark(
        d.s,
        '#f4e7c2',
        [
          { x: x - 1, y: y + 0.4 },
          { x, y: y - 0.7 },
          { x: x + 1, y: y + 0.4 },
        ],
        0.9,
        side,
        [0, 0],
      );
    else poly(d.s, oval(x, y, d.m === 'fall' ? 1.2 : 0.9, d.m === 'fall' ? 1.2 : 0.75, 7), '#f4e7c2');
  }
}

/** A headlamp for an eye: brass rim, a pale lens, and a pupil painted on the glass. */
export function lamp(d: D, u: number, x: number, r: number) {
  const y = Y(d, u);
  tonedOval(d.s, x, y, r, r, 12, '#b58f45', '#7f6128', d.lk.ink, 0.5, 0.9 * d.k, 0.5);
  poly(d.s, oval(x - 0.1, y - 0.1, r * 0.72, r * 0.72, 12), '#f3e8c8');
  if (d.m === 'cheer') squint(d, x, y, r * 0.5, 1);
  else if (!blinking(d)) poly(d.s, oval(x + d.f * r * 0.22, y + (d.m === 'up' ? -0.4 : 0), r * 0.32, r * (d.m === 'fall' ? 0.5 : 0.38), 8), d.lk.ink);
  else
    mark(
      d.s,
      d.lk.ink,
      [
        { x: x - r * 0.6, y },
        { x: x + r * 0.6, y },
      ],
      0.9,
      1,
      [0.2, 0.2],
    );
  mark(
    d.s,
    '#fffaf0',
    [
      { x: x - r * 0.5, y: y - r * 0.2 },
      { x: x - r * 0.2, y: y - r * 0.5 },
    ],
    0.6,
    2,
    [0.2, 0.2],
  );
}

/** Eyes stamped into tin: a pressed ring around a painted pupil, painted cheeks under them. */
export function stamped(d: D, u: number, spread: number) {
  const y = Y(d, u);
  for (const side of [-1, 1]) {
    const x = side * d.W * spread + d.f * 0.4;
    poly(d.s, oval(x, y, 1.6, 1.6, 10), d.lk.paintShade);
    poly(d.s, oval(x - 0.2, y - 0.2, 1.2, 1.2, 10), d.lk.paint);
    if (d.m === 'cheer') squint(d, x, y, 0.9, 0.9);
    else if (!blinking(d)) poly(d.s, oval(x + d.f * 0.3, y, 0.6, 0.7, 7), d.lk.ink);
    poly(d.s, oval(x + side * 0.4, y + 2.4, 0.9, 0.6, 7), '#d9707f');
  }
  painted(d, d.f * 0.6, y + 3.2, 2.2);
}

/** Tiny beady eyes, set close: a pig's, a chick's, a beetle's. */
export function beady(d: D, u: number, spread: number, r = 0.7) {
  const y = Y(d, u);
  for (const side of [-1, 1]) {
    const x = side * d.W * spread + d.f * 0.6;
    if (d.m === 'cheer') squint(d, x, y, r * 1.4, 0.9);
    else if (blinking(d))
      mark(
        d.s,
        d.lk.ink,
        [
          { x: x - r, y },
          { x: x + r, y },
        ],
        0.8,
        side,
        [0.2, 0.2],
      );
    else poly(d.s, oval(x, y, r * (d.m === 'fall' ? 1.3 : 1), r * (d.m === 'fall' ? 1.5 : 1.15), 7), d.lk.ink);
  }
}

/** A rocket's porthole for an eye: tin rim, pale glass, a pupil, a hard glint on the glass. */
export function porthole(d: D, u: number) {
  const y = Y(d, u);
  const r = 2.6;
  tonedOval(d.s, d.f * 0.4, y, r, r, 12, TIN, TIN_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
  poly(d.s, oval(d.f * 0.4, y, r * 0.66, r * 0.66, 12), '#cfdde2');
  if (d.m === 'cheer') squint(d, d.f * 0.4, y, r * 0.45, 0.9);
  else if (!blinking(d)) poly(d.s, oval(d.f * (0.4 + r * 0.22), y, r * 0.28, r * (d.m === 'fall' ? 0.42 : 0.32), 8), d.lk.ink);
  mark(
    d.s,
    '#fffaf0',
    [
      { x: d.f * 0.4 - r * 0.45, y: y - r * 0.05 },
      { x: d.f * 0.4 - r * 0.15, y: y - r * 0.42 },
    ],
    0.6,
    3,
    [0.2, 0.2],
  );
}

/** Lines cut into bronze: heavy lids, an engraved O for a mouth. */
export function engraved(d: D, u: number, spread: number) {
  const y = Y(d, u);
  const cut = IRON_SH;
  for (const side of [-1, 1]) {
    const x = side * d.W * spread + d.f * 0.4;
    if (d.m === 'cheer') squint(d, x, y, 1.2, 1);
    else if (d.m === 'fall') poly(d.s, oval(x, y, 1, 1.2, 8), cut);
    else
      mark(
        d.s,
        cut,
        [
          { x: x - 1.3, y: y - 0.3 },
          { x, y: y + 0.7 },
          { x: x + 1.3, y: y - 0.3 },
        ],
        1.1,
        side,
        [0.2, 0.2],
      );
  }
  const my = y + 3;
  if (d.m === 'fall' || d.m === 'cheer' || d.c.mouth === 'o') poly(d.s, oval(d.f * 0.4, my, 0.9, 1.1, 8), cut);
  else
    mark(
      d.s,
      cut,
      [
        { x: d.f * 0.4 - 1, y: my },
        { x: d.f * 0.4 + 1, y: my },
      ],
      0.9,
      4,
      [0.2, 0.2],
    );
}

/** Slits of molten slag for eyes: flat hot color, no glow, set at a scowl. */
export function ember(d: D, u: number, spread: number) {
  const y = Y(d, u);
  for (const side of [-1, 1]) {
    const x = side * d.W * spread + d.f * 0.6;
    const tilt = side * d.f * 0.5;
    const h = d.m === 'fall' ? 1.4 : blinking(d) ? 0.2 : 0.8;
    poly(
      d.s,
      [
        { x: x - 1.6, y: y - h - tilt },
        { x: x + 1.6, y: y - h + tilt },
        { x: x + 1.4, y: y + h + tilt * 0.4 },
        { x: x - 1.4, y: y + h - tilt * 0.4 },
      ],
      d.lk.ink,
    );
    if (h > 0.3) poly(d.s, oval(x, y + 0.1, 1.1, h * 0.6, 8), HOT_CSS);
  }
  painted(d, d.f * 0.8, y + 3.4, 3, HOT_CSS);
}

/** One eye in profile, near the front: a duck's. */
export function side(d: D, u: number, x: number) {
  const y = Y(d, u);
  if (d.m === 'cheer') return squint(d, x, y, 1.1, 1);
  if (blinking(d))
    return mark(
      d.s,
      d.lk.ink,
      [
        { x: x - 1, y },
        { x: x + 1, y },
      ],
      0.9,
      1,
      [0.2, 0.2],
    );
  poly(d.s, oval(x, y, 1.2, d.m === 'fall' ? 1.6 : 1.35, 9), d.lk.ink);
  poly(d.s, oval(x + d.f * 0.35, y - 0.45, 0.35, 0.35, 6), '#fffaf0');
}
