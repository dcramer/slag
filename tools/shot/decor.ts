/**
 * `pnpm shot decor --theme T [--seed S]`: a catalogue of a theme's decor (src/gen/decor), one frame per kind:
 * the same plain level, its look showing only that kind, densely, with the camera in close.
 */
import { decorFor } from '../../src/gen/decor';
import type { ThemeId } from '../../src/themes';
import { open, page, seed, sheet, snap, step, theme, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async decor() {
    const th = (theme ?? 'volcano') as ThemeId;
    await open(`seed=${seed}&theme=${th}&ui=0&zoom=2`);
    const files: string[] = [];
    for (const [i, kind] of decorFor(th).entries()) {
      await page.evaluate(
        ([k, n]) => {
          const d = (window as any).slagDebug;
          const lv = d.match.level;
          // A new look seed is a new decor layout: only this kind, on most of the ground there's room on.
          lv.theme = { ...lv.theme, seed: lv.theme.seed + n + 1, decor: [k], decorDensity: 0.7 };
          lv.version++;
        },
        [kind, i] as const,
      );
      await step(2);
      files.push(await snap(`decor-${th}-${kind}`));
    }
    await sheet(`decor-${th}`, files);
  },
};
