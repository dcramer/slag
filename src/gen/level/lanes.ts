import type { Rng } from '../../core/rng';
import { isProtected, type Level, T_EMPTY, T_ONEWAY } from '../../sim/level';
import type { ReachCache } from '../../sim/reach';
import { difficultyKnobs } from './difficulty';
import { jumpProfile } from './probe';
import { analyzeRoutes, lineTiles, MAX_SHARED, type Routes } from './routes';
import { easyRise } from './sculptors/common';
import { BRIDGE_W, type BridgeHint, type Shape } from './types';

/**
 * Second routes. Sculptors build a theme's landmarks, and those tend to leave
 * one way along the ground; this pass reads what the route analysis says has
 * no alternative and lays a raised lane over it: a chain of jump-through
 * platforms in the theme's own platform art, spaced for walking jumps and
 * each within a plain jump of the last. Feedback from the real controller
 * decides where they go and whether they're enough, so a lane that can't be
 * reached simply doesn't count and the pipeline tries another sculpt.
 *
 * Lanes keep away from hard crossings: a platform near one would turn a gap
 * that needs a bridge into a gap you can jump. They keep out of a landmark's
 * air too, by whole columns.
 */

/** Rounds of "find the worst stretch, lay a lane over it". */
const MAX_PASSES = 4;
/** A stretch shorter than this has no room for a lane. */
const MIN_STRETCH = 5;
/** Columns kept clear either side of a hard crossing. */
const CROSSING_MARGIN = 5;
/** Rows of air a lane leaves under itself for the route it runs over. */
const UNDER = 2;
/** Rows a carved gallery sits above the route: a separate lane with rock left between them. */
const GALLERY_OFF = 5;

interface Lane {
  /** Rows above the route (3 is one plain jump from the floor below). */
  off: number;
  /** Platform length range. */
  len: readonly [number, number];
}

/** Lay lanes until the level is open enough or there's nowhere left to try. Writes into `level.tiles` (the shape's array). */
export function openUp(level: Level, shape: Shape, bridges: readonly BridgeHint[], rng: Rng, cache: ReachCache): Routes {
  let routes = analyzeRoutes(level, bridges, cache);
  for (let pass = 0; pass < MAX_PASSES && routes.shared > MAX_SHARED; pass++) {
    const blocked = forbiddenColumns(level, shape, bridges);
    let built = false;
    for (const [a, b] of routes.overlaps) {
      const cells = routes.alternative.slice(a, b + 1);
      if (shape.carve ? carveGallery(level, cells, blocked) || layLane(level, cells, blocked, rng) : layLane(level, cells, blocked, rng)) {
        built = true;
        break;
      }
    }
    if (!built) break;
    cache.rebase(level.tiles);
    routes = analyzeRoutes(level, bridges, cache);
  }
  return routes;
}

function forbiddenColumns(level: Level, shape: Shape, bridges: readonly BridgeHint[]): Uint8Array {
  const out = new Uint8Array(level.w);
  const mark = (x0: number, x1: number) => {
    for (let x = Math.max(0, x0); x <= Math.min(level.w - 1, x1); x++) out[x] = 1;
  };
  for (const [x0, x1] of shape.crossings ?? []) mark(x0 - CROSSING_MARGIN, x1 + CROSSING_MARGIN);
  for (const b of bridges) mark(b.x - CROSSING_MARGIN, b.x + BRIDGE_W + CROSSING_MARGIN - 1);
  // A second route never runs through the air a landmark's movers sweep (a wheel's disc, a lift's shaft).
  for (const a of shape.landmark?.air ?? []) mark(a.x, a.x + a.w - 1);
  return out;
}

/** Highest route row per column of a stretch: a lane has to clear all of it. */
function routeTops(w: number, cells: number[]): Map<number, number> {
  const top = new Map<number, number>();
  for (let i = 1; i < cells.length; i++) {
    lineTiles(w, cells[i - 1], cells[i], (x, y) => {
      if (y < (top.get(x) ?? Infinity)) top.set(x, y);
    });
  }
  return top;
}

/**
 * For rock (shape.carve): a second tunnel over the first, rather than planks
 * that have no air to hang in. A gallery GALLERY_OFF rows up, floored by the
 * rock it's cut from or by planks where it crosses open air, opening down
 * into the route at both ends by a shaft with a rung per plain jump.
 */
function carveGallery(level: Level, cells: number[], blocked: Uint8Array): boolean {
  const { w, h, tiles } = level;
  const top = routeTops(w, cells);
  const xs = [...top.keys()].sort((a, b) => a - b).filter((x) => !blocked[x]);
  if (xs.length < MIN_STRETCH) return false;
  const rise = easyRise();
  const put = (x: number, y: number, v: number) => {
    if (y >= 1 && y < h && !isProtected(level, x, y)) tiles[y * w + x] = v;
  };
  const rows = new Map<number, number>();
  let y = top.get(xs[0])! - GALLERY_OFF;
  for (const x of xs) {
    y = Math.max(y - 1, Math.min(y + 1, top.get(x)! - GALLERY_OFF));
    rows.set(x, y);
  }
  if ([...rows.values()].some((r) => r < 3)) return false;
  for (const x of xs) {
    const r = rows.get(x)!;
    for (let yy = r - 2; yy <= r; yy++) put(x, yy, T_EMPTY);
    if (tiles[(r + 1) * w + x] === T_EMPTY) put(x, r + 1, T_ONEWAY);
  }
  for (const [a, b] of [
    [xs[0], xs[0] + 2],
    [xs[xs.length - 1] - 2, xs[xs.length - 1]],
  ]) {
    for (let x = a; x <= b; x++) {
      const from = rows.get(x);
      const to = top.get(x);
      if (from === undefined || to === undefined) continue;
      for (let yy = from + 1; yy < to; yy++) put(x, yy, T_EMPTY);
      for (let yy = to - rise + 1; yy > from + 1; yy -= rise) if (x === a) put(x, yy, T_ONEWAY);
      put(x, from + 1, T_ONEWAY);
    }
  }
  return true;
}

/** Chain platforms above `cells`, left to right. True if any went in. */
function layLane(level: Level, cells: number[], blocked: Uint8Array, rng: Rng): boolean {
  const { w } = level;
  const top = routeTops(w, cells);
  const xs = [...top.keys()].sort((a, b) => a - b);
  if (xs.length < MIN_STRETCH) return false;
  const t = difficultyKnobs();
  const lane: Lane = rng.weighted<Lane>([
    [{ off: 3, len: t.laneLen }, 3],
    [{ off: 4, len: t.laneLen }, 2],
    [{ off: 3, len: [6, 10] }, t.floorLanes],
  ]);
  const rise = easyRise();
  const hop = Math.max(1, jumpProfile().walkGap);
  const fits = (x0: number, x1: number, stand: number) => {
    if (stand < 3) return false;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= w || blocked[x]) return false;
      for (let y = stand - 2; y <= stand + 1 + UNDER; y++) {
        if (y >= level.h || level.tiles[y * w + x] !== T_EMPTY || isProtected(level, x, y)) return false;
      }
    }
    return true;
  };
  let placed = 0;
  let x = xs[0];
  let last = Infinity; // stand row of the previous platform
  const end = xs[xs.length - 1];
  while (x <= end) {
    const len = rng.int(lane.len[0], lane.len[1]);
    let best = -1;
    let bestX = x;
    // Slide forward within a hop until a platform fits; the rows it may use follow the terrain below.
    for (let sx = x; sx <= x + hop && best < 0; sx++) {
      let want = Infinity;
      for (let c = sx; c < sx + len; c++) want = Math.min(want, (top.get(c) ?? top.get(end) ?? Infinity) - lane.off);
      if (!Number.isFinite(want)) break;
      // Never climb more than a plain jump from the last platform.
      if (last !== Infinity) want = Math.max(want, last - rise);
      for (const stand of [want, want - 1, want + 1, want - 2]) {
        if (fits(sx, sx + len - 1, stand)) {
          best = stand;
          bestX = sx;
          break;
        }
      }
    }
    if (best < 0) {
      x += hop + 1;
      last = Infinity; // A broken chain starts a fresh climb from the ground.
      continue;
    }
    for (let c = bestX; c < bestX + len; c++) level.tiles[(best + 1) * w + c] = T_ONEWAY;
    placed++;
    last = best;
    // Each hop is near the end of a walking jump (at it, on hard levels): a lane is a line you jump, not a floor you stroll.
    x = bestX + len + rng.int(Math.max(1, hop - t.hopSlack), hop);
  }
  return placed > 0;
}
