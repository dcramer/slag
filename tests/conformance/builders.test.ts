import { describe } from 'vitest';
import { BUILDERS } from '../../src/gen/level/builders';
import { THEME_IDS } from '../../src/themes';
import { buildIn, CONTRACTED, eachFaults } from '../lib/builder-contract';
import { once, rule } from './lib';

/**
 * The builder contract (src/gen/AGENTS.md → Set kits and level builders): every builder that declares one
 * (`BuilderDef.contract`) holds every set's level to its per-level promises (`each`), a seed per set taking turns, along
 * with what every builder's levels keep: no fallback, no set piece through terrain. The shares over many levels (`set`,
 * `all`) and every seed's per-level promises are the sweep's: tests/stats/builder-contracts.test.ts.
 */
describe('every builder keeps its contract', () => {
  for (const id of CONTRACTED)
    describe(id, () => {
      THEME_IDS.forEach((theme, i) => {
        const levels = once(() => buildIn(id, theme, [1 + (i % 3)]));
        rule(`builder/${theme}/${id}/each`, `${theme}: every promise of its levels`, () => levels().flatMap((b) => eachFaults(BUILDERS[id].contract!, b)));
      });
    });
});
