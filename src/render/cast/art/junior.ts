import type { KindArt } from '../kit';
import { mark, Y } from '../kit';
import { brows, eye } from '../faces';
import { oval, poly, toned, tonedOval } from '../../ink-figure';

/** Junior's own yellow (docs/characters/junior.md → Palette): the head, the arms and the claw, on every player. */
const YELLOW = '#fab214';
const YELLOW_SHADE = '#d9920c';
/** The legs and the headphones: a neutral dark purple-grey. */
const GREY = '#4e445c';
/** The antennae and the skates' wheels: a light steel, apart from the cap and the headphones. */
const STEEL = '#aaa6b4';

/**
 * Junior, Sentry's own robot: a square yellow box head as wide as the shoulders with one huge eye and a toothy
 * grin, a cap on backwards with its bill out behind, a zigzag antenna with a ball tip, headphone ears, a hoodie in
 * the player's colour, a claw hanging at the back hand and a phone held up in the front one, on roller skates. A
 * rendered kind draws from its frames (src/render/cast/sprites/junior/); this is what shows before they load, and
 * on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.86, 1],
  // The box head is the top half, square-cornered and as wide as the shoulders, the cap's bill a point out of its
  // back; the hoodie under it is narrow.
  outline:
    'M -0.3 -1 L 0.3 -1 C 0.38 -1 0.42 -0.96 0.42 -0.9 L 0.4 -0.56 L 0.26 -0.54 C 0.3 -0.36 0.3 -0.14 0.28 0 L -0.26 0 C -0.28 -0.14 -0.28 -0.36 -0.24 -0.54 L -0.4 -0.56 L -0.42 -0.86 L -0.6 -0.84 C -0.56 -0.9 -0.48 -0.94 -0.4 -0.96 C -0.38 -0.99 -0.34 -1 -0.3 -1 Z',
  lift: 3.2,
  feet: 'boot',
  arms: 'mitten',
  hands: 'glove',
  fill: 'player',
  faceX: 0.12,
  // A glide on the skates: little hop, a lean into the push.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.25, upright: 0.5 + g.run * 0.2 } : {}),
  paintFace: (d) => {
    // The one huge eye, and the big grin under it.
    const x = d.f * d.W * 0.12;
    const y = Y(d, 0.78);
    poly(d.s, oval(x, y, 2.4, 2.5, 12), '#eef3f3');
    eye(d, x + d.f * 0.3, y, 1.3);
    brows(d, [x], y - 0.6, 1.6);
    const gy = Y(d, 0.62);
    poly(
      d.s,
      [
        { x: x - 1.9, y: gy - 0.4 },
        { x: x + 1.9, y: gy - 0.4 },
        { x: x + 1.2, y: gy + 0.9 },
        { x: x - 1.2, y: gy + 0.9 },
      ],
      '#eef3f3',
    );
    mark(
      d.s,
      d.lk.ink,
      [
        { x: x - 1.6, y: gy + 0.2 },
        { x: x + 1.6, y: gy + 0.2 },
      ],
      0.4,
      d.sd,
      [0.2, 0.2],
    );
  },
  back: (d) => {
    // The antenna, a zigzag with a ball tip springing up off the cap's crown: the drawn kind keeps only this one, since three
    // spread round the head read as spiky hair or horns (docs/characters/junior.md → Rig).
    const spring = d.m === 'up' ? -1.2 : 0;
    const zig = (x0: number, y0: number, dx: number, dy: number) => {
      const pts = [
        { x: x0, y: y0 },
        { x: x0 + dx * 0.4, y: y0 + dy * 0.3 },
        { x: x0 + dx * 0.55, y: y0 + dy * 0.6 },
        { x: x0 + dx, y: y0 + dy },
      ];
      mark(d.s, STEEL, pts, 0.7, d.sd, [0.1, 0.1]);
      tonedOval(d.s, x0 + dx, y0 + dy, 1.1, 1.1, 8, STEEL, '#8a8696', d.lk.ink, 0.2, 0.4 * d.k, 0.2);
    };
    zig(d.f * d.W * 0.06, Y(d, 0.98), d.f * 3, -4 + spring);
    // The claw at the back hand, hanging low: a big yellow pincer, as big as the head, in a C.
    const cx = -d.f * d.W * 0.5;
    const cy = Y(d, 0.18);
    poly(d.s, oval(cx, cy, 2.2, 1.8, 9), YELLOW);
    mark(
      d.s,
      YELLOW,
      [
        { x: cx - d.f * 0.6, y: cy + 0.6 },
        { x: cx - d.f * 1.4, y: cy + 2.2 },
        { x: cx - d.f * 0.4, y: cy + 3 },
      ],
      1,
      d.sd,
      [0.2, 0.4],
    );
    mark(
      d.s,
      YELLOW,
      [
        { x: cx + d.f * 0.8, y: cy + 0.6 },
        { x: cx + d.f * 1.2, y: cy + 2.4 },
      ],
      1,
      d.sd + 1,
      [0.2, 0.4],
    );
  },
  front: (d) => {
    // The box head in Junior's yellow, the headphones at its sides, the cap on it backwards, its bill out behind.
    const top = Y(d, 1);
    const low = Y(d, 0.55);
    toned(
      d.s,
      [
        { x: -d.W * 0.4, y: top + 1.2 },
        { x: d.W * 0.42, y: top + 1.2 },
        { x: d.W * 0.4, y: low },
        { x: -d.W * 0.4, y: low },
      ],
      YELLOW,
      YELLOW_SHADE,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.5,
    );
    tonedOval(d.s, -d.f * d.W * 0.42, Y(d, 0.74), 1.2, 1.8, 10, GREY, '#3a3246', d.lk.ink, 0.3, 0.6 * d.k, 0.3);
    tonedOval(d.s, d.f * d.W * 0.43, Y(d, 0.76), 0.7, 1.5, 8, GREY, '#3a3246', d.lk.ink, 0.3, 0.6 * d.k, 0.3);
    toned(
      d.s,
      [
        { x: -d.f * d.W * 0.36, y: top + 1.6 },
        { x: -d.f * d.W * 0.3, y: top - 0.2 },
        { x: d.f * d.W * 0.3, y: top - 0.2 },
        { x: d.f * d.W * 0.38, y: top + 1.6 },
      ],
      d.lk.playerDark,
      d.lk.playerDark,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.3,
    );
    poly(
      d.s,
      [
        { x: -d.f * d.W * 0.3, y: top + 0.6 },
        { x: -d.f * d.W * 0.62, y: top + 1.5 },
        { x: -d.f * d.W * 0.3, y: top + 1.6 },
      ],
      d.lk.playerDark,
    );
  },
  tool: (d, hx, hy) => {
    // The phone, as tall as the head, held up in the front hand.
    toned(
      d.s,
      [
        { x: hx - 1.2, y: hy - 4.4 },
        { x: hx + 1.2, y: hy - 4.4 },
        { x: hx + 1.2, y: hy + 0.2 },
        { x: hx - 1.2, y: hy + 0.2 },
      ],
      GREY,
      GREY,
      d.lk.ink,
      0.25,
      0.5 * d.k,
      0.2,
    );
    poly(
      d.s,
      [
        { x: hx - 0.8, y: hy - 4 },
        { x: hx + 0.8, y: hy - 4 },
        { x: hx + 0.8, y: hy - 0.6 },
        { x: hx - 0.8, y: hy - 0.6 },
      ],
      '#eef3f3',
    );
  },
  boots: ['#5c3466', '#3e2246'],
  parts: ['shard', 'bolt', 'bolt'],
};
