import { TILE } from '../../sim/constants';
import { type Level, T_SOLID } from '../../sim/level';
import { type Body, type CollisionWorld, type Controls, createBody, stepBody } from '../../sim/physics';
import { movesOn } from '../../sim/reach';
import { groundSurfaceAt } from '../../sim/ground';
import { footing } from '../../sim/weather';
import type { Routes } from './routes';
import { BRIDGE_W, type BridgeHint } from './types';

/**
 * How much precision a route asks, measured the way people miss: for each
 * jump on it, replay the controller's own move a little wrong (letting go of
 * jump early, jumping a beat late or early, running on after landing) and
 * see whether that still lands or falls out of the level. A jump no slip
 * forgives is a tight one. Bots only ever come up short (src/brain/motor.ts
 * `slipped`), so a perch you'd run straight off looks safe to them; this
 * counts the overshoot too.
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
    solids: [],
    gravity: level.gravity ?? 1,
    ...(tileSurface ? { tileSurface } : {}),
    ...(surfaceAt ? { surfaceAt } : {}),
  };
}

/** True if `controls` from `body`, then letting go, ends with the body out of the bottom of the level. */
function falls(level: Level, world: CollisionWorld, body: Body, controls: readonly Controls[]): boolean {
  const b = { ...body };
  const out = level.h * TILE;
  for (const c of controls) {
    stepBody(b, c, world);
    if (b.y > out) return true;
  }
  for (let f = 0; f < SETTLE && !b.onGround; f++) {
    stepBody(b, NONE, world);
    if (b.y > out) return true;
  }
  return false;
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

/** How many of the jumps along `route` (stand cells, spawn first) some slip turns into a fall. */
export function routePrecision(level: Level, route: readonly number[], bridges: readonly BridgeHint[] = []): RoutePrecision {
  const tiles = withBridges(level, bridges);
  const world = worldOf(level, tiles);
  const moves = movesOn({ ...level, tiles });
  let jumps = 0;
  let tight = 0;
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    const body = standing(level, world, from);
    let move: Controls[] | null = null;
    for (const m of moves(body)) if (m.to === to && m.air && (!move || m.controls.length < move.length)) move = m.controls;
    if (!move) continue;
    jumps++;
    for (const kind of ['short', 'late', 'early', 'long'] as const) {
      const c = slip(move, kind);
      if (c && falls(level, world, body, c)) {
        tight++;
        break;
      }
    }
  }
  return { jumps, tight };
}

/** Tight jumps on the level's more forgiving route: what a player who picks the safe way still has to land. */
export function levelPrecision(level: Level, routes: Routes, bridges: readonly BridgeHint[] = []): number {
  const fast = routePrecision(level, routes.fastest, bridges).tight;
  if (!fast || !routes.alternative.length) return fast;
  return Math.min(fast, routePrecision(level, routes.alternative, bridges).tight);
}
