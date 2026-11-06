import type { Phase } from '../game/match';
import type { ModeId } from '../game/modes';
import type { ItemKind } from '../sim/items/types';
import type { Role } from '../sim/props';
import type { Personality } from './personality';
import type { Temperament } from './temperament';

/**
 * The contract between a brain and the game (docs/DESIGN.md → AI players).
 * A brain sees a BrainView and answers with an Intent; the motor
 * (motor.ts) turns that into the seat's InputFrame. Nothing here is sim
 * state, so a brain written against one version keeps working as the sim
 * changes underneath it.
 */

/** Bumped when BrainView changes shape. A player's script will declare the version it was written against. */
export const BRAIN_VIEW_VERSION = 8;

/** How fast across the ground, as a player would say it. */
export type Pace = 'still' | 'walking' | 'running' | 'flying';
/** How it's moving up or down. */
export type Lift = 'rising' | 'level' | 'falling' | 'plunging';

/** The brain's own runner. Positions are in tiles, rounded to a quarter: it reads the game the way a player does. */
export interface SelfSense {
  /** Feet, center. */
  x: number;
  y: number;
  /** The cell it stands in (or falls through). */
  tx: number;
  ty: number;
  pace: Pace;
  lift: Lift;
  facing: -1 | 1;
  grounded: boolean;
  /** Wall it's touching in the air: -1 left, 1 right, 0 none. */
  wall: -1 | 0 | 1;
  alive: boolean;
  finished: boolean;
  /** Tiles of route to the flag over moves the controller is sure of, rounded; Infinity when none lead there. */
  togo: number;
  /** Tiles to the flag around the rock, through open air where no move is sure, rounded: how close it is when there's no route. */
  away: number;
  /** Rows its feet are above the spawn's floor, laps and all, rounded: how far up it has climbed. */
  up: number;
  /** Rising Slag: rows from its feet down to the slag, rounded; null with no slag. */
  slag: number | null;
  /** Its place in the race, 0 leading: nearest the flag by route, or round a climb, highest. */
  rank: number;
  /** The item in its hands and the uses left on it, or null. */
  held: { kind: ItemKind; uses: number } | null;
  /** It can use its item now: not cooling down, swinging, winding up or seeing stars. */
  armed: boolean;
}

export interface RunnerSense {
  slot: number;
  x: number;
  y: number;
  /** Rows its feet are above the spawn's floor, laps and all (as `SelfSense.up`): what to compare heights by round a loop. */
  up: number;
  grounded: boolean;
  alive: boolean;
  finished: boolean;
  /** The item in its hands, by its look, or null. */
  held: ItemKind | null;
}

/** A mystery box standing in the level: hit it from below and it pops an item. */
export interface BoxSense {
  tx: number;
  ty: number;
  /** Full: it pops something when hit now. */
  ready: boolean;
  /** A loop's box: it puts what it deals straight into empty hands rather than popping it out. */
  hands: boolean;
}

/** An item lying loose (or still flying), in tiles. Touch it to take it. */
export interface DropSense {
  x: number;
  y: number;
  kind: ItemKind;
}

/** A cell, in tiles. */
export interface Cell {
  tx: number;
  ty: number;
}

/**
 * What the race is for, as its mode says (src/game/modes.ts; view.ts `OBJECTIVES`). `togo` and `away` measure to
 * `cell` either way.
 */
export type Objective =
  /** Get to the flag at `cell`. */
  | { kind: 'reach'; cell: Cell }
  /**
   * Climb, the slag rising after you, nobody finishing. Round a loop (`loop`, the rows of a lap) `lapLine` is where
   * climbing carries you on a lap up, so the whole climb is ahead again; with no loop (`loop` 0) it's the top, a place to hold.
   */
  | { kind: 'climb'; lapLine: Cell; loop: number }
  /** Knock everyone else out (a brawl): `cell` is the arena's middle, where to head with nobody to go for. */
  | { kind: 'fight'; cell: Cell };

/** A part standing in the level, by what it does to a route rather than by name. */
export interface PropSense {
  owner: number;
  /** Cells you can stand on like rock. */
  ground: number[];
  /** Cells a route keeps clear of: they hurt, push, or hold something that moves. */
  noGo: number[];
}

export interface CardSense {
  claimed: boolean;
  /** The seat that took it, as its card shows; -1 while it's free. */
  by: number;
  role: Role;
  /** A plain strip that spans a gap, the part the level's plan is made of. */
  bridge: boolean;
  /** The crate's way out of a level the parts have sealed: it clears parts. */
  clears: boolean;
}

/** Another seat, as the screen shows it in any phase. */
export interface RivalSense {
  slot: number;
  /** Points on the board. */
  score: number;
  /** Pick: the crate card under its cursor, or -1. */
  hover: number;
  /** Place: its cursor, in tiles (rounded to a quarter); null in any other phase. */
  cursor: { x: number; y: number } | null;
}

/** A death a part was to blame for, as the race shows it: `killer` owns the part. */
export interface KillSense {
  victim: number;
  killer: number;
}

export interface BrainView {
  version: typeof BRAIN_VIEW_VERSION;
  phase: Phase;
  /** The match's playstyle mode: which strategy plays its race (strategies/). */
  mode: ModeId;
  /** Frames into this phase. */
  phaseFrame: number;
  slot: number;
  /** Lobby: ready to go. */
  ready: boolean;
  /** Its own points on the board. */
  score: number;
  level: {
    w: number;
    h: number;
    /** Tile per cell (y * w + x): 0 empty, 1 solid, 2 one-way. Read only. */
    tiles: Uint8Array;
    spawn: { tx: number; ty: number };
    /** Bridges that would finish the level as it stands, left end first (BRIDGE_W wide). Empty when it's open. */
    plan: { tx: number; ty: number }[];
  };
  props: PropSense[];
  /** Pick: the crate. */
  crate: CardSense[];
  /** Pick and place: the card this seat holds, or -1. */
  claim: number;
  /** Place: done placing. */
  placed: boolean;
  /** What the race is for. */
  objective: Objective;
  /** Race: mystery boxes in the level, set pieces and parts alike. */
  boxes: BoxSense[];
  /** Race: loose items. */
  drops: DropSense[];
  /**
   * Race: tiles of route a stop at stand cell (tx, ty) adds on the way to the objective, rounded as `togo` is;
   * Infinity when no route leads through it.
   */
  detour(tx: number, ty: number): number;
  /** Race: this seat's runner; null outside a race. */
  self: SelfSense | null;
  /** Race: the other runners. */
  runners: RunnerSense[];
  /** Every other seat, in every phase. */
  rivals: RivalSense[];
  /** Race and its score: the deaths so far that a part's owner is credited with. */
  kills: KillSense[];
  /** Race: the countdown is over. */
  live: boolean;
  /** Place: would the held part go at (tx, ty) turned `rot` quarter turns? */
  canPlace(tx: number, ty: number, rot: number): boolean;
  /** Place: would the level still have a way to the flag, with at most its bridges, after that? */
  keepsWay(tx: number, ty: number, rot: number): boolean;
  /**
   * Place: where everyone will run, with the plan built: the stand cells (y * w + x) of the quickest way to the flag
   * and its best alternative, and how hard the run is as the parts stand (as `assess` measures it).
   */
  route(): { cells: number[]; tight: number; length: number };
  /**
   * Place: how hard the run would be with the held part there: the tight jumps (ones a slip turns into a fall) on the
   * more forgiving way, and its length in tiles. Null if the spot isn't legal or would break the plan's way through.
   */
  assess(tx: number, ty: number, rot: number): { tight: number; length: number } | null;
}

/** What a brain wants this frame. The motor does the rest, with the same inputs a player has. */
export type Intent =
  | { do: 'wait' }
  /** Lobby: be ready. */
  | { do: 'ready' }
  /** Pick: take crate card `card`. */
  | { do: 'pick'; card: number }
  /** Pick: point at crate card `card` without taking it, as a player weighs it up. */
  | { do: 'hover'; card: number }
  /** Place: move the cursor to (x, y), in tiles, without placing: a player eyeing a spot, or someone. */
  | { do: 'aim'; x: number; y: number }
  /** Place: put the held part with its origin at (tx, ty), turned `rot`. */
  | { do: 'place'; tx: number; ty: number; rot: number }
  /** Race: get to the cell (tx, ty) by the route the motor finds. */
  | { do: 'goTo'; tx: number; ty: number }
  /** Race: no proven way on, so run and jump for (tx, ty) anyway, off whatever edge is in the way. */
  | { do: 'leap'; tx: number; ty: number }
  /** Race: jump straight up in column `tx`, again whenever it lands, keeping over it: to knock a box overhead. */
  | { do: 'hop'; tx: number }
  /** Race: press use with the held item, facing `dir` if given, holding up if `up` (a throw aimed high). */
  | { do: 'use'; dir?: -1 | 1; up?: boolean }
  /** Race: hold self-destruct. */
  | { do: 'giveUp' };

export interface Brain {
  think(view: BrainView): Intent;
}

/** A kind of brain, as BRAINS lists it. `make` gets a seed so a bot's choices replay, the bot's personality and its temperament. */
export interface BrainDef {
  label: string;
  make(seed: number, traits: Personality, mood: Temperament): Brain;
}
