import { hash2 } from '../core/rng';

/**
 * The numbers a decor piece's art draws from its seed (decor*.ts). There are two kinds of knob, kept apart
 * by name because they behave differently: `bits01` reads overlapping bits of the seed, so nearby knobs move
 * together, and a theme's `hashKnobs` hashes each knob on its own. A theme keeps the kind it was drawn
 * with: switching changes every piece it has.
 */

/** The low 16 bits of a seed: what a piece's pen marks are seeded with. */
export const low16 = (seed: number): number => seed & 0xffff;

/** A 0..1 knob read off bits `n` and up of a seed. Knobs a few bits apart share most of their bits. */
export const bits01 = (seed: number, n: number): number => ((seed >>> n) % 1000) / 1000;

/** A theme's hashed knobs: knob `n` of a piece, 0..1 and independent of every other; `salt` is the theme's. */
export const hashKnobs =
  (salt: number) =>
  (d: { seed: number }, n: number): number =>
    hash2(n, salt, low16(d.seed));
