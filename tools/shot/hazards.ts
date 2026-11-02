/**
 * `pnpm shot hazards --theme T [--only 'hay hook,muck spreader']`: each of a theme's set-piece recipes on the
 * first seed whose level has it, close up during a race, at three phases (or after each of `--steps 40,50,50` frames).
 */
import { generateLevel } from '../../src/gen/level';
import { SET_PIECE_RECIPES } from '../../src/gen/setpieces';
import type { ThemeId } from '../../src/themes';
import { open, opt, out, page, seed, sheet, step, theme, type Scenarios } from './ctx';

export const shots: Scenarios = {
  /** `pnpm shot hazards [--theme farm] [--only 'hay hook,muck spreader']`: each recipe on a level that has it, three phases. */
  async hazards() {
    const th = (theme ?? 'farm') as ThemeId;
    const only = opt('only')?.split(',');
    const steps = (opt('steps') ?? '40,50,50').split(',').map(Number);
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
          // A race, so its shots fly and its tells run on the sim's clock.
          d.race([], 1);
        },
        [found, th] as const,
      );
      // Close up on the piece: a classic level fills the window exactly.
      const box = await page.evaluate((key) => {
        const lv = (window as any).slagDebug.match.level;
        const pp = lv.setPieces.find((p: any) => p.def.key === key);
        if (!pp) return null;
        const xs = pp.def.footprint.map((c: number[]) => c[0] + pp.tx);
        const ys = pp.def.footprint.map((c: number[]) => c[1] + pp.ty);
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), w: lv.w, h: lv.h };
      }, `setpiece:${th}:${name}`);
      if (!box) continue;
      const size = page.viewportSize()!;
      const k = size.width / box.w;
      const cx = ((box.x0 + box.x1 + 1) / 2) * k;
      const cy = ((box.y0 + box.y1 + 1) / 2) * k;
      const cw = Math.min(size.width, Math.max(box.x1 - box.x0 + 12, 22) * k);
      const ch = Math.min(size.height, cw * 0.56);
      const clip = { x: Math.max(0, Math.min(size.width - cw, cx - cw / 2)), y: Math.max(0, Math.min(size.height - ch, cy - ch / 2)), width: cw, height: ch };
      for (const [i, n] of steps.entries()) {
        await step(n);
        const path = `${out}/hazard-${th}-${name.replace(/ /g, '-')}-${found}-${i}.png`;
        await page.screenshot({ path, clip });
        console.log(path);
        files.push(path);
      }
    }
    await sheet(`hazards-${th}`, files);
  },
};
