/** Stage concepts (src/gen/stage): one level per concept on a contact sheet. */
import { CONCEPTS } from '../../src/gen/stage';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { open, opt, page, seed, sheet, snap, step, theme, type Scenarios } from './ctx';

export const shots: Scenarios = {
  /** `pnpm shot landmarks [--theme T] [--concept id] [--count N]`: N seeds of each concept (default 1). */
  async landmarks() {
    const only = opt('concept');
    const count = Number(opt('count', '1'));
    const themes = theme ? [theme as ThemeId] : THEME_IDS;
    const wanted = themes.flatMap((t) => CONCEPTS[t].filter((c) => !only || c.id === only).map((c) => [t, c.id] as const));
    if (!wanted.length) {
      console.log(`no stage concepts registered${theme ? ` for ${theme}` : ''}${only ? ` named ${only}` : ''}`);
      return;
    }
    const files: string[] = [];
    await open(`seed=${seed}&ui=0`);
    for (const [t, id] of wanted) {
      for (let i = 0; i < count; i++) {
        const s = `${seed}${i}`;
        await page.evaluate(
          ([x, th, c]) => {
            const d = (window as any).slagDebug;
            d.match.forceProfile = { ...d.match.forceProfile, concept: c };
            d.loadLevel(x, th);
          },
          [s, t, id] as const,
        );
        await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
        await step(90);
        files.push(await snap(`landmark-${t}-${id}-${s}`));
      }
    }
    await sheet('landmarks', files);
  },
};
