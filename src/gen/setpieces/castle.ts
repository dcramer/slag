import { cannons, pendulums, vehicles } from './builders';
import { makeStyle, type Recipe } from './place';

/** Castle: rampart cannons, a candle-lit chandelier to swing on, a battering ram trundling the halls. */
export const CASTLE: Recipe[] = [
  {
    name: 'cannon',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Rampart', 'Boss-Room', 'Royal', 'Old Thunder'])} Cannon`,
        look: 'castle',
        style: makeStyle(rng, ['steel', 'obsidian', 'brass'], [0], { woodHue: rng.range(18, 30) }),
        ammo: 'cannonball',
        speed: [240, 330],
        interval: [150, 230],
        burst: [1, 1],
        elev: [0.12, 0.45],
        length: 1.25,
      }),
  },
  {
    name: 'chandelier',
    weight: 2.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: `${rng.pick(['Grand', 'Dusty', 'Load-Bearing', 'Wobbly'])} Chandelier`,
        look: 'chandelier',
        support: 'ceiling',
        style: makeStyle(rng, ['gold', 'brass', 'steel'], [40], { glowHue: rng.range(30, 45) }),
        arm: [3, 5.5],
        swing: [0.35, 0.7],
        width: [3, 3],
        period: [200, 300],
        material: 'metal',
      }),
  },
  {
    name: 'ram',
    weight: 1.5,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Door Knocker',
        look: 'ram',
        style: makeStyle(rng, 'steel', [0, 210, 120, 280], { woodHue: rng.range(18, 30) }),
        w: [3, 4],
        cols: (_r, w) => Array.from({ length: w }, () => 1.75),
        speed: [1.4, 2.4],
        pause: [50, 100],
        flip: 0.5,
      }),
  },
];
