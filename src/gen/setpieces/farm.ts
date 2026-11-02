import type { Rng } from '../../core/rng';
import { pendulums, vehicles, wheels } from './builders';
import { makeStyle, type Recipe } from './place';

/** Farm: a tractor ploughing a field, a windmill with rideable sails, a swinging hay bale on a hoist. */

const pick = (rng: Rng, a: readonly string[]) => rng.pick(a);

export const FARM: Recipe[] = [
  {
    name: 'tractor',
    weight: 3,
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${pick(rng, ['Old', 'Big', 'Grumpy', 'Rusty', 'Trusty', 'Diesel'])} ${pick(rng, ['Tractor', 'Plougher', 'Harvester', 'Bessie'])}`,
        look: 'tractor',
        style: makeStyle(rng, 'steel', [2, 118, 205, 26, 48], { woodHue: rng.range(20, 32) }),
        w: [3, 4],
        // Cab at the back (left), lower hood in front; mirrored when it faces left.
        cols: (r, w) => (w === 3 ? [2.25, 1.4, 1.3] : [2.3, 2.3, 1.45, 1.3]).map((h) => h + r.range(-0.05, 0.1)),
        speed: [1.6, 3.1],
        flip: 0.5,
        pause: [40, 110],
      }),
  },
  {
    name: 'windmill',
    weight: 2.5,
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: `${pick(rng, ['Creaky', 'Old', 'Whistling', 'Painted'])} Windmill`,
        look: 'windmill',
        support: 'tower',
        style: makeStyle(rng, 'rust', [10, 30, 200, 0], { woodHue: rng.range(22, 34) }),
        arm: [2.8, 3.8],
        width: [2, 2],
        count: [4, 4],
        period: [420, 700],
        material: 'wood',
      }),
  },
  {
    name: 'hay hoist',
    weight: 1.5,
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Hay Hoist',
        look: 'hay',
        support: 'mast',
        style: makeStyle(rng, 'rust', [40, 45, 50], { woodHue: rng.range(22, 32) }),
        arm: [3, 5],
        swing: [0.45, 0.8],
        width: [2, 3],
        thick: 0.75,
        period: [170, 240],
        material: 'wood',
      }),
  },
];
