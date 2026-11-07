import type { Rng } from '../../../core/rng';
import type { LevelProfile } from '../../../sim/level';
import type { ThemeId } from '../../../themes';
import type { Concept, Landmark } from '../../stage/types';
import type { Grid } from '../kit';
import type { Claim, Knobs, Slots } from '../sculptors/common';
import type { TallKit } from '../sculptors/tall';
import type { SculptCtx, Shape } from '../types';

/**
 * The kit contract (src/gen/AGENTS.md → Set kits and level builders): what a level set provides, as pieces with
 * declared attributes, and what a builder may ask of them. A builder owns the plan (sizes, the ask, where crossings
 * and stamps go, pockets, the landmark's site); a kit owns how each piece looks and stands. Builders never read the
 * theme: everything set-specific comes through the kit.
 */

/** A course's ground: the surface row of every column along the builder's ramp, and how it's laid. */
export interface GroundPiece<S> {
  /** The surface row per column (`H` = no ground: a drop), following `k.ramp`, and the set's own state for its other pieces. */
  profile(rng: Rng, k: Knobs, style: string, ctx: SculptCtx): { surf: number[]; state: S };
  /**
   * When the spawn and goal pockets take their rows: `early` from the raw profile before anything is placed (and
   * locked), `max` levelled to the lower of their extremes once everything's placed, `near` to the row nearest
   * the level's edge.
   */
  pockets: 'early' | 'max' | 'near';
  /** Rows neighbouring columns may differ by after placement (`relax`); absent: the profile stands as placed. */
  step?(style: string): number;
  /** Lay tiles under the surface; absent: solid from the surface down (`groundFromHeights`). */
  lay?(c: Course<S>): void;
}

/** One crossing the builder placed: columns x0..x1 cut to the drop, `hard` when no jump clears it. */
export interface Gap {
  x0: number;
  x1: number;
  hard: boolean;
  /** Columns from x0 of one-tile stones standing in it, level with the banks. */
  stones: number[];
  /** What the gap style rolled for itself (`GapStyle.roll`), e.g. a collapsed bridge's stubs. */
  extra?: unknown;
}

/**
 * How a set cuts a crossing. The builder sizes every crossing (`hardGap`, `jumpCrossing`) and places it; these are
 * the attributes it places by, and the dressing the kit adds once it's cut.
 */
export interface GapStyle<S> {
  /** Columns either side of the gap taken with it, so its banks are this set's own ground. */
  pad(hard: boolean): number;
  /** Margin kept from other slots, and the columns from each edge the gap stays inside: [left, right]. */
  margin: number;
  range: readonly [number, number];
  /** Columns either side levelled to the bank row, and how far out the bank row is sampled. */
  bank(hard: boolean, w: number): number;
  sample: 1 | 2;
  /** The gap itself drops out of the profile (`H`) before relaxing, so nothing levels across it. */
  sink: boolean;
  /** Keep landmarks and stamps off a hard crossing's banks (`keepClear`). */
  keepClear: boolean;
  /** A two-part ask may be one crossing two bridges wide, when this says so. */
  double?(rng: Rng, k: Knobs): boolean;
  /** Jumpable crossings beyond the level's share (`jumpCount`), by style. */
  extra?(style: string): number;
  /** What a crossing rolls for itself once sized, and the columns that adds (a collapsed bridge's stubs). */
  roll?(rng: Rng, hard: boolean): { w: number; extra: unknown };
  /** Dress a crossing after the builder cut it to the drop (`pit`) with its bank at `row`. */
  dress?(g: Grid, rng: Rng, gap: Gap, row: number, c: Course<S>): void;
}

/** Something that stands on levelled ground, `w` columns wide: a barn, a tower, a furnace, a serac. */
export interface Stamp<S> {
  w(rng: Rng): number;
  /** Build it on columns x..x+w-1, standing on top solid row `f`. */
  stamp(g: Grid, rng: Rng, x: number, w: number, f: number, c: Course<S>): void;
}

/** A set's stamps: the bag a level of `style` draws, how they're placed, and how the ground is levelled under them. */
export interface StampSet<S> {
  bag(rng: Rng, k: Knobs, style: string): Stamp<S>[];
  margin: number;
  /** `max`: levelled to the lower of the span's extremes; `inner`: the same, measured on its own columns only; `near`: to its left neighbour's row. */
  level: 'max' | 'inner' | 'near';
  /** What goes in instead when a stamp has no room: a narrower one (castle: a tower one column slimmer). */
  fallback?: { stamp: Stamp<S>; shrink: number };
}

/** A group of standing stamps: how many a level of `style` gets, each placed in a free slot with `margin`. */
export interface StandingStamps<S> {
  count(rng: Rng, k: Knobs, style: string): number;
  stamp: Stamp<S>;
  margin: number;
}

/**
 * The course kit: a set's pieces for a level you run across (the course, climb and descent builders). Hooks run in
 * the builder's order, each given the course so far.
 */
export interface CourseKit<S = unknown> {
  /** Style label prefix (`farm` → `farm:orchard`). */
  name: string;
  /** The set's course styles and their weights; a style picks the stamps and the ground's character. */
  styles(k: Knobs, ctx: SculptCtx): readonly (readonly [string, number])[];
  ground: GroundPiece<S>;
  gap: GapStyle<S>;
  stamps?: StampSet<S>;
  /** Stamps that stand on the ground as it lies, once it's laid, in groups each counted before it's placed (trees, spires). */
  standing?: readonly StandingStamps<S>[];
  /** The landmark's site (default `claimSite`), with whatever room the set keeps round it. */
  site?(c: Course<S>): Claim | null;
  /** How many of the level's parts the landmark's own crossing takes (default: one, when the concept owns one). */
  owns?(concept: Concept, k: Knobs, attempt: number, challenges: number): number;
  /** Before the crossings: crossings of the set's own shape (a lava lake's stepping stones), which take from `c.hardLeft`. */
  plan?(c: Course<S>): void;
  /** After the crossings, before the stamps: what the set reserves for itself (a donjon at the goal). */
  reserve?(c: Course<S>): void;
  /** After the stamps, before the standing ones and the landmark: dressing on finished ground. */
  dress?(c: Course<S>): void;
  /** After the landmark: dressing that keeps off it. */
  crown?(c: Course<S>, landmark: Landmark | null): void;
  /** The finished shape, last (glacier lays its ice). */
  post?(shape: Shape, c: Course<S>): Shape;
}

/** A course being built: everything a kit's hooks may read or add to. */
export interface Course<S> {
  ctx: SculptCtx;
  rng: Rng;
  k: Knobs;
  g: Grid;
  slots: Slots;
  style: string;
  surf: number[];
  locked: Uint8Array;
  state: S;
  claim: Claim | null;
  challenges: number;
  own: number;
  /** Hard crossings still to place. */
  hardLeft: number;
  gaps: Gap[];
  sRow: number;
  gRow: number;
}

/** A level set: one theme's pieces, for every builder to compose. */
export interface SetKit {
  theme: ThemeId;
  /** Course pieces (course, climb, descent builders), over ground. */
  course?: CourseKit;
  /** Or course pieces for a chain of bodies over a drop. */
  chain?: ChainKit;
  /** Or course pieces for a level cut from solid rock. */
  carved?: CarvedKit;
  /** Tower pieces (the tower builder): floors, connectors, shell. */
  tower?: TallKit;
  /** Applied to every tower this set builds (glacier lays its ice). */
  towerPost?(shape: Shape, ctx: SculptCtx): Shape;
}

/** A level builder: one shape or mode, composing any set's kit. */
export interface BuilderDef {
  /** What it builds, in words. */
  about: string;
  /** The levels it builds. */
  takes(p: LevelProfile): boolean;
  /** The kit pieces it asks for (KIT_KINDS ids). */
  asks: readonly string[];
  /** False when it raises no landmark (a mode's arena is the stage itself): its levels roll no stage concept. */
  landmark?: false;
  /** What its levels promise in every set, as data: the pipeline holds each level to `each`, tests/conformance every set to all of it. */
  contract?: BuilderContract;
  build(ctx: SculptCtx, set: SetKit): Shape;
}

/**
 * A builder's promises about the levels it builds, from every set's kit (src/gen/AGENTS.md → Set kits and level
 * builders). Numbers are measured by `measureLevel` (../measure.ts), the same one `pnpm level` prints. `each` holds for
 * every level: the pipeline rejects an attempt that breaks it (`builderFaults`) and conformance checks it on every
 * level it builds. `set` and `all` are shares over many levels, so only the sweep in tests/stats checks them.
 */
export interface BuilderContract {
  each?: {
    /** Share of the set pieces it asks for (`GenInfo.placement.asked`) that stand, at least. */
    fill?: number;
    /** Most copies of one recipe among them. */
    repeat?: number;
    /** Loot boxes it hangs when its profile deals them, at least. */
    boxes?: number;
    /** Leg Days it floats when its profile asks for them, at least `count`, each on a lip a slip off falls `drop` rows or more. */
    surges?: { count: number; drop: number };
    /** Its boxes (or stands) in mirrored pairs across the middle, an odd one on the middle. */
    boxesMirrored?: true;
    /** No box or stand in or beside a set piece, its hazards' reach or its shots' line over its cycle (gen/level/harm.ts: a simulation). */
    boxesClear?: true;
    /** Rows the field stands on, at least. */
    tiers?: number;
    /** Rows of terrain either side column runs, fewer than this: a knock carries you off the map. */
    sideWall?: number;
    /** No set piece's hazard, moving solid or shot gets into a spawn's safe zone over its cycle (conformance only: a simulation). */
    clearSpawns?: true;
    /**
     * From each end a bare way to the other end, and to the centrepiece, with every cell a set piece that hurts takes
     * counted as a wall whatever its timing: hazards stay, but there's always a way round them (`clearWayFaults`).
     */
    clearWay?: true;
    /**
     * A centrepiece stands (`Shape.centre`: the set's hazard laid first, in the room the builder built round it), and
     * at least this share of the stand cells the field reaches are near it.
     */
    centre?: number;
  };
  /** Over each set's levels. */
  set?: {
    /** Mean share of the set pieces asked for that stand, at least. */
    fill?: number;
    /** Distinct recipes its levels stand between them, at least. */
    kinds?: number;
    /** Mean stand cells the field reaches, at least this share of the busiest set's. */
    stands?: number;
  };
  /** Over every set's levels together. */
  all?: {
    /** Mean share of stand cells with no way to die near them, under this. */
    safe?: number;
    /** Mean share of stand cells with a drop beside them, over this. */
    edgy?: number;
    /** Share of levels whose field reaches the top third, over this. */
    high?: number;
    /** Mean share of terrain mirrored across the middle, over this. */
    mirrored?: number;
    /** Its shapes (the style's last segment): exactly these come up, each in more than `share` of the levels. */
    shapes?: { names: readonly string[]; share: number };
    /** Mean share of stand cells near the centrepiece, over this. */
    centre?: number;
  };
}

/** One body of a chain: a mooring, an asteroid, a building. `kind` is the set's own word for it. */
export interface Body {
  kind: string;
  w: number;
}

/** A chain's plan from its kit: the bodies left to right and the voids before each (one more than bodies, the last before the goal dock). */
export interface ChainLayout<S> {
  bodies: Body[];
  gaps: number[];
  /** Which voids are hard crossings (no jump clears them). */
  hard: boolean[];
  /** Docks the layout fixed itself (a skyline's first and last roofs are bodies); absent: the builder splits the spare columns between them. */
  docks?: { l: number; r: number; sTop: number; gTop: number };
  state: S;
}

/**
 * The chain kit: a set whose course is bodies over a drop, a dock at each end (harbor's moorings over water,
 * space's asteroids or station modules over the void, rooftops' buildings over the street). The builder sizes the
 * docks, sets their rows on the ramp and hints the hard voids; the kit lays out the bodies and builds each piece.
 */
export interface ChainKit<S = unknown> {
  name: string;
  /** Rows the route may climb (`knobs`), when the set's bodies can't follow a steeper ramp. */
  maxClimb?: number;
  style(rng: Rng, k: Knobs, ctx: SculptCtx): string;
  /** Rows of drop below the docks' tops, [min, max]: the builder rolls the level's base row from it. */
  depth: readonly [number, number];
  /** The parts the level asks for, from the `rollChallenges` ask (space: one on a classic level). */
  parts?(asked: number, k: Knobs): number;
  layout(rng: Rng, k: Knobs, style: string, challenges: number, base: number): ChainLayout<S>;
  dock: {
    /** Narrowest dock: a pocket and its edge. */
    min: number;
    /** Rows a dock's top keeps from the top and the bottom of the level. */
    clamp: readonly [number, number];
    /** Floor depth under the pockets (`Pocket.depth`); absent: to the bottom. */
    depth?: number;
    build(g: Grid, rng: Rng, x0: number, x1: number, top: number, side: 'left' | 'right', c: ChainCourse<S>): void;
  };
  /** A body's deck row: `at` is where its void starts, `x0` where it does, `prev` the stand row before the void. */
  deck(rng: Rng, b: Body, i: number, at: number, x0: number, prev: number, c: ChainCourse<S>): number;
  /** Build body `i` on columns x0..x0+w-1 at deck row `top` (`hard`: the void before it is a hard crossing); returns its stand row at its right edge. */
  body(g: Grid, rng: Rng, b: Body, i: number, x0: number, top: number, hard: boolean, c: ChainCourse<S>): number;
  /** Once every body is in. */
  dress?(c: ChainCourse<S>): void;
  /** A level round a stage concept's landmark, laid out the set's own way (TODO 32: onto the plan). */
  stage?(ctx: SculptCtx): Shape;
}

/** A chain being built. */
export interface ChainCourse<S> {
  ctx: SculptCtx;
  rng: Rng;
  k: Knobs;
  g: Grid;
  style: string;
  base: number;
  challenges: number;
  state: S;
  dockL: number;
  dockR: number;
  sTop: number;
  gTop: number;
  /** Every body laid: columns and deck row. */
  tops: { x: number; w: number; top: number }[];
  /** Every void, columns a..b (empty when a > b). */
  voids: { a: number; b: number; hard: boolean }[];
}

/**
 * The carved kit: a set cut from solid rock (mine). The builder fills the level, carves tunnel floors through it
 * (alternating up and down on a course, stepping up a climb or down a descent), joins them with the kit's
 * connector, and cuts chasms in the floors, sealing the rock over a hard one so nobody goes over the top; the kit
 * hollows the rock, sizes the chasms and dresses the tunnels.
 */
export interface CarvedKit {
  name: string;
  styles(k: Knobs, ctx: SculptCtx): readonly (readonly [string, number])[];
  /** Hollow the solid fill (caverns). */
  rock(g: Grid, rng: Rng, k: Knobs, style: string): void;
  /** Tunnel segments a classic level gets, by style and the ask. */
  segments(style: string, challenges: number): number;
  /** A tunnel's headroom. */
  headroom(rng: Rng, style: string): number;
  /** Join two tunnel floors: a shaft columns x..x+4, from row `top` down to the floor at `bot`. */
  connector(g: Grid, x: number, top: number, bot: number, rise: number): void;
  /** A chasm's width (`hard`: no jump clears it under the tunnel's low roof). */
  chasm(rng: Rng, hard: boolean): number;
  /** Once the tunnels and chasms are in; `rows` is the stand row per column (NaN off a tunnel). */
  dress?(g: Grid, rng: Rng, k: Knobs, style: string, rows: number[]): void;
  /** A level round a stage concept's landmark, laid out the set's own way (TODO 32: onto the plan). */
  stage?(ctx: SculptCtx): Shape;
}
