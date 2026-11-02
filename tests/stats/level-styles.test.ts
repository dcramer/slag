import { describe, expect, it } from 'vitest';
import { expectSolvableLevel } from '../lib/level-checks';

/** Levels from the seed alone: how many styles a spread of seeds rolls, and that no seed fails. */
const SEEDS = 150;

describe('styles across seeds', () => {
  it('150 seeds roll at least 12 styles, and every one is solvable with no fallback', { timeout: 240_000 }, () => {
    const styles = new Set<string>();
    for (let i = 0; i < SEEDS; i++) styles.add(expectSolvableLevel((i * 2654435761) >>> 0).style);
    expect(styles.size).toBeGreaterThanOrEqual(12);
  });
});
