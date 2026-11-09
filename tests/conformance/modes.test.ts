import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODE_IDS, MODES } from '../../src/game/modes';
import { decorFaults, placeDecor } from '../../src/gen/decor';
import { generateLevel, lastGenInfo } from '../../src/gen/level';
import { roundProfile } from '../../src/game/match';
import { DEFAULT_RULES } from '../../src/game/rules';
import { BUILDERS, type BuilderId } from '../../src/gen/level/builders';
import { THEME_IDS } from '../../src/themes';
import { botRound } from '../lib/bot-race';

/**
 * The mode contract (AGENTS.md → Extension points → Playstyle mode): every mode in `MODES` is listed, has its section
 * in docs/MODES.md against its reference game, builds the level it asks for (each of `ModeDef.profile`'s asks, in a
 * theme that takes turns by mode, its decor kept off its boxes and stands), ramps a fresh level a round within bounds
 * its builder keeps its promises to (`fresh`), and plays a round of bots to its end. The registries keyed by mode (bot strategies
 * and objectives, the difficulty bands, the emblem) are typecheck's: a mode missing from one doesn't compile.
 */

const MODES_DOC = readFileSync('docs/MODES.md', 'utf8');

describe('every mode', () => {
  it('is listed once in MODE_IDS', () => {
    expect([...MODE_IDS].sort()).toEqual(Object.keys(MODES).sort());
  });

  MODE_IDS.forEach((id, i) => {
    const mode = MODES[id];
    const theme = THEME_IDS[(i * 3) % THEME_IDS.length];

    it(`${id}: has its section in docs/MODES.md`, () => {
      expect(MODES_DOC, `no "## ${mode.label}:" section`).toContain(`\n## ${mode.label}:`);
    });

    it(`${id}: builds the level it asks for (${theme})`, () => {
      const ask = mode.profile;
      const lv = generateLevel(1, theme, ask);
      if (ask.builder) expect(BUILDERS[ask.builder as BuilderId], `builder ${ask.builder}`).toBeDefined();
      if (ask.loop) expect(lv.loop, 'loop').toBeGreaterThan(0);
      if (ask.tide) expect(lv.tide, 'tide').toBeDefined();
      if (ask.bare) expect(lv.solution, 'owes no part').toEqual([]);
      if (ask.ends) expect(lv.spawns, 'a spawn at each end').toEqual([lv.goal]);
      if (ask.noWeather) expect(ask.noWeather, 'weather it never has').not.toContain(lv.weather?.kind);
      if (ask.boxes)
        expect(
          lv.setPieces.some((p) => p.def.key === 'loop-box'),
          'boxes of its own',
        ).toBe(true);
      expect(decorFaults(lv, placeDecor(lv, lv.theme)), 'decor off its spawn, flag, boxes and stands').toEqual([]);
    });

    if (mode.fresh) {
      const fresh = mode.fresh;
      it(`${id}: ramps its fresh levels round by round, never easing off, up to a bound (${theme})`, () => {
        for (let r = 2; r < 30; r++)
          for (const [k, v] of Object.entries(fresh(r + 1)))
            if (typeof v === 'number') expect(v, `${k} from round ${r} to ${r + 1}`).toBeGreaterThanOrEqual(fresh(r)[k as keyof typeof fresh] as number);
        expect(fresh(60), 'bounded').toEqual(fresh(30));
        // The top of the ramp still builds what the mode asks for, keeping its builder's promises.
        const lv = generateLevel(1, theme, roundProfile({ ...DEFAULT_RULES, mode: id }, 30));
        expect(lastGenInfo.fallback, 'no fallback').toBe(false);
        expect(lastGenInfo.contractFaults ?? [], 'contract faults').toEqual([]);
        if (mode.profile.bare) expect(lv.solution, 'owes no part').toEqual([]);
      });
    }

    it(`${id}: plays a round of bots to its end`, { timeout: 60_000 }, () => {
      const r = botRound(1, { mode: id, players: 3, limit: 60 * 60 });
      expect(r.frames).toBeGreaterThan(0);
      expect(r.frames).toBeLessThan(60 * 60);
    });
  });
});
