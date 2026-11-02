import { deriveSeed, Rng } from '../core/rng';

/**
 * Character-direction prototypes for docs/CHARACTERS.md, behind `?cast=a|b|c`. Nothing here reaches
 * players: `generateCharacter` is untouched and every saved look still means what it meant.
 *
 * Each direction is a list of kinds the art registers against (`src/render/cast/`): a creature print on
 * today's blob (A), a species (B), or a foundry toy (C). A character's kind and its variation within the
 * kind are a pure function of its look seed, so the same seed draws the same in every view and on every
 * peer. `assignCast` is what a match would do in Phase 2: keep eight players on eight different kinds.
 */

export type CastMode = 'a' | 'b' | 'c';

export const PRINTS = [
  'bee',
  'ladybug',
  'frog',
  'tabby',
  'zebra',
  'calico',
  'leopard',
  'cow',
  'jelly',
  'mushroom',
  'beetle',
  'patchwork',
  'giraffe',
  'clownfish',
  'scales',
  'dalmatian',
] as const;
export type Print = (typeof PRINTS)[number];

export const SPECIES = ['bee', 'frog', 'cat', 'bunny', 'owl', 'duck', 'fox', 'hedgehog', 'penguin', 'snail', 'crab', 'axolotl', 'pig', 'bear'] as const;
export type Species = (typeof SPECIES)[number];

export const TOYS = ['robot', 'piggybank', 'tincan', 'kettle', 'bell', 'crucible', 'slagblob', 'soldier', 'beetle', 'jackbox'] as const;
export type Toy = (typeof TOYS)[number];

export const CAST_KINDS: Record<CastMode, readonly string[]> = { a: PRINTS, b: SPECIES, c: TOYS };

/** A kind, and the numbers that vary it inside the kind (pattern density, ear shape, livery...). */
export interface CastRoll {
  kind: number;
  /** Eight rolls in 0..1, read by the kind's art in its own order. */
  vary: readonly number[];
}

export function rollCast(seed: number, mode: CastMode): CastRoll {
  const rng = new Rng(deriveSeed(seed, `cast:${mode}`));
  const kind = Math.floor(rng.next() * CAST_KINDS[mode].length);
  return { kind, vary: Array.from({ length: 8 }, () => rng.next()) };
}

/**
 * Kinds for a lobby in slot order: each player keeps their own roll unless an earlier slot already has
 * it, then takes the next free kind. With more kinds than players nobody ever shares one.
 */
export function assignCast(seeds: readonly number[], mode: CastMode): number[] {
  const n = CAST_KINDS[mode].length;
  const taken = new Set<number>();
  return seeds.map((s) => {
    let k = rollCast(s, mode).kind;
    for (let i = 0; i < n && taken.has(k); i++) k = (k + 1) % n;
    taken.add(k);
    return k;
  });
}
