import type { Rng } from '../../core/rng';
import type { Personality } from '../personality';
import type { BrainView, Intent, SelfSense } from '../types';

/** How a bot plays one race of its mode, from GO to the end: made fresh for every race. */
export interface Strategy {
  /** This frame's intent, while its runner is alive, racing and the countdown is over. */
  think(v: BrainView, me: SelfSense): Intent;
}

/**
 * A mode's way to race (`STRATEGIES`). `make` gets the brain's race stream, so a bot's choices replay, and its
 * personality.
 */
export interface StrategyDef {
  make(rng: Rng, traits: Personality): Strategy;
}
