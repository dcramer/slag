/**
 * What every scenario shares: the parsed options, the production server, the browser and its page
 * (booted at import), and the helpers that open a match, step it and save shots.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argReader, launchBrowser, startServer, watchdog } from '../lib/server';

export const argv = process.argv.slice(2);
export const scenario = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'race';
export const { opt } = argReader(argv);
export const out = resolve(opt('out', 'shots')!);
export const [W, H] = opt('size', '1280x720')!.split('x').map(Number);
export const seed = opt('seed', 'demo');
export const theme = opt('theme');
const world = opt('world');
const weather = opt('weather');
export const tq =
  (theme ? `&theme=${theme}` : '') +
  (world ? `&size=${world}` : '') +
  (weather ? `&weather=${weather}` : '') +
  (argv.includes('--noui') ? '&ui=0' : '') +
  (opt('q') ? `&q=${opt('q')}` : '') +
  (argv.includes('--noletters') ? '&lettering=0' : '');
export const players = Number(opt('players', '2'));
export const frames = Number(opt('frames', '150'));
mkdirSync(out, { recursive: true });

export const server = await startServer();
export const base = server.base;
export const pet = watchdog();
// `pnpm exec playwright install chromium` if this can't find a browser.
export const browser = await launchBrowser();
export const page = await browser.newPage({ viewport: { width: W, height: H } });
export const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(String(e)));
page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));

export const mode = opt('mode');
const fakeNet = argv.includes('--net');
export async function open(q: string) {
  // net=off: screenshots are single-player and must never join a real online room.
  await page.goto(`${base}r/SHOTS?${q}${tq}&net=off`);
  await page.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
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
export const LAUNCHER_STYLES = 'crossbow,ballista,cannon,totem,turret,thrower,rocket,glaive,gumball,mortar,gooper,cryo,prism';
export const step = (n: number) => page.evaluate((k) => (window as any).slagDebug.step(k), n);
export const secret = argv.includes('--secret');
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
export async function snap(name: string) {
  const p = `${out}/${name}.png`;
  await page.screenshot({ path: p });
  console.log(p);
  pet();
  return p;
}
export async function sheet(name: string, files: string[], cols = 3) {
  const html = `<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px">${files
    .map(
      (f) =>
        `<div style="position:relative"><img src="file://${f}" style="width:100%;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:12px monospace;text-shadow:0 0 3px #000">${f.split('/').pop()}</span></div>`,
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
