import type { KindArt } from '../kit';

/**
 * The executioner (docs/characters/pyramid.md): a hulk whose head is one tall upright pyramid sitting straight down on
 * his square shoulders, narrower than them, and a long blade trailing from his back fist to the floor behind him. No
 * face: nothing shows under the helmet. A rendered kind draws from its frames (src/render/cast/sprites/pyramid/); this
 * is what shows before they load, and on the hand-drawn sheets.
 */
export const art: KindArt = {
  size: [0.9, 1],
  outline:
    'M 0.08 -1 L 0.28 -0.62 L 0.42 -0.6 C 0.5 -0.58 0.5 -0.44 0.48 -0.3 L 0.4 -0.28 L 0.38 -0.12 C 0.4 -0.06 0.42 -0.02 0.4 0 L 0.08 0 L 0.06 -0.1 L 0 -0.1 L -0.02 0 L -0.28 0 L -0.3 -0.12 L -0.48 -0.02 L -0.5 -0.08 L -0.36 -0.3 C -0.44 -0.36 -0.46 -0.5 -0.4 -0.58 L -0.12 -0.62 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'mitten',
  fill: 'player',
  faceX: 0.1,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, upright: 0.6 } : {}),
  paintFace: () => {},
  parts: ['shard', 'shard'],
};
