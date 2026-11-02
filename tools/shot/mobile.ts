import { devices } from 'playwright';
import { touchLayout } from '../../src/input/touch';
import { base, browser, errors, opt, out, pet, seed, tq, type Scenarios } from './ctx';

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
  // Hold the self-destruct button about half of POP_HOLD (1.25 s), standing still: the rings on it and on the runner
  // fill. Letting go cancels.
  const charge = () =>
    mp.evaluate(() => {
      const m = (window as any).slagDebug.match;
      const slot = m.players.find((q: any) => q.device === 'touch').slot;
      return m.run.runners.find((q: any) => q.slot === slot).pop as number;
    });
  await touch('touchStart', [{ x: L.pop.x, y: L.pop.y, id: 3 }]);
  // Real time runs slow under software GL: wait on the sim, not the clock.
  await mp.waitForFunction(
    () => {
      const m = (window as any).slagDebug.match;
      const slot = m.players.find((q: any) => q.device === 'touch').slot;
      return m.run.runners.find((q: any) => q.slot === slot).pop >= 40;
    },
    null,
    { timeout: 30_000, polling: 'raf' },
  );
  // Paused for the shot, which takes longer than the rest of the hold would.
  await mp.evaluate(() => (window as any).slagDebug.pause(true));
  const mid = await charge();
  await shotM('race-alt');
  await touch('touchEnd', []);
  await mp.evaluate(() => (window as any).slagDebug.pause(false));
  await mp.waitForTimeout(100);
  const after = await runner();
  console.log('self-destruct charge mid-hold', mid, 'after letting go', await charge(), JSON.stringify(after));
  if (!mid || !after?.alive) throw new Error('a half hold of the self-destruct button should charge and then cancel');
  const before = after;
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
  await touch('touchEnd', []);
  await mp.waitForTimeout(100);
  // Now the whole hold pops the runner, unless the jump already found the pit.
  if ((await runner())?.alive) {
    await touch('touchStart', [{ x: L.pop.x, y: L.pop.y, id: 3 }]);
    await mp
      .waitForFunction(
        () => {
          const m = (window as any).slagDebug.match;
          const slot = m.players.find((q: any) => q.device === 'touch').slot;
          return m.phase !== 'run' || !m.run.runners.find((q: any) => q.slot === slot).alive;
        },
        null,
        { timeout: 30_000, polling: 'raf' },
      )
      .catch(() => {});
    await mp.waitForTimeout(100);
    await touch('touchEnd', []);
    const popped = await runner();
    console.log('after a full self-destruct hold', JSON.stringify(popped));
    if (popped?.alive && (await mp.evaluate(() => (window as any).slagDebug.match.phase)) === 'run')
      throw new Error('holding the self-destruct button did not pop the runner');
  }
  // The run may already be over (the jump can find the pit on some levels) and the score screen gone with it.
  await mp.waitForFunction(() => ['score', 'pick', 'victory'].includes((window as any).slagDebug.match.phase), null, { timeout: 60_000 });
  await mp.waitForTimeout(1800);
  if ((await mp.evaluate(() => (window as any).slagDebug.match.phase)) === 'score') await shotM('score');
  else console.log('score screen already passed: no score shot');
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

export const shots: Scenarios = {
  mobile: () => mobile(opt('device', 'iPhone 13 landscape')!),
};
