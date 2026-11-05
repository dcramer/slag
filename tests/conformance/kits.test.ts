import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSeed, Rng } from '../../src/core/rng';
import { BUILDERS, type BuilderId } from '../../src/gen/level/builders';
import { setLevelDifficulty } from '../../src/gen/level/difficulty';
import { setProbeGravity } from '../../src/gen/level/probe';
import { rollProfile } from '../../src/gen/level/profile';
import { KIT_KINDS, kitShortfalls, SET_KITS } from '../../src/gen/level/sets';
import type { SculptCtx } from '../../src/gen/level/types';
import { generateTheme } from '../../src/gen/theme';
import type { LevelProfile } from '../../src/sim/level';
import { THEME_IDS, type ThemeId } from '../../src/themes';

/**
 * The kit contract (src/gen/AGENTS.md → Set kits and level builders): every set provides every kind of piece
 * (KIT_KINDS), every builder composes every set's kit into a level in the set's own style, and no builder reads the
 * theme. A kind a set doesn't provide yet shows as a todo naming it; once it does, it's a real test. Never drop a
 * kind to turn a todo into a pass. The levels themselves are held to the level contract in levels.test.ts.
 */

describe('every set provides every kind', () => {
  for (const theme of THEME_IDS) {
    const short = kitShortfalls(SET_KITS[theme]);
    if (short.length) it.todo(`${theme} still needs ${short.join(', ')} (TODO 32: tower pieces)`);
    else it(`${theme} provides ${Object.keys(KIT_KINDS).join(', ')}`, () => expect(kitShortfalls(SET_KITS[theme])).toEqual([]));
  }
});

/** The profiles a builder takes, forced from the seed: a course, a climb, a descent, a tower. */
const FORCE: Record<BuilderId, { size: LevelProfile['size']; route: LevelProfile['route'] }[]> = {
  course: [
    { size: 'classic', route: 'ltr' },
    { size: 'wide', route: 'ltr' },
  ],
  climb: [{ size: 'classic', route: 'climb' }],
  descent: [{ size: 'wide', route: 'descent' }],
  tower: [{ size: 'tall', route: 'zigzag' }],
};

function ctxFor(seed: number, theme: ThemeId, p: LevelProfile, attempt = 0): SculptCtx {
  setProbeGravity(p.gravity);
  setLevelDifficulty(p.difficulty);
  const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
  return { rng, themeId: theme, theme: generateTheme(seed, theme), attempt, profile: p, challenge: new Rng(deriveSeed(seed, `challenge:${theme}`)).next() };
}

describe('every builder composes every set’s kit', () => {
  for (const [id, b] of Object.entries(BUILDERS) as [BuilderId, (typeof BUILDERS)[BuilderId]][])
    describe(id, () => {
      for (const theme of THEME_IDS) {
        const set = SET_KITS[theme];
        const missing = b.asks.filter((kind) => !KIT_KINDS[kind].has(set));
        if (missing.length) {
          it.todo(`${theme}: needs ${missing.join(', ')} (TODO 32)`);
          continue;
        }
        it(theme, () => {
          const faults: string[] = [];
          for (const force of FORCE[id])
            for (const seed of [1, 2]) {
              const p = rollProfile(seed, theme, force);
              if (!b.takes(p)) {
                faults.push(`seed ${seed} ${force.size} ${force.route}: rolled a ${p.size} ${p.route} it doesn't take`);
                continue;
              }
              const shape = b.build(ctxFor(seed, theme, p), set);
              const again = b.build(ctxFor(seed, theme, p), set);
              const at = `seed ${seed} ${p.size} ${p.route}`;
              if (!shape.style.startsWith(`${theme}:`) || shape.style.endsWith(':broken')) faults.push(`${at}: style ${shape.style}`);
              if (shape.w !== p.w || shape.h !== p.h) faults.push(`${at}: ${shape.w}×${shape.h}, not the profile's ${p.w}×${p.h}`);
              if (!shape.tiles.every((t, i) => t === again.tiles[i])) faults.push(`${at}: two different shapes from one seed`);
            }
          expect(faults).toEqual([]);
        });
      }
    });
});

describe('builders never read the theme', () => {
  const dir = join(__dirname, '../../src/gen/level/builders');
  for (const f of readdirSync(dir))
    it(f, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      const named = THEME_IDS.filter((t) => new RegExp(`['"\`]${t}['"\`]`).test(src));
      expect({ themeId: src.includes('themeId'), named }).toEqual({ themeId: false, named: [] });
    });
});
