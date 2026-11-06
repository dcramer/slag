/**
 * What difficulty is supposed to mean, as numbers (docs/DESIGN.md → Difficulty). One expectation for every mode:
 * how often a lone bot of each level gets through a stretch of route of each tier (gen/level/difficulty.ts
 * `Stretch`). A race level is one stretch, finished at the flag; a Rising Slag loop has one a lap, passed by
 * climbing the lap before the slag catches you. The stats suites in tests/stats/ measure against
 * these, and nothing in the game reads them: they're the owner's targets and the bands a measurement may wander in.
 */
import type { Difficulty } from '../sim/level';
import type { BotLevel } from './match';
import type { ModeId } from './modes';

/** The owner's targets: the share of stretches of each tier a bot of each level gets through. */
export const PASS_TARGETS: Record<BotLevel, Record<Difficulty, number>> = {
  easy: { gentle: 0.75, medium: 0.5, hard: 0.3 },
  normal: { gentle: 0.9, medium: 0.7, hard: 0.5 },
  hard: { gentle: 0.95, medium: 0.85, hard: 0.7 },
};

/**
 * Where each mode's measurement may land today before its suite fails: bands around what the suite measured
 * (seeds 1–40 for a race, 1–32 for a loop), so they catch a regression, not the distance to the target. A band
 * that sits away from its target is a known gap, said beside it; close the gap and move the band, never the target.
 * Only modes measured by stretches a bot gets through have them: a brawl has no stretch to get through.
 */
export const PASS_BANDS: Partial<Record<ModeId, Record<BotLevel, Record<Difficulty, readonly [number, number]>>>> = {
  // Measured Easy 73 58 58, Normal 93 65 60, Hard 93 78 88. A hard level plays little harder than a medium one so
  // far, because only about half land in their band (docs/TODO.md → Level follow-ups): the hard column should fall
  // toward its target as hard layouts land, with no change here.
  race: {
    easy: { gentle: [0.6, 0.85], medium: [0.45, 0.72], hard: [0.45, 0.72] },
    normal: { gentle: [0.8, 1], medium: [0.55, 0.82], hard: [0.5, 0.8] },
    hard: { gentle: [0.88, 1], medium: [0.68, 0.92], hard: [0.7, 0.95] },
  },
  // Measured lap by lap round the open shaft (seeds 1–32; gen/level/builders/shaft.ts): Easy 91 86 80, Normal 94 83 100,
  // Hard 100 84 96, the slag 4.5, 3.5 and 2.5 s of climb behind the leader (gen/level/tide.ts). Every tier passes above
  // its target: a Normal bot falls a rise or more about once in four laps on bricks (a medium shaft) and twice in three
  // (a hard one), seldom further than the hard lap's 14 rows, so it's the squeeze that ends a lone climb. A few seeds
  // swing a lap 20 points. Laps that cost a slip as the targets ask are open (docs/TODO.md → 31).
  slag: {
    easy: { gentle: [0.76, 1], medium: [0.7, 1], hard: [0.62, 0.98] },
    normal: { gentle: [0.8, 1], medium: [0.68, 0.98], hard: [0.78, 1] },
    hard: { gentle: [0.86, 1], medium: [0.7, 0.98], hard: [0.8, 1] },
  },
};

/**
 * Catch-up in Rising Slag: the share of rounds the runner highest 15 s after GO (`at`, frames) goes on to win, four
 * Normal bots on a bare loop (seeds 1–128, the rounds where both are known; tests/stats/slag-catch-up.test.ts).
 * `boxes`: the loop's own boxes as built. `items` and `bare`: what those boxes deal by rank put in every empty hand
 * every 5 s, then used by the bots' item tactics, or never used. Measured 56, 57 and 64 (512 seeds: 64, 59, 66), from
 * 66, 50 and 69 when a third of rounds were over by 15 s (512 seeds: 69, 58, 66). About 115 rounds are judged in each,
 * so ±5. The lead changes hands about 1.5 times a round (2 with items in every hand). The target, from the lead-camera
 * racer, is the early leader winning about half the time (docs/MODES.md); these bands only catch a regression.
 */
export const LEAD_HOLDS = {
  at: 15 * 60,
  bands: {
    boxes: [0.44, 0.68],
    items: [0.45, 0.69],
    bare: [0.52, 0.76],
  },
} as const satisfies { at: number; bands: Record<string, readonly [number, number]> };

/**
 * How long a Rising Slag round lasts, the same four bots and loop's boxes (tests/stats/slag-catch-up.test.ts): at most
 * `early` of rounds over by 15 s after GO, and the median round inside `median` seconds, the lead-camera racer's short
 * round. Measured 8% and 25.5 s (from 41% and 16 s, before the leash opened long and the field started spread out).
 */
export const SLAG_ROUNDS = { early: 0.15, median: [20, 40] } as const;
