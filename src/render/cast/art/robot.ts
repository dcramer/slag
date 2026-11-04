import type { KindArt } from '../kit';
import { band, mark, Y } from '../kit';
import { pair } from '../faces';
import { oval, poly, toned, tonedOval } from '../../ink-figure';

/**
 * The robot boy from the parts bin: a big round helmet with a stripe and an ear disc, the face in its
 * opening, a small light suit on big boots, a tin-can arm cannon held out front and a battery on his back.
 * Small where the hunter is broad at the shoulders; one round helmet where the speedster's quills sweep
 * back. A rendered kind draws from its frames (src/render/cast/sprites/robot/); this is what shows before
 * they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.88, 0.96],
  // The helmet is the top half and wider than everything under it; the body under it is narrow.
  outline:
    'M 0.02 -1 C 0.3 -1 0.46 -0.84 0.46 -0.68 C 0.46 -0.54 0.36 -0.44 0.22 -0.42 C 0.22 -0.28 0.24 -0.12 0.22 0 L -0.2 0 C -0.22 -0.12 -0.2 -0.28 -0.2 -0.42 C -0.36 -0.44 -0.46 -0.54 -0.46 -0.68 C -0.46 -0.86 -0.28 -1 0.02 -1 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.14,
  // A bouncy run on the big boots.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.6 + g.run * 0.4), sy: 1 - Math.abs(Math.sin(g.ph)) * 0.04, upright: 0.7 } : {}),
  paintFace: (d) => pair(d, 0.7, 0.1, 0.72, 'smile', 0.13),
  back: (d) => {
    // The battery strapped upright on his back, its brass cap above.
    const x = -d.f * d.W * 0.34;
    const pts = [
      { x: x - 1.7, y: Y(d, 0.52) },
      { x: x + 1.7, y: Y(d, 0.52) },
      { x: x + 1.7, y: Y(d, 0.1) },
      { x: x - 1.7, y: Y(d, 0.1) },
    ];
    toned(d.s, pts, '#3a3a42', '#26262c', d.lk.ink, 0.35, 0.7 * d.k, 0.5);
    poly(
      d.s,
      [
        { x: x - 1.5, y: Y(d, 0.52) + 0.2 },
        { x: x + 1.5, y: Y(d, 0.52) + 0.2 },
        { x: x + 1.5, y: Y(d, 0.42) },
        { x: x - 1.5, y: Y(d, 0.42) },
      ],
      '#c99a4a',
    );
  },
  print: (d) => {
    // The suit, a light tone of the helmet under it, and the helmet's stripe over the crown.
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
    // The ear disc on the helmet's near side, and the face's opening.
    tonedOval(d.s, -d.f * d.W * 0.3, Y(d, 0.68), 1.7, 1.9, 10, d.lk.playerShade, d.lk.playerDark, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
    tonedOval(d.s, d.f * d.W * 0.14, Y(d, 0.68), 2.9, 3.1, 12, '#f3d0aa', '#dcae86', d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    // The tin-can cannon held out level at chest height, its open end dark and a band of label round it.
    const up = d.m === 'up' ? -1 : 0;
    const x0 = d.f * d.W * 0.12;
    const x1 = x0 + d.f * 4.6;
    const y = Y(d, 0.3);
    const can = [
      { x: x0, y: y - 1.8 },
      { x: x1, y: y - 1.8 + up },
      { x: x1, y: y + 1.8 + up },
      { x: x0, y: y + 1.8 },
    ];
    toned(d.s, can, '#c9ccd2', '#9ea2aa', d.lk.ink, 0.35, 0.7 * d.k, 0.5);
    const mx = (x0 + x1) / 2;
    poly(
      d.s,
      [
        { x: mx - d.f * 0.8, y: y - 1.5 + up / 2 },
        { x: mx + d.f * 0.8, y: y - 1.5 + up / 2 },
        { x: mx + d.f * 0.8, y: y + 1.5 + up / 2 },
        { x: mx - d.f * 0.8, y: y + 1.5 + up / 2 },
      ],
      d.lk.player,
    );
    poly(d.s, oval(x1, y + up, 0.7, 1.5, 8), '#4a3f3c');
  },
  parts: ['shard', 'shard', 'bolt'],
};
