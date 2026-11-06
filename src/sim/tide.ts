import { FPS, RUN_COUNTDOWN, TILE } from './constants';
import type { Level } from './level';

/**
 * Rising Slag (docs/DESIGN.md → Modes): the Foundry pours, and molten slag rises from the bottom of the level.
 * Everything under its surface burns, the spawn zone included, the way the pit takes you anywhere. It isn't a part:
 * nothing places on it, bombs don't touch it, and the winnability proof never sees it.
 *
 * It plays like a racer's camera that follows the leader: the slag is on a leash to whoever is highest. It always
 * rises at least at its floor pace, so a slow lobby isn't rushed and a leader can't hold it back by dawdling; and
 * it never lets the leader get more than the leash ahead, rushing up to close the gap, so falling behind the pack
 * is falling off the screen. The leash is the stretch's difficulty (long low in the tower, short in its hard
 * stretch). It starts longer while a field is still bunched at the start (`open`), and shortens once someone is out
 * or late in a round, whichever comes first, until even the leader goes (`squeeze`): the lead-camera racer's rule.
 *
 * The surface is race state (`RunWorld.slag`): it depends on where the runners are, so a snapshot carries it.
 */
export interface Tide {
  /** Seconds after GO before the slag moves: it boils where it pools. */
  wait: number;
  /** Floor pace when it starts, tiles/s, and what it gains every second, tiles/s². */
  speed: number;
  gain: number;
  /**
   * Tile row whose bottom edge the slag starts at: the level's lowest open row, so it pools in sight from GO
   * rather than rising unseen under the floor (gen/level/index.ts). Absent: the level's bottom edge.
   */
  from?: number;
  /**
   * Most rows the slag stays below the leader's feet, by how far up the leader is (rows above the spawn's floor):
   * each entry holds from its `from` up to the next. Empty: no leash, only the floor pace.
   */
  leash: readonly { from: number; rows: number }[];
  /**
   * Seconds after GO the leash starts to shorten, the rows a second it loses, and the shortest it gets. With `out`, it
   * starts that many seconds after the first runner goes out, if that comes sooner.
   */
  squeeze: { after: number; rate: number; min: number; out?: number };
  /** Rows the leash is longer at GO, fading to none `seconds` in: a field starts bunched up and in each other's way. */
  open?: { rows: number; seconds: number };
  /** Fastest the slag closes on a leader who got more than the leash ahead, tiles/s. */
  rush: number;
  /**
   * Gates across a loop's shaft (gen/level/loop-gates.ts), the same ones its set pieces shut on the race clock. While
   * the leader stands under a shut one, within `hold` rows of it, the floor pace waits with them: the pack climbs up
   * to them and nobody is eaten for the leader's wait.
   */
  gates?: readonly TideGate[];
  hold?: number;
}

/**
 * A gate across the shaft (Rising Slag's regroup, docs/MODES.md): its cells' row in the loop's first lap (it shuts
 * there every lap), shut `shut` frames then open `open`, on the race frame shifted by `offset`. The gate's own blink
 * blocks (sim/props/modules/phase.ts, `clock`) run the same cycle: `on` is `shut`, `off` is `open`.
 */
export interface TideGate {
  row: number;
  shut: number;
  open: number;
  offset: number;
}

/** Is `g` shut on run frame `f`? The phase module's cycle (segment 0 solid) on the race clock. */
export function gateShut(g: TideGate, f: number): boolean {
  const total = g.shut + g.open;
  return (((f + g.offset) % total) + total) % total < g.shut;
}

/**
 * Is a leader with feet at world y `feet` (climbed coordinates) waiting under a shut gate on frame `f`: standing at
 * most `hold` rows under its cells, in any lap?
 */
function heldAtGate(tide: Tide, loop: number, feet: number, f: number): boolean {
  if (!tide.gates || !tide.hold || !loop) return false;
  for (const g of tide.gates) {
    if (!gateShut(g, f)) continue;
    const under = (((feet / TILE - (g.row + 1)) % loop) + loop) % loop;
    if (under <= tide.hold) return true;
  }
  return false;
}

/** World y the slag starts at, or null on a level without a tide. */
export function tideStart(level: Level): number | null {
  return level.tide ? (level.tide.from ?? level.h) * TILE : null;
}

/** The row under the lowest open cell of `tiles` (w × h, 1 solid): where a tide starts on that level. */
export function lowestOpen(tiles: Uint8Array, w: number, h: number): number {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (tiles[y * w + x] !== 1) return y + 1;
  return h;
}

/** Seconds the slag has been moving on run frame `f` (0 while it boils). */
function moving(tide: Tide, f: number): number {
  return Math.max(0, (f - RUN_COUNTDOWN) / FPS - tide.wait);
}

/** Px the floor pace alone has carried the slag from where it starts by run frame `f`. */
export function floorRise(tide: Tide, f: number): number {
  const s = moving(tide, f);
  return TILE * (tide.speed * s + (tide.gain * s * s) / 2);
}

/** Run frame the first of `runners` went out on, or -1 while nobody has. */
export function firstOut(runners: readonly { alive: boolean; deathFrame: number }[]): number {
  let out = -1;
  for (const r of runners) if (!r.alive && r.deathFrame >= 0 && (out < 0 || r.deathFrame < out)) out = r.deathFrame;
  return out;
}

/** Run frame the squeeze starts on, the first runner having gone out on frame `out` (-1: nobody yet). */
function squeezeFrom(tide: Tide, out: number): number {
  const late = RUN_COUNTDOWN + tide.squeeze.after * FPS;
  return tide.squeeze.out !== undefined && out >= 0 ? Math.min(late, out + tide.squeeze.out * FPS) : late;
}

/** Rows the leash is longer on run frame `f` for the opening (`open`): its full length to GO, fading to none. */
export function openingRows(tide: Tide, f: number): number {
  const s = (f - RUN_COUNTDOWN) / FPS;
  return tide.open && s < tide.open.seconds ? tide.open.rows * (1 - Math.max(0, s) / tide.open.seconds) : 0;
}

/**
 * Rows the slag may lag the leader on run frame `f`, with the leader `climbed` rows above the spawn's floor and the
 * first runner out on frame `out` (`firstOut`).
 */
export function leashRows(tide: Tide, climbed: number, f: number, out = -1): number {
  let rows = Infinity;
  for (const l of tide.leash) if (climbed >= l.from) rows = l.rows;
  rows += openingRows(tide, f);
  const late = (f - squeezeFrom(tide, out)) / FPS;
  return late > 0 ? Math.max(Math.min(rows, tide.squeeze.min), rows - late * tide.squeeze.rate) : rows;
}

/**
 * The slag's surface on run frame `f`, from `line` on the frame before and the leader's feet (world y, null with
 * nobody left racing), the first runner out on frame `out`. It never sinks: it rises by the floor pace, or rushes
 * toward the leash when it's further behind the leader than that.
 */
export function stepTide(level: Level, line: number, f: number, leader: number | null, out = -1): number {
  const tide = level.tide!;
  if (f < RUN_COUNTDOWN + tide.wait * FPS) return line;
  const pace = leader !== null && heldAtGate(tide, level.loop ?? 0, leader, f) ? 0 : floorRise(tide, f + 1) - floorRise(tide, f);
  if (leader === null) return line - pace;
  const climbed = ((level.spawn.ty + 1) * TILE - leader) / TILE;
  const target = leader + leashRows(tide, climbed, f, out) * TILE;
  if (line - pace <= target) return line - pace;
  return Math.max(target, line - Math.max(pace, (tide.rush * TILE) / FPS));
}

/** How far through the boil before the slag moves, 0…1: the art's warning. */
export function tideWarn(level: Level, f: number): number {
  if (!level.tide) return 0;
  const s = (f - RUN_COUNTDOWN) / FPS;
  return Math.max(0, Math.min(1, s / level.tide.wait));
}
