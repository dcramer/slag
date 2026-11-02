import type { Rect } from '../core/geom';
import type { Theme } from '../gen/theme';
import { TILE } from './constants';
import type { PlacedProp } from './props/types';

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
  /** Bumped whenever tiles change so renderers can invalidate caches. */
  version: number;
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

/** Goal trigger reach: px past each side of the flag cell, and tiles above it. */
export const GOAL_PAD_X = 6;
export const GOAL_REACH_UP = 4;

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
