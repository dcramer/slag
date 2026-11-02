import { PHYS } from '../../sim/constants';
import { footprintCells, type PlacedProp, resolveProp } from '../../sim/props';
import { TILE } from '../../sim/constants';
import { isProtected, type Level, T_EMPTY, T_SOLID } from '../../sim/level';
import { bodyAtCell, type CollisionWorld, stepBody } from '../../sim/physics';
import { analyzeReach } from '../../sim/reach';
import { footing } from '../../sim/weather';
import type { WindForce } from '../../sim/wind';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { BRIDGE_W, type BridgeHint } from './types';

export { BRIDGE_W };

/**
 * Solvability policy (AGENTS.md): a level is acceptable if the goal is
 * reachable from spawn without props, OR after placing at most MAX_BRIDGES
 * "bridges" — BRIDGE_W×1 solid platforms in empty, unprotected cells.
 *
 * The verdict is always confirmed with sim/reach.ts `analyzeReach` (the real
 * controller). Finding *where* bridges help is a search problem; re-running
 * the full analysis for every candidate is too slow, so the search uses a
 * cached transition graph built with the same controller (`stepBody`) and
 * the same jump scripts as reach.ts. A candidate placement only re-simulates
 * the cells whose recorded trajectories pass near the new tiles. Any solution
 * the search proposes is re-checked with analyzeReach before it counts, so
 * if reach.ts grows smarter (wall-jumps, one-way physics) the policy only
 * gets more permissive — the search is an under-approximation, never an
 * oracle.
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

/** Policy verdict for a level, using sculptor hints to speed up the search. */
export function judge(level: Level, hints: readonly Bridge[] = [], crossings: readonly [number, number][] = []): Verdict {
  const scored = (bridges: Bridge[], evals: number): Verdict => {
    const { shared } = analyzeRoutes(level, bridges);
    return { ok: true, bridges, evals, shared, open: shared <= MAX_SHARED };
  };
  if (analyzeReach(level).goalReached) return scored([], 0);
  const s = new BridgeSearch(level);
  const verify = (bs: Bridge[]) => bs.every((b) => canPlaceBridge(level, b)) && analyzeReach(withBridges(level, bs)).goalReached;
  const sol = s.solve(hints, verify);
  if (!sol) return { ok: false, bridges: [], evals: s.evals, shared: 1, open: false };
  // The search's model is rough: on a level with one crossing, two bridges may be one it didn't try.
  // A level's count sets what the crate must offer, so it has to be the real one.
  const lone = sol.length === 2 && crossings.length === 1 ? loneBridge(crossings[0], hints, verify) : null;
  return scored(lone ? [lone] : sol, s.evals);
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

/**
 * How many more bridges `level` needs with `placed` parts standing in it: 0
 * if the goal is already reachable, and MAX_BRIDGES if nothing proves a
 * smaller number (better to over-offer than to strand a match). Static solid
 * parts count as ground; everything placed takes up its cells.
 */
export function partsNeeded(level: Level, placed: readonly PlacedProp[]): number {
  const tiles = new Uint8Array(level.tiles);
  for (const pp of placed) {
    const r = resolveProp(pp);
    if (r.motion.type !== 'none') continue;
    for (const m of r.mods) {
      if (m.type !== 'body' || m.breakFrames > 0) continue;
      for (const [x, y] of m.cells) if (x >= 0 && y >= 0 && x < level.w && y < level.h) tiles[y * level.w + x] = T_SOLID;
    }
  }
  const now: Level = { ...level, tiles, setPieces: [...level.setPieces, ...placed] };
  if (analyzeReach(now).goalReached) return 0;
  const verify = (bs: Bridge[]) => bs.every((b) => canPlaceBridge(now, b)) && analyzeReach(withBridges(now, bs)).goalReached;
  // What's left of the recorded solution counts as proof, whatever the rougher search finds.
  const rest = (level.solution ?? []).filter((b) => canPlaceBridge(now, b));
  const recorded = verify(rest) ? rest.length : Infinity;
  const searched = new BridgeSearch(now).solve(level.solution ?? [], verify)?.length ?? Infinity;
  const best = Math.min(recorded, searched);
  return best === Infinity ? MAX_BRIDGES : best;
}

/**
 * Fewest parts the search can finish `level` with when a side wind of `air`
 * px/s blows whenever the player likes. MAX_BRIDGES when it finds nothing better.
 */
export function partsInAir(level: Level, air: number): number {
  const airs = [0, air];
  const verify = (bs: Bridge[]) => bs.every((b) => canPlaceBridge(level, b)) && analyzeReach(withBridges(level, bs), true, undefined, airs).goalReached;
  return new BridgeSearch(level, { vx: air, vy: 0, ky: 0, dy: 0 }).solve(level.solution ?? [], verify)?.length ?? MAX_BRIDGES;
}

/** Policy check; seeds the search with the level's recorded solution if it has one. */
export function isAcceptable(level: Level): boolean {
  const solution = level.solution ?? [];
  // A recorded solution proves itself. The search is rougher and may not rediscover it.
  const proven = solution.every((b) => canPlaceBridge(level, b)) && analyzeReach(withBridges(level, solution)).goalReached;
  return (proven || judge(level, solution).ok) && analyzeRoutes(level, solution).shared <= MAX_SHARED;
}

// ---------------------------------------------------------------------------
// Search-only reachability graph. Mirrors sim/reach.ts (scripts, frame cap,
// landing rule) so that its answers agree with analyzeReach today.

interface Script {
  dir: -1 | 0 | 1;
  jumpFrames: number;
  dirFrames: number;
}

const SCRIPTS: Script[] = (() => {
  const out: Script[] = [];
  for (const dir of [-1, 1] as const) {
    for (const jumpFrames of [0, 5, 99]) {
      for (const dirFrames of [99, 10, 20]) {
        if (jumpFrames === 0 && dirFrames !== 99) continue;
        out.push({ dir, jumpFrames, dirFrames });
      }
    }
  }
  out.push({ dir: 0, jumpFrames: 99, dirFrames: 0 });
  return out;
})();
const NS = SCRIPTS.length;
const MAX_FRAMES = 110;

interface CellInfo {
  /** Landing cell key per script (-1 = none). */
  land: Int32Array;
  /** Tile-space bounding box per script (x0, y0, x1, y1), padded by one tile. */
  box: Int16Array;
  /** Bridge keys (y * w + leftX) whose top a descending trajectory crosses. */
  cands: number[];
}

interface RunResult {
  goal: boolean;
  /** Lower is closer to the goal. */
  score: number;
  cands: Set<number>;
}

class BridgeSearch {
  evals = 0;
  private readonly W: number;
  private readonly H: number;
  private readonly base: Uint8Array;
  private readonly prot: Uint8Array;
  private readonly baseInfo = new Map<number, CellInfo>();
  private readonly gx: number;
  private readonly gy: number;

  constructor(
    private readonly level: Level,
    private readonly wind: WindForce | null = null,
  ) {
    this.W = level.w;
    this.H = level.h;
    this.prot = new Uint8Array(this.W * this.H);
    this.base = level.tiles;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (isProtected(level, x, y)) this.prot[y * this.W + x] = 1;
    this.gx = level.goal.tx;
    this.gy = level.goal.ty;
  }

  solve(hints: readonly Bridge[], verify: (bs: Bridge[]) => boolean): Bridge[] | null {
    const r0 = this.run([]);
    if (r0.goal && verify([])) return [];
    const hintKeys = hints.map((h) => h.y * this.W + h.x).filter((k) => this.placeable(this.base, k));
    const tried = new Set<string>();
    interface Node {
      keys: number[];
      score: number;
      cands: Set<number>;
    }
    const level1: Node[] = [];
    for (const k of this.rank(hintKeys, r0.cands, [], 14)) {
      const r = this.run([k]);
      tried.add(String(k));
      if (r.goal && verify([this.bridge(k)])) return [this.bridge(k)];
      level1.push({ keys: [k], score: r.score, cands: r.cands });
    }
    level1.sort((a, b) => a.score - b.score);
    for (const n of level1.slice(0, 3)) {
      for (const k of this.rank(hintKeys, n.cands, n.keys, 10)) {
        const keys = [...n.keys, k].sort((a, b) => a - b);
        const id = keys.join(',');
        if (tried.has(id)) continue;
        tried.add(id);
        const r = this.run(keys);
        if (r.goal) {
          const bs = keys.map((kk) => this.bridge(kk));
          if (verify(bs)) return bs;
        }
      }
    }
    return null;
  }

  private bridge(k: number): Bridge {
    return { x: k % this.W, y: Math.floor(k / this.W) };
  }

  private dist(x: number, y: number): number {
    return Math.abs(this.gx - x) + (y > this.gy ? 0.6 * (y - this.gy) : 0.25 * (this.gy - y));
  }

  /** Hints first, then candidates by distance-to-goal, spread out so near-duplicates don't crowd the list. */
  private rank(hints: number[], cands: Set<number>, placed: number[], n: number): number[] {
    const tiles = this.tilesWith(placed);
    const ok = (k: number) => this.placeable(tiles, k) && !placed.includes(k);
    const out: number[] = [];
    for (const h of hints) if (ok(h) && !out.includes(h)) out.push(h);
    const scored: [number, number][] = [];
    for (const k of cands) if (ok(k)) scored.push([this.dist((k % this.W) + 1, Math.floor(k / this.W) - 1), k]);
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const bins = new Set<number>();
    for (const [, k] of scored) {
      if (out.length >= n + hints.length) break;
      const bin = Math.floor(k / this.W) * 100 + Math.floor((k % this.W) / 2);
      if (bins.has(bin) || out.includes(k)) continue;
      bins.add(bin);
      out.push(k);
    }
    return out;
  }

  private placeable(tiles: Uint8Array, k: number): boolean {
    const x = k % this.W;
    const y = Math.floor(k / this.W);
    if (y < 1 || x < 0 || x + BRIDGE_W > this.W) return false;
    for (let i = 0; i < BRIDGE_W; i++) if (tiles[k + i] !== T_EMPTY || this.prot[k + i]) return false;
    return tiles[k - this.W + 1] === T_EMPTY;
  }

  private tilesWith(keys: readonly number[]): Uint8Array {
    if (!keys.length) return this.base;
    const t = new Uint8Array(this.base);
    for (const k of keys) for (let i = 0; i < BRIDGE_W; i++) t[k + i] = T_SOLID;
    return t;
  }

  /** BFS from spawn over the transition graph of the level with bridges `keys` placed. */
  private run(keys: readonly number[]): RunResult {
    this.evals++;
    const tiles = this.tilesWith(keys);
    const boxes = keys.map((k) => [k % this.W, Math.floor(k / this.W), (k % this.W) + BRIDGE_W - 1, Math.floor(k / this.W)]);
    const touches = (info: CellInfo, s: number) => {
      const b = info.box;
      for (const [x0, y0, x1, y1] of boxes) if (b[s * 4] <= x1 && b[s * 4 + 2] >= x0 && b[s * 4 + 1] <= y1 && b[s * 4 + 3] >= y0) return true;
      return false;
    };
    const world: CollisionWorld = {
      tileAt: (x, y) => (x < 0 || x >= this.W ? 1 : y < 0 || y >= this.H ? 0 : tiles[y * this.W + x]),
      solids: [],
      gravity: this.level.gravity ?? 1,
      tileSurface: footing(this.level),
    };
    const standable = (x: number, y: number) => x >= 0 && x < this.W && y >= 0 && y < this.H - 1 && !tiles[y * this.W + x] && !!tiles[(y + 1) * this.W + x];
    const sx = this.level.spawn.tx;
    const sy = this.level.spawn.ty;
    const goalKey = this.gy * this.W + this.gx;
    const res: RunResult = { goal: false, score: Infinity, cands: new Set() };
    if (!standable(sx, sy)) return res;
    const seen = new Uint8Array(this.W * this.H);
    const queue: number[] = [sy * this.W + sx];
    seen[queue[0]] = 1;
    let bestNatural = Infinity;
    let bestAny = Infinity;
    const push = (k: number) => {
      if (!seen[k]) {
        seen[k] = 1;
        queue.push(k);
      }
    };
    for (let qi = 0; qi < queue.length; qi++) {
      const k = queue[qi];
      const tx = k % this.W;
      const ty = (k - tx) / this.W;
      if (k === goalKey) {
        res.goal = true;
        res.score = -1;
        return res;
      }
      const d = this.dist(tx, ty);
      if (d < bestAny) bestAny = d;
      const natural = this.base[k + this.W] !== T_EMPTY;
      if (natural && d < bestNatural) bestNatural = d;
      if (standable(tx - 1, ty)) push(k - 1);
      if (standable(tx + 1, ty)) push(k + 1);
      let info = this.baseInfo.get(k);
      if (info && keys.length) for (let s = 0; s < NS && info; s++) if (touches(info, s)) info = undefined;
      if (!info) {
        info = this.simulateCell(world, tiles, tx, ty);
        let clean = true;
        for (let s = 0; s < NS && clean; s++) if (keys.length && touches(info, s)) clean = false;
        if (clean && this.base[k + this.W] !== T_EMPTY && this.base[k] === T_EMPTY) this.baseInfo.set(k, info);
      }
      for (let s = 0; s < NS; s++) if (info.land[s] >= 0) push(info.land[s]);
      for (const c of info.cands) res.cands.add(c);
    }
    res.score = bestNatural + 0.3 * bestAny;
    return res;
  }

  private simulateCell(world: CollisionWorld, tiles: Uint8Array, tx: number, ty: number): CellInfo {
    const info: CellInfo = { land: new Int32Array(NS).fill(-1), box: new Int16Array(NS * 4), cands: [] };
    const seenC = new Set<number>();
    // Run-up available behind this cell in each direction (reach.ts only runs from platforms ≥ 4 cells long;
    // 3 cells of travel reach full run speed). Short ledges — like a 3-wide bridge — only get walking jumps.
    const W = this.W;
    const st = (x: number) => x >= 0 && x < W && !tiles[ty * W + x] && !!tiles[(ty + 1) * W + x];
    const behind = (d: number) => {
      let n = 0;
      while (n < 3 && st(tx - d * (n + 1))) n++;
      return n;
    };
    // Like reach.ts: running jumps leave from a platform edge after a full run-up; everything else starts from rest, walking.
    const runL = behind(-1) >= 3 && !st(tx - 1);
    const runR = behind(1) >= 3 && !st(tx + 1);
    for (let s = 0; s < NS; s++) {
      const sc = SCRIPTS[s];
      const b = bodyAtCell(tx, ty);
      if (world.tileSurface) b.surface = world.tileSurface;
      // Guess model only (answers are re-verified with analyzeReach): assume a full run-up where there's room for one.
      const run = sc.dir !== 0 && (sc.dir > 0 ? runR : runL);
      if (run) b.vx = sc.dir * PHYS.runSpeed;
      let x0 = tx;
      let x1 = tx;
      let y0 = ty;
      let y1 = ty;
      let airborne = false;
      for (let f = 0; f < MAX_FRAMES; f++) {
        const prevBottom = b.y + b.h;
        const holdDir = f < sc.dirFrames;
        stepBody(
          b,
          { left: holdDir && sc.dir < 0, right: holdDir && sc.dir > 0, run, jump: f < sc.jumpFrames, jumpPressed: f === 0 && sc.jumpFrames > 0 },
          world,
          this.wind,
        );
        const bx0 = Math.floor(b.x / TILE);
        const bx1 = Math.floor((b.x + b.w) / TILE);
        const by0 = Math.floor(b.y / TILE);
        const by1 = Math.floor((b.y + b.h) / TILE);
        if (bx0 < x0) x0 = bx0;
        if (bx1 > x1) x1 = bx1;
        if (by0 < y0) y0 = by0;
        if (by1 > y1) y1 = by1;
        if (b.y > this.H * TILE) break;
        const bottom = b.y + b.h;
        if (!b.onGround && bottom > prevBottom) {
          // Descending: every tile row whose top we just passed could hold a bridge that catches us.
          const r = Math.floor(bottom / TILE);
          if (r * TILE > prevBottom - 1e-6 && r >= 1 && r < this.H) {
            const cx = Math.floor((b.x + b.w / 2) / TILE);
            const key = r * this.W + cx - 1;
            if (!seenC.has(key) && this.placeable(tiles, key)) {
              seenC.add(key);
              info.cands.push(key);
            }
          }
        }
        if (!b.onGround) airborne = true;
        else if (airborne) {
          const fy = Math.floor((b.y + b.h - 1) / TILE);
          for (const fx of [Math.floor((b.x + b.w / 2) / TILE), Math.floor(b.x / TILE), Math.floor((b.x + b.w - 1) / TILE)]) {
            if (fx >= 0 && fx < this.W && fy >= 0 && fy < this.H - 1 && !tiles[fy * this.W + fx] && tiles[(fy + 1) * this.W + fx]) {
              info.land[s] = fy * this.W + fx;
              break;
            }
          }
          break;
        } else if (f > 30) break;
      }
      info.box[s * 4] = x0 - 1;
      info.box[s * 4 + 1] = y0 - 1;
      info.box[s * 4 + 2] = x1 + 1;
      info.box[s * 4 + 3] = y1 + 1;
    }
    return info;
  }
}
