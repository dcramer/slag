import { brows, eye, mouthMark } from '../faces';
import { type D, type KindArt, mark, poly, spot, toned, Y } from '../kit';

/**
 * The barnyard party game's horse (docs/CHARACTERS.md → Roster): on all four legs, side on, in a cheap horse
 * costume: a long neck with the mane standing up along it as a crest, a long blunt head with a pale nose, a
 * long straight tail hanging to the heels, flat hooves wider than the legs, a scarf in a dark of the costume
 * wound round the neck and a zip down the chest. A rendered kind draws from its frames
 * (src/render/cast/sprites/); this is what shows before they load, and on the hand-drawn sheets.
 */

const MUZZLE = '#e6cfae';
const MANE = '#4a3428';
const MANE_SH = '#33241b';
const ZIP = '#9a9c98';

/** The legs' outer edges in body units, hind far, hind near, front far, front near: each a hoof under it. */
const LEGS: readonly [number, number][] = [
  [-0.4, -0.32],
  [-0.28, -0.2],
  [0.08, 0.15],
  [0.19, 0.27],
];

/** The flat-bottomed hooves, a little wider than each leg, the far ones in the mane's shade. */
function hooves(d: D) {
  LEGS.forEach(([a, b], i) => {
    const far = i === 0 || i === 2;
    const [x0, x1] = [d.f * d.W * (a - 0.02), d.f * d.W * (b + 0.02)];
    poly(
      d.s,
      [
        { x: x0, y: 0 },
        { x: x1, y: 0 },
        { x: x1 - d.f * 0.1, y: -1.3 },
        { x: x0 + d.f * 0.1, y: -1.3 },
      ],
      far ? MANE_SH : MANE,
    );
  });
}

/** The mane standing up along the top of the neck as a crest, and the two small ears at the poll. */
function crest(d: D) {
  const W = d.W;
  const f = d.f;
  const sway = d.wob * 0.2;
  toned(
    d.s,
    [
      { x: f * W * 0.27, y: Y(d, 1.0) },
      { x: f * W * 0.16 - sway, y: Y(d, 1.08) },
      { x: f * W * 0.04 - sway, y: Y(d, 0.88) },
      { x: -f * W * 0.06 - sway, y: Y(d, 0.66) },
      { x: f * W * 0.04, y: Y(d, 0.62) },
      { x: f * W * 0.12, y: Y(d, 0.82) },
      { x: f * W * 0.22, y: Y(d, 0.95) },
    ],
    MANE,
    MANE_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.3,
  );
  for (const [dx, h] of [
    [0.27, 2.4],
    [0.32, 2.0],
  ] as const)
    toned(
      d.s,
      [
        { x: f * W * (dx - 0.03), y: Y(d, 0.98) },
        { x: f * W * dx + sway, y: Y(d, 0.98) - h },
        { x: f * W * (dx + 0.03), y: Y(d, 0.96) },
      ],
      d.lk.player,
      d.lk.playerShade,
      d.lk.ink,
      0.3,
      0.7 * d.k,
      0.3,
    );
}

/** The long tail of straight hair hanging from the rump to the heels, swung back on the run. */
function tail(d: D) {
  const W = d.W;
  const f = d.f;
  const swing = d.p.grounded && Math.abs(d.p.vx) < 1 ? 0 : -f * 2.2;
  const sway = d.wob * 0.4;
  toned(
    d.s,
    [
      { x: -f * W * 0.37, y: Y(d, 0.62) },
      { x: -f * W * 0.47 + swing * 0.4, y: Y(d, 0.52) },
      { x: -f * W * 0.5 + swing + sway, y: Y(d, 0.22) },
      { x: -f * W * 0.48 + swing + sway, y: Y(d, 0.08) },
      { x: -f * W * 0.43 + swing * 0.8, y: Y(d, 0.16) },
      { x: -f * W * 0.41 + swing * 0.3, y: Y(d, 0.46) },
    ],
    MANE,
    MANE_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
}

export const art: KindArt = {
  size: [1.45, 1.2],
  // Side on: a barrel body on four legs, a long neck rising steeply from the chest, and a long blunt head out in
  // front and pointing down, as deep at the nose as at the eyes.
  outline:
    'M -0.4 -0.6 C -0.3 -0.65 -0.1 -0.62 0.03 -0.62 C 0.09 -0.76 0.15 -0.9 0.22 -0.98 C 0.26 -1.02 0.31 -1 0.35 -0.96 L 0.56 -0.8 C 0.61 -0.77 0.61 -0.67 0.57 -0.65 L 0.41 -0.67 C 0.35 -0.69 0.31 -0.65 0.29 -0.6 C 0.28 -0.52 0.28 -0.46 0.27 -0.4 L 0.27 0 L 0.19 0 L 0.19 -0.33 L 0.15 -0.33 L 0.15 0 L 0.08 0 L 0.08 -0.36 C -0.04 -0.34 -0.14 -0.34 -0.2 -0.36 L -0.2 0 L -0.28 0 L -0.28 -0.32 L -0.32 -0.32 L -0.32 0 L -0.4 0 L -0.41 -0.36 C -0.44 -0.44 -0.44 -0.54 -0.4 -0.6 Z',
  lift: 0.1,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0,
  // A high-stepping trot: a hop on every step, rocking a little nose to tail.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.6 + g.run * 0.4), rot: Math.sin(g.ph) * 0.04 * g.run, pivot: 0.2, upright: 0.6 } : {}),
  paintFace: (d) => {
    const y = Y(d, 0.9);
    const xs = [d.f * d.W * 0.33, d.f * d.W * 0.4];
    eye(d, xs[0], y, 0.65);
    eye(d, xs[1], y - 0.3, 0.5);
    brows(d, xs, y, 0.7);
  },
  print: (d) => {
    // The pale nose on the end of the muzzle, and the scarf wound round the neck in a dark of the costume.
    spot(d.s, d.f * d.W * 0.53, Y(d, 0.73), d.W * 0.08, d.H * 0.07, d.sd, MUZZLE, 0.06, d.f * 0.6);
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.06, y: Y(d, 0.66) },
        { x: d.f * d.W * 0.1, y: Y(d, 0.76) },
        { x: d.f * d.W * 0.32, y: Y(d, 0.68) },
        { x: d.f * d.W * 0.29, y: Y(d, 0.58) },
      ],
      d.lk.playerDark,
    );
  },
  over: (d) => {
    // The zip down the chest from under the scarf, stuck open at the bottom.
    mark(
      d.s,
      ZIP,
      [
        { x: d.f * d.W * 0.24, y: Y(d, 0.58) },
        { x: d.f * d.W * 0.22, y: Y(d, 0.42) },
      ],
      0.5,
      d.sd,
      [0.1, 0.1],
    );
  },
  back: tail,
  front: (d) => {
    crest(d);
    hooves(d);
  },
  snout: (d) => {
    // A big nostril on the nose, and the goofy grin under it.
    spot(d.s, d.f * d.W * 0.55, Y(d, 0.75), 0.4, 0.45, d.sd + 3, d.lk.eye, 0.05);
    mouthMark(d, d.f * d.W * 0.5, Y(d, 0.68), 2, 'smile');
  },
  parts: ['shard', 'shard'],
};
