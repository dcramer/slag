import type { Difficulty, LevelProfile } from '../../sim/level';
import { lowestOpen, type Tide } from '../../sim/tide';
import { stretchesOf } from './difficulty';

/**
 * The slag a Rising Slag level carries (sim/tide.ts), built from its profile: a slow floor pace anyone outclimbs,
 * and a leash to the leader whose length is each stretch's difficulty (./difficulty.ts `TOWER_CURVE`). Fitted to
 * bots against the difficulty standard (src/game/expectations.ts, tests/stats/slag-climb.test.ts).
 */

/** The floor pace: boils 3 s, then 1.2 tiles/s gaining 0.05 a second. A slow lobby climbs ahead of it. */
export const SLAG_FLOOR = { wait: 3, speed: 1.2, gain: 0.05 } as const;

/** Rows the slag may lag the leader in a stretch of each tier: most of a screen low in the tower, half of one in its hard stretch. */
export const TIER_LEASH: Record<Difficulty, number> = { gentle: 18, medium: 15, hard: 11 };

/** Sudden death: 35 s after GO the leash shortens 0.4 rows a second, down to 2, so a round always ends. */
export const SQUEEZE = { after: 45, rate: 0.4, min: 2 } as const;

/** How fast the slag closes on a leader more than the leash ahead, tiles/s: past a run, so falling behind is out. */
export const RUSH = 10;

/** The tide for a level of this profile and terrain. */
export function slagTide(profile: LevelProfile, tiles: Uint8Array, w: number, h: number): Tide {
  return {
    ...SLAG_FLOOR,
    from: lowestOpen(tiles, w, h),
    leash: stretchesOf(profile).map((s) => ({ from: s.from, rows: TIER_LEASH[s.tier] })),
    squeeze: SQUEEZE,
    rush: RUSH,
  };
}
