import { TILE } from '../../sim/constants';
import { type Level, offMap, T_SOLID } from '../../sim/level';
import { type Body, type CollisionWorld, type Controls, createBody, stepBody } from '../../sim/physics';
import { movesOn } from '../../sim/reach';
import { groundSurfaceAt } from '../../sim/ground';
import { footing } from '../../sim/weather';
import type { Routes } from './routes';
import { type Stretch, stretchAt } from './difficulty';
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

/** Every jump along `route` (stand cells, spawn first), in order: the moves a slip can cost, where they are. */
export function routeJumps(level: Level, route: readonly number[], bridges: readonly BridgeHint[] = []): RouteJump[] {
  const tiles = withBridges(level, bridges);
  const world = worldOf(level, tiles);
  const moves = movesOn({ ...level, tiles });
  const out: RouteJump[] = [];
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    const body = standing(level, world, from);
    let move: Controls[] | null = null;
    for (const m of moves(body)) if (m.to === to && m.air && (!move || m.controls.length < move.length)) move = m.controls;
    if (!move) continue;
    const tight = SLIPS.some((kind) => {
      const c = slip(move, kind);
      return !!c && falls(level, world, body, c);
    });
    out.push({ row: Math.floor(from / level.w), tight });
  }
  return out;
}

/** How many of the jumps along `route` (stand cells, spawn first) some slip turns into a fall. */
export function routePrecision(level: Level, route: readonly number[], bridges: readonly BridgeHint[] = []): RoutePrecision {
  const jumps = routeJumps(level, route, bridges);
  return { jumps: jumps.length, tight: jumps.filter((j) => j.tight).length };
}

/**
 * Tight jumps per stretch (./difficulty.ts `Stretch`) on the level's more forgiving route, stretch by stretch: a
 * player takes the forgiving way through each. A race level is one stretch, so this is `levelPrecision` in a list.
 * Rows climbed count from the spawn's floor.
 */
export function stretchPrecision(level: Level, routes: Routes, stretches: readonly Stretch[], bridges: readonly BridgeHint[] = []): number[] {
  const floor = level.spawn.ty;
  const count = (route: readonly number[]) => {
    const n = stretches.map(() => 0);
    for (const j of routeJumps(level, route, bridges)) if (j.tight) n[stretches.indexOf(stretchAt(stretches, floor - j.row))]++;
    return n;
  };
  const fast = count(routes.fastest);
  if (!routes.alternative.length) return fast;
  const alt = count(routes.alternative);
  return fast.map((x, i) => Math.min(x, alt[i]));
}

/** Tight jumps on the level's more forgiving route: what a player who picks the safe way still has to land. */
export function levelPrecision(level: Level, routes: Routes, bridges: readonly BridgeHint[] = []): number {
  const fast = routePrecision(level, routes.fastest, bridges).tight;
  if (!fast || !routes.alternative.length) return fast;
  return Math.min(fast, routePrecision(level, routes.alternative, bridges).tight);
}
