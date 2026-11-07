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
  // Measured lap by lap round the open shaft with its regroup gates (seeds 1–32; gen/level/builders/shaft.ts,
  // gen/level/loop-gates.ts): Easy 91 83 58, Normal 97 87 81, Hard 97 71 77, the slag 4.5, 3.5 and 2.5 s of climb behind
  // the leader (gen/level/tide.ts). Before the gates, Easy 91 86 80, Normal 94 83 100, Hard 100 84 96: a lone bot waits
  // at a shut gate with the slag, but the squeeze runs on the clock, so the third lap comes later and tighter. A Normal
  // bot falls a rise or more about once in four laps on bricks (a medium shaft) and twice in three (a hard one), seldom
  // further than the hard lap's 14 rows. Hard's medium lap sits under its target; every other tier passes above it. A
  // few seeds swing a lap 20 points. Laps that cost a slip as the targets ask are open (docs/TODO.md → 31).
  slag: {
    easy: { gentle: [0.76, 1], medium: [0.68, 0.98], hard: [0.42, 0.76] },
    normal: { gentle: [0.84, 1], medium: [0.72, 1], hard: [0.64, 0.98] },
    hard: { gentle: [0.84, 1], medium: [0.56, 0.88], hard: [0.6, 0.94] },
  },
};

/**
 * Catch-up in Rising Slag: the share of rounds the runner highest 15 s after GO (`at`, frames) goes on to win, four
 * Normal bots on a bare loop (seeds 1–128, the rounds where both are known; tests/stats/slag-catch-up.test.ts).
 * `boxes`: the loop's own boxes as built. `items` and `bare`: what those boxes deal by rank put in every empty hand
 * every 5 s, then used by the bots' item tactics, or never used. Measured 43, 50 and 49 with two regroup gates a lap
 * (gen/level/loop-gates.ts; 512 seeds: 50, 47, 54), from 56, 57 and 64 before them (512: 64, 59, 66). About 120 rounds
 * are judged in each, so ±5. The lead changes hands about 3 times a round, from 1.5 (2 with items in every hand) before
 * the gates. The target, from the lead-camera racer, is the early leader winning about half the time (docs/MODES.md);
 * these bands only catch a regression.
 */
export const LEAD_HOLDS = {
  at: 15 * 60,
  bands: {
    boxes: [0.31, 0.55],
    items: [0.38, 0.62],
    bare: [0.37, 0.61],
  },
} as const satisfies { at: number; bands: Record<string, readonly [number, number]> };

/**
 * Brawl with bots (tests/stats/brawl.test.ts, docs/MODES.md → Brawl): four Normal bots on the bare arena (round 1
 * before any part, seeds 1–48) and through the first four rounds of a match as the parts pile up (seeds 1–16).
 * `draws`: the share of rounds nobody wins (the last ones out on one frame, or the time out). `seconds`: a round's
 * mean length from GO. `knocked`: the share of deaths with a rival's knock still credited (sim/items/common.ts
 * `BONK_CREDIT`), thrown or bumped into the level. How hard it's fought (tests/lib/bot-race.ts `Fight`): `contact`
 * and `hit`, seconds from GO to the first touch or bonk and to the first bonk; `uses`, items used a round; `still`
 * and `retreat`, the shares of frames in it standing still and moving away from the nearest rival; `gap`, the tiles
 * to that rival. Measured bare 6%, 25.6 s, 68%, 1.6 s, 3.8 s, 12.9 uses, 10%, 20%, 4.8 tiles; placed 2%, 23.7 s, 58%,
 * 1.3 s, 3.4 s, 10.8 uses, 10%, 19%, 4.3 tiles (25 of 48 and 31 of 64 rounds in 20–40 s, 4 and 5 under 10 s; 32 and 22
 * deaths off the sides of the map), on arenas of their own (gen/level/builders/arena.ts): tiers of ledges to the top
 * of the screen, open sides, three boxes or more, the middle filled. A knock kills more often, so rounds are a little
 * shorter, and the field, spread over the tiers, meets a little later and goes round more to get at a rival. The
 * arenas' first cut (one box short in a tenth of them, an empty middle, low gravity's gaps and tiers) measured bare
 * 0%, 23.7 s, 66%, 26 of 48 in 20–40 s, 41 off the sides; placed 8%, 21.4 s, 54%, 29 of 64, 30. From bare 8%, 26.6 s, 53%, 0.8 s, 3.8 s, 12.2 uses, 11%,
 * 17%, 3.9 tiles; placed 14%, 24.2 s, 39%, 0.8 s, 3.8 s, 8.9 uses, 15%, 15%, 4.0 tiles (28 of 48 and 28 of 64 in
 * 20–40 s, 4 and 10 under 10 s, 3 placed ones without a knock or a shove; 13 and 16 off the sides) on the race course
 * with walled ends, since the motor fights with haste (`StrategyDef.haste`, src/brain/motor.ts): it picks again as soon as its
 * target moves instead of playing out a move for where the target was, takes no pause for a rival's shove and only
 * what's left of one after a landing it read in the air, and lines up in a cell only where that wins the time back,
 * walking there rather than tapping. Before, the still frames were mostly its own care: on the bare arena 7.7% of
 * frames lining up, 5.5% the beat after a landing, 1.2% after a bump, 2.3% thinking and 3.7% standing where its
 * strategy sent it. Now bare 5.0% standing where the strategy sent it, 1.8% after a short hop, 1.5% thinking, 1.1%
 * after a part bumped it; placed 4.7%, 1.5%, 1.7% and 0.7%, and 4.2% standing clear of a hazard every move would pass
 * within its margin of. From bare 13%, 27.6 s, 49%, 0.9 s, 3.5 s, 11.5 uses, 22%, 16%, 4.2 tiles; placed 13%, 24.5 s, 43%, 1.0 s,
 * 4.0 s, 8.4 uses, 26%, 14%, 4.8 tiles (5 and 7 rounds under 10 s, none without a knock or a shove), since bots
 * press the fight (`press`): they no longer read the view's rounding as the slag pouring and climb from GO, take
 * an unlined hit after about a second in reach rather than four, fetch from boxes within 14 tiles unless a rival they
 * could shove into something is right there, dodge only a hit that's coming, and get over a shove that stalls. From
 * bare 13%, 30.1 s, 36%, 1.0 s, 4.5 s, 6.6 uses, 22%, 19%, 5.6 tiles; placed 16%, 28.1 s, 32%, 1.1 s, 5.5 s, 6.1
 * uses, 26%, 17%, 5.6 tiles (2 and 7 under 10 s). Before that bare 6%, 29.6 s and 31%, placed 17%, 27.4 s and 24%
 * before bots put their hazards where a knock throws someone, and 63%, 39.6 s, 11% and 59%, 38.1 s, 9% before bots
 * lined rivals up and fetched boxes. The slag still takes more deaths than anything else. Earlier or faster pours
 * shortened rounds and added draws. The targets are the owner's, from the party brawler: draws rare, rounds of
 * 20–40 s. The bands only catch a regression; the bots before `press` fail the first bonk, uses, retreat and gap
 * bands, and the motor before `haste` the still bands, so a return to turtling does too.
 */
export const BRAWL_ROUNDS = {
  targets: { draws: 0.2, seconds: [20, 40] },
  bands: {
    bare: {
      draws: [0, 0.2],
      seconds: [20, 29],
      knocked: [0.55, 0.75],
      contact: [0, 2],
      hit: [0, 4.2],
      uses: [9, 15],
      still: [0, 0.14],
      retreat: [0, 0.21],
      gap: [0, 5.2],
    },
    placed: {
      draws: [0, 0.2],
      seconds: [18, 25],
      knocked: [0.5, 0.7],
      contact: [0, 1.9],
      hit: [0, 5],
      uses: [7, 11],
      still: [0, 0.18],
      retreat: [0, 0.2],
      gap: [0, 4.8],
    },
  },
} as const satisfies {
  targets: { draws: number; seconds: readonly [number, number] };
  bands: Record<string, Record<BrawlMeasure, readonly [number, number]>>;
};

/** What `BRAWL_ROUNDS` bands. */
export type BrawlMeasure = 'draws' | 'seconds' | 'knocked' | 'contact' | 'hit' | 'uses' | 'still' | 'retreat' | 'gap';

/**
 * How long a Rising Slag round lasts, the same four bots and loop's boxes (tests/stats/slag-catch-up.test.ts): at most
 * `early` of rounds over by 15 s after GO, and the median round inside `median` seconds, the lead-camera racer's short
 * round. Measured 4% and 30.8 s with the regroup gates (512 seeds: 4% and 28.8 s), from 8% and 25.5 s before them, and
 * 41% and 16 s before the leash opened long and the field started spread out.
 */
export const SLAG_ROUNDS = { early: 0.15, median: [20, 40] } as const;
