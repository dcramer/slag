import { Rng } from '../core/rng';
import { word } from './names';
import { hsl } from './theme';

export type BodyShape = 'round' | 'box' | 'capsule' | 'pear' | 'wide';
export type EyeStyle = 'dot' | 'ring' | 'sleepy' | 'visor';
export type Mouth = 'smile' | 'fang' | 'o' | 'flat' | 'none' | 'teeth';
export type Topper = 'none' | 'antenna' | 'horns' | 'ears' | 'tuft' | 'cap' | 'crown' | 'leaf';
export type Pattern = 'none' | 'stripes' | 'spots' | 'belly';

/**
 * A procedurally generated character. Purely cosmetic — every character uses
 * the same hitbox and physics so the competitive game stays fair.
 */
export interface CharacterDef {
  seed: number;
  name: string;
  hue: number;
  body: string;
  bodyDark: string;
  belly: string;
  accent: string;
  shape: BodyShape;
  /** Visual size multipliers around the shared hitbox. */
  sw: number;
  sh: number;
  eyes: { count: 1 | 2 | 3; size: number; style: EyeStyle; iris: string; spread: number; y: number };
  mouth: Mouth;
  topper: Topper;
  pattern: Pattern;
  feet: boolean;
}

export function generateCharacter(seed: number): CharacterDef {
  const rng = new Rng(seed);
  const hue = rng.range(0, 360);
  const sat = rng.range(55, 90);
  const shape = rng.weighted<BodyShape>([
    ['round', 3],
    ['box', 2],
    ['capsule', 2],
    ['pear', 2],
    ['wide', 1.5],
  ]);
  const count = rng.weighted<1 | 2 | 3>([
    [2, 6],
    [1, 2],
    [3, 1],
  ]);
  return {
    seed,
    name: word(rng, 2, 3),
    hue,
    body: hsl(hue, sat, rng.range(52, 64)),
    bodyDark: hsl(hue, sat, 30),
    belly: hsl(hue + rng.range(-30, 30), sat * 0.6, 82),
    accent: hsl(hue + rng.pick([120, 180, 210, 150]), 85, 58),
    shape,
    sw: shape === 'wide' ? rng.range(1.15, 1.3) : shape === 'capsule' ? rng.range(0.85, 0.95) : rng.range(0.95, 1.1),
    sh: shape === 'capsule' ? rng.range(1.1, 1.25) : shape === 'wide' ? rng.range(0.8, 0.9) : rng.range(0.92, 1.08),
    eyes: {
      count,
      size: count === 1 ? rng.range(2.6, 3.6) : rng.range(1.7, 2.5),
      style: rng.weighted<EyeStyle>([
        ['dot', 4],
        ['ring', 2],
        ['sleepy', 1.5],
        ['visor', count === 2 ? 0.8 : 0],
      ]),
      iris: hsl(rng.range(0, 360), 80, 45),
      spread: rng.range(0.22, 0.32),
      y: rng.range(0.55, 0.7),
    },
    mouth: rng.weighted<Mouth>([
      ['smile', 3],
      ['fang', 2],
      ['o', 1.5],
      ['flat', 1.5],
      ['none', 1],
      ['teeth', 1],
    ]),
    topper: rng.weighted<Topper>([
      ['none', 2],
      ['antenna', 2],
      ['horns', 2],
      ['ears', 2],
      ['tuft', 1.5],
      ['cap', 1],
      ['crown', 0.6],
      ['leaf', 1],
    ]),
    pattern: rng.weighted<Pattern>([
      ['none', 3],
      ['belly', 3],
      ['stripes', 1.5],
      ['spots', 1.5],
    ]),
    feet: rng.chance(0.75),
  };
}
