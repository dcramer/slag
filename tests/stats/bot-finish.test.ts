import { describe, expect, it } from 'vitest';
import type { BotLevel } from '../../src/game/match';
import { botRace } from '../lib/bot-race';

/**
 * How often a built-in bot alone finishes a level with the plan's bridges
 * built, at each level. When personalities landed (TODO 27, phase 1), seeds
 * 1–100 gave Easy 73, Normal 87, Hard 90, finishing in 592, 494 and 480 race
 * frames on average. Hard's misses were shots and timed hazards it misjudged
 * (8) and skids (2); Easy's were mostly fumbled jumps. A drop at Hard means
 * the motor and the route have stopped agreeing; the levels drifting together
 * means the personalities stopped mattering.
 */
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

function rate(level: BotLevel): number {
  const misses: string[] = [];
  for (const seed of SEEDS) {
    const r = botRace(seed, { level });
    if (!r.finished) misses.push(`${seed}:${r.cause}`);
  }
  console.log(`${level}: finished ${SEEDS.length - misses.length} of ${SEEDS.length}; missed ${misses.join(' ')}`);
  return (SEEDS.length - misses.length) / SEEDS.length;
}

describe('bot finish rate', () => {
  it('a bot finishes most levels on its own, and its level shows', () => {
    const [easy, normal, hard] = (['easy', 'normal', 'hard'] as const).map(rate);
    expect(hard).toBeGreaterThanOrEqual(0.85);
    expect(normal).toBeGreaterThanOrEqual(0.8);
    expect(easy).toBeGreaterThanOrEqual(0.6);
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThanOrEqual(hard);
  });
});
