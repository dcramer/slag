import { describe, expect, it } from 'vitest';
import { botRace } from '../lib/bot-race';

/**
 * How often a built-in bot alone finishes a level with the plan's bridges
 * built. When phase 1 of TODO 27 landed it was 91 of seeds 1–100: the misses
 * were shots and timed hazards it misjudged (6) and leaps of faith and skids
 * that fell (3). A drop here means the motor and the route
 * have stopped agreeing.
 */
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('bot finish rate', () => {
  it('a bot finishes most levels on its own', () => {
    const misses: string[] = [];
    for (const seed of SEEDS) {
      const r = botRace(seed);
      if (!r.finished) misses.push(`${seed}:${r.cause}`);
    }
    console.log(`bot finished ${SEEDS.length - misses.length} of ${SEEDS.length}; missed ${misses.join(' ')}`);
    expect((SEEDS.length - misses.length) / SEEDS.length).toBeGreaterThanOrEqual(0.85);
  });
});
