import type { Rect } from '../../core/geom';
import { TILE } from '../constants';
import { type Level, T_SOLID, tileAt } from '../level';
import type { Solid } from '../physics';
import { type Beam, type Contrib, moduleSim, type PropCtx } from './registry';
import { motionOffset, newPropState } from './transform';
import type { Resolved } from './types';

/**
 * What stops things that travel through space: rays (flames, lasers, geysers,
 * fan columns, tesla arcs, tracker sight) and lanes (crushers).
 *
 * The rule: terrain and every blocking solid on the current frame stop them.
 * One-way tiles and gliders don't, because a plank you can jump through is no
 * wall. Blood doesn't, or a puddle would plug a floor vent. A part's own prop
 * doesn't, or an emitter would be stopped by the block it's mounted on. Runners don't: a beam goes through whoever it hits. Solids
 * are rebuilt every frame, so a blink block that's off or a platform that has
 * moved on simply isn't in the list.
 *
 * Solids come from every module, so a cast made during `build` would miss the
 * ones later modules add, and the result would depend on prop order. Casting
 * therefore happens in later passes, once the list is complete (`buildSolids`,
 * then `traceRays`). Everything reads its reach from the `Beam` the cast
 * reports, the art included, so nothing is ever cast twice with room to differ.
 *
 * Cost: a cast walks terrain cell by cell, which bounds it, then tests each
 * solid once against what's left of the ray rather than once per step.
 */

/** Rows past the level a ray stays alive above and below it: it may be heading back in, or nothing's there. */
const RAY_ABOVE = 4;
const RAY_BELOW = 1;

/** Distance (px) along a unit ray before it enters a solid tile, from `skip` out to `maxLen`. Walks cell edges, so it lands exactly on the face. */
export function rayToWall(level: Level, x: number, y: number, dx: number, dy: number, maxLen: number, skip: number): number {
  let cx = Math.floor((x + dx * skip) / TILE);
  let cy = Math.floor((y + dy * skip) / TILE);
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const stepX = dx !== 0 ? TILE / Math.abs(dx) : Infinity;
  const stepY = dy !== 0 ? TILE / Math.abs(dy) : Infinity;
  let nextX = dx !== 0 ? ((cx + (dx > 0 ? 1 : 0)) * TILE - x) / dx : Infinity;
  let nextY = dy !== 0 ? ((cy + (dy > 0 ? 1 : 0)) * TILE - y) / dy : Infinity;
  let d = skip;
  while (d < maxLen) {
    if (cy < -RAY_ABOVE || cy > level.h + RAY_BELOW || tileAt(level, cx, cy) === T_SOLID) return d;
    if (nextX < nextY) {
      d = Math.max(d, nextX);
      nextX += stepX;
      cx += sx;
    } else {
      d = Math.max(d, nextY);
      nextY += stepY;
      cy += sy;
    }
  }
  return maxLen;
}

/** Does this solid stop something that came from prop `uid`? See the rule above. */
const blocks = (s: Solid, uid: number) => !s.oneWay && !s.film && s.propUid !== uid;

/** Distance (px) along a unit ray before it hits terrain or a blocking solid. Only the first `n` solids count (see `settle`). */
export function castRay(
  level: Level,
  solids: readonly Solid[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  maxLen: number,
  skip: number,
  uid: number,
  n = solids.length,
): number {
  let best = rayToWall(level, x, y, dx, dy, maxLen, skip);
  for (let i = 0; i < n; i++) {
    const s = solids[i];
    if (!blocks(s, uid)) continue;
    let near = skip;
    let far = best;
    if (dx !== 0) {
      const a = (s.x - x) / dx;
      const b = (s.x + s.w - x) / dx;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
    } else if (x < s.x || x >= s.x + s.w) continue;
    if (dy !== 0) {
      const a = (s.y - y) / dy;
      const b = (s.y + s.h - y) / dy;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
    } else if (y < s.y || y >= s.y + s.h) continue;
    if (near < far) best = near;
  }
  return best;
}

/** Tolerance (px) for a lane's face resting flush on a solid after float motion. */
const FLUSH = 0.01;

/**
 * How far (px, up to `max`) a rect can slide along an axis direction before it
 * touches a blocking solid. Solids behind its leading face don't count: a blink
 * block that returns inside a crusher mustn't yank the crusher back.
 */
export function solidGap(solids: readonly Solid[], r: Rect, dx: number, dy: number, max: number, uid: number, n = solids.length): number {
  let best = max;
  for (let i = 0; i < n; i++) {
    const s = solids[i];
    if (!blocks(s, uid)) continue;
    if (dx !== 0 ? r.y >= s.y + s.h || r.y + r.h <= s.y : r.x >= s.x + s.w || r.x + r.w <= s.x) continue;
    const gap = dx > 0 ? s.x - (r.x + r.w) : dx < 0 ? r.x - (s.x + s.w) : dy > 0 ? s.y - (r.y + r.h) : r.y - (s.y + s.h);
    if (gap >= -FLUSH && gap < best) best = Math.max(0, gap);
  }
  return best;
}

/** How far (px, up to `max`) a rect can slide along an axis direction before it enters a solid tile. */
export function tileGap(level: Level, r: Rect, dx: number, dy: number, max: number): number {
  const dir = dx + dy;
  const lead = dx > 0 ? r.x + r.w : dx < 0 ? r.x : dy > 0 ? r.y + r.h : r.y;
  const from = Math.floor((dx !== 0 ? r.y : r.x) / TILE);
  const to = Math.floor(((dx !== 0 ? r.y + r.h : r.x + r.w) - 1e-3) / TILE);
  for (let c = dir > 0 ? Math.ceil(lead / TILE) : Math.floor(lead / TILE) - 1; ; c += dir) {
    const gap = dir > 0 ? c * TILE - lead : lead - (c + 1) * TILE;
    if (gap >= max) return max;
    for (let a = from; a <= to; a++) if (tileAt(level, dx !== 0 ? c : a, dx !== 0 ? a : c) === T_SOLID) return gap;
  }
}

/** Report a module's reach for this frame. */
export function reportBeam(ctx: PropCtx, out: Contrib, len: number, hit: boolean, angle?: number): void {
  out.beams?.push({ uid: ctx.r.pp.uid, mi: ctx.mi, len, hit, angle });
}

/** Cast this module's ray against every solid and report it. `angle` is for emitters that sweep or track. */
export function castBeam(ctx: PropCtx, out: Contrib, x: number, y: number, dx: number, dy: number, maxLen: number, skip: number, angle?: number) {
  const len = castRay(ctx.level, out.solids, x, y, dx, dy, maxLen, skip, ctx.r.pp.uid);
  const hit = len < maxLen;
  reportBeam(ctx, out, len, hit, angle);
  return { len, hit };
}

/**
 * The lethal segment of a beam (flames, lasers: both set things alight), `from` px out to where it stops. Stopped beams
 * end `r` short, so the round cap touches the face it hit and can't reach
 * through a thin solid to whoever stands behind it. No clear length, no hazard.
 */
export function beamHazard(
  ctx: PropCtx,
  out: Contrib,
  x: number,
  y: number,
  dx: number,
  dy: number,
  from: number,
  beam: { len: number; hit: boolean },
  r: number,
): void {
  if (beam.len <= from) return;
  const to = beam.hit ? Math.max(from, beam.len - r) : beam.len;
  out.hazards.push({ owner: ctx.r.pp.owner, ignites: true, kind: 'seg', x1: x + dx * from, y1: y + dy * from, x2: x + dx * to, y2: y + dy * to, r });
}

type CtxOf = (r: Resolved, mi: number) => PropCtx;

/** First pass: every module adds what doesn't depend on any other prop, solids above all. */
export function buildSolids(props: readonly Resolved[], ctx: CtxOf, out: Contrib): void {
  for (const r of props) r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, ctx(r, mi), out));
}

/** Later passes, once every solid is in: crushers find where they stop and add their heads, then rays are cast against the lot. */
export function traceRays(props: readonly Resolved[], ctx: CtxOf, out: Contrib): void {
  const fixed = out.solids.length;
  for (const r of props) r.mods.forEach((m, mi) => moduleSim(m.type).settle?.(m, ctx(r, mi), out, fixed));
  for (const r of props) r.mods.forEach((m, mi) => moduleSim(m.type).trace?.(m, ctx(r, mi), out));
}

/**
 * Beams for props outside a race: the lobby, pick and place phases and their
 * ghosts, where no RunWorld exists. The same passes as a race's frame, with
 * every prop at rest, so a preview stops where the real thing will.
 */
export function traceBeams(level: Level, props: readonly Resolved[], f: number): Beam[] {
  return previewProps(level, props, f).beams;
}

/** `traceBeams` with everything else those passes built: the solids too, so art outside a race can show what lies on them. */
export function previewProps(level: Level, props: readonly Resolved[], f: number): Contrib & { beams: Beam[] } {
  const out: Contrib & { beams: Beam[] } = { solids: [], hazards: [], springs: [], winds: [], triggers: [], beams: [] };
  const state = newPropState();
  const ctx: CtxOf = (r, mi) => ({ level, frame: f, r, off: motionOffset(r, f), prev: motionOffset(r, f - 1), state, mi, live: false });
  buildSolids(props, ctx, out);
  traceRays(props, ctx, out);
  return out;
}
