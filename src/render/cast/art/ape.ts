import { brows, eye, mouthMark } from '../faces';
import { type D, type KindArt, poly, spot, STEEL_SH, toned, tonedOval, Y } from '../kit';

/**
 * The necktie ape (docs/CHARACTERS.md → Roster): a hunched brute, huge shoulders over a small head low and
 * forward, arms longer than his legs with both taped fists on the floor, a pale face and chest, and a clip-on
 * tie worn crooked on the bare chest, a banana behind his ear. A rendered kind draws from its frames
 * (src/render/cast/sprites/); this is what shows before they load, and on the hand-drawn sheets.
 */

const FACE = '#e2b98a';
const FACE_SH = '#c39a6c';
const BANANA = '#e8c84e';
const BANANA_SH = '#c4a236';
const TAPE = '#9aa0a8';

/** A taped fist planted on its knuckles at `x` (world px), the tape wound round the wrist above it. */
function fist(d: D, x: number, far: boolean) {
  const lit = far ? FACE_SH : FACE;
  tonedOval(d.s, x + d.f * 0.3, -1.1, 1.75, 1.15, 10, lit, FACE_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
  const top = Y(d, 0.2);
  toned(
    d.s,
    [
      { x: x - 1.7, y: top },
      { x: x + 1.7, y: top + 0.3 },
      { x: x + 1.8, y: -1.7 },
      { x: x - 1.6, y: -1.9 },
    ],
    far ? STEEL_SH : TAPE,
    STEEL_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.4,
  );
}

export const art: KindArt = {
  size: [1.12, 0.96],
  // The shoulders' hump behind, the small head low and forward, the near arm a column down to the floor in
  // front, the far one behind, the belly hanging between them over the short legs.
  outline:
    'M -0.06 -1 C 0.12 -1 0.24 -0.96 0.3 -0.88 C 0.4 -0.92 0.5 -0.84 0.5 -0.74 C 0.52 -0.66 0.5 -0.6 0.44 -0.57 C 0.5 -0.48 0.5 -0.3 0.49 -0.14 C 0.48 -0.05 0.44 0 0.38 0 L 0.22 0 C 0.2 -0.1 0.21 -0.28 0.19 -0.4 C 0.12 -0.3 0.04 -0.16 -0.06 -0.1 C -0.14 -0.16 -0.2 -0.26 -0.25 -0.34 C -0.26 -0.22 -0.26 -0.08 -0.28 0 L -0.46 0 C -0.52 -0.2 -0.52 -0.5 -0.46 -0.72 C -0.4 -0.9 -0.26 -1 -0.06 -1 Z',
  lift: 1,
  feet: 'paw',
  arms: 'none',
  fill: 'player',
  faceX: 0.3,
  // The knuckle gallop: a rolling bound, rocking forward onto the fists and back onto the feet.
  gait: (g) =>
    g.moving
      ? { hop: Math.abs(Math.sin(g.ph)) * (0.4 + g.run * 0.7), rot: Math.sin(g.ph) * 0.07 * g.run, pivot: 0.15, bend: 0.06 + g.run * 0.06, upright: 0.5 }
      : {},
  paintFace: (d) => {
    const y = Y(d, 0.78);
    const xs = [-d.W * 0.05 + d.f * 0.4, d.W * 0.07 + d.f * 0.4];
    for (const x of xs) eye(d, x, y, 0.6);
    brows(d, xs, y, 0.7);
    mouthMark(d, d.f * 1.3, Y(d, 0.63), 1.6, 'flat');
  },
  print: (d) => {
    // The pale chest, the face and muzzle, and the crooked clip-on tie in a shade of the fur (far darker, it read as a mouth).
    spot(d.s, d.f * d.W * 0.06, Y(d, 0.42), d.W * 0.15, d.H * 0.21, d.sd, FACE, 0.08);
    spot(d.s, d.f * d.W * 0.36, Y(d, 0.71), d.W * 0.15, d.H * 0.14, d.sd + 1, FACE, 0.06);
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.04, y: Y(d, 0.62) },
        { x: d.f * d.W * 0.16, y: Y(d, 0.62) },
        { x: d.f * d.W * 0.13, y: Y(d, 0.5) },
        { x: d.f * d.W * 0.14, y: Y(d, 0.26) },
        { x: d.f * d.W * 0.04, y: Y(d, 0.3) },
        { x: d.f * d.W * 0.08, y: Y(d, 0.5) },
      ],
      d.lk.playerShade,
    );
  },
  back: (d) => fist(d, -d.f * d.W * 0.37 + d.bx(0.1), true),
  front: (d) => {
    fist(d, d.f * d.W * 0.36 + d.bx(0.1), false);
    // The banana behind his ear like a pencil, curving up over the crown.
    const x = d.bx(0.95) + d.f * d.W * 0.12;
    const y = Y(d, 0.9);
    toned(
      d.s,
      [
        { x: x - d.f * 1.6, y: y + 1.2 },
        { x: x - d.f * 0.4, y: y - 1.2 },
        { x: x + d.f * 1.8, y: y - 1.6 },
        { x: x + d.f * 2.2, y: y - 1.1 },
        { x: x + d.f * 0.2, y: y - 0.4 },
        { x: x - d.f * 0.9, y: y + 1.4 },
      ],
      BANANA,
      BANANA_SH,
      d.lk.ink,
      0.4,
      0.7 * d.k,
      0.5,
    );
  },
  parts: ['shard', 'shard', 'bolt'],
};
