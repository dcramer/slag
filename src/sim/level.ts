import type { Rect } from '../core/geom';
import type { Theme } from '../gen/theme';
import { TILE } from './constants';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  /** Bumped whenever tiles change so renderers can invalidate caches. */
  version: number;
}

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

export function goalRect(level: Level): Rect {
  return { x: level.goal.tx * TILE - 2, y: level.goal.ty * TILE - TILE, w: TILE + 4, h: TILE * 2 };
}
