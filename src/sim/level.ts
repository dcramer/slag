import type { ItemDeal } from './items/types';
import type { Rect } from '../core/geom';
import type { TerrainKind, Theme } from '../gen/theme';
import { TILE } from './constants';
import type { PlacedProp } from './props/types';
import type { Tide } from './tide';
import type { Weather } from './weather';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tile kinds stored in Level.tiles. */
export const T_EMPTY = 0;
export const T_SOLID = 1;
/** Jump-through platform: solid only from above. */
export const T_ONEWAY = 2;

/** World-size class of a level (see gen/level/profile.ts). */
export type SizeClass = 'classic' | 'wide' | 'tall';
/** How much precision a level asks of you (see gen/level/difficulty.ts). */
export type Difficulty = 'gentle' | 'medium' | 'hard';
/**
 * Overall route shape: ltr = left to right at roughly one height; climb =
 * goal well above spawn; descent = goal well below spawn; zigzag = switchback
 * storeys climbing a tall level. Spawn is always on the left, goal on the right.
 */
export type RouteShape = 'ltr' | 'climb' | 'descent' | 'zigzag';

/**
 * Per-level variety knobs, rolled deterministically from the seed (and theme)
 * before sculpting. Plain data, so it survives snapshots.
 */
export interface LevelProfile {
  size: SizeClass;
  /** World size in tiles (same as Level.w/h). */
  w: number;
  h: number;
  /** 0 = sparse (lots of open air, few landmarks) … 1 = dense (packed terrain, ceilings, clutter). */
  density: number;
  /** Target number of theme set pieces (0–4); the placer may find room for fewer. */
  hazards: number;
  /** 0 = tame set-piece mix (platforms, lifts) … 1 = nasty (cannons, saws, presses). */
  danger: number;
  route: RouteShape;
  /** World gravity scale (copied to Level.gravity). */
  gravity: number;
  difficulty: Difficulty;
  /** Which draw of its layout the level is (gen/level/index.ts): with the rest of the profile, what rebuilds it. */
  draw?: number;
  /**
   * What a mode asks of its level (game/modes.ts `ModeDef.profile`), each on its own so a new mode takes the ones it
   * needs. `builder`: the level builder by name (gen/level/builders `BUILDERS`); absent, the one whose `takes` fits.
   */
  builder?: string;
  /** Loops on itself: a tall shaft whose top band is its bottom one (Level.loop), so the climb never ends. */
  loop?: boolean;
  /** Owes no part: passable bare, with no crossing that takes one (a loop climbs bare, every lap). */
  bare?: boolean;
  /** Mystery boxes of its own up every lap, dealing by rank from this table (gen/level/loop-boxes.ts). */
  boxes?: ItemDeal;
  /** Slag rising under it from GO (Level.tide, sim/tide.ts): a climb. */
  tide?: boolean;
  /** A loop whose laps follow the difficulty curve (gen/level/difficulty.ts `LAP_TIERS`), the first gentle to hard; absent, every lap is `difficulty`. */
  curve?: boolean;
}

export interface Level {
  seed: number;
  w: number;
  h: number;
  /** Row-major, 1 = solid. Mutable during a match (bombs). */
  tiles: Uint8Array;
  /** Empty cell players spawn in (standing on the tile below). */
  spawn: { tx: number; ty: number };
  /**
   * More cells to spawn in (an arena with a corner each): runner i starts at the i-th of `spawn` and these, round and
   * round. Each inside a protected rect has a safe zone of its own, as `spawn` does.
   */
  spawns?: { tx: number; ty: number }[];
  /** Empty cell holding the goal flag. */
  goal: { tx: number; ty: number };
  /** Tile areas where props can't be placed and bombs can't dig. */
  protectedRects: TileRect[];
  theme: Theme;
  style: string;
  /** Pre-placed, theme-driven set pieces (owner -1). Persist for the whole match. */
  setPieces: PlacedProp[];
  /**
   * One known way to finish with props: cells (left end, 3 wide) where a
   * bridge platform makes the goal reachable. Empty when solvable bare.
   * Set by worldgen; used by validation, tools and tests.
   */
  solution?: { x: number; y: number }[];
  /** World gravity scale (1 = normal; see CollisionWorld.gravity). Physics, reach and projectiles all use it. */
  gravity?: number;
  /** Variety knobs this level was generated with (absent for hand-built test levels). */
  profile?: LevelProfile;
  /** Per-tile ground kind (sim/ground.ts: glacier ice), row-major like `tiles`. Absent means all plain. */
  ground?: Uint8Array;
  /** This level's weather (sim/weather.ts). Absent means clear, as on hand-built test levels. */
  weather?: Weather;
  /** Slag rising from the bottom (sim/tide.ts), on a level built for Rising Slag. Absent means none. */
  tide?: Tide;
  /**
   * A Rising Slag shaft that loops (`LOOP_BAND`): rows climbed before the shaft repeats. Its top `LOOP_BAND` rows
   * are its bottom ones over again, and a runner climbing into the top band carries on from the same place in the
   * bottom one, a lap up (RunWorld). Absent: the level ends where it ends.
   */
  loop?: number;
  /** Bumped whenever tiles change so renderers can invalidate caches. */
  version: number;
  /** The stage concept's landmark (gen/stage), for the renderer: its box and how its tiles are drawn. The sim ignores it. */
  landmark?: LevelLandmark;
  /** Crossings a carrier landmark is proven to make (gen/level/ride.ts). reach.ts walks them; the sim ignores them. */
  rides?: Ride[];
}

/** What the renderer knows of a level's landmark. Render-only: nothing in the sim reads it. */
export interface LevelLandmark {
  /** Stage concept id ('great-wheel'). */
  concept: string;
  /** The structure's box (tiles). */
  rect: TileRect;
  /** How the landmark's tiles are drawn, in place of the theme's material. */
  skin?: TerrainKind;
}

/**
 * A crossing a carrier set piece makes, proven by riding it standing still
 * (gen/level/ride.ts): step onto it from `board` while it's parked at one
 * end, step off at `alight` when it's parked at the other. Cells are keyed
 * `y * w + x`. reach.ts takes it as one more move, from `board` to `alight`,
 * while both are standable and every cell the rider passes through is empty.
 */
export interface Ride {
  /** The carrier set piece. */
  uid: number;
  board: number;
  alight: number;
  /** Every cell the standing rider passes through between the two, excluding both ends. */
  path: number[];
}

const PROFILE_KEYS = new WeakMap<LevelProfile, string>();

/**
 * Which generated level this is, for anything cached per level. A seed
 * regenerated under another theme or other rules (gravity, weather, any
 * profile knob) is another level at the same seed, size and version, so the
 * key carries the theme, the whole profile and the weather. A crater only
 * bumps `version`, so it keeps this key. The profile is fixed once generated,
 * so its part is memoized.
 */
export function levelKey(l: Level): string {
  let pk = l.profile ? PROFILE_KEYS.get(l.profile) : '-';
  if (pk === undefined) PROFILE_KEYS.set(l.profile!, (pk = JSON.stringify(l.profile)));
  // A forced concept (?concept=) is another level at the same seed and profile.
  return `${l.seed}:${l.theme.id}:${l.w}x${l.h}:${l.gravity ?? 1}:${pk}:${l.weather?.kind ?? 'clear'}${l.landmark ? `:${l.landmark.concept}` : ''}`;
}

/** Tile kind at (tx, ty). Outside x is a solid wall; outside y is empty. */
export function tileAt(level: Level, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.w) return 1;
  if (ty < 0 || ty >= level.h) return 0;
  return level.tiles[ty * level.w + tx];
}

export function isProtected(level: Level, tx: number, ty: number): boolean {
  for (const r of level.protectedRects) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return true;
  }
  return false;
}

/** World y of the floor under a stand cell: where a runner's feet rest, and so where the spawn ring and the flag's base are drawn. */
export function floorY(cell: { ty: number }): number {
  return (cell.ty + 1) * TILE;
}

/**
 * A body all the way past the left or right edge has left the level and dies.
 * Past the edge is open air (`CollisionWorld.cols`), so a runner can lean out
 * over it and come back; only going right off counts.
 */
export function offMap(b: { x: number; w: number }, cols: number): boolean {
  return b.x + b.w <= 0 || b.x >= cols * TILE;
}

/** Bodies below this y have sunk into the pit at the bottom of the level. A loop has no bottom: you fall into the lap below. */
export function killY(level: Level): number {
  return level.loop ? Infinity : level.h * TILE - 2;
}

/**
 * Rows a looping shaft repeats at its top and bottom (`Level.loop`): rows [0, LOOP_BAND) are rows
 * [loop, loop + LOOP_BAND) again. Enough above the lap's line for a full jump, below it for a fall to read.
 */
export const LOOP_BAND = 8;
/** The spawn storey's stand row inside the band: it stands at `loop + LOOP_SPAWN`, and again a lap up at `LOOP_SPAWN`. */
export const LOOP_SPAWN = 5;

/**
 * How many laps (+1 up, -1 down) a body whose feet are at world y `feet` should be carried by on a looping level, 0
 * inside the shaft. Up once its feet reach the spawn storey's floor a lap up (standing on that copy is standing on
 * the spawn, a lap on); down once they fall past the bottom band. The two lines sit a band apart, so a carried body
 * never comes straight back.
 */
export function lapShift(level: Level, feet: number): -1 | 0 | 1 {
  if (!level.loop) return 0;
  if (feet <= (LOOP_SPAWN + 1) * TILE + 0.5) return 1;
  if (feet > (level.loop + LOOP_BAND) * TILE - 0.5) return -1;
  return 0;
}

/** Goal trigger reach: px past each side of the flag cell, and tiles above it. */
const GOAL_PAD_X = 6;
const GOAL_REACH_UP = 4;

/**
 * The flag's finish trigger: the flag cell widened by GOAL_PAD_X px each side
 * plus a column GOAL_REACH_UP tiles above it, so jumping clear over the flag
 * (even at full jump height from the flag's floor) still counts.
 */
export function goalRect(level: Level): Rect {
  return { x: level.goal.tx * TILE - GOAL_PAD_X, y: (level.goal.ty - GOAL_REACH_UP) * TILE, w: TILE + 2 * GOAL_PAD_X, h: TILE * (GOAL_REACH_UP + 1) };
}

/**
 * The spawn safe zone in world px: the protected rect that holds the spawn
 * cell (the starting pocket). Runners touching it can't be killed by props
 * (see RunWorld). Null when the level has no protected rect around spawn.
 */
export function spawnZone(level: Level): Rect | null {
  return zoneAt(level, level.spawn);
}

/** Every cell a race spawns in: `spawn`, then any more (`Level.spawns`). */
export const spawnsOf = (level: Level): { tx: number; ty: number }[] => [level.spawn, ...(level.spawns ?? [])];

/** The safe zone round each spawn cell that has one (spawnZone's rule), with the cell. */
export function spawnZones(level: Level): { cell: { tx: number; ty: number }; zone: Rect }[] {
  return spawnsOf(level).flatMap((cell) => {
    const zone = zoneAt(level, cell);
    return zone ? [{ cell, zone }] : [];
  });
}

/** The protected rect holding `cell`, in px, or null. */
function zoneAt(level: Level, cell: { tx: number; ty: number }): Rect | null {
  const { tx, ty } = cell;
  for (const r of level.protectedRects) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
  }
  return null;
}
