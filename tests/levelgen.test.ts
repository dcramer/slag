import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { analyzeReach, isStandable } from '../src/sim/reach';

describe('level generation', () => {
  it('is deterministic', () => {
    const a = generateLevel(777);
    const b = generateLevel(777);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.theme).toEqual(b.theme);
    expect(a.spawn).toEqual(b.spawn);
  });

  it('produces solvable, non-fallback levels for many seeds', () => {
    const styles = new Set<string>();
    let fallbacks = 0;
    for (let i = 0; i < 150; i++) {
      const seed = (i * 2654435761) >>> 0;
      const l = generateLevel(seed);
      styles.add(l.style);
      if (l.style === 'fallback') fallbacks++;
      expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
      expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
      expect(analyzeReach(l).goalReached).toBe(true);
    }
    expect(fallbacks).toBe(0);
    expect(styles.size).toBeGreaterThanOrEqual(4);
  });
});
