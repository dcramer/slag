import type { Level } from './level';
import { DEFAULT_SURFACE, type Surface } from './physics';
import { footing, underfoot } from './weather';

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
 * can't wall-jump. Weather lies on it like on everything else you stand on
 * (sim/weather.ts `underfoot`): plain tiles take the weather's footing, and
 * rain or snow makes ice slicker still.
 */
export const GROUND_PLAIN = 0;
export const GROUND_ICE = 1;

export const ICE_SURFACE: Surface = { ...DEFAULT_SURFACE, friction: 0.1, speedMult: 1.15, wall: 'slick', skid: 95 };

/** Surface per ground kind; undefined means "whatever plain terrain is today". */
const GROUND_SURFACES: readonly (Surface | undefined)[] = [undefined, ICE_SURFACE];

/**
 * Footing per tile for a CollisionWorld (`surfaceAt`), or undefined when the
 * level has no ground of its own, so every other level steps exactly as before.
 */
export function groundSurfaceAt(level: Level): ((tx: number, ty: number) => Surface) | undefined {
  return level.ground && surfaceGrid(level.ground, level.w, level.h, footing(level));
}

/** Footing per tile of a `ground` grid w×h, with weather footing `f` (if any) on every kind. */
export function surfaceGrid(ground: Uint8Array, w: number, h: number, f: Surface | undefined): (tx: number, ty: number) => Surface {
  const plain = f ?? DEFAULT_SURFACE;
  const kinds = GROUND_SURFACES.map((s) => (s ? (f ? underfoot(s, f) : s) : plain));
  return (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h ? plain : (kinds[ground[ty * w + tx]] ?? plain));
}

/** Ground kind at a tile (plain off the map or on levels without any). */
export function groundAt(level: Level, tx: number, ty: number): number {
  const g = level.ground;
  return g && tx >= 0 && ty >= 0 && tx < level.w && ty < level.h ? g[ty * level.w + tx] : GROUND_PLAIN;
}
