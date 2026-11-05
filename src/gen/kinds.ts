import type { ThemeId } from '../themes';
import { decorFor } from './decor';
import { SET_PIECE_RECIPES } from './setpieces';
import { CONCEPTS } from './stage';
import { contractOf } from './stage/contract';

/**
 * Every kind of generated thing has one registry, keyed by theme where it applies, and a contract declared
 * as data on each entry; the engine enforces the contract while generating, and tests/conformance holds
 * every registered entry to it (src/gen/AGENTS.md has the guide):
 *
 * | Kind              | Registry (define it with)                                  | Enforced while generating                  |
 * |-------------------|------------------------------------------------------------|--------------------------------------------|
 * | landmark          | CONCEPTS, gen/stage (`defineConcept`)                      | `landmarkFaults`, the landmark pieces' checks |
 * | set piece, hazard | SET_PIECE_RECIPES, gen/setpieces (`defineSetPiece`)        | `finalize`, `keep`, `noFreeRide`, `tellFaults` |
 * | decor             | DECOR_RULES, gen/decor (`defineDecor`)                     | `placeDecor`                               |
 * | level shape       | BUILDERS over SET_KITS, gen/level/builders and sets        | `judge`, lanes, LAST_RESORT, fallbacks     |
 * | part              | RECIPES, gen/props.ts                                     | `rollPart` (sizes only scale)              |
 * | look              | RECIPES, gen/theme/presets.ts                              | (the type: Record<ThemeId, …>)             |
 * | weather           | WEATHER_KINDS, sim/weather.ts; gates in gen/level/weather  | the weather gate                           |
 *
 * And per theme, the owner's minimums (docs/DECISIONS.md, 2026-11-02): at least 5 landmarks, 12 decor
 * pieces and 3 hazards unique to it, with between 1 and 3 of the landmarks grand (GRAND_LANDMARKS).
 */
export const THEME_MINIMUMS = { landmarks: 5, decor: 12, uniqueHazards: 3, grand: 1 } as const;

/** Grand landmarks per theme: at least one so every theme has a level built inside its landmark, at most three so grand stays special. */
export const GRAND_LANDMARKS = { min: THEME_MINIMUMS.grand, max: 3 } as const;

export type ThemeCounts = Record<keyof typeof THEME_MINIMUMS, number>;

const LABEL: Record<keyof ThemeCounts, string> = { landmarks: 'landmarks', decor: 'decor pieces', uniqueHazards: 'unique hazards', grand: 'grand landmarks' };

/**
 * What a theme has registered of each counted kind. A unique hazard is a set-piece recipe flagged `unique`
 * (tests/conformance checks the flag is true: nothing in any other theme hurts the same way).
 */
export function themeCounts(theme: ThemeId): ThemeCounts {
  return {
    landmarks: CONCEPTS[theme].length,
    decor: decorFor(theme).length,
    uniqueHazards: SET_PIECE_RECIPES[theme].filter((r) => r.unique).length,
    grand: CONCEPTS[theme].filter((c) => contractOf(c).scale === 'grand').length,
  };
}

/** What a theme still lacks against THEME_MINIMUMS, one line per kind ([] when it meets them all). */
export function themeShortfalls(theme: ThemeId): string[] {
  const have = themeCounts(theme);
  return (Object.keys(THEME_MINIMUMS) as (keyof ThemeCounts)[])
    .filter((k) => have[k] < THEME_MINIMUMS[k])
    .map((k) => `${THEME_MINIMUMS[k] - have[k]} more ${LABEL[k]} (${have[k]} of ${THEME_MINIMUMS[k]})`);
}

/** A ceiling a theme breaks (more than GRAND_LANDMARKS.max grand landmarks), or null. Unlike a shortfall this is never pending. */
export function themeExcess(theme: ThemeId): string | null {
  const grand = themeCounts(theme).grand;
  return grand > GRAND_LANDMARKS.max ? `${grand} grand landmarks, at most ${GRAND_LANDMARKS.max}` : null;
}
