import { type HSL, hsl3 } from '../core/color';
import { Rng } from '../core/rng';
import { word } from './names';

/**
 * The cast (docs/CHARACTERS.md): half animals, half invented critters, some of them homages to famous
 * game characters under our own designs. Each kind is a fixed design; the seed picks the kind, its
 * natural colors and the player's color, which is the body or, for a kind whose palette is its
 * identity, a big worn piece (a cap and overalls, a shirt). That's the HUD color for the player too.
 */
export const CAST = ['fox', 'frog', 'hedgehog', 'raccoon', 'penguin', 'chicken', 'jelly', 'plumber', 'robot', 'goose', 'engineer', 'puffball'] as const;
export type Kind = (typeof CAST)[number];

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
  /** The player's color: the body, or the big worn piece; and this player's HUD color. */
  body: HSL;
  /** A second note in the player's livery, never louder than `body`. */
  accent: HSL;
  kind: Kind;
  /** The kind's own natural color: a fox's cream chest, a plumber's shirt, a robot's steel. */
  paint: HSL;
  /** Rolls in 0..1 that the kind's art reads in its own order: small details inside a design. */
  vary: number[];
  eyes: { count: 1 | 2 | 3; size: number; style: EyeStyle; iris: HSL; spread: number; y: number };
  mouth: Mouth;
}

/** Each kind's own natural colors, calm, so the player's color is the loudest note. */
const PAINTS: Record<Kind, readonly HSL[]> = {
  fox: [hsl3(40, 40, 90), hsl3(30, 30, 86)],
  frog: [hsl3(60, 40, 84), hsl3(45, 36, 86)],
  hedgehog: [hsl3(32, 40, 82), hsl3(25, 30, 78)],
  raccoon: [hsl3(30, 10, 86), hsl3(35, 14, 80)],
  penguin: [hsl3(40, 30, 94), hsl3(200, 12, 92)],
  chicken: [hsl3(4, 70, 52), hsl3(354, 64, 50)],
  jelly: [hsl3(4, 60, 46), hsl3(20, 56, 44)],
  plumber: [hsl3(30, 30, 92), hsl3(40, 20, 88)],
  robot: [hsl3(200, 8, 70), hsl3(40, 10, 72), hsl3(160, 10, 66)],
  goose: [hsl3(30, 80, 56), hsl3(24, 74, 52)],
  engineer: [hsl3(46, 80, 60), hsl3(40, 70, 56)],
  puffball: [hsl3(352, 62, 52), hsl3(8, 60, 50)],
};

/**
 * A character for a look seed. `kind` forces the kind (a lobby keeps eight different kinds); everything
 * else rolls the same either way.
 */
export function generateCharacter(seed: number, kind?: Kind): CharacterDef {
  const rng = new Rng(seed);
  const hue = rng.range(0, 360);
  const sat = rng.range(55, 78);
  const rolled = CAST[Math.floor(rng.next() * CAST.length)];
  const k = kind ?? rolled;
  const paints = PAINTS[k];
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
    body: hsl3(hue, sat, rng.range(52, 60)),
    accent: hsl3(hue + rng.pick([120, 180, 210, 150, 60]), 60, 62),
    kind: k,
    paint,
    vary,
    eyes: {
      count,
      size: count === 1 ? rng.range(2.6, 3.2) : rng.range(1.6, 2.2),
      style: rng.weighted<EyeStyle>([
        ['dot', 5],
        ['ring', 2],
        ['sleepy', 1.2],
        ['angry', 1.2],
      ]),
      iris: hsl3(rng.range(0, 360), 70, 50),
      spread: rng.range(0.2, 0.28),
      y: rng.range(0.56, 0.68),
    },
    mouth: rng.weighted<Mouth>([
      ['smile', 3],
      ['fang', 1.2],
      ['o', 1],
      ['flat', 1.2],
      ['none', 1],
      ['teeth', 0.6],
      ['grin', 1],
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
