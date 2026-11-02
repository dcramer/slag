/**
 * `pnpm shot decor --theme T [--seed S]`: a contact sheet of a theme's decor, one shot per kind registered for
 * it (src/gen/decor), each grown thick over a plain level of the theme so every piece shows on its ground.
 */
import { decorFor } from '../../src/gen/decor';
import type { ThemeId } from '../../src/themes';
import { open, page, seed, sheet, snap, step, theme, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async decor() {
    const t = (theme ?? 'harbor') as ThemeId;
    await open(`seed=${seed}&ui=0&theme=${t}&concept=plain&weather=clear&size=classic`);
    await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
    const files: string[] = [];
    for (const kind of decorFor(t)) {
      // A new look seed re-places the decor (the painter keys its decor on it).
      await page.evaluate((k) => {
        const lv = (window as any).slagDebug.match.level;
        lv.theme = { ...lv.theme, decor: [k], decorDensity: 0.6, seed: lv.theme.seed + 1 };
        lv.version++;
      }, kind);
      await step(2);
      files.push(await snap(`decor-${t}-${kind}`));
    }
    await sheet(`decor-${t}`, files, 4);
  },
};
