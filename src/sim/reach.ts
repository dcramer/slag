import { TILE as TILE_IMPORT } from './constants';
import { type Level, T_ONEWAY as T_ONEWAY_IMPORT, T_SOLID as T_SOLID_IMPORT } from './level';
import {
  type Body,
  bodyAtCell as bodyAtCellImport,
  type CollisionWorld,
  type Controls,
  stepBody as stepBodyImport,
  TILE_ONEWAY_ID as TILE_ONEWAY_ID_IMPORT,
} from './physics';

// Hot-path imports rebound to module locals (vitest's module transform turns
// imported bindings into getter calls; this file is worldgen's inner loop).
const TILE = TILE_IMPORT;
const T_ONEWAY = T_ONEWAY_IMPORT;
const T_SOLID = T_SOLID_IMPORT;
const bodyAtCell = bodyAtCellImport;
const stepBody = stepBodyImport;
const TILE_ONEWAY_ID = TILE_ONEWAY_ID_IMPORT;

/**
 * Analysis-only tile: something a proven route must keep clear of (see
 * gen/level/winnable.ts). The controller collides with it like a wall, nothing
 * can stand on it, and a run that touches it stops there. It never appears in
 * a real level's tiles.
 */
export const T_NOGO = 3;

/** Same contract as level.tileAt (outside x = solid wall, outside y = empty), inlined for speed. */
function tileAt(level: Level, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.w) return T_SOLID;
  if (ty < 0 || ty >= level.h) return 0;
  return level.tiles[ty * level.w + tx];
}

/**
 * Reachability analysis that uses the *real* player controller: from every
 * standable cell we feed input policies through `stepBody` and record where
 * the ghost lands. BFS over that graph tells us whether the goal is reachable
 * from spawn.
 *
 * Policies: walk-offs; walking jumps of two heights with three air-control
 * lengths; running jumps from each platform start (max run-up, jump at the
 * edge, three air-control lengths) and run-offs;
 * straight-up jumps that steer late (up, then over a lip); drop-throughs on
 * one-way platforms; and reactive wall-jump policies — single-wall climb
 * (keep steering back into the wall after each kick) and shaft climb
 * (zig-zag between two walls). Every input is one a human can produce (a wall
 * jump is a real release + re-press), so the analysis is conservative:
 * anything it reports reachable truly is; some beatable levels (fancy
 * reversals, momentum tricks) are reported unreachable.
 *
 * Speed: policies that share a prefix are run once and forked (the body is
 * plain data, so a fork is a shallow copy). Wall policies fork off the jump
 * and walk-off runs at the first frame they press into a wall past the apex,
 * so they cost nothing where there are no walls.
 *
 * Each root policy from a cell is traced on its own and records the box of
 * tiles it read, so its result is a pure function of those tiles. That's what
 * lets a ReachCache reuse traces between analyses of nearly the same tiles
 * (a bridge added, a part placed) with exactly the answer a fresh analysis
 * gives: nothing depends on what ran before it. Worldgen and the winnability
 * proof ask dozens of such questions per level.
 */

interface Fork {
  at: number;
  make: () => Policy;
}

interface Policy {
  /** Frames (absolute) after which the run gives up. */
  readonly maxFrames: number;
  input(f: number, b: Body, c: Controls): void;
  /** Child policies started from this run's state at frame `at`. */
  readonly forks?: readonly Fork[];
  /** Spawn a wall-climb policy the first time this run presses into a wall (this side) past the apex. */
  readonly wallFork?: -1 | 1;
  /** Keep tracing while still on the ground (run-ups), instead of giving up after a short walk. */
  readonly runway?: boolean;
  /** Called after each step (wall policy bookkeeping); may return a policy to fork from the new state. */
  after?(b: Body): Policy | null;
  /**
   * Quantized state key at a decision point, or -1. A run reaching a key an
   * earlier run of the same root already explored stops (approximate dedupe:
   * it can only lose reachability, never invent it).
   */
  key?(b: Body): number;
}

const MAX_FRAMES = 110;
const MAX_WALL_FRAMES = 300;
const MAX_WALL_JUMPS = 10;
/** Frame at which straight-up jumps fork into late-steer variants. */
const LATE_STEER = 12;

class JumpPolicy implements Policy {
  readonly maxFrames = MAX_FRAMES;
  constructor(
    readonly dir: -1 | 0 | 1,
    /** Frames the jump button is held (0 = walk off a ledge). */
    readonly jumpFrames: number,
    readonly dirFrom: number,
    readonly dirTo: number,
    readonly forks?: Fork[],
    readonly wallFork?: -1 | 1,
  ) {}
  input(f: number, _b: Body, c: Controls) {
    const d = f >= this.dirFrom && f < this.dirTo ? this.dir : 0;
    c.run = false;
    c.left = d < 0;
    c.right = d > 0;
    c.down = false;
    c.jump = f < this.jumpFrames;
    c.jumpPressed = f === 0 && this.jumpFrames > 0;
  }
}

/**
 * Running jump: hold RUN + dir from a platform start (maximum run-up), jump at
 * the last moment before running off the edge (or just run off), then either
 * keep holding the direction or let go after a few frames to land shorter.
 */
class RunPolicy implements Policy {
  readonly maxFrames = 170;
  readonly runway = true;
  private jumpAt = -1;
  constructor(
    readonly world: CollisionWorld,
    readonly dir: -1 | 1,
    /** Frames jump is held once pressed (0 = run off without jumping). */
    readonly jumpFrames: number,
    /** Release the direction this many frames after take-off (99 = never). */
    readonly releaseAfter: number,
  ) {}
  input(f: number, b: Body, c: Controls) {
    c.down = false;
    c.run = true;
    c.jumpPressed = false;
    if (this.jumpAt < 0 && b.onGround && this.jumpFrames > 0) {
      // About to leave the ground? Look one step ahead under the leading foot.
      const step = Math.max(1, Math.abs(b.vx) / 60);
      const ax = this.dir > 0 ? b.x + b.w + step : b.x - step;
      const ty = Math.floor((b.y + b.h + 1) / TILE);
      const under = this.world.tileAt(Math.floor(ax / TILE), ty);
      if (under !== T_SOLID && under !== T_ONEWAY) {
        this.jumpAt = f;
        c.jumpPressed = true;
      }
    }
    const since = this.jumpAt < 0 ? -1 : f - this.jumpAt;
    c.jump = since >= 0 && since < this.jumpFrames;
    const holding = since < 0 || since < this.releaseAfter;
    c.left = holding && this.dir < 0;
    c.right = holding && this.dir > 0;
  }
}

class DropPolicy implements Policy {
  readonly maxFrames = MAX_FRAMES;
  constructor(readonly dir: -1 | 0 | 1) {}
  input(f: number, _b: Body, c: Controls) {
    c.run = false;
    c.left = this.dir < 0;
    c.right = this.dir > 0;
    c.down = f < 2;
    c.jump = f < 2;
    c.jumpPressed = f === 0;
  }
}

/**
 * Reactive wall jumping. Holds toward the wall `d`; whenever pressing into it
 * in the air past the apex, releases jump for one frame then re-presses it.
 * climb: keeps holding into the same wall (near-vertical into-wall jumps).
 * zigzag: on each press holds away (strong kick) and then steers into the
 * opposite wall. A climb's first release forks a zigzag twin.
 */
class WallPolicy implements Policy {
  readonly maxFrames = MAX_WALL_FRAMES;
  press = false;
  jumps = 0;
  private count = -1;
  private twinned = false;
  constructor(
    public d: -1 | 1,
    public held: boolean,
    readonly zigzag: boolean,
  ) {}
  input(_f: number, b: Body, c: Controls) {
    if (this.count < 0) this.count = b.wallJumps;
    c.down = false;
    c.run = false;
    c.jumpPressed = false;
    if (this.press) {
      if (this.zigzag) this.d = this.d > 0 ? -1 : 1;
      c.jump = true;
      c.jumpPressed = true;
      this.press = false;
      this.held = true;
    } else if (!b.onGround && b.wallDir === this.d && b.vy >= 0 && this.jumps < MAX_WALL_JUMPS) {
      c.jump = false;
      this.press = true;
    } else c.jump = this.held;
    c.left = this.d < 0;
    c.right = this.d > 0;
  }
  key(b: Body): number {
    if (this.press || b.onGround || b.wallDir !== this.d || b.vy < 0) return -1;
    const vyBucket = Math.min(31, Math.floor(b.vy / 40));
    return ((Math.round(b.x) * 512 + Math.floor((b.y + 96) / 3)) * 32 + vyBucket) * 4 + (this.d > 0 ? 2 : 0) + (this.zigzag ? 1 : 0);
  }
  after(b: Body): Policy | null {
    if (b.wallJumps !== this.count) {
      this.count = b.wallJumps;
      this.jumps++;
    }
    if (!this.zigzag && this.press && !this.twinned) {
      this.twinned = true;
      const z = new WallPolicy(this.d, this.held, true);
      z.press = true;
      z.jumps = this.jumps;
      return z;
    }
    return null;
  }
}

/** [jump frames, release frames] of the running roots: a run-off, a short hop, and full jumps with three air-control lengths. */
const RUNS: readonly (readonly [number, number])[] = [
  [0, 99],
  [6, 99],
  [99, 99],
  [99, 8],
  [99, 16],
];

/** Root policies, numbered: 0-4 run right, 5-9 run left, 10 straight up, 11-16 walking (left, then right), 17-19 drop through. */
const ROOT_COUNT = 20;
const ROOT_UP = 10;
const ROOT_DROP = 17;

function walkingRoot(d: -1 | 1, kind: number): Policy {
  if (kind === 0) return new JumpPolicy(d, 0, 0, 99, undefined, d);
  const jf = kind === 1 ? 5 : 99;
  const forks: Fork[] = [
    { at: 10, make: () => new JumpPolicy(d, jf, 0, 10) },
    { at: 20, make: () => new JumpPolicy(d, jf, 0, 20) },
  ];
  return new JumpPolicy(d, jf, 0, 99, forks, jf === 99 ? d : undefined);
}

function rootPolicy(root: number, world: CollisionWorld): Policy {
  if (root < ROOT_UP) {
    const [jf, rel] = RUNS[root % 5];
    return new RunPolicy(world, root < 5 ? 1 : -1, jf, rel);
  }
  if (root === ROOT_UP) {
    return new JumpPolicy(0, 99, 0, 0, [
      { at: LATE_STEER, make: () => new JumpPolicy(-1, 99, LATE_STEER, 99, undefined, -1) },
      { at: LATE_STEER, make: () => new JumpPolicy(1, 99, LATE_STEER, 99, undefined, 1) },
    ]);
  }
  if (root < ROOT_DROP) return walkingRoot(root < 14 ? -1 : 1, (root - 11) % 3);
  return new DropPolicy(([0, -1, 1] as const)[root - ROOT_DROP]);
}

/** A cell a body can stand in: not solid itself, with a solid or one-way tile beneath. */
export function isStandable(level: Level, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= level.w || ty < 0 || ty >= level.h - 1) return false;
  const t = tileAt(level, tx, ty);
  if (t === T_SOLID || t === T_NOGO) return false;
  const below = tileAt(level, tx, ty + 1);
  return below === T_SOLID || below === T_ONEWAY;
}

export interface ReachResult {
  goalReached: boolean;
  reachable: Set<number>;
}

/** What one root policy found from one cell, and the tiles that answer depends on. */
interface Trail {
  /** Stand cells it landed on, in the order found. */
  land: number[];
  /** Box of tiles read, inclusive and clipped to the level. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Left ends a bridge could take to catch this run on the way down. */
  cands: number[];
}

export interface AnalyzeOptions {
  /** Sees every transition of the stand-cell graph (a walk step, or a jump/fall/climb landing) as it's found, keyed by `y * w + x`. */
  onEdge?: (from: number, to: number) => void;
  /** Set to 1 at each cell a bridge's left end could take to catch a run on its way down. */
  cands?: Uint8Array;
  /**
   * Start here instead of at spawn, treating `known` cells as already explored
   * (not walked into, not expanded): what this adds to an earlier analysis.
   * Runs that leave a known cell aren't re-asked, so it's a fast first look.
   */
  from?: { cells: readonly number[]; known: Uint8Array };
}

export interface Analysis {
  goalReached: boolean;
  /** Reachable stand cells, spawn first, in the order they were found. */
  cells: number[];
}

/**
 * Reachability over one level and small changes to it. Keeps every trace that
 * read only tiles the base level has, and reuses it wherever those tiles are
 * unchanged, so an analysis costs the traces a change really touches. Answers
 * are exactly analyzeReach's, whatever ran before them (tests/reach-cache.test.ts).
 */
export class ReachCache {
  private readonly tiles: Uint8Array;
  private readonly trails: (Trail | undefined)[];
  private readonly tracer: Tracer;
  /** Summed-area table of the tiles that differ from `tiles`, refilled per analysis. */
  private readonly diff: Int32Array;

  constructor(level: Level) {
    this.tiles = level.tiles.slice();
    this.trails = new Array<Trail | undefined>(level.w * level.h * ROOT_COUNT);
    this.tracer = new Tracer(level);
    this.diff = new Int32Array((level.w + 1) * (level.h + 1));
  }

  /** Make `tiles` the new base, dropping the traces that read a changed tile. */
  rebase(tiles: Uint8Array): void {
    if (!this.findDiff(tiles)) return;
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      if (t && this.stale(t)) this.trails[i] = undefined;
    }
    this.tiles.set(tiles);
  }

  /** Fill the diff table for `tiles`; false if they match the base. */
  private findDiff(tiles: Uint8Array): boolean {
    const { w, h } = this.tracer;
    const base = this.tiles;
    const d = this.diff;
    const stride = w + 1;
    let any = false;
    for (let y = 0; y < h; y++) {
      let row = 0;
      const at = y * w;
      const line = (y + 1) * stride;
      for (let x = 0; x < w; x++) {
        if (tiles[at + x] !== base[at + x]) {
          row++;
          any = true;
        }
        d[line + x + 1] = d[line - stride + x + 1] + row;
      }
    }
    return any;
  }

  /** Did this trail read a tile that differs from the base? */
  private stale(t: Trail): boolean {
    const stride = this.tracer.w + 1;
    const d = this.diff;
    const top = t.y0 * stride;
    const bottom = (t.y1 + 1) * stride;
    return d[bottom + t.x1 + 1] - d[bottom + t.x0] - d[top + t.x1 + 1] + d[top + t.x0] !== 0;
  }

  /** Reachability of `level`, which must have the size and gravity this cache was made for. */
  analyze(level: Level, stopAtGoal = true, opts: AnalyzeOptions = {}): Analysis {
    const { w, h, tiles } = level;
    const { onEdge, cands, from: extend } = opts;
    const seen = extend ? extend.known.slice() : new Uint8Array(w * h);
    const cells: number[] = [];
    const goalKey = level.goal.ty * w + level.goal.tx;
    const stand = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h - 1) return false;
      const t = tiles[y * w + x];
      if (t === T_SOLID || t === T_NOGO) return false;
      const below = tiles[(y + 1) * w + x];
      return below === T_SOLID || below === T_ONEWAY;
    };
    if (!extend && !stand(level.spawn.tx, level.spawn.ty)) return { goalReached: false, cells };
    const changed = this.findDiff(tiles);
    const tracer = this.tracer;
    tracer.use(tiles);
    for (const k of extend ? extend.cells : [level.spawn.ty * w + level.spawn.tx]) {
      if (seen[k]) continue;
      seen[k] = 1;
      cells.push(k);
    }
    let from = -1;
    const reached = (k: number) => {
      onEdge?.(from, k);
      if (!seen[k]) {
        seen[k] = 1;
        cells.push(k);
      }
    };
    // Run-ups start where the platform starts (wall or drop behind you): the longest possible run.
    // Short ledges don't build meaningful speed; walking jumps cover them.
    const runway = (tx: number, ty: number, d: -1 | 1) => {
      let n = 1;
      while (n < 4 && stand(tx + d * n, ty)) n++;
      return n >= 4;
    };
    for (let qi = 0; qi < cells.length; qi++) {
      const k = cells[qi];
      from = k;
      if (k === goalKey && stopAtGoal) return { goalReached: true, cells };
      const tx = k % w;
      const ty = (k - tx) / w;
      const left = stand(tx - 1, ty);
      const right = stand(tx + 1, ty);
      if (left) reached(k - 1);
      if (right) reached(k + 1);
      const oneWay = tiles[k + w] === T_ONEWAY;
      const runR = !left && runway(tx, ty, 1);
      const runL = !right && runway(tx, ty, -1);
      for (let root = 0; root < ROOT_COUNT; root++) {
        if (root < 5 ? !runR : root < ROOT_UP ? !runL : root >= ROOT_DROP && !oneWay) continue;
        const slot = k * ROOT_COUNT + root;
        let t = this.trails[slot];
        if (!t || (changed && this.stale(t))) {
          t = tracer.run(root, tx, ty, oneWay);
          if (!changed || !this.stale(t)) this.trails[slot] = t;
        }
        for (let i = 0; i < t.land.length; i++) reached(t.land[i]);
        if (cands) for (let i = 0; i < t.cands.length; i++) cands[t.cands[i]] = 1;
      }
    }
    return { goalReached: seen[goalKey] === 1, cells };
  }
}

/**
 * `onEdge`, when given, sees every transition of the stand-cell graph (a walk
 * step, or a jump/fall/climb landing) as it's found, keyed by `y * w + x`.
 * Worldgen's route analysis (gen/level/routes.ts) builds on it.
 */
export function analyzeReach(level: Level, stopAtGoal = true, onEdge?: (from: number, to: number) => void): ReachResult {
  const { goalReached, cells } = new ReachCache(level).analyze(level, stopAtGoal, { onEdge });
  return { goalReached, reachable: new Set(cells) };
}

/** Runs policies (and their forks) through the real controller with reused scratch input, tracking what each root read. */
class Tracer {
  readonly w: number;
  readonly h: number;
  private tiles: Uint8Array;
  private readonly world: CollisionWorld;
  private c: Controls = { left: false, right: false, down: false, jump: false, jumpPressed: false, run: false };
  /** Wall-policy decision states this root already explored (see Policy.key). */
  private explored = new Set<number>();
  // Box of tiles read by the root being traced.
  private bx0 = 0;
  private by0 = 0;
  private bx1 = 0;
  private by1 = 0;
  /** The last step touched a T_NOGO tile. */
  private touched = false;
  /** CollisionWorld.clear: per root, so every read lands in that root's box. */
  private readonly clear = { x0: 1, y0: 1, x1: 0, y1: 0 };
  private land: number[] = [];
  private cands: number[] = [];
  /** Per cell, the last root that offered it as a candidate. */
  private readonly candStamp: Int32Array;
  private stamp = 0;

  constructor(level: Level) {
    this.w = level.w;
    this.h = level.h;
    this.tiles = level.tiles;
    this.candStamp = new Int32Array(level.w * level.h);
    const { w, h } = this;
    this.world = {
      tileAt: (x, y) => {
        if (x < 0 || x >= w) return T_SOLID;
        if (y < 0 || y >= h) return 0;
        if (x < this.bx0) this.bx0 = x;
        else if (x > this.bx1) this.bx1 = x;
        if (y < this.by0) this.by0 = y;
        else if (y > this.by1) this.by1 = y;
        const t = this.tiles[y * w + x];
        if (t === T_NOGO) this.touched = true;
        return t;
      },
      solids: [],
      gravity: level.gravity ?? 1,
      clear: this.clear,
    };
  }

  use(tiles: Uint8Array): void {
    this.tiles = tiles;
  }

  /** Trace one root policy from a cell, on its own. */
  run(root: number, tx: number, ty: number, oneWay: boolean): Trail {
    this.bx0 = this.bx1 = tx;
    this.by0 = this.by1 = ty;
    this.clear.x0 = 1;
    this.clear.x1 = 0;
    this.explored.clear();
    this.land = [];
    this.cands = [];
    this.stamp++;
    const b = bodyAtCell(tx, ty);
    if (oneWay) b.groundRef = TILE_ONEWAY_ID;
    // The tile underfoot decides which roots apply and how they start.
    this.world.tileAt(tx, ty + 1);
    this.touched = false;
    this.trace(b, 0, rootPolicy(root, this.world), false);
    return { land: this.land, x0: this.bx0, y0: this.by0, x1: this.bx1, y1: this.by1, cands: this.cands };
  }

  private trace(b: Body, f0: number, p: Policy, airborne0: boolean): void {
    let airborne = airborne0;
    let wallForked = false;
    const bottom = this.h * TILE;
    const x0 = b.x;
    for (let f = f0; f < p.maxFrames; f++) {
      if (p.forks) for (const fk of p.forks) if (fk.at === f) this.trace({ ...b }, f, fk.make(), airborne);
      if (p.wallFork && !wallForked && !b.onGround && b.wallDir === p.wallFork && b.vy >= 0) {
        wallForked = true;
        this.trace({ ...b }, f, new WallPolicy(p.wallFork, false, false), airborne);
      }
      if (p.key) {
        if (b.y < -TILE) return; // climbed out over the top of the level: nothing to land on up there
        const k = p.key(b);
        if (k >= 0) {
          if (this.explored.has(k)) return;
          this.explored.add(k);
        }
      }
      p.input(f, b, this.c);
      const feet = b.y + b.h;
      stepBody(b, this.c, this.world);
      if (this.touched) {
        this.touched = false;
        return;
      }
      const child = p.after?.(b);
      if (child) this.trace({ ...b }, f + 1, child, airborne);
      if (b.y > bottom) return;
      if (!b.onGround) {
        airborne = true;
        if (b.y + b.h > feet) this.offerBridge(b, feet);
      } else if (airborne) {
        this.landing(b);
        return;
      }
      // Still walking along flat ground: neighbor edges (and the neighbor's own walk-off) cover that.
      else if (!p.runway && (f > 30 || Math.abs(b.x - x0) > 2 * TILE)) return;
    }
  }

  /** Falling past the top of a tile row: a bridge there, centered under the body, would have caught it. */
  private offerBridge(b: Body, feet: number): void {
    const r = Math.floor((b.y + b.h) / TILE);
    if (r * TILE <= feet - 1e-6 || r < 1 || r >= this.h) return;
    const k = r * this.w + Math.floor((b.x + b.w / 2) / TILE) - 1;
    if (this.candStamp[k] === this.stamp) return;
    this.candStamp[k] = this.stamp;
    this.cands.push(k);
  }

  /** Record the standable cell under a body that just landed. */
  private landing(b: Body): void {
    const fy = Math.floor((b.y + b.h - 1) / TILE);
    if (!this.record(Math.floor((b.x + b.w / 2) / TILE), fy) && !this.record(Math.floor(b.x / TILE), fy)) this.record(Math.floor((b.x + b.w - 1) / TILE), fy);
    this.touched = false;
  }

  private record(fx: number, fy: number): boolean {
    if (fx < 0 || fx >= this.w || fy < 0 || fy >= this.h - 1) return false;
    const t = this.world.tileAt(fx, fy);
    if (t === T_SOLID || t === T_NOGO) return false;
    const below = this.world.tileAt(fx, fy + 1);
    if (below !== T_SOLID && below !== T_ONEWAY) return false;
    const k = fy * this.w + fx;
    if (!this.land.includes(k)) this.land.push(k);
    return true;
  }
}
