import { presses, vehicles, wheels } from './builders';
import { makeStyle, type Recipe } from './place';

/** Factory: a hydraulic press in a gantry, a forklift shuttling along the floor, a cog-wheel lift. */
export const FACTORY: Recipe[] = [
  {
    name: 'press',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      presses(rng, s, {
        name: `${rng.pick(['Hydraulic', 'Steam', 'Stamping', 'Thousand-Ton'])} Press`,
        style: makeStyle(rng, ['steel', 'steel', 'rust'], [48, 200, 0], { trim: 'stripes', glowHue: 0 }),
        height: [5, 6],
        width: [2, 3],
        period: [130, 200],
      }),
  },
  {
    name: 'forklift',
    weight: 2.5,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${rng.pick(['Unlicensed', 'Speedy', 'Overworked', 'Model T'])} Forklift`,
        look: 'forklift',
        style: makeStyle(rng, 'steel', [46, 30, 200], { trim: 'stripes' }),
        w: [3, 3],
        // Counterweight, cab under its overhead guard, mast (forks stick out the front).
        cols: (r) => [1.45 + r.range(0, 0.15), 2.3, 2.3],
        speed: [2, 3.6],
        pause: [30, 90],
        flip: 0.5,
      }),
  },
  {
    name: 'cog lift',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: 'Cog Lift',
        look: 'cog',
        support: 'tower',
        style: makeStyle(rng, ['steel', 'brass', 'copper', 'rust'], [48, 200], { trim: 'rivets' }),
        arm: [2.6, 3.5],
        width: [2, 2],
        count: [3, 4],
        period: [360, 620],
        material: 'metal',
      }),
  },
];
