import { TILE } from '../../sim/constants';
import { type Level, offMap, T_SOLID } from '../../sim/level';
import { type Body, type CollisionWorld, type Controls, createBody, stepBody } from '../../sim/physics';
import { type Move, movesOn, type ReadBox } from '../../sim/reach';
import { groundSurfaceAt } from '../../sim/ground';
import { footing } from '../../sim/weather';
import type { Routes } from './routes';
import { BRIDGE_W, type BridgeHint } from './types';

/**
 * How much precision a route asks, measured the way people miss: for each
 * jump on it, replay the controller's own move a little wrong (letting go of
 * jump early, jumping a beat late or early, running on after landing) and
 * see whether that still lands or falls out of the level. A jump no slip
 * forgives is a tight one. Bots fumble with these same slips
 * (src/brain/motor.ts `slipped`), so a harder level beats them more often.
 *
 * A level is as hard as its easier route: a player takes the forgiving way
 * when there is one (`levelPrecision`). Hazards aren't counted here, only the
 * drop; terrain and the plan's bridges are.
 */

/** Frames early a slipped jump lets go, late or early it's pressed, and a runner keeps going after landing. */
const LET_GO = 4;
const LATE = 3;
const EARLY = 2;
const RUN_ON = 8;
/** Frames to fall after the move before giving up on it landing. */
const SETTLE = 150;

export type Slip = 'short' | 'late' | 'early' | 'long';

export interface RoutePrecision {
  /** Jumps on the route. */
  jumps: number;
  /** Jumps some slip turns into a fall out of the level. */
  tight: number;
}

const NONE: Controls = { left: false, right: false, jump: false, jumpPressed: false };

/** The move's controls with one slip in, or null if that slip doesn't apply to it. */
export function slip(controls: readonly Controls[], kind: Slip): Controls[] | null {
  const c = controls.map((x) => ({ ...x }));
  const j = c.findIndex((x) => x.jumpPressed);
  if (j < 0) return null;
  switch (kind) {
    case 'short': {
      let end = j;
      while (end + 1 < c.length && c[end + 1].jump) end++;
      if (end - j <= LET_GO) return null;
      for (let k = end - LET_GO + 1; k <= end; k++) c[k].jump = false;
      return c;
    }
    case 'late':
      if (j === 0) return null;
      c.splice(j, 0, ...Array.from({ length: LATE }, () => ({ ...c[j - 1], jump: false, jumpPressed: false })));
      return c;
    case 'early':
      if (j < EARLY) return null;
      c.splice(j - EARLY, EARLY);
      return c;
    case 'long': {
      // Never braking: the direction (and run) held at take-off kept through the landing and a few frames past it.
      const { left, right, run } = c[j];
      if (left === right) return null;
      for (let k = j + 1; k < c.length; k++) c[k] = { ...c[k], left, right, run };
      for (let k = 0; k < RUN_ON; k++) c.push({ left, right, run, jump: false, jumpPressed: false });
      return c;
    }
  }
}

function worldOf(level: Level, tiles: Uint8Array): CollisionWorld {
  const { w, h } = level;
  const surfaceAt = groundSurfaceAt(level);
  const tileSurface = footing(level);
  return {
    tileAt: (x, y) => (x < 0 || x >= w ? T_SOLID : y < 0 || y >= h ? 0 : tiles[y * w + x]),
    cols: w,
    solids: [],
    gravity: level.gravity ?? 1,
    ...(tileSurface ? { tileSurface } : {}),
    ...(surfaceAt ? { surfaceAt } : {}),
  };
}

/**
 * Rows below its take-off a slipped jump landing in a tower counts as a fall: back down a perch or more is a climb
 * the slag gains on, where a stair's slack still lands you on the step you were going for.
 */
export const LOST_ROWS = 2;

/**
 * True if `controls` from `body`, then letting go, costs the climb: the body ends out of the bottom or off a side of
 * the level, or, in a Rising Slag tower (`Level.tide`), lands `LOST_ROWS` or more below where it took off.
 */
function falls(level: Level, world: CollisionWorld, body: Body, controls: readonly Controls[]): boolean {
  const b = { ...body };
  const out = level.h * TILE;
  for (const c of controls) {
    stepBody(b, c, world);
    if (b.y > out || offMap(b, level.w)) return true;
  }
  for (let f = 0; f < SETTLE && !b.onGround; f++) {
    stepBody(b, NONE, world);
    if (b.y > out || offMap(b, level.w)) return true;
  }
  return !!level.tide && b.y - body.y >= LOST_ROWS * TILE;
}

/** A body standing still in stand cell `cell`, as a route's moves start. */
function standing(level: Level, world: CollisionWorld, cell: number): Body {
  const tx = cell % level.w;
  const ty = Math.floor(cell / level.w);
  const b = createBody(0, 0);
  b.x = tx * TILE + (TILE - b.w) / 2;
  b.y = (ty + 1) * TILE - b.h;
  stepBody(b, NONE, world);
  return b;
}

/** Tiles with the plan's bridges written in as rock, as the routes were measured. */
function withBridges(level: Level, bridges: readonly BridgeHint[]): Uint8Array {
  const tiles = new Uint8Array(level.tiles);
  for (const b of bridges) for (let i = 0; i < BRIDGE_W; i++) tiles[b.y * level.w + b.x + i] = T_SOLID;
  return tiles;
}

const SLIPS: readonly Slip[] = ['short', 'late', 'early', 'long'];
/** Each level's collision world, built once: the tiles a slip is traced on don't change while a level is in play. */
const worlds = new WeakMap<Level, CollisionWorld>();

/**
 * The slips that turn `controls`, played from `body`, into a fall out of
 * `level`: a jump with any is a tight one. A bot that chokes on a tight jump
 * makes one of these (src/brain/motor.ts), as a person's nerves go on the
 * jumps a level's difficulty counts.
 */
export function fatalSlips(level: Level, body: Body, controls: readonly Controls[]): Slip[] {
  let world = worlds.get(level);
  if (!world) worlds.set(level, (world = worldOf(level, level.tiles)));
  return SLIPS.filter((kind) => {
    const c = slip(controls, kind);
    return !!c && falls(level, world, body, c);
  });
}

/** One jump on a route: the stand row it takes off from, and whether some slip turns it into a fall. */
export interface RouteJump {
  row: number;
  tight: boolean;
}

/**
 * Each step of a route measured on one level whose tiles change a little at a
 * time (a bot weighing where a part would go), kept with the tiles its traces
 * read: a step is measured again only when one of those changed, with exactly
 * a fresh measurement's answer. Only for one level: its size, gravity, footing
 * and ground are taken as fixed.
 */
export class JumpCache {
  private readonly steps = new Map<number, { box: ReadBox; seen: Uint8Array; jump: RouteJump | null }>();
  constructor(private readonly level: Level) {}

  /** The jump from `from` to `to` on `tiles` if one is kept and still holds; undefined when it must be measured. */
  get(tiles: Uint8Array, from: number, to: number): RouteJump | null | undefined {
    const hit = this.steps.get(from * this.level.w * this.level.h + to);
    if (!hit) return undefined;
    const { box, seen } = hit;
    const w = this.level.w;
    let i = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (tiles[y * w + x] !== seen[i++]) return undefined;
    return hit.jump;
  }

  set(tiles: Uint8Array, from: number, to: number, read: ReadBox, jump: RouteJump | null): void {
    const { w, h } = this.level;
    const box = { x0: Math.max(0, read.x0), y0: Math.max(0, read.y0), x1: Math.min(w - 1, read.x1), y1: Math.min(h - 1, read.y1) };
    const seen = new Uint8Array(Math.max(0, box.x1 - box.x0 + 1) * Math.max(0, box.y1 - box.y0 + 1));
    let i = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) seen[i++] = tiles[y * w + x];
    this.steps.set(from * w * h + to, { box, seen, jump });
  }
}

/** `world` reading through to `tiles`, widening `read` by every tile in the level it reads. */
function watched(world: CollisionWorld, w: number, h: number, read: ReadBox): CollisionWorld {
  return {
    ...world,
    tileAt: (x, y) => {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        if (x < read.x0) read.x0 = x;
        if (x > read.x1) read.x1 = x;
        if (y < read.y0) read.y0 = y;
        if (y > read.y1) read.y1 = y;
      }
      return world.tileAt(x, y);
    },
  };
}

/** The jump from `from` to `to`, or null if no air move makes that step. `found`, when given, keeps each cell's moves for the next step from it. */
function jumpOf(
  level: Level,
  world: CollisionWorld,
  moves: (b: Body, read?: ReadBox) => Move[],
  from: number,
  to: number,
  read?: ReadBox,
  found?: Map<number, { body: Body; moves: Move[] }>,
): RouteJump | null {
  let at = found?.get(from);
  if (!at) {
    const body = standing(level, world, from);
    at = { body, moves: moves(body, read) };
    found?.set(from, at);
  }
  const { body } = at;
  let move: Controls[] | null = null;
  for (const m of at.moves) if (m.to === to && m.air && (!move || m.controls.length < move.length)) move = m.controls;
  if (!move) return null;
  const tight = SLIPS.some((kind) => {
    const c = slip(move, kind);
    return !!c && falls(level, world, body, c);
  });
  return { row: Math.floor(from / level.w), tight };
}

/**
 * The moves from each cell of one level with one plan's bridges, traced once: a level's fastest route and its
 * alternative run through many of the same cells, and a cell's moves don't depend on where the route goes next.
 */
interface Traced {
  tiles: Uint8Array;
  world: CollisionWorld;
  moves: ((b: Body, read?: ReadBox) => Move[]) | null;
  found: Map<number, { body: Body; moves: Move[] }>;
}

function traced(level: Level, bridges: readonly BridgeHint[]): Traced {
  const tiles = withBridges(level, bridges);
  return { tiles, world: worldOf(level, tiles), moves: null, found: new Map() };
}

/**
 * Every jump along `route` (stand cells, spawn first), in order: the moves a slip can cost, where they are. Pass the
 * level's `cache` when asking many times over tiles that change a little at a time.
 */
export function routeJumps(level: Level, route: readonly number[], bridges: readonly BridgeHint[] = [], cache?: JumpCache): RouteJump[] {
  return jumpsAlong(level, route, traced(level, bridges), cache);
}

function jumpsAlong(level: Level, route: readonly number[], t: Traced, cache?: JumpCache): RouteJump[] {
  const { tiles, world } = t;
  const out: RouteJump[] = [];
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    let jump = cache?.get(tiles, from, to);
    if (jump === undefined) {
      const moves = (t.moves ??= movesOn({ ...level, tiles }));
      if (cache) {
        const read = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        const box = { ...read };
        jump = jumpOf(level, watched(world, level.w, level.h, read), moves, from, to, box);
        cache.set(
          tiles,
          from,
          to,
          { x0: Math.min(read.x0, box.x0), y0: Math.min(read.y0, box.y0), x1: Math.max(read.x1, box.x1), y1: Math.max(read.y1, box.y1) },
          jump,
        );
      } else jump = jumpOf(level, world, moves, from, to, undefined, t.found);
    }
    if (jump) out.push(jump);
  }
  return out;
}

function tightAlong(level: Level, route: readonly number[], t: Traced, cache?: JumpCache): RoutePrecision {
  const jumps = jumpsAlong(level, route, t, cache);
  return { jumps: jumps.length, tight: jumps.filter((j) => j.tight).length };
}

/** How many of the jumps along `route` (stand cells, spawn first) some slip turns into a fall. */
export function routePrecision(level: Level, route: readonly number[], bridges: readonly BridgeHint[] = [], cache?: JumpCache): RoutePrecision {
  return tightAlong(level, route, traced(level, bridges), cache);
}

/** Tight jumps on the level's more forgiving route: what a player who picks the safe way still has to land. */
export function levelPrecision(level: Level, routes: Routes, bridges: readonly BridgeHint[] = [], cache?: JumpCache): number {
  const t = traced(level, bridges);
  const fast = tightAlong(level, routes.fastest, t, cache).tight;
  if (!fast || !routes.alternative.length) return fast;
  return Math.min(fast, tightAlong(level, routes.alternative, t, cache).tight);
}
