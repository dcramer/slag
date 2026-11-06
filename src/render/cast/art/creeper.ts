import type { KindArt } from '../kit';
import { pair } from '../faces';

/**
 * A tall box with a cube head as wide on top, square-cornered, on stubby feet, no arms: a stand-in silhouette until its
 * own is inked. A rendered kind draws from its frames (src/render/cast/sprites/); this is what shows before they load,
 * and on the hand-drawn sheets. Square, never round: round, the box read as a cylinder.
 */
export const art: KindArt = {
  size: [0.9, 1],
  outline: 'M -0.4 -1 L 0.4 -1 L 0.4 -0.62 L 0.36 -0.62 L 0.36 0 L -0.36 0 L -0.36 -0.62 L -0.4 -0.62 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'none',
  fill: 'player',
  faceX: 0.1,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.8, 0.12, 0.7),
  parts: ['shard', 'shard'],
};
