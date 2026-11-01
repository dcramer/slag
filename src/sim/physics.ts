import { approach, overlaps, type Rect } from '../core/geom';
import { DT, PHYS, PLAYER_H, PLAYER_W, TILE } from './constants';

export interface Surface {
  /** Multiplier on ground acceleration (ice < 1). */
  friction: number;
  /** Belt speed in px/s added to ground movement. */
  conveyor: number;
  speedMult: number;
  jumpMult: number;
  /** Restitution when landing hard (jelly). */
  bounce: number;
}

export const DEFAULT_SURFACE: Surface = { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1, bounce: 0 };

export interface Solid extends Rect {
  /** Stable across frames so a standing body can be carried by it. Tiles use TILE_SOLID_ID. */
  id: number;
  /** Movement since the previous frame (moving platforms). */
  dx: number;
  dy: number;
  surface: Surface;
  /** Owning placed prop uid, or -1 for terrain. */
  propUid: number;
  /** Index of the owning module within the prop, or -1. */
  mi: number;
}

export const TILE_SOLID_ID = -2;

export interface CollisionWorld {
  /** 1 = solid. Must treat x outside the level as solid walls, y outside as empty. */
  tileAt(tx: number, ty: number): number;
  solids: readonly Solid[];
}

export interface Body extends Rect {
  vx: number;
  vy: number;
  onGround: boolean;
  groundRef: number;
  surface: Surface;
  coyote: number;
  jumpBuffer: number;
  jumping: boolean;
  wallDir: -1 | 0 | 1;
  wallLock: number;
  facing: -1 | 1;
}

export interface Controls {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
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
    wallLock: 0,
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

/** First solid overlapping `r`, tiles first. The returned tile object is reused; copy if you keep it. */
export function firstOverlap(r: Rect, world: CollisionWorld, dynamicOnly = false): Solid | null {
  if (!dynamicOnly) {
    const x0 = Math.floor(r.x / TILE);
    const x1 = Math.floor((r.x + r.w - 1e-3) / TILE);
    const y0 = Math.floor(r.y / TILE);
    const y1 = Math.floor((r.y + r.h - 1e-3) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (world.tileAt(tx, ty)) {
          tileScratch.x = tx * TILE;
          tileScratch.y = ty * TILE;
          if (overlaps(r, tileScratch)) return tileScratch;
        }
      }
    }
  }
  for (const s of world.solids) if (overlaps(r, s)) return s;
  return null;
}

/** Move along x, stopping at solids. Returns the solid hit, if any. */
function moveX(b: Body, dx: number, world: CollisionWorld): Solid | null {
  if (dx === 0) return null;
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 4));
  const sx = dx / steps;
  for (let i = 0; i < steps; i++) {
    b.x += sx;
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

function moveY(b: Body, dy: number, world: CollisionWorld): Solid | null {
  if (dy === 0) return null;
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 4));
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    b.y += sy;
    let hit: Solid | null = null;
    for (let k = 0; k < 4; k++) {
      const s = firstOverlap(b, world);
      if (!s) break;
      hit = s;
      b.y = sy > 0 ? s.y - b.h : s.y + s.h;
    }
    if (hit) return hit;
  }
  return null;
}

/** Push the body out of any dynamic solid that moved into it. Returns false if it can't escape (crushed). */
function depenetrate(b: Body, world: CollisionWorld): boolean {
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

/**
 * Advance one body one fixed step. Deterministic given (body, controls, world).
 * Returns false if the body was crushed.
 */
export function stepBody(b: Body, c: Controls, world: CollisionWorld): boolean {
  // Ride whatever we were standing on.
  if (b.groundRef >= 0) {
    const s = findSolid(world, b.groundRef);
    if (s) {
      moveX(b, s.dx, world);
      if (s.dy !== 0) {
        // Move up freely; moving down we snap to the platform below.
        moveY(b, s.dy, world);
      }
    }
  }
  if (!depenetrate(b, world)) return false;

  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  if (dir !== 0) b.facing = dir > 0 ? 1 : -1;

  if (c.jumpPressed) b.jumpBuffer = PHYS.jumpBufferFrames;
  else if (b.jumpBuffer > 0) b.jumpBuffer--;
  if (b.onGround) b.coyote = PHYS.coyoteFrames;
  else if (b.coyote > 0) b.coyote--;

  // Horizontal.
  const surf = b.onGround ? b.surface : DEFAULT_SURFACE;
  const target = dir * PHYS.runSpeed * surf.speedMult + (b.onGround ? surf.conveyor : 0);
  let accel = b.onGround ? (dir !== 0 ? PHYS.groundAccel : PHYS.groundDecel) * surf.friction : dir !== 0 ? PHYS.airAccel : PHYS.airDecel;
  if (b.wallLock > 0) {
    b.wallLock--;
    accel *= 0.15;
  }
  b.vx = approach(b.vx, target, accel * DT);

  // Vertical.
  b.vy += PHYS.gravity * (b.vy > 0 ? PHYS.fallGravityMult : 1) * DT;
  if (!b.onGround && b.wallDir !== 0 && dir === b.wallDir && b.vy > PHYS.wallSlideMax) {
    b.vy = PHYS.wallSlideMax;
  }
  if (b.vy > PHYS.maxFall) b.vy = PHYS.maxFall;

  if (b.jumpBuffer > 0) {
    if (b.coyote > 0) {
      b.vy = -PHYS.jumpVel * b.surface.jumpMult;
      b.jumpBuffer = 0;
      b.coyote = 0;
      b.jumping = true;
      b.onGround = false;
    } else if (b.wallDir !== 0) {
      b.vy = -PHYS.wallJumpVy;
      b.vx = -b.wallDir * PHYS.wallJumpVx;
      b.facing = b.wallDir > 0 ? -1 : 1;
      b.wallLock = PHYS.wallJumpLockFrames;
      b.jumpBuffer = 0;
      b.jumping = true;
    }
  }
  if (b.jumping && !c.jump && b.vy < 0) {
    b.vy *= PHYS.jumpCutMult;
    b.jumping = false;
  }
  if (b.vy >= 0) b.jumping = false;

  // Integrate.
  if (moveX(b, b.vx * DT, world)) b.vx = 0;
  const hitY = moveY(b, b.vy * DT, world);
  if (hitY && b.vy > 0 && hitY.surface.bounce > 0 && b.vy > 140) {
    b.vy = -b.vy * hitY.surface.bounce;
    b.onGround = false;
    b.groundRef = -1;
    b.jumping = false;
  } else if (hitY && b.vy > 0) {
    b.onGround = true;
    b.groundRef = hitY.id;
    b.surface = hitY.surface;
    b.vy = 0;
  } else {
    if (hitY && b.vy < 0) {
      b.vy = 0;
      b.jumping = false;
    }
    b.onGround = false;
    b.groundRef = -1;
  }

  // Wall contact (air only).
  b.wallDir = 0;
  if (!b.onGround) {
    const probe = { x: b.x - 1, y: b.y + 2, w: 1, h: b.h - 4 };
    if (firstOverlap(probe, world)) b.wallDir = -1;
    else {
      probe.x = b.x + b.w;
      if (firstOverlap(probe, world)) b.wallDir = 1;
    }
  }
  return true;
}
