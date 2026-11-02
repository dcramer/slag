import { describe, expect, it } from 'vitest';
import { GRAND_LANDMARKS, THEME_MINIMUMS, themeCounts, themeExcess, themeShortfalls } from '../../src/gen/kinds';
import { THEME_IDS } from '../../src/themes';

/**
 * The owner's per-theme minimums (src/gen/kinds.ts: 5 landmarks, 12 decor pieces, 3 hazards unique to the
 * theme, at least one grand landmark). The theme batches are still landing them, so a theme short of any shows as a todo naming what it
 * lacks; once it has them all it's a real test, and it fails if it ever drops below again. Never lower the
 * bar to turn a todo into a pass.
 */

describe('every theme meets the minimums', () => {
  for (const theme of THEME_IDS) {
    const short = themeShortfalls(theme);
    if (short.length) it.todo(`${theme} still needs ${short.join(', ')}`);
    else
      it(`${theme} has at least ${THEME_MINIMUMS.landmarks} landmarks (${THEME_MINIMUMS.grand}+ grand), ${THEME_MINIMUMS.decor} decor pieces and ${THEME_MINIMUMS.uniqueHazards} unique hazards`, () => {
        const have = themeCounts(theme);
        for (const k of Object.keys(THEME_MINIMUMS) as (keyof typeof THEME_MINIMUMS)[]) expect(have[k], k).toBeGreaterThanOrEqual(THEME_MINIMUMS[k]);
      });
  }
});

describe('no theme has more than its share of grand landmarks', () => {
  for (const theme of THEME_IDS)
    it(`${theme} has at most ${GRAND_LANDMARKS.max} grand landmarks`, () => {
      expect(themeExcess(theme)).toBeNull();
    });
});
