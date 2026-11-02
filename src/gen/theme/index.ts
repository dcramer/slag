import { deriveSeed, Rng } from '../../core/rng';
import type { ThemeId } from '../../themes';
import { RECIPES } from './presets';
import type { Theme } from './types';

export type {
  Ambient,
  CapKind,
  Celestial,
  CloudStyle,
  DecorKind,
  LiquidKind,
  Mood,
  PlatformKind,
  SkyLayer,
  SkylineKind,
  TerrainKind,
  TerrainLook,
  Theme,
} from './types';

/**
 * Generate the look of a level: a theme-specific recipe (see ./presets.ts)
 * rolled with a seeded Rng, so the same (seed, id) always yields the same
 * palette, skyline, materials, decor and grade.
 */
export function generateTheme(seed: number, id: ThemeId): Theme {
  const rng = new Rng(deriveSeed(seed, `theme:${id}`));
  const look = RECIPES[id](rng);
  return { id, seed, ...look };
}
