/**
 * What every scenario shares: the parsed options, the production server, the browser and its page
 * (booted at import), and the helpers that open a match, step it and save shots.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProfileOverride } from '../../src/gen/level';
import type { Difficulty, SizeClass } from '../../src/sim/level';
import type { WeatherKind } from '../../src/sim/weather';
import { argReader, type Engine, engineList, launchEngine, startServer, watchdog } from '../lib/server';

export const argv = process.argv.slice(2);
export const scenario = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'race';
export const { opt, flag } = argReader(argv);
export const out = resolve(opt('out', 'shots')!);
export const [W, H] = opt('size', '1280x720')!.split('x').map(Number);
export const seed = opt('seed', 'demo');
export const theme = opt('theme');
const world = opt('world');
const weather = opt('weather');
const concept = opt('concept');
const difficulty = opt('difficulty');
/** `--game brawl`: the match's playstyle mode (`--mode` is the input prompts'). */
export const game = opt('game');
/** The profile knobs the URL forces (src/debug.ts), as `pnpm level` takes them: what `levels` checks its levels against. */
export const levelForce: ProfileOverride = {
  ...(world ? { size: world as SizeClass } : {}),
  ...(weather ? { weather: weather as WeatherKind } : {}),
  ...(concept ? { concept } : {}),
  ...(difficulty ? { difficulty: difficulty as Difficulty } : {}),
};
export const tq =
  (game ? `&mode=${game}` : '') +
  (theme ? `&theme=${theme}` : '') +
  (world ? `&size=${world}` : '') +
  (weather ? `&weather=${weather}` : '') +
  (concept ? `&concept=${concept}` : '') +
  (difficulty ? `&difficulty=${difficulty}` : '') +
  (flag('noui') ? '&ui=0' : '') +
  (opt('q') ? `&q=${opt('q')}` : '') +
  (flag('noletters') ? '&lettering=0' : '');
export const players = Number(opt('players', '2'));
export const frames = Number(opt('frames', '150'));
mkdirSync(out, { recursive: true });

export const server = await startServer();
export const base = server.base;
export const pet = watchdog();
/** `--engine webkit` (or firefox): the same scenarios in another engine. WebKit with an iPhone profile stands in for iOS Safari. */
export const engine: Engine = engineList(opt('engine', 'chromium'))[0];
// `pnpm exec playwright install chromium` (or the engine named) if this can't find a browser.
export const browser = await launchEngine(engine);
export const page = await browser.newPage({ viewport: { width: W, height: H } });
// `--nocel`: no WebGL2, so the game composites through its Canvas2D fallback, without the cel pass's light
// bands, edge ink and hard shadows (post.ts): to judge art with and without it.
if (flag('nocel'))
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? null : (get as any).call(this, id, ...rest);
    };
  });
export const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(String(e)));
page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));

export const mode = opt('mode');
const fakeNet = flag('net');
export async function open(q: string) {
  // net=off: screenshots are single-player and must never join a real online room.
  await page.goto(`${base}r/SHOTS?${q}${tq}&net=off`);
  await page.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  // The rendered kinds' frames load on first use and draw hand-drawn until then: every shot shows what ships.
  await page.evaluate(() => (window as any).slagDebug.sprites.ready());
  await page.evaluate(() => (window as any).slagDebug.pause(true));
  await page.evaluate(
    ([m, net]) => {
      const hud = (window as any).slagDebug.renderer.hud;
      if (m) hud.inputMode = m;
      if (m === 'gamepad') hud.padCount = 1;
      if (net) {
        // Peers named after the lobby's players as they join (read live), so the cards show the host tag and pings.
        // (No named helpers in here: the bundler wraps them in a __name the page doesn't have.)
        const match = (window as any).slagDebug.match;
        // Only the first keyboard plays on this screen; the rest are the peers. (An arrow in an array: see above.)
        hud.devices = { ...hud.devices, isLocal: [(d: string) => d === 'kb1'][0] };
        const pings = [undefined, 42, 135, 230];
        hud.net = {
          status: 'Hosting · 3 Connected',
          inviteUrl: `${location.origin}/r/SHOTS`,
          get hostSlot() {
            return match.players.length ? 0 : undefined;
          },
          get peers() {
            return match.players.slice(0, 4).map((p: any, i: number) => ({ name: p.character.name, isHost: i === 0, local: i === 0, pingMs: pings[i] }));
          },
        };
      }
    },
    [mode ?? '', fakeNet] as const,
  );
}
/**
 * Shoots one of the cast's debug sheets (`slagDebug.cast[name](...args)`) whole, at `out/<file>.png`. A sheet
 * is a fixed canvas often bigger than the window, so the window grows to it for the shot.
 */
export async function castSheet(file: string, name: string, ...args: unknown[]): Promise<string> {
  const box = await page.evaluate(
    ([n, a]) => {
      const cv = (window as any).slagDebug.cast[n as string](...(a as unknown[]));
      return { width: cv.width as number, height: cv.height as number };
    },
    [name, args] as const,
  );
  const was = page.viewportSize()!;
  await page.setViewportSize({ width: Math.max(was.width, box.width), height: Math.max(was.height, box.height) });
  const path = `${out}/${file}.png`;
  await page.screenshot({ path, clip: { x: 0, y: 0, ...box } });
  await page.setViewportSize(was);
  console.log(path);
  pet();
  return path;
}
export const LAUNCHER_STYLES = 'crossbow,ballista,cannon,totem,turret,thrower,rocket,glaive,gumball,mortar,gooper,cryo,prism';
export const step = (n: number) => page.evaluate((k) => (window as any).slagDebug.step(k), n);
export const secret = flag('secret');
/** `--secret`: turn the Secret Parts rule on and deal round 1 again, so the crate holds role cards. */
export async function secretRule() {
  if (!secret) return;
  await page.evaluate(() => {
    const m = (window as any).slagDebug.match;
    m.rules = { ...m.rules, secretParts: true };
    m.startMatch();
  });
}
/** `--parts block,saw`: parts already placed, as if from earlier rounds (pick and place). */
export async function addParts() {
  const kinds = opt('parts')?.split(',').filter(Boolean);
  if (kinds?.length) await page.evaluate(([k, s]) => (window as any).slagDebug.addProps(k, s), [kinds, Number(opt('propseed', '1'))] as const);
}
/** Shoot the window, or only `clip` of it (CSS px), at `out/<name>.png`. */
export async function snap(name: string, clip?: { x: number; y: number; width: number; height: number }) {
  const p = `${out}/${name}.png`;
  await page.screenshot({ path: p, clip });
  console.log(p);
  pet();
  return p;
}
/** A contact sheet of `files`, each fitted whole into a window-shaped cell (a tall level's shot stays as small as a wide one's). */
export async function sheet(name: string, files: string[], cols = 3) {
  const html = `<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px">${files
    .map(
      (f) =>
        `<div style="position:relative;aspect-ratio:${W}/${H}"><img src="file://${f}" style="width:100%;height:100%;object-fit:contain;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:12px monospace;text-shadow:0 0 3px #000">${f.split('/').pop()}</span></div>`,
    )
    .join('')}</body></html>`;
  const hp = `${out}/${name}.html`;
  writeFileSync(hp, html);
  const sp = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  await sp.goto(`file://${hp}`);
  await sp.waitForTimeout(300);
  await sp.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${out}/${name}.png`);
  await sp.close();
}

/** A scenario by name: `pnpm shot <name>`. */
export type Scenarios = Record<string, () => Promise<void>>;
