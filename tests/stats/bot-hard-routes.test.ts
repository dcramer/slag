import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/themes';
import { botRace } from '../lib/bot-race';

/**
 * A Hard bot over every theme at every size its theme rolls, racing over the
 * parts three Hard bots picked and placed in a round of their own: what
 * a match throws at it, not just the plan. Before the motor looked a move
 * ahead, timed gusts and moving parts, counted waiting as time and ran along
 * the ground, these 280 races gave 238 finishes in 555 race frames on average;
 * with it, 250 in 526. Once it knew a ledge's lip as the ledge (it had hopped
 * in place under overhangs there until it gave up), traced moves in the parts'
 * winds and kept a walk-speed way onto each cell beside the quickest (for
 * ground a run can't stop on): 257 in 541, the extra finishes long levels (on
 * races both finish, seeds 1–20, 515 frames became 518). Levels that ask for
 * precision (more jumpable crossings, stepping stones, full-range jumps) made
 * the same 257 finishes take 555 frames; taking the least bad move when it
 * lands at a run on a ledge too short to stop on or wait (it had coasted off):
 * 259 in 556. Foreseeing parts a runner sets off (a dropper it walked under
 * looked idle until it slammed) and looking past every clear move while
 * where it stands is about to hurt: 261 in 555. The misses left are
 * mostly routes into places it can't leave (it gives up), shots and timed
 * hazards past the one move it looks ahead, and low-gravity falls. Since
 * bots make mistakes at every level, it runs them with steady hands (no
 * fumbles, pauses, wrong turns or lag), so it keeps measuring the motor and
 * the route rather than a player's lapses. Taking a safe move over a tight
 * jump that costs little more, and braking while it looks: 254 in 546.
 */
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const SIZES = ['classic', 'wide', 'tall'] as const;

describe('hard bot routes', () => {
  it('finishes most levels with parts placed, at every size', { timeout: 400_000 }, () => {
    let races = 0;
    let finished = 0;
    let frames = 0;
    const misses: string[] = [];
    for (const size of SIZES)
      for (const theme of THEME_IDS)
        for (const seed of SEEDS) {
          // A size the theme never rolls falls back to one it does: count each level once.
          if (size === 'tall' && (theme === 'farm' || theme === 'harbor')) continue;
          const r = botRace(seed, { theme, size: size === 'classic' ? undefined : size, level: 'hard', parts: 3, steady: true });
          races++;
          if (r.finished) {
            finished++;
            frames += r.frames;
          } else misses.push(`${theme}/${size}/${seed}:${r.cause}`);
        }
    console.log(`hard: finished ${finished} of ${races} in ${Math.round(frames / finished)} frames on average; missed ${misses.join(' ')}`);
    expect(finished / races).toBeGreaterThanOrEqual(0.87);
    expect(frames / finished).toBeLessThan(560);
  });
});
