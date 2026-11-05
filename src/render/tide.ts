import { TILE } from '../sim/constants';
import type { Level } from '../sim/level';
import { tideLine, tideRise, tideWarn } from '../sim/tide';
import type { RC } from './kit';
import { type Liquid, paintBody, paintSurface } from './props/modules/flood';

/**
 * Rising Slag's slag (sim/tide.ts), drawn with the stage flood's pen: the body behind the terrain, so the level
 * stands in it, and the crest in front on the very line the sim burns at. It runs on past the world's sides
 * under the surroundings, so the world doesn't end in a wall of slag.
 *
 * Slag is the Foundry's runoff, darker and more crusted than a volcano's lava: the same hot bands, a duller body.
 */
const SLAG: Liquid = {
  top: { h: 30, s: 100, l: 58 },
  body: { h: 14, s: 88, l: 42 },
  deep: { h: 6, s: 60, l: 22 },
  glint: { h: 44, s: 100, l: 80 },
  hot: true,
};

/** How far down past the crest the body is drawn below the world: the surroundings reach about this far. */
const SUNK = 12 * TILE;

/** The surface's height above the world's bottom edge on `frame`, px, or null on a level without slag. */
function depth(level: Level, frame: number): number | null {
  const line = tideLine(level, frame);
  return line === null ? null : level.h * TILE - line;
}

/** The slag's body, before the terrain. `margin` is how far past the world's sides the view can see. */
export function drawTideBody(rc: RC, level: Level, frame: number, margin: number) {
  const h = depth(level, frame);
  if (h === null || h <= 0) return;
  const floor = level.h * TILE;
  paintBody(rc, SLAG, -margin, level.w * TILE + margin * 2, floor + SUNK, h + SUNK);
}

/** The slag's crest, glints and glow, in front of the terrain. Before it moves, it boils where it pools. */
export function drawTideSurface(rc: RC, level: Level, frame: number) {
  const h = depth(level, frame);
  if (h === null) return;
  const warn = tideRise(level.tide!, frame) > 0 ? 0 : tideWarn(level, frame);
  paintSurface(rc, level, SLAG, 0, level.w * TILE, level.h * TILE, h, warn);
}
