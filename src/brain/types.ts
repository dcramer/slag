import type { Phase } from '../game/match';
import type { Role } from '../sim/props';

/**
 * The contract between a brain and the game (docs/DESIGN.md → AI players).
 * A brain sees a BrainView and answers with an Intent; the motor
 * (motor.ts) turns that into the seat's InputFrame. Nothing here is sim
 * state, so a brain written against one version keeps working as the sim
 * changes underneath it.
 */

/** Bumped when BrainView changes shape. A player's script will declare the version it was written against. */
export const BRAIN_VIEW_VERSION = 1;

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
}

export interface RunnerSense {
  slot: number;
  x: number;
  y: number;
  alive: boolean;
  finished: boolean;
}

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
  role: Role;
  /** A plain strip that spans a gap, the part the level's plan is made of. */
  bridge: boolean;
  /** The crate's way out of a level the parts have sealed: it clears parts. */
  clears: boolean;
}

export interface BrainView {
  version: typeof BRAIN_VIEW_VERSION;
  phase: Phase;
  /** Frames into this phase. */
  phaseFrame: number;
  slot: number;
  /** Lobby: ready to go. */
  ready: boolean;
  level: {
    w: number;
    h: number;
    /** Tile per cell (y * w + x): 0 empty, 1 solid, 2 one-way. Read only. */
    tiles: Uint8Array;
    spawn: { tx: number; ty: number };
    goal: { tx: number; ty: number };
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
  /** Race: this seat's runner; null outside a race. */
  self: SelfSense | null;
  /** Race: the other runners. */
  runners: RunnerSense[];
  /** Race: the countdown is over. */
  live: boolean;
  /** Place: would the held part go at (tx, ty) turned `rot` quarter turns? */
  canPlace(tx: number, ty: number, rot: number): boolean;
  /** Place: would the level still have a way to the flag, with at most its bridges, after that? */
  keepsWay(tx: number, ty: number, rot: number): boolean;
}

/** What a brain wants this frame. The motor does the rest, with the same inputs a player has. */
export type Intent =
  | { do: 'wait' }
  /** Lobby: be ready. */
  | { do: 'ready' }
  /** Pick: take crate card `card`. */
  | { do: 'pick'; card: number }
  /** Place: put the held part with its origin at (tx, ty), turned `rot`. */
  | { do: 'place'; tx: number; ty: number; rot: number }
  /** Race: get to the cell (tx, ty) by the route the motor finds. */
  | { do: 'goTo'; tx: number; ty: number }
  /** Race: hold self-destruct. */
  | { do: 'giveUp' };

export interface Brain {
  think(view: BrainView): Intent;
}

/** A kind of brain, as BRAINS lists it. `make` gets a seed so a bot's choices replay. */
export interface BrainDef {
  label: string;
  make(seed: number): Brain;
}
