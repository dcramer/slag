import { type HSL, hsl3 } from '../core/color';
import { Rng } from '../core/rng';
import { word } from './names';

/**
 * The cast: toys out of the foundry's moulds (docs/CHARACTERS.md). Each kind has its own silhouette and
 * its own material colors; the player's color is what the toy wears or has painted on it, big enough
 * to read at play scale, and it's the color the HUD uses for that player.
 */
export const TOYS = [
  'robot',
  'piggybank',
  'tincan',
  'kettle',
  'bell',
  'slagblob',
  'soldier',
  'beetle',
  'jackbox',
  'chick',
  'top',
  'rocket',
  'train',
  'duck',
  'frog',
  'lantern',
] as const;
export type Toy = (typeof TOYS)[number];

export type EyeStyle = 'dot' | 'ring' | 'sleepy' | 'visor' | 'angry';
export type Mouth = 'smile' | 'fang' | 'o' | 'flat' | 'none' | 'teeth' | 'grin';

/**
 * A procedurally generated character. Purely cosmetic: every character uses the same hitbox and
 * physics so the competitive game stays fair.
 */
export interface CharacterDef {
  seed: number;
  name: string;
  hue: number;
  /** The player's color: the toy's painted band, cap, jacket or label, and this player's HUD color. */
  body: HSL;
  /** A second note in the player's livery (a plume, a pompom), never louder than `body`. */
  accent: HSL;
  toy: Toy;
  /** The toy's own material: tin paint, enamel, cast iron. Muted, so the player's color is the loudest note. */
  paint: HSL;
  /** Rolls in 0..1 that the kind's art reads in its own order: variations inside a kind. */
  vary: number[];
  eyes: { count: 1 | 2 | 3; size: number; style: EyeStyle; iris: HSL; spread: number; y: number };
  mouth: Mouth;
}

/** Each kind's own materials, muted: faded tin paints, enamels, iron, bronze. */
const TIN = [hsl3(40, 30, 84), hsl3(200, 14, 74), hsl3(95, 16, 70), hsl3(20, 24, 76)];
const ENAMEL = [hsl3(45, 22, 88), hsl3(160, 18, 74), hsl3(205, 20, 72), hsl3(10, 22, 74)];
const PAINTS: Record<Toy, readonly HSL[]> = {
  robot: [hsl3(200, 8, 70), hsl3(40, 10, 72), hsl3(160, 10, 66)],
  piggybank: [hsl3(350, 26, 80), hsl3(40, 26, 86), hsl3(10, 22, 74)],
  tincan: [hsl3(40, 8, 80), hsl3(200, 6, 76)],
  kettle: ENAMEL,
  bell: [hsl3(28, 26, 46), hsl3(20, 18, 42), hsl3(35, 14, 52)],
  slagblob: [hsl3(20, 12, 34), hsl3(30, 16, 38), hsl3(0, 8, 32)],
  soldier: [hsl3(30, 30, 78), hsl3(40, 20, 84)],
  beetle: TIN,
  jackbox: [hsl3(35, 40, 88), hsl3(20, 30, 86)],
  chick: [hsl3(48, 42, 80), hsl3(40, 30, 86), hsl3(30, 26, 82)],
  top: [hsl3(35, 34, 70), hsl3(25, 30, 62), hsl3(40, 20, 82)],
  rocket: [hsl3(200, 6, 82), hsl3(40, 14, 86), hsl3(210, 12, 72)],
  train: [hsl3(150, 14, 34), hsl3(210, 12, 30), hsl3(10, 12, 32)],
  duck: [hsl3(45, 26, 90), hsl3(40, 20, 84), hsl3(200, 10, 86)],
  frog: [hsl3(95, 24, 60), hsl3(120, 18, 54), hsl3(70, 22, 62)],
  lantern: [hsl3(20, 8, 30)],
};

/**
 * A character for a look seed. `toy` forces the kind (a lobby keeps eight different kinds); everything
 * else rolls the same either way.
 */
export function generateCharacter(seed: number, toy?: Toy): CharacterDef {
  const rng = new Rng(seed);
  const hue = rng.range(0, 360);
  const sat = rng.range(68, 92);
  const rolled = TOYS[Math.floor(rng.next() * TOYS.length)];
  const kind = toy ?? rolled;
  const paints = PAINTS[kind];
  const paint = paints[Math.floor(rng.next() * paints.length)];
  const vary = Array.from({ length: 6 }, () => rng.next());
  const count = rng.weighted<1 | 2 | 3>([
    [2, 7],
    [1, 2],
    [3, 0.6],
  ]);
  return {
    seed,
    name: shortName(rng),
    hue,
    body: hsl3(hue, sat, rng.range(50, 58)),
    accent: hsl3(hue + rng.pick([120, 180, 210, 150, 60]), 80, 60),
    toy: kind,
    paint,
    vary,
    eyes: {
      count,
      size: count === 1 ? rng.range(2.8, 3.6) : rng.range(1.8, 2.5),
      style: rng.weighted<EyeStyle>([
        ['dot', 4],
        ['ring', 3],
        ['sleepy', 1.2],
        ['angry', 1.5],
      ]),
      iris: hsl3(rng.range(0, 360), 85, 50),
      spread: rng.range(0.22, 0.3),
      y: rng.range(0.56, 0.68),
    },
    mouth: rng.weighted<Mouth>([
      ['smile', 3],
      ['fang', 1.5],
      ['o', 1.2],
      ['flat', 1.2],
      ['none', 0.6],
      ['teeth', 1],
      ['grin', 1.5],
    ]),
  };
}

/** Names that fit HUD chips: retry (deterministically) until ≤ 10 chars. */
function shortName(rng: Rng): string {
  for (let i = 0; i < 20; i++) {
    const n = word(rng, 2, 3);
    if (n.length <= 10) return n;
  }
  return word(rng, 1, 1);
}
