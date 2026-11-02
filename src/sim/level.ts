import type { Rect } from '../core/geom';
import type { Theme } from '../gen/theme';
import { TILE } from './constants';
import type { PlacedProp } from './props/types';
import type { Weather } from './weather';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tile kinds stored in Level.tiles. */
export const T_EMPTY = 0;
export const T_SOLID = 1;
/** Jump-through platform: solid only from above. */
export const T_ONEWAY = 2;

/** World-size class of a level (see gen/level/profile.ts). */
export type SizeClass = 'classic' | 'wide' | 'tall';
/**
 * Overall route shape: ltr = left to right at roughly one height; climb =
 * goal well above spawn; descent = goal well below spawn; zigzag = switchback
 * storeys climbing a tall level. Spawn is always on the left, goal on the right.
 */
export type RouteShape = 'ltr' | 'climb' | 'descent' | 'zigzag';

/**
 * Per-level variety knobs, rolled deterministically from the seed (and theme)
 * before sculpting. Plain data, so it survives snapshots.
 */
export interface LevelProfile {
  size: SizeClass;
  /** World size in tiles (same as Level.w/h). */
  w: number;
  h: number;
  /** 0 = sparse (lots of open air, few landmarks) … 1 = dense (packed terrain, ceilings, clutter). */
  density: number;
  /** Target number of theme set pieces (0–4); the placer may find room for fewer. */
  hazards: number;
  /** 0 = tame set-piece mix (platforms, lifts) … 1 = nasty (cannons, saws, presses). */
  danger: number;
  route: RouteShape;
  /** World gravity scale (copied to Level.gravity). */
  gravity: number;
}

export interface Level {
  seed: number;
  w: number;
  h: number;
  /** Row-major, 1 = solid. Mutable during a match (bombs). */
  tiles: Uint8Array;
  /** Empty cell players spawn in (standing on the tile below). */
  spawn: { tx: number; ty: number };
  /** Empty cell holding the goal flag. */
  goal: { tx: number; ty: number };
  /** Tile areas where props can't be placed and bombs can't dig. */
  protectedRects: TileRect[];
  theme: Theme;
  style: string;
  /** Pre-placed, theme-driven set pieces (owner -1). Persist for the whole match. */
  setPieces: PlacedProp[];
  /**
   * One known way to finish with props: cells (left end, 3 wide) where a
   * bridge platform makes the goal reachable. Empty when solvable bare.
   * Set by worldgen; used by validation, tools and tests.
   */
  solution?: { x: number; y: number }[];
  /** World gravity scale (1 = normal; see CollisionWorld.gravity). Physics, reach and projectiles all use it. */
  gravity?: number;
  /** Variety knobs this level was generated with (absent for hand-built test levels). */
  profile?: LevelProfile;
  /** Per-tile ground kind (sim/ground.ts: glacier ice), row-major like `tiles`. Absent means all plain. */
  ground?: Uint8Array;
  /** This level's weather (sim/weather.ts). Absent means clear, as on hand-built test levels. */
  weather?: Weather;
  /** Bumped whenever tiles change so renderers can invalidate caches. */
  version: number;
}

const PROFILE_KEYS = new WeakMap<LevelProfile, string>();

/**
 * Which generated level this is, for anything cached per level. A seed
 * regenerated under other rules (gravity, weather, any profile knob) is
 * another level at the same seed, size and version, so the key carries the
 * whole profile and the weather. A crater only bumps `version`, so it keeps
 * this key. The profile is fixed once generated, so its part is memoized.
 */
export function levelKey(l: Level): string {
  let pk = l.profile ? PROFILE_KEYS.get(l.profile) : '-';
  if (pk === undefined) PROFILE_KEYS.set(l.profile!, (pk = JSON.stringify(l.profile)));
  return `${l.seed}:${l.w}x${l.h}:${l.gravity ?? 1}:${pk}:${l.weather?.kind ?? 'clear'}`;
}

/** Tile kind at (tx, ty). Outside x is a solid wall; outside y is empty. */
export function tileAt(level: Level, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.w) return 1;
  if (ty < 0 || ty >= level.h) return 0;
  return level.tiles[ty * level.w + tx];
}

export function isProtected(level: Level, tx: number, ty: number): boolean {
  for (const r of level.protectedRects) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return true;
  }
  return false;
}

/** World y of the floor under a stand cell: where a runner's feet rest, and so where the spawn ring and the flag's base are drawn. */
export function floorY(cell: { ty: number }): number {
  return (cell.ty + 1) * TILE;
}

/** Bodies below this y have sunk into the pit at the bottom of the level. */
export function killY(level: Level): number {
  return level.h * TILE - 2;
}

/** Goal trigger reach: px past each side of the flag cell, and tiles above it. */
const GOAL_PAD_X = 6;
const GOAL_REACH_UP = 4;

/**
 * The flag's finish trigger: the flag cell widened by GOAL_PAD_X px each side
 * plus a column GOAL_REACH_UP tiles above it, so jumping clear over the flag
 * (even at full jump height from the flag's floor) still counts.
 */
export function goalRect(level: Level): Rect {
  return { x: level.goal.tx * TILE - GOAL_PAD_X, y: (level.goal.ty - GOAL_REACH_UP) * TILE, w: TILE + 2 * GOAL_PAD_X, h: TILE * (GOAL_REACH_UP + 1) };
}

/**
 * The spawn safe zone in world px: the protected rect that holds the spawn
 * cell (the starting pocket). Runners touching it can't be killed by props
 * (see RunWorld). Null when the level has no protected rect around spawn.
 */
export function spawnZone(level: Level): Rect | null {
  const { tx, ty } = level.spawn;
  for (const r of level.protectedRects) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
  }
  return null;
}
