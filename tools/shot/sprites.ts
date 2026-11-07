/**
 * The 3D-rendered kinds (tools/art3d, docs/CHARACTERS.md → Rendered kinds) in the game, beside what they
 * replace: `pnpm shot sprites [--kind plumber] [--theme farm]`. Eight of the kind in a spread of poses at
 * play scale and 3×, the same frame hand-drawn, the kind among the rest of the cast, a run-cycle
 * filmstrip, the lobby cards, and the concept it was modelled from, composed into `sprites-<kind>.png`.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { browser, castSheet, open, opt, out, page, pet, seed, type Scenarios, step } from './ctx';

const KIND = opt('kind', 'plumber')!;
const THEME = opt('theme', 'farm')!;
/** Shots staged on a level carry its theme when it isn't the default, so a `--theme mine` run doesn't overwrite the farm one. */
const ON_THEME = THEME === 'farm' ? '' : `-${THEME}`;

const press = (n: number, inputs: object) =>
  page.evaluate(
    ([c, i]) => {
      for (let k = 0; k < c; k++) (window as any).slagDebug.step(1, i);
    },
    [n, inputs] as const,
  );

const render = (sprites: boolean) =>
  page.evaluate((on) => {
    const d = (window as any).slagDebug;
    d.sprites.use(on);
    d.render();
  }, sprites);

/** Waits until the kind's sheets have loaded and been recoloured (they load on first use, off the main path). */
async function settle() {
  for (let i = 0; i < 20; i++) {
    await render(true);
    await page.waitForTimeout(150);
  }
}

/** Eight runners on open floor, 25 px apart (the cast scenario's staging); `kinds` dresses them. */
async function stage(sd: string, kinds: string[]): Promise<{ x: number; y: number; devs: string[] } | null> {
  await open(`seed=${sd}&players=8&race=,&propseed=1&theme=${THEME}&lettering=0`);
  await page.evaluate((ks) => ks.forEach((k, i) => (window as any).slagDebug.sprites.dress(i, k)), kinds);
  await step(150);
  // A string, not a function: the bundler wraps named helpers in a __name the page doesn't have.
  return page.evaluate(`(() => {
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
}

async function staged(kinds: string[]) {
  for (let i = 0; i < 12; i++) {
    const row = await stage(i ? `${seed}${i}` : (seed ?? 'demo'), kinds);
    if (row) return row;
  }
  throw new Error(`no open floor for a lineup on ${THEME}`);
}

const snap = (x: number, y: number, z: number) =>
  page.evaluate(
    ([cx, cy, zoom]) => {
      const cam = (window as any).slagDebug.renderer.cam;
      cam.update = () => {};
      cam.snap({ cx, cy, zoom });
      cam.shake = 0;
    },
    [x, y, z] as const,
  );

/** The lineup: idle, facing back, walking, running, rising, falling, on a wall-less hop, cheering. Shot with sprites and without. */
async function lineup(name: string, kinds: string[]): Promise<Record<string, string>> {
  const row = await staged(kinds);
  const dv = row.devs;
  await press(20, {});
  await press(2, { [dv[1]]: { left: true } });
  await press(14, { [dv[5]]: { jump: true, jumpPressed: true } });
  await press(1, { [dv[4]]: { jump: true, jumpPressed: true }, [dv[2]]: { right: true }, [dv[3]]: { right: true, run: true } });
  await press(5, { [dv[4]]: { jump: true }, [dv[2]]: { right: true }, [dv[3]]: { right: true, run: true } });
  await page.evaluate(() => {
    const run = (window as any).slagDebug.match.run;
    run.runners[7].finished = true;
  });
  const size = page.viewportSize()!;
  const k = size.width / 768;
  const shots: Record<string, string> = {};
  for (const zoom of [1, 3]) {
    await snap(row.x, row.y, zoom);
    const [w, h] = zoom === 1 ? [300 * k, 100 * k] : [size.width, 210 * k];
    const clip = { x: (size.width - w) / 2, y: size.height / 2 - h * 0.62, width: w, height: h };
    for (const on of [true, false]) {
      if (on) await settle();
      else await render(false);
      const path = `${out}/sprites-${name}${ON_THEME}-${on ? '3d' : 'drawn'}-x${zoom}.png`;
      await page.screenshot({ path, clip });
      console.log(path);
      shots[`${on ? '3d' : 'drawn'}${zoom}`] = path;
      pet();
    }
  }
  return shots;
}

/** One runner running right on open floor, frame by frame at 3×, then its jump: the filmstrip. */
async function filmstrip(): Promise<string> {
  const row = await staged(Array.from({ length: 8 }, () => KIND));
  const dv = row.devs;
  // The runner at the start of the longest flat run of floor with headroom; everyone else out of shot.
  await page.evaluate(`(() => {
    const d = window.slagDebug;
    const L = d.match.run.level;
    const free = (x, y) => L.tiles[y * L.w + x] === 0;
    let best = null;
    for (let ty = 6; ty < L.h - 1; ty++) {
      let n = 0;
      for (let tx = 2; tx < L.w - 2; tx++) {
        const ok = Math.abs(tx - L.goal.tx) > 5 && L.tiles[ty * L.w + tx] === 1 && [1, 2, 3, 4].every((dy) => free(tx, ty - dy));
        n = ok ? n + 1 : 0;
        if (ok && (!best || n > best.n)) best = { n, tx: tx - n + 1, ty };
      }
    }
    const rs = d.match.run.runners;
    rs[0].body.x = best.tx * 16 + 4;
    rs[0].body.y = best.ty * 16 - rs[0].body.h;
    for (const r of rs.slice(1)) r.body.y -= 2000;
    // The film is of the runner, not the level: a set piece's hazard on that floor (an electric fence) killed it
    // in the first frame, so the whole level is the spawn's safe zone for the shot.
    d.match.run.safeZone = { x: 0, y: 0, w: L.w * 16, h: L.h * 16 };
  })()`);
  await press(10, {});
  const go = { [dv[0]]: { right: true, run: true } };
  await press(24, go);
  const size = page.viewportSize()!;
  const k = size.width / 768;
  const cells: string[] = [];
  for (let i = 0; i < 14; i++) {
    await press(
      i < 9 ? 2 : 4,
      i === 9 ? { [dv[0]]: { right: true, run: true, jump: true, jumpPressed: true } } : i > 9 ? { [dv[0]]: { right: true, run: true, jump: true } } : go,
    );
    const at = await page.evaluate(() => {
      const r = (window as any).slagDebug.match.run.runners[0];
      return { x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h - 12 };
    });
    await snap(at.x, at.y, 3);
    await settle();
    const path = `${out}/sprites-film-${i}.png`;
    const w = 46 * 3 * k;
    await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: size.height / 2 - w * 0.62, width: w, height: w * 1.1 } });
    cells.push(path);
    pet();
  }
  const strip = `${out}/sprites-${KIND}-runcycle.png`;
  await composePng(
    strip,
    `<div style="display:flex;flex-wrap:wrap;gap:2px">${cells.map((c) => `<img src="file://${c}" style="width:${Math.floor(1860 / 7) - 2}px">`).join('')}</div>`,
  );
  return strip;
}

async function lobby(): Promise<string> {
  await open(`seed=${seed}`);
  await page.evaluate((kind) => {
    const d = (window as any).slagDebug;
    // Six of the kind: six rolls of its accessories on the lobby cards.
    for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3']) d.match.join(dev);
    for (let i = 0; i < 6; i++) d.sprites.dress(i, kind);
  }, KIND);
  await step(30);
  await settle();
  await step(1);
  const path = `${out}/sprites-${KIND}-lobby.png`;
  await page.screenshot({ path });
  console.log(path);
  pet();
  return path;
}

async function composePng(path: string, html: string, width = 1900) {
  const hp = path.replace(/\.png$/, '.html');
  writeFileSync(
    hp,
    `<html><body style="margin:0;padding:16px;background:#120b08;color:#f6ead8;font:600 16px Barlow,system-ui,sans-serif;width:${width - 32}px">${html}</body></html>`,
  );
  const sp = await browser.newPage({ viewport: { width, height: 600 } });
  await sp.goto(`file://${hp}`);
  await sp.waitForTimeout(400);
  await sp.screenshot({ path, fullPage: true });
  console.log(path);
  pet();
  await sp.close();
}

const img = (f: string | undefined, label: string, w = '100%') =>
  f && existsSync(f)
    ? `<figure style="margin:0 0 10px;width:${w}"><img src="file://${f}" style="width:100%;display:block;border:1px solid #3d2e26"><figcaption style="color:#c9b8a3;font-size:13px;margin-top:3px">${label}</figcaption></figure>`
    : '';
const h = (t: string) => `<h2 style="margin:6px 0 10px;font:400 30px 'Lilita One',system-ui;color:#ffb02e">${t}</h2>`;
const row = (...cells: string[]) => `<div style="display:flex;gap:12px;align-items:flex-start">${cells.join('')}</div>`;

/**
 * Draw cost per runner, 8 runners at play scale (`castBench`): the kind hand-drawn, the kind rendered,
 * and the whole cast as drawn today, on this machine's software canvas.
 */
async function bench(): Promise<string> {
  await open(`seed=${seed}`);
  const got = await page.evaluate(async (kind) => {
    const d = (window as any).slagDebug;
    const drawn = d.cast.bench(300, [kind]);
    const cast = d.cast.bench(300);
    d.sprites.use(true);
    // The kind's frames load on first use.
    await new Promise((done) => setTimeout(done, 800));
    d.cast.bench(20, [kind]);
    const rendered = d.cast.bench(300, [kind]);
    d.sprites.use(false);
    return { drawn, rendered, cast };
  }, KIND);
  const text = `${KIND}: rendered ${got.rendered.toFixed(3)} ms/runner, hand-drawn ${got.drawn.toFixed(3)} ms/runner, the whole cast hand-drawn ${got.cast.toFixed(3)} ms/runner (8 runners at play scale, software canvas)`;
  writeFileSync(`${out}/sprites-${KIND}-bench.txt`, text + '\n');
  console.log(text);
  pet();
  return text;
}

/**
 * The blind read: every kind's play-scale silhouette, shuffled and numbered (`castBlind`), and the same cells
 * in colour three times over, each roll giving every kind another player's colour (`sprites-blind-colour.png`,
 * `-2`, `-3`), so a kind known by one colour is read in colours that aren't its own.
 */
async function blind(): Promise<string> {
  await open(`seed=${seed}`);
  for (const roll of [0, 1, 2]) await castSheet(roll ? `sprites-blind-colour-${roll + 1}` : 'sprites-blind-colour', 'blind', 0.4, true, roll);
  const path = await castSheet('sprites-blind', 'blind');
  const order: string[] = await page.evaluate(() => (window as any).slagDebug.cast.blindOrder());
  writeFileSync(`${out}/sprites-blind-answers.txt`, order.map((k, i) => `${i + 1}. ${k}`).join('\n') + '\n');
  return path;
}

/**
 * The curated variety of each rendered kind (`castVariety`): twelve looks in twelve colours with the idle,
 * cheer and gait each plays, its palette and wear, at 4.4× and at play scale, into `sprites-<kind>-variety.png`.
 * It draws its own light and dark ground, so `--theme` doesn't change it; the eight-runner lineup is where a
 * theme shows.
 */
async function varietySheet(kind: string): Promise<string> {
  await open(`seed=${seed}`);
  return castSheet(`sprites-${kind}-variety`, 'variety', kind);
}

export const shots: Scenarios = {
  /**
   * `pnpm shot variety [--kinds plumber,hedgehog]`: each kind's variety sheet, eight of the kind at play
   * scale (eight looks side by side in the game), the cast lineup, and the draw cost.
   */
  async variety() {
    const kinds = opt('kinds', 'plumber,hedgehog')!.split(',');
    for (const kind of kinds) {
      await varietySheet(kind);
      await lineup(
        `${kind}-eight`,
        Array.from({ length: 8 }, () => kind),
      );
    }
    await lineup('cast', [...kinds, 'elf', 'hunter', 'zapmouse', 'visor', 'goose', 'engineer', 'puffball'].slice(0, 8));
  },
  async sprites() {
    const art = resolve('art/sprites', KIND);
    const same = await lineup(
      KIND,
      Array.from({ length: 8 }, () => KIND),
    );
    const others = ['plumber', 'hedgehog', 'elf', 'hunter', 'zapmouse', 'visor', 'goose', 'engineer', 'puffball'].filter((k) => k !== KIND);
    const mixed = await lineup(`${KIND}-cast`, [KIND, ...others.slice(0, 7)]);
    const film = await filmstrip();
    const lb = await lobby();
    const bl = await blind();
    const cost = await bench();
    const traced = resolve(out, 'art3d/traced-x3.png');
    const r1 = (f: string) => resolve(out, `art3d/r1-${KIND}-${f}.png`);
    await composePng(
      `${out}/sprites-${KIND}.png`,
      h(`Rendered from 3D, round 2: the ${KIND}`) +
        row(
          img(`${art}/concept.png`, 'Concept (generated, the game’s ink style)', '62%'),
          img(`${art}/tpose.png`, 'Model sheet: the figure modelled from', '24%'),
        ) +
        img(`${art}/poses.png`, 'Pose sheet: what the keyed poses follow') +
        row(img(same['3d1'], `Round 2, play scale (${THEME}, 1280×720 window, crop)`, '50%'), img(same.drawn1, 'Round 5 hand-drawn, same frame', '50%')) +
        img(r1('x1'), 'Round 1 (rendered atlas), play scale', '50%') +
        img(same['3d3'], 'Round 2, 3×: idle, facing back, walk, run, rise, fall, idle, cheer') +
        img(same.drawn3, 'Round 5 hand-drawn, 3×, same frame') +
        img(r1('x3'), 'Round 1, 3×') +
        img(traced, 'Traced spike (branch worktree-agent-ae6810c61c411904c), 3×') +
        row(img(mixed['3d1'], 'Among the hand-drawn cast, play scale', '50%'), img(mixed['3d3'], 'Among the cast, 3×', '50%')) +
        img(film, 'Round 2: run cycle into a jump, 3×, every second or fourth sim frame') +
        img(r1('runcycle'), 'Round 1: the same') +
        img(lb, 'Lobby cards: six of the kind, six rolls of its accessories') +
        `<p style="color:#c9b8a3">Draw cost: ${cost}</p>` +
        img(bl, 'The blind read: every kind as a play-scale silhouette, shuffled and unnamed (answers in sprites-blind-answers.txt)') +
        img(resolve(out, `art3d/${KIND}-frames.png`), 'Every frame, both facings, 4×, drawn by the game’s drawer'),
    );
  },
};
