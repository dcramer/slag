/**
 * `pnpm shot themeswap [--themes volcano,jungle,castle]`: one page loads a level of each theme in turn, and each frame is
 * checked against the same level shot on a fresh page. A difference is render state one level left behind for the next
 * (a backdrop bake, a light map, the surroundings): a page plays match after match, each on a level of its seed's theme.
 * Volcano goes first and every theme follows another: a pooled backdrop canvas once kept a harbor's ships or a volcano's
 * mountains and veiled the next level with them. Writes `themeswap-<pass>-<theme>-{fresh,after}.png` for every theme
 * that differs and fails the run.
 */
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { writeFileSync } from 'node:fs';
import { browser, open, opt, out, page, pet, seed, type Scenarios } from './ctx';

/** Channel steps (0..255) a pixel may differ by before it counts: the GPU's own rounding. */
const TOLERANCE = 8;
/** Share of the frame's pixels that may differ before the shot counts as different. */
const MAX_SHARE = 0.002;

/** The camera's zoom: below 1, so the surroundings past every edge of the level are in the picture too. */
const ZOOM = 0.7;

/**
 * The second pass forces one profile on every theme, so the levels differ by their theme alone: a cache keyed by the
 * seed and the profile (levelKey before it carried the theme) hands one theme's surroundings to the next.
 */
const SHARED = { size: 'classic', concept: 'plain', route: 'ltr', density: 0.5, hazards: 2, danger: 0.5, gravity: 1 };
type Force = typeof SHARED | null;

/**
 * Load `th` on the open page and shoot it with the camera pinned on the level's middle at a fixed time. Motes drift from
 * `Math.random`, so it runs from one fixed seed for the shot: what's left is what the level drew.
 */
async function shootTheme(th: ThemeId, force: Force): Promise<Buffer> {
  await page.evaluate(
    ([s, t, z, f]) => {
      const d = (window as any).slagDebug;
      d.match.forceProfile = f ?? {};
      d.loadLevel(s, t);
      const lv = d.match.level;
      const cam = d.renderer.cam;
      cam.update = () => {};
      cam.snap({ cx: (lv.w * 16) / 2, cy: (lv.h * 16) / 2, zoom: z });
      cam.shake = 0;
      let r = 0x9e3779b9;
      Math.random = () => (r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296;
      // As a first frame, so particles step the same on either page; then twice at one time: the first finishes the
      // bakes, the second is the picture.
      d.renderer.last = 0;
      d.render(4000);
      d.render(4000);
    },
    [seed, th, ZOOM, force] as const,
  );
  pet();
  return page.screenshot();
}

/** Share of pixels that differ by more than TOLERANCE in any channel, measured on a scratch page. */
async function differ(a: Buffer, b: Buffer): Promise<number> {
  const p = await browser.newPage();
  try {
    // tsx names functions through a helper that the page doesn't have.
    await p.evaluate('globalThis.__name = (f) => f');
    return await p.evaluate(
      async ([x, y, tol]) => {
        const load = async (b64: string) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext('2d')!;
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const [da, db] = [await load(x), await load(y)];
        if (da.length !== db.length) return 1;
        let bad = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) bad++;
        }
        return bad / (da.length / 4);
      },
      [a.toString('base64'), b.toString('base64'), TOLERANCE] as const,
    );
  } finally {
    await p.close();
  }
}

/** Every theme on a fresh page, then all of them in turn on one page; the names of those that drew differently. */
async function pass(themes: ThemeId[], force: Force, tag: string): Promise<string[]> {
  const q = `seed=${seed}&ui=0&lettering=0${opt('weather') ? '' : '&weather=clear'}`;
  const fresh = new Map<ThemeId, Buffer>();
  for (const th of new Set(themes)) {
    await open(q);
    fresh.set(th, await shootTheme(th, force));
  }
  await open(q);
  const failed: string[] = [];
  for (const th of themes) {
    const after = await shootTheme(th, force);
    const share = await differ(fresh.get(th)!, after);
    console.log(`themeswap ${tag} ${th}: ${(share * 100).toFixed(2)}% of pixels differ from a fresh page`);
    if (share <= MAX_SHARE) continue;
    for (const [k, b] of [
      ['fresh', fresh.get(th)!],
      ['after', after],
    ] as const) {
      writeFileSync(`${out}/themeswap-${tag}-${th}-${k}.png`, b);
      console.log(`${out}/themeswap-${tag}-${th}-${k}.png`);
    }
    failed.push(`${th} (${tag})`);
  }
  return failed;
}

export const shots: Scenarios = {
  async themeswap() {
    const list = opt('themes');
    const themes = (list && list !== 'all' ? list.split(',') : ['volcano', ...THEME_IDS.filter((t) => t !== 'volcano')]) as ThemeId[];
    for (const th of themes) if (!THEME_IDS.includes(th)) throw new Error(`themeswap: unknown theme ${th}`);
    const failed = [...(await pass(themes, null, 'own')), ...(await pass(themes, SHARED, 'shared'))];
    if (failed.length) {
      console.error(`themeswap: ${failed.join(', ')} drew differently after another theme's level than on a fresh page`);
      process.exitCode = 1;
    }
  },
};
