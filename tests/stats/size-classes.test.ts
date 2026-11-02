import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/themes';
import { expectSizedLevel } from '../lib/level-checks';

/** Forced tall and wide levels: how much their set piece counts vary, and that no seed fails. */
const SEEDS = 3;
const seedAt = (i: number) => (i * 2654435761 + 777) >>> 0;

describe('size classes', () => {
  const cases = [
    ...THEME_IDS.filter((t) => t !== 'farm' && t !== 'harbor' && t !== 'space').map((t) => ({ t, size: 'tall' as const })),
    ...THEME_IDS.map((t) => ({ t, size: 'wide' as const })),
  ];

  it('tall and wide levels show at least 3 different set piece counts, and every one is valid', { timeout: 240_000 }, () => {
    const hazards = new Set<number>();
    for (const { t, size } of cases) {
      for (let i = 0; i < SEEDS; i++) hazards.add(expectSizedLevel(t, size, seedAt(i + 40)).setPieces.length);
    }
    expect(hazards.size).toBeGreaterThanOrEqual(3);
  });
});
