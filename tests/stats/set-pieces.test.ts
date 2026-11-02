import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/themes';
import { expectClearOfSpawnAndGoal, expectPieceCap, expectPlacementRules, expectSafeWindows, levelsOfEveryTheme } from '../lib/set-piece-checks';

/** How often a theme's levels get set pieces, how many kinds, and that no seed breaks the placement rules. */
const SEEDS = Array.from({ length: 8 }, (_, i) => (i * 2654435761 + 12345) >>> 0);
const levels = levelsOfEveryTheme(SEEDS);

describe('set pieces across a theme', () => {
  it('most levels of a theme get some, of at least two kinds', () => {
    for (const theme of THEME_IDS) {
      const mine = levels.filter((l) => l.theme === theme);
      mine.forEach(expectPieceCap);
      const withPieces = mine.filter((l) => l.level.setPieces.length > 0).length;
      // Profiles roll 0–4 hazards (0 is rare), so most levels still get some.
      expect(withPieces, theme).toBeGreaterThanOrEqual(mine.length * 0.6);
      const seen = new Set(mine.flatMap((l) => l.level.setPieces.map((p) => p.def.key.split(':')[2])));
      expect(seen.size, theme).toBeGreaterThanOrEqual(2);
    }
  });

  it('obey placement rules on every seed', () => levels.forEach(expectPlacementRules));
  it('keep hazards and moving solids away from spawn and goal on every seed', () => levels.forEach(expectClearOfSpawnAndGoal));
  it('leave safe windows on every seed', () => levels.forEach(expectSafeWindows));
});
