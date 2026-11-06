import type { Rng } from '../../core/rng';
import type { Personality } from '../personality';
import type { BrainView, Intent, SelfSense } from '../types';

/** How a bot plays one race of its mode, from GO to the end: made fresh for every race. */
export interface Strategy {
  /** This frame's intent, while its runner is alive, racing and the countdown is over. */
  think(v: BrainView, me: SelfSense): Intent;
}

/**
 * Where a mode wants the parts in its way, when that isn't the way everyone runs to a flag (`BrainView.route`):
 * `cells` (y * w + x) where a part does its work, best first, and `keeps`, whether any part may have its origin at
 * (tx, ty) at all.
 */
export interface Lay {
  cells: readonly number[];
  keeps(tx: number, ty: number): boolean;
}

/**
 * A mode's way to race (`STRATEGIES`). `make` gets the brain's race stream, so a bot's choices replay, and its
 * personality. `lay`, if the mode has one, is where its parts go in the place phase (the brain's placing reads it
 * in place of the route).
 */
export interface StrategyDef {
  make(rng: Rng, traits: Personality): Strategy;
  lay?(v: BrainView): Lay;
}
