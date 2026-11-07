import type { KindArt } from '../kit';
import { band, mark, oval, poly, tonedOval, Y } from '../kit';
import { pair } from '../faces';

/**
 * The garage-knock-off bomber (docs/characters/bomber.md): a huge round helmet that is an upturned white paint bucket,
 * as wide as he is, a ping-pong ball on a spring standing up off its crown, a dark face slot with two eyes; a small
 * suit with a belt on big boots, and a charcoal bowling ball with a lit shoelace fuse held low ahead. The suit and the
 * paint dripped down the bucket are the player's colour; the bucket, the slot, the ball and the boots are neutrals. A
 * rendered kind draws from its frames (src/render/cast/sprites/bomber/); this is what shows before they load, and on the
 * hand-drawn sheets.
 */

const BUCKET = '#f2f0e6';
const RIM = '#d8d4c4';
const SLOT = '#33343b';
const PING = '#f08a3c';
const STEEL = '#9a9e98';
const BALL = '#4c4e58';
const BALL_SH = '#3a3b44';
const SPARK = '#f8d848';

export const art: KindArt = {
  size: [0.9, 1],
  // The ping-pong ball on its spring is the top tenth, standing clear of the bucket; the bucket is the next half,
  // wider than everything under it, its rolled rim a lip at its bottom; the small suit under it.
  outline:
    'M 0 -1 C 0.06 -1 0.09 -0.96 0.09 -0.93 C 0.09 -0.9 0.06 -0.88 0.03 -0.87 L 0.03 -0.82 C 0.28 -0.81 0.44 -0.72 0.47 -0.56 C 0.49 -0.48 0.5 -0.44 0.48 -0.42 C 0.4 -0.4 0.3 -0.4 0.22 -0.4 C 0.24 -0.26 0.25 -0.12 0.24 0 L -0.22 0 C -0.23 -0.12 -0.22 -0.26 -0.2 -0.4 C -0.3 -0.4 -0.42 -0.4 -0.48 -0.42 C -0.5 -0.46 -0.48 -0.5 -0.46 -0.56 C -0.42 -0.72 -0.26 -0.81 -0.03 -0.82 L -0.03 -0.87 C -0.06 -0.88 -0.09 -0.9 -0.09 -0.93 C -0.09 -0.96 -0.06 -1 0 -1 Z',
  lift: 2.4,
  feet: 'boot',
  arms: 'mitten',
  hands: 'glove',
  boots: ['#cfcdc8', '#a9a7a2'],
  fill: 'player',
  faceX: 0.12,
  // A quick, bouncy trot.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph * 1.2)) * (0.5 + g.run * 0.3), sy: 1 - Math.abs(Math.sin(g.ph * 1.2)) * 0.05, upright: 0.65 } : {}),
  paintFace: (d) => pair(d, 0.6, 0.11, 0.6),
  // After the body's shade, so the bucket stays white on every suit: under it, the shade tinted it the player's colour.
  over: (d) => {
    const x = (u: number) => d.f * d.W * u;
    // The bucket, its rolled rim, and the ping-pong ball over the spring.
    band(d, 0.4, 0.88, BUCKET);
    band(d, 0.4, 0.45, RIM);
    band(d, 0.82, 0.88, STEEL);
    band(d, 0.88, 1.01, PING);
    // His own paint, dripped down the back of the bucket.
    for (const [u, v] of [
      [-0.34, 0.6],
      [-0.24, 0.66],
    ] as const)
      mark(
        d.s,
        d.lk.player,
        [
          { x: x(u), y: Y(d, 0.8) },
          { x: x(u), y: Y(d, v) },
        ],
        1.1,
        d.sd,
        [0, 0.2],
      );
    // The belt, a dark of the suit.
    band(d, 0.18, 0.24, d.lk.playerDark);
  },
  front: (d) => {
    // The dark face slot across the bucket's front, its eyes painted on it.
    tonedOval(d.s, d.f * d.W * 0.12, Y(d, 0.6), d.W * 0.32, d.H * 0.12, 12, SLOT, SLOT, d.lk.ink, 0.25, 0.5 * d.k, 0.3);
  },
  tool: (d, hx, hy) => {
    // The bowling ball held low ahead, its finger holes, and the shoelace fuse lit at its top.
    const bx = hx + d.f * 1.6;
    const by = hy - 0.6;
    tonedOval(d.s, bx, by, 2.4, 2.4, 12, BALL, BALL_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    for (const [u, v] of [
      [0.4, -0.6],
      [0.9, -0.2],
      [0.5, 0.4],
    ] as const)
      poly(d.s, oval(bx + d.f * u, by + v, 0.3, 0.3, 6), BALL_SH);
    mark(
      d.s,
      BUCKET,
      [
        { x: bx, y: by - 2.3 },
        { x: bx + d.f * 0.4, y: by - 3.4 },
      ],
      0.5,
      d.sd,
      [0, 0],
    );
    poly(d.s, oval(bx + d.f * 0.5, by - 3.7, 0.6, 0.6, 7), SPARK);
  },
  parts: ['shard', 'shard', 'bolt'],
};
