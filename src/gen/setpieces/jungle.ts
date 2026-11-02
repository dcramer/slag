import { cannons, pendulums, vehicles } from './builders';
import { makeStyle, type Recipe } from './place';

/** Jungle: a log swinging on vines, a rolling temple boulder, a dart-spitting idol. */
export const JUNGLE: Recipe[] = [
  {
    name: 'log swing',
    weight: 3,
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Vine Log',
        look: 'log',
        support: 'ceiling',
        style: makeStyle(rng, 'jade', [110], { woodHue: rng.range(20, 32) }),
        arm: [3.5, 6],
        swing: [0.5, 0.85],
        width: [3, 4],
        period: [180, 260],
        material: 'wood',
      }),
  },
  {
    name: 'boulder',
    weight: 2,
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Temple Boulder',
        look: 'boulder',
        style: makeStyle(rng, 'jade', [30, 90, 200], { glowHue: rng.range(120, 170) }),
        w: [2, 3],
        cols: (_r, w) => (w === 2 ? [1.75, 1.75] : [2.4, 2.9, 2.4]),
        speed: [2, 3.4],
        pause: [30, 80],
      }),
  },
  {
    name: 'dart idol',
    weight: 2,
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Dart Idol',
        look: 'totem',
        style: makeStyle(rng, 'jade', [100, 30], { glowHue: rng.pick([120, 150, 40]), woodHue: rng.range(18, 30) }),
        ammo: 'bolt',
        speed: [200, 260],
        interval: [110, 170],
        burst: [1, 3],
        elev: [0, 0.04],
        length: 0.95,
      }),
  },
];
