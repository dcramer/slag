import type { Rng } from '../../core/rng';
import type { Level } from '../../sim/level';
import type { PlacedProp } from '../../sim/props';
import type { ThemeId } from '../../themes';

/**
 * Theme set pieces: large, pre-placed props that make a level interesting
 * or dangerous (a tractor patrolling a farm, a windmill, a foundry press…).
 * They are ordinary PlacedProps with owner = -1, built from prop modules,
 * and persist for the whole match.
 *
 * A SetPiecePlacer looks at the finished terrain and returns the pieces to
 * add. It must be deterministic in `rng`, must not touch protected rects,
 * and must use `level.setPieces`-compatible uids (start at SET_PIECE_UID).
 */
export type SetPiecePlacer = (rng: Rng, level: Level) => PlacedProp[];

export const SET_PIECE_UID = 100_000;

export const SET_PIECES: Record<ThemeId, SetPiecePlacer> = {
  farm: () => [],
  factory: () => [],
  castle: () => [],
  jungle: () => [],
  volcano: () => [],
  harbor: () => [],
  mine: () => [],
  rooftops: () => [],
};
