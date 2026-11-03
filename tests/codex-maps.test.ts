import { describe, expect, it } from 'vitest';
import { mapSections, ownHazards } from '../src/codex/maps';
import { type MapJob, planShot } from '../src/codex/shots';
import { CONCEPTS, ownPieces } from '../src/gen/stage';
import { moduleArt } from '../src/render/props/common';
import '../src/render/props/modules';
import type { PlacedProp } from '../src/sim/props';
import { THEME_IDS, THEME_NOTES } from '../src/themes';

/**
 * The codex's maps cover the registries: every theme, every registered stage concept and every hazard a
 * theme has to itself gets an entry with its words, and a picture the codex can really draw (a level at the
 * codex's seeds that raises that landmark or places that hazard, with art for everything in it).
 */

const sections = mapSections();
const entry = (job: MapJob) => sections.find((s) => s.theme === job.theme)?.entries.find((e) => e.job.kind === job.kind && e.job.id === job.id);
const noArt = (pieces: readonly PlacedProp[]) => [...new Set(pieces.flatMap((p) => p.def.modules.map((m) => m.type)))].filter((t) => moduleArt(t).length === 0);

describe('codex maps', () => {
  for (const theme of THEME_IDS) {
    it(`${theme}: its section, its look and its words`, () => {
      expect(THEME_NOTES[theme]).toBeTruthy();
      const shot = planShot({ kind: 'theme', theme, id: theme });
      expect(shot?.level.theme.id).toBe(theme);
      expect(entry({ kind: 'theme', theme, id: theme })?.title).toBe(shot?.level.theme.name);
    });

    for (const c of CONCEPTS[theme])
      it(`${theme}/${c.id}: a landmark entry with its words and a picture of it`, () => {
        const job: MapJob = { kind: 'landmark', theme, id: c.id };
        expect(entry(job), 'no codex entry').toBeDefined();
        expect(c.codex?.about, `${c.id} has no codex.about (src/gen/stage)`).toBeTruthy();
        const shot = planShot(job);
        expect(shot?.level.landmark?.concept, 'never raised at the codex seeds (src/codex/shots.ts SHOT_SEEDS)').toBe(c.id);
        expect(noArt(ownPieces(shot!.level))).toEqual([]);
      });

    for (const r of ownHazards(theme))
      it(`${theme}/${r.name}: a hazard entry with its words and a picture of it`, () => {
        const job: MapJob = { kind: 'hazard', theme, id: r.name };
        expect(entry(job), 'no codex entry').toBeDefined();
        expect(r.codex?.title && r.codex.note && r.codex.about, `${r.name} has no full codex card (src/gen/setpieces)`).toBeTruthy();
        const shot = planShot(job);
        expect(shot?.level.setPieces.length, 'never placed at the codex seeds').toBe(1);
        expect(noArt(shot!.level.setPieces)).toEqual([]);
      });
  }
});
