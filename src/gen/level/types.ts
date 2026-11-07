import type { Rng } from '../../core/rng';
import type { LevelProfile, TileRect } from '../../sim/level';
import type { ThemeId } from '../../themes';
import type { Concept, Landmark } from '../stage/types';
import type { Theme } from '../theme';

/** The terrain a sculptor produces: everything in a Level except identity, look and set pieces. */
export interface Shape {
  /** Grid size in tiles (the profile's w×h). */
  w: number;
  h: number;
  /** Row-major w×h tile kinds (T_EMPTY/T_SOLID/T_ONEWAY). */
  tiles: Uint8Array;
  spawn: { tx: number; ty: number };
  /** More cells a race spawns in after `spawn` (Level.spawns): a start line across a shaft's floor. */
  spawns?: { tx: number; ty: number }[];
  goal: { tx: number; ty: number };
  protectedRects: TileRect[];
  /** Free-form label for debugging/tools ("farm:fields", "legacy:caverns", ...). */
  style: string;
  /**
   * Optional bridge spots the sculptor built in on purpose (left cell of a
   * 3-wide platform). The validator tries these first; it still searches
   * generically, so hints are an optimization, never a requirement.
   */
  bridgeHints?: BridgeHint[];
  /**
   * The sculptor built a crossing meant to need props. The pipeline rejects
   * the shape (and retries) if the level turns out finishable bare anyway, so
   * the props-needed share tracks each theme's challenge rate.
   */
  wantsProps?: boolean;
  /**
   * Column spans (inclusive) of the crossings meant to need a bridge. Route
   * lanes (./lanes.ts) stay clear of them so a hard gap stays hard.
   */
  crossings?: [number, number][];
  /** The level is cut from solid rock: a second route is a carved gallery, not platforms in the air. */
  carve?: boolean;
  /** Columns the builder keeps open for set pieces (an arena's halls, [x0, x1] inclusive): a second route keeps out of them. */
  open?: [number, number][];
  /** Per-tile ground kinds (sim/ground.ts), for themes that lay their own: glacier ice. Becomes Level.ground. */
  ground?: Uint8Array;
  /** The stage concept's landmark, when the sculptor raised one (sculptors/common.ts: claimSite, raiseLandmark). */
  landmark?: Landmark;
  /**
   * What the builder laid the level round (a brawl's arena): the kind of room, and its cells, where the set's own
   * hazards stand first, before any other set piece, as the level's centrepiece (setpieces/place.ts, `PlacerOpts.centre`).
   */
  centre?: Centre;
}

/**
 * A room a builder lays for its level's centrepiece: its kind (`SculptCtx.noCentre` names it), the cells a centrepiece
 * stands in, and whether they're its alone (the other set pieces keep out) or shared once it stands (an arena's halls).
 */
export interface Centre {
  kind: string;
  rooms: TileRect[];
  alone?: boolean;
}

/** Width of a bridge prop in tiles. */
export const BRIDGE_W = 3;

/** Left cell of a BRIDGE_W×1 solid platform a player could place. */
export interface BridgeHint {
  x: number;
  y: number;
}

export interface SculptCtx {
  rng: Rng;
  themeId: ThemeId;
  theme: Theme;
  /** 0-based attempt number; sculptors may relax constraints on later attempts. */
  attempt: number;
  /** Variety knobs: world size (build a Grid of profile.w×profile.h), density, route shape, prop need. */
  profile: LevelProfile;
  /** Uniform [0, 1) rolled once per level, for decisions that must not change between attempts. */
  challenge: number;
  /** The level's stage concept (gen/stage), fixed per level; absent for a plain level. Sculptors give it a site with claimSite. */
  concept?: Concept;
  /** Centre kinds (`Shape.centre`) none of the set's hazards stood in, earlier in this draw: the builder lays another. */
  noCentre?: readonly string[];
}

/** Builds a level shape for a theme. Must be deterministic in ctx.rng. */
export type Sculptor = (ctx: SculptCtx) => Shape;
