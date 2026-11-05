import { type Difficulty, type LevelProfile, LOOP_BAND, LOOP_SPAWN } from '../../sim/level';
import { lowestOpen, type Tide } from '../../sim/tide';
import { stretchesOf } from './difficulty';

/**
 * The slag a Rising Slag level carries (sim/tide.ts), built from its profile: a slow floor pace anyone outclimbs,
 * and a leash to the leader whose length is each lap's difficulty (./difficulty.ts `LAP_TIERS`). Fitted to
 * bots against the difficulty standard (src/game/expectations.ts, tests/stats/slag-climb.test.ts).
 */

/** The floor pace: boils 3 s, then 1.2 tiles/s gaining 0.05 a second. A slow lobby climbs ahead of it. */
export const SLAG_FLOOR = { wait: 3, speed: 1.2, gain: 0.05 } as const;

/**
 * How far behind the leader you can fall before the slag has you, in seconds of climbing, a lap of each tier: the
 * way a racer's camera that follows the leader is set (about a screen behind at a run is 3–4 s). Read in rows at
 * the pace a Normal bot climbs (`CLIMB_PACE`, measured by tests/stats/slag-climb.test.ts's splits).
 */
export const TIER_LEASH_SECONDS: Record<Difficulty, number> = { gentle: 4.5, medium: 3.75, hard: 3 };

/** Rows a second a Normal bot climbs a shaft: what a second behind the leader is, in rows. */
export const CLIMB_PACE = 4;

/** Rows the slag may lag the leader in a lap of each tier. */
export const TIER_LEASH: Record<Difficulty, number> = {
  gentle: TIER_LEASH_SECONDS.gentle * CLIMB_PACE,
  medium: TIER_LEASH_SECONDS.medium * CLIMB_PACE,
  hard: TIER_LEASH_SECONDS.hard * CLIMB_PACE,
};

/** Sudden death: 35 s after GO the leash shortens 0.4 rows a second, down to 2, so a round always ends. */
export const SQUEEZE = { after: 30, rate: 0.4, min: 2 } as const;

/** Rows under a loop's spawn floor the slag starts at: a storey's depth, a few seconds of the floor pace. */
export const LOOP_HEAD_START = 8;

/** How fast the slag closes on a leader more than the leash ahead, tiles/s: past a run, so falling behind is out. */
export const RUSH = 10;

/** The tide for a level of this profile and terrain. */
export function slagTide(profile: LevelProfile, tiles: Uint8Array, w: number, h: number): Tide {
  return {
    ...SLAG_FLOOR,
    // A loop starts it a storey's depth under the spawn's floor, in the lap below, so the spawn storey is a head start,
    // not a trap; anywhere else, at the lowest open row.
    from: profile.size === 'tall' ? profile.h - LOOP_BAND + LOOP_SPAWN + 1 + LOOP_HEAD_START : lowestOpen(tiles, w, h),
    leash: stretchesOf(profile).map((s) => ({ from: s.from, rows: TIER_LEASH[s.tier] })),
    squeeze: SQUEEZE,
    rush: RUSH,
  };
}
