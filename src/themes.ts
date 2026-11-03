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
export const THEME_IDS = ['farm', 'factory', 'castle', 'jungle', 'volcano', 'harbor', 'mine', 'rooftops', 'glacier', 'space'] as const;
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
  glacier: 'Glacier',
  space: 'Space',
};

/** Each theme's one-line joke on its page in the codex's maps (src/codex/maps.ts). */
export const THEME_NOTES: Record<ThemeId, string> = {
  farm: 'Fresh air. Live fences.',
  factory: 'Days without incident: 0.',
  castle: 'Drafty, haunted, moated. Viewing by appointment.',
  jungle: 'Everything here bites. The furniture too.',
  volcano: 'The floor is lava. Literally.',
  harbor: 'Mind the gap. The gap is the sea.',
  mine: 'Mind your head. The roof won’t.',
  rooftops: 'Nobody takes the stairs.',
  glacier: 'Slippery when frozen. Always frozen.',
  space: 'No floor. No weather. No refunds.',
};

/**
 * Themes whose ground floats (space): nothing stands on anything. The renderer ends a body at the top or
 * bottom row instead of running it on as a column, and a landmark there may float (gen/stage/contract.ts).
 */
export const FLOATS: ReadonlySet<ThemeId> = new Set(['space']);

/** The themes every seed was dealt from before later themes arrived. */
const FIRST_THEMES: readonly ThemeId[] = THEME_IDS.slice(0, 8);
/**
 * Themes added since, and the share of seeds they take between them. They
 * roll first, from their own stream, so every other seed keeps the theme it
 * always had. 16% puts each of the two at about 8% of levels against about
 * 10.5% for each original: there to be met, never the usual.
 */
const LATE_THEMES: readonly ThemeId[] = ['glacier', 'space'];
const LATE_SHARE = 0.16;

/** Deterministic theme for a level seed. */
export function pickThemeId(seed: number): ThemeId {
  const late = new Rng(deriveSeed(seed, 'theme-late'));
  if (late.chance(LATE_SHARE)) return late.pick(LATE_THEMES);
  return new Rng(deriveSeed(seed, 'theme-id')).pick(FIRST_THEMES);
}
