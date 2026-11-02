import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { LevelProfile, RouteShape, SizeClass, TileRect } from '../../sim/level';
import type { Grid } from '../level/kit';
import type { Knobs } from '../level/sculptors/common';
import type { Piece, Site } from '../setpieces/place';
import type { TerrainKind } from '../theme';
import type { Footing, Scale } from './contract';

/**
 * A stage concept: the place a level is (docs/SETPIECES.md). The concept is
 * rolled once per level; each sculpt attempt claims a site for its landmark,
 * builds the landmark's static structure as tiles, and after weather the
 * pipeline bolts its movers and hazards on. One file per theme in this
 * folder, registered in CONCEPTS (./index.ts).
 *
 * Movers are never on the proof: every concept keeps a static way past
 * itself. The one exception is a carrier (`carrier`), whose ride is proven by
 * gen/level/ride.ts.
 */
export interface Concept {
  /** 'great-wheel', 'haunted-wing'. Unique within its theme. */
  id: string;
  weight: number;
  sizes: readonly SizeClass[];
  /** Route shapes it fits; any when absent. */
  routes?: readonly RouteShape[];
  /**
   * Anything else about the level it needs, checked with size and route when the concept is rolled: a
   * landmark that owns the crossing may have no room beside it on a classic level whose gravity stretches the
   * crossing. A concept that can't stand up costs attempts and ends plain, so say so up front.
   */
  fits?(p: Partial<LevelProfile>): boolean;
  /** Columns and rows it needs, measured from jumpProfile() at the level's gravity, never fixed numbers. */
  box(k: Knobs, rng: Rng): { w: number; h: number };
  /**
   * The landmark owns the level's hard crossing: `build` puts the gap inside
   * itself (sized with `hardGap(rng, parts)`, recorded with `pit` or
   * `hintGap`), and the sculptor builds that many fewer of its own.
   */
  ownsCrossing: boolean;
  /**
   * Static structure, written as tiles into the grid inside `at` (walls,
   * floors, stairs, the axle tower), standing on the ground row under it.
   * Returns the anchors movers hang from and the air they sweep. `parts` is
   * how many parts its crossing should take (0 unless it owns the crossing).
   */
  build(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark;
  /**
   * Movers and hazards bolted onto the anchors, every one required: each
   * goes through `finalize` and must keep the level's solution, or the whole
   * attempt is rejected. Lazy, so a later piece sees the cells earlier ones
   * took (`s.taken`).
   */
  pieces(rng: Rng, s: Site, l: Landmark): Iterable<Piece>;
  /** Recipe names (setpieces/<theme>.ts) the filler draws from: the place's hazard family. */
  family: readonly string[];
  /** Hazard slots the landmark's pieces use up (profile.hazards); default, how many it placed. */
  budget?: number;
  /**
   * Level names for a level with this concept, `{place}` standing for the
   * theme's place name ("The Great Wheel of {place}"). One is picked per
   * level; absent keeps the place name.
   */
  names?: readonly string[];
  /**
   * A contraption big enough to carry you over a gap no part could: a lift
   * or ferry parked at both ends, a wheel rim level with both banks. Its
   * pieces go in before the proof, and at least one must carry a runner
   * standing still from one bank to the other (`rideProof`, gen/level/ride.ts)
   * across `carrierReach()` plus `minGap` columns or rows, or the attempt is
   * rejected. That gap is not the level's part-requiring crossing: the parts
   * policy holds elsewhere. A carrier docks flush with its banks, so its
   * piece sets `crushOk` (finalize's push clearance would refuse the dock);
   * the ride proof checks the rider's own room.
   */
  carrier?: { minGap?: number };
  /*
   * The contract (./contract.ts): declared here, enforced by the pipeline and tests/conformance. Absent
   * fields take `defineConcept`'s defaults: large, grounded, two ways through.
   */
  /** `large` (a third of the view along its biggest side) or `grand` (it owns the view), measured from its box. */
  scale?: Scale;
  /** What holds it up: `grounded` (default), `hanging` from a ceiling, or `floating` in a theme whose ground floats. */
  footing?: Footing;
  /** Distinct ways through or past it, measured on the level's route graph; at least 2. */
  ways?: number;
  /** What its seed changes ('storeys', 'door side', 'stair side'...), for people; the engine measures the layout itself. */
  varies?: readonly string[];
}

/** What a concept built: the structure's box, the air its movers need, where they hang from. */
export interface Landmark {
  concept: string;
  /** The structure's box. */
  rect: TileRect;
  /** Reserved empty space movers sweep: lanes, filler set pieces and decor stay out. */
  air: TileRect[];
  /** 'hub', 'shaftTop', 'shaftBottom', 'pourLip', ... (tiles). */
  anchors: Record<string, Vec>;
  /** Render-only: how the landmark's tiles are drawn (planks, brick, metal...). */
  skin?: TerrainKind;
}
