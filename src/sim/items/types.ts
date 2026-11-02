/**
 * Held items as plain, snapshot-friendly data. A runner carries at most one
 * item; mystery crates (the `mystery` prop module) pop them out, runners grab
 * them by touching them and fire them with the `use` input. Behavior lives in
 * the ITEMS registry (./roster.ts) and the ammo registered in ./ammo.ts.
 *
 * Runner state sits in its own field beside RunnerStatus, so a future
 * "attached to a prop" state can be added next to both without touching them.
 */

export type ItemKind = 'sword' | 'puck' | 'boomerang' | 'shield' | 'rocket' | 'smoke' | 'bat' | 'tremor' | 'tax' | 'block';

export const ITEM_KINDS: readonly ItemKind[] = ['sword', 'puck', 'boomerang', 'shield', 'rocket', 'smoke', 'bat', 'tremor', 'tax', 'block'];

/** What a runner holds. */
export interface Held {
  kind: ItemKind;
  /** Uses left; the item is gone when it reaches 0. */
  uses: number;
}

/** Per-runner item state, stored on the Runner. All counters are frames left. */
export interface RunnerItems {
  held: Held | null;
  /** `use` is ignored until this reaches 0. */
  cooldown: number;
  /** Sword swing in progress; the blade connects while this is inside the active window. */
  swing: number;
  /** Bitmask of runner indices the current swing already hit. */
  swingHits: number;
  /** What's swinging (the noodle or the bat), and its knock as a multiple of the noodle's. */
  swingKind: ItemKind;
  swingPower: number;
  /** Frames into a bat wind-up (0: not winding). The swinger is rooted until it lets go. */
  windup: number;
  /** Frames until a raised Tremor Brick comes down (0: none raised). */
  slam: number;
  /** Seeing stars: controls ignored, as frozen, but with no ice block. */
  daze: number;
  /** Rocket burn left; the daze lands when it runs out. */
  thrust: number;
  /** Lethal hazards ignored, right after a shield pops. */
  guard: number;
  /** Rival who last bonked us, and how long a death still credits them. */
  bonkedBy: number;
  bonkCredit: number;
  /** Can't pick anything up (just tossed an item). */
  noPickup: number;
}

/** A loose item lying in, or flying through, the level. */
export interface ItemDrop {
  id: number;
  kind: ItemKind;
  uses: number;
  /** Center of the item (px). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  /** Frames before anyone can grab it, so a crate pop reads. */
  grace: number;
  onGround: boolean;
}

/** A lingering smoke cloud. */
export interface SmokeCloud {
  x: number;
  y: number;
  r: number;
  born: number;
  until: number;
}

/** A Front-Runner Tax shell: flies over everything to the leader, hovers over them, then dives. */
export interface TaxShell {
  id: number;
  /** Slot credited for its bonks. */
  owner: number;
  x: number;
  y: number;
  /** Runner index it's after, or -1. */
  target: number;
  phase: 'fly' | 'hover' | 'dive';
  /** Frames into the current phase. */
  t: number;
  /** Where a dive lands, fixed when it starts. */
  dx: number;
  dy: number;
  born: number;
}

/** A Pocket Block: one solid cell that crumbles at `until`. */
export interface PocketBlock {
  tx: number;
  ty: number;
  born: number;
  until: number;
  owner: number;
}

/** Item state for one race (lives on RunWorld). */
export interface ItemWorld {
  drops: ItemDrop[];
  clouds: SmokeCloud[];
  shells: TaxShell[];
  blocks: PocketBlock[];
  nextId: number;
}

/** A loose item to add to the world; `uses` defaults to the roster's count. */
export interface ItemSpawn {
  kind: ItemKind;
  uses?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grace?: number;
}

export function newRunnerItems(): RunnerItems {
  return {
    held: null,
    cooldown: 0,
    swing: 0,
    swingHits: 0,
    swingKind: 'sword',
    swingPower: 1,
    windup: 0,
    slam: 0,
    daze: 0,
    thrust: 0,
    guard: 0,
    bonkedBy: -1,
    bonkCredit: 0,
    noPickup: 0,
  };
}

export function newItemWorld(): ItemWorld {
  return { drops: [], clouds: [], shells: [], blocks: [], nextId: 1 };
}

/** Loose items vanish this long after they appear, blinking for the last DROP_BLINK frames. */
export const DROP_LIFE = 60 * 10;
export const DROP_BLINK = 60 * 2;
/** Loose item hitbox half-size (px). */
export const DROP_HALF = 5;
