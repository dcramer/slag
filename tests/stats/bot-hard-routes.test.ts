import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/themes';
import { botRace } from '../lib/bot-race';

/**
 * A Hard bot over every theme at every size its theme rolls, racing over the
 * parts three Hard bots picked and placed in a round of their own: what
 * a match throws at it, not just the plan. Before the motor looked a move
 * ahead, timed gusts and moving parts, counted waiting as time and ran along
 * the ground, these 280 races gave 238 finishes in 555 race frames on average;
 * with it, 250 in 526. The misses left are mostly parts' winds the route
 * doesn't trace (a vent holding it up), skids on ice at a run into a hazard,
 * and low-gravity falls after a bump.
 */
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const SIZES = ['classic', 'wide', 'tall'] as const;

describe('hard bot routes', () => {
  it('finishes most levels with parts placed, at every size', () => {
    let races = 0;
    let finished = 0;
    let frames = 0;
    const misses: string[] = [];
    for (const size of SIZES)
      for (const theme of THEME_IDS)
        for (const seed of SEEDS) {
          // A size the theme never rolls falls back to one it does: count each level once.
          if (size === 'tall' && (theme === 'farm' || theme === 'harbor')) continue;
          const r = botRace(seed, { theme, size: size === 'classic' ? undefined : size, level: 'hard', parts: 3 });
          races++;
          if (r.finished) {
            finished++;
            frames += r.frames;
          } else misses.push(`${theme}/${size}/${seed}:${r.cause}`);
        }
    console.log(`hard: finished ${finished} of ${races} in ${Math.round(frames / finished)} frames on average; missed ${misses.join(' ')}`);
    expect(finished / races).toBeGreaterThanOrEqual(0.87);
    expect(frames / finished).toBeLessThan(545);
  });
});
