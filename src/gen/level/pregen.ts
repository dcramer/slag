import type { Level } from '../../sim/level';
import type { ThemeId } from '../../themes';
import { generateLevel } from './index';
import type { ProfileOverride } from './profile';

/**
 * Levels built ahead of time. Generation is a pure function of its arguments,
 * so a level made on another thread is the level every peer would have made
 * here, and handing one over changes nothing but when the work happened. The
 * match asks `buildLevel` either way: a miss just generates on the spot, which
 * is all tests and tools ever do. The browser fills this from a worker
 * (src/level-ahead.ts), since a level takes tens of frames to generate.
 */

export interface LevelRequest {
  seed: number;
  theme?: ThemeId;
  profile: ProfileOverride;
}

/** Most levels held at once; older offers are dropped. */
const MAX_READY = 12;

const ready = new Map<string, Level>();

export function levelKey({ seed, theme, profile }: LevelRequest): string {
  return `${seed >>> 0}:${theme ?? ''}:${JSON.stringify(profile)}`;
}

/** Hand over a finished level. The caller gives up the object: a match writes to it. */
export function offerLevel(key: string, level: Level): void {
  ready.delete(key);
  ready.set(key, level);
  if (ready.size > MAX_READY) ready.delete(ready.keys().next().value!);
}

/** Drop every level not in `keys`: what was built for a lobby that's moved on. */
export function keepLevels(keys: ReadonlySet<string>): void {
  for (const k of ready.keys()) if (!keys.has(k)) ready.delete(k);
}

export function hasLevel(key: string): boolean {
  return ready.has(key);
}

/** The level for this request: ready-made if one was offered, generated here if not. */
export function buildLevel(seed: number, theme: ThemeId | undefined, profile: ProfileOverride): Level {
  const key = levelKey({ seed, theme, profile });
  const level = ready.get(key);
  if (!level) return generateLevel(seed, theme, profile);
  ready.delete(key);
  return level;
}
