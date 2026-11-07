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
  // Measured lap by lap round the open shaft (seeds 1–32; gen/level/builders/shaft.ts): Easy 88 89 84, Normal 94 87 96,
  // Hard 97 87 96, the slag 4.5, 3.5 and 2.5 s of climb behind the leader (gen/level/tide.ts). Alone there's no leader's
  // screen (sim/screen.ts) to fall off, so it's the slag's leash alone. With the regroup gates the screen replaced, Easy
  // 91 83 58, Normal 97 87 81, Hard 97 71 77: a lone bot waited at a shut gate with the slag while the squeeze ran on the
  // clock, so the third lap came later and tighter. A Normal bot falls a rise or more about once in four laps on bricks
  // (a medium shaft) and twice in three (a hard one), seldom further than the hard lap's 14 rows, so every tier passes
  // above its target. A few seeds swing a lap 20 points. Laps that cost a slip as the targets ask are open (docs/TODO.md → 31).
  slag: {
    easy: { gentle: [0.76, 1], medium: [0.72, 1], hard: [0.68, 0.98] },
    normal: { gentle: [0.84, 1], medium: [0.72, 1], hard: [0.8, 1] },
    hard: { gentle: [0.84, 1], medium: [0.72, 1], hard: [0.8, 1] },
  },
};

/**
 * Catch-up in Rising Slag: the share of rounds the runner highest 15 s after GO (`at`, frames) goes on to win, four
 * Normal bots on a bare loop (seeds 1–128, the rounds where both are known; tests/stats/slag-catch-up.test.ts).
 * `boxes`: the loop's own boxes as built. `items` and `bare`: what those boxes deal by rank put in every empty hand
 * every 5 s, then used by the bots' item tactics, or never used. Measured 41, 43 and 48 with the leader's screen
 * (src/sim/screen.ts; 512 seeds: 44, 47, 47), whose top holds a leader who climbs faster than it rises; 43, 50 and 49
 * with the regroup gates it replaced (512: 53, 49, 51), 59 with neither (256, boxes). About 110 rounds are judged in
 * each, so ±5. `leads`: lead changes a round with the boxes, someone new on top a second straight: 2.5 with the
 * screen (512: 2.4), 3.1 with the gates, 1.4 with neither. With the climb's own items in the deal and Leg Days on its
 * lips (docs/MODES.md → Rising Slag, 8): 45, 39 and 41, and 2.7 lead changes (3.0 with the deal in every hand).
 * Since the leader runs free (owner decision: the screen's solid top went) and bots see only the screen (9): 57, 45
 * and 54, with 2.4 lead changes (2.6 with the deal in every hand); 512 seeds: 52, 43, 52 and 2.3, 2.7, 2.4. `boxes`
 * is over its band: the bands measured the solid top, and catch-up is the climb's items' to bring back, not this
 * band's to move. The target, from the lead-camera racer, is the early leader winning about half the time
 * (docs/MODES.md); these bands only catch a regression.
 */
export const LEAD_HOLDS = {
  at: 15 * 60,
  bands: {
    boxes: [0.29, 0.53],
    items: [0.31, 0.55],
    bare: [0.36, 0.6],
  },
  leads: [1.9, 3.1],
} as const satisfies { at: number; bands: Record<string, readonly [number, number]>; leads: readonly [number, number] };

/**
 * Brawl with bots (tests/stats/brawl.test.ts, docs/MODES.md → Brawl): four Normal bots on the bare arena (round 1
 * before any part, seeds 1–48) and through the first four rounds of a match as the parts pile up (seeds 1–16).
 * `draws`: the share of rounds nobody wins (the last ones out on one frame, or the time out). `seconds`: a round's
 * mean length from GO. `knocked`: the share of deaths with a rival's knock still credited (sim/items/common.ts
 * `BONK_CREDIT`), thrown or bumped into the level. How hard it's fought (tests/lib/bot-race.ts `Fight`): `contact`
 * and `hit`, seconds from GO to the first touch or bonk and to the first bonk; `uses`, items used a minute of fighting
 * (from GO to a round's end: a short round isn't fewer swings; owner decision); `still` and `retreat`, the shares of frames in it standing still and moving away from the nearest rival; `gap`, the tiles
 * to that rival; `pauses`, times a bot stood still half a second on end (`PAUSE` frames), per bot-minute: a person
 * sees a pause as a stretch, not a share. Measured with everyone armed from GO and stands for boxes bare 4%, 17.7 s,
 * 77%, 0.9 s, 2.2 s, 47.0 uses a minute, 7%, 20%, 5.2 tiles, 0.87 pauses (the longest 54 frames); placed 2%, 17.8 s,
 * 78%, 0.9 s, 2.2 s, 41.3 uses a minute, 6%, 19%, 5.6 tiles, 0.38 (165) (25 of 48 and 28 of 64 rounds in the 15–30 s
 * target, 5 and 16 under 10 s; 26 and 48 deaths to hazards, 34 and 41 off the sides, 80 and 92 into the drop, 6 and 10
 * to the slag). Before (boxes, bare hands at GO, the slag pooled in the drop from GO): bare 0%, 20.0 s, 67%, 1.6 s,
 * 4.0 s, 26.7 uses a minute, 0.37 pauses; placed 2%, 17.0 s, 64%, 1.3 s, 3.9 s, 25.1; 101 and 106 deaths to the slag,
 * nearly all of them falls into its pool. The targets are the owner's, from the party
 * brawler: draws rare, rounds of 15–30 s. Earlier or faster pours shortened rounds and added draws. The bands only catch
 * a regression: the bots before `press` fail the first bonk, uses, retreat and gap bands, the motor before `haste` the
 * still bands and the bots before they kept at something the pauses bands, so a return to turtling does too.
 */
export const BRAWL_ROUNDS = {
  targets: { draws: 0.2, seconds: [15, 30] },
  bands: {
    bare: {
      draws: [0, 0.2],
      seconds: [15, 22],
      knocked: [0.65, 0.88],
      contact: [0, 1.5],
      hit: [0, 3.2],
      uses: [35, 48],
      still: [0, 0.09],
      retreat: [0, 0.21],
      gap: [0, 6],
      pauses: [0, 1],
    },
    placed: {
      draws: [0, 0.2],
      seconds: [15, 22],
      knocked: [0.65, 0.88],
      contact: [0, 1.5],
      hit: [0, 3.2],
      uses: [32, 45],
      still: [0, 0.09],
      retreat: [0, 0.21],
      gap: [0, 6.5],
      pauses: [0, 1],
    },
  },
} as const satisfies {
  targets: { draws: number; seconds: readonly [number, number] };
  bands: Record<string, Record<BrawlMeasure, readonly [number, number]>>;
};

/** What `BRAWL_ROUNDS` bands. */
export type BrawlMeasure = 'draws' | 'seconds' | 'knocked' | 'contact' | 'hit' | 'uses' | 'still' | 'retreat' | 'gap' | 'pauses';

/**
 * How long a Rising Slag round lasts, the same four bots and loop's boxes (tests/stats/slag-catch-up.test.ts): at most
 * `early` of rounds over by 15 s after GO, and the median round inside `median` seconds, the lead-camera racer's short
 * round. Measured 15% and 23.9 s with the leader free on the leader's screen and bots that see only it (512 seeds: 12%
 * and 24.5 s), 11% and 30.4 s with the screen's solid top (512: 6% and 29.4 s), 4% and 30.8 s with the regroup
 * gates before it (512: 4% and 28.4 s), 8% and 25.5 s before those, and 41% and 16 s before the leash opened long and
 * the field started spread out.
 */
export const SLAG_ROUNDS = { early: 0.15, median: [20, 40] } as const;
