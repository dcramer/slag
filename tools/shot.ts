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
 *   pnpm shot place --card spikestrip --cursor 296,184 --then-race 90 → aim the first ghost, place it, shoot the race
 *   pnpm shot levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   pnpm shot props --count 24            → prop gallery (crate cards)
 *   pnpm shot items --seed abc             → held items: in hand, loose, and each one used
 *   pnpm shot codex                        → /codex page (full-page screenshot)
 *   pnpm shot home                         → main menu (desktop + 390×844 mobile)
 *   pnpm shot settings                     → every settings tab over the lobby, driven by keys and a fake pad,
 *                                           then over the main menu on a phone (portrait and landscape), by tap
 *   pnpm shot score --players 4            → round-score screen
 *   pnpm shot compare --seed abc --players 4 [--themes farm,mine] → classic vs cel sheets, same sim frame per row
 *   pnpm shot mobile [--device "Pixel 7 landscape"]  → phone emulation driven by real
 *                                           multi-touch: lobby/join, pick, place, race, portrait
 *
 * Options: --out shots  --size 1280x720 (window)  --world classic|wide|tall (level size)  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 *          --noui (hide the HUD, e.g. to review level shapes)
 *          --mode keyboard|gamepad|touch (footer prompt glyphs)  --net (fake online-lobby info)
 *          --style cel (art style, see src/render/style.ts; files get a `-cel` suffix)  --noletters (no impact words)
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
const style = opt('style');
const art = opt('art');
const tq =
  (theme ? `&theme=${theme}` : '') +
  (world ? `&size=${world}` : '') +
  (argv.includes('--noui') ? '&ui=0' : '') +
  (style ? `&style=${style}` : '') +
  (art ? `&art=${art}` : '') +
  (opt('boil') ? `&boil=${opt('boil')}` : '') +
  (opt('q') ? `&q=${opt('q')}` : '') +
  (opt('feed') ? `&feed=${opt('feed')}` : '') +
  (argv.includes('--noletters') ? '&lettering=0' : '');
const sfx = (style ? `-${style}` : '') + (art ? `-${art}` : '') + (opt('feed') === '0' ? '-bypass' : '');
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
async function snap(name: string) {
  const p = `${out}/${name}${sfx}.png`;
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
  // The Ready pill runs along the bottom of the first card.
  p = await v2c(96, 331);
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
      if (opt('claim')) {
        // `--claim 2,5`: those cards are taken, as if players had picked them.
        await page.evaluate((cards) => {
          const m = (window as any).slagDebug.match;
          for (const i of cards) m.crate[i].claimedBy = m.players[0].slot;
        }, opt('claim')!.split(',').map(Number));
        await step(1);
      }
      await snap(`pick-${seed}`);
      break;
    case 'place':
      await open(`seed=${seed}&players=${players}`);
      // `--card rope` gives the first player that archetype, if the crate has one.
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
      await snap(`place-${seed}`);
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
        // `--spread`: stand the runners on open ground, away from the spawn's glow, to judge the character art.
        if (argv.includes('--spread')) {
          await page.evaluate(() => {
            const d = (window as any).slagDebug;
            const lv = d.match.level;
            const T = 16;
            d.match.run.runners.forEach((r: any, i: number) => {
              for (let tx = lv.spawn.tx + 3 + i * 2; tx < lv.w; tx++) {
                for (let ty = 1; ty < lv.h; ty++) {
                  if (lv.tiles[ty * lv.w + tx] === 1 && lv.tiles[(ty - 1) * lv.w + tx] === 0 && ty > lv.spawn.ty - 6) {
                    r.body.x = tx * T + 4;
                    r.body.y = ty * T - r.body.h;
                    r.body.vx = r.body.vy = 0;
                    return;
                  }
                }
              }
            });
          });
        }
        // `--campin x,y,zoom`: the sim frame alone isn't "the same frame": camera smoothing depends on how
        // many frames rendered before the pause, so sheets pin the view as well.
        const pin = opt('campin')?.split(',').map(Number);
        await page.evaluate((v) => {
          const cam = (window as any).slagDebug.renderer.cam;
          if (v) {
            cam.update = () => {};
            cam.snap({ cx: v[0], cy: v[1], zoom: v[2] });
            cam.shake = 0;
          }
        }, pin ?? null);
        await step(4);
        console.log(
          JSON.stringify(
            await page.evaluate(() => {
              const c = (window as any).slagDebug.renderer.cam;
              return { cx: c.x, cy: c.y, zoom: c.zoom };
            }),
          ),
        );
        await snap(`race-${seed}-${exact}`);
        break;
      }
      for (const f of [frames, 40, 40]) {
        await step(f);
        await snap(`race-${seed}-${await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0)}`);
      }
      break;
    }
    case 'inkperf': {
      // ART SPIKE: where a frame's time goes. readPixels forces software GL to finish, or the clock lies.
      const race = opt('race', '')!;
      await open(`seed=${seed}&players=${players}&race=${race}&propseed=${opt('propseed', '1')}`);
      const report = await page.evaluate(async () => {
        const d = (window as any).slagDebug;
        const px = new Uint8Array(4);
        const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean) as WebGL2RenderingContext;
        const times: number[] = [];
        for (let i = 0; i < 12; i++) {
          const t0 = performance.now();
          d.step(1);
          d.render?.();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          times.push(Math.round(performance.now() - t0));
          await new Promise((r) => setTimeout(r, 0));
        }
        const frame = times[times.length - 1];
        const rebakes: number[] = [];
        for (let i = 0; i < 4; i++) {
          d.match.level.version++;
          const t0 = performance.now();
          d.render?.();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          rebakes.push(Math.round(performance.now() - t0 - frame));
          await new Promise((r) => setTimeout(r, 0));
        }
        return { times, rebakes, level: `${d.match.level.w}x${d.match.level.h}`, bakePx: d.renderer?.terrain?.bake?.width };
      });
      console.log(JSON.stringify(report));
      break;
    }
    case 'inkbomb': {
      // ART SPIKE: carve a crater the way a bomb does, re-bake, and report what the re-bake cost and what moved.
      await open(`seed=${seed}&players=${players}&race=&propseed=1`);
      await step(30);
      const before = await snap(`inkbomb-${seed}-before`);
      // The bake itself, so clouds and runners can't count as "moved". Compare these with an exact diff.
      const bakeOut = async (name: string) => {
        const url: string = await page.evaluate(() => (window as any).slagDebug.renderer.terrain.bake.toDataURL('image/png'));
        writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
      };
      await bakeOut('bake-before');
      const report = await page.evaluate(() => {
        const d = (window as any).slagDebug;
        const lv = d.match.level;
        let cx = -1;
        let cy = -1;
        // A surface tile near the middle of the level, deep enough to bite a real hole.
        for (let x = Math.floor(lv.w / 3); x < lv.w && cx < 0; x++) {
          for (let y = 2; y < lv.h - 2; y++) {
            if (lv.tiles[y * lv.w + x] === 1 && lv.tiles[(y - 1) * lv.w + x] === 0) {
              cx = x;
              cy = y;
              break;
            }
          }
        }
        for (let y = cy - 3; y <= cy + 3; y++) {
          for (let x = cx - 3; x <= cx + 3; x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= 10 && y >= 0 && y < lv.h && x >= 0 && x < lv.w) lv.tiles[y * lv.w + x] = 0;
        }
        lv.version++;
        d.step(1);
        d.render?.();
        return { cx, cy, tileW: lv.w, tileH: lv.h, bakeW: d.renderer.terrain.bake.width };
      });
      console.log(JSON.stringify(report));
      await bakeOut('bake-after');
      await snap(`inkbomb-${seed}-after`);
      console.log(before);
      break;
    }
    case 'inkframes': {
      // ART SPIKE: consecutive frames, to look for shimmer (static terrain must not change) and judge the boil.
      await open(`seed=${seed}&players=${players}&race=${opt('race', '')}&propseed=${opt('propseed', '1')}`);
      await step(Number(opt('frames', '120')));
      // Hold the camera, or the numbers measure the camera and not the drawing.
      await page.evaluate(() => {
        const cam = (window as any).slagDebug.renderer.cam;
        cam.update = () => {};
        cam.shake = 0;
      });
      for (let i = 0; i < 8; i++) {
        await step(5);
        await snap(`frames-${String(i).padStart(2, '0')}`);
      }
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
        const path = `${out}/${name}${sfx}.png`;
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
    case 'compare': {
      // Classic vs cel from one paused page, so both columns are literally the same sim frame.
      const themes = (opt('themes') ?? 'farm,factory,castle,volcano').split(',');
      const shoot = async (name: string, files: string[], at?: number) => {
        // One timestamp for both columns; it must not run behind the renderer's clock (negative dt flings the camera).
        const ms = at ?? (await page.evaluate(() => performance.now()));
        for (const st of ['classic', 'cel']) {
          await page.evaluate(
            ([s, t]) => {
              const d = (window as any).slagDebug;
              d.renderer.setStyle(s, false);
              d.render(t);
            },
            [st, ms] as const,
          );
          files.push(await snap(`cmp-${name}-${st}`));
        }
      };
      const scene: string[] = [];
      for (const th of themes) {
        const give = opt('give');
        await open(
          `seed=${seed}&theme=${th}&players=${players}&race=${opt('race', 'saw,laser,launcher,flamer,spring')}&propseed=${opt('propseed', '1')}${give ? `&give=${give}` : ''}`,
        );
        // Scripted runners so hazards, deaths and lettering are in frame. Past `frames`, stop just after the
        // next death to catch an impact. Runs in the cel style so its lettering is live; the classic
        // column draws the same state without it.
        const ms = await page.evaluate((n) => {
          const d = (window as any).slagDebug;
          d.renderer.setStyle('cel', false);
          let stop = n + 90;
          let was = 0;
          const t0 = performance.now();
          let now = t0;
          for (let f = 0; f < stop; f++) {
            const dead = d.match.run?.runners.filter((r: any) => !r.alive).length ?? 0;
            if (f >= n && stop === n + 90 && dead > was) stop = f + 11;
            if (f < n) was = dead;
            const inputs: Record<string, object> = {};
            d.match.players.forEach((p: any, i: number) => {
              // The last player stays home, so the round survives everyone else dying.
              const go = i < d.match.players.length - 1;
              const c = f + i * 13;
              inputs[p.device] = { left: false, right: go, up: false, down: false, jump: go && c % 46 < 16, jumpPressed: go && c % 46 === 0, run: go };
            });
            d.match.step(inputs);
            now = t0 + (f * 1000) / 60;
            if (f > n - 40 || f % 6 === 0) d.render(now);
          }
          return now;
        }, frames);
        await shoot(`race-${th}`, scene, ms);
      }
      await sheet(`compare-race-${seed}`, scene, 2);
      const menus: string[] = [];
      await open(`seed=${seed}&theme=${themes[0]}`);
      await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
      await step(40);
      await shoot('lobby', menus);
      await open(`seed=${seed}&theme=${themes[0]}&players=${players}`);
      await step(40);
      await shoot('pick', menus);
      await page.evaluate(() => {
        const m = (window as any).slagDebug.match;
        m.players.forEach((p: any, i: number) => {
          p.claim = i;
          m.crate[i].claimedBy = p.slot;
          p.cursor = { x: 300 + i * 150, y: 180 };
        });
      });
      await step(60);
      await shoot('place', menus);
      await sheet(`compare-menus-${seed}`, menus, 2);
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
      await page.click('.slag-chips >> text=Cel');
      await page.click('.slag-chips >> text=Low');
      await snap('settings-home');
      const saved = await page.evaluate(() => [localStorage.getItem('slag.quality'), localStorage.getItem('slag.render.v1')]);
      if (saved[0] !== 'low' || !saved[1]?.includes('cel')) throw new Error(`settings: home saved ${saved.join()}`);
      // Tab stays inside the card; the arrows reach Done from the page.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const inCard = await page.evaluate(() => !!document.activeElement?.closest('.slag-card'));
      if (!inCard) throw new Error('settings: Tab left the card');
      await page.keyboard.press('ArrowDown');
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
