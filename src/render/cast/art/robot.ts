import type { KindArt } from '../kit';
import { band, mark, Y } from '../kit';
import { pair } from '../faces';
import { oval, poly, toned, tonedOval } from '../../ink-figure';

/**
 * The robot boy from the parts bin: a big round helmet with a ridge down it and an ear disc standing proud of
 * its back, the face in its opening inside a grey rim, a small light suit on big boots, and the forearm itself
 * the cannon, a thick taped tin can held out level. Small where the hunter is tall and broad at the shoulders;
 * one round helmet where the speedster's quills sweep back. A rendered kind draws from its frames
 * (src/render/cast/sprites/robot/); this is what shows before they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.88, 0.96],
  // The helmet is the top half and wider than everything under it, its ear disc a bump out of its back; the
  // body under it is small.
  outline:
    'M 0.04 -1 C 0.32 -1 0.46 -0.84 0.46 -0.68 C 0.46 -0.54 0.36 -0.44 0.22 -0.42 C 0.2 -0.3 0.22 -0.14 0.24 0 L -0.22 0 C -0.2 -0.14 -0.18 -0.3 -0.18 -0.42 C -0.32 -0.44 -0.42 -0.5 -0.44 -0.56 C -0.6 -0.54 -0.62 -0.82 -0.44 -0.8 C -0.4 -0.92 -0.24 -1 0.04 -1 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.14,
  // A bouncy run on the big boots.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.6 + g.run * 0.4), sy: 1 - Math.abs(Math.sin(g.ph)) * 0.04, upright: 0.7 } : {}),
  paintFace: (d) => pair(d, 0.7, 0.1, 0.72, 'smile', 0.13),
  print: (d) => {
    // The suit, a light tone of the helmet over it, and the ridge down the helmet's middle.
    band(d, -0.1, 0.42, d.lk.playerHi);
    mark(
      d.s,
      d.lk.playerHi,
      [
        { x: d.f * d.W * 0.02, y: Y(d, 0.99) },
        { x: d.f * d.W * 0.14, y: Y(d, 0.9) },
        { x: d.f * d.W * 0.2, y: Y(d, 0.8) },
      ],
      1.3,
      d.sd,
      [0.1, 0.5],
    );
  },
  front: (d) => {
    // The ear disc standing out of the helmet's back, and the face's opening ringed in grey: pale, so on an
    // orange or a gold helmet it stays a shape of its own.
    tonedOval(d.s, -d.f * d.W * 0.46, Y(d, 0.68), 1.6, 2.1, 10, d.lk.playerShade, d.lk.playerDark, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
    tonedOval(d.s, d.f * d.W * 0.14, Y(d, 0.68), 3.4, 3.6, 12, '#4a4c55', '#3a3c44', d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    tonedOval(d.s, d.f * d.W * 0.15, Y(d, 0.67), 2.7, 2.9, 12, '#f7e7d6', '#e6d2bc', d.lk.ink, 0.2, 0.5 * d.k, 0.4);
    // The forearm is the cannon: a thick tin can held out level at shoulder height, taped on at its root, its
    // open end dark.
    const up = d.m === 'up' ? -1 : 0;
    const x0 = d.f * d.W * 0.26;
    const x1 = x0 + d.f * 6;
    const y = Y(d, 0.34);
    const can = [
      { x: x0, y: y - 2 },
      { x: x1, y: y - 2 + up },
      { x: x1, y: y + 2 + up },
      { x: x0, y: y + 2 },
    ];
    toned(d.s, can, d.lk.playerDark, d.lk.ink, d.lk.ink, 0.35, 0.7 * d.k, 0.5);
    poly(
      d.s,
      [
        { x: x0, y: y - 1.7 },
        { x: x0 + d.f * 1.3, y: y - 1.7 + up / 4 },
        { x: x0 + d.f * 1.3, y: y + 1.7 + up / 4 },
        { x: x0, y: y + 1.7 },
      ],
      '#c9ccd2',
    );
    poly(d.s, oval(x1, y + up, 0.8, 1.7, 8), '#2b2d38');
  },
  parts: ['shard', 'shard', 'bolt'],
};
