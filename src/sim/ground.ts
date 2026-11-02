import type { Level } from './level';
import { DEFAULT_SURFACE, type Surface } from './physics';
import { footing } from './weather';

/**
 * Ground a theme lays into its own terrain: a per-tile kind on
 * `Level.ground` (row-major like `tiles`, 0 = plain). It belongs to the
 * level, so it's regenerated from the seed with the tiles and never crosses
 * the wire. A bomb takes a tile and its ground with it; what's under it
 * keeps its own.
 *
 * Glacier ice is the only kind so far. It's the same surface an ice coat
 * gives (props/modules/coat.ts), floors and walls alike, so ice means one
 * thing wherever you meet it: long skids, a faster top speed, and a face you
 * can't wall-jump. Plain tiles keep the weather's footing; ice stays ice in
 * any weather.
 */
export const GROUND_PLAIN = 0;
export const GROUND_ICE = 1;

export const ICE_SURFACE: Surface = { ...DEFAULT_SURFACE, friction: 0.1, speedMult: 1.15, wall: 'slick' };

/** Surface per ground kind; undefined means "whatever plain terrain is today". */
export const GROUND_SURFACES: readonly (Surface | undefined)[] = [undefined, ICE_SURFACE];

/**
 * Footing per tile for a CollisionWorld (`surfaceAt`), or undefined when the
 * level has no ground of its own, so every other level steps exactly as before.
 */
export function groundSurfaceAt(level: Level): ((tx: number, ty: number) => Surface) | undefined {
  const ground = level.ground;
  if (!ground) return undefined;
  const base = footing(level) ?? DEFAULT_SURFACE;
  const { w, h } = level;
  return (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h ? base : (GROUND_SURFACES[ground[ty * w + tx]] ?? base));
}

/** Ground kind at a tile (plain off the map or on levels without any). */
export function groundAt(level: Level, tx: number, ty: number): number {
  const g = level.ground;
  return g && tx >= 0 && ty >= 0 && tx < level.w && ty < level.h ? g[ty * level.w + tx] : GROUND_PLAIN;
}
