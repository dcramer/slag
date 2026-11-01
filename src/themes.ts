import { deriveSeed, Rng } from './core/rng';

/**
 * Every level belongs to a theme (think "Farm", "Factory"). A theme drives
 * three independent registries, each owned by a different subsystem:
 *
 *   - level shape:   src/gen/level/sculptors   (SCULPTORS[themeId])
 *   - set pieces:    src/gen/setpieces         (SET_PIECES[themeId])
 *   - look & feel:   src/gen/theme.ts + src/render/{background,terrain}.ts
 *
 * Adding a theme: add its id here, then an entry in each registry
 * (TypeScript's Record<ThemeId, …> will tell you where).
 */
export const THEME_IDS = ['farm', 'factory', 'castle', 'jungle', 'volcano', 'harbor', 'mine', 'rooftops'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_LABELS: Record<ThemeId, string> = {
  farm: 'Farm',
  factory: 'Factory',
  castle: 'Castle',
  jungle: 'Jungle',
  volcano: 'Volcano',
  harbor: 'Harbor',
  mine: 'Mine',
  rooftops: 'Rooftops',
};

/** Deterministic theme for a level seed. */
export function pickThemeId(seed: number): ThemeId {
  return new Rng(deriveSeed(seed, 'theme-id')).pick(THEME_IDS);
}
