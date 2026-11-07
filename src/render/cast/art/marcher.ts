import type { KindArt } from '../kit';
import { Y } from '../kit';
import { inked, poly } from '../../ink-figure';

const TAPE = '#a4a8ac';

// The crab laid out on a grid of square tiles, 15 wide and 8 tall, each 0.1 of the width by 0.125 of the height (a
// square at its size): a raised U of a claw on each side, two antennae (the back one bent over at the tip), a stepped
// body, and six stubby legs that pinch in to four on the run. Every edge is a step: the read is the pixel outline.
const REST =
  'M -0.75 -1 L -0.65 -1 L -0.65 -0.75 L -0.55 -0.75 L -0.55 -1 L -0.45 -1 L -0.45 -0.625 L -0.55 -0.625 L -0.55 -0.5 L -0.35 -0.5 L -0.35 -0.625 L -0.25 -0.625 L -0.25 -0.75 L -0.35 -0.75 L -0.35 -1 L -0.25 -1 L -0.25 -0.875 L -0.15 -0.875 L -0.15 -0.75 L 0.15 -0.75 L 0.15 -1 L 0.25 -1 L 0.25 -0.625 L 0.35 -0.625 L 0.35 -0.5 L 0.55 -0.5 L 0.55 -0.625 L 0.45 -0.625 L 0.45 -1 L 0.55 -1 L 0.55 -0.75 L 0.65 -0.75 L 0.65 -1 L 0.75 -1 L 0.75 -0.625 L 0.65 -0.625 L 0.65 -0.375 L 0.45 -0.375 L 0.45 -0.25 L 0.55 -0.25 L 0.55 0 L 0.45 0 L 0.45 -0.125 L 0.35 -0.125 L 0.35 0 L 0.25 0 L 0.25 -0.125 L 0.15 -0.125 L 0.15 0 L 0.05 0 L 0.05 -0.125 L -0.05 -0.125 L -0.05 0 L -0.15 0 L -0.15 -0.125 L -0.25 -0.125 L -0.25 0 L -0.35 0 L -0.35 -0.125 L -0.45 -0.125 L -0.45 0 L -0.55 0 L -0.55 -0.25 L -0.45 -0.25 L -0.45 -0.375 L -0.65 -0.375 L -0.65 -0.625 L -0.75 -0.625 Z';
const PINCHED =
  'M -0.75 -1 L -0.65 -1 L -0.65 -0.75 L -0.55 -0.75 L -0.55 -1 L -0.45 -1 L -0.45 -0.625 L -0.55 -0.625 L -0.55 -0.5 L -0.35 -0.5 L -0.35 -0.625 L -0.25 -0.625 L -0.25 -0.75 L -0.35 -0.75 L -0.35 -1 L -0.25 -1 L -0.25 -0.875 L -0.15 -0.875 L -0.15 -0.75 L 0.15 -0.75 L 0.15 -1 L 0.25 -1 L 0.25 -0.625 L 0.35 -0.625 L 0.35 -0.5 L 0.55 -0.5 L 0.55 -0.625 L 0.45 -0.625 L 0.45 -1 L 0.55 -1 L 0.55 -0.75 L 0.65 -0.75 L 0.65 -1 L 0.75 -1 L 0.75 -0.625 L 0.65 -0.625 L 0.65 -0.375 L 0.45 -0.375 L 0.45 -0.25 L 0.55 -0.25 L 0.55 -0.125 L 0.45 -0.125 L 0.45 0 L 0.35 0 L 0.35 -0.125 L 0.25 -0.125 L 0.25 0 L 0.15 0 L 0.15 -0.125 L -0.15 -0.125 L -0.15 0 L -0.25 0 L -0.25 -0.125 L -0.35 -0.125 L -0.35 0 L -0.45 0 L -0.45 -0.125 L -0.55 -0.125 L -0.55 -0.25 L -0.45 -0.25 L -0.45 -0.375 L -0.65 -0.375 L -0.65 -0.625 L -0.75 -0.625 Z';

/**
 * The pixel crab from space (docs/characters/marcher.md): wider than tall, cut from square tiles with a stepped edge
 * all round, two antennae, a claw raised off each side, stubby legs, two square eye holes. Ours: a tile fallen out of
 * its top and taped back on crooked, the back antenna bent over. Hand-inked from its design for the hand-drawn sheets
 * and the frames before its rendered ones load (src/render/cast/sprites/marcher/). Its gait is the arcade's two-step:
 * the legs spread and pinch on each beat, the whole crab jumping a tile's height and dropping, never gliding.
 */
export const art: KindArt = {
  size: [1.1, 0.88],
  outline: REST,
  poses: { run: PINCHED, air: PINCHED },
  lift: 0.1,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  // A step, not a bob: up a little on one beat, down flat on the next.
  gait: (g) => (g.moving ? { hop: Math.sin(g.ph * 1.5) > 0 ? 0.8 + g.run * 0.4 : 0, upright: 1 } : {}),
  // Two square eye holes, dark through the body, flattened to slits on the cheer.
  paintFace: (d) => {
    const y = Y(d, 0.4375);
    const h = d.m === 'cheer' ? 0.5 : d.m === 'fall' ? 1.7 : 1.3;
    for (const u of [0, 0.2]) {
      const x = d.f * d.W * u;
      poly(
        d.s,
        [
          { x: x - 0.7, y: y - h / 2 },
          { x: x + 0.7, y: y - h / 2 },
          { x: x + 0.7, y: y + h / 2 },
          { x: x - 0.7, y: y + h / 2 },
        ],
        d.lk.eye,
      );
    }
  },
  // The fallen tile, stuck back on crooked in the gap between the antennae, and its strip of tape.
  front: (d) => {
    const { s, f, W, lk } = d;
    const cx = f * W * 0.02;
    const cy = Y(d, 0.83);
    const a = 0.45 * f;
    const r = (x: number, y: number) => ({ x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) });
    const k = W * 0.05;
    inked(s, [r(-k, -k), r(k, -k), r(k, k), r(-k, k)], lk.fill, lk.ink, 0.3, 0.6 * d.k);
    poly(s, [r(-k * 1.4, -k * 0.35), r(k * 1.4, -k * 0.35), r(k * 1.4, k * 0.35), r(-k * 1.4, k * 0.35)], TAPE);
  },
  parts: ['shard', 'shard', 'bolt'],
};
