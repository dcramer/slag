import { describe, expect, it } from 'vitest';
import { MAX_SHARED } from '../../src/gen/level/routes';
import { THEME_IDS } from '../../src/themes';
import { expectOpenLevel } from '../lib/level-checks';

/** How much the mostly-open rule does: the share of sculpts it has to open up, and that no seed comes out closed. */
const SEEDS = 12;
const seedAt = (i: number) => (i * 2654435761 + 4242) >>> 0;

describe('open routes', () => {
  it('every level keeps a second route, and over 30% of sculpts need the lane pass to get one', { timeout: 240_000 }, () => {
    let measured = 0;
    let sculptedClosed = 0;
    for (const theme of THEME_IDS) {
      for (let i = 0; i < SEEDS; i++) {
        if (expectOpenLevel(theme, seedAt(i)).sculpted > MAX_SHARED) sculptedClosed++;
        measured++;
      }
    }
    expect(sculptedClosed / measured).toBeGreaterThan(0.3);
  });
});
