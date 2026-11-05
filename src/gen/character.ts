import { type HSL, hsl3 } from '../core/color';
import { nameBlocked } from '../core/name-filter';
import { deriveSeed, Rng } from '../core/rng';
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
  'chomper',
  'miner',
  'ape',
  'merc',
  'king',
  'dino',
  'robot',
  'sneak',
  'cuptoon',
  'horse',
  'rapper',
  'limbless',
  'worm',
  'dragon',
  'hopper',
] as const;
export type Kind = (typeof CAST)[number];

/**
 * A procedurally generated character. Purely cosmetic: every character uses the same hitbox and
 * physics so the competitive game stays fair. Its face is its kind's, never rolled: every plumber has
 * the plumber's eyes (`KINDS` in src/render/cast/kinds.ts, `face` in a rendered kind's sprite.json).
 */
export interface CharacterDef {
  seed: number;
  name: string;
  hue: number;
  /** The player's color: the body, or a homage's secondary slot (a ring at its feet, a scarf); and this player's HUD color. */
  body: HSL;
  /** A second note in the player's livery, never louder than `body`. */
  accent: HSL;
  /** Index into PLAYER_COLORS when `body` is a swatch; absent for a hue rolled from the seed alone (saved looks from before swatches). */
  color?: number;
  kind: Kind;
  /** The kind's own color: a homage's iconic body color, a plain animal's pale chest. */
  paint: HSL;
  /**
   * Rolls in 0..1 that the kind's art reads in its own order: small details inside a design. The first
   * `VARY_FIRST` are the original six; the rest are the rendered kinds' variety (`VARIETY` in
   * src/render/cast/sprites/play.ts), from a stream of their own.
   */
  vary: number[];
}

/**
 * Sound-alike names for the homages, as data: never the original's real name in code or UI. Plain
 * animals are just what they are.
 */
/** @public Data for people, not code: AGENTS.md → Character kind. */
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
  chomper: 'Snack-Man',
  miner: 'Stove',
  ape: 'Dankey Kang',
  merc: 'Clod',
  king: 'Browser',
  dino: 'Yoshee',
  robot: 'Meh Man',
  sneak: 'Snek',
  cuptoon: 'Mughead',
  horse: 'Hoarse',
  rapper: 'Parapper',
  limbless: 'Raymond',
  worm: 'Earthworm Gym',
  dragon: 'Spiro',
  hopper: 'Kewbert',
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
  chomper: [hsl3(49, 92, 56), hsl3(46, 88, 55)],
  miner: [hsl3(180, 47, 47)],
  ape: [hsl3(25, 45, 35)],
  merc: [hsl3(232, 38, 48)],
  king: [hsl3(100, 45, 40)],
  dino: [hsl3(110, 55, 46)],
  robot: [hsl3(220, 65, 47)],
  sneak: [hsl3(35, 42, 55)],
  cuptoon: [hsl3(2, 65, 50)],
  horse: [hsl3(25, 50, 40)],
  rapper: [hsl3(36, 85, 55)],
  limbless: [hsl3(275, 45, 45)],
  worm: [hsl3(205, 30, 62)],
  dragon: [hsl3(285, 50, 50)],
  hopper: [hsl3(22, 85, 52)],
};

/** How many `vary` rolls a character has, and how many of them come from the look's main stream. */
export const VARY_ROLLS = 12;
export const VARY_FIRST = 6;

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
  // Rolls past the first six come from a stream of their own: drawn from `rng`, they'd change every roll
  // after them (the name) for every seed there is.
  const more = new Rng(deriveSeed(seed, 'vary'));
  const vary = [...Array.from({ length: VARY_FIRST }, () => rng.next()), ...Array.from({ length: VARY_ROLLS - VARY_FIRST }, () => more.next())];
  // Spent where the eye count was once rolled, so every seed keeps the name and colours it had.
  rng.next();
  return {
    seed,
    name: shortName(rng),
    hue,
    body: hsl3(hue, sat, rng.range(52, 60)),
    accent: hsl3(hue + rng.pick([120, 180, 210, 150, 60]), 60, 62),
    kind: k,
    paint,
    vary,
  };
}

/**
 * The player palette: every color a player can wear, around the wheel at least MIN_HUE_APART apart, so
 * two swatches never count as one color. Each is tuned by eye rather than set by formula (`pnpm shot cast
 * --only colors`): lightness and saturation pull the close neighbours apart (lime from green, blue from
 * violet), so every one reads as a whole costume (a cap and shirt, quills, a puffball), as a ring beside a
 * kind's own palette, on every theme's ground and on the dark HUD.
 */
export const PLAYER_COLORS: readonly HSL[] = [
  hsl3(356, 74, 56), // red
  hsl3(28, 88, 55), // orange
  hsl3(58, 86, 54), // yellow
  hsl3(92, 62, 50), // lime
  hsl3(128, 52, 46), // green
  hsl3(166, 64, 44), // teal
  hsl3(198, 78, 54), // sky
  hsl3(228, 82, 60), // blue
  hsl3(262, 58, 70), // violet
  hsl3(294, 56, 60), // purple
  hsl3(326, 74, 64), // pink
];

/** Degrees of hue a player's color keeps from everyone else's (the palette's closest pair is this far apart). */
export const MIN_HUE_APART = 30;

/** Degrees between two hues, the short way round. */
export function hueApart(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** The same character in swatch `i`: body and hue from the palette, the accent keeping the interval it was rolled with. */
export function withColor(c: CharacterDef, i: number): CharacterDef {
  const sw = PLAYER_COLORS[i];
  const off = c.accent.h - c.hue;
  return { ...c, hue: sw.h, body: { ...sw }, accent: hsl3((((sw.h + off) % 360) + 360) % 360, c.accent.s, c.accent.l), color: i };
}

/** `c` wearing `from`'s color, whatever it is: a swatch, or a hue rolled before there were any. */
export function keepColor(c: CharacterDef, from: CharacterDef): CharacterDef {
  const { color: _drop, ...rest } = c;
  const out: CharacterDef = { ...rest, hue: from.hue, body: from.body, accent: from.accent };
  if (from.color !== undefined) out.color = from.color;
  return out;
}

/** A swatch index off the wire or out of storage, or undefined if it isn't one. */
export function swatchIndex(v: unknown): number | undefined {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < PLAYER_COLORS.length ? (v as number) : undefined;
}

/**
 * Names that fit HUD chips: retry (deterministically) until ≤ 10 chars and one the name filter allows, since the
 * generated name is what a refused one falls back to.
 */
function shortName(rng: Rng): string {
  for (let i = 0; i < 20; i++) {
    const n = word(rng, 2, 3);
    if (n.length <= 10 && !nameBlocked(n)) return n;
  }
  for (;;) {
    const n = word(rng, 1, 1);
    if (!nameBlocked(n)) return n;
  }
}
