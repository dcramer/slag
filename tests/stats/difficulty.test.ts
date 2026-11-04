import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY, generateLevel, lastGenInfo } from '../../src/gen/level';
import type { Difficulty } from '../../src/sim/level';
import { botRace } from '../lib/bot-race';

/**
 * Levels' difficulty (src/gen/level/difficulty.ts): how often a level's precision lands in its tier's band
 * (tight jumps on its more forgiving route, src/gen/level/precision.ts), and whether bots feel it.
 *
 * When picking by score landed (2026-11-04), seeds 1–200 as the game rolls them had no tight jump on 30%
 * of levels (43% before) and two or more on 17% (12.5% before). Bots only die where they come up short,
 * never by overshooting, so they feel gentle against medium (Easy and Normal bots died 0.36 times in six
 * runs a gentle level, 1.30 a medium one) but can't tell hard from medium: a hard level's extra tight jumps
 * are stones you run off.
 */
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const BOT_SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('level difficulty', () => {
  it('lands most levels of each difficulty in its band', { timeout: 600_000 }, () => {
    const hits = new Map<Difficulty, { n: number; in: number }>(DIFFICULTIES.map((d) => [d, { n: 0, in: 0 }]));
    let none = 0;
    for (const seed of SEEDS) {
      const l = generateLevel(seed);
      const d = l.profile!.difficulty;
      const [lo, hi] = DIFFICULTY[d].precision;
      const h = hits.get(d)!;
      h.n++;
      if (lastGenInfo.precision >= lo && lastGenInfo.precision <= hi) h.in++;
      if (lastGenInfo.precision === 0) none++;
    }
    console.log(`in band: ${[...hits].map(([d, h]) => `${d} ${h.in}/${h.n}`).join(', ')}; no tight jump on ${none} of ${SEEDS.length}`);
    expect(hits.get('gentle')!.in / hits.get('gentle')!.n).toBeGreaterThanOrEqual(0.6);
    expect(hits.get('medium')!.in / hits.get('medium')!.n).toBeGreaterThanOrEqual(0.75);
    expect(hits.get('hard')!.in / hits.get('hard')!.n).toBeGreaterThanOrEqual(0.35);
    expect(none / SEEDS.length).toBeLessThan(0.38);
  });

  it('kills fewer sloppy bots on a gentle level than a medium one', { timeout: 600_000 }, () => {
    const deaths = (difficulty: Difficulty) => {
      let n = 0;
      for (const seed of BOT_SEEDS) for (const level of ['easy', 'normal'] as const) if (botRace(seed, { level, difficulty }).cause) n++;
      return n;
    };
    const [gentle, medium] = [deaths('gentle'), deaths('medium')];
    console.log(`Easy and Normal bot deaths over ${BOT_SEEDS.length} levels: gentle ${gentle}, medium ${medium}`);
    expect(gentle).toBeLessThan(medium);
  });
});
