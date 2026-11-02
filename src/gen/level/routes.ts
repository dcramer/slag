import { isProtected, type Level, T_SOLID } from '../../sim/level';
import { ReachCache } from '../../sim/reach';
import { BRIDGE_W, type BridgeHint } from './types';

/**
 * "Levels are mostly open" (docs/DESIGN.md), measured on the stand-cell graph
 * the real controller produces, so a route only counts if it can be played.
 *
 * Take the fastest route, widen it into a lane CLEARANCE tiles either side,
 * then find the route that stays out of that lane as much as it can. The
 * **sharing** is how much of the fastest route's length that second route
 * can't avoid running alongside: 0 is two fully separate routes, 1 is a single
 * path. Corridors are fine, so a level only has to keep it at or below
 * MAX_SHARED; what it can't be is one narrow way to the flag.
 *
 * Two kinds of place don't count, for either route, because no route choice
 * is possible there: the spawn and goal pockets, which every route shares by
 * definition, and bridge spans, which are open air a player can build across
 * wherever they like.
 *
 * Why lanes and not vertex-disjoint paths: running jumps skip cells, so a flat
 * corridor has many "disjoint" paths through the same tiles. Lanes are
 * geometric, which is what a player (or a blocking prop) actually sees.
 */

/**
 * Tiles to either side of a route that are still the same lane. Two: a
 * platform 3 rows above the floor is a separate lane, and one plain jump
 * from the floor below it.
 */
export const CLEARANCE = 2;
/** Most of the fastest route its best alternative may share. */
export const MAX_SHARED = 0.6;

/** How far around a bridge the exemption reaches: the hops on and off it. */
const BRIDGE_REACH_X = 5;
const BRIDGE_REACH_Y = 6;

export interface Routes {
  /** Share of the fastest route that its best alternative can't avoid, 0..1. 1 if the goal is unreachable. */
  shared: number;
  /** Fastest route's counted length in tiles (0 if unreachable). */
  length: number;
  /** The two routes as stand-cell keys, spawn first ([] if unreachable). */
  fastest: number[];
  alternative: number[];
  /** Index ranges [from, to] into `alternative` that run inside the fastest route's lane, longest first. */
  overlaps: [number, number][];
}

interface Edge {
  to: number;
  len: number;
}

/** Straight-line distance between two cells, in tiles. */
function dist(w: number, a: number, b: number): number {
  const dx = (a % w) - (b % w);
  const dy = Math.floor(a / w) - Math.floor(b / w);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Dijkstra over a small graph; `cost` prices an edge. Deterministic: ties go to the lower key. */
function cheapest(graph: Map<number, Edge[]>, from: number, to: number, cost: (a: number, e: Edge) => number): number[] {
  const best = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  // Binary heap of [cost, key].
  const heap: [number, number][] = [[0, from]];
  const less = (i: number, j: number) => heap[i][0] < heap[j][0] || (heap[i][0] === heap[j][0] && heap[i][1] < heap[j][1]);
  const swap = (i: number, j: number) => {
    const t = heap[i];
    heap[i] = heap[j];
    heap[j] = t;
  };
  while (heap.length) {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    const [c, k] = top;
    if (c > (best.get(k) ?? Infinity)) continue;
    if (k === to) break;
    for (const e of graph.get(k) ?? []) {
      const nc = c + cost(k, e);
      if (nc < (best.get(e.to) ?? Infinity)) {
        best.set(e.to, nc);
        prev.set(e.to, k);
        heap.push([nc, e.to]);
        for (let i = heap.length - 1; i > 0;) {
          const p = (i - 1) >> 1;
          if (!less(i, p)) break;
          swap(i, p);
          i = p;
        }
      }
    }
  }
  if (!best.has(to)) return [];
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1])!);
  return path.reverse();
}

/** Tiles of the straight line a→b, one per tile of length (both ends included). */
export function lineTiles(w: number, a: number, b: number, visit: (x: number, y: number) => void): void {
  const ax = a % w;
  const ay = Math.floor(a / w);
  const bx = b % w;
  const by = Math.floor(b / w);
  const n = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay));
  for (let i = 0; i <= n; i++) visit(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n));
}

/** How `level`, with `bridges` placed, scores against the mostly-open rule. Pass the level's `cache` if there is one. */
export function analyzeRoutes(level: Level, bridges: readonly BridgeHint[] = [], cache = new ReachCache(level)): Routes {
  const { w, h } = level;
  const tiles = new Uint8Array(level.tiles);
  for (const b of bridges) for (let i = 0; i < BRIDGE_W; i++) tiles[b.y * w + b.x + i] = T_SOLID;
  const graph = new Map<number, Edge[]>();
  const seen = new Set<number>();
  const onEdge = (from: number, to: number) => {
    if (from === to) return;
    const id = from * w * h + to;
    if (seen.has(id)) return;
    seen.add(id);
    let list = graph.get(from);
    if (!list) graph.set(from, (list = []));
    list.push({ to, len: dist(w, from, to) });
  };
  cache.analyze({ ...level, tiles }, false, { onEdge });
  const start = level.spawn.ty * w + level.spawn.tx;
  const end = level.goal.ty * w + level.goal.tx;
  const fastest = cheapest(graph, start, end, (_, e) => e.len);
  if (fastest.length === 0) return { shared: 1, length: 0, fastest, alternative: [], overlaps: [] };

  // No choice exists in the pockets or around a bridge, so they don't count.
  const exempt = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isProtected(level, x, y)) exempt[y * w + x] = 1;
  for (const b of bridges) {
    for (let y = Math.max(0, b.y - BRIDGE_REACH_Y); y <= Math.min(h - 1, b.y + BRIDGE_REACH_Y); y++)
      for (let x = Math.max(0, b.x - BRIDGE_REACH_X); x <= Math.min(w - 1, b.x + BRIDGE_W + BRIDGE_REACH_X - 1); x++) exempt[y * w + x] = 1;
  }

  // Fraction of an edge in counted tiles, and in counted tiles of the lane.
  const counted = (a: number, b: number, lane: Uint8Array | null) => {
    let hits = 0;
    let n = 0;
    lineTiles(w, a, b, (x, y) => {
      n++;
      const k = y * w + x;
      if (!exempt[k] && (!lane || lane[k])) hits++;
    });
    return (dist(w, a, b) * hits) / n;
  };

  // The lane: every tile within CLEARANCE of the fastest route's polyline.
  const lane = new Uint8Array(w * h);
  let length = 0;
  for (let i = 1; i < fastest.length; i++) {
    length += counted(fastest[i - 1], fastest[i], null);
    lineTiles(w, fastest[i - 1], fastest[i], (x, y) => {
      for (let yy = Math.max(0, y - CLEARANCE); yy <= Math.min(h - 1, y + CLEARANCE); yy++)
        for (let xx = Math.max(0, x - CLEARANCE); xx <= Math.min(w - 1, x + CLEARANCE); xx++) lane[yy * w + xx] = 1;
    });
  }

  // Route around the lane; a tiny price on plain length keeps the detour sensible.
  const alternative = cheapest(graph, start, end, (a, e) => counted(a, e.to, lane) + e.len * 1e-3);
  let shared = 0;
  const overlaps: [number, number][] = [];
  let open = -1;
  for (let i = 1; i < alternative.length; i++) {
    const s = counted(alternative[i - 1], alternative[i], lane);
    shared += s;
    if (s > 0 && open < 0) open = i - 1;
    if (s === 0 && open >= 0) {
      overlaps.push([open, i - 1]);
      open = -1;
    }
  }
  if (open >= 0) overlaps.push([open, alternative.length - 1]);
  overlaps.sort((p, q) => q[1] - q[0] - (p[1] - p[0]) || p[0] - q[0]);
  return { shared: length > 0 ? Math.min(1, shared / length) : 0, length, fastest, alternative, overlaps };
}
