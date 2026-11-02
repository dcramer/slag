import type { Rng } from '../../core/rng';
import type { Level } from '../../sim/level';
import type { PlacedProp } from '../../sim/props';
import type { ThemeId } from '../../themes';
import { CASTLE } from './castle';
import { FACTORY } from './factory';
import { FARM } from './farm';
import { GLACIER } from './glacier';
import { HARBOR } from './harbor';
import { JUNGLE } from './jungle';
import { MINE } from './mine';
import { makePlacer, type PlacerOpts, type Recipe } from './place';
import { ROOFTOPS } from './rooftops';
import { SPACE } from './space';
import { VOLCANO } from './volcano';

export type { Piece, Recipe } from './place';
export { finalize, type PlacerOpts, SAFE_TILES, Site } from './place';

/**
 * Theme set pieces: large, pre-placed props that make a level interesting
 * or dangerous (a tractor patrolling a farm, a windmill, a foundry press…).
 * They are ordinary PlacedProps with owner = -1, built from prop modules,
 * and persist for the whole match.
 *
 * A SetPiecePlacer looks at the finished terrain and returns the pieces to
 * add. It must be deterministic in `rng`, must not touch protected rects,
 * and must use `level.setPieces`-compatible uids (start at SET_PIECE_UID).
 *
 * Each theme is a list of recipes (./<theme>.ts) built from the generic
 * builders in ./builders.ts; ./place.ts validates every candidate by
 * simulating it (footprint, spawn/goal safety, path not cut).
 */
export type SetPiecePlacer = (rng: Rng, level: Level, opts?: PlacerOpts) => PlacedProp[];

export const SET_PIECE_UID = 100_000;

export const SET_PIECE_RECIPES: Record<ThemeId, readonly Recipe[]> = {
  farm: FARM,
  factory: FACTORY,
  castle: CASTLE,
  jungle: JUNGLE,
  volcano: VOLCANO,
  harbor: HARBOR,
  mine: MINE,
  rooftops: ROOFTOPS,
  glacier: GLACIER,
  space: SPACE,
};

export const SET_PIECES: Record<ThemeId, SetPiecePlacer> = Object.fromEntries(
  Object.entries(SET_PIECE_RECIPES).map(([id, recipes]) => [id, makePlacer(id, recipes, SET_PIECE_UID)]),
) as Record<ThemeId, SetPiecePlacer>;
