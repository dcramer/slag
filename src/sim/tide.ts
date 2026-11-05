import { FPS, RUN_COUNTDOWN, TILE } from './constants';
import type { Level } from './level';

/**
 * Rising Slag (docs/DESIGN.md → Modes): the Foundry pours, and molten slag
 * rises from the bottom of the level. Everything under its surface burns, the
 * spawn zone included, the way the pit takes you anywhere.
 *
 * Like weather, it holds no state: the surface is arithmetic on
 * `(level.tide, frame)`, so a snapshot carries nothing for it and every peer
 * agrees on where it stands. It isn't a part: nothing places on it, bombs
 * don't touch it, and the winnability proof never sees it.
 */
export interface Tide {
  /** Seconds after GO before the slag moves. */
  wait: number;
  /** Rise speed when it starts, tiles/s. */
  speed: number;
  /** What the rise speed gains every second, tiles/s². The slag always catches up. */
  gain: number;
  /**
   * Tile row whose bottom edge the slag starts at: the level's lowest open row, so it pools in sight from GO
   * rather than rising unseen under the floor (gen/level/index.ts). Absent: the level's bottom edge.
   */
  from?: number;
}

/**
 * The one tide a Rising Slag level carries (gen/level/index.ts). It presses from the start (20 rows in its first
 * 10 s) and gains fast: past 5 tiles/s by 35 s, more than a climb of switchback storeys keeps up, and over a whole
 * 200-row tower (`TIDE_TOWER_H`) by about 52 s, so every round ends inside a minute.
 */
export const SLAG_TIDE: Tide = { wait: 2, speed: 1.5, gain: 0.1 };

/** Px the slag has risen from where it starts on run frame `f`. 0 until it moves. */
export function tideRise(tide: Tide, f: number): number {
  const s = (f - RUN_COUNTDOWN) / FPS - tide.wait;
  if (s <= 0) return 0;
  return TILE * (tide.speed * s + (tide.gain * s * s) / 2);
}

/** World y the slag starts at, or null on a level without a tide. */
export function tideStart(level: Level): number | null {
  return level.tide ? (level.tide.from ?? level.h) * TILE : null;
}

/** World y of the slag's surface on run frame `f`, or null on a level without a tide. Under it, everything burns. */
export function tideLine(level: Level, f: number): number | null {
  const start = tideStart(level);
  return start === null ? null : start - tideRise(level.tide!, f);
}

/** The row under the lowest open cell of `tiles` (w × h, 1 solid): where a tide starts on that level. */
export function lowestOpen(tiles: Uint8Array, w: number, h: number): number {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (tiles[y * w + x] !== 1) return y + 1;
  return h;
}

/** How far through the wait before the slag moves, 0…1 (1 once it rises): the art's warning. */
export function tideWarn(level: Level, f: number): number {
  if (!level.tide) return 0;
  const s = (f - RUN_COUNTDOWN) / FPS;
  return Math.max(0, Math.min(1, s / level.tide.wait));
}
