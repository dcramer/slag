/**
 * Character-direction sheets for docs/CHARACTERS.md: `pnpm shot cast [--cast a|b|c|all] [--seed S] [--only catalog]`.
 * Per direction: the eight-runner lineup at play scale on a light theme and a dark one, a 3× close-up,
 * the race pack, the lobby cards, and the catalog of every kind, composed into `cast-<x>.png`. `all`
 * also shoots today's characters and composes the three directions side by side into `cast-all.png`.
 */
import { writeFileSync } from 'node:fs';
import { browser, open, opt, out, page, pet, seed, type Scenarios, step } from './ctx';

const LIGHT = opt('light', 'farm')!;
const DARK = opt('dark', 'mine')!;
const NAMES: Record<string, string> = { base: "Today's blobs", a: 'A. Creature prints', b: 'B. Species cast', c: 'C. Foundry toys' };

/** Eight runners on open floor in a spread of poses (the `lineup` scenario's staging), shot at 1× and 3×, then the pack. */
async function lineup(mode: string, theme: string): Promise<{ x1: string; x3: string; pack: string } | null> {
  // Not every level has a 13-tile run of open floor: try the seed, then a few after it.
  for (let i = 0; i < 12; i++) {
    const sd = i ? `${seed}${i}` : (seed ?? 'demo');
    const got = await lineupOn(sd, mode, theme);
    if (got) return got;
  }
  console.log(`${mode}/${theme}: no open floor for a lineup, skipped`);
  return null;
}

async function lineupOn(sd: string, mode: string, theme: string): Promise<{ x1: string; x3: string; pack: string } | null> {
  await open(`seed=${sd}&players=8&race=,&propseed=1&theme=${theme}${mode === 'base' ? '' : `&cast=${mode}`}`);
  await step(150);
  // A string, not a function: the bundler wraps named helpers in a __name the page doesn't have.
  const row: { x: number; y: number; devs: string[] } | null = await page.evaluate(`(() => {
    // Eight standing spots 25 px apart, each on a floor with headroom, all within two tiles of height:
    // hilly themes (a farm) rarely have thirteen flat tiles in a row.
    const d = window.slagDebug;
    const L = d.match.run.level;
    const solid = (x, y) => L.tiles[y * L.w + x] === 1;
    const stands = (x) => {
      const out = [];
      for (let ty = 6; ty < L.h - 1; ty++) if (solid(x, ty) && [1, 2, 3, 4].every((dy) => !solid(x, ty - dy) && L.tiles[(ty - dy) * L.w + x] === 0)) out.push(ty);
      return out;
    };
    for (let tx = 3; tx < L.w - 14; tx++) {
      const cols = Array.from({ length: 8 }, (_, i) => Math.floor((tx * 16 + 8 + i * 25) / 16));
      const cands = cols.map(stands);
      for (const t0 of [...cands[0]].reverse()) {
        const pick = cands.map((c) => c.reduce((b, t) => (Math.abs(t - t0) < Math.abs(b - t0) ? t : b), -99));
        if (pick.some((t) => Math.abs(t - t0) > 2)) continue;
        d.match.run.runners.forEach((r, i) => {
          r.body.x = tx * 16 + 8 + i * 25 - r.body.w / 2;
          r.body.y = pick[i] * 16 - r.body.h;
          r.body.vx = r.body.vy = 0;
        });
        const feet = (pick.reduce((a, t) => a + t, 0) / pick.length) * 16;
        return { x: tx * 16 + 8 + 3.5 * 25, y: feet - 10, devs: d.match.players.map((p) => p.device) };
      }
    }
    return null;
  })()`);
  if (!row) return null;
  const press = (n: number, inputs: object) =>
    page.evaluate(
      ([c, i]) => {
        for (let k = 0; k < c; k++) (window as any).slagDebug.step(1, i);
      },
      [n, inputs] as const,
    );
  const dv = row.devs as string[];
  await press(20, {});
  // Poses: idle, facing back, walking, running, rising, falling, idle, idle.
  await press(2, { [dv[1]]: { left: true } });
  await press(14, { [dv[5]]: { jump: true, jumpPressed: true } });
  await press(1, { [dv[4]]: { jump: true, jumpPressed: true }, [dv[2]]: { right: true }, [dv[3]]: { right: true, run: true } });
  await press(5, { [dv[4]]: { jump: true }, [dv[2]]: { right: true }, [dv[3]]: { right: true, run: true } });
  const size = page.viewportSize()!;
  const k = size.width / 768;
  const shot: Record<string, string> = {};
  for (const zoom of [1, 3]) {
    await page.evaluate(
      ([x, y, z]) => {
        const cam = (window as any).slagDebug.renderer.cam;
        cam.update = () => {};
        cam.snap({ cx: x, cy: y, zoom: z });
        cam.shake = 0;
        (window as any).slagDebug.render();
      },
      [row.x, row.y, zoom] as const,
    );
    const [w, h] = zoom === 1 ? [300 * k, 90 * k] : [size.width, 160 * k];
    const path = `${out}/cast-${mode}-${theme}-x${zoom}.png`;
    await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: size.height / 2 - h * 0.62, width: w, height: h } });
    console.log(path);
    pet();
    shot[`x${zoom}`] = path;
  }
  const go = (j: boolean) =>
    Object.fromEntries(dv.map((v, i) => [v, { right: true, run: i % 3 !== 2, jump: j && i % 2 === 1, jumpPressed: j && i % 2 === 1 }]));
  await press(8, go(false));
  await press(1, go(true));
  await press(9, Object.fromEntries(dv.map((v, i) => [v, { right: true, run: i % 3 !== 2, jump: i % 2 === 1 }])));
  await page.evaluate(() => {
    const d = (window as any).slagDebug;
    const rs = d.match.run.runners;
    const cx = rs.reduce((a: number, r: any) => a + r.body.x, 0) / rs.length;
    const cam = d.renderer.cam;
    cam.update = () => {};
    cam.snap({ cx, cy: rs[0].body.y - 10, zoom: 1 });
    cam.shake = 0;
    d.render();
  });
  const pack = `${out}/cast-${mode}-${theme}-pack.png`;
  await page.screenshot({ path: pack, clip: { x: size.width / 2 - 170 * k, y: size.height / 2 - 70 * k, width: 340 * k, height: 110 * k } });
  console.log(pack);
  pet();
  return { x1: shot.x1, x3: shot.x3, pack };
}

async function lobby(mode: string): Promise<string> {
  await open(`seed=${seed}${mode === 'base' ? '' : `&cast=${mode}`}`);
  await page.evaluate(() => {
    const d = (window as any).slagDebug;
    for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5']) d.match.join(dev);
  });
  await step(30);
  const path = `${out}/cast-${mode}-lobby.png`;
  await page.screenshot({ path });
  console.log(path);
  pet();
  return path;
}

async function catalog(mode: string): Promise<string> {
  await open(`seed=${seed}&cast=${mode}`);
  await page.evaluate(() => document.fonts.ready);
  const box = await page.evaluate((m) => {
    const cv = (window as any).slagDebug.cast.catalog(m);
    return { width: cv.width, height: cv.height };
  }, mode);
  const path = `${out}/cast-${mode}-catalog.png`;
  await page.screenshot({ path, clip: { x: 0, y: 0, ...box } });
  console.log(path);
  pet();
  const bench = await page.evaluate((m) => (window as any).slagDebug.cast.bench(m, 300), mode);
  console.log(`bench ${mode}: today ${bench.base.toFixed(3)} ms/runner, prototype ${bench.proto.toFixed(3)} ms/runner`);
  writeFileSync(`${out}/cast-${mode}-bench.json`, JSON.stringify(bench));
  return path;
}

async function compose(name: string, html: string, width = 1900) {
  const hp = `${out}/${name}.html`;
  writeFileSync(
    hp,
    `<html><body style="margin:0;padding:16px;background:#120b08;color:#f6ead8;font:600 16px Barlow,system-ui,sans-serif;width:${width - 32}px">${html}</body></html>`,
  );
  const sp = await browser.newPage({ viewport: { width, height: 1000 } });
  await sp.goto(`file://${hp}`);
  await sp.waitForTimeout(400);
  await sp.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${out}/${name}.png`);
  pet();
  await sp.close();
}

const img = (f: string | undefined, label: string, w = '100%') =>
  f
    ? `<figure style="margin:0 0 10px;width:${w}"><img src="file://${f}" style="width:100%;display:block;border:1px solid #3d2e26"><figcaption style="color:#c9b8a3;font-size:13px;margin-top:3px">${label}</figcaption></figure>`
    : '';
const h = (t: string) => `<h2 style="margin:6px 0 10px;font:400 30px 'Lilita One',system-ui;color:#ffb02e">${t}</h2>`;
const row = (...cells: string[]) => `<div style="display:flex;gap:12px;align-items:flex-start">${cells.join('')}</div>`;

type Shots = { light: Awaited<ReturnType<typeof lineup>>; dark: Awaited<ReturnType<typeof lineup>>; lobby: string; catalog?: string };

async function direction(mode: string): Promise<Shots> {
  const light = await lineup(mode, LIGHT);
  const dark = await lineup(mode, DARK);
  const lb = await lobby(mode);
  const cat = mode === 'base' ? undefined : await catalog(mode);
  if (mode !== 'base')
    await compose(
      `cast-${mode}`,
      h(NAMES[mode]) +
        row(img(light?.x1, `Play scale, ${LIGHT} (1920×1080 crop)`, '50%'), img(dark?.x1, `Play scale, ${DARK}`, '50%')) +
        row(img(light?.pack, `Race start, ${LIGHT}`, '50%'), img(dark?.pack, `Race start, ${DARK}`, '50%')) +
        img(light?.x3, `3× close-up, ${LIGHT}: idle, facing back, walk, run, rise, fall, idle, idle`) +
        img(dark?.x3, `3× close-up, ${DARK}`) +
        img(lb, 'Lobby cards, 8 players') +
        img(cat, 'Catalog: every kind on two seeds, poses, the set at play scale'),
    );
  return { light, dark, lobby: lb, catalog: cat };
}

export const shots: Scenarios = {
  async cast() {
    const which = opt('cast', 'all')!;
    const modes = which === 'all' ? ['base', 'a', 'b', 'c'] : which.split(',');
    if (opt('only') === 'catalog') {
      // Fast iteration on the art: the catalogs alone.
      for (const m of modes) if (m !== 'base') await catalog(m);
      return;
    }
    const got: Record<string, Shots> = {};
    for (const m of modes) got[m] = await direction(m);
    if (which !== 'all') return;
    const col = (m: string) =>
      `<div style="flex:1;min-width:0">${h(NAMES[m])}${img(got[m].light?.x1, `Play scale, ${LIGHT}`)}${img(got[m].dark?.x1, `Play scale, ${DARK}`)}${img(
        got[m].light?.pack,
        'Race start',
      )}${img(got[m].lobby, 'Lobby')}</div>`;
    await compose(
      'cast-all',
      row(col('a'), col('b'), col('c')) +
        `<div style="margin-top:14px">${h(NAMES.base)}${row(img(got.base.light?.x1, LIGHT, '33%'), img(got.base.dark?.x1, DARK, '33%'), img(got.base.lobby, 'Lobby', '33%'))}</div>`,
      2400,
    );
  },
};
