import type { KindArt } from '../kit';
import { pair } from '../faces';

/**
 * The bun-haired street fighter (docs/characters/fighter.md): a deep, wide fighting stance under a skirt flaring over
 * her thighs, puffed shoulders wider than her small head, and two round buns up and out on its top corners with a
 * notch of background between each and her crown. A stand-in until her frames load: a rendered kind draws from them
 * (src/render/cast/sprites/fighter/); this is what shows before they do, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.9, 1],
  outline:
    'M -0.27 -0.79 C -0.42 -0.8 -0.44 -1 -0.3 -1 C -0.22 -1 -0.18 -0.96 -0.17 -0.9 C -0.08 -0.95 0.06 -0.95 0.13 -0.9 C 0.15 -0.97 0.22 -1 0.28 -0.98 C 0.37 -0.95 0.37 -0.83 0.25 -0.8 L 0.21 -0.7 C 0.36 -0.72 0.44 -0.66 0.42 -0.56 C 0.42 -0.5 0.36 -0.46 0.3 -0.46 L 0.28 -0.36 C 0.42 -0.32 0.5 -0.27 0.48 -0.22 L 0.4 -0.2 L 0.46 0 L 0.28 0 L 0.22 -0.16 L 0 -0.2 L -0.22 -0.16 L -0.32 0 L -0.5 0 L -0.4 -0.2 L -0.48 -0.22 C -0.5 -0.28 -0.42 -0.32 -0.3 -0.36 L -0.3 -0.46 C -0.38 -0.46 -0.44 -0.52 -0.42 -0.58 C -0.42 -0.68 -0.34 -0.72 -0.22 -0.7 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  fill: 'player',
  faceX: 0.1,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.8, 0.12, 0.7),
  parts: ['shard', 'shard'],
};
