import { THEME_IDS, type ThemeId } from '../../../themes';
import { builderFor } from '../builders';
import { SET_KITS } from '../sets';
import type { Sculptor } from '../types';
import { legacy } from './legacy';

/** A theme's level shapes: the builder for the level's profile (builders/) composing the theme's kit (sets/). */
export const SCULPTORS = Object.fromEntries(
  THEME_IDS.map((id) => [id, ((ctx) => builderFor(ctx.profile).build(ctx, SET_KITS[id])) satisfies Sculptor]),
) as Record<ThemeId, Sculptor>;

/**
 * Theme-agnostic generator the pipeline falls back to if a theme sculptor
 * keeps failing validation (should never happen; tests assert it doesn't).
 */
export const FALLBACK_SCULPTOR: Sculptor = legacy;
