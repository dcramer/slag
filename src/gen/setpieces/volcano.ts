import { cannons, geysers, pendulums } from './builders';
import { makeStyle, type Recipe } from './place';

/** Volcano: lava plumes from the pit, vents (lava or launching steam), magma spitters, a slab on chains. */
export const VOLCANO: Recipe[] = [
  {
    name: 'lava plume',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Floor Is Lava',
        look: 'lava',
        where: 'pit',
        style: makeStyle(rng, 'obsidian', [18]),
        length: [8, 13],
        width: 0.95,
        off: [110, 170],
        warn: 54,
        on: [45, 70],
        lethal: true,
      }),
  },
  {
    name: 'vent',
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) => {
      const lava = rng.chance(0.5);
      return geysers(rng, s, {
        name: lava ? 'Magma Vent' : 'Steam Vent',
        look: lava ? 'lava' : 'steam',
        where: 'ground',
        style: makeStyle(rng, 'obsidian', [18]),
        length: lava ? [4, 7] : [6, 10],
        width: 0.85,
        off: [100, 160],
        warn: 50,
        on: lava ? [40, 60] : [50, 80],
        lethal: lava,
        strength: 2700,
      });
    },
  },
  {
    name: 'spitter',
    unique: true,
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Magma Spitter',
        look: 'spitter',
        style: makeStyle(rng, 'obsidian', [15], { glowHue: rng.range(15, 35) }),
        ammo: 'fireball',
        speed: [130, 180],
        interval: [130, 200],
        burst: [1, 2],
        elev: [0, 0.25],
        length: 0.85,
      }),
  },
  {
    name: 'slab',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Basalt Slab',
        look: 'slab',
        support: 'ceiling',
        style: makeStyle(rng, ['obsidian', 'rust'], [15]),
        arm: [3, 5],
        swing: [0.3, 0.6],
        width: [2, 3],
        period: [220, 320],
        material: 'stone',
      }),
  },
];
