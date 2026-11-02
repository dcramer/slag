/**
 * Screenshot harness. Builds (if sources changed) and boots a production Next.js server
 * (`SHOT_DEV=1` uses `next dev` instead), drives the game through
 * window.slagDebug in headless Chromium, and writes PNGs.
 *
 *   npm run shot -- race --seed abc --race saw,laser --frames 200
 *   npm run shot -- race --race all
 *   npm run shot -- lobby|pick|place --seed abc
 *   npm run shot -- levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   npm run shot -- props --count 24            → prop gallery (crate cards)
 *   npm run shot -- codex                        → /codex page (full-page screenshot)
 *   npm run shot -- home                         → main menu (desktop + 390×844 mobile)
 *   npm run shot -- settings                     → lobby with the settings overlay open
 *   npm run shot -- score --players 4            → round-score screen
 *
 * Options: --out shots  --size 1280x720  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 *          --noui (hide the HUD, e.g. to review level shapes)
 *          --mode keyboard|gamepad|touch (footer prompt glyphs)  --net (fake online-lobby info)
 * Software GL is slow; frames are advanced deterministically via slagDebug.step().
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

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
const tq = (theme ? `&theme=${theme}` : '') + (argv.includes('--noui') ? '&ui=0' : '');
const players = Number(opt('players', '2'));
const frames = Number(opt('frames', '150'));
mkdirSync(out, { recursive: true });

/** True if any source file is newer than the last production build. */
function needsBuild(): boolean {
  const id = '.next/BUILD_ID';
  if (!existsSync(id)) return true;
  const built = statSync(id).mtimeMs;
  const newer = (dir: string): boolean =>
    readdirSync(dir, { withFileTypes: true }).some((e) => {
      const p = `${dir}/${e.name}`;
      return e.isDirectory() ? newer(p) : statSync(p).mtimeMs > built;
    });
  return ['src', 'app', 'public'].some((d) => existsSync(d) && newer(d)) || ['next.config.ts', 'package.json'].some((f) => statSync(f).mtimeMs > built);
}

async function freePort(): Promise<number> {
  return new Promise((res) => {
    const srv = netServer();
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address();
      srv.close(() => res(typeof a === 'object' && a ? a.port : 3100));
    });
  });
}
const port = Number(process.env.SHOT_PORT ?? (await freePort()));
const base = `http://127.0.0.1:${port}/`;
// Production server by default: `next dev` compiles on demand and is far too slow for software-GL screenshots.
const useDev = process.env.SHOT_DEV === '1';
if (!useDev && needsBuild()) {
  console.log('building (sources changed since last build)…');
  const r = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  if (r.status !== 0) throw new Error('next build failed');
}
const next = spawn('npx', ['next', useDev ? 'dev' : 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});
let nextLog = '';
next.stdout.on('data', (d) => (nextLog += d));
next.stderr.on('data', (d) => (nextLog += d));
// Wait for the server, then warm the routes (first compile is slow).
for (let i = 0; ; i++) {
  try {
    const r = await fetch(`${base}r/WARMUP`);
    if (r.ok) break;
  } catch {
    // not up yet
  }
  if (i > 240) throw new Error(`next dev did not start:\n${nextLog}`);
  await new Promise((r) => setTimeout(r, 500));
}
const server = { close: async () => void next.kill('SIGTERM') };
// Prefer a preinstalled Chromium (cloud containers ship one); otherwise use Playwright's (`npx playwright install chromium`).
const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(String(e)));
page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));

const mode = opt('mode');
const fakeNet = argv.includes('--net');
async function open(q: string) {
  await page.goto(`${base}r/SHOTS?${q}${tq}`);
  await page.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (window as any).slagDebug.pause(true));
  await page.evaluate(
    ([m, net]) => {
      const hud = (window as any).slagDebug.renderer.hud;
      if (m) hud.inputMode = m;
      if (m === 'gamepad') hud.padCount = 1;
      if (net)
        hud.net = {
          status: 'Hosting · 3 Connected',
          inviteUrl: `${location.origin}/r/SHOTS`,
          peers: [
            { name: 'Spegil', isHost: true, local: true },
            { name: 'Klyzheeg', isHost: false, pingMs: 42, local: false },
            { name: 'Grafaunk', isHost: false, pingMs: 135, local: false },
          ],
        };
    },
    [mode ?? '', fakeNet] as const,
  );
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
    case 'home': {
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      await snap('home');
      const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const mp = await mctx.newPage();
      mp.on('pageerror', (e: Error) => errors.push(String(e)));
      await mp.goto(base);
      await mp.evaluate(() => document.fonts.ready);
      await mp.waitForTimeout(1200);
      await mp.screenshot({ path: `${out}/home-mobile.png` });
      console.log(`${out}/home-mobile.png`);
      // Join flow: open the code field and show a validation error.
      await page.click('text=JOIN A LOBBY');
      await page.waitForSelector('.join input:focus');
      await page.keyboard.type('a!');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      await snap('home-join');
      await page.click('text=SETTINGS');
      await page.waitForSelector('.slag-card', { timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await snap('home-settings');
      await mctx.close();
      break;
    }
    case 'settings':
      await open(`seed=${seed}`);
      await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
      await step(5);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await snap(`settings-${seed}`);
      break;
    case 'score':
      await open(`seed=${seed}&players=${players}&race=saw`);
      await page.evaluate(() => {
        const m = (window as any).slagDebug.match;
        m.players.forEach((p: any, i: number) => (p.score = 6 + i * 7));
        m.finishRound();
      });
      await step(100);
      await snap(`score-${seed}`);
      break;
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
