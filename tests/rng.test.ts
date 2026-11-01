import { describe, expect, it } from 'vitest';
import { deriveSeed, parseSeed, Rng, seedToString } from '../src/core/rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('int stays in range', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
  it('derived seeds differ by label', () => {
    expect(deriveSeed(1, 'a')).not.toBe(deriveSeed(1, 'b'));
    expect(deriveSeed(1, 'a')).toBe(deriveSeed(1, 'a'));
  });
  it('seed strings round-trip', () => {
    for (const s of [0, 1, 42, 0xffffffff, 123456789]) expect(parseSeed(seedToString(s))).toBe(s);
  });
});
