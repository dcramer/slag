import type { Rect } from '../../core/geom';
import { TILE } from '../../sim/constants';
import { type Level, spawnZone, T_EMPTY, T_SOLID } from '../../sim/level';
import { barrierOf, detonateCharges, type PlacedProp } from '../../sim/props';
import { ReachCache, T_NOGO } from '../../sim/reach';
import { type Bridge, canPlaceBridge, MAX_BRIDGES, searchBridges, withBridges } from './validate';

/**
 * Every match stays winnable. The guarantee is an invariant the match keeps:
 * at all times there's a `plan` of at most MAX_BRIDGES bridges, each a legal
 * place for the crate's bridge card, with which the real controller
 * (sim/reach.ts) gets from spawn to the flag through the terrain and the plain
 * blocks players built, keeping clear of every other part (the barriers in
 * sim/props/barrier.ts). A level starts with its recorded solution, proven
 * this way when it's generated; a placement after which no plan is found is
 * refused, so no state of a match is without one. The crate always offers as
 * many bridge cards as the plan has bridges, so finishing never needs a part
 * nobody was given. Bombs, time bombs included, are settled before the proof.
 *
 * Proving is cheap enough for the frame a part goes down: the last plan is
 * re-checked first, and a ReachCache only re-traces what the new part touches.
 */

/** Reach caches by level identity; their answers never depend on what ran before, so sharing them is safe. */
const caches = new Map<string, ReachCache>();
const MAX_CACHES = 4;

function cacheFor(field: Level): ReachCache {
  const key = `${field.seed}:${field.theme.id}:${field.w}x${field.h}:${field.gravity ?? 1}`;
  let c = caches.get(key);
  if (c) caches.delete(key);
  else c = new ReachCache(field);
  caches.set(key, c);
  if (caches.size > MAX_CACHES) caches.delete(caches.keys().next().value!);
  c.rebase(field.tiles);
  return c;
}

/**
 * The level as the proof sees it: plain blocks (placed and set pieces) are
 * terrain, every other barrier is T_NOGO. The spawn pocket can't hurt anyone
 * (RunWorld's safe zone), so nothing there is a barrier. Its set pieces are
 * every part standing, so a bridge can't take a cell one of them holds.
 */
export function fieldOf(level: Level, placed: readonly PlacedProp[]): Level {
  const tiles = level.tiles.slice();
  const parts = [...level.setPieces, ...placed];
  const barriers = parts.map((pp) => barrierOf(level, pp));
  for (const b of barriers) for (const k of b.ground) if (tiles[k] === T_EMPTY) tiles[k] = T_SOLID;
  const safe = spawnZone(level);
  for (const b of barriers) for (const k of b.noGo) if (tiles[k] !== T_SOLID && !inZone(level.w, k, safe)) tiles[k] = T_NOGO;
  return { ...level, tiles, setPieces: parts };
}

function inZone(w: number, k: number, r: Rect | null): boolean {
  if (!r) return false;
  const x = (k % w) * TILE;
  const y = Math.floor(k / w) * TILE;
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** `level` and `placed` as the race will start: pending time bombs gone off (on a copy). */
export function settled(level: Level, placed: readonly PlacedProp[]): { level: Level; placed: PlacedProp[] } {
  const copy: Level = { ...level, tiles: level.tiles.slice(), setPieces: level.setPieces.slice() };
  return { level: copy, placed: detonateCharges(copy, [...placed]) };
}

/**
 * A plan for `level` with `placed` standing in it, or null if none is found.
 * `prior`, the last plan, is tried first; what's left of it still counts, so
 * a bridge someone built from the plan shortens it. Pass the settled state
 * (see `settled`).
 *
 * `shortest` (round start, where the plan sets what the crate offers) also
 * drops bridges the level no longer needs, down to [] when the flag is
 * reachable as it stands. Without it (a placement, decided in the frame it's
 * made) any plan that still works is kept, which costs one analysis.
 */
export function prove(level: Level, placed: readonly PlacedProp[], prior: readonly Bridge[], shortest = true): Bridge[] | null {
  const field = fieldOf(level, placed);
  const cache = cacheFor(field);
  const works = (bs: readonly Bridge[]) => cache.analyze(bs.length ? withBridges(field, bs) : field).goalReached;
  const rest = prior.filter((b) => canPlaceBridge(field, b)).map((b) => ({ ...b }));
  if (rest.length <= MAX_BRIDGES && works(rest)) {
    if (!shortest || !rest.length) return rest;
    if (works([])) return [];
    if (rest.length === 2) for (const b of rest) if (works([b])) return [b];
    return rest;
  }
  if (works([])) return [];
  return searchBridges(field, prior, cache);
}

/**
 * Does `plan` finish `level` with `placed` standing, as the proof sees it?
 * Worldgen asks this of the recorded solution as set pieces go in, since a
 * match starts from it. Pass the level's own `cache` if it has one.
 */
export function planHolds(level: Level, placed: readonly PlacedProp[], plan: readonly Bridge[], cache?: ReachCache): boolean {
  const field = fieldOf(level, placed);
  return plan.every((b) => canPlaceBridge(field, b)) && (cache ?? cacheFor(field)).analyze(withBridges(field, plan)).goalReached;
}

/** Bridges still needed with `placed` standing (what the crate must offer); MAX_BRIDGES when no plan is found. */
export function partsNeeded(level: Level, placed: readonly PlacedProp[], prior: readonly Bridge[] = level.solution ?? []): number {
  const s = settled(level, placed);
  return prove(s.level, s.placed, prior)?.length ?? MAX_BRIDGES;
}
