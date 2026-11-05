import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { SET_PIECE_RECIPES, SET_PIECES } from '../src/gen/setpieces';
import type { Level } from '../src/sim/level';
import { THEME_IDS } from '../src/themes';
import { expectClearOfSpawnAndGoal, expectPieceCap, expectPlacementRules, expectSafeWindows, levelsOfEveryTheme } from './lib/set-piece-checks';

const SEEDS = Array.from({ length: 2 }, (_, i) => (i * 2654435761 + 12345) >>> 0);
const levels = levelsOfEveryTheme(SEEDS);

describe('set pieces', () => {
  it('are deterministic', () => {
    for (const theme of THEME_IDS) {
      const a = generateLevel(SEEDS[1], theme);
      const b = generateLevel(SEEDS[1], theme);
      expect(JSON.stringify(a.setPieces)).toBe(JSON.stringify(b.setPieces));
    }
  });

  it('every theme places up to its profile hazard count (≤4)', () => levels.forEach(expectPieceCap));

  it('every recipe can be placed somewhere', () => {
    for (const theme of THEME_IDS) {
      const seen = new Set<string>();
      // Re-roll the placer on the same terrains (cheap) rather than generating more levels.
      const terrains = levels.filter((l) => l.theme === theme).map((l) => ({ ...l.level, setPieces: [] }));
      const reroll = (ts: readonly Level[]) => {
        for (let k = 0; k < 24 && seen.size < SET_PIECE_RECIPES[theme].length; k++)
          for (const t of ts) for (const p of SET_PIECES[theme](new Rng(k * 7919 + t.seed), t)) seen.add(p.def.key.split(':')[2]);
      };
      reroll(terrains);
      // Two levels are a small sample: a recipe that needs a long flat run (the farm's combine) or a rare spot (its hay hook)
      // may find none on them. Then plain wide levels, generated only when needed.
      for (const seed of [1, 2, 3])
        if (seen.size < SET_PIECE_RECIPES[theme].length) reroll([{ ...generateLevel(seed, theme, { concept: 'plain', size: 'wide' }), setPieces: [] }]);
      for (const r of SET_PIECE_RECIPES[theme]) expect(seen.has(r.name), `${theme}/${r.name}`).toBe(true);
    }
  });

  it('obey placement rules: uids, owner, free unprotected cells, no overlap; level stays acceptable', () => levels.forEach(expectPlacementRules));
  it('keep every hazard and moving solid away from spawn and goal', () => levels.forEach(expectClearOfSpawnAndGoal));
  it('hazards leave safe windows (no piece is lethal every frame)', () => levels.forEach(expectSafeWindows));
});
