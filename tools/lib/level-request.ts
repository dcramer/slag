/**
 * One seed, one level: what `pnpm level` and `pnpm shot levels` ask the generator for, asked the way a match asks.
 * A typed seed reads through `parseSeed`, as the game reads `?seed=`, the Level card and `slagDebug.loadLevel` (base 36
 * up to seven characters, so `17` is 43, and a hash past that); reading digits as decimal here once made `pnpm level 17`
 * a different level from the shot of seed 17. A mode's knobs go over the forced ones through `rulesProfile`, as
 * `Match.profileOverride` puts them. tests/level-request.test.ts holds this to the level a match builds.
 */
import { parseSeed } from '../../src/core/rng';
import { rulesProfile } from '../../src/game/match';
import { MODE_IDS, type ModeId } from '../../src/game/modes';
import { DEFAULT_RULES, withMode } from '../../src/game/rules';
import type { ProfileOverride } from '../../src/gen/level';
import type { LevelRequest } from '../../src/gen/level/pregen';
import type { ThemeId } from '../../src/themes';

/** `--mode` (`pnpm level`) or `--game` (`pnpm shot`) by name; none is a race. */
export function modeNamed(name: string | undefined): ModeId {
  if (name === undefined) return 'race';
  const mode = MODE_IDS.find((id) => id === name);
  if (!mode) throw new Error(`mode ${name}: one of ${MODE_IDS.join(', ')}`);
  return mode;
}

/** The profile a match in `mode`, under the default rules, asks its level for, with `force` (the URL's or the CLI's knobs) under it. */
export function levelProfile(force: ProfileOverride, mode?: string): ProfileOverride {
  return { ...force, ...rulesProfile(withMode(DEFAULT_RULES, modeNamed(mode))) };
}

/** The level for a seed as typed: hand it to `generateLevel(seed, theme, profile)`. */
export function levelRequest(typed: string, theme: ThemeId | undefined, force: ProfileOverride, mode?: string): LevelRequest {
  return { seed: parseSeed(typed), theme, profile: levelProfile(force, mode) };
}
