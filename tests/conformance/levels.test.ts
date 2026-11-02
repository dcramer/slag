import { describe } from 'vitest';
import { generateLevel, lastGenInfo, MAX_BRIDGES } from '../../src/gen/level';
import { GRAVITY } from '../../src/gen/level/profile';
import { analyzeRoutes, MAX_SHARED } from '../../src/gen/level/routes';
import type { Level, SizeClass } from '../../src/sim/level';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { checkPolicy } from '../lib/level-checks';
import { once, rule } from './lib';

/**
 * The level contract for every theme's sculptor (SCULPTORS, src/gen/level/sculptors), across sizes and
 * gravities: no fallback, proven solvable with at most MAX_BRIDGES parts by the real controller, mostly
 * open, the theme's own style, and the same level from the same seed. The shares behind these rules are
 * measured over many seeds in tests/stats: parts needed and two-part share (theme-levels.test.ts), open
 * routes (open-routes.test.ts), styles (level-styles.test.ts), sizes (size-classes.test.ts).
 */

const CASES: { seed: number; size: SizeClass; gravity: keyof typeof GRAVITY }[] = [
  { seed: 1, size: 'classic', gravity: 'normal' },
  { seed: 2, size: 'wide', gravity: 'low' },
  { seed: 3, size: 'tall', gravity: 'high' },
];

interface Made {
  at: string;
  level: Level;
  fallback: boolean;
  bridges: { x: number; y: number }[];
}

function made(theme: ThemeId): Made[] {
  return CASES.map(({ seed, size, gravity }) => {
    const level = generateLevel(seed, theme, { size, gravity: GRAVITY[gravity] });
    return { at: `seed ${seed} ${level.profile!.size} ${gravity}`, level, fallback: lastGenInfo.fallback, bridges: lastGenInfo.bridges };
  });
}

function themeSuite(theme: ThemeId) {
  const key = (r: string) => `level/${theme}/*/${r}`;
  const levels = once(() => made(theme));
  const each = (check: (m: Made) => string[]) => () => levels().flatMap((m) => check(m).map((f) => `${m.at}: ${f}`));
  describe(theme, () => {
    rule(
      key('fallback'),
      'never falls back',
      each((m) => (m.fallback ? ['fell back to the legacy sculptor or the flat floor'] : [])),
    );
    rule(
      key('solvable'),
      `is proven solvable with at most ${MAX_BRIDGES} parts`,
      each((m) => (m.bridges.length <= MAX_BRIDGES && checkPolicy(m.level, m.bridges) ? [] : [`not finished with its ${m.bridges.length} parts`])),
    );
    rule(
      key('open'),
      'is mostly open',
      each((m) => {
        const shared = analyzeRoutes(m.level, m.level.solution ?? []).shared;
        return shared <= MAX_SHARED ? [] : [`${Math.round(shared * 100)}% of the route has no second way`];
      }),
    );
    rule(
      key('style'),
      'is sculpted in its own style',
      each((m) => (m.level.style.startsWith(`${theme}:`) ? [] : [`style ${m.level.style}`])),
    );
    rule(key('determinism'), 'is the same level from the same seed', () => {
      const [a] = levels();
      const { seed, size, gravity } = CASES[0];
      const b = generateLevel(seed, theme, { size, gravity: GRAVITY[gravity] });
      const same =
        a.level.tiles.every((t, i) => t === b.tiles[i]) &&
        JSON.stringify([a.level.spawn, a.level.goal, a.level.setPieces, a.level.solution, a.level.landmark, a.level.weather]) ===
          JSON.stringify([b.spawn, b.goal, b.setPieces, b.solution, b.landmark, b.weather]);
      return same ? [] : [`seed ${seed} gave two different levels`];
    });
  });
}

describe('levels', () => {
  for (const theme of THEME_IDS) themeSuite(theme);
});
