import type { Rng } from '../../core/rng';
import type { LevelProfile, TileRect } from '../../sim/level';
import type { PlacedProp } from '../../sim/props';
import { type Grid, hintGap, T_SOLID } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { hardGap, undercut } from '../level/sculptors/common';
import { noFreeRide, planHolds } from '../level/winnable';
import { windowFaults } from '../setpieces/contract';
import { finalize, type Piece, type Site } from '../setpieces/place';
import { oneGap } from './kit';

/** Uids a trial piece takes: any will do, it's thrown away. */
const TRIAL_UID = 90_000;

/**
 * What every harbor landmark shares (docs/SETPIECES.md, Harbor). Each owns the level's crossing: a berth of
 * open water in front of it, its far side the landmark's own first column, so the landmark is where the
 * level asks for its part. Everything stands in the sea, so every structure runs down to the sea floor (the
 * bottom row) or rests on something that does: nothing floats, the hull of a moored ship included.
 */

/** Columns a harbor landmark keeps clear of the spawn end (its near quay) and the goal end (a gap and the far quay). */
export const NEAR_QUAY = 6;
export const FAR_ROOM = 9;

/** Columns left for a landmark's structure past its berth, on a level `w` wide at this gravity. */
export function roomFor(w: number, gravity?: number): number {
  return w - NEAR_QUAY - FAR_ROOM - oneGap(gravity);
}

/** A concept that needs `least` columns of structure fits a level only if there's that much room past its berth. */
export const fitsWith =
  (least: number) =>
  (p: Partial<LevelProfile>): boolean =>
    p.w === undefined || roomFor(p.w, p.gravity) >= least;

/** The structure's columns: everything right of the berth. Its first column is the berth's far bank. */
export function structureOf(at: TileRect): TileRect {
  const m = oneGap();
  return { x: at.x + m, y: at.y, w: at.w - m, h: at.h };
}

/** A structure's width: rolled in [lo, hi] scaled by how wide the level is, and never more than it has room for. */
export function structureCols(W: number, rng: Rng, lo: number, hi: number): number {
  const room = roomFor(W);
  const want = W > 56 ? rng.int(Math.round(lo * 1.4), Math.round(hi * 1.6)) : rng.int(lo, hi);
  return Math.max(lo, Math.min(room, want));
}

/**
 * The berth in front of a structure: the near quay carried on over whatever the rolled crossing doesn't take,
 * then open water to the sea floor up to the structure, sized for `parts` with hardGap and hinted for the
 * bridge. Call it after the structure is built: the far bank (the structure's first two columns) is undercut
 * below the quay row, so nobody climbs out of the water up its face. No parts, no water: a plain quay.
 */
export function digBerth(g: Grid, rng: Rng, at: TileRect, parts: number): void {
  const G = at.y + at.h;
  const s = structureOf(at);
  const last = s.x - 1;
  if (parts <= 0) {
    g.fill(at.x, G, last, g.h - 1, T_SOLID, true);
    return;
  }
  const gap = Math.min(oneGap(), hardGap(rng, parts));
  const first = last - gap + 1;
  g.fill(at.x, G, first - 1, g.h - 1, T_SOLID, true);
  g.clear(first, 0, last, g.h - 1);
  hintGap(g, first, last, G);
  undercut(g, s.x, 2, G);
}

/**
 * The most rows a structure asks you to climb in one go: two short of the highest ledge the real controller
 * reaches at this gravity (jumpProfile().rise), so every step a landmark builds is a comfortable jump.
 */
export function climb(): number {
  return Math.max(2, jumpProfile().rise - 2);
}

/** Fill a structure's footing: solid from row `top` to the sea floor over columns a..b. */
export function footing(g: Grid, a: number, b: number, top: number): void {
  g.fill(a, top, b, g.h - 1, T_SOLID, true);
}

/**
 * A piece that's only worth having if it goes in: try it the way the pipeline will (finalize, a safe window, the solution
 * still holding with everything before it, and no free ride), and yield nothing when it wouldn't. A landmark's
 * pieces are all required, so its optional hazards go through here first and a bad roll costs the hazard, not
 * the attempt. `prior` collects what went in so far (the landmark's earlier pieces, as the pipeline places them).
 */
export function trial(s: Site, prior: PlacedProp[], piece: Piece): boolean {
  const pp = finalize(s, piece, TRIAL_UID + prior.length, 'trial');
  if (!pp || windowFaults(s.level, pp).length) return false;
  const plan = s.level.solution ?? [];
  if (!planHolds(s.level, [...prior, pp], plan, s.cache) || !noFreeRide(s.level, pp, prior, s.cache)) return false;
  prior.push(pp);
  return true;
}
