import { acUnits, antennas, pendulums } from './builders';
import { makeStyle, type Recipe } from './place';

/** Rooftops: AC condensers blowing updrafts, arcing antenna pairs, a window-washer gondola. */
export const ROOFTOPS: Recipe[] = [
  {
    name: 'ac updraft',
    weight: 3,
    repeat: true,
    candidates: (rng, s) =>
      acUnits(rng, s, {
        name: 'Rooftop Condenser',
        style: makeStyle(rng, 'steel', [200, 40, 0], { trim: 'rivets' }),
        length: [5, 9],
        strength: [1900, 2500],
      }),
  },
  {
    name: 'antennas',
    weight: 2,
    candidates: (rng, s) =>
      antennas(rng, s, {
        name: 'Pirate Antenna',
        style: makeStyle(rng, 'steel', [0], { glowHue: rng.pick([190, 210, 280]) }),
        gap: [3, 6],
        on: [45, 70],
        off: [90, 140],
      }),
  },
  {
    name: 'gondola',
    weight: 2,
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Window Gondola',
        look: 'gondola',
        support: 'mast',
        style: makeStyle(rng, 'steel', [200, 0, 48, 120], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.25, 0.5],
        width: [3, 4],
        period: [240, 340],
        material: 'metal',
      }),
  },
];
