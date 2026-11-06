import type { P } from '../../ink';
import { eye, mouthMark } from '../faces';
import { type D, type KindArt, mark, oval, poly, toned, tonedOval, Y } from '../kit';

/**
 * The succubus with bat wings on her head (docs/characters/succubus.md), in a party-shop costume: slim and
 * long-legged with a hand on her hip, two big ribbed bat wings off the sides of her head spread up and out like a
 * crest with background between them and her hair (the read: touching the head they're ears, narrow the stinger's
 * horns), a smaller dark pair of felt wings at her back on bent coat hangers, one drooping, big dark hair down her
 * back, a strapless bodysuit, black tights and fuzzy slippers. A rendered kind draws from its frames
 * (src/render/cast/sprites/succubus/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#f8c6a8';
const SKIN_SH = '#dca88c';
const HAIR = '#3e424e';
const TIGHTS = '#36322f';
const SLIPPER = '#f2e6cc';
const SLIPPER_SH = '#d8c8a8';
const WIRE = '#96969c';

/**
 * One bat wing off the head, from its base at the temple: the leading edge up and out to its tip, then three
 * scallops back to the base, each point on a rib. `side` 1 spreads it toward where she faces, -1 behind.
 */
function headWing(d: D, side: number) {
  const f = d.f * side;
  const flap = d.m === 'up' ? -0.5 : d.m === 'fall' ? 0.4 : Math.sin(d.t * 3) * 0.12;
  const b: P = { x: d.bx(0.95) + d.f * d.W * 0.04 + f * d.W * 0.14, y: Y(d, 0.95) };
  const at = (u: number, v: number): P => ({ x: b.x + f * u, y: b.y + v + (u > 1 ? flap * (u / 4) : 0) });
  const tip = at(4.2, -5.4);
  const pts = [
    at(0, 0.3),
    at(0.3, -1.6),
    at(1.6, -3.8),
    tip,
    at(3.2, -3.9),
    at(4.4, -2.9),
    at(3.1, -2.6),
    at(3.7, -1.5),
    at(2.3, -1.4),
    at(2.2, -0.3),
    at(0.9, -0.2),
  ];
  toned(d.s, pts, d.lk.playerHi, d.lk.player, d.lk.ink, 0.3, 0.6 * d.k, 0.35);
  // The ribs, from the base out to each point: a fan reads as a wing, a smooth crescent as a horn.
  for (const [i, q] of [tip, at(4.4, -2.9), at(3.7, -1.5)].entries()) mark(d.s, d.lk.ink, [at(0.4, -0.4), q], 0.3, i, [0.3, 0.7]);
}

/** A felt wing at her back on its coat hanger: smaller than the head's, dark, the back one drooping. */
function backWing(d: D, side: number) {
  const f = d.f * side;
  const droop = side < 0 ? 1.6 : 0;
  const b: P = { x: d.bx(0.75) - d.f * d.W * 0.08, y: Y(d, 0.76) };
  const at = (u: number, v: number): P => ({ x: b.x + f * u, y: b.y + v + droop * (u / 4) });
  const pts = [at(0, -0.6), at(2.6, -2.9), at(5.6, -3.6), at(5.2, -1.2), at(4.3, -1.3), at(4.0, 0.6), at(2.9, -0.1), at(2.4, 1.7), at(1.2, 0.9), at(0, 1.4)];
  toned(d.s, pts, d.lk.playerDark, d.lk.playerDark, d.lk.ink, 0.3, 0.6 * d.k, 0.2);
  // The hanger's wire along the top edge and its hook poking up.
  mark(d.s, WIRE, [at(0.2, -0.8), at(2.6, -3.1), at(5.4, -3.8)], 0.35, side + 5, [0.1, 0.1]);
  if (side < 0) mark(d.s, WIRE, [at(2.6, -3.1), at(2.5, -4.1), at(3.2, -4.3)], 0.3, 7, [0.1, 0.1]);
}

/** The fuzzy slippers, the front one a bunny with two ears. */
function slippers(d: D) {
  const f = d.f;
  const walk = d.m === 'walk' || d.m === 'run' ? Math.sin(d.ph) * 0.8 : 0;
  for (const [u, lift] of [
    [-0.1, Math.max(0, walk)],
    [0.13, Math.max(0, -walk)],
  ] as const) {
    const x = f * d.W * u;
    tonedOval(d.s, x + f * 0.7, -0.9 - lift, 1.9, 1.1, 10, SLIPPER, SLIPPER_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    if (u > 0 && d.detail)
      for (const e of [0.2, 0.9])
        mark(
          d.s,
          SLIPPER_SH,
          [
            { x: x + f * (0.6 + e), y: -1.6 - lift },
            { x: x + f * (0.3 + e), y: -3 - lift },
          ],
          0.5,
          e * 9,
          [0.2, 0.4],
        );
  }
}

export const art: KindArt = {
  size: [0.62, 1.42],
  // A small head, the big hair falling down her back to the waist, narrow shoulders, the back arm's elbow out
  // where her hand is on her hip, a narrow waist, and two long thin legs apart with background between.
  outline:
    'M 0.03 -1 C 0.15 -1 0.22 -0.96 0.22 -0.9 C 0.22 -0.86 0.17 -0.84 0.11 -0.84 L 0.09 -0.82 C 0.2 -0.81 0.26 -0.79 0.27 -0.74 C 0.29 -0.66 0.3 -0.56 0.27 -0.5 L 0.21 -0.5 C 0.22 -0.4 0.2 -0.26 0.18 -0.14 L 0.17 0 L 0.06 0 L 0.05 -0.3 L 0.0 -0.4 L -0.05 -0.3 L -0.08 0 L -0.19 0 C -0.21 -0.18 -0.22 -0.36 -0.2 -0.5 L -0.25 -0.55 L -0.48 -0.62 L -0.44 -0.68 C -0.5 -0.78 -0.46 -0.94 -0.32 -0.98 C -0.22 -1.01 -0.08 -1.01 0.03 -1 Z',
  lift: 0,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0,
  // A strut on her toes: a little hop and a sway of the hips.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.4, rot: Math.sin(g.ph) * 0.025, pivot: 0.5, upright: 0.8 } : {}),
  paintFace: (d) => {
    // One half-lidded eye, cocky, and a smirk.
    const x = d.f * d.W * 0.12;
    eye(d, x, Y(d, 0.925), 0.45);
    poly(d.s, oval(x, Y(d, 0.925) - 0.45, 0.6, 0.2, 6), SKIN_SH);
    mouthMark(d, d.f * d.W * 0.15, Y(d, 0.88), 0.8, d.m === 'fall' ? 'none' : 'smile');
  },
  back: (d) => {
    backWing(d, -1);
    backWing(d, 1);
  },
  print: (d) => {
    // The tights below the bodysuit's leg line, the skin of her face, neck, shoulders and arms, and the hair over
    // the back of her head and down her back.
    poly(
      d.s,
      [
        { x: -d.W * 0.6, y: Y(d, 0.47) },
        { x: d.W * 0.6, y: Y(d, 0.53) },
        { x: d.W * 0.6, y: 0.5 },
        { x: -d.W * 0.6, y: 0.5 },
      ],
      TIGHTS,
    );
    // Bare shoulders over the strapless bodysuit, the front arm hanging at her side, the back one bent to her hip.
    poly(
      d.s,
      [
        { x: -d.W * 0.6, y: Y(d, 0.84) },
        { x: d.W * 0.6, y: Y(d, 0.84) },
        { x: d.W * 0.6, y: Y(d, 0.74) },
        { x: d.f * d.W * 0.08, y: Y(d, 0.76) },
        { x: -d.W * 0.6, y: Y(d, 0.73) },
      ],
      SKIN,
    );
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.19, y: Y(d, 0.8) },
        { x: d.f * d.W * 0.34, y: Y(d, 0.8) },
        { x: d.f * d.W * 0.34, y: Y(d, 0.46) },
        { x: d.f * d.W * 0.2, y: Y(d, 0.5) },
      ],
      SKIN,
    );
    poly(
      d.s,
      [
        { x: -d.f * d.W * 0.2, y: Y(d, 0.78) },
        { x: -d.f * d.W * 0.5, y: Y(d, 0.63) },
        { x: -d.f * d.W * 0.22, y: Y(d, 0.53) },
        { x: -d.f * d.W * 0.18, y: Y(d, 0.58) },
        { x: -d.f * d.W * 0.36, y: Y(d, 0.63) },
        { x: -d.f * d.W * 0.14, y: Y(d, 0.74) },
      ],
      SKIN,
    );
    poly(d.s, oval(d.f * d.W * 0.1, Y(d, 0.91), d.W * 0.14, d.H * 0.065, 10), SKIN);
    // The big hair over the back of her head and down her back past the shoulder blades.
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.05, y: Y(d, 1.02) },
        { x: d.f * d.W * 0.2, y: Y(d, 0.97) },
        { x: d.f * d.W * 0.02, y: Y(d, 0.94) },
        { x: -d.f * d.W * 0.06, y: Y(d, 0.86) },
        { x: -d.f * d.W * 0.14, y: Y(d, 0.78) },
        { x: -d.f * d.W * 0.2, y: Y(d, 0.68) },
        { x: -d.f * d.W * 0.6, y: Y(d, 0.66) },
        { x: -d.f * d.W * 0.6, y: Y(d, 1.02) },
      ],
      HAIR,
    );
  },
  front: (d) => {
    headWing(d, -1);
    headWing(d, 1);
    slippers(d);
  },
  parts: ['shard', 'shard'],
};
