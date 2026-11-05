/**
 * What difficulty is supposed to mean, as numbers (docs/DESIGN.md → Difficulty). One expectation for every mode:
 * how often a lone bot of each level gets through a stretch of route of each tier (gen/level/difficulty.ts
 * `Stretch`). A race level is one stretch, finished at the flag; a Rising Slag tower is a stack of them, passed by
 * climbing out of the top of each before the slag catches you. The stats suites in tests/stats/ measure against
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
 * (seeds 1–40 for a race, 1–16 for a tower), so they catch a regression, not the distance to the target. A band
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
  // Measured Easy 81 8 (one reached hard), Normal 94 67 40, Hard 100 81 69, the slag fitted to Normal
  // (sim/tide.ts). Every death in a tower is the slag, so slowness is what it punishes: Easy bots climb too slowly
  // for any pace that still presses Normal and Hard, and fall far short of their medium target.
  slag: {
    easy: { gentle: [0.65, 0.95], medium: [0, 0.35], hard: [0, 0.4] },
    normal: { gentle: [0.8, 1], medium: [0.5, 0.85], hard: [0.25, 0.65] },
    hard: { gentle: [0.88, 1], medium: [0.65, 0.95], hard: [0.5, 0.85] },
  },
};
