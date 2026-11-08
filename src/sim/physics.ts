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
  /**
   * Belt speed in px/s along the face `beltFace`, running clockwise round the block for a positive
   * speed: rightward on a top, down a right face, leftward under a bottom, up a left face.
   */
  conveyor: number;
  /**
   * Which face carries the belt, in quarter turns clockwise from the top (0 top, 1 right, 2 bottom,
   * 3 left); absent means the top. Only contact with that face feels the belt: a top carries walkers,
   * a side drags a runner clinging to it up or down, a bottom shoves a head that bonks it sideways.
   */
  beltFace?: number;
  speedMult: number;
  jumpMult: number;
  /** Restitution when landing hard (jelly). */
  bounce: number;
  /**
   * Ground deceleration in px/s² when letting go, slowing to a walk or turning,
   * in place of the friction-scaled ones (ice). The usual decel is steep below
   * a walk, so friction alone stopped a walker on ice in a tile and a half;
   * one even skid slides a walk about 4 tiles and a run about 20.
   */
  skid?: number;
  /**
   * Wall behavior when touched from the side. Optional; when absent it is
   * derived: friction < 0.3 → 'slick' (no slide cap, no wall jump),
   * speedMult < 0.7 → 'sticky' (slow cling slide, weaker wall jump).
   */
  wall?: WallKind;
}

export const DEFAULT_SURFACE: Surface = { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1, bounce: 0 };

/** A belt's speed under the feet, px/s along +x: only a belt on the top face carries a walker. */
export function groundBelt(s: Surface): number {
  return s.conveyor !== 0 && (s.beltFace ?? 0) === 0 ? s.conveyor : 0;
}

/**
 * A belt's speed down a wall touched on side `side` of the body (+y is down): a wall on the body's
 * right is the block's left face (3), whose belt runs up for a positive speed; on its left, the
 * block's right face (1), which runs down.
 */
export function wallBelt(s: Surface, side: number): number {
  if (s.conveyor === 0) return 0;
  const f = s.beltFace ?? 0;
  if (side > 0 && f === 3) return -s.conveyor;
  if (side < 0 && f === 1) return s.conveyor;
  return 0;
}

/** A belt's speed along +x under a block (its bottom face runs leftward for a positive speed). */
export function ceilingBelt(s: Surface): number {
  return s.conveyor !== 0 && s.beltFace === 2 ? -s.conveyor : 0;
}

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
  /** Climbed like a ledge lip when its top is up to this many px above your feet (default PHYS.ledgeLip): a sub-tile step a part wants walked over, like a pipe's lip. */
  step?: number;
  /** A wet film on a surface (blood): footing for runners only. Rays, crushers and shots pass through to what's under it. */
  film?: boolean;
  /**
   * Made to crush (a crusher's head, which stops on whatever is under it): it pins a runner against a part
   * as hard as against the world. Every other mover passes through a runner it would pin against a part.
   */
  crush?: boolean;
}

export const TILE_SOLID_ID = -2;
/** groundRef while standing on a one-way tile. */
export const TILE_ONEWAY_ID = -3;

export interface CollisionWorld {
  /** Tile kind (T_EMPTY/T_SOLID/T_ONEWAY). Must treat x outside the level as solid walls, y outside as empty. */
  tileAt(tx: number, ty: number): number;
  solids: readonly Solid[];
  /** How terrain feels underfoot (weather's footing); default DEFAULT_SURFACE. Props keep their own surfaces. */
  tileSurface?: Surface;
  /** Footing per tile (a theme's own ground, sim/ground.ts). When set it answers for every tile instead of `tileSurface`. */
  surfaceAt?: (tx: number, ty: number) => Surface;
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
  /**
   * Level width in tiles. Past either side is open air: a runner can lean
   * out over the edge, and one that goes all the way off dies (`offMap`).
   * Unset, `tileAt` answers for every column.
   */
  cols?: number;
  /**
   * Optional: a bucket grid over `solids` (`solidGrid`), for a caller that
   * steps many bodies against one frame's solids (reach.ts tracing a bot's
   * moves). Read only while its `solids` is this world's.
   */
  grid?: SolidGrid;
}

/**
 * Solids bucketed by GRID_CELL px cells, so an overlap test reads the few
 * solids near a body instead of every one. `firstOverlap` answers exactly as
 * the plain scan does (the first overlapping solid in list order): each
 * bucket keeps its indices ascending and the lowest hit wins.
 */
export interface SolidGrid {
  readonly solids: readonly Solid[];
  readonly cells: Map<number, number[]>;
  /** Solids too big or too far out to bucket: tested every time. */
  readonly loose: number[];
}

const GRID_CELL = 64;
/** Cells a solid may span on either axis before it goes in `loose`. */
const GRID_SPAN = 64;
const GRID_BIAS = 2048;
const GRID_STRIDE = 4096;

const gridKey = (cx: number, cy: number) => (cy + GRID_BIAS) * GRID_STRIDE + cx + GRID_BIAS;

export function solidGrid(solids: readonly Solid[]): SolidGrid {
  const cells = new Map<number, number[]>();
  const loose: number[] = [];
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const cx0 = Math.floor(s.x / GRID_CELL);
    const cx1 = Math.floor((s.x + s.w) / GRID_CELL);
    const cy0 = Math.floor(s.y / GRID_CELL);
    const cy1 = Math.floor((s.y + s.h) / GRID_CELL);
    const inside = (v: number) => Number.isFinite(v) && Math.abs(v) < GRID_BIAS - GRID_SPAN;
    if (!inside(cx0) || !inside(cx1) || !inside(cy0) || !inside(cy1) || cx1 - cx0 > GRID_SPAN || cy1 - cy0 > GRID_SPAN) {
      loose.push(i);
      continue;
    }
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = gridKey(cx, cy);
        const list = cells.get(k);
        if (list) list.push(i);
        else cells.set(k, [i]);
      }
  }
  return { solids, cells, loose };
}

/** The lowest index in `list` below `best` whose solid blocks `r`, else `best`. */
function lowestHit(list: readonly number[], solids: readonly Solid[], r: Rect, oneWayFrom: number, best: number): number {
  for (let j = 0; j < list.length; j++) {
    const i = list[j];
    if (i >= best) return best;
    const s = solids[i];
    if (s.id === passing) continue;
    if (s.oneWay && s.y < oneWayFrom - 0.01) continue;
    if (overlaps(r, s)) return i;
  }
  return best;
}

function gridOverlap(r: Rect, grid: SolidGrid, oneWayFrom: number): Solid | null {
  const { solids, cells } = grid;
  let best = lowestHit(grid.loose, solids, r, oneWayFrom, solids.length);
  const cx0 = Math.floor(r.x / GRID_CELL);
  const cx1 = Math.floor((r.x + r.w) / GRID_CELL);
  const cy0 = Math.floor(r.y / GRID_CELL);
  const cy1 = Math.floor((r.y + r.h) / GRID_CELL);
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const list = cells.get(gridKey(cx, cy));
      if (list) best = lowestHit(list, solids, r, oneWayFrom, best);
    }
  return best < solids.length ? solids[best] : null;
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
  /**
   * A moving solid this body is passing through: one that would have pinned it
   * against a part rather than the world. Every overlap test skips it while the
   * body steps, until they're apart. Absent the rest of the time.
   */
  pass?: number;
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
    const cols = world.cols;
    const x0 = cols === undefined ? Math.floor(r.x / TILE) : Math.max(0, Math.floor(r.x / TILE));
    const x1 = cols === undefined ? Math.floor((r.x + r.w - 1e-3) / TILE) : Math.min(cols - 1, Math.floor((r.x + r.w - 1e-3) / TILE));
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
          tileScratch.surface = world.surfaceAt ? world.surfaceAt(tx, ty) : (world.tileSurface ?? DEFAULT_SURFACE);
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
  if (world.grid && world.grid.solids === solids) return gridOverlap(r, world.grid, oneWayFrom);
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (s.id === passing) continue;
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

/**
 * Move along x, stopping at solids (one-ways never block sideways). Pops up small ledge lips, at least `lip` px (a
 * knocked body's, `Knocked.lip`) where the solid asks for less. Returns the solid hit.
 */
export function moveX(b: Body, dx: number, world: CollisionWorld, lip = 0): Solid | null {
  if (dx === 0) return null;
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 4));
  const sx = dx / steps;
  for (let i = 0; i < steps; i++) {
    b.x += sx;
    const s0 = firstOverlap(b, world);
    if (!s0) continue;
    // Ledge lip: a step whose top is ≤ ledgeLip px above our feet is climbed instead of blocking.
    // (Tiles are scanned top row first, so s0 is the highest blocking tile.)
    const rise = b.y + b.h - s0.y;
    if (rise > 0 && rise <= Math.max(s0.step ?? PHYS.ledgeLip, lip) && !blockedAt(b, b.x, s0.y - b.h, world)) {
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
export function moveY(b: Body, dy: number, world: CollisionWorld): Solid | null {
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

/** Slack when asking which side of a solid's last position a body was on: touching counts as outside. */
const SWEEP_EPS = 1e-6;

/** The solid the body being stepped is passing through (Body.pass), or -1: `firstOverlap` skips it. Set only inside `stepBody`. */
let passing = -1;

/** Terrain, as `firstOverlap` reports it: only the world pins a runner hard enough to crush, or a solid made to (`Solid.crush`). */
const isTile = (s: Solid) => s.id === TILE_SOLID_ID || s.id === TILE_ONEWAY_ID;

/**
 * Let moving solid `s` pass through the body instead of pushing it: it would
 * pin the body against a part, not the world. A rider stops riding it, like a
 * runner knocked off by a ceiling, and falls once the part above lets it.
 */
function passThrough(b: Body, s: Solid) {
  b.pass = s.id;
  passing = s.id;
  if (b.groundRef === s.id) {
    b.groundRef = -1;
    b.onGround = false;
  }
}

/**
 * Push the body out of any dynamic solid that moved into it. Returns false if it can't escape (crushed).
 *
 * Swept: the body leaves by the side it was on before the solid moved this frame, however deep the
 * solid got. Taking the shallowest side instead lets a fast crusher, which can travel more than half a
 * body in one frame, pop a runner out on top of its head instead of driving them into the floor.
 * Only when the body already overlapped the solid's last position (it was riding or wedged) does the
 * shallowest side decide. A push that ends inside terrain is a pin against the world: crushed, and the
 * body stays where the solid caught it, so the run can credit whoever owns that solid. Pinned between
 * parts instead, the body stays where the frame found it and the mover passes through it (`passThrough`):
 * parts pass through each other, so only a crusher (`Solid.crush`) crushes a runner against a part.
 */
function depenetrate(b: Body, world: CollisionWorld): boolean {
  if (world.solids.length === 0) return true;
  const x0 = b.x;
  const y0 = b.y;
  for (let iter = 0; iter < 3; iter++) {
    const s = firstOverlap(b, world, true);
    if (!s) return true;
    const ox = b.x;
    const oy = b.y;
    const pushL = b.x + b.w - s.x;
    const pushR = s.x + s.w - b.x;
    const pushU = b.y + b.h - s.y;
    const pushD = s.y + s.h - b.y;
    // Where the solid was last frame: a side the body was clear of then is a side it can leave by.
    const px = s.x - s.dx;
    const py = s.y - s.dy;
    const wasL = b.x + b.w <= px + SWEEP_EPS;
    const wasR = b.x >= px + s.w - SWEEP_EPS;
    const wasU = b.y + b.h <= py + SWEEP_EPS;
    const wasD = b.y >= py + s.h - SWEEP_EPS;
    const any = wasL || wasR || wasU || wasD;
    const u = !any || wasU ? pushU : Infinity;
    const d = !any || wasD ? pushD : Infinity;
    const l = !any || wasL ? pushL : Infinity;
    const r = !any || wasR ? pushR : Infinity;
    const m = Math.min(l, r, u, d);
    if (m === u) b.y -= pushU;
    else if (m === d) b.y += pushD;
    else if (m === l) b.x -= pushL;
    else b.x += pushR;
    if (!firstOverlap(b, world, true)) {
      const hit = firstOverlap(b, world);
      if (!hit) return true;
      b.x = ox;
      b.y = oy;
      return false;
    }
  }
  const hit = firstOverlap(b, world);
  if (!hit) return true;
  if (isTile(hit)) return false;
  // Pinned between parts. A crusher still crushes; any other mover passes through, from where the frame found the body.
  b.x = x0;
  b.y = y0;
  let mover: Solid | null = null;
  for (const s of world.solids) {
    if (s.id === passing || !overlaps(b, s)) continue;
    if (s.crush) return false;
    if (!mover && (s.dx || s.dy)) mover = s;
  }
  if (mover && passing < 0) passThrough(b, mover);
  return true;
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
  const vRel = b.vx - (b.onGround ? groundBelt(surf) : 0);
  const reversing = dir !== 0 && vRel * dir < 0;
  // "Momentum" = moving faster than a walk: decel/turns skid instead of snapping.
  // (Unscaled by surface speed so sticky goo still stops you quickly.)
  const momentum = Math.abs(vRel) > PHYS.walkSpeed + 1;
  if (b.onGround) {
    if (surf.skid !== undefined && (dir === 0 || reversing || vRel * dir > top)) return reversing ? surf.skid * 2 : surf.skid;
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
  // A belt running up the wall adds its lift to the jump; one running down never takes any away.
  b.vy = -PHYS.wallJumpVy * k + Math.min(0, wallBelt(surf, dir));
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
 * A body thrown by a knock, under rules that bounce it (`RunRules.bounce`, a brawl's): stopped by a wall it leaves at
 * `bounce` times the speed it came in at, back the way it came, and the same off a ceiling; a floor still lands it, so
 * it skids on rather than bouncing forever. It climbs a step up to `lip` px, so a knock doesn't snag on a corner.
 */
export interface Knocked {
  bounce: number;
  lip: number;
}

/**
 * Advance one body one fixed step. Deterministic given (body, controls, world, wind, knocked).
 * `wind` (see sim/wind.ts) is the air this body is in this frame, if any; `knocked`, how it flies while a knock
 * throws it, or null for the plain controller (everyone else, and every proof in reach.ts).
 * Returns false if the body was crushed.
 */
export function stepBody(b: Body, c: Controls, world: CollisionWorld, wind: WindForce | null = null, knocked: Knocked | null = null): boolean {
  passing = -1;
  if (b.pass !== undefined) {
    const s = findSolid(world, b.pass);
    if (s && overlaps(b, s)) passing = b.pass;
    else delete b.pass;
  }
  const ok = step(b, c, world, wind, knocked);
  passing = -1;
  return ok;
}

function step(b: Body, c: Controls, world: CollisionWorld, wind: WindForce | null, knocked: Knocked | null): boolean {
  // Ride whatever we were standing on.
  if (b.groundRef >= 0) {
    const s = findSolid(world, b.groundRef);
    if (s) {
      // The platform has already moved. If it rose, the rider now overlaps it, so lift
      // first; otherwise a sideways move would collide with the platform itself and
      // shove the rider off (diagonal movers: rotors, pendulums, loops).
      if (s.dy < 0) {
        // The carrier never blocks its own rider: stopped by something above, the rider stays under it
        // and `depenetrate` settles the pinch, rather than the carrier's top sending it out under its bottom.
        const was = passing;
        passing = s.id;
        moveY(b, s.dy, world);
        passing = was;
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
  const target = dir * top + (b.onGround ? groundBelt(surf) : 0);
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
    const belt = wallBelt(b.wallSurface, b.wallDir);
    if (belt !== 0) {
      // Clinging to a belt: it grips and carries you at its own speed, up or down. Rising faster than
      // it on your own jump is left alone, so catching a belt never costs you height.
      if (b.vy > belt) b.vy = Math.max(belt, b.vy - PHYS.beltGrip * DT);
    } else {
      const kind = wallKind(b.wallSurface);
      const cap = kind === 'sticky' ? PHYS.wallStickySlideMax : kind === 'normal' ? PHYS.wallSlideMax : maxFall;
      if (b.vy > cap) b.vy = cap;
    }
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
  const vx = b.vx;
  if (moveX(b, vx * DT, world, knocked ? knocked.lip : 0)) b.vx = knocked ? -vx * knocked.bounce : 0;
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
      b.vy = knocked ? -b.vy * knocked.bounce : 0;
      b.jumping = false;
      // A head that bonks a belt from below is flung along it; air control can still fight it.
      const shove = ceilingBelt(hitY.surface) * PHYS.beltShoveMult;
      if (shove > 0) b.vx = Math.max(b.vx, shove);
      else if (shove < 0) b.vx = Math.min(b.vx, shove);
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
