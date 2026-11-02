import { cannons, geysers, pendulums, vehicles } from './builders';
import { makeStyle, type Recipe } from './place';

/**
 * Harbor: a dock crane swinging a cargo crate, a shore battery, a forklift hauling crates, and three things
 * only a harbor has: a wave breaking along a quay out of its sea wall (it shoves, it doesn't drown), a
 * tentacle rising out of open water on its own beat (no face, just the arm), and a whaler's harpoon gun on a
 * swivel post firing flat across the water.
 */
export const HARBOR: Recipe[] = [
  {
    name: 'crane',
    weight: 3,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: rng.pick(['Dock Crane', 'Cargo Hook', 'Swinging Freight']),
        look: 'crane',
        support: 'mast',
        style: makeStyle(rng, ['steel', 'rust'], [28, 48, 0, 205], { trim: 'stripes' }),
        arm: [3.5, 6.5],
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
    weight: 1.5,
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
  {
    name: 'wave',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: rng.pick(['Breaking Wave', 'Rogue Wave', 'The Big One', 'Spray']),
        look: 'water',
        aim: 'side',
        where: 'ground',
        style: makeStyle(rng, 'steel', [200]),
        archetype: 'fan',
        role: 'hazard',
        length: [6, 12],
        width: 2,
        off: [170, 250],
        warn: 50,
        on: [45, 70],
        lethal: false,
        strength: rng.int(2700, 3400),
      }),
  },
  {
    name: 'tentacle',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: rng.pick(['Tentacle', 'Something Below', 'The Arm', 'Calamari Revenge']),
        look: 'tentacle',
        where: 'pit',
        style: makeStyle(rng, 'brass', [340, 10, 280, 150]),
        length: [7, 12],
        width: 1.4,
        off: [160, 260],
        warn: 60,
        on: [55, 85],
        lethal: true,
      }),
  },
  {
    name: 'harpoon',
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: rng.pick(['Harpoon Gun', 'Whaler', 'The Long Reach']),
        look: 'harpoon',
        style: makeStyle(rng, ['brass', 'steel'], [20], { woodHue: rng.range(18, 28) }),
        ammo: 'bolt',
        speed: [260, 330],
        interval: [130, 190],
        burst: [1, 1],
        elev: [0, 0.06],
        length: 1.4,
      }),
  },
];
