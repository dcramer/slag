/**
 * Screenshot harness. Builds (if sources changed) and boots a production Next.js server
 * (`SHOT_DEV=1` uses `next dev` instead), drives the game through
 * window.slagDebug in headless Chromium, writes PNGs and exits. A run with no
 * progress for SHOT_TIMEOUT seconds (default 180) fails instead of hanging.
 *
 *   pnpm shot race --seed abc --race saw,laser --frames 200
 *   pnpm shot race --race all
 *   pnpm shot lobby|pick|place --seed abc
 *   pnpm shot pick --claim 2,5             → with those cards already taken
 *   pnpm shot pick|place --secret          → Secret Parts rule on: role cards, and the parts they rolled
 *   pnpm shot place --card spikestrip --cursor 296,184 --then-race 90 → aim the first ghost, place it, shoot the race
 *   pnpm shot levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   pnpm shot props --count 24            → prop gallery (crate cards)
 *   pnpm shot items --seed abc             → held items: in hand, loose, and each one used
 *   pnpm shot blood --theme farm --players 4 --noletters → staged deaths over four rounds: ooze, settled, place phase, expiry
 *   pnpm shot stack --seed abc             → stepped frames of runners stacking, walking as a stack, and a head-bounce
 *   pnpm shot codex                        → /codex page (full-page screenshot)
 *   pnpm shot home                         → main menu (desktop + 390×844 mobile)
 *   pnpm shot settings                     → every settings tab over the lobby, driven by keys and a fake pad,
 *                                           then over the main menu on a phone (portrait and landscape), by tap
 *   pnpm shot score --players 4            → round-score screen
 *   pnpm shot mobile [--device "Pixel 7 landscape"]  → phone emulation driven by real
 *                                           multi-touch: lobby/join, pick, place, race, portrait
 *
 * Options: --out shots  --size 1280x720 (window)  --world classic|wide|tall (level size)  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 *          --weather rain (force the weather: clear|wind|mist|rain|snow)
 *          --noui (hide the HUD, e.g. to review level shapes)
 *          --q high (pin the quality tier: slow software GL otherwise reads as a slow device and drops it)
 *          --runframe N (race: stop on exact sim frame N)  --campin x,y,zoom (race: pin the view, for before/after sheets)
 *          --spread (race: stand the runners on open ground)  --weather rain (force clear|wind|mist|rain|snow)
 *          --mode keyboard|gamepad|touch (footer prompt glyphs)  --net (fake online-lobby info)
 *          --noletters (no impact words)
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
const world = opt('world');
const weather = opt('weather');
const tq =
  (theme ? `&theme=${theme}` : '') +
  (world ? `&size=${world}` : '') +
  (weather ? `&weather=${weather}` : '') +
  (argv.includes('--noui') ? '&ui=0' : '') +
  (opt('q') ? `&q=${opt('q')}` : '') +
  (opt('weather') ? `&weather=${opt('weather')}` : '') +
  (argv.includes('--noletters') ? '&lettering=0' : '');
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
const secret = argv.includes('--secret');
/** `--secret`: turn the Secret Parts rule on and deal round 1 again, so the crate holds role cards. */
async function secretRule() {
  if (!secret) return;
  await page.evaluate(() => {
    const m = (window as any).slagDebug.match;
    m.rules = { ...m.rules, secretParts: true };
    m.startMatch();
  });
}
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
  /** The HUD's tap targets this frame, in CSS px: its own hit rects, so nothing here hard-codes a layout. */
  const hudButtons = () =>
    mp.evaluate(() => {
      const r = document.querySelector('[data-slag-view]')!.getBoundingClientRect();
      const k = r.width / 768;
      return (window as any).slagDebug.renderer.hud.buttons.map((b: any) => ({
        action: b.action as string,
        x: r.left + b.x * k,
        y: r.top + b.y * k,
        w: b.w * k,
        h: b.h * k,
      }));
    }) as Promise<{ action: string; x: number; y: number; w: number; h: number }[]>;
  const tapHud = async (action: string) => {
    const b = (await hudButtons()).find((q) => q.action === action);
    if (!b) throw new Error(`no ${action} button on screen`);
    await tap(b.x + b.w / 2, b.y + b.h / 2);
  };
  /** Every tap target on screen is at least 44 CSS px, or the run fails. */
  const checkTargets = async (where: string) => {
    const all = await hudButtons();
    const small = all.filter((b) => b.w < 43.9 || b.h < 43.9);
    console.log(`${where}: ${all.length} tap targets, smallest ${Math.min(...all.map((b) => Math.min(b.w, b.h))).toFixed(1)} CSS px`);
    if (small.length) throw new Error(`${where}: tap targets under 44 CSS px: ${JSON.stringify(small)}`);
  };
  const phase = (q: string) => mp.waitForFunction((want) => (window as any).slagDebug.match.phase === want, q, { timeout: 60_000 });
  const pose = () =>
    mp.evaluate(() => {
      const c = (window as any).slagDebug.renderer.cam;
      const w = document.querySelector('[data-slag-view]')!.getBoundingClientRect().width;
      return { x: Math.round(c.x), y: Math.round(c.y), zoom: +c.zoom.toFixed(2), tileCss: +((16 * c.zoom * w) / 768).toFixed(1) };
    });
  // Same geometry the game uses (emulation reports no safe-area insets).
  const layout = async () => touchLayout(...(await mp.evaluate(() => [innerWidth, innerHeight] as [number, number])));

  await mp.goto(`${base}r/SHOTS?seed=${seed}${tq}&net=off`);
  await mp.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await mp.evaluate(() => document.fonts.ready);
  await mp.waitForTimeout(800);
  await shotM('lobby');
  await checkTargets('lobby');
  // Settings: one sheet per tab, then back out.
  await tapHud('settings');
  await mp.waitForTimeout(300);
  await shotM('settings');
  await mp.tap('.slag-tab:nth-child(2)');
  await mp.waitForTimeout(200);
  await shotM('settings-video');
  const smallest = await mp.evaluate(() =>
    Math.min(
      ...[...document.querySelectorAll('.slag-sheet button')].map((b) => b.getBoundingClientRect()).map((r) => Math.min(r.width, Math.max(r.height, 0))),
    ),
  );
  console.log(`settings: smallest button ${smallest.toFixed(1)} CSS px`);
  await mp.tap('.slag-ov .slag-actions .primary');
  await mp.waitForTimeout(200);
  // Join by tapping the first open slot, then dismiss the name prompt.
  await tapHud('join');
  await mp.waitForTimeout(400);
  await shotM('name');
  await mp.tap('.slag-ov .slag-btn:not(.primary)');
  await mp.waitForTimeout(300);
  await shotM('lobby-joined');
  await checkTargets('lobby-joined');
  // Solo on purpose: the close follow only exists with one player in the match.
  await tapHud('ready');
  await phase('pick');
  await mp.waitForTimeout(500);
  await shotM('pick');
  // Prefer a harmless card so the race shot isn't cut short by our own trap. Cards draw zoomed on phones, so tap where they're seen.
  const card = await mp.evaluate(() => {
    const d = (window as any).slagDebug;
    const crate = d.match.crate;
    const r = (crate.find((c: any) => c.def.role === 'build' || c.def.role === 'utility') ?? crate[0]).rect;
    const { s, ox, oy } = d.renderer.hud.cards;
    return { x: ox + (r.x + r.w / 2) * s, y: oy + (r.y + r.h / 2) * s, w: r.w * s, h: r.h * s };
  });
  let p = await v2c(card.x, card.y);
  const css = await mp.evaluate(() => document.querySelector('[data-slag-view]')!.getBoundingClientRect().width / 768);
  console.log(`pick: card ${(card.w * css).toFixed(0)}×${(card.h * css).toFixed(0)} CSS px`);
  await tap(p.x, p.y);
  await phase('place');
  await mp.waitForTimeout(400);
  await shotM('place');
  console.log('place starts', JSON.stringify(await pose()));
  // Pinch out around the middle of the level: the camera zooms about the fingers.
  const c0 = await v2c(384, 200);
  await touch('touchStart', [{ x: c0.x - 30, y: c0.y, id: 1 }]);
  await touch('touchStart', [
    { x: c0.x - 30, y: c0.y, id: 1 },
    { x: c0.x + 30, y: c0.y, id: 2 },
  ]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [
      { x: c0.x - 30 - i * 12, y: c0.y, id: 1 },
      { x: c0.x + 30 + i * 12, y: c0.y, id: 2 },
    ]);
    await mp.waitForTimeout(30);
  }
  await touch('touchEnd', []);
  await mp.waitForTimeout(300);
  const pinched = await pose();
  console.log('after pinch', JSON.stringify(pinched));
  await shotM('place-pinch');
  // Drag the ghost with a finger held down (ghost floats above it), then hold it at the window's edge: the camera pans.
  p = await v2c(380, 260);
  const edge = await mp.evaluate(() => innerWidth - 8);
  await touch('touchStart', [{ ...p, id: 1 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: p.x + ((edge - p.x) * i) / 6, y: p.y, id: 1 }]);
    await mp.waitForTimeout(40);
  }
  await mp.waitForTimeout(500);
  console.log('after edge drag', JSON.stringify(await pose()));
  await shotM('place-drag');
  await touch('touchEnd', []);
  const L = await layout();
  await tap(L.secondary.x, L.secondary.y);
  await mp.waitForTimeout(300);
  await shotM('place-rotated');
  // Try placing; if this spot is illegal, sweep the ghost until PLACE takes.
  for (let i = 0; i < 36 && (await mp.evaluate(() => (window as any).slagDebug.match.phase)) === 'place'; i++) {
    const q = await v2c(520 - (i % 6) * 70, 90 + Math.floor(i / 6) * 40);
    await tap(q.x, q.y);
    await tap(L.primary.x, L.primary.y);
  }
  await phase('run');
  await mp.waitForTimeout(600);
  await shotM('race-countdown');
  await mp.waitForFunction(() => (window as any).slagDebug.match.run.frame > 200, null, { timeout: 60_000 });
  await mp.waitForTimeout(700);
  await shotM('race-follow');
  console.log('race follow', JSON.stringify(await pose()));
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
  await phase('score');
  await mp.waitForTimeout(1800);
  await shotM('score');
  await mp.setViewportSize({ width: desc.viewport.height, height: desc.viewport.width });
  await mp.waitForTimeout(500);
  await shotM('portrait');
  await mp.setViewportSize(desc.viewport);

  // The owner's rule: two players, one at each end of the level, are both on screen, whatever it costs in tile size.
  await mp.goto(`${base}r/SHOTM?seed=${seed}${tq}&net=off&players=2&race=saw`);
  await mp.waitForFunction(() => 'slagDebug' in window && (window as any).slagDebug.match.run?.frame > 200, null, { timeout: 60_000 });
  await mp.evaluate(() => {
    const m = (window as any).slagDebug.match;
    const [a, b] = m.run.runners;
    a.body.x = 40;
    b.body.x = m.level.w * 16 - 60;
  });
  await mp.waitForTimeout(150);
  const both = await mp.evaluate(() => {
    const d = (window as any).slagDebug;
    const v = d.renderer.cam.visible();
    return d.match.run.runners
      .filter((r: any) => r.alive)
      .map((r: any) => r.body.x >= v.x && r.body.x <= v.x + v.w && r.body.y >= v.y && r.body.y <= v.y + v.h);
  });
  await shotM('race-two-players');
  console.log('two players on screen', JSON.stringify(both), JSON.stringify(await pose()));
  if (both.includes(false)) throw new Error('a live runner left the screen');
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
      await secretRule();
      await step(40);
      if (opt('claim')) {
        // `--claim 2,5`: those cards are taken, as if players had picked them.
        await page.evaluate((cards) => {
          const m = (window as any).slagDebug.match;
          for (const i of cards) m.crate[i].claimedBy = m.players[0].slot;
        }, opt('claim')!.split(',').map(Number));
        await step(1);
      }
      await snap(`pick-${seed}${secret ? '-secret' : ''}`);
      break;
    case 'place':
      await open(`seed=${seed}&players=${players}`);
      await secretRule();
      // `--secret`: everyone clicks a role card, so each part is rolled the way a claim rolls it.
      if (secret) {
        await step(12);
        await page.evaluate(() => {
          const d = (window as any).slagDebug;
          const m = d.match;
          const inputs: Record<string, unknown> = {};
          m.players.forEach((p: any, i: number) => {
            const r = m.crate[i].rect;
            p.cursor = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
            inputs[p.device] = { confirmPressed: true };
          });
          d.step(1, inputs);
          m.players.forEach((p: any, i: number) => (p.cursor = { x: 300 + i * 150, y: 180 }));
        });
      } else
        await page.evaluate(
          (card) => {
            const m = (window as any).slagDebug.match;
            const first = Math.max(
              0,
              m.crate.findIndex((c: any) => c.def.archetype === card),
            );
            m.players.forEach((p: any, i: number) => {
              const at = (first + i) % m.crate.length;
              p.claim = at;
              m.crate[at].claimedBy = p.slot;
              p.cursor = { x: 300 + i * 150, y: 180 };
            });
          },
          opt('card', ''),
        );
      // `--cursor x,y` aims the first player's ghost (view px); `--then-race N` places it and shoots the race N frames in.
      await page.evaluate(
        (at) => {
          if (at) (window as any).slagDebug.match.players[0].cursor = { x: at[0], y: at[1] };
        },
        opt('cursor')?.split(',').map(Number) ?? null,
      );
      await step(60);
      await snap(`place-${seed}${secret ? '-secret' : ''}`);
      if (opt('then-race')) {
        await page.evaluate(() => {
          const d = (window as any).slagDebug;
          for (const p of d.match.players.slice(1)) p.placed = true;
          d.step(1, { [d.match.players[0].device]: { confirmPressed: true } });
        });
        await page.waitForFunction(() => (window as any).slagDebug.match.players[0].placed, null, { timeout: 5000 });
        await step(45 + Number(opt('then-race')));
        await snap(`place-${seed}-race`);
      }
      break;
    case 'race': {
      const race = opt('race', '')!;
      await open(`seed=${seed}&players=${players}&race=${race}&propseed=${opt('propseed', '1')}`);
      const exact = opt('runframe');
      if (exact) {
        // Boot time decides how far the race got before the pause, so step to the frame rather than by a count.
        const now = await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0);
        await step(Number(exact) - now - 4);
        if (argv.includes('--spread')) {
          await page.evaluate(() => {
            const d = (window as any).slagDebug;
            const lv = d.match.level;
            d.match.run.runners.forEach((r: any, i: number) => {
              for (let tx = lv.spawn.tx + 3 + i * 2; tx < lv.w; tx++) {
                for (let ty = 1; ty < lv.h; ty++) {
                  if (lv.tiles[ty * lv.w + tx] === 1 && lv.tiles[(ty - 1) * lv.w + tx] === 0 && ty > lv.spawn.ty - 6) {
                    r.body.x = tx * 16 + 4;
                    r.body.y = ty * 16 - r.body.h;
                    r.body.vx = r.body.vy = 0;
                    return;
                  }
                }
              }
            });
          });
        }
        // The sim frame alone isn't the same picture: camera smoothing depends on frames rendered before the pause.
        await page.evaluate(
          (v) => {
            if (!v) return;
            const cam = (window as any).slagDebug.renderer.cam;
            cam.update = () => {};
            cam.snap({ cx: v[0], cy: v[1], zoom: v[2] });
            cam.shake = 0;
          },
          opt('campin')?.split(',').map(Number) ?? null,
        );
        await step(4);
        await snap(`race-${seed}-${exact}`);
        break;
      }
      for (const f of [frames, 40, 40]) {
        await step(f);
        await snap(`race-${seed}-${await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0)}`);
      }
      break;
    }
    case 'inkdraw': {
      // The cel pass on its own: re-issues just its fullscreen draw and flushes, so the time is that shader's and nothing else's.
      await open(`seed=${seed}&players=${players}&race=${opt('race', 'all')}&propseed=1`);
      await step(60);
      await page.evaluate('globalThis.__name = (f) => f');
      const report = await page.evaluate(async () => {
        const d = (window as any).slagDebug;
        const px = new Uint8Array(4);
        const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean) as WebGL2RenderingContext;
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        const once = () => {
          d.render?.();
          const t0 = performance.now();
          for (let i = 0; i < 10; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          return (performance.now() - t0) / 10;
        };
        const samples: number[] = [];
        for (let i = 0; i < 24; i++) {
          samples.push(once());
          await new Promise((r) => setTimeout(r, 0));
        }
        samples.sort((a, b) => a - b);
        return {
          gpu: gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
          size: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
          drawMs: +samples[samples.length >> 1].toFixed(3),
          minMs: +samples[0].toFixed(3),
        };
      });
      console.log(JSON.stringify(report));
      break;
    }
    case 'inkblast': {
      // Bites craters out of a level, times the redraw, and checks each partial bake against a full one.
      await open(`seed=${seed}&players=${players}&race=&propseed=1`);
      await step(30);
      // tsx names functions through a helper that the page doesn't have.
      await page.evaluate('globalThis.__name = (f) => f');
      const report = await page.evaluate(async (timing) => {
        const d = (window as any).slagDebug;
        const lv = d.match.level;
        const tp = d.renderer.terrain;
        const px = new Uint8Array(4);
        const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean) as WebGL2RenderingContext;
        const flush = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const render = () => {
          d.render?.();
          flush();
          // Canvas 2D work is deferred: the composite above makes the clock pay for it. Comparing bakes needs a
          // readback, which flips a GPU canvas to software, so `--timing` skips it and PW_GPU runs stay honest.
          if (!timing) tp.bake.getContext('2d').getImageData(0, 0, 1, 1);
        };
        const clone = () => {
          const c = document.createElement('canvas');
          c.width = tp.bake.width;
          c.height = tp.bake.height;
          c.getContext('2d')!.drawImage(tp.bake, 0, 0);
          return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        };
        const surface: [number, number][] = [];
        for (let x = 6; x < lv.w - 6; x += 7) {
          for (let y = 2; y < lv.h - 2; y++) {
            if (lv.tiles[y * lv.w + x] === 1 && lv.tiles[(y - 1) * lv.w + x] === 0) {
              surface.push([x, y]);
              break;
            }
          }
        }
        render();
        let idle = 0;
        for (let i = 0; i < 5; i++) {
          const t0 = performance.now();
          render();
          idle += (performance.now() - t0) / 5;
        }
        const partial: number[] = [];
        const full: number[] = [];
        const wrong: unknown[] = [];
        for (const [cx, cy] of surface) {
          for (let y = cy - 3; y <= cy + 3; y++) {
            for (let x = cx - 3; x <= cx + 3; x++) {
              if ((x - cx) ** 2 + (y - cy) ** 2 <= 10 && y >= 0 && y < lv.h && x >= 0 && x < lv.w && lv.tiles[y * lv.w + x] === 1) lv.tiles[y * lv.w + x] = 0;
            }
          }
          lv.version++;
          const t0 = performance.now();
          render();
          partial.push(performance.now() - t0 - idle);
          const a = timing ? null : clone();
          const dumpA = timing ? '' : tp.bake.toDataURL('image/png');
          tp.fullBakes = true;
          tp.inkKey = '';
          tp.texKey = '';
          lv.version++;
          const t1 = performance.now();
          render();
          full.push(performance.now() - t1 - idle);
          tp.fullBakes = false;
          if (!a) continue;
          const b = clone();
          let bad = 0;
          let worst = 0;
          let box = [1e9, 1e9, -1, -1];
          for (let i = 0; i < a.length; i++) {
            const e = Math.abs(a[i] - b[i]);
            if (!e) continue;
            bad++;
            worst = Math.max(worst, e);
            const px = i >> 2;
            const x = px % tp.bake.width;
            const y = (px - x) / tp.bake.width;
            box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
          }
          wrong.push({ bytes: bad, worst, box, crater: [cx, cy], a: bad > 10000 ? dumpA : '', b: bad > 10000 ? tp.bake.toDataURL('image/png') : '' });
          await new Promise((r) => setTimeout(r, 0));
        }
        const med = (v: number[]) => [...v].sort((p, q) => p - q)[v.length >> 1];
        return {
          level: `${lv.w}x${lv.h}`,
          bake: `${tp.bake.width}x${tp.bake.height}`,
          craters: surface.length,
          idle: Math.round(idle),
          partialMs: Math.round(med(partial)),
          partialMax: Math.round(Math.max(...partial)),
          fullMs: Math.round(med(full)),
          wrong,
        };
      }, argv.includes('--timing'));
      (report.wrong as { a: string; b: string }[]).forEach((w, i) => {
        if (w.a) {
          writeFileSync(`${out}/partial-${i}.png`, Buffer.from(w.a.split(',')[1], 'base64'));
          writeFileSync(`${out}/full-${i}.png`, Buffer.from(w.b.split(',')[1], 'base64'));
        }
        w.a = w.b = '';
      });
      console.log(JSON.stringify(report));
      break;
    }
    case 'grabs': {
      // Swing, keg shot and backfire as stepped frames: motion can't be judged from a single still.
      await open(`seed=${seed}&players=1&race=rope,rope,keg,keg&propseed=${opt('propseed', '1')}`);
      await step(70);
      const [vw] = [page.viewportSize()!.width];
      const k = vw / 768;
      const go = (type: string, vx: number): Promise<[number, number]> =>
        page.evaluate(
          ([t, v]) => {
            const run = (window as any).slagDebug.match.run;
            const m = run.resolved.find((r: any) => r.mods[0].type === t).mods[0];
            const b = run.runners[0].body;
            b.x = m.at[0] - b.w / 2;
            b.y = (t === 'rope' ? m.at[1] + m.length * 0.75 : m.at[1]) - b.h / 2;
            b.vx = v;
            b.vy = 0;
            b.onGround = false;
            b.groundRef = -1;
            // The last sequence may have flung them onto the flag or into something.
            Object.assign(run.runners[0], { alive: true, finished: false });
            run.endFrame = -1;
            run.runners[0].items.daze = 0;
            return [m.at[0], m.at[1]];
          },
          [type, vx] as const,
        );
      const press = (n: number, inp: object) => page.evaluate(([c, i]) => (window as any).slagDebug.step(c, { kb1: i }), [n, inp] as const);
      /** Press along whichever way the rope is swinging. */
      const pump = () =>
        page.evaluate(() => {
          const g = (window as any).slagDebug.match.run.runners[0].attach.grip;
          (window as any).slagDebug.step(1, { kb1: g && g.s >= 0 ? { right: true } : { left: true } });
        });
      const crop = async (name: string, [x, y]: [number, number], files: string[]) => {
        // The camera drifts and zooms during a race, so ask it where the world point landed.
        const cam = await page.evaluate(() => {
          const c = (window as any).slagDebug.renderer.cam;
          return { x: c.x, y: c.y, zoom: c.zoom };
        });
        const w = 260 * k;
        const h = 180 * k;
        const px = ((x - cam.x) * cam.zoom + 384) * k;
        const py = ((y - cam.y) * cam.zoom + 216) * k;
        const path = `${out}/${name}.png`;
        const size = page.viewportSize()!;
        await page.screenshot({
          path,
          clip: { x: Math.min(size.width - w, Math.max(0, px - w / 2)), y: Math.min(size.height - h, Math.max(0, py - h / 2)), width: w, height: h },
        });
        files.push(path);
      };
      const swing: string[] = [];
      const rope = await go('rope', 215);
      for (let i = 0; i < 12; i++) {
        for (let n = 0; n < 9; n++) await pump();
        await crop(`grabs-swing-${String(i).padStart(2, '0')}`, rope, swing);
      }
      await press(1, { jump: true, jumpPressed: true });
      for (let i = 12; i < 15; i++) {
        await press(8, {});
        await crop(`grabs-swing-${i}`, rope, swing);
      }
      await sheet(`grabs-swing-${seed}`, swing, 5);
      const shot: string[] = [];
      const keg = await go('keg', 0);
      for (const n of [1, 3, 8, 30]) {
        await press(n, {});
        await crop(`grabs-shot-${String(shot.length).padStart(2, '0')}`, keg, shot);
      }
      await press(1, { jump: true, jumpPressed: true });
      for (const n of [3, 6, 4, 4, 4, 6, 8, 10, 12, 14, 16]) {
        await press(n, {});
        await crop(`grabs-shot-${String(shot.length).padStart(2, '0')}`, keg, shot);
      }
      await sheet(`grabs-shot-${seed}`, shot, 5);
      const back: string[] = [];
      await go('keg', 0);
      for (const n of [40, 40, 30, 14, 10, 8, 4, 4, 4, 8, 10, 20, 30, 30, 30]) {
        await press(n, {});
        await crop(`grabs-back-${String(back.length).padStart(2, '0')}`, keg, back);
      }
      await sheet(`grabs-back-${seed}`, back, 5);
      break;
    }
    case 'lineup': {
      // Eight runners in a row on open floor, in a spread of poses: once at gameplay scale (zoom 1 at
      // 1920x1080 is 2.5 screen px per world px) and once close up. `--size 1920x1080` for the real scale.
      // `--seeds a,b,c` shoots one row per match seed: each seed rolls its own eight characters.
      const shots: string[] = [];
      for (const sd of opt('seeds', seed)!.split(',')) {
        await open(`seed=${sd}&players=8&race=,&propseed=1`);
        await step(150);
        const row = await page.evaluate(() => {
          const d = (window as any).slagDebug;
          const L = d.match.run.level;
          const n = 13;
          for (let ty = L.h - 3; ty > 6; ty--) {
            for (let tx = 2; tx < L.w - n - 2; tx++) {
              const open = Array.from({ length: n }, (_, dx) => dx).every(
                (dx) => L.tiles[ty * L.w + tx + dx] === 1 && [1, 2, 3, 4, 5].every((dy) => L.tiles[(ty - dy) * L.w + tx + dx] === 0),
              );
              if (!open) continue;
              const feet = ty * 16;
              d.match.run.runners.forEach((r: any, i: number) => {
                r.body.x = tx * 16 + 8 + i * 25;
                r.body.y = feet - r.body.h;
                r.body.vx = r.body.vy = 0;
              });
              return { x: tx * 16 + 8 + 3.5 * 25, y: feet - 10, devs: d.match.players.map((p: any) => p.device) };
            }
          }
          return null;
        });
        if (!row) {
          console.log(`seed ${sd}: no open floor for a lineup, skipped`);
          continue;
        }
        // One frame per render, so ribbons and dust run as they do live and don't jump a stride at a time.
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
          const size = page.viewportSize()!;
          const k = size.width / 768;
          const [w, h] = zoom === 1 ? [300 * k, 90 * k] : [size.width, 160 * k];
          const path = `${out}/lineup-${sd}-x${zoom}.png`;
          await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: size.height / 2 - h * 0.62, width: w, height: h } });
          console.log(path);
          shots.push(path);
        }
        // Then the pack: everyone runs right and half of them jump, as a race start looks.
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
        {
          const size = page.viewportSize()!;
          const k = size.width / 768;
          const path = `${out}/lineup-${sd}-pack.png`;
          await page.screenshot({ path, clip: { x: size.width / 2 - 170 * k, y: size.height / 2 - 70 * k, width: 340 * k, height: 110 * k } });
          console.log(path);
          shots.push(path);
        }
      }
      await sheet(
        `lineup-x1`,
        shots.filter((f) => f.endsWith('x1.png')),
        2,
      );
      await sheet(
        `lineup-x3`,
        shots.filter((f) => f.endsWith('x3.png')),
        1,
      );
      await sheet(
        `lineup-pack`,
        shots.filter((f) => f.endsWith('pack.png')),
        2,
      );
      break;
    }
    case 'stack': {
      // Body contact as stepped frames: three runners stack, the bottom one walks them along, and a fourth bounces off the top.
      await open(`seed=${seed}&players=4&race=mystery&propseed=${opt('propseed', '1')}`);
      await step(190);
      const spot = await page.evaluate(() => {
        const run = (window as any).slagDebug.match.run;
        const L = run.level;
        for (let ty = 8; ty < L.h - 2; ty++) {
          for (let tx = 7; tx < L.w - 14; tx++) {
            const clear = [0, 1, 2, 3, 4, 5, 6].every(
              (dx) => L.tiles[(ty + 1) * L.w + tx + dx] === 1 && [0, 1, 2, 3, 4, 5, 6, 7].every((dy) => L.tiles[(ty - dy) * L.w + tx + dx] === 0),
            );
            if (!clear) continue;
            const x = (tx + 1) * 16 + 3;
            const feet = (ty + 1) * 16;
            run.runners.forEach((r: any, i: number) => {
              r.body.x = x;
              r.body.y = feet - r.body.h - i * 26;
              r.body.vx = r.body.vy = 0;
              r.body.onGround = false;
              r.body.groundRef = -1;
            });
            return [x, feet - 40];
          }
        }
        throw new Error('no open floor for a stack');
      });
      const zk = page.viewportSize()!.width / 768;
      const crop = async (name: string, files: string[]) => {
        // The camera drifts and zooms during a race, so ask it where the stack landed on screen.
        const cam = await page.evaluate(() => {
          const d = (window as any).slagDebug;
          return { x: d.renderer.cam.x, y: d.renderer.cam.y, zoom: d.renderer.cam.zoom, stack: d.match.run.runners[0].body.x };
        });
        const [w, h] = [300 * zk, 200 * zk];
        const size = page.viewportSize()!;
        const px = ((cam.stack - cam.x) * cam.zoom + 384) * zk;
        const py = ((spot[1] - cam.y) * cam.zoom + 216) * zk;
        const path = `${out}/${name}.png`;
        await page.screenshot({
          path,
          clip: { x: Math.min(size.width - w, Math.max(0, px - w / 2)), y: Math.min(size.height - h, Math.max(0, py - h / 2)), width: w, height: h },
        });
        files.push(path);
      };
      const press = (n: number, inputs: object) => page.evaluate(([c, i]) => (window as any).slagDebug.step(c, i), [n, inputs] as const);
      const rows = () =>
        page.evaluate(() =>
          (window as any).slagDebug.match.run.runners
            .map((r: any) => `#${r.slot} y=${r.body.y.toFixed(1)} ride=${r.ride} ground=${r.body.onGround}`)
            .join('  '),
        );
      const frames: string[] = [];
      const shoot = async (label: string) => {
        await crop(`stack-${String(frames.length).padStart(2, '0')}-${label}`, frames);
        console.log(label, await rows());
      };
      // Runners 1..3 fall onto runner 0.
      await press(4, {});
      await shoot('falling');
      await press(40, {});
      await shoot('stacked');
      await press(24, { kb1: { right: true } });
      await shoot('carried');
      await press(16, { kb1: { right: true, run: true } });
      await shoot('carried-run');
      await press(14, {});
      await shoot('settled');
      // The top runner jumps straight up, and buffers a jump on the way back down: a head-bounce.
      await press(1, { pad1: { jump: true, jumpPressed: true } });
      await press(9, { pad1: { jump: true } });
      await shoot('jump-off');
      await press(14, { pad1: { jump: true } });
      await shoot('apex');
      const top = await page.evaluate(() => (window as any).slagDebug.match.run.runners[2].body.y - 14);
      for (let i = 0; i < 60; i++) {
        const y = await page.evaluate(() => (window as any).slagDebug.match.run.runners[3].body.y);
        if (y > top - 12) break;
        await press(1, {});
      }
      await shoot('coming-down');
      await press(1, { pad1: { jump: true, jumpPressed: true } });
      await press(3, { pad1: { jump: true } });
      await shoot('head-bounce');
      await press(10, { pad1: { jump: true } });
      await shoot('bounced');
      await sheet(`stack-${seed}`, frames, 4);
      break;
    }
    case 'items': {
      // Every item in hand, then everyone uses theirs at once: one frame set per moment worth looking at.
      await open(`seed=${seed}&players=6&race=mystery,mystery,mystery&give=all&propseed=${opt('propseed', '1')}`);
      await step(190);
      // Spread the runners along open ground, with one loose item of each kind beside them.
      await page.evaluate(() => {
        const run = (window as any).slagDebug.match.run;
        const L = run.level;
        const spots: [number, number][] = [];
        for (let tx = 7; tx < L.w - 6 && spots.length < 12; tx += 2) {
          for (let ty = 2; ty < L.h - 1; ty++) {
            if (L.tiles[ty * L.w + tx] === 1 && !L.tiles[(ty - 1) * L.w + tx] && !L.tiles[(ty - 2) * L.w + tx]) {
              spots.push([tx, ty]);
              break;
            }
          }
        }
        run.runners.forEach((r: any, i: number) => {
          const [tx, ty] = spots[Math.floor((i * spots.length) / 6)];
          r.body.x = tx * 16 + 2;
          r.body.y = ty * 16 - r.body.h;
          r.body.vx = r.body.vy = 0;
        });
        ['sword', 'puck', 'boomerang', 'shield', 'rocket', 'smoke'].forEach((kind, i) => {
          const [tx, ty] = spots[(Math.floor((i * spots.length) / 6) + 1) % spots.length];
          run.items.drops.push({ id: 90 + i, kind, uses: 1, x: tx * 16 + 8, y: ty * 16 - 6, vx: 0, vy: 0, born: run.frame, grace: 600, onGround: false });
        });
      });
      await step(20);
      await snap(`items-${seed}-held`);
      const use = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3'];
      const press = Object.fromEntries(
        use.map((d) => [
          d,
          {
            left: false,
            right: false,
            up: false,
            down: false,
            jump: false,
            jumpPressed: false,
            confirmPressed: false,
            altPressed: false,
            downPressed: false,
            usePressed: true,
          },
        ]),
      );
      await page.evaluate((p) => (window as any).slagDebug.step(1, p), press);
      await step(3);
      await snap(`items-${seed}-swing`);
      await step(4);
      await snap(`items-${seed}-use`);
      await step(40);
      await snap(`items-${seed}-after`);
      break;
    }
    case 'blood': {
      // Stage deaths on open floors over four rounds: fresh ooze, a settled puddle with someone on it, the place phase, and the first round's blood gone.
      await open(`seed=${seed}&players=${players}${tq}`);
      const stage = (round: number) =>
        page.evaluate((n: number) => {
          const d = (window as any).slagDebug;
          const m = d.match;
          if (m.phase !== 'run') m.startRun();
          const run = m.run;
          const L = run.level;
          run.frame = Math.max(run.frame, 100);
          const spots: [number, number][] = [];
          for (let tx = 8 + n * 3; tx < L.w - 8 && spots.length < 20; tx += 4) {
            for (let ty = 2; ty < L.h - 1; ty++) {
              if (L.tiles[ty * L.w + tx] === 1 && !L.tiles[(ty - 1) * L.w + tx] && !L.tiles[(ty - 2) * L.w + tx]) {
                spots.push([tx, ty]);
                break;
              }
            }
          }
          // The last runner lives, standing on the first puddle.
          run.runners.slice(0, -1).forEach((r: any, i: number) => {
            const [tx, ty] = spots[(i * 2 + n) % spots.length];
            r.body.x = tx * 16 + 3;
            r.body.y = ty * 16 - r.body.h;
            r.body.vx = r.body.vy = 0;
            run.kill(r, -1, 'hazard');
          });
          // One more against a wall with no floor near, if this level has one.
          if (n === 0) {
            const walls: [number, number][] = [];
            for (let ty = 3; ty < L.h - 8; ty++) {
              for (let tx = 6; tx < L.w - 6; tx++) {
                const wall = L.tiles[ty * L.w + tx] === 1 && L.tiles[(ty + 1) * L.w + tx] === 1;
                if (wall && [0, 1, 2, 3, 4, 5].every((d) => [1, 2, 3].every((a) => !L.tiles[(ty + d) * L.w + tx - a]))) walls.push([tx, ty]);
              }
            }
            const smear = run.runners[1];
            if (walls.length && smear) {
              smear.alive = true;
              smear.body.x = walls[0][0] * 16 - smear.body.w - 1;
              smear.body.y = walls[0][1] * 16;
              run.kill(smear, -1, 'hazard');
            }
          }
          const [tx, ty] = spots[n % spots.length];
          const r = run.runners.at(-1);
          r.body.x = tx * 16 + 3;
          r.body.y = ty * 16 - r.body.h - 8;
          r.body.vx = r.body.vy = 0;
        }, round);
      const nextRound = () =>
        page.evaluate(() => {
          const m = (window as any).slagDebug.match;
          m.run.kill(m.run.runners.at(-1), -1, 'pop');
          m.run.frame += 1;
          m.run.endFrame = 0;
          m.step({});
          m.phaseFrame = 100000;
          m.step({});
          m.run = null;
        });
      // Particles run on render calls, so rendering often lets the death burst clear.
      const settle = async (n: number) => {
        for (let i = 0; i < n; i += 4) await step(4);
      };
      await step(5);
      await page.evaluate(() => (window as any).slagDebug.race());
      await step(10);
      await stage(0);
      await step(12);
      await snap(`blood-${seed}-r1-ooze`);
      await settle(120);
      await snap(`blood-${seed}-r1-settled`);
      await nextRound();
      await page.evaluate(() => {
        const m = (window as any).slagDebug.match;
        m.phase = 'place';
        m.phaseFrame = 0;
      });
      await step(1);
      await snap(`blood-${seed}-r2-place`);
      await stage(1);
      await settle(120);
      await snap(`blood-${seed}-r2-race`);
      await nextRound();
      await stage(2);
      await settle(120);
      await snap(`blood-${seed}-r3-race`);
      await nextRound();
      await page.evaluate(() => (window as any).slagDebug.match.startRun());
      await step(30);
      console.log('cells', await page.evaluate(() => (window as any).slagDebug.match.blood.length));
      await snap(`blood-${seed}-r4-race`);
      break;
    }
    case 'levels': {
      const themes =
        opt('themes') === 'all'
          ? ['farm', 'factory', 'castle', 'jungle', 'volcano', 'harbor', 'mine', 'rooftops', 'glacier', 'space']
          : opt('themes')?.split(',');
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
    case 'rules': {
      // Fails the run if the card doesn't fit the window.
      await open(`seed=${seed}`);
      await step(5);
      await page.mouse.click(((768 - 196 + 42) / 768) * W, (28 / 432) * H);
      await page.waitForSelector('.slag-sheet', { timeout: 5000 });
      await snap(`rules-${W}x${H}`);
      const over = await page.evaluate(() => {
        const c = document.querySelector('.slag-sheet')!;
        return c.scrollHeight - c.clientHeight;
      });
      if (over > 0) throw new Error(`rules card overflows by ${over}px`);
      break;
    }
    case 'settings': {
      // Fails the run if a tab doesn't fit, or an input doesn't do what its prompt says.
      const tabOf = (p: typeof page) => p.evaluate(() => document.querySelector('.slag-panel')?.getAttribute('data-tab'));
      const expectTab = async (p: typeof page, want: string) => {
        await p.waitForTimeout(150);
        if ((await tabOf(p)) !== want) throw new Error(`settings: on tab ${await tabOf(p)}, expected ${want}`);
      };
      const expectFit = async (p: typeof page, label: string) => {
        const over = await p.evaluate(() => {
          const panel = document.querySelector('.slag-panel')!;
          return panel.scrollHeight - panel.clientHeight;
        });
        if (over > 0) throw new Error(`settings: ${label} overflows by ${over}px`);
      };
      // A pad that exists from the first frame; the page reads window.slagShotPad like hardware.
      await page.addInitScript(() => {
        const pressed = new Set<number>();
        (window as any).slagShotPad = pressed;
        navigator.getGamepads = () =>
          [
            {
              index: 0,
              connected: true,
              axes: [0, 0, 0, 0],
              buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.has(i), touched: false, value: pressed.has(i) ? 1 : 0 })),
            },
          ] as unknown as Gamepad[];
      });
      const presses = async (key: string, n: number) => {
        for (let i = 0; i < n; i++) await page.keyboard.press(key);
      };
      const pad = async (button: number) => {
        await page.evaluate((b) => (window as any).slagShotPad.add(b), button);
        await page.waitForTimeout(120);
        await page.evaluate((b) => (window as any).slagShotPad.delete(b), button);
        await page.waitForTimeout(120);
      };
      await open(`seed=${seed}`);
      await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
      await step(5);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.slag-panel');
      const tabs = ['audio', 'video', 'keyboard', 'mouse', 'gamepad'];
      for (const [i, tab] of tabs.entries()) {
        if (i > 0) await page.keyboard.press('e');
        await expectTab(page, tab);
        await expectFit(page, tab);
        await snap(`settings-${tab}${mode === 'gamepad' ? '-pad' : ''}`);
      }
      await page.keyboard.press('e');
      await expectTab(page, 'audio');
      await page.keyboard.press('q');
      await expectTab(page, 'gamepad');
      // The biggest page: two players' worth of slots.
      await page.click('#slag-tab-keyboard');
      await expectTab(page, 'keyboard');
      await page.click('[aria-label="Split Keyboard (Two Players)"]');
      await page.waitForTimeout(100);
      await expectFit(page, 'split keyboard');
      await snap('settings-keyboard-split');
      await page.click('[aria-label="Split Keyboard (Two Players)"]');
      await page.waitForTimeout(100);
      // Rebinding by key: Q is captured as the new key, not read as "previous tab". Selection stays put.
      const selected = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent);
      const bindings = () => page.evaluate(() => JSON.parse(localStorage.getItem('slag.input.v1') ?? '{}').single?.jump);
      await page.mouse.move(2, 2);
      await page.locator('[aria-label="Split Keyboard (Two Players)"]').focus();
      await presses('ArrowDown', 5);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      if (!String(await selected()).startsWith('Jump, Keys 1')) throw new Error(`settings: arrows landed on ${await selected()}`);
      await snap('settings-keyboard-selection');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.slag-btn.listen');
      await snap('settings-keyboard-listen');
      await page.keyboard.press('q');
      await page.waitForTimeout(100);
      await expectTab(page, 'keyboard');
      if ((await bindings())?.[0] !== 'KeyQ') throw new Error(`settings: rebinding saved ${await bindings()}`);
      if (!String(await selected()).startsWith('Jump, Keys 1')) throw new Error(`settings: rebinding moved the selection to ${await selected()}`);
      await page.click('text=Reset Controls');
      await page.waitForTimeout(100);
      if ((await bindings())?.[0] !== 'Space') throw new Error(`settings: Reset Controls left ${await bindings()}`);
      // The pad walks the tabs, sweeps a slider, and backs out.
      await pad(5);
      await expectTab(page, 'mouse');
      await pad(4);
      await pad(4);
      await pad(4);
      await expectTab(page, 'audio');
      await pad(13); // Mute → Master
      await pad(15);
      await pad(15);
      await snap('settings-pad-selection');
      const volume = () => page.evaluate(() => JSON.parse(localStorage.getItem('slag.audio.v1') ?? '{}').master);
      if ((await volume()) !== 0.9) throw new Error(`settings: pad slider left master at ${await volume()}`);
      await pad(1);
      if (await page.$('.slag-panel')) throw new Error('settings: pad B did not close the menu');
      // Opening runs through the game loop's input sampling, which screenshots keep paused.
      await page.evaluate(() => (window as any).slagDebug.pause(false));
      await pad(9);
      await page.waitForSelector('.slag-panel');
      await expectTab(page, 'audio');
      await pad(9);
      if (await page.$('.slag-panel')) throw new Error('settings: pad Start did not close the menu');

      // Saved settings survive a reload. Reopening lands on the tab you left.
      await page.reload();
      await page.waitForFunction(() => 'slagDebug' in window);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.slag-panel');
      const master = await page.evaluate(() => (document.querySelector('[aria-label="Master volume"]') as HTMLInputElement).value);
      if (master !== '0.9') throw new Error(`settings: master reloaded as ${master}`);
      await page.keyboard.press('e');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.slag-panel');
      await expectTab(page, 'video');

      // The same menu over the main menu: picks persist for the game to read, and no A falls through on Done.
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      await page.click('text=SETTINGS');
      await page.waitForSelector('.slag-panel');
      await page.keyboard.press('e');
      await expectTab(page, 'video');
      await page.waitForTimeout(200);
      await page.click('.slag-chips >> text=Low');
      await snap('settings-home');
      const saved = await page.evaluate(() => localStorage.getItem('slag.quality'));
      if (saved !== 'low') throw new Error(`settings: home saved ${saved}`);
      // Tab stays inside the card; the arrows reach Done from the page.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const inCard = await page.evaluate(() => !!document.activeElement?.closest('.slag-card'));
      if (!inCard) throw new Error('settings: Tab left the card');
      await page.keyboard.press('ArrowDown');
      if ((await selected())?.trim().endsWith('Done') !== true) throw new Error(`settings: arrows landed on ${await selected()}`);
      await pad(0);
      await page.waitForTimeout(300);
      if (await page.$('.slag-panel')) throw new Error('settings: pad A on Done left the menu open, or reopened it');

      for (const [name, width, height] of [
        ['phone', 390, 844],
        ['phone-landscape', 844, 390],
      ] as const) {
        const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const phone = await ctx.newPage();
        phone.on('pageerror', (e: Error) => errors.push(String(e)));
        await phone.goto(base);
        await phone.evaluate(() => document.fonts.ready);
        await phone.tap('text=SETTINGS');
        await phone.waitForSelector('.slag-panel');
        for (const tab of ['audio', 'video', 'touch']) {
          await phone.tap(`#slag-tab-${tab}`);
          await expectTab(phone, tab);
          const small = await phone.evaluate(
            () => [...document.querySelectorAll('.slag-tab,.slag-settings .slag-btn')].filter((b) => b.getBoundingClientRect().height < 44).length,
          );
          if (small) throw new Error(`settings: ${small} controls under 44 px on ${name}`);
          await phone.screenshot({ path: `${out}/settings-${name}-${tab}.png` });
          console.log(`${out}/settings-${name}-${tab}.png`);
          pet();
        }
        await ctx.close();
      }
      break;
    }
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
