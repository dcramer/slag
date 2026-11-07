import type { P } from '../../ink';
import { eye, mouthMark } from '../faces';
import { type D, type KindArt, mark, oval, poly, toned, tonedOval, Y } from '../kit';

/**
 * The giant lady in the big hat (docs/characters/vampire.md): the tallest and slimmest of the cast, straight up
 * and down, a small pale head under a huge pale sun hat on a low flat crown with a dark band (no point: the mage's crown is bent
 * into one, on a small round body), its brim drooping at the back where it was sat on; a fitted gown falling to
 * the floor and flaring at the hem, hiding her feet, its hem torn at the front; pearls; and one hand raised out in
 * front, clear of her, with four long blade claws (the fifth is missing). A rendered kind draws from its frames
 * (src/render/cast/sprites/vampire/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#f2dcd4';
const SKIN_SH = '#d9bcb4';
const HAT = '#e4dccb';
const HAT_SH = '#cbc1ad';
const BAND = '#2e2a30';
const PEARL = '#f4f0e8';
const NAIL = '#b8b4c8';
const LIPS = '#c23a44';

/** The sun hat: a wide flat brim drooping down at the back, a low flat crown on it. */
function hat(d: D) {
  const W = d.W;
  const f = d.f;
  const x = d.bx(1) + f * W * 0.04;
  const y = Y(d, 0.975);
  const sway = d.wob * 0.2;
  const at = (u: number, v: number): P => ({ x: x + f * W * u, y: y + v });
  // The brim, front edge level and the back end bent down where it was sat on.
  toned(
    d.s,
    [
      at(1.02, -0.2 + sway * 0.3),
      at(0.62, -0.75),
      at(0, -0.95),
      at(-0.56, -0.8),
      at(-0.88, -0.3),
      at(-1.06, 0.9 + sway),
      at(-0.98, 1.5 + sway),
      at(-0.62, 0.6),
      at(0, 0.55),
      at(0.62, 0.45),
    ],
    HAT,
    HAT_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.4,
  );
  // The low flat crown.
  toned(d.s, [at(-0.26, -0.6), at(-0.24, -2.1), at(0.22, -2.3), at(0.28, -0.7)], HAT, HAT_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
  // Its dark band.
  poly(d.s, [at(-0.255, -0.62), at(-0.25, -1.15), at(0.26, -1.25), at(0.275, -0.72)], BAND);
}

/** The front arm: a long sleeve out from the shoulder, the hand up, four long blade claws fanned. */
function arm(d: D) {
  const W = d.W;
  const f = d.f;
  const reach = d.m === 'run' ? 0.1 : d.m === 'fall' ? -0.08 : 0;
  const sh = { x: d.bx(0.8) + f * W * 0.24, y: Y(d, 0.8) };
  const el = { x: d.bx(0.7) + f * W * (0.52 + reach), y: Y(d, 0.7 + reach * 0.4) };
  const hd = { x: d.bx(0.8) + f * W * (0.72 + reach), y: Y(d, 0.83 - reach) };
  const thick = 0.65;
  toned(
    d.s,
    [
      { x: sh.x - f * 0.2, y: sh.y - thick },
      { x: el.x + f * thick, y: el.y - thick * 0.4 },
      { x: hd.x + f * 0.4, y: hd.y },
      { x: hd.x - f * 0.5, y: hd.y + 0.3 },
      { x: el.x - f * thick * 0.6, y: el.y + thick },
      { x: sh.x - f * 0.2, y: sh.y + thick * 1.6 },
    ],
    d.lk.player,
    d.lk.playerDark,
    d.lk.ink,
    0.25,
    0.55 * d.k,
    0.3,
  );
  tonedOval(d.s, hd.x, hd.y - 0.3, 0.8, 0.6, 8, SKIN, SKIN_SH, d.lk.ink, 0.2, 0.4 * d.k, 0.2);
  // Four long nails, up and forward; the fifth was lost.
  for (const [i, a] of [-1.25, -0.95, -0.65, -0.35].entries()) {
    const ax = hd.x + f * (0.1 + i * 0.25);
    const ay = hd.y - 0.6;
    mark(
      d.s,
      d.lk.ink,
      [
        { x: ax, y: ay },
        { x: ax + f * Math.cos(a) * 3.2, y: ay + Math.sin(a) * 3.2 },
      ],
      0.7,
      i,
      [0.1, 0.9],
    );
    mark(
      d.s,
      NAIL,
      [
        { x: ax + f * Math.cos(a) * 0.6, y: ay + Math.sin(a) * 0.6 },
        { x: ax + f * Math.cos(a) * 3, y: ay + Math.sin(a) * 3 },
      ],
      0.42,
      i + 9,
      [0.1, 0.9],
    );
  }
}

export const art: KindArt = {
  size: [0.6, 1.5],
  // A small head on a slim neck, narrow shoulders and waist, the gown widening to the floor with a train behind and
  // a torn notch in the front of its hem.
  outline:
    'M 0.04 -1 C 0.16 -1 0.21 -0.95 0.19 -0.91 C 0.18 -0.88 0.13 -0.87 0.08 -0.87 L 0.08 -0.85 C 0.2 -0.85 0.3 -0.82 0.3 -0.77 C 0.29 -0.69 0.21 -0.65 0.18 -0.59 C 0.24 -0.51 0.26 -0.41 0.26 -0.31 C 0.28 -0.19 0.36 -0.08 0.42 0 L 0.26 0 L 0.19 -0.07 L 0.13 0 L -0.5 0 C -0.38 -0.1 -0.29 -0.2 -0.27 -0.32 C -0.25 -0.44 -0.24 -0.52 -0.18 -0.59 C -0.23 -0.65 -0.3 -0.7 -0.3 -0.77 C -0.3 -0.83 -0.2 -0.85 -0.06 -0.85 L -0.06 -0.88 C -0.13 -0.92 -0.11 -1 0.04 -1 Z',
  lift: 0,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0,
  // A slow, grand glide: no hop, a sway of the hem, upright.
  gait: (g) => (g.moving ? { rot: Math.sin(g.ph) * 0.03, pivot: 1, sx: 1 + Math.abs(Math.sin(g.ph)) * 0.02, upright: 0.85 } : {}),
  paintFace: (d) => {
    // One half-lidded eye in the brim's shade, looking down at everyone, and red lips.
    const x = d.f * d.W * 0.1;
    eye(d, x, Y(d, 0.935), 0.45);
    poly(d.s, oval(x, Y(d, 0.93) - 0.45, 0.6, 0.22, 6), SKIN_SH);
    if (d.m === 'cheer' || d.m === 'fall') mouthMark(d, d.f * d.W * 0.13, Y(d, 0.9), 0.9, 'none');
    else poly(d.s, oval(d.f * d.W * 0.13, Y(d, 0.9), 0.4, 0.22, 6), LIPS);
  },
  print: (d) => {
    // The face and neck in pale skin, the pearls round the neck.
    poly(d.s, oval(d.bx(0.95) + d.f * d.W * 0.05, Y(d, 0.935), d.W * 0.16, d.H * 0.07, 10), SKIN);
    poly(d.s, oval(d.bx(0.86) + d.f * d.W * 0.01, Y(d, 0.86), d.W * 0.09, d.H * 0.03, 8), SKIN);
    for (const u of [-0.14, -0.05, 0.04, 0.13]) poly(d.s, oval(d.bx(0.84) + d.f * d.W * u, Y(d, 0.835) + Math.abs(u) * -2, 0.45, 0.45, 6), PEARL);
  },
  front: (d) => {
    hat(d);
    arm(d);
  },
  parts: ['shard', 'shard'],
};
