import { type HSL, hsl3 } from '../core/color';
import { Rng } from '../core/rng';
import { word } from './names';

/**
 * The cast (docs/CHARACTERS.md): mostly homages to famous game characters in our own designs, with a few
 * plain animals for contrast. Each kind is a fixed design; the seed picks the kind, a variant of its own
 * colors and the player's color. A homage keeps the palette people recognise it by, and the player's
 * color goes on a secondary slot (a ring at its feet, a scarf, a band); a plain animal, or a homage that
 * comes in every color anyway, is drawn in the player's color. Either way it's the player's HUD color.
 */
export const CAST = [
  'plumber',
  'hedgehog',
  'elf',
  'hunter',
  'zapmouse',
  'impostor',
  'puffball',
  'jelly',
  'goose',
  'engineer',
  'fox',
  'frog',
  'penguin',
  'chicken',
  'chomper',
] as const;
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
  /** The player's color: the body, or a homage's secondary slot (a ring at its feet, a scarf); and this player's HUD color. */
  body: HSL;
  /** A second note in the player's livery, never louder than `body`. */
  accent: HSL;
  kind: Kind;
  /** The kind's own color: a homage's iconic body color, a plain animal's pale chest. */
  paint: HSL;
  /** Rolls in 0..1 that the kind's art reads in its own order: small details inside a design. */
  vary: number[];
  eyes: { count: 1 | 2 | 3; size: number; style: EyeStyle; iris: HSL; spread: number; y: number };
  mouth: Mouth;
}

/**
 * Sound-alike names for the homages, as data: never the original's real name in code or UI. Plain
 * animals are just what they are.
 */
export const KIND_NAMES: Record<Kind, string> = {
  plumber: 'Plumbo',
  hedgehog: 'Sanic',
  elf: 'Lonk',
  hunter: 'Sammus',
  zapmouse: 'Pikachew',
  impostor: 'Sussy',
  puffball: 'Kurby',
  jelly: 'Meltroid',
  goose: 'Honkers',
  engineer: 'Engie',
  fox: 'Fox',
  frog: 'Frog',
  penguin: 'Penguin',
  chicken: 'Chicken',
  chomper: 'Snack-Man',
};

/**
 * Each kind's own color, a few close variants of it: a homage's iconic body color (the speedster's
 * cobalt, the mouse's yellow), or a plain animal's pale chest. Calm, never louder than the player's.
 */
const PAINTS: Record<Kind, readonly HSL[]> = {
  plumber: [hsl3(4, 70, 50)],
  hedgehog: [hsl3(222, 70, 46), hsl3(218, 64, 50)],
  elf: [hsl3(110, 46, 40), hsl3(118, 40, 38)],
  hunter: [hsl3(24, 82, 50), hsl3(18, 78, 48)],
  zapmouse: [hsl3(50, 90, 58), hsl3(46, 86, 56)],
  impostor: [hsl3(200, 30, 80)],
  puffball: [hsl3(352, 62, 52), hsl3(8, 60, 50)],
  jelly: [hsl3(100, 60, 70), hsl3(110, 56, 66)],
  goose: [hsl3(40, 20, 95), hsl3(30, 12, 93)],
  engineer: [hsl3(2, 60, 46), hsl3(214, 52, 46)],
  fox: [hsl3(40, 40, 90), hsl3(30, 30, 86)],
  frog: [hsl3(60, 40, 84), hsl3(45, 36, 86)],
  penguin: [hsl3(40, 30, 94), hsl3(200, 12, 92)],
  chicken: [hsl3(4, 70, 52), hsl3(354, 64, 50)],
  chomper: [hsl3(49, 92, 56), hsl3(46, 88, 55)],
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
