/**
 * `pnpm shot artqa --theme T` (or `--themes all`, or `--themes farm,mine`): the art consistency sheet. Every landmark, set-piece
 * hazard and decor kind a theme has, mid-race beside that theme's terrain and three crate parts (a platform, a saw, a launcher),
 * at play scale (1 world px = 2.5 screen px, as at 1080p) and at 2×. One sheet per theme and kind of piece:
 * `artqa-<theme>-landmarks.png`, `-hazards.png`, `-decor.png`. `--only landmarks,decor` skips the rest.
 * The bar is docs/ART.md → World art: a piece should read as drawn by the same hand as the ground and the parts beside it.
 */
import { generateLevel } from '../../src/gen/level';
import { SET_PIECE_RECIPES } from '../../src/gen/setpieces';
import { decorFor } from '../../src/gen/decor';
import { CONCEPTS } from '../../src/gen/stage';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { open, opt, out, page, pet, seed, sheet, step, theme, type Scenarios } from './ctx';

/** The parts every subject stands beside: one building block, one hazard, one machine. */
const PARTS = ['platform', 'saw', 'launcher'];
/** Screen px per world px at zoom 1: the shot window is 1920×1080 over the 768×432 view. */
const PX = 2.5;
/** Sim frames into the race before a subject is shot: past the countdown, its movers under way. */
const WARM = 90;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Start a race on the loaded level with the reference parts placed as close to `near` (a tile) as they fit. */
async function raceWithParts(near: { tx: number; ty: number }) {
  await page.evaluate(
    ([kinds, n]) => {
      const d = (window as any).slagDebug;
      if (!d.match.players.length) d.quickStart(2);
      if (d.match.phase === 'lobby') d.match.startMatch();
      d.addProps(kinds, 1, 0, n);
      d.match.startRun();
    },
    [PARTS, near] as const,
  );
  await step(WARM);
}

/**
 * Pin the camera on a box (world px) at `zoom` and shoot the window cropped to it plus a margin. The window is the view at
 * 2.5 screen px per view px, so world px land at `PX * zoom` screen px.
 */
async function shoot(name: string, b: Box, zoom: number, margin: number) {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  await page.evaluate(
    ([x, y, z]) => {
      const cam = (window as any).slagDebug.renderer.cam;
      cam.update = () => {};
      cam.snap({ cx: x, cy: y, zoom: z });
      cam.shake = 0;
      (window as any).slagDebug.render();
    },
    [cx, cy, zoom] as const,
  );
  const size = page.viewportSize()!;
  const k = PX * zoom;
  const w = Math.min(size.width, (b.x1 - b.x0 + margin * 2) * k);
  const h = Math.min(size.height, (b.y1 - b.y0 + margin * 2) * k);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h } });
  console.log(path);
  pet();
  return path;
}

/** Both scales of one subject. */
async function pair(name: string, b: Box): Promise<string[]> {
  return [await shoot(`${name}-1x`, b, 1, 56), await shoot(`${name}-2x`, b, 2, 20)];
}

const tileBox = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0: x0 * 16, y0: y0 * 16, x1: (x1 + 1) * 16, y1: (y1 + 1) * 16 });

async function landmarks(th: ThemeId) {
  const files: string[] = [];
  for (const c of CONCEPTS[th]) {
    const r = await page.evaluate(
      ([s, t, id]) => {
        const d = (window as any).slagDebug;
        d.match.forceProfile = { ...d.match.forceProfile, concept: id, size: undefined, hazards: undefined, danger: undefined };
        d.loadLevel(s, t);
        return d.match.level.landmark?.rect ?? null;
      },
      [seed, th, c.id] as const,
    );
    if (!r) continue;
    await raceWithParts({ tx: r.x + r.w + 2, ty: r.y + r.h - 2 });
    files.push(...(await pair(`artqa-${th}-landmark-${c.id}`, tileBox(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1))));
  }
  if (files.length) await sheet(`artqa-${th}-landmarks`, files, 2);
}

async function hazards(th: ThemeId) {
  const files: string[] = [];
  for (const { name } of SET_PIECE_RECIPES[th]) {
    const key = `setpiece:${th}:${name}`;
    let found: number | null = null;
    for (let s = 1; s < 60 && found === null; s++) {
      const l = generateLevel(s, th, { concept: 'plain', size: 'classic', hazards: 4, danger: 1 });
      if (l.setPieces.some((p) => p.def.key === key)) found = s;
    }
    if (found === null) {
      console.log(`artqa: no level with ${key}`);
      continue;
    }
    const box = await page.evaluate(
      ([s, t, k]) => {
        const d = (window as any).slagDebug;
        d.match.forceProfile = { ...d.match.forceProfile, size: 'classic', concept: 'plain', hazards: 4, danger: 1 };
        d.loadLevel(s, t);
        const pp = d.match.level.setPieces.find((p: any) => p.def.key === k);
        const xs = pp.def.footprint.map((c: number[]) => c[0] + pp.tx);
        const ys = pp.def.footprint.map((c: number[]) => c[1] + pp.ty);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      },
      [found, th, key] as const,
    );
    await raceWithParts({ tx: box[2] + 3, ty: box[3] });
    files.push(...(await pair(`artqa-${th}-hazard-${name.replace(/ /g, '-')}`, tileBox(box[0], box[1], box[2], box[3]))));
  }
  if (files.length) await sheet(`artqa-${th}-hazards`, files, 2);
}

async function decor(th: ThemeId) {
  const files: string[] = [];
  await page.evaluate(
    ([s, t]) => {
      const d = (window as any).slagDebug;
      d.match.forceProfile = { ...d.match.forceProfile, size: 'classic', concept: 'plain', hazards: 0, danger: undefined };
      d.loadLevel(s, t);
    },
    [seed, th] as const,
  );
  // The parts stand on the ground near the middle, where the decor nearest them grows.
  const ground = await page.evaluate(() => {
    const lv = (window as any).slagDebug.match.level;
    for (const dx of [0, 2, -2, 4, -4, 6, -6, 8, -8]) {
      const tx = Math.floor(lv.w / 2) + dx;
      for (let ty = 2; ty < lv.h - 1; ty++) if (lv.tiles[ty * lv.w + tx] === 1 && lv.tiles[(ty - 1) * lv.w + tx] === 0) return { tx, ty: ty - 1 };
    }
    return { tx: Math.floor(lv.w / 2), ty: Math.floor(lv.h / 2) };
  });
  await raceWithParts(ground);
  for (const [i, kind] of decorFor(th).entries()) {
    // Only this kind, on most of the ground there's room on; the piece nearest the parts is the one shot.
    const at = await page.evaluate(
      ([k, n]) => {
        const d = (window as any).slagDebug;
        const lv = d.match.level;
        lv.theme = { ...lv.theme, seed: lv.theme.seed + n + 1, decor: [k], decorDensity: 0.7 };
        lv.version++;
        d.render();
        const spots: any[] = d.renderer.terrain.decor ?? [];
        const ps = d.match.placed.map((p: any) => [p.tx * 16, p.ty * 16]);
        const px = ps.reduce((a: number, p: number[]) => a + p[0], 0) / Math.max(1, ps.length) || lv.w * 8;
        const py = ps.reduce((a: number, p: number[]) => a + p[1], 0) / Math.max(1, ps.length) || lv.h * 8;
        let best: any = null;
        for (const sp of spots) if (!best || Math.hypot(sp.x - px, sp.y - py) < Math.hypot(best.x - px, best.y - py)) best = sp;
        return best ? [best.x, best.y] : null;
      },
      [kind, i] as const,
    );
    if (!at) {
      console.log(`artqa: no room for ${th} ${kind}`);
      continue;
    }
    await step(1);
    files.push(...(await pair(`artqa-${th}-decor-${kind}`, { x0: at[0] - 24, y0: at[1] - 36, x1: at[0] + 24, y1: at[1] + 12 })));
  }
  if (files.length) await sheet(`artqa-${th}-decor`, files, 4);
}

export const shots: Scenarios = {
  async artqa() {
    const list = opt('themes');
    const themes = (list === 'all' ? THEME_IDS : (list?.split(',') ?? [theme ?? 'farm'])) as ThemeId[];
    const only = opt('only')?.split(',');
    const want = (k: string) => !only || only.includes(k);
    if (page.viewportSize()!.width !== 1920) await page.setViewportSize({ width: 1920, height: 1080 });
    // Clear air: mist would veil the very pieces under review.
    await open(`seed=${seed}&ui=0&lettering=0${opt('weather') ? '' : '&weather=clear'}`);
    for (const th of themes) {
      if (!THEME_IDS.includes(th)) throw new Error(`artqa: unknown theme ${th}`);
      if (want('landmarks')) await landmarks(th);
      if (want('hazards')) await hazards(th);
      if (want('decor')) await decor(th);
    }
  },
};
