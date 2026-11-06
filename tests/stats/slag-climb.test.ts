import { describe, expect, it } from 'vitest';
import { PASS_BANDS, PASS_TARGETS } from '../../src/game/expectations';
import type { BotLevel } from '../../src/game/match';
import { stretchesOf } from '../../src/gen/level';
import { LOOP_ROWS } from '../../src/gen/level/profile';
import { LOOP_BAND } from '../../src/sim/level';
import { botRace } from '../lib/bot-race';

/**
 * Rising Slag against the difficulty standard (src/game/expectations.ts): a lone bot climbs a tower with the slag
 * on, and each lap of the shaft's curve (gen/level/difficulty.ts `LAP_TIERS`) it got into counts as passed when
 * it climbed it before the slag caught it. The share passed per tier is measured against the same targets
 * as a race level of that tier (`PASS_TARGETS`), and held to the bands it measures today (`PASS_BANDS.slag`). A
 * stretch fewer than four bots got into isn't judged. The run-out past the hard stretch has no band: the slag always
 * wins there.
 */
const SEEDS = Array.from({ length: 32 }, (_, i) => i + 1);
const LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];
/** A shaft's laps, as every Rising Slag shaft has them (gen/level/difficulty.ts `stretchesOf`). */
const LAPS = stretchesOf({ loop: true, curve: true, size: 'tall', h: LOOP_ROWS + LOOP_BAND, difficulty: 'medium' });
const BANDED = LAPS.filter((s) => Number.isFinite(s.to));
const DIFFS = ['gentle', 'medium', 'hard'] as const;

const climbs = new Map<BotLevel, number[]>();

function climbsOf(level: BotLevel): number[] {
  let got = climbs.get(level);
  if (!got) climbs.set(level, (got = SEEDS.map((seed) => botRace(seed, { level, mode: 'slag', limit: 90 * 60 }).climbed)));
  return got;
}

describe('Rising Slag climb', () => {
  for (const level of LEVELS)
    it(`a ${level} bot gets through each stretch of the tower about as often as a race level of its tier`, { timeout: 900_000 }, () => {
      const rows = climbsOf(level);
      const rates = BANDED.map((s) => {
        const entered = rows.filter((r) => r >= s.from).length;
        return { s, entered, rate: entered ? rows.filter((r) => r >= s.to).length / entered : 0 };
      });
      console.log(
        `${level} (targets ${DIFFS.map((d) => Math.round(PASS_TARGETS[level][d] * 100)).join(' ')}): climbed ${[...rows].sort((a, b) => a - b).join(' ')}; passed ${rates.map(({ s, entered, rate }) => `${s.tier} ${Math.round(rate * 100)}% of ${entered}`).join(', ')}`,
      );
      for (const { s, entered, rate } of rates) {
        if (entered < 4) continue;
        const [lo, hi] = PASS_BANDS.slag[level][s.tier];
        expect(rate, `${level}/${s.tier} (rows ${s.from}–${s.to})`).toBeGreaterThanOrEqual(lo);
        expect(rate, `${level}/${s.tier} (rows ${s.from}–${s.to})`).toBeLessThanOrEqual(hi);
      }
    });

  it('its level shows: Easy climbs least, Hard most', () => {
    const median = (l: BotLevel) => [...climbsOf(l)].sort((a, b) => a - b)[SEEDS.length >> 1];
    expect(median('easy')).toBeLessThan(median('normal'));
    expect(median('normal')).toBeLessThan(median('hard'));
  });
});
