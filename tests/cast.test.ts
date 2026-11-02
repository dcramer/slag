import { describe, expect, it } from 'vitest';
import { deriveSeed } from '../src/core/rng';
import { assignCast, CAST_KINDS, type CastMode, rollCast } from '../src/gen/cast';

// The character-direction prototypes (docs/CHARACTERS.md) sit behind `?cast=`; these pin what Phase 2
// would build on: a kind is a pure function of the look seed, and a full lobby never shares one.
const MODES: CastMode[] = ['a', 'b', 'c'];

describe('cast prototypes', () => {
  it('rolls the same kind and variation for the same seed', () => {
    for (const m of MODES) expect(rollCast(12345, m)).toEqual(rollCast(12345, m));
  });

  it('keeps eight players on eight different kinds', () => {
    for (const m of MODES)
      for (let lobby = 0; lobby < 4; lobby++) {
        const seeds = Array.from({ length: 8 }, (_, i) => deriveSeed(lobby, `p${i}`));
        const kinds = assignCast(seeds, m);
        expect(new Set(kinds).size).toBe(8);
        expect(kinds.every((k) => k >= 0 && k < CAST_KINDS[m].length)).toBe(true);
      }
  });
});
