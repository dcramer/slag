/**
 * Screenshot harness. Boots a Vite dev server, drives the game through
 * window.slagDebug in headless Chromium, and writes PNGs.
 *
 *   npm run shot -- race --seed abc --race saw,laser --frames 200
 *   npm run shot -- race --race all
 *   npm run shot -- lobby|pick|place --seed abc
 *   npm run shot -- levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   npm run shot -- props --count 24            → prop gallery (crate cards)
 *   npm run shot -- codex                        → /codex page (full-page screenshot)
 *
 * Options: --out shots  --size 1280x720  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 * Software GL is slow; frames are advanced deterministically via slagDebug.step().
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const scenario = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'race';
const opt = (k: string, d?: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const out = resolve(opt('out', 'shots')!);
const [W, H] = opt('size', '1280x720')!.split('x').map(Number);
const seed = opt('seed', 'demo');
const theme = opt('theme');
const tq = theme ? `&theme=${theme}` : '';
const players = Number(opt('players', '2'));
const frames = Number(opt('frames', '150'));
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const addr = server.httpServer!.address();
const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5173}/`;
// Prefer a preinstalled Chromium (cloud containers ship one); otherwise use Playwright's (`npx playwright install chromium`).
const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(String(e)));
page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));

async function open(q: string) {
  await page.goto(`${base}?${q}${tq}`);
  await page.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (window as any).slagDebug.pause(true));
}
const step = (n: number) => page.evaluate((k) => (window as any).slagDebug.step(k), n as number);
async function snap(name: string) {
  const p = `${out}/${name}.png`;
  await page.screenshot({ path: p });
  console.log(p);
  return p;
}
async function sheet(name: string, files: string[], cols = 3) {
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

try {
  switch (scenario) {
    case 'lobby':
      await open(`seed=${seed}`);
      await page.evaluate((n) => {
        const d = (window as any).slagDebug;
        for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'].slice(0, n)) d.match.join(dev);
      }, players);
      await step(30);
      await snap(`lobby-${seed}`);
      break;
    case 'pick':
      await open(`seed=${seed}&players=${players}`);
      await step(40);
      await snap(`pick-${seed}`);
      break;
    case 'place':
      await open(`seed=${seed}&players=${players}`);
      await page.evaluate(() => {
        const m = (window as any).slagDebug.match;
        m.players.forEach((p: any, i: number) => {
          p.claim = i;
          m.crate[i].claimedBy = p.slot;
          p.cursor = { x: 300 + i * 150, y: 180 };
        });
      });
      await step(60);
      await snap(`place-${seed}`);
      break;
    case 'race': {
      const race = opt('race', '')!;
      await open(`seed=${seed}&players=${players}&race=${race}&propseed=${opt('propseed', '1')}`);
      for (const f of [frames, 40, 40]) {
        await step(f);
        await snap(`race-${seed}-${await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0)}`);
      }
      break;
    }
    case 'levels': {
      const themes = opt('themes') === 'all' ? ['farm', 'factory', 'castle', 'jungle', 'volcano', 'harbor', 'mine', 'rooftops'] : opt('themes')?.split(',');
      const seeds = opt('seeds')?.split(',') ?? Array.from({ length: themes ? themes.length : Number(opt('count', '9')) }, (_, i) => `lv${i}`);
      const files: string[] = [];
      await open(`seed=${seeds[0]}`);
      for (let i = 0; i < seeds.length; i++) {
        const th = themes?.[i % themes.length] ?? theme;
        await page.evaluate(([x, t]) => (window as any).slagDebug.loadLevel(x, t || undefined), [seeds[i], th ?? ''] as const);
        await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
        await step(90);
        files.push(await snap(`level-${th ? `${th}-` : ''}${seeds[i]}`));
      }
      await sheet('levels', files);
      break;
    }
    case 'props': {
      const count = Number(opt('count', '18'));
      const files: string[] = [];
      for (let r = 0; r < Math.ceil(count / 6); r++) {
        await open(`seed=${seed}${r}&players=4`);
        await step(40);
        files.push(await snap(`props-${seed}${r}`));
      }
      await sheet('props', files, 2);
      break;
    }
    case 'codex': {
      await page.goto(`${base}codex`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      // Scroll through so lazily-animated cards paint, then capture the whole page.
      const h = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < h; y += 600) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const p = `${out}/codex.png`;
      await page.screenshot({ path: p, fullPage: true });
      console.log(p);
      break;
    }
    default:
      throw new Error(`unknown scenario ${scenario}`);
  }
  if (errors.length) {
    console.error('page errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
