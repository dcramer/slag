import { brows, eye, mouthMark } from '../faces';
import { band, type D, type KindArt, poly, toned, tonedOval, Y } from '../kit';

/**
 * The worm in the super suit (docs/CHARACTERS.md → Roster): a super suit with a hero's build, two big round
 * shoulder pads over a broad chest, a narrow belted waist, slim legs in big boots; out of its collar a thin bare pink
 * worm neck arcing forward once at the top, its head wider than the neck with two huge eyes standing up out of it
 * and a wide grin; and a small hair dryer held out in one hand like a raygun, clear of the body. A gun in the hand,
 * never a cannon worn on the forearm from the shoulder (the hunter's and the robot boy's). A rendered kind draws
 * from its frames (src/render/cast/sprites/worm/); this is what shows before they load, and on the hand-drawn sheets.
 */

const PINK = '#f19aa6';
const PINK_SH = '#d97f8d';
const WHITE = '#fbfaf6';
const WHITE_SH = '#d9d6ce';
const DRYER = '#9a9aa0';
const DRYER_SH = '#76767d';

/** The neck rising out of the collar and arcing forward, the head on its end, and the eyes standing up out of it. */
function worm(d: D) {
  const W = d.W;
  const f = d.f;
  const sway = d.wob * 0.5;
  // Whipped back on the run, stretched up on a jump.
  const lean = d.m === 'run' ? -0.05 : d.m === 'up' || d.m === 'cheer' ? -0.03 : 0;
  const x = (u: number) => f * W * u;
  toned(
    d.s,
    [
      { x: x(-0.02), y: Y(d, 0.56) },
      { x: x(-0.03 + lean * 0.4) + sway * 0.3, y: Y(d, 0.72) },
      { x: x(0.0 + lean * 0.8) + sway * 0.7, y: Y(d, 0.86) },
      { x: x(0.12 + lean) + sway, y: Y(d, 0.94) },
      { x: x(0.18 + lean) + sway, y: Y(d, 0.9) },
      { x: x(0.08 + lean * 0.8) + sway * 0.7, y: Y(d, 0.84) },
      { x: x(0.06 + lean * 0.4) + sway * 0.3, y: Y(d, 0.72) },
      { x: x(0.06), y: Y(d, 0.56) },
    ],
    PINK,
    PINK_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
  // The head, wider than the neck, pointing forward.
  tonedOval(d.s, x(0.26 + lean) + sway, Y(d, 0.93), W * 0.15, d.H * 0.055, 12, PINK, PINK_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
  // The huge eyes standing up out of its top.
  for (const [u, r] of [
    [0.22, 1.35],
    [0.33, 1.2],
  ] as const)
    tonedOval(d.s, x(u + lean) + sway, Y(d, 1.0), r, r * 1.1, 10, WHITE, WHITE_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
}

/** The small hair dryer held out like a raygun in the front hand: a round body, a barrel forward, the grip under it. */
function dryer(d: D, hx: number, hy: number) {
  const f = d.f;
  tonedOval(d.s, hx + f * 0.2, hy - 1.2, 1.3, 1.1, 10, DRYER, DRYER_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
  toned(
    d.s,
    [
      { x: hx + f * 0.8, y: hy - 2 },
      { x: hx + f * 3.4, y: hy - 1.8 },
      { x: hx + f * 3.4, y: hy - 0.6 },
      { x: hx + f * 0.8, y: hy - 0.5 },
    ],
    DRYER,
    DRYER_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.4,
  );
  poly(
    d.s,
    [
      { x: hx + f * 3.1, y: hy - 1.7 },
      { x: hx + f * 3.4, y: hy - 1.7 },
      { x: hx + f * 3.4, y: hy - 0.7 },
      { x: hx + f * 3.1, y: hy - 0.7 },
    ],
    d.lk.eye,
  );
}

export const art: KindArt = {
  size: [1.02, 1.28],
  // The suit is the bottom half: a narrow waist widening to a broad chest and two round shoulder pads at its top;
  // the worm rises out of its collar (drawn in `front`, so the neck stays thin and clear above the pads).
  outline:
    'M 0.14 0 C 0.16 -0.1 0.2 -0.2 0.28 -0.32 C 0.44 -0.34 0.54 -0.42 0.52 -0.5 C 0.5 -0.6 0.36 -0.62 0.26 -0.56 L 0.1 -0.58 C 0.06 -0.6 -0.02 -0.6 -0.06 -0.58 L -0.22 -0.56 C -0.34 -0.62 -0.48 -0.6 -0.52 -0.5 C -0.54 -0.42 -0.44 -0.34 -0.3 -0.32 C -0.22 -0.2 -0.16 -0.1 -0.14 0 Z',
  lift: 3.4,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0,
  // A hero's stride: a little hop on every step, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.4 + g.run * 0.4), sy: 1 - Math.abs(Math.sin(g.ph)) * 0.04, upright: 0.7 } : {}),
  paintFace: (d) => {
    const y = Y(d, 1.0);
    const xs = [d.f * d.W * 0.22, d.f * d.W * 0.33];
    eye(d, xs[0] + d.f * 0.3, y, 0.55);
    eye(d, xs[1] + d.f * 0.3, y, 0.5);
    brows(d, xs, y - 0.5, 0.55);
    // The wide grin along the head's front.
    mouthMark(d, d.f * d.W * 0.32, Y(d, 0.915), 2.2, 'smile');
  },
  print: (d) => {
    // The round shoulder pads a light of the suit, and the belt at the waist a dark of it.
    for (const sd of [-1, 1]) tonedOval(d.s, sd * d.W * 0.38, Y(d, 0.48), d.W * 0.15, d.H * 0.085, 12, d.lk.playerHi, d.lk.player, d.lk.ink, 0.1, 0.2, 0.6);
    band(d, 0.03, 0.09, d.lk.playerDark);
  },
  front: worm,
  tool: dryer,
  parts: ['shard', 'shard'],
};
