import type { KindArt } from '../kit';
import { pair } from '../faces';

/**
 * A horse standing on two legs: a stand-in silhouette until its own is inked. A rendered kind draws from its
 * frames (src/render/cast/sprites/); this is what shows before they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.9, 1],
  outline:
    'M 0.06 -1 C 0.3 -1 0.4 -0.86 0.38 -0.7 C 0.42 -0.6 0.44 -0.5 0.44 -0.34 C 0.44 -0.14 0.34 0 0.12 0 L -0.18 0 C -0.38 0 -0.48 -0.16 -0.46 -0.36 C -0.44 -0.62 -0.3 -0.98 0.06 -1 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  faceX: 0.1,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.8, 0.12, 0.7),
  parts: ['shard', 'shard'],
};
