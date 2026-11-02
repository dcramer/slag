import { cannons, pendulums, vehicles } from './builders';
import { makeStyle, type Recipe } from './place';

/** Harbor: a dock crane swinging a cargo crate, a shore battery cannon, a forklift hauling crates. */
export const HARBOR: Recipe[] = [
  {
    name: 'crane',
    weight: 3,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Dock Crane',
        look: 'crane',
        support: 'mast',
        style: makeStyle(rng, ['steel', 'rust'], [28, 48, 0, 205], { trim: 'stripes' }),
        arm: [3, 5.5],
        swing: [0.35, 0.65],
        width: [2, 3],
        thick: 1,
        period: [220, 320],
        material: 'wood',
      }),
  },
  {
    name: 'shore battery',
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Shore Battery',
        look: 'ship',
        style: makeStyle(rng, ['steel', 'brass'], [0], { woodHue: rng.range(18, 28) }),
        ammo: 'cannonball',
        speed: [250, 340],
        interval: [160, 240],
        burst: [1, 2],
        elev: [0.1, 0.4],
        length: 1.25,
      }),
  },
  {
    name: 'dock forklift',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Dock Forklift',
        look: 'forklift',
        style: makeStyle(rng, 'steel', [28, 200, 48], { trim: 'stripes' }),
        w: [3, 3],
        cols: (r) => [1.45 + r.range(0, 0.15), 2.3, 2.3],
        speed: [2, 3.4],
        pause: [30, 90],
        flip: 0.5,
      }),
  },
];
