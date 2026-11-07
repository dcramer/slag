/**
 * Held items as plain, snapshot-friendly data. A runner carries at most one
 * item; mystery crates (the `mystery` prop module) pop them out, runners grab
 * them by touching them and fire them with the `use` input. Behavior lives in
 * the ITEMS registry (./roster.ts) and the ammo registered in ./ammo.ts.
 *
 * Runner state sits in its own field beside RunnerStatus, so a future
 * "attached to a prop" state can be added next to both without touching them.
 */

export type ItemKind =
  | 'sword'
  | 'puck'
  | 'boomerang'
  | 'shield'
  | 'rocket'
  | 'smoke'
  | 'bat'
  | 'tremor'
  | 'tax'
  | 'block'
  | 'hook'
  | 'upper'
  | 'glove'
  | 'clock'
  | 'rod'
  | 'slick'
  | 'jolt'
  | 'grapple';

export const ITEM_KINDS: readonly ItemKind[] = [
  'sword',
  'puck',
  'boomerang',
  'shield',
  'rocket',
  'smoke',
  'bat',
  'tremor',
  'tax',
  'block',
  'hook',
  'upper',
  'glove',
  'clock',
  'rod',
  'slick',
  'jolt',
  'grapple',
];

/**
 * What a box deals by rank (a mode's `boxes`, game/modes.ts): one table for whoever leads, one for the rest, and for
 * the rest, tables that take over the further behind they are (`behind`), the kart racer's way.
 */
export interface ItemDeal {
  chase: readonly ItemKind[];
  lead: readonly ItemKind[];
  /** Chasers `rows` or more behind the leader (sim/standing.ts `behindOf`) draw from `deal` instead: the deepest that applies. */
  behind?: readonly { rows: number; deal: readonly ItemKind[] }[];
}

/** The table a runner draws from: the leader's (`lead`), or a chaser's `rows` behind the leader. */
export function dealFor(d: ItemDeal, lead: boolean, rows: number): readonly ItemKind[] {
  if (lead) return d.lead;
  let pool = d.chase;
  for (const t of d.behind ?? []) if (rows >= t.rows) pool = t.deal;
  return pool;
}

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
  /** What's swinging (the noodle, the bat or the glove), and its knock as a multiple of the noodle's. */
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
  /** Frames a Catch of the Day's line has been going out (0: none). The caster is rooted until it snags or turns back. */
  cast: number;
  /** Rivals' hits taken this race, under a build-up rule (`RunRules.buildup`): each throws the next one farther. */
  hits: number;
  /** Frames a Social Climber's line is reeling this runner up (0: none): controls ignored, as a cast roots you. */
  reel: number;
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

/** A Queue Jumper's line, reeling out from its thrower to the runner just ahead of them; when it gets there they trade places. */
export interface HookLine {
  id: number;
  /** Runner indices: who threw it, and who it's after. */
  owner: number;
  target: number;
  /** Frames since it was thrown. */
  t: number;
}

/** An Upper Hand in flight: a gloved firework rising straight up through everything. */
export interface UpperFist {
  id: number;
  /** Slot credited for its bonks. */
  owner: number;
  x: number;
  y: number;
  /** How far it has risen (px). */
  rose: number;
  born: number;
}

/** A Rude Awakening: an alarm clock lobbed in an arc that rings once it comes down, then goes off. */
export interface AlarmClock {
  id: number;
  /** Slot credited for its bonks. */
  owner: number;
  /** Center (px) and velocity (px/s). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  /** Frames it rings once down before it goes off (0: still in the air), and frames it has rung. */
  fuse: number;
  ring: number;
  onGround: boolean;
}

/** A Catch of the Day's line: the lure flying out straight from the caster's rod, then reeling back in. */
export interface CastLine {
  id: number;
  /** Runner index of the caster. */
  owner: number;
  /** The lure (px) and its velocity (px/s). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How far the lure has flown (px). */
  out: number;
  /** Reeling back in (it snagged someone or ran out of line): it only comes home now. */
  back: boolean;
  /** Runner index the float is hooked on, riding with them as they're yanked (-1: none), and frames it has been. */
  hooked: number;
  held: number;
}

/** A Slippery Slope's spill: the ledges in a box of tiles (inclusive; rows may run past a loop's ends) slick until `until`. */
export interface SlickPatch {
  id: number;
  owner: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  born: number;
  until: number;
}

/** A Trickle-Down: a shudder pouring down the shaft from where it was used, knocking whoever stands in its way. */
export interface JoltWave {
  id: number;
  /** Slot credited for its knocks. */
  owner: number;
  /** Where it was used (px): the middle across, and the user's feet as `progressOf` reads them (laps and all). */
  x: number;
  from: number;
  /** How far down it has poured (px; 0 until the stamp lands). */
  down: number;
  /** Frames since it was used. */
  t: number;
  /** Bitmask of runner indices it has already knocked. */
  hit: number;
}

/** A Social Climber's line: the hook caught on a ledge above, reeling its thrower up from where they stood. */
export interface ClimbLine {
  id: number;
  /** Runner index of the climber. */
  owner: number;
  /** Where the body's top-left started and where it ends (px), as of lap `lap`. */
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  /** Straight up first, then over onto the ledge; or over first, then up through it. */
  up: boolean;
  lap: number;
  /** Frames since it caught, and frames the reel takes. */
  t: number;
  frames: number;
}

/** Item state for one race (lives on RunWorld). */
export interface ItemWorld {
  drops: ItemDrop[];
  clouds: SmokeCloud[];
  shells: TaxShell[];
  blocks: PocketBlock[];
  hooks: HookLine[];
  fists: UpperFist[];
  clocks: AlarmClock[];
  lines: CastLine[];
  slicks: SlickPatch[];
  jolts: JoltWave[];
  climbs: ClimbLine[];
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
    cast: 0,
    hits: 0,
    reel: 0,
  };
}

export function newItemWorld(): ItemWorld {
  return { drops: [], clouds: [], shells: [], blocks: [], hooks: [], fists: [], clocks: [], lines: [], slicks: [], jolts: [], climbs: [], nextId: 1 };
}

/** Loose items vanish this long after they appear, blinking for the last DROP_BLINK frames. */
export const DROP_LIFE = 60 * 10;
export const DROP_BLINK = 60 * 2;
/** Loose item hitbox half-size (px). */
export const DROP_HALF = 5;
