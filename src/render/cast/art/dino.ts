import type { KindArt } from '../kit';
import { brows, eye } from '../faces';
import { mark, oval, poly, spot, toned, Y } from '../kit';

const CREAM = '#f6f2e8';
const SEAT = '#3d3d42';
const SEAT_SH = '#2a2a2e';
const CHROME = '#c9ccd2';
const BELT = '#6b4a35';
const BAG = '#c9c6bd';
const BAG_SH = '#a8a49a';

/**
 * The green saddled dino (docs/characters/dino.md), hand-inked from its drawn design: an upright body
 * under a huge round snout well out in front, two big eyes on top of the head, a long tail straight out
 * behind, and the twist, a torn black bicycle seat strapped low on its back with its chrome stem poking
 * out. The body is the player's colour, the head spikes a light of it; the belly, cheeks and eye whites
 * stay cream. A rendered kind draws from its frames (src/render/cast/sprites/); this is what shows before
 * they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.86, 1],
  outline:
    'M 0 -1 C 0.14 -1.02 0.22 -0.96 0.24 -0.9 C 0.4 -0.94 0.58 -0.86 0.58 -0.72 C 0.58 -0.58 0.46 -0.54 0.32 -0.56 C 0.28 -0.5 0.36 -0.42 0.36 -0.3 C 0.36 -0.1 0.26 0 0.1 0 L -0.2 0 C -0.3 0 -0.34 -0.06 -0.36 -0.12 C -0.5 -0.12 -0.64 -0.14 -0.74 -0.2 C -0.62 -0.26 -0.48 -0.3 -0.36 -0.36 C -0.36 -0.5 -0.3 -0.6 -0.22 -0.66 C -0.26 -0.8 -0.2 -0.98 0 -1 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.06,
  // A happy trot: the head bobs on every step.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.9, rot: Math.sin(g.ph) * 0.03, pivot: 0, bend: 0.04 } : {}),
  paintFace: (d) => {
    // The eyes on top of the head, close together, whites standing proud of the crown.
    const y = Y(d, 0.9);
    const xs = [-1, 1].map((sd) => d.f * (d.W * 0.02 + sd * d.W * 0.1));
    for (const x of xs) {
      poly(d.s, oval(x, y, 1.15, 1.6, 10), CREAM);
      eye(d, x + d.f * 0.35, y + 0.2, 0.62);
    }
    brows(d, xs, y - 0.6, 0.9);
  },
  print: (d) => {
    // The cream belly down the front, and the cheek under the eyes.
    spot(d.s, d.f * d.W * 0.14, Y(d, 0.28), d.W * 0.2, d.H * 0.24, d.sd, CREAM, 0.08);
    spot(d.s, -d.f * d.W * 0.02, Y(d, 0.66), d.W * 0.14, d.H * 0.09, d.sd + 3, CREAM, 0.1);
    // The belt that straps the seat on.
    mark(
      d.s,
      BELT,
      [
        { x: -d.f * d.W * 0.4, y: Y(d, 0.42) },
        { x: d.f * d.W * 0.36, y: Y(d, 0.38) },
      ],
      1.1,
      d.sd,
      [0.05, 0.05],
    );
  },
  front: (d) => {
    // Three round spikes down the back of the head, a light of the body.
    for (const [u, w] of [
      [0.84, 0.75],
      [0.75, 0.85],
      [0.66, 0.75],
    ] as const) {
      const x = d.bx(u) - d.f * d.W * 0.34;
      const y = Y(d, u);
      toned(d.s, oval(x - d.f * 0.6, y, w, w * 1.05, 8), d.lk.playerHi, d.lk.player, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
    }
    // The torn bicycle seat, low on the back, its chrome stem poking out under it.
    const sx = d.bx(0.44) - d.f * d.W * 0.4;
    const sy = Y(d, 0.46);
    mark(
      d.s,
      CHROME,
      [
        { x: sx, y: sy },
        { x: sx - d.f * 1.2, y: sy + 2.6 },
      ],
      0.8,
      d.sd + 1,
      [0.1, 0.1],
    );
    toned(
      d.s,
      [
        { x: sx - d.f * 2.6, y: sy - 1.4 },
        { x: sx + d.f * 0.6, y: sy - 1.6 },
        { x: sx + d.f * 3, y: sy - 0.8 },
        { x: sx + d.f * 2.6, y: sy + 0.2 },
        { x: sx - d.f * 2.4, y: sy + 0.4 },
      ],
      SEAT,
      SEAT_SH,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.4,
    );
  },
  tool: (d, hx, hy) => {
    // The carrier bag with its spotted egg, swinging under the front hand.
    const x = hx + d.f * 0.4 + d.wob * 0.15;
    const y = hy + 2.6;
    poly(d.s, oval(x, y - 1.6, 1.1, 1.2, 8), CREAM);
    toned(
      d.s,
      [
        { x: x - 1.6, y: y - 1.6 },
        { x: x + 1.6, y: y - 1.6 },
        { x: x + 2, y: y + 1.4 },
        { x: x, y: y + 2.2 },
        { x: x - 2, y: y + 1.4 },
      ],
      BAG,
      BAG_SH,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.4,
    );
  },
  parts: ['shard', 'shard'],
};
