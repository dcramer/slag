import type { Rng } from '../../core/rng';
import { type LevelProfile } from '../../sim/level';
import { type Grid, hintGap } from '../level/kit';
import { hardGap, type Knobs, pit, undercut } from '../level/sculptors/common';
import { oneGap, SITE_MARGIN } from './kit';

/**
 * What every factory landmark shares (gen/stage/factory.ts, factory-works.ts): each one owns the level's
 * hard crossing, a vat on its spawn side sized with `hardGap`, and stands on the far bank. Past the vat,
 * nothing it carries can give a bare run a ride over it.
 */

/** Flat floor between a vat and the structure: the bridge's landing. */
export const BANK = 2;

/**
 * Open floor a landmark leaves at its far end, in its box: the ground past the box may stand a step higher
 * than the floor the box levelled, and a passage that ended against it would be a dead end.
 */
export const APRON = 2;

/**
 * The hard vat a landmark owns: columns x0..x1 open to the bottom, its bridge hinted, its far bank undercut
 * below the floor row `G` (`undercut` from the ceiling would hollow the whole bank under a roof).
 */
export function vat(g: Grid, x0: number, x1: number, G: number): void {
  pit(g, x0, x1, G, false);
  hintGap(g, x0, x1, G);
  undercut(g, x1 + 1, 2, G);
}

/** Does a landmark `cols` wide fit beside the widest crossing, inside the margins? A classic level under low gravity doesn't. */
export function roomFor(p: Partial<LevelProfile>, cols: number): boolean {
  if (p.w === undefined) return true;
  return oneGap(p.gravity) + cols <= p.w - 2 * SITE_MARGIN;
}

/**
 * Columns of structure a landmark's box asks for past its vat and bank: all a classic level's middle has
 * left, a roll in `wide` on a wider one (never under `min`, never more than there's room for).
 */
export function structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number]): number {
  const room = k.W - 2 * SITE_MARGIN - oneGap() - BANK;
  return Math.max(min, Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : room));
}

/**
 * The vat in front of a structure whose first column is `s0`: a `hardGap` dug at the right end of the
 * crossing's columns, the bank's columns left standing between it and the structure. Nothing dug when the
 * level asks for no parts.
 */
export function vatBefore(g: Grid, rng: Rng, s0: number, G: number, parts: number): void {
  if (parts <= 0) return;
  const x1 = s0 - BANK - 1;
  vat(g, x1 - Math.min(oneGap(), hardGap(rng)) + 1, x1, G);
}
