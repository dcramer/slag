import { deriveSeed, Rng } from '../../core/rng';
import type { Difficulty } from '../../sim/level';

/**
 * How much precision a level asks of you. Every level rolls one (owner
 * decision 2026-11-04: a fifth gentle, half medium, the rest hard, so a match
 * deals a spread instead of one flat mix), and every knob that decides how
 * tight the running is reads it from here: how long the jumps are, how many
 * stepping stones, how many crossings, how tall a landmark's steps are, how
 * many hazards and how nasty. Measured by how often bots with Easy and Normal
 * hands die on a level (tests/stats/difficulty.test.ts): on a gentle level
 * nobody should; on a medium one sloppy hands sometimes do; on a hard one
 * steady hands sometimes do too.
 */

export const DIFFICULTIES = ['gentle', 'medium', 'hard'] as const satisfies readonly Difficulty[];

/** Shares of levels at each difficulty. */
export const DIFFICULTY_WEIGHTS: readonly (readonly [Difficulty, number])[] = [
  ['gentle', 2],
  ['medium', 5],
  ['hard', 3],
];

export interface DifficultyKnobs {
  /** Share of jumpable gaps that are a walking hop near its limit (sculptors/common.ts `jumpGap`). */
  walk: number;
  /** Share that are the longest running jump there is; the rest fall between. */
  full: number;
  /** Share of jumpable pits that get stepping stones (`jumpCrossing`), and the most stones in one. */
  stones: number;
  maxStones: number;
  /** Jumpable crossings per classic level width (`jumpCount`), inclusive range. */
  crossings: readonly [number, number];
  /** Tiles of a full jump a landmark's step leaves spare (`easyRise`): less is a tighter climb. */
  riseSlack: number;
  /**
   * Second routes (lanes.ts): platform length of a lane of short platforms, the weight of a lane of long
   * floors you walk along beside them, and how far short of a walking jump's limit a hop between them may
   * fall. A second route as easy as a stroll is a way round every jump on the first.
   */
  laneLen: readonly [number, number];
  floorLanes: number;
  hopSlack: number;
  /** Added to the profile's set-piece count (capped 0–4), and the range its danger roll is mapped into. */
  hazards: number;
  danger: readonly [number, number];
  /**
   * Tight jumps the level's more forgiving route has (precision.ts), inclusive: the pipeline draws up to
   * `draws` sculpts looking for one that fits, then takes the nearest. Each draw is a whole sculpt, so the
   * cap is what picking costs.
   */
  precision: readonly [number, number];
  draws: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyKnobs> = {
  gentle: {
    walk: 0.7,
    full: 0,
    stones: 0,
    maxStones: 0,
    crossings: [1, 2],
    riseSlack: 1,
    laneLen: [2, 4],
    floorLanes: 2,
    hopSlack: 1,
    hazards: -1,
    danger: [0, 0.6],
    precision: [0, 0],
    draws: 3,
  },
  medium: {
    walk: 0.2,
    full: 0.45,
    stones: 0.45,
    maxStones: 3,
    crossings: [2, 4],
    riseSlack: 1,
    laneLen: [1, 3],
    floorLanes: 1,
    hopSlack: 1,
    hazards: 0,
    danger: [0, 1],
    precision: [1, 99],
    draws: 3,
  },
  hard: {
    walk: 0.1,
    full: 0.65,
    stones: 0.6,
    maxStones: 3,
    crossings: [3, 5],
    riseSlack: 0.5,
    laneLen: [1, 2],
    floorLanes: 0,
    hopSlack: 0,
    hazards: 1,
    danger: [0.4, 1],
    precision: [2, 99],
    draws: 4,
  },
};

/** A level's difficulty, from a stream of its own so no other roll moves with it. */
export function rollDifficulty(seed: number): Difficulty {
  return new Rng(deriveSeed(seed, 'difficulty')).weighted(DIFFICULTY_WEIGHTS);
}

let current: Difficulty = 'medium';

/**
 * The difficulty the sculptor helpers build to, set by the pipeline per level
 * beside its gravity (probe.ts): sculpting is synchronous, so a module-level
 * "current" is safe and keeps every gap and step helper's signature unchanged.
 */
export function setLevelDifficulty(d: Difficulty): void {
  current = d;
}

export function levelDifficulty(): Difficulty {
  return current;
}

export function difficultyKnobs(d: Difficulty = current): DifficultyKnobs {
  return DIFFICULTY[d];
}
