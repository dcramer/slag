import type { KindArt } from '../kit';
import { Y } from '../kit';
import { pair } from '../faces';
import { oval, poly, tonedOval } from '../../ink-figure';

const TAPE = '#a4a7aa';
const TAPE_SH = '#8c9094';
const MOUTH = '#2a1f1a';
const TONGUE = '#e06a6a';

/**
 * The blue teardrop slime: a limbless drop of goo, wide and flat at the bottom, rising to a pointed tip that
 * curls over at its end, two big eyes high on it and a huge open grin. The tip standing clear is the read: it
 * parts it from the jelly's dome, the dot-eater's circle and the puffball's ball on feet. Ours: it's a water
 * balloon, the tip its tied knot, a strip of tape over a pinhole on its back. A rendered kind draws from its frames
 * (src/render/cast/sprites/slime/); this is what shows before they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [1.05, 1.15],
  // The flat bottom, the bulging sides rising to the knotted neck, and the tip curling over to its pointed lip.
  outline:
    'M -0.4 0 L 0.4 0 C 0.52 -0.02 0.53 -0.16 0.48 -0.3 C 0.42 -0.48 0.24 -0.6 0.1 -0.71 L 0.09 -0.77 C 0.17 -0.83 0.15 -0.93 0.07 -0.95 L 0.15 -1 L 0.03 -1 C -0.07 -0.96 -0.08 -0.86 -0.03 -0.79 L -0.07 -0.74 C -0.24 -0.62 -0.46 -0.48 -0.5 -0.3 C -0.54 -0.15 -0.52 -0.02 -0.4 0 Z',
  lift: 0.3,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0.08,
  // Every step a squash and a spring: low and wide on the ground, tall and narrow in the hop.
  gait: (g) => {
    if (!g.moving) return {};
    const k = Math.abs(Math.sin(g.ph * 0.8));
    return { hop: k * (1.2 + g.run * 1.2), sy: 0.94 + k * 0.1, sx: 1.05 - k * 0.08, upright: 0.6 };
  },
  paintFace: (d) => {
    pair(d, 0.56, 0.12, 0.7);
    // The huge open grin across its middle, a tongue in it.
    const { s, f, W } = d;
    const cx = f * (W * 0.06 + 0.4);
    const cy = Y(d, 0.4);
    const rx = W * 0.22;
    const ry = d.m === 'fall' ? 2.4 : 1.9;
    const grin = oval(cx, cy, rx, ry, 16).filter((p) => p.y >= cy - 0.01);
    poly(s, grin, MOUTH);
    poly(s, oval(cx + f * rx * 0.1, cy + ry * 0.62, rx * 0.5, ry * 0.32, 10), TONGUE);
  },
  over: (d) => {
    const { s, f, W, lk } = d;
    // The rubber's shine on its upper back, a light of the goo.
    poly(s, oval(-f * W * 0.24, Y(d, 0.52), 0.7, 1.9, 10), lk.playerHi);
    // The tape over the pinhole, low on its back.
    tonedOval(s, -f * W * 0.36, Y(d, 0.2), 1.3, 0.8, 8, TAPE, TAPE_SH, lk.ink, 0.3, 0.5 * d.k, 0.3);
  },
  parts: ['shard', 'shard'],
};
