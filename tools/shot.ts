/**
 * Screenshot harness. Builds (if sources changed) and boots a production Next.js server
 * (`SHOT_DEV=1` uses `next dev` instead), drives the game through
 * window.slagDebug in headless Chromium, writes PNGs and exits. A run with no
 * progress for SHOT_TIMEOUT seconds (default 180) fails instead of hanging.
 *
 *   pnpm shot race --seed abc --race saw,laser --frames 200
 *   pnpm shot race --race all
 *   pnpm shot lobby|pick|place --seed abc
 *   pnpm shot levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   pnpm shot props --count 24            → prop gallery (crate cards)
 *   pnpm shot codex                        → /codex page (full-page screenshot)
 *   pnpm shot home                         → main menu (desktop + 390×844 mobile)
 *   pnpm shot settings                     → lobby with the settings overlay open
 *   pnpm shot score --players 4            → round-score screen
 *   pnpm shot mobile [--device "Pixel 7 landscape"]  → phone emulation driven by real
 *                                           multi-touch: lobby/join, pick, place, race, portrait
 *
 * Options: --out shots  --size 1280x720  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 *          --noui (hide the HUD, e.g. to review level shapes)
 *          --mode keyboard|gamepad|touch (footer prompt glyphs)  --net (fake online-lobby info)
 * Software GL is slow; frames are advanced deterministically via slagDebug.step().
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { devices } from 'playwright';
import { touchLayout } from '../src/input/touch';
import { argReader, launchBrowser, startServer, watchdog } from './lib/server';

const argv = process.argv.slice(2);
const scenario = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'race';
const { opt } = argReader(argv);
const out = resolve(opt('out', 'shots')!);
const [W, H] = opt('size', '1280x720')!.split('x').map(Number);
const seed = opt('seed', 'demo');
const theme = opt('theme');
const tq = (theme ? `&theme=${theme}` : '') + (argv.includes('--noui') ? '&ui=0' : '');
const players = Number(opt('players', '2'));
const frames = Number(opt('frames', '150'));
mkdirSync(out, { recursive: true });

const server = await startServer();
const base = server.base;
const pet = watchdog();
// `pnpm exec playwright install chromium` if this can't find a browser.
const browser = await launchBrowser();
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
const step = (n: number) => page.evaluate((k) => (window as any).slagDebug.step(k), n);
async function snap(name: string) {
  const p = `${out}/${name}.png`;
  await page.screenshot({ path: p });
  console.log(p);
  pet();
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

/**
 * Phone emulation (touch + isMobile + DPR) driven through CDP multi-touch, with the
 * real-time loop running so touches go through the actual input path. Not
 * frame-deterministic like the other scenarios; it waits on match phases.
 */
async function mobile(deviceName: string) {
  const dev = devices[deviceName];
  if (!dev) throw new Error(`unknown device ${deviceName}`);
  const { defaultBrowserType: _ignored, ...desc } = dev;
  const ctx = await browser.newContext(desc);
  const mp = await ctx.newPage();
  mp.on('pageerror', (e: Error) => errors.push(String(e)));
  mp.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(mp);
  const tag = deviceName.toLowerCase().replaceAll(/\W+/g, '-');
  const shotM = async (name: string) => {
    const p = `${out}/mobile-${tag}-${name}.png`;
    await mp.screenshot({ path: p });
    console.log(p);
    pet();
  };
  type Pt = { x: number; y: number; id: number };
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touchPoints.map((t) => ({ ...t, radiusX: 8, radiusY: 8, force: 1 })) });
  const tap = async (x: number, y: number) => {
    await touch('touchStart', [{ x, y, id: 1 }]);
    await mp.waitForTimeout(60);
    await touch('touchEnd', []);
    await mp.waitForTimeout(250);
  };
  /** View (768×432) → CSS px via the play view's box. */
  const v2c = (x: number, y: number) =>
    mp.evaluate(
      ([vx, vy]) => {
        const r = document.querySelector('[data-slag-view]')!.getBoundingClientRect();
        return { x: r.left + (vx / 768) * r.width, y: r.top + (vy / 432) * r.height };
      },
      [x, y] as const,
    );
  const phase = (p: string) => mp.waitForFunction((q) => (window as any).slagDebug.match.phase === q, p, { timeout: 60_000 });
  // Same geometry the game uses (emulation reports no safe-area insets).
  const layout = async () => touchLayout(...(await mp.evaluate(() => [innerWidth, innerHeight] as [number, number])));

  await mp.goto(`${base}r/SHOTS?seed=${seed}${tq}`);
  await mp.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await mp.evaluate(() => document.fonts.ready);
  await mp.waitForTimeout(800);
  await shotM('lobby');
  // Join by tapping the first slot (HUD hit-test via touch), then dismiss the name prompt.
  let p = await v2c(111, 221);
  await tap(p.x, p.y);
  await mp.waitForTimeout(400);
  await shotM('name');
  await mp.tap('.slag-ov .slag-btn:not(.primary)');
  await mp.waitForTimeout(300);
  await shotM('lobby-joined');
  // A ready keyboard bot keeps the round alive if the touch runner dies (it never acts).
  await mp.evaluate(() => {
    const m = (window as any).slagDebug.match;
    m.join('kb2');
    m.players.find((q: any) => q.device === 'kb2').ready = true;
  });
  // Ready pill sits right of the character (bw-96 wide at tx = x+88, ty+3).
  p = await v2c(25 + 88 + 38, 146 + 75 + 10);
  await tap(p.x, p.y);
  await phase('pick');
  await mp.waitForTimeout(500);
  await shotM('pick');
  // Prefer a harmless card so the race shot isn't cut short by our own trap.
  const card = await mp.evaluate(() => {
    const crate = (window as any).slagDebug.match.crate;
    return (crate.find((c: any) => c.def.role === 'build' || c.def.role === 'utility') ?? crate[0]).rect;
  });
  p = await v2c(card.x + card.w / 2, card.y + card.h / 2);
  await tap(p.x, p.y);
  await phase('place');
  await mp.waitForTimeout(400);
  // Drag the ghost with a finger held down (ghost floats above it), rotate, then place.
  p = await v2c(400, 260);
  await touch('touchStart', [{ ...p, id: 1 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: p.x + i * 8, y: p.y - i * 4, id: 1 }]);
    await mp.waitForTimeout(40);
  }
  await mp.waitForTimeout(300);
  await shotM('place-drag');
  await touch('touchEnd', []);
  const L = await layout();
  await tap(L.secondary.x, L.secondary.y);
  await mp.waitForTimeout(300);
  await shotM('place-rotated');
  await mp.evaluate(() => {
    const m = (window as any).slagDebug.match;
    m.players.find((q: any) => q.device === 'kb2').placed = true;
  });
  // Try placing; if this spot is illegal, sweep the ghost (away from spawn) until PLACE takes.
  for (let i = 0; i < 24 && (await mp.evaluate(() => (window as any).slagDebug.match.phase)) === 'place'; i++) {
    const q = await v2c(560 - (i % 6) * 60, 90 + Math.floor(i / 6) * 50);
    await tap(q.x, q.y);
    await tap(L.primary.x, L.primary.y);
  }
  await phase('run');
  await mp.waitForFunction(() => (window as any).slagDebug.match.run.frame > 70, null, { timeout: 60_000 });
  const runner = () =>
    mp.evaluate(() => {
      const m = (window as any).slagDebug.match;
      if (!m.run) return null;
      const slot = m.players.find((q: any) => q.device === 'touch').slot;
      const r = m.run.runners.find((q: any) => q.slot === slot);
      return { x: Math.round(r.body.x), y: Math.round(r.body.y), vx: Math.round(r.body.vx), vy: Math.round(r.body.vy), alive: r.alive };
    });
  const before = await runner();
  // Multi-touch: left thumb pushes the stick right (past 70% → run) while the right thumb holds JUMP.
  const st = { x: L.stickHome.x, y: L.stickHome.y };
  await touch('touchStart', [{ ...st, id: 1 }]);
  await touch('touchMove', [{ x: st.x + L.stickR * 0.9, y: st.y, id: 1 }]);
  await mp.waitForTimeout(120);
  await touch('touchStart', [
    { x: st.x + L.stickR * 0.9, y: st.y, id: 1 },
    { x: L.primary.x, y: L.primary.y, id: 2 },
  ]);
  await mp.waitForTimeout(60);
  await shotM('race');
  console.log('touch runner before/after stick+jump', JSON.stringify(before), JSON.stringify(await runner()));
  // Hold ALT: the self-destruct ring fills, then pops the runner.
  await touch('touchEnd', []);
  await touch('touchStart', [{ x: L.secondary.x, y: L.secondary.y, id: 3 }]);
  await mp.waitForTimeout(120);
  await shotM('race-alt');
  await mp.waitForTimeout(600);
  await touch('touchEnd', []);
  console.log('after ALT hold', JSON.stringify(await runner()));
  await mp.setViewportSize({ width: desc.viewport.height, height: desc.viewport.width });
  await mp.waitForTimeout(500);
  await shotM('portrait');
  await ctx.close();
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
    case 'mobile':
      await mobile(opt('device', 'iPhone 13 landscape')!);
      break;
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
