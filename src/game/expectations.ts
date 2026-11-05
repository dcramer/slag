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
 */
export const PASS_BANDS: Record<ModeId, Record<BotLevel, Record<Difficulty, readonly [number, number]>>> = {
  // Measured Easy 73 58 58, Normal 93 65 60, Hard 93 78 88. A hard level plays little harder than a medium one so
  // far, because only about half land in their band (docs/TODO.md → Level follow-ups): the hard column should fall
  // toward its target as hard layouts land, with no change here.
  race: {
    easy: { gentle: [0.6, 0.85], medium: [0.45, 0.72], hard: [0.45, 0.72] },
    normal: { gentle: [0.8, 1], medium: [0.55, 0.82], hard: [0.5, 0.8] },
    hard: { gentle: [0.88, 1], medium: [0.68, 0.92], hard: [0.7, 0.95] },
  },
  // Measured lap by lap round the loop (seeds 1–32): Easy 63 75 53, Normal 88 75 43, Hard 84 74 75, the slag a
  // racer's-camera gap behind the leader (4.5, 3.75 and 3 s of climb, squeezing from 30 s; gen/level/tide.ts).
  // Normal sits within 7 points of its targets. Easy's later laps read high because only the Easy runs that got
  // through the first are counted there, and those are its good ones.
  slag: {
    easy: { gentle: [0.5, 0.8], medium: [0.58, 0.9], hard: [0.35, 0.72] },
    normal: { gentle: [0.78, 1], medium: [0.6, 0.9], hard: [0.28, 0.6] },
    hard: { gentle: [0.72, 0.96], medium: [0.6, 0.88], hard: [0.58, 0.9] },
  },
};

/**
 * Catch-up in Rising Slag: the share of rounds the runner highest 15 s after GO (`at`, frames) goes on to win, four
 * Normal bots on a bare loop (seeds 1–128, the rounds where both are known; tests/stats/slag-catch-up.test.ts).
 * `boxes`: the loop's own boxes as built. `items` and `bare`: what those boxes deal by rank put in every empty hand
 * every 5 s, then used by the bots' item tactics, or never used. Measured 59, 62 and 55: catch-up isn't there yet.
 * Bots use what they hold (about 640 uses), but the leader's defensive draws cancel the pack's attacks, and bots
 * hardly ever collect what a box pops. The target, from the lead-camera racer, is the early leader winning about
 * half the time (docs/MODES.md); these bands only catch a regression.
 */
export const LEAD_HOLDS = {
  at: 15 * 60,
  bands: {
    boxes: [0.46, 0.72],
    items: [0.49, 0.75],
    bare: [0.42, 0.68],
  },
} as const satisfies { at: number; bands: Record<string, readonly [number, number]> };
