import { brows, eye, mouthMark } from '../faces';
import { type D, type KindArt, mark, poly, spot, toned, tonedOval, Y } from '../kit';

/**
 * The worm in the super suit (docs/CHARACTERS.md → Roster): a bulky second-hand boiler suit stuffed out into two
 * huge round pillow shoulders on stocky legs, and out of its collar the worm itself, a thick bare pink neck rising
 * straight up like a pole, its blunt head on top with two bulging eyes on its front and a wide grin. Curled, the
 * neck read as a snout or a tail; thin, as nothing; with the eyes standing on top, as ears. The pistol is a big old
 * hair dryer held at the hip, its barrel forward and down: never level from the shoulder, the hunter's and the
 * robot boy's outline, and not tilted up in front of the chest, which made a capped, stocky outline. A rendered
 * kind draws from its frames (src/render/cast/sprites/worm/); this is what shows before they load, and on the
 * hand-drawn sheets.
 */

const PINK = '#f19aa6';
const PINK_SH = '#d97f8d';
const WHITE = '#fbfaf6';
const WHITE_SH = '#d9d6ce';
const DRYER = '#9a9aa0';
const DRYER_SH = '#76767d';

/** The worm's neck and head: the stalk out of the collar, swaying with the stride. */
function worm(d: D) {
  const W = d.W;
  const f = d.f;
  const sway = d.wob * 0.5;
  // Whipped back on the run, stretched up on a jump.
  const lean = d.m === 'run' ? -0.06 : d.m === 'up' || d.m === 'cheer' ? -0.03 : 0;
  const x = (u: number) => f * W * u;
  toned(
    d.s,
    [
      { x: x(-0.04), y: Y(d, 0.55) },
      { x: x(-0.04 + lean * 0.3) + sway * 0.3, y: Y(d, 0.74) },
      { x: x(-0.04 + lean * 0.7) + sway * 0.7, y: Y(d, 0.92) },
      { x: x(0.0 + lean) + sway, y: Y(d, 1.0) },
      { x: x(0.14 + lean) + sway, y: Y(d, 1.03) },
      { x: x(0.3 + lean) + sway, y: Y(d, 1.0) },
      { x: x(0.36 + lean) + sway, y: Y(d, 0.93) },
      { x: x(0.3 + lean) + sway, y: Y(d, 0.86) },
      { x: x(0.18 + lean * 0.7) + sway * 0.7, y: Y(d, 0.84) },
      { x: x(0.18 + lean * 0.3) + sway * 0.3, y: Y(d, 0.72) },
      { x: x(0.18), y: Y(d, 0.55) },
    ],
    PINK,
    PINK_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.3,
  );
  // The bulging eyes on the front of the blunt head.
  for (const [u, r] of [
    [0.2, 1.1],
    [0.3, 0.9],
  ] as const)
    tonedOval(d.s, x(u + lean) + sway, Y(d, 0.96), r, r * 1.1, 10, WHITE, WHITE_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
}

/** The hair dryer held at the hip, its fat barrel forward and a little down, the cord's stub off its grip. */
function dryer(d: D) {
  const f = d.f;
  const hx = f * d.W * 0.12;
  const hy = Y(d, 0.32);
  // Pointed forward and down; lower still on a fall.
  const dip = d.m === 'fall' ? 1 : 0.6;
  toned(
    d.s,
    [
      { x: hx - f * 1.6, y: hy - 1.8 },
      { x: hx + f * 1.2, y: hy - 1.9 },
      { x: hx + f * 7.6, y: hy - 1.4 + dip },
      { x: hx + f * 7.8, y: hy + 1.6 + dip },
      { x: hx + f * 1.2, y: hy + 1.6 },
      { x: hx - f * 1.6, y: hy + 1.5 },
    ],
    DRYER,
    DRYER_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.4,
  );
  // The dark nozzle, and the grip hanging under it.
  poly(
    d.s,
    [
      { x: hx + f * 7.2, y: hy - 1 + dip },
      { x: hx + f * 7.7, y: hy - 1 + dip },
      { x: hx + f * 7.8, y: hy + 1.2 + dip },
      { x: hx + f * 7.3, y: hy + 1.2 + dip },
    ],
    d.lk.eye,
  );
  toned(
    d.s,
    [
      { x: hx - f * 0.6, y: hy + 1.2 },
      { x: hx + f * 0.8, y: hy + 1.2 },
      { x: hx + f * 0.4, y: hy + 3.4 },
      { x: hx - f * 0.9, y: hy + 3.2 },
    ],
    DRYER_SH,
    DRYER_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
}

export const art: KindArt = {
  size: [1.04, 1.24],
  // The bulky suit is the bottom half, widest at its two round pillow shoulders; the worm rises out of its collar
  // (drawn in `front`, so the neck stays thin and clear above the shoulders).
  outline:
    'M 0.3 0 C 0.38 -0.12 0.4 -0.26 0.36 -0.34 C 0.48 -0.34 0.54 -0.42 0.52 -0.5 C 0.5 -0.58 0.36 -0.62 0.22 -0.56 L 0.16 -0.56 C 0.12 -0.58 0 -0.58 -0.04 -0.56 L -0.12 -0.56 C -0.26 -0.62 -0.46 -0.6 -0.52 -0.5 C -0.56 -0.42 -0.5 -0.34 -0.38 -0.34 C -0.42 -0.26 -0.4 -0.12 -0.32 0 Z',
  lift: 2.4,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0,
  // A heavy suit stomp: a short hop and a sag on every step, rocking about the boots.
  gait: (g) =>
    g.moving
      ? { hop: Math.abs(Math.sin(g.ph)) * (0.4 + g.run * 0.4), sy: 1 - Math.abs(Math.sin(g.ph)) * 0.05, rot: Math.sin(g.ph) * 0.03, pivot: 0, upright: 0.7 }
      : {},
  paintFace: (d) => {
    const y = Y(d, 0.96);
    const xs = [d.f * d.W * 0.2, d.f * d.W * 0.3];
    eye(d, xs[0] + d.f * 0.3, y, 0.5);
    eye(d, xs[1] + d.f * 0.3, y, 0.45);
    brows(d, xs, y - 0.3, 0.5);
    // The wide grin along the head's underside.
    mouthMark(d, d.f * d.W * 0.26, Y(d, 0.885), 2.2, 'smile');
  },
  print: (d) => {
    // The pillow shoulders, a little lighter than the suit, a paler patch stitched over the far one.
    for (const sd of [-1, 1]) tonedOval(d.s, sd * d.W * 0.36, Y(d, 0.48), d.W * 0.17, d.H * 0.09, 12, d.lk.playerHi, d.lk.player, d.lk.ink, 0.1, 0.2, 0.6);
    spot(d.s, -d.f * d.W * 0.36, Y(d, 0.5), 1.3, 1.1, d.sd, d.lk.playerHi, 0.08, 0.3);
  },
  over: (d) => {
    // The collar's dark mouth, where the worm comes out of the suit.
    mark(
      d.s,
      d.lk.playerDark,
      [
        { x: -d.f * d.W * 0.06, y: Y(d, 0.56) },
        { x: d.f * d.W * 0.18, y: Y(d, 0.56) },
      ],
      0.9,
      d.sd,
      [0.2, 0.2],
    );
  },
  front: (d) => {
    worm(d);
    dryer(d);
  },
  parts: ['shard', 'shard'],
};
