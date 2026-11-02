import type { Rng } from '../../core/rng';
import type { TileRect } from '../../sim/level';
import type { ThemeId } from '../../themes';
import type { Theme } from '../theme';

/** The terrain a sculptor produces: everything in a Level except identity, look and set pieces. */
export interface Shape {
  /** Row-major LEVEL_W×LEVEL_H tile kinds (T_EMPTY/T_SOLID/T_ONEWAY). */
  tiles: Uint8Array;
  spawn: { tx: number; ty: number };
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
}

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
}

/** Builds a level shape for a theme. Must be deterministic in ctx.rng. */
export type Sculptor = (ctx: SculptCtx) => Shape;
