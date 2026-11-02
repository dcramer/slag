import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { expectSolvableLevel } from './lib/level-checks';

describe('level generation', () => {
  it('is deterministic', () => {
    const a = generateLevel(777);
    const b = generateLevel(777);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.theme).toEqual(b.theme);
    expect(a.spawn).toEqual(b.spawn);
  });

  it('produces policy-solvable, non-fallback levels', { timeout: 120_000 }, () => {
    for (let i = 0; i < 12; i++) expectSolvableLevel((i * 2654435761) >>> 0);
  });
});
