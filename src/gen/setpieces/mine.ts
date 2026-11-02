import { pendulums, vehicles } from './builders';
import { makeStyle, type Recipe } from './place';

/** Mine: runaway minecarts, a tunnelling drill rig, an ore bucket swinging under a lantern. */
export const MINE: Recipe[] = [
  {
    name: 'minecart',
    weight: 3,
    repeat: true,
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${rng.pick(['Runaway', 'Rickety', 'Ore'])} Minecart`,
        look: 'minecart',
        style: makeStyle(rng, ['rust', 'steel', 'copper'], [20], { woodHue: rng.range(18, 30) }),
        w: [2, 3],
        cols: (_r, w) => Array.from({ length: w }, () => 1.3),
        speed: [2.6, 4.6],
        pause: [30, 90],
      }),
  },
  {
    name: 'drill',
    weight: 2,
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Tunnel Drill',
        look: 'drill',
        style: makeStyle(rng, ['steel', 'rust'], [48, 28, 0], { trim: 'stripes' }),
        w: [3, 3],
        // Cab, engine, drill head (lower; the bit sticks out ahead).
        cols: () => [1.9, 1.6, 1.4],
        speed: [1.3, 2.2],
        pause: [40, 90],
        flip: 0.5,
      }),
  },
  {
    name: 'ore bucket',
    weight: 2,
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Ore Bucket',
        look: 'bucket',
        support: 'ceiling',
        style: makeStyle(rng, ['rust', 'steel'], [20], { glowHue: rng.range(30, 45) }),
        arm: [3, 5],
        swing: [0.3, 0.6],
        width: [2, 2],
        thick: 0.75,
        period: [200, 300],
        material: 'metal',
      }),
  },
];
