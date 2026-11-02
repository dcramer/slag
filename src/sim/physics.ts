import { approach as approachImport, overlaps as overlapsImport, type Rect } from '../core/geom';
import { DT as DT_IMPORT, PHYS as PHYS_IMPORT, PLAYER_H, PLAYER_W, TILE as TILE_IMPORT } from './constants';
import { T_EMPTY as T_EMPTY_IMPORT, T_ONEWAY as T_ONEWAY_IMPORT } from './level';
import { WIND, type WindForce, windGravityScale, windPushY } from './wind';

// Hot-path imports rebound to module locals: under vitest (vite SSR transform)
// every access to an imported binding becomes a namespace getter call, which
// made physics-heavy tests (reach / levelgen) several times slower.
const approach = approachImport;
const overlaps = overlapsImport;
const DT = DT_IMPORT;
const PHYS = PHYS_IMPORT;
const TILE = TILE_IMPORT;
const T_EMPTY = T_EMPTY_IMPORT;
const T_ONEWAY = T_ONEWAY_IMPORT;

/**
 * Player controller + collision. Pure and deterministic: a body's next state
 * depends only on (body, controls, world). No transcendental math, so it stays
 * bit-identical across platforms for future lockstep/rollback netcode.
 *
 * Verbs: run (snappy accel/turn), variable jump with apex hang, heavy fall,
 * fast-fall (down in air), wall slide / wall jump (+ wall coyote), coyote time,
 * jump buffering, corner correction, ledge-lip pop, one-way platforms
 * (land from above only; down + jump drops through).
 */

/** How a wall surface reacts to sliding / wall jumping. */
export type WallKind = 'normal' | 'slick' | 'sticky';

export interface Surface {
  /** Multiplier on ground acceleration (ice < 1). */
  friction: number;
  /** Belt speed in px/s added to ground movement. */
  conveyor: number;
  speedMult: number;
  jumpMult: number;
  /** Restitution when landing hard (jelly). */
  bounce: number;
  /**
   * Wall behavior when touched from the side. Optional; when absent it is
   * derived: friction < 0.3 → 'slick' (no slide cap, no wall jump),
   * speedMult < 0.7 → 'sticky' (slow cling slide, weaker wall jump).
   */
  wall?: WallKind;
}

export const DEFAULT_SURFACE: Surface = { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1, bounce: 0 };

/** Resolve a surface's wall behavior (explicit field, else derived from its ground params). */
export function wallKind(s: Surface): WallKind {
  if (s.wall) return s.wall;
  if (s.friction < 0.3) return 'slick';
  if (s.speedMult < 0.7) return 'sticky';
  return 'normal';
}

export interface Solid extends Rect {
  /** Stable across frames so a standing body can be carried by it. Tiles use TILE_SOLID_ID / TILE_ONEWAY_ID. */
  id: number;
  /** Movement since the previous frame (moving platforms). */
  dx: number;
  dy: number;
  surface: Surface;
  /** Owning placed prop uid, or -1 for terrain. */
  propUid: number;
  /** Index of the owning module within the prop, or -1. */
  mi: number;
  /** Lands from above only, like a one-way tile: it never blocks sideways or from below, and can't pin or crush anyone. */
  oneWay?: boolean;
}

export const TILE_SOLID_ID = -2;
/** groundRef while standing on a one-way tile. */
export const TILE_ONEWAY_ID = -3;

export interface CollisionWorld {
  /** Tile kind (T_EMPTY/T_SOLID/T_ONEWAY). Must treat x outside the level as solid walls, y outside as empty. */
  tileAt(tx: number, ty: number): number;
  solids: readonly Solid[];
  /**
   * World gravity scale (Level.gravity; default 1). Scales gravity (and so
   * the apex/fall/fast-fall multipliers built on it); terminal speeds scale
   * with its square root so falls keep their weight. Jump take-off speeds
   * are unchanged, so low gravity jumps higher and longer, high lower and shorter.
   */
  gravity?: number;
  /**
   * Optional: a box in px, on tile edges, that the owner promises has no tiles
   * in it. Collision fills it with the last all-empty box it read and skips
   * reads inside it, so reachability tracing doesn't re-read the air around a
   * falling body. The owner resets it (x0 > x1) whenever the tiles might have changed.
   */
  clear?: { x0: number; y0: number; x1: number; y1: number };
}

/** Plain data only (snapshot-friendly). */
export interface Body extends Rect {
  vx: number;
  vy: number;
  onGround: boolean;
  groundRef: number;
  surface: Surface;
  coyote: number;
  jumpBuffer: number;
  /** True from a jump's take-off until landing or releasing the button (variable height, apex hang). */
  jumping: boolean;
  /** Wall currently touched in the air (-1 left, 1 right). */
  wallDir: -1 | 0 | 1;
  /** Surface of the touched wall (tiles: DEFAULT_SURFACE). */
  wallSurface: Surface;
  /** Frames left to wall-jump off `wallCoyoteDir` after leaving it. */
  wallCoyote: number;
  wallCoyoteDir: -1 | 0 | 1;
  wallCoyoteSurface: Surface;
  wallLock: number;
  /** Same-side wall-jump cooldown and the side it applies to. */
  wallJumpCd: number;
  wallJumpSide: -1 | 0 | 1;
  /** Total wall jumps performed (for fx/analysis; monotonic). */
  wallJumps: number;
  /** Frames left ignoring one-way tiles (drop-through). */
  dropFrames: number;
  facing: -1 | 1;
}

export interface Controls {
  left: boolean;
  right: boolean;
  /** Fast-fall in the air; with jump on a one-way platform, drop through. Optional for callers that don't care. */
  down?: boolean;
  jump: boolean;
  jumpPressed: boolean;
  /** Held: run (faster top speed, more momentum) instead of walk. */
  run?: boolean;
}

export function createBody(x: number, y: number): Body {
  return {
    x,
    y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    groundRef: -1,
    surface: DEFAULT_SURFACE,
    coyote: 0,
    jumpBuffer: 0,
    jumping: false,
    wallDir: 0,
    wallSurface: DEFAULT_SURFACE,
    wallCoyote: 0,
    wallCoyoteDir: 0,
    wallCoyoteSurface: DEFAULT_SURFACE,
    wallLock: 0,
    wallJumpCd: 0,
    wallJumpSide: 0,
    wallJumps: 0,
    dropFrames: 0,
    facing: 1,
  };
}

/** Place a body standing on top of the tile below cell (tx, ty), centered horizontally. */
export function bodyAtCell(tx: number, ty: number, offsetX = 0): Body {
  const b = createBody(tx * TILE + (TILE - PLAYER_W) / 2 + offsetX, (ty + 1) * TILE - PLAYER_H);
  b.onGround = true;
  b.groundRef = TILE_SOLID_ID;
  return b;
}

const tileScratch: Solid = {
  x: 0,
  y: 0,
  w: TILE,
  h: TILE,
  id: TILE_SOLID_ID,
  dx: 0,
  dy: 0,
  surface: DEFAULT_SURFACE,
  propUid: -1,
  mi: -1,
};

const NO_ONEWAY = Number.POSITIVE_INFINITY;

/**
 * First solid overlapping `r`, tiles first. The returned tile object is reused; copy if you keep it.
 * One-way tiles and solids only count when their top is at or below `oneWayFrom` (the feet height
 * before a downward move); by default they never block.
 */
export function firstOverlap(r: Rect, world: CollisionWorld, dynamicOnly = false, oneWayFrom = NO_ONEWAY): Solid | null {
  const clear = world.clear;
  if (!dynamicOnly && (!clear || r.x < clear.x0 || r.x + r.w - 1e-3 >= clear.x1 || r.y < clear.y0 || r.y + r.h - 1e-3 >= clear.y1)) {
    const x0 = Math.floor(r.x / TILE);
    const x1 = Math.floor((r.x + r.w - 1e-3) / TILE);
    const y0 = Math.floor(r.y / TILE);
    const y1 = Math.floor((r.y + r.h - 1e-3) / TILE);
    {
      let empty = true;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const k = world.tileAt(tx, ty);
          if (k === T_EMPTY) continue;
          empty = false;
          if (k === T_ONEWAY && ty * TILE < oneWayFrom - 0.01) continue;
          tileScratch.x = tx * TILE;
          tileScratch.y = ty * TILE;
          tileScratch.id = k === T_ONEWAY ? TILE_ONEWAY_ID : TILE_SOLID_ID;
          if (overlaps(r, tileScratch)) return tileScratch;
        }
      }
      if (empty && clear) {
        clear.x0 = x0 * TILE;
        clear.y0 = y0 * TILE;
        clear.x1 = (x1 + 1) * TILE;
        clear.y1 = (y1 + 1) * TILE;
      }
    }
  }
  const solids = world.solids;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (s.oneWay && s.y < oneWayFrom - 0.01) continue;
    if (overlaps(r, s)) return s;
  }
  return null;
}

function blockedAt(b: Body, x: number, y: number, world: CollisionWorld): boolean {
  const ox = b.x;
  const oy = b.y;
  b.x = x;
  b.y = y;
  const hit = firstOverlap(b, world) !== null;
  b.x = ox;
  b.y = oy;
  return hit;
}

/** Move along x, stopping at solids (one-ways never block sideways). Pops up small ledge lips. Returns the solid hit. */
function moveX(b: Body, dx: number, world: CollisionWorld): Solid | null {
  if (dx === 0) return null;
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 4));
  const sx = dx / steps;
  for (let i = 0; i < steps; i++) {
    b.x += sx;
    const s0 = firstOverlap(b, world);
    if (!s0) continue;
    // Ledge lip: a step whose top is ≤ ledgeLip px above our feet is climbed instead of blocking.
    // (Tiles are scanned top row first, so s0 is the highest blocking tile.)
    const lip = b.y + b.h - s0.y;
    if (lip > 0 && lip <= PHYS.ledgeLip && !blockedAt(b, b.x, s0.y - b.h, world)) {
      b.y = s0.y - b.h;
      continue;
    }
    let hit: Solid | null = null;
    for (let k = 0; k < 4; k++) {
      const s = firstOverlap(b, world);
      if (!s) break;
      hit = s;
      b.x = sx > 0 ? s.x - b.w : s.x + s.w;
    }
    if (hit) return hit;
  }
  return null;
}

/** Move along y. Falling lands on one-ways the feet started above; rising nudges around ceiling corners. */
function moveY(b: Body, dy: number, world: CollisionWorld): Solid | null {
  if (dy === 0) return null;
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 4));
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    const oneWayFrom = sy > 0 && b.dropFrames === 0 ? b.y + b.h : NO_ONEWAY;
    b.y += sy;
    const s0 = firstOverlap(b, world, false, oneWayFrom);
    if (!s0) continue;
    if (sy < 0 && cornerNudge(b, s0, world)) continue;
    let hit: Solid | null = null;
    for (let k = 0; k < 4; k++) {
      const s = firstOverlap(b, world, false, oneWayFrom);
      if (!s) break;
      hit = s;
      b.y = sy > 0 ? s.y - b.h : s.y + s.h;
    }
    if (hit) return hit;
  }
  return null;
}

/** Head bumped `s`: slide up to cornerCorrect px sideways (toward the nearer free side first) if that clears it. */
function cornerNudge(b: Body, s: Solid, world: CollisionWorld): boolean {
  const first = b.x + b.w / 2 < s.x + s.w / 2 ? -1 : 1;
  for (let d = 1; d <= PHYS.cornerCorrect; d++) {
    for (const sgn of [first, -first]) {
      if (!blockedAt(b, b.x + sgn * d, b.y, world)) {
        b.x += sgn * d;
        return true;
      }
    }
  }
  return false;
}

/** Push the body out of any dynamic solid that moved into it. Returns false if it can't escape (crushed). */
function depenetrate(b: Body, world: CollisionWorld): boolean {
  if (world.solids.length === 0) return true;
  for (let iter = 0; iter < 3; iter++) {
    const s = firstOverlap(b, world, true);
    if (!s) return true;
    const pushL = b.x + b.w - s.x;
    const pushR = s.x + s.w - b.x;
    const pushU = b.y + b.h - s.y;
    const pushD = s.y + s.h - b.y;
    const m = Math.min(pushL, pushR, pushU, pushD);
    if (m === pushU) b.y -= pushU;
    else if (m === pushD) b.y += pushD;
    else if (m === pushL) b.x -= pushL;
    else b.x += pushR;
  }
  return !firstOverlap(b, world);
}

function findSolid(world: CollisionWorld, id: number): Solid | undefined {
  for (const s of world.solids) if (s.id === id) return s;
  return undefined;
}

const probe: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Solid wall (tile or prop) within wallProbe px on side `side`, ignoring floor/ceiling edges. */
function wallAt(b: Body, side: -1 | 1, world: CollisionWorld): Solid | null {
  probe.x = side < 0 ? b.x - PHYS.wallProbe : b.x + b.w;
  probe.y = b.y + 2;
  probe.w = PHYS.wallProbe;
  probe.h = b.h - 4;
  return firstOverlap(probe, world);
}

/** Standing only on one-ways (nothing solid under the feet), so a drop-through is possible. */
function onOneWayOnly(b: Body, world: CollisionWorld): boolean {
  if (b.groundRef !== TILE_ONEWAY_ID && !(b.groundRef >= 0 && findSolid(world, b.groundRef)?.oneWay)) return false;
  probe.x = b.x;
  probe.y = b.y + b.h;
  probe.w = b.w;
  probe.h = 1;
  return firstOverlap(probe, world) === null;
}

function horizontalAccel(b: Body, dir: number, top: number, surf: Surface): number {
  const vRel = b.vx - (b.onGround ? surf.conveyor : 0);
  const reversing = dir !== 0 && vRel * dir < 0;
  // "Momentum" = moving faster than a walk: decel/turns skid instead of snapping.
  // (Unscaled by surface speed so sticky goo still stops you quickly.)
  const momentum = Math.abs(vRel) > PHYS.walkSpeed + 1;
  if (b.onGround) {
    let a: number;
    if (dir === 0) a = momentum ? PHYS.runDecel : PHYS.groundDecel;
    else if (reversing) a = momentum ? PHYS.runTurnAccel : PHYS.groundTurnAccel;
    else if (vRel * dir > top) a = PHYS.runDecel; // let go of run: ease back down to a walk
    else a = momentum ? PHYS.runAccel : PHYS.groundAccel;
    return a * surf.friction;
  }
  if (dir === 0) return PHYS.airDecel;
  if (reversing) return PHYS.airTurnAccel;
  if (b.vx * dir > top) return PHYS.airOverspeedDecel;
  return PHYS.airAccel;
}

/** Can we wall-jump off side `dir` with surface `surf` right now? */
function canWallJump(b: Body, dir: number, surf: Surface): boolean {
  return dir !== 0 && wallKind(surf) !== 'slick' && !(b.wallJumpCd > 0 && b.wallJumpSide === dir);
}

/**
 * Wall jump off the wall on side `dir`. The kick depends on the held input
 * (`held`): into the wall = near-vertical (climb a single wall by tapping
 * jump); neutral = moderate; away = strong. Into-wall jumps aren't cut by
 * releasing jump, so mashing still climbs.
 */
function wallJump(b: Body, dir: -1 | 1, surf: Surface, held: number): void {
  const k = wallKind(surf) === 'sticky' ? PHYS.stickyWallJumpMult : 1;
  const into = held === dir;
  const vx = into ? PHYS.wallJumpVxInto : held === 0 ? PHYS.wallJumpVxNeutral : PHYS.wallJumpVxAway;
  b.vy = -PHYS.wallJumpVy * k;
  b.vx = -dir * vx * k;
  if (!into) b.facing = dir > 0 ? -1 : 1;
  b.wallLock = into ? PHYS.wallJumpLockFramesInto : PHYS.wallJumpLockFrames;
  b.wallJumpCd = PHYS.wallJumpCooldownFrames;
  b.wallJumpSide = dir;
  b.wallJumps++;
  b.jumpBuffer = 0;
  b.wallCoyote = 0;
  b.wallDir = 0;
  b.jumping = !into;
}

/**
 * Advance one body one fixed step. Deterministic given (body, controls, world, wind).
 * `wind` (see sim/wind.ts) is the air this body is in this frame, if any.
 * Returns false if the body was crushed.
 */
export function stepBody(b: Body, c: Controls, world: CollisionWorld, wind: WindForce | null = null): boolean {
  // Ride whatever we were standing on.
  if (b.groundRef >= 0) {
    const s = findSolid(world, b.groundRef);
    if (s) {
      // The platform has already moved. If it rose, the rider now overlaps it, so lift
      // first; otherwise a sideways move would collide with the platform itself and
      // shove the rider off (diagonal movers: rotors, pendulums, loops).
      if (s.dy < 0) {
        moveY(b, s.dy, world);
        moveX(b, s.dx, world);
      } else {
        moveX(b, s.dx, world);
        // Moving down we snap to the platform below.
        if (s.dy !== 0) moveY(b, s.dy, world);
      }
    }
  }
  if (!depenetrate(b, world)) return false;

  const down = !!c.down;
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  if (dir !== 0) b.facing = dir > 0 ? 1 : -1;
  if (b.dropFrames > 0) b.dropFrames--;
  if (b.wallJumpCd > 0) b.wallJumpCd--;

  if (c.jumpPressed) b.jumpBuffer = PHYS.jumpBufferFrames;
  else if (b.jumpBuffer > 0) b.jumpBuffer--;
  if (b.onGround) b.coyote = PHYS.coyoteFrames;
  else if (b.coyote > 0) b.coyote--;

  // Horizontal. In a side wind the controller steers relative to the moving air.
  const airVx = wind ? wind.vx : 0;
  b.vx -= airVx;
  const surf = b.onGround ? b.surface : DEFAULT_SURFACE;
  const top = (c.run ? PHYS.runSpeed : PHYS.walkSpeed) * surf.speedMult;
  const target = dir * top + (b.onGround ? surf.conveyor : 0);
  let accel = horizontalAccel(b, dir, top, surf);
  if (b.wallLock > 0) {
    b.wallLock--;
    accel *= PHYS.wallJumpLockAccelMult;
  }
  if (airVx !== 0 && dir === 0 && accel < WIND.grip) accel = WIND.grip;
  b.vx = approach(b.vx, target, accel * DT) + airVx;

  // Vertical.
  const gs = world.gravity ?? 1;
  const fallK = gs === 1 ? 1 : Math.sqrt(gs);
  let g = PHYS.gravity * gs;
  let maxFall: number = PHYS.maxFall * fallK;
  const air = !b.onGround;
  if (air && down && b.vy > -PHYS.apexVelBand) {
    g *= PHYS.fallGravityMult * PHYS.fastFallGravityMult;
    maxFall = PHYS.fastFallMax * fallK;
  } else if (air && b.jumping && c.jump && b.vy > -PHYS.apexVelBand && b.vy < PHYS.apexVelBand) g *= PHYS.apexGravityMult;
  else if (b.vy > 0) g *= PHYS.fallGravityMult;
  b.vy += g * (wind ? windGravityScale(b.vy, wind) : 1) * DT;
  if (air && b.wallDir !== 0 && dir === b.wallDir && !down) {
    const kind = wallKind(b.wallSurface);
    const cap = kind === 'sticky' ? PHYS.wallStickySlideMax : kind === 'normal' ? PHYS.wallSlideMax : maxFall;
    if (b.vy > cap) b.vy = cap;
  }
  if (b.vy > maxFall) b.vy = maxFall;

  // Jumps: ground (incl. coyote) > drop-through > wall (incl. wall coyote).
  if (b.jumpBuffer > 0) {
    if (b.coyote > 0 && down && b.onGround && onOneWayOnly(b, world)) {
      b.dropFrames = PHYS.dropFrames;
      b.jumpBuffer = 0;
      b.coyote = 0;
      b.onGround = false;
      b.groundRef = -1;
    } else if (b.coyote > 0) {
      b.vy = -PHYS.jumpVel * b.surface.jumpMult;
      b.jumpBuffer = 0;
      b.coyote = 0;
      b.jumping = true;
      b.onGround = false;
    } else if (b.wallDir !== 0 && canWallJump(b, b.wallDir, b.wallSurface)) {
      wallJump(b, b.wallDir, b.wallSurface, dir);
    } else if (b.wallCoyote > 0 && canWallJump(b, b.wallCoyoteDir, b.wallCoyoteSurface)) {
      wallJump(b, b.wallCoyoteDir as -1 | 1, b.wallCoyoteSurface, dir);
    }
  }
  // Variable height: letting go clamps the rise.
  if (b.jumping && !c.jump) {
    if (b.vy < -PHYS.jumpCutVel) b.vy = -PHYS.jumpCutVel;
    b.jumping = false;
  }
  if (wind) windPushY(b, wind, g);

  // Integrate.
  if (moveX(b, b.vx * DT, world)) b.vx = 0;
  const hitY = moveY(b, b.vy * DT, world);
  if (hitY && b.vy > 0 && hitY.surface.bounce > 0 && b.vy > PHYS.bounceMinVy) {
    b.vy = -b.vy * hitY.surface.bounce;
    b.onGround = false;
    b.groundRef = -1;
    b.jumping = false;
  } else if (hitY && b.vy > 0) {
    b.onGround = true;
    b.groundRef = hitY.id;
    b.surface = hitY.surface;
    b.vy = 0;
    b.jumping = false;
    b.wallCoyote = 0;
    b.wallJumpCd = 0;
  } else {
    if (hitY && b.vy < 0) {
      b.vy = 0;
      b.jumping = false;
    }
    b.onGround = false;
    b.groundRef = -1;
  }

  // Wall contact (air only). Prefer the side we're pressing toward.
  b.wallDir = 0;
  if (!b.onGround) {
    const pref: -1 | 1 = dir !== 0 ? (dir > 0 ? 1 : -1) : b.facing;
    let w = wallAt(b, pref, world);
    if (w) b.wallDir = pref;
    else {
      w = wallAt(b, pref > 0 ? -1 : 1, world);
      if (w) b.wallDir = pref > 0 ? -1 : 1;
    }
    if (w) {
      b.wallSurface = w.surface;
      b.wallCoyote = PHYS.wallCoyoteFrames;
      b.wallCoyoteDir = b.wallDir;
      b.wallCoyoteSurface = w.surface;
    } else if (b.wallCoyote > 0) b.wallCoyote--;
  }
  return true;
}

export interface JumpMetrics {
  /** Ground top speed, tiles/s. */
  runSpeed: number;
  /** Seconds from standstill to top speed. */
  accelTime: number;
  /** Seconds from top speed to standstill with no input. */
  stopTime: number;
  /** Seconds from top speed one way to top speed the other. */
  turnTime: number;
  /** Peak rise of a held standing jump, tiles. */
  jumpHeight: number;
  /** Peak rise when jump is tapped for a single frame, tiles. */
  shortHopHeight: number;
  /** Horizontal distance of a held jump from a running start, take-off to landing at the same height, tiles. */
  jumpDistance: number;
  /** Walk top speed, tiles/s. */
  walkSpeed: number;
  /** Held jump from a walking start, tiles. */
  walkJumpDistance: number;
  /** Frames in the air for a held standing jump. */
  jumpAirFrames: number;
  /** Terminal fall speed, normal and fast-fall, tiles/s. */
  fallSpeed: number;
  fastFallSpeed: number;
}

const metricsCache = new Map<number, JumpMetrics>();

/**
 * Measure the controller by simulating it on an open flat floor. Other
 * subsystems (props, AI, tuning tools) use this instead of re-deriving
 * numbers from PHYS. Level validity must still come from reach.ts.
 */
export function jumpMetrics(gravity = 1): JumpMetrics {
  const hit = metricsCache.get(gravity);
  if (hit) return { ...hit };
  const floorRow = 200;
  const world: CollisionWorld = { tileAt: (_x, y) => (y >= floorRow ? 1 : 0), solids: [], gravity };
  const C = (o: Partial<Controls>): Controls => ({ left: false, right: false, down: false, jump: false, jumpPressed: false, ...o });
  const top = PHYS.runSpeed;

  // Acceleration / stop / turn.
  let b = bodyAtCell(10, floorRow - 1);
  let f = 0;
  for (; b.vx < top && f < 600; f++) stepBody(b, C({ right: true, run: true }), world);
  const accelTime = f * DT;
  const runSpeed = b.vx / TILE;
  for (let i = 0; i < 30; i++) stepBody(b, C({ right: true, run: true }), world);
  f = 0;
  for (; b.vx > 0 && f < 600; f++) stepBody(b, C({}), world);
  const stopTime = f * DT;
  b.vx = top;
  f = 0;
  for (; b.vx > -top && f < 600; f++) stepBody(b, C({ left: true, run: true }), world);
  const turnTime = f * DT;

  const rise = (hold: number): { h: number; frames: number } => {
    const j = bodyAtCell(10, floorRow - 1);
    const y0 = j.y;
    let minY = y0;
    let n = 0;
    for (; n < 600; n++) {
      stepBody(j, C({ jump: n < hold, jumpPressed: n === 0 }), world);
      if (j.y < minY) minY = j.y;
      if (n > 0 && j.onGround) break;
    }
    return { h: (y0 - minY) / TILE, frames: n + 1 };
  };
  const full = rise(10_000);
  const hop = rise(1);

  // Jump distances from a running and a walking start.
  const leap = (run: boolean): number => {
    const l = bodyAtCell(10, floorRow - 1);
    l.vx = run ? top : PHYS.walkSpeed;
    const x0 = l.x;
    for (let n = 0; n < 600; n++) {
      stepBody(l, C({ right: true, run, jump: true, jumpPressed: n === 0 }), world);
      if (n > 0 && l.onGround) break;
    }
    return (l.x - x0) / TILE;
  };
  const jumpDistance = leap(true);
  const walkJumpDistance = leap(false);
  const walkB = bodyAtCell(10, floorRow - 1);
  for (let n = 0; n < 120; n++) stepBody(walkB, C({ right: true }), world);
  const walkSpeed = walkB.vx / TILE;

  const terminal = (down: boolean): number => {
    const t = createBody(0, 0);
    for (let n = 0; n < 240; n++) stepBody(t, C({ down }), { tileAt: () => 0, solids: [], gravity });
    return t.vy / TILE;
  };

  const m: JumpMetrics = {
    runSpeed,
    accelTime,
    stopTime,
    turnTime,
    jumpHeight: full.h,
    shortHopHeight: hop.h,
    jumpDistance,
    walkSpeed,
    walkJumpDistance,
    jumpAirFrames: full.frames,
    fallSpeed: terminal(false),
    fastFallSpeed: terminal(true),
  };
  metricsCache.set(gravity, m);
  return { ...m };
}
