import { cannons, geysers, pendulums } from './builders';
import { makeStyle, type Recipe } from './place';

/** Glacier: a cannon that fires frost, frost vents that throw you up, a chairlift, a serac hanging off the cave roof. */
export const GLACIER: Recipe[] = [
  {
    name: 'frost cannon',
    weight: 2.5,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Brain Freeze', 'Cold Shoulder', 'Polar Vortex', 'Snow Day'])} Cannon`,
        look: 'castle',
        style: makeStyle(rng, ['steel', 'bone'], [205, 0, 220], { trim: 'stripes', woodHue: rng.range(20, 30) }),
        ammo: 'frost',
        speed: [180, 240],
        interval: [140, 210],
        burst: [1, 2],
        elev: [0, 0.08],
        length: 1,
      }),
  },
  {
    name: 'frost vent',
    weight: 2.5,
    role: 'utility',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Frost Vent',
        look: 'steam',
        where: 'ground',
        style: makeStyle(rng, 'bone', [200]),
        length: [6, 10],
        width: 0.85,
        off: [110, 170],
        warn: 50,
        on: [50, 80],
        lethal: false,
        strength: 2600,
      }),
  },
  {
    name: 'chairlift',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: `${rng.pick(['Bunny Hill', 'Black Diamond', 'Après', 'Lift Pass'])} Chairlift`,
        look: 'gondola',
        support: 'mast',
        style: makeStyle(rng, 'steel', [0, 205, 48], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.25, 0.5],
        width: [3, 4],
        period: [240, 340],
        material: 'metal',
      }),
  },
  {
    name: 'hanging serac',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Hanging Serac',
        look: 'slab',
        support: 'ceiling',
        style: makeStyle(rng, 'bone', [195]),
        arm: [3, 5],
        swing: [0.3, 0.55],
        width: [2, 3],
        period: [220, 320],
        material: 'ice',
      }),
  },
];
