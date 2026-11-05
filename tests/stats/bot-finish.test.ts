import { describe, expect, it } from 'vitest';
import type { BotLevel } from '../../src/game/match';
import type { Difficulty } from '../../src/sim/level';
import { PASS_BANDS } from '../../src/game/expectations';
import { botRace } from '../lib/bot-race';

/**
 * How often a built-in bot alone finishes a level with the plan's bridges
 * built, by its level and the level's difficulty. No level of bot is
 * unbeatable: even Hard fumbles, chokes on a tight jump (one a slip turns into
 * a fall) and stops to think, so a level beats it now and then
 * (docs/DESIGN.md → AI players).
 *
 * Seeds 1–40, (gentle, medium, hard level). Before bots made mistakes at every
 * level: Easy 85 70 72, Normal 98 88 88, Hard 98 93 88. Since: Easy 70 58 60,
 * Normal 90 68 63, Hard 95 78 88; with temperaments tilting the hands, Easy
 * 73 58 58, Normal 93 65 60, Hard 93 78 88. The owner's targets (`PASS_TARGETS`,
 * src/game/expectations.ts, with the bands checked here) are Easy 75 50 30,
 * Normal 90 70 50, Hard 95 85 70: gentle and medium are there, but a hard
 * level plays little harder than a medium one, because only about half of
 * them land in their band (docs/TODO.md → Level follow-ups); as they do, the
 * hard column should fall toward its target with no change here. A rate out
 * of its band means the hands stopped matching the levels; the bot levels
 * drifting together means the personalities stopped mattering.
 */
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const DIFFICULTIES: readonly Difficulty[] = ['gentle', 'medium', 'hard'];
const LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];

function rates(level: BotLevel): number[] {
  return DIFFICULTIES.map((difficulty) => {
    const misses: string[] = [];
    let frames = 0;
    for (const seed of SEEDS) {
      const r = botRace(seed, { level, difficulty });
      if (r.finished) frames += r.frames;
      else misses.push(`${seed}:${r.cause}`);
    }
    const done = SEEDS.length - misses.length;
    console.log(`${level}/${difficulty}: finished ${done} of ${SEEDS.length} in ${Math.round(frames / done)} frames; missed ${misses.join(' ')}`);
    return done / SEEDS.length;
  });
}

const measured = new Map<BotLevel, number[]>();

describe('bot finish rate', () => {
  for (const level of LEVELS)
    it(`a ${level} bot finishes inside its band, more on gentle levels than hard ones`, { timeout: 400_000 }, () => {
      const r = rates(level);
      measured.set(level, r);
      r.forEach((x, i) => {
        const [lo, hi] = PASS_BANDS.race[level][DIFFICULTIES[i]];
        expect(x, `${level}/${DIFFICULTIES[i]}`).toBeGreaterThanOrEqual(lo);
        expect(x, `${level}/${DIFFICULTIES[i]}`).toBeLessThanOrEqual(hi);
      });
      expect(r[0]).toBeGreaterThan(r[2]);
    });

  it('its level shows: Easy finishes least, Hard most', () => {
    const mean = (l: BotLevel) => (measured.get(l) ?? []).reduce((a, b) => a + b, 0) / DIFFICULTIES.length;
    expect(mean('easy')).toBeLessThan(mean('normal'));
    expect(mean('normal')).toBeLessThan(mean('hard'));
  });
});
