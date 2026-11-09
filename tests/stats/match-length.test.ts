import { describe, expect, it } from 'vitest';
import { MATCH_MINUTES } from '../../src/game/expectations';
import { type BotMatchTime, botMatchTime } from '../lib/bot-race';

/**
 * How long a match of a mode that builds nothing runs (src/game/expectations.ts `MATCH_MINUTES`, docs/MODES.md → What
 * we measure): four Normal bots playing whole matches with the lobby's rules, every round on a fresh level, no pick or
 * place. Minutes a match, and the share of it spent racing.
 */
const SEEDS = [1, 2, 3, 4, 5, 6];

for (const mode of Object.keys(MATCH_MINUTES) as (keyof typeof MATCH_MINUTES)[])
  describe(`${mode}: a match`, () => {
    let runs: BotMatchTime[] | null = null;
    const get = () => {
      if (runs) return runs;
      runs = SEEDS.map((s) => botMatchTime(s, { mode }));
      const frames = runs.map((r) => Object.values(r.frames).reduce((a, b) => a + (b ?? 0), 0));
      const racing = runs.reduce((a, r) => a + (r.frames.run ?? 0), 0) / frames.reduce((a, b) => a + b, 0);
      console.log(
        `${mode}: ${(frames.reduce((a, b) => a + b, 0) / 3600 / runs.length).toFixed(2)} min a match (${frames.map((f) => (f / 3600).toFixed(1)).join(', ')}), ${(runs.reduce((a, r) => a + r.rounds, 0) / runs.length).toFixed(1)} rounds, ${Math.round(racing * 100)}% racing`,
      );
      return runs;
    };
    const minutes = () => get().reduce((a, r) => a + Object.values(r.frames).reduce((b, f) => b + (f ?? 0), 0), 0) / 3600 / SEEDS.length;
    const racing = () => get().reduce((a, r) => a + (r.frames.run ?? 0), 0) / (minutes() * 3600 * SEEDS.length);

    it('ends, every round on a fresh level with no pick or place', { timeout: 1_200_000 }, () => {
      for (const r of get()) {
        expect(r.ended).toBe(true);
        expect(r.levels).toBe(r.rounds);
        expect(r.frames.pick ?? 0).toBe(0);
        expect(r.frames.place ?? 0).toBe(0);
      }
    });
    it('runs about as long as it did with picking', { timeout: 1_200_000 }, () => {
      const [lo, hi] = MATCH_MINUTES[mode].minutes;
      expect(minutes()).toBeGreaterThanOrEqual(lo);
      expect(minutes()).toBeLessThanOrEqual(hi);
    });
    it('spends most of it racing', { timeout: 1_200_000 }, () => {
      const [lo, hi] = MATCH_MINUTES[mode].racing;
      expect(racing()).toBeGreaterThanOrEqual(lo);
      expect(racing()).toBeLessThanOrEqual(hi);
    });
  });
