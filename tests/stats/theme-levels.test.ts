import { describe, expect, it } from 'vitest';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { expectThemedLevel } from '../lib/level-checks';

/** What a theme's levels look like: how many need parts, how many need two, how many sub-styles, and that no seed fails. */
const SEEDS = 30;
const seedAt = (i: number) => (i * 2654435761 + 12345) >>> 0;

describe('levels per theme', () => {
  let bridged = 0;
  let twoParts = 0;
  let total = 0;
  const styles = new Map<ThemeId, Set<string>>();
  for (const theme of THEME_IDS) {
    it(`${theme}: almost nothing is passable bare, and every seed is valid`, () => {
      let themeBridged = 0;
      const themeStyles = new Set<string>();
      styles.set(theme, themeStyles);
      for (let i = 0; i < SEEDS; i++) {
        const { level, bridges } = expectThemedLevel(theme, seedAt(i));
        themeStyles.add(level.style);
        if (bridges.length) themeBridged++;
        if (bridges.length >= 2) twoParts++;
      }
      expect(themeBridged).toBeGreaterThanOrEqual(SEEDS * 0.85);
      bridged += themeBridged;
      total += SEEDS;
    });
  }

  it('about 99% of levels need parts, and 20-30% need more than one', () => {
    expect(total).toBe(SEEDS * THEME_IDS.length);
    expect(bridged / total).toBeGreaterThanOrEqual(0.95);
    expect(twoParts / total).toBeGreaterThan(0.18);
    expect(twoParts / total).toBeLessThan(0.32);
  });

  // Reuses the sweep's levels: 192 extra generations proved nothing the 240 above don't.
  it('themes have several sub-styles each', () => {
    for (const theme of THEME_IDS) expect(styles.get(theme)?.size, theme).toBeGreaterThanOrEqual(2);
  });
});
