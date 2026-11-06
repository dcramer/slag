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
  // Measured lap by lap round the open shaft (seeds 1–32; gen/level/builders/shaft.ts): Easy 88 75 86, Normal 88 93 88,
  // Hard 100 84 96, the slag a racer's-camera gap behind the leader (4.5, 3.75 and 3 s of climb, squeezing from 30 s;
  // gen/level/tide.ts). Every tier passes above its targets: a bot rarely slips on ledges, and one that does lands a
  // row down, so it's the squeeze that ends a lone climb. Tightening the leash to 4, 2.75 and 2 s moved no lap more
  // than 7 points. Laps that harden for a lone climber are open (docs/TODO.md → 31).
  slag: {
    easy: { gentle: [0.74, 1], medium: [0.58, 0.9], hard: [0.68, 1] },
    normal: { gentle: [0.74, 1], medium: [0.78, 1], hard: [0.72, 1] },
    hard: { gentle: [0.86, 1], medium: [0.7, 0.98], hard: [0.82, 1] },
  },
};

/**
 * Catch-up in Rising Slag: the share of rounds the runner highest 15 s after GO (`at`, frames) goes on to win, four
 * Normal bots on a bare loop (seeds 1–128, the rounds where both are known; tests/stats/slag-catch-up.test.ts).
 * `boxes`: the loop's own boxes as built. `items` and `bare`: what those boxes deal by rank put in every empty hand
 * every 5 s, then used by the bots' item tactics, or never used. Measured in the open shaft 69, 65 and 61 (in
 * storeys 60, 59 and 55), bots spread over the shaft each on a lane of its own, the loop's boxes handing over what
 * they deal, and whoever is behind bumping a rival off a board from below (under one bump a round). Bare, the bump
 * took the early leader from 78% to 61%; with items the rounds are too few to tell 3 to 5 points apart. The lead
 * changes hands under twice a round. The target, from the lead-camera racer, is the early leader winning about
 * half the time (docs/MODES.md); these bands only catch a regression.
 */
export const LEAD_HOLDS = {
  at: 15 * 60,
  bands: {
    boxes: [0.54, 0.8],
    items: [0.44, 0.7],
    bare: [0.56, 0.82],
  },
} as const satisfies { at: number; bands: Record<string, readonly [number, number]> };
