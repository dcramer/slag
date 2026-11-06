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
/** Pristine copies kept of the levels handed out lately (each under up to two keys). */
const MAX_KEPT = 12;

interface Ready {
  level: Level;
  /** Its `recipeKey`: the same level asked for the way a snapshot asks. */
  recipe: string;
}

const ready = new Map<string, Ready>();
/**
 * Untouched copies of what `buildLevel` handed out, by the key it was asked with and by its recipe: a snapshot of
 * the level a page is already playing restores from here instead of generating it again. Never mutate one.
 */
const kept = new Map<string, Level>();

export function levelKey({ seed, theme, profile }: LevelRequest): string {
  return `${seed >>> 0}:${theme ?? ''}:${JSON.stringify(profile)}`;
}

/**
 * What rebuilds `level`, asked for with `asked`: its own profile and the stage concept it raised (or was forced to
 * try). Snapshots carry this rather than the request, since rules can change after a level is built.
 */
export function levelRecipe(level: Level, asked: ProfileOverride): ProfileOverride {
  if (!level.profile) return asked;
  const concept = level.landmark?.concept ?? asked.concept;
  return { ...level.profile, ...(concept ? { concept } : {}) };
}

function recipeKey(req: LevelRequest, level: Level): string {
  return levelKey({ ...req, profile: levelRecipe(level, req.profile) });
}

/** Hand over a finished level, built for `req`. The caller gives up the object: a match writes to it. */
export function offerLevel(req: LevelRequest, level: Level): void {
  const key = levelKey(req);
  ready.delete(key);
  ready.set(key, { level, recipe: recipeKey(req, level) });
  if (ready.size > MAX_READY) ready.delete(ready.keys().next().value!);
}

/** Drop every level not in `keys`: what was built for a lobby that's moved on. */
export function keepLevels(keys: ReadonlySet<string>): void {
  for (const k of ready.keys()) if (!keys.has(k)) ready.delete(k);
}

export function hasLevel(key: string): boolean {
  return ready.has(key);
}

/** The ready entry for `key`, asked for by request or by recipe. */
function readyFor(key: string): [string, Ready] | undefined {
  const r = ready.get(key);
  if (r) return [key, r];
  for (const e of ready) if (e[1].recipe === key) return e;
  return undefined;
}

/** Can `req` (a request or a recipe) be had without generating it: offered, or handed out lately? */
export function levelAtHand(req: LevelRequest): boolean {
  const key = levelKey(req);
  return kept.has(key) || !!readyFor(key);
}

function keep(req: LevelRequest, level: Level): void {
  const copy = { ...level, tiles: level.tiles.slice(), setPieces: [...level.setPieces] };
  for (const key of [levelKey(req), recipeKey(req, level)]) {
    kept.delete(key);
    kept.set(key, copy);
  }
  while (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value!);
}

/** The level for this request: ready-made if one was offered, generated here if not. */
export function buildLevel(seed: number, theme: ThemeId | undefined, profile: ProfileOverride): Level {
  const req = { seed, theme, profile };
  const hit = readyFor(levelKey(req));
  if (hit) ready.delete(hit[0]);
  const level = hit?.[1].level ?? generateLevel(seed, theme, profile);
  keep(req, level);
  return level;
}

/**
 * The level for `req` as it was generated, shared: kept from when it was handed out, or built now. Never mutate it.
 * Snapshots restore on top of it.
 */
export function pristineLevel(req: LevelRequest): Level {
  const key = levelKey(req);
  let level = kept.get(key);
  if (!level) {
    buildLevel(req.seed, req.theme, req.profile);
    level = kept.get(key)!;
  }
  return level;
}
