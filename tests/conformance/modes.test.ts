import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODE_IDS, MODES } from '../../src/game/modes';
import { generateLevel } from '../../src/gen/level';
import { BUILDERS, type BuilderId } from '../../src/gen/level/builders';
import { THEME_IDS } from '../../src/themes';
import { botRound } from '../lib/bot-race';

/**
 * The mode contract (AGENTS.md → Extension points → Playstyle mode): every mode in `MODES` is listed, has its section
 * in docs/MODES.md against its reference game, builds the level it asks for (each of `ModeDef.profile`'s asks, in a
 * theme that takes turns by mode), and plays a round of bots to its end. The registries keyed by mode (bot strategies
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
      if (ask.gates) expect(lv.tide?.gates?.length, 'gates across its shaft').toBeGreaterThan(0);
      if (ask.boxes)
        expect(
          lv.setPieces.some((p) => p.def.key === 'loop-box'),
          'boxes of its own',
        ).toBe(true);
    });

    it(`${id}: plays a round of bots to its end`, { timeout: 60_000 }, () => {
      const r = botRound(1, { mode: id, players: 3, limit: 60 * 60 });
      expect(r.frames).toBeGreaterThan(0);
      expect(r.frames).toBeLessThan(60 * 60);
    });
  });
});
