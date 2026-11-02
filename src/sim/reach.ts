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
   * Quantized state key at a decision point, or -1. A run reaching a key some
   * earlier run already explored stops (approximate dedupe: it can only lose
   * reachability, never invent it).
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
    readonly level: Level,
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
      const under = tileAt(this.level, Math.floor(ax / TILE), ty);
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

function policiesFor(onOneWay: boolean, level?: Level, runFrom?: readonly (-1 | 1)[]): Policy[] {
  const out: Policy[] = [];
  if (level && runFrom) {
    for (const d of runFrom) {
      out.push(new RunPolicy(level, d, 0, 99));
      out.push(new RunPolicy(level, d, 6, 99));
      for (const rel of [99, 8, 16]) out.push(new RunPolicy(level, d, 99, rel));
    }
  }
  out.push(
    new JumpPolicy(0, 99, 0, 0, [
      { at: LATE_STEER, make: () => new JumpPolicy(-1, 99, LATE_STEER, 99, undefined, -1) },
      { at: LATE_STEER, make: () => new JumpPolicy(1, 99, LATE_STEER, 99, undefined, 1) },
    ]),
  );
  for (const d of [-1, 1] as const) {
    out.push(new JumpPolicy(d, 0, 0, 99, undefined, d));
    for (const jf of [5, 99]) {
      const forks: Fork[] = [
        { at: 10, make: () => new JumpPolicy(d, jf, 0, 10) },
        { at: 20, make: () => new JumpPolicy(d, jf, 0, 20) },
      ];
      out.push(new JumpPolicy(d, jf, 0, 99, forks, jf === 99 ? d : undefined));
    }
  }
  if (onOneWay) for (const d of [0, -1, 1] as const) out.push(new DropPolicy(d));
  return out;
}

/** A cell a body can stand in: not solid itself, with a solid or one-way tile beneath. */
export function isStandable(level: Level, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= level.w || ty < 0 || ty >= level.h - 1) return false;
  if (tileAt(level, tx, ty) === T_SOLID) return false;
  const below = tileAt(level, tx, ty + 1);
  return below === T_SOLID || below === T_ONEWAY;
}

export interface ReachResult {
  goalReached: boolean;
  reachable: Set<number>;
}

/**
 * `onEdge`, when given, sees every transition of the stand-cell graph (a walk
 * step, or a jump/fall/climb landing) as it's found, keyed by `y * w + x`.
 * Worldgen's route analysis (gen/level/routes.ts) builds on it.
 */
export function analyzeReach(level: Level, stopAtGoal = true, onEdge?: (from: number, to: number) => void): ReachResult {
  const world: CollisionWorld = { tileAt: (x, y) => tileAt(level, x, y), solids: [], gravity: level.gravity ?? 1 };
  const key = (x: number, y: number) => y * level.w + x;
  const goalKey = key(level.goal.tx, level.goal.ty);
  const seen = new Set<number>();
  const queue: number[] = [];
  const pushKey = (k: number) => {
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(k);
    }
  };
  if (!isStandable(level, level.spawn.tx, level.spawn.ty)) return { goalReached: false, reachable: seen };
  pushKey(key(level.spawn.tx, level.spawn.ty));

  let from = -1;
  const reached = (k: number) => {
    onEdge?.(from, k);
    pushKey(k);
  };
  const tracer = new Tracer(level, world, reached);
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    from = k;
    if (k === goalKey && stopAtGoal) return { goalReached: true, reachable: seen };
    const tx = k % level.w;
    const ty = (k - tx) / level.w;
    for (const nx of [tx - 1, tx + 1]) if (isStandable(level, nx, ty)) reached(key(nx, ty));
    const oneWay = tileAt(level, tx, ty + 1) === T_ONEWAY;
    // Run-ups start where the platform starts (wall or drop behind you): the longest possible run.
    // Short ledges don't build meaningful speed; walking jumps cover them.
    const runFrom: (-1 | 1)[] = [];
    const runway = (d: -1 | 1) => {
      let n = 1;
      while (n < 4 && isStandable(level, tx + d * n, ty)) n++;
      return n >= 4;
    };
    if (!isStandable(level, tx - 1, ty) && runway(1)) runFrom.push(1);
    if (!isStandable(level, tx + 1, ty) && runway(-1)) runFrom.push(-1);
    for (const p of policiesFor(oneWay, level, runFrom)) {
      const b = bodyAtCell(tx, ty);
      if (oneWay) b.groundRef = TILE_ONEWAY_ID;
      tracer.trace(b, 0, p, false);
    }
  }
  return { goalReached: seen.has(goalKey), reachable: seen };
}

/** Runs policies (and their forks) through the real controller with reused scratch input. */
class Tracer {
  private c: Controls = { left: false, right: false, down: false, jump: false, jumpPressed: false, run: false };
  /** Wall-policy decision states already explored (see Policy.key). */
  private explored = new Set<number>();

  constructor(
    private level: Level,
    private world: CollisionWorld,
    private land: (k: number) => void,
  ) {}

  trace(b: Body, f0: number, p: Policy, airborne0: boolean): void {
    let airborne = airborne0;
    let wallForked = false;
    const bottom = this.level.h * TILE;
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
      stepBody(b, this.c, this.world);
      const child = p.after?.(b);
      if (child) this.trace({ ...b }, f + 1, child, airborne);
      if (b.y > bottom) return;
      if (!b.onGround) airborne = true;
      else if (airborne) {
        this.landing(b);
        return;
      }
      // Still walking along flat ground: neighbor edges (and the neighbor's own walk-off) cover that.
      else if (!p.runway && (f > 30 || Math.abs(b.x - x0) > 2 * TILE)) return;
    }
  }

  /** Record the standable cell under a body that just landed. */
  private landing(b: Body): void {
    const fy = Math.floor((b.y + b.h - 1) / TILE);
    const xs = [Math.floor((b.x + b.w / 2) / TILE), Math.floor(b.x / TILE), Math.floor((b.x + b.w - 1) / TILE)];
    for (const fx of xs) {
      if (isStandable(this.level, fx, fy)) {
        this.land(fy * this.level.w + fx);
        return;
      }
    }
  }
}
