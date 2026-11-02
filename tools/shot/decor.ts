/**
 * A theme's decor and its own hazards, each on a sheet. `decor`: every decor kind registered for the theme,
 * one shot each, a row of them on posts across a cleared level so the seed's variation shows. `hazards`:
 * each set-piece recipe of the theme on the first seed whose level has it, at three phases.
 */
import { decorFor } from '../../src/gen/decor';
import { generateLevel } from '../../src/gen/level';
import { SET_PIECE_RECIPES } from '../../src/gen/setpieces';
import type { ThemeId } from '../../src/themes';
import { open, opt, page, seed, sheet, snap, step, theme, type Scenarios } from './ctx';

export const shots: Scenarios = {
  /** `pnpm shot decor [--theme farm]`: one shot per decor kind of the theme. */
  async decor() {
    const th = (theme ?? 'farm') as ThemeId;
    await open(`seed=${seed}&ui=0&lettering=0`);
    await page.evaluate(
      ([sd, t]) => {
        const d = (window as any).slagDebug;
        d.match.forceProfile = { ...d.match.forceProfile, size: 'classic', concept: 'plain' };
        d.loadLevel(sd, t);
        d.match.join('kb1');
      },
      [seed, th] as const,
    );
    const files: string[] = [];
    const kinds = decorFor(th);
    for (const [i, kind] of kinds.entries()) {
      await page.evaluate(
        ([k, n]) => {
          const d = (window as any).slagDebug;
          const lv = d.match.level;
          // Posts of ground across the level, a floor under them: a piece on every top.
          const F = lv.h - 9;
          for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) lv.tiles[y * lv.w + x] = (x % 4 === 2 && y >= F) || y >= lv.h - 3 ? 1 : 0;
          lv.setPieces = [];
          delete lv.landmark;
          lv.theme = { ...lv.theme, decor: [k], decorDensity: 1, seed: lv.theme.seed + n + 1 };
          lv.version++;
        },
        [kind, i] as const,
      );
      await step(2);
      files.push(await snap(`decor-${th}-${kind}`));
    }
    await sheet(`decor-${th}`, files, 4);
  },

  /** `pnpm shot hazards [--theme farm] [--only 'hay hook,muck spreader']`: each recipe on a level that has it, three phases. */
  async hazards() {
    const th = (theme ?? 'farm') as ThemeId;
    const only = opt('only')?.split(',');
    const names = SET_PIECE_RECIPES[th].map((r) => r.name).filter((n) => !only || only.includes(n));
    const files: string[] = [];
    await open(`seed=${seed}&ui=0&lettering=0`);
    for (const name of names) {
      let found: number | null = null;
      for (let s = 1; s < 60 && found === null; s++) {
        const l = generateLevel(s, th, { concept: 'plain', size: 'classic', hazards: 4, danger: 1 });
        if (l.setPieces.some((p) => p.def.key === `setpiece:${th}:${name}`)) found = s;
      }
      if (found === null) continue;
      await page.evaluate(
        ([sd, t]) => {
          const d = (window as any).slagDebug;
          d.match.forceProfile = { ...d.match.forceProfile, size: 'classic', concept: 'plain', hazards: 4, danger: 1 };
          d.loadLevel(sd, t);
          d.match.join('kb1');
        },
        [found, th] as const,
      );
      for (const [i, n] of [40, 50, 50].entries()) {
        await step(n);
        files.push(await snap(`hazard-${th}-${name.replace(/ /g, '-')}-${found}-${i}`));
      }
    }
    await sheet(`hazards-${th}`, files);
  },
};
