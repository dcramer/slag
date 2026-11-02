import { antennas, cannons, geysers, pendulums, wheels } from './builders';
import { makeStyle, type Recipe } from './place';

/** Space: flares licking up out of the void, a point-defense turret, an arcing comm array, a centrifuge to ride, a docking arm. */
export const SPACE: Recipe[] = [
  {
    name: 'solar flare',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Solar Flare',
        look: 'lava',
        where: 'pit',
        style: makeStyle(rng, 'obsidian', [40]),
        length: [8, 13],
        width: 0.95,
        off: [120, 180],
        warn: 60,
        on: [40, 65],
        lethal: true,
      }),
  },
  {
    name: 'turret',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Point-Defense', 'Overzealous', 'Warranty-Void', 'Friendly-Fire'])} Turret`,
        look: 'castle',
        style: makeStyle(rng, 'steel', [200, 0, 48], { trim: 'stripes', glowHue: rng.pick([190, 330, 120]) }),
        ammo: 'plasma',
        speed: [150, 210],
        interval: [130, 200],
        burst: [1, 3],
        elev: [0, 0.3],
        length: 1.1,
      }),
  },
  {
    name: 'comm array',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      antennas(rng, s, {
        name: 'Comm Array',
        style: makeStyle(rng, 'steel', [0], { glowHue: rng.pick([190, 280, 60]) }),
        gap: [3, 6],
        on: [45, 70],
        off: [90, 140],
      }),
  },
  {
    name: 'centrifuge',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: `${rng.pick(['Spin-Grav', 'Artificial Gravity', 'Nauseous', 'Salad Spinner'])} Centrifuge`,
        look: 'cog',
        support: 'tower',
        style: makeStyle(rng, ['steel', 'brass'], [200, 48], { trim: 'rivets' }),
        arm: [2.6, 3.5],
        width: [2, 2],
        count: [3, 4],
        period: [420, 680],
        material: 'metal',
      }),
  },
  {
    name: 'docking arm',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Docking Arm',
        look: 'crane',
        support: 'mast',
        style: makeStyle(rng, 'steel', [48, 0, 205], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.3, 0.6],
        width: [2, 3],
        thick: 1,
        period: [240, 340],
        material: 'metal',
      }),
  },
];
