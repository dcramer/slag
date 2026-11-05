import type { KindArt } from '../kit';
import { Y } from '../kit';
import { pair } from '../faces';
import { line } from '../../ink';
import { oval, poly, toned, tonedOval } from '../../ink-figure';

const CANVAS = '#d4d0c6';
const CANVAS_SH = '#b8b2a6';
const SOLE = '#8e8a84';
const WHITE = '#f8f4ec';

/**
 * The snouted cube hopper: a round ball with no arms, two big eyes standing up out of its top, and a long tube
 * snout sticking straight out front, flared at its open end; two short legs in worn old trainers, kept together,
 * because he hops and never walks. Ours: the snout is a paper party blower whose streamer unrolls on the cheer.
 * The snout and no arms part him from the puffball's plain ball on feet. A rendered kind draws from its frames
 * (src/render/cast/sprites/hopper/); this is what shows before they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.96, 0.9],
  // The ball, the two eye bumps on its crown, and the snout out of its middle to the flared open end.
  outline:
    'M -0.08 0 C -0.34 0 -0.5 -0.2 -0.5 -0.46 C -0.5 -0.68 -0.4 -0.82 -0.24 -0.88 C -0.28 -1.02 -0.02 -1.06 0 -0.92 C 0.04 -1.04 0.28 -1.02 0.26 -0.86 C 0.32 -0.78 0.35 -0.66 0.35 -0.56 L 0.72 -0.56 C 0.78 -0.6 0.84 -0.68 0.88 -0.68 L 0.9 -0.32 C 0.84 -0.32 0.78 -0.4 0.72 -0.44 L 0.35 -0.44 C 0.32 -0.18 0.16 0 -0.08 0 Z',
  lift: 3.4,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  // Both feet together: the whole figure hops on every step, higher on the run.
  gait: (g) => {
    if (!g.moving) return {};
    const k = Math.abs(Math.sin(g.ph * 0.8));
    return { hop: k * (1.4 + g.run * 1.4), sy: 1 + k * 0.04, sx: 1 - k * 0.03, upright: 0.6 };
  },
  paintFace: (d) => pair(d, 0.92, 0.125, 0.62),
  back: (d) => {
    // Two short legs and the worn trainers, side by side: tucked up off the ground in the air.
    const { s, f, lk } = d;
    const tuck = d.m === 'up' || d.m === 'fall' ? -1.2 : 0;
    for (const side of [-1, 1]) {
      const fx = side * d.W * 0.14 - f * 0.4;
      const fy = -1.5 + tuck;
      s.fillStyle = lk.ink;
      line(s, side * d.W * 0.08, d.by + 0.6, fx, fy - 0.6, { w: 1.9, seed: side, taper: [0, 0], press: 0 });
      s.fillStyle = lk.fill;
      line(s, side * d.W * 0.08, d.by + 0.6, fx, fy - 0.6, { w: 1.1, seed: side, taper: [0, 0], press: 0 });
      toned(
        s,
        [
          { x: fx - f * 1.6, y: fy - 0.9 },
          { x: fx + f * 1.4, y: fy - 1.2 },
          { x: fx + f * 3.2, y: fy + 0.2 },
          { x: fx + f * 3, y: fy + 1.3 },
          { x: fx - f * 1.7, y: fy + 1.3 },
        ],
        CANVAS,
        CANVAS_SH,
        lk.ink,
        0.4,
        0.7 * d.k,
        0.4,
      );
      poly(
        s,
        [
          { x: fx - f * 1.6, y: fy + 0.7 },
          { x: fx + f * 3.1, y: fy + 0.7 },
          { x: fx + f * 3, y: fy + 1.2 },
          { x: fx - f * 1.6, y: fy + 1.2 },
        ],
        SOLE,
      );
    }
  },
  front: (d) => {
    const { s, f, lk, W } = d;
    // The big eye whites, standing up out of the crown.
    for (const sd of [-1, 1]) tonedOval(s, sd * W * 0.125 + f * 0.1, Y(d, 0.92), 1.5, 1.6, 10, WHITE, '#e2dccf', lk.ink, 0.3, 0.6 * d.k, 0.3);
    // The snout, a light tone of the ball, and its dark open end.
    const x0 = f * W * 0.36;
    const x1 = f * W * 0.72;
    toned(
      s,
      [
        { x: x0, y: Y(d, 0.555) },
        { x: x1, y: Y(d, 0.555) },
        { x: x1, y: Y(d, 0.445) },
        { x: x0, y: Y(d, 0.445) },
      ],
      lk.playerHi,
      lk.fill,
      lk.ink,
      0.3,
      0.6 * d.k,
      0.3,
    );
    toned(
      s,
      [
        { x: x1, y: Y(d, 0.555) },
        { x: f * W * 0.88, y: Y(d, 0.67) },
        { x: f * W * 0.9, y: Y(d, 0.33) },
        { x: x1, y: Y(d, 0.445) },
      ],
      lk.playerHi,
      lk.fill,
      lk.ink,
      0.3,
      0.6 * d.k,
      0.3,
    );
    poly(s, oval(f * W * 0.88, Y(d, 0.5), 0.6, 1.9, 8), '#3a2418');
    if (d.m !== 'cheer') return;
    // The party blower: a paper streamer unrolled out of the open end, curled at its tip.
    s.fillStyle = lk.playerHi;
    line(s, f * W * 0.9, Y(d, 0.5), f * (W * 0.9 + 2.4), Y(d, 0.54), { w: 1.1, seed: 3, taper: [0, 0.2], press: 0 });
    tonedOval(s, f * (W * 0.9 + 2.9), Y(d, 0.6), 0.7, 0.7, 8, lk.playerHi, lk.fill, lk.ink, 0.25, 0.5 * d.k, 0.2);
  },
  parts: ['shard', 'shard'],
};
