import { footprintCells } from '../../sim/props';
import { isProtected, type Level, T_EMPTY, T_SOLID } from '../../sim/level';
import { ReachCache } from '../../sim/reach';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { BRIDGE_W, type BridgeHint } from './types';

export { BRIDGE_W };

/**
 * Solvability policy (AGENTS.md): a level is acceptable if the goal is
 * reachable from spawn without props, OR after placing at most MAX_BRIDGES
 * "bridges" — BRIDGE_W×1 solid platforms in empty, unprotected cells.
 *
 * Every verdict comes from sim/reach.ts (the real controller). Finding *where*
 * bridges help is a search problem, and each candidate is a full question to
 * the analyzer: a ReachCache makes that cheap, since a bridge only re-traces
 * the runs that read its tiles. The search proposes where a run could be
 * caught and is an under-approximation: it may miss a solution, but anything
 * it returns is proven.
 *
 * A solvable level must also be mostly open (./routes.ts): `open` says so,
 * measured with the solution's bridges in place. The two are separate so a
 * synthetic one-lane level can still exercise the solvability policy.
 */

export const MAX_BRIDGES = 2;

export type Bridge = BridgeHint;

export interface Verdict {
  ok: boolean;
  /** Bridges a solution needs: [] when solvable without props. */
  bridges: Bridge[];
  /** Placements the search tried (for stats). */
  evals: number;
  /** Share of the route with no alternative lane (./routes.ts); 1 when unsolvable. */
  shared: number;
  /** Solvable and within the mostly-open limit. */
  open: boolean;
}

/** True if a bridge with left cell (x, y) fits: all cells in-bounds, empty, unprotected. */
export function canPlaceBridge(level: Level, b: Bridge): boolean {
  if (b.y < 1 || b.y >= level.h || b.x < 0 || b.x + BRIDGE_W > level.w) return false;
  const reserved = setPieceCells(level);
  for (let i = 0; i < BRIDGE_W; i++) {
    const k = b.y * level.w + b.x + i;
    if (level.tiles[k] !== T_EMPTY || isProtected(level, b.x + i, b.y) || reserved.has(k)) return false;
  }
  return true;
}

const reservedCache = new WeakMap<object, Set<number>>();
/** Cells reserved by set pieces (players can't build there). */
function setPieceCells(level: Level): Set<number> {
  const key = level.setPieces;
  let set = reservedCache.get(key);
  if (!set) {
    set = new Set(level.setPieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * level.w + x)));
    reservedCache.set(key, set);
  }
  return set;
}

/** A copy of `level` with the given bridges written as solid tiles. */
export function withBridges(level: Level, bridges: readonly Bridge[]): Level {
  const tiles = new Uint8Array(level.tiles);
  for (const b of bridges) for (let i = 0; i < BRIDGE_W; i++) tiles[b.y * level.w + b.x + i] = T_SOLID;
  return { ...level, tiles };
}

/** Policy verdict for a level, using sculptor hints to speed up the search. Pass the level's `cache` if there is one. */
export function judge(level: Level, hints: readonly Bridge[] = [], crossings: readonly [number, number][] = [], cache = new ReachCache(level)): Verdict {
  const scored = (bridges: Bridge[], evals: number): Verdict => {
    const { shared } = analyzeRoutes(level, bridges, cache);
    return { ok: true, bridges, evals, shared, open: shared <= MAX_SHARED };
  };
  if (cache.analyze(level).goalReached) return scored([], 0);
  const s = new BridgeSearch(level, cache);
  const sol = s.solve(hints);
  if (!sol) return { ok: false, bridges: [], evals: s.evals, shared: 1, open: false };
  // The search's candidates are rough: on a level with one crossing, two bridges may be one it didn't try.
  // A level's count sets what the crate must offer, so it has to be the real one.
  const verify = (bs: Bridge[]) => bs.every((b) => canPlaceBridge(level, b)) && cache.analyze(withBridges(level, bs)).goalReached;
  const lone = sol.length === 2 && crossings.length === 1 ? loneBridge(crossings[0], hints, verify) : null;
  return scored(lone ? [lone] : sol, s.evals);
}

/**
 * One bridge that does what `level`'s two do, if a full look finds one: everywhere
 * a run falls past. The count sets what the crate offers, so it's worth asking
 * again of the final terrain, where lanes may have opened a shorter way.
 */
export function oneBridgeEnough(level: Level, hints: readonly Bridge[] = [], cache = new ReachCache(level)): Bridge | null {
  return new BridgeSearch(level, cache).lone(hints);
}

/** Try one bridge along a crossing, on and just above the ledges, with the real controller. */
function loneBridge([x0, x1]: readonly [number, number], hints: readonly Bridge[], verify: (bs: Bridge[]) => boolean): Bridge | null {
  const row = hints.find((h) => h.x >= x0 - BRIDGE_W && h.x <= x1)?.y;
  if (row === undefined) return null;
  for (let dy = 0; dy <= 3; dy++) {
    for (let x = x1 - BRIDGE_W + 1; x >= x0; x -= 2) {
      if (verify([{ x, y: row - dy }])) return { x, y: row - dy };
    }
  }
  return null;
}

/** Bridges that finish `level`, found by the search (seeded with `hints`) and proven by `cache`; null if it finds none. */
export function searchBridges(level: Level, hints: readonly Bridge[], cache: ReachCache): Bridge[] | null {
  return new BridgeSearch(level, cache).solve(hints);
}

/**
 * Fewest parts the search can finish `level` with when a side wind of `air`
 * px/s blows whenever the player likes. MAX_BRIDGES when it finds nothing better.
 */
export function partsInAir(level: Level, air: number): number {
  const cache = new ReachCache(level, [0, air]);
  return new BridgeSearch(level, cache).solve(level.solution ?? [])?.length ?? MAX_BRIDGES;
}

/** Policy check; seeds the search with the level's recorded solution if it has one. */
export function isAcceptable(level: Level): boolean {
  const solution = level.solution ?? [];
  // A recorded solution proves itself. The search is rougher and may not rediscover it.
  const cache = new ReachCache(level);
  const proven = solution.every((b) => canPlaceBridge(level, b)) && cache.analyze(withBridges(level, solution)).goalReached;
  return (proven || judge(level, solution, [], cache).ok) && analyzeRoutes(level, solution, cache).shared <= MAX_SHARED;
}

// ---------------------------------------------------------------------------

/** What a set of bridges has opened up so far. */
interface Reached {
  keys: number[];
  goal: boolean;
  /** Stand cells known to be reachable. */
  known: Uint8Array;
  /** Bridge keys (y * w + leftX) that would catch a run from here on its way down. */
  cands: Uint8Array;
  /** Closest stand cell to the goal, on the level's own ground and on anything. */
  natural: number;
  any: number;
}

/** Greedy search over bridge placements, asking a ReachCache about each one. */
class BridgeSearch {
  evals = 0;
  private readonly W: number;
  private readonly H: number;
  private readonly base: Uint8Array;
  /** Cells a bridge can't take: protected ones, and set pieces and placed parts. */
  private readonly closed: Uint8Array;
  private readonly gx: number;
  private readonly gy: number;

  constructor(
    private readonly level: Level,
    private readonly cache: ReachCache,
  ) {
    this.W = level.w;
    this.H = level.h;
    this.base = level.tiles;
    this.closed = new Uint8Array(this.W * this.H);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (isProtected(level, x, y)) this.closed[y * this.W + x] = 1;
    for (const k of setPieceCells(level)) this.closed[k] = 1;
    this.gx = level.goal.tx;
    this.gy = level.goal.ty;
  }

  solve(hints: readonly Bridge[]): Bridge[] | null {
    const root = this.explore();
    if (root.goal) return [];
    const hintKeys = this.hintKeys(hints);
    const tried = new Set<string>();
    const level1: Reached[] = [];
    for (const k of this.rank(hintKeys, root.cands, [], 14)) {
      const r = this.grow(root, k);
      tried.add(String(k));
      if (r.goal) return [this.bridge(k)];
      level1.push(r);
    }
    level1.sort((a, b) => a.natural + 0.3 * a.any - (b.natural + 0.3 * b.any));
    for (const n of level1.slice(0, 3)) {
      for (const k of this.rank(hintKeys, n.cands, n.keys, 10)) {
        const id = [...n.keys, k].sort((a, b) => a - b).join(',');
        if (tried.has(id)) continue;
        tried.add(id);
        if (this.grow(n, k).goal) return [...n.keys, k].map((kk) => this.bridge(kk));
      }
    }
    return null;
  }

  /** Any one bridge that works, among all the places a run falls past. */
  lone(hints: readonly Bridge[]): Bridge | null {
    const root = this.explore();
    for (const k of this.rank(this.hintKeys(hints), root.cands, [], Infinity, false)) if (this.grow(root, k).goal) return this.bridge(k);
    return null;
  }

  private hintKeys(hints: readonly Bridge[]): number[] {
    return hints.map((h) => h.y * this.W + h.x).filter((k) => this.placeable(this.base, k));
  }

  /** What the level offers with no bridges. */
  private explore(): Reached {
    this.evals++;
    const cands = new Uint8Array(this.W * this.H);
    const { goalReached, cells } = this.cache.analyze(this.level, true, { cands });
    const known = new Uint8Array(this.W * this.H);
    const r: Reached = { keys: [], goal: goalReached, known, cands, natural: Infinity, any: Infinity };
    this.absorb(r, cells);
    return r;
  }

  /**
   * Add bridge `k` to `from`. What's already reached stays explored, so a spot
   * costs only what standing on it opens up: that's a guess (a bridge can also
   * cut a route it doesn't stand on), and a goal found this way is proven in full.
   */
  private grow(from: Reached, k: number): Reached {
    this.evals++;
    const keys = [...from.keys, k];
    const tiles = this.tilesWith(keys);
    const view = { ...this.level, tiles };
    const cands = from.cands.slice();
    const top = [0, 1, 2].map((i) => k - this.W + i).filter((c) => tiles[c] === T_EMPTY);
    const { goalReached, cells } = this.cache.analyze(view, true, { cands, from: { cells: top, known: from.known } });
    const r: Reached = {
      keys,
      goal: goalReached && this.cache.analyze(view).goalReached,
      known: from.known.slice(),
      cands,
      natural: from.natural,
      any: from.any,
    };
    this.absorb(r, cells);
    return r;
  }

  private absorb(r: Reached, cells: readonly number[]): void {
    for (const k of cells) {
      r.known[k] = 1;
      const tx = k % this.W;
      const d = this.dist(tx, (k - tx) / this.W);
      if (d < r.any) r.any = d;
      if (this.base[k + this.W] !== T_EMPTY && d < r.natural) r.natural = d;
    }
  }

  private bridge(k: number): Bridge {
    return { x: k % this.W, y: Math.floor(k / this.W) };
  }

  private dist(x: number, y: number): number {
    return Math.abs(this.gx - x) + (y > this.gy ? 0.6 * (y - this.gy) : 0.25 * (this.gy - y));
  }

  /** Hints first, then candidates by distance-to-goal, `spread` out so near-duplicates don't crowd the list. */
  private rank(hints: number[], cands: Uint8Array, placed: number[], n: number, spread = true): number[] {
    const tiles = this.tilesWith(placed);
    const ok = (k: number) => this.placeable(tiles, k) && !placed.includes(k);
    const out: number[] = [];
    for (const h of hints) if (ok(h) && !out.includes(h)) out.push(h);
    const scored: [number, number][] = [];
    for (let k = 0; k < cands.length; k++) if (cands[k] && ok(k)) scored.push([this.dist((k % this.W) + 1, Math.floor(k / this.W) - 1), k]);
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const bins = new Set<number>();
    for (const [, k] of scored) {
      if (out.length >= n + hints.length) break;
      const bin = Math.floor(k / this.W) * 100 + Math.floor((k % this.W) / 2);
      if ((spread && bins.has(bin)) || out.includes(k)) continue;
      bins.add(bin);
      out.push(k);
    }
    return out;
  }

  private placeable(tiles: Uint8Array, k: number): boolean {
    const x = k % this.W;
    const y = Math.floor(k / this.W);
    if (y < 1 || x < 0 || x + BRIDGE_W > this.W) return false;
    for (let i = 0; i < BRIDGE_W; i++) if (tiles[k + i] !== T_EMPTY || this.closed[k + i]) return false;
    return tiles[k - this.W + 1] === T_EMPTY;
  }

  private tilesWith(keys: readonly number[]): Uint8Array {
    if (!keys.length) return this.base;
    const t = new Uint8Array(this.base);
    for (const k of keys) for (let i = 0; i < BRIDGE_W; i++) t[k + i] = T_SOLID;
    return t;
  }
}
