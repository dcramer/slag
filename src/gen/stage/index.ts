import { deriveSeed, Rng } from '../../core/rng';
import type { LevelProfile } from '../../sim/level';
import type { ThemeId } from '../../themes';
import { CASTLE_CONCEPTS } from './castle';
import { FACTORY_CONCEPTS } from './factory';
import { FARM_CONCEPTS } from './farm';
import { HARBOR_CONCEPTS } from './harbor';
import { VOLCANO_CONCEPTS } from './volcano';
import type { Concept } from './types';

export type { Concept, Landmark } from './types';
export {
  contractOf,
  defineConcept,
  type Footing,
  footingFaults,
  LANDMARK_RULES,
  type LandmarkContract,
  landmarkFaults,
  layoutDiff,
  layoutOf,
  measureScale,
  ownPieces,
  protectedFaults,
  type Scale,
} from './contract';

/**
 * Stage concepts per theme (docs/SETPIECES.md): one file per theme in this
 * folder adds its list here. Empty means every level of the theme is plain.
 */
export const CONCEPTS: Record<ThemeId, Concept[]> = {
  farm: FARM_CONCEPTS,
  factory: FACTORY_CONCEPTS,
  castle: CASTLE_CONCEPTS,
  jungle: [],
  volcano: VOLCANO_CONCEPTS,
  harbor: HARBOR_CONCEPTS,
  mine: [],
  rooftops: [],
  glacier: [],
  space: [],
};

/** Share of levels that stay plain where a concept would fit: the counterpoint that keeps landmarks special. */
export const PLAIN_SHARE = 0.2;

/** `ProfileOverride.concept` value that forces a plain level. */
export const PLAIN = 'plain';

/**
 * The level's concept, or null for a plain level. Fixed per level, from its
 * own stream: a per-attempt roll would quietly select for the concepts that
 * are easiest to sculpt. Only concepts that fit the level's size and route
 * are drawn. `force` (tools, `?concept=`) picks one by id regardless, or
 * `PLAIN`; an id the theme doesn't have is plain.
 */
export function rollConcept(
  seed: number,
  themeId: ThemeId,
  profile: Pick<LevelProfile, 'size' | 'route'> & Partial<LevelProfile>,
  force?: string,
): Concept | null {
  const all = CONCEPTS[themeId];
  if (force !== undefined) return all.find((c) => c.id === force) ?? null;
  const pool = all.filter((c) => fits(c, profile));
  if (!pool.length) return null;
  const rng = new Rng(deriveSeed(seed, `concept:${themeId}`));
  if (rng.next() < PLAIN_SHARE) return null;
  return rng.weighted(pool.map((c) => [c, c.weight] as const));
}

/** Does the concept support this size and route, and whatever else it asks of the level (`Concept.fits`)? */
export function fits(c: Concept, p: Pick<LevelProfile, 'size' | 'route'> & Partial<LevelProfile>): boolean {
  return c.sizes.includes(p.size) && (!c.routes || c.routes.includes(p.route)) && (!c.fits || c.fits(p));
}

/** The level's name with a concept: one of its `names`, `{place}` filled with the theme's place name. */
export function conceptName(seed: number, c: Concept, place: string): string {
  if (!c.names?.length) return place;
  return new Rng(deriveSeed(seed, `concept-name:${c.id}`)).pick(c.names).replaceAll('{place}', place);
}
