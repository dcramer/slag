import { devices } from 'playwright';
import { touchLayout } from '../../src/input/touch';
import { menuControls, menuOpen, pressMenu, waitMenu } from '../lib/menu';
import { base, browser, engine, errors, opt, out, pet, seed, tq, type Scenarios } from './ctx';

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
  const cdp = engine === 'chromium' ? await ctx.newCDPSession(mp) : null;
  const tag = `${engine === 'chromium' ? '' : `${engine}-`}${deviceName.toLowerCase().replaceAll(/\W+/g, '-')}`;
  const shotM = async (name: string) => {
    const p = `${out}/mobile-${tag}-${name}.png`;
    await mp.screenshot({ path: p });
    console.log(p);
    pet();
  };
  type Pt = { x: number; y: number; id: number };
  /** Fingers down now, for engines without CDP: their pointer events are made in the page from the change. */
  const fingers = new Map<number, Pt>();
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Pt[]) => {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touchPoints.map((t) => ({ ...t, radiusX: 8, radiusY: 8, force: 1 })) });
      return;
    }
    // Only Chromium takes raw multi-touch from outside. Elsewhere the game's own input path (touch pointer events on the
    // window, src/input/touch.ts) is fed the same fingers: what changed since the last call goes down, moves or lifts.
    const events: { type: string; id: number; x: number; y: number }[] = [];
    const now = new Map(touchPoints.map((t) => [t.id, t]));
    for (const t of touchPoints) {
      const was = fingers.get(t.id);
      if (!was) events.push({ type: 'pointerdown', ...t });
      else if (was.x !== t.x || was.y !== t.y) events.push({ type: 'pointermove', ...t });
    }
    for (const [id, t] of fingers) if (!now.has(id)) events.push({ type: 'pointerup', ...t, id });
    fingers.clear();
    for (const [id, t] of now) fingers.set(id, t);
    await mp.evaluate((evs) => {
      for (const e of evs) {
        const target = document.elementFromPoint(e.x, e.y) ?? document.body;
        const init = { pointerId: 100 + e.id, pointerType: 'touch', isPrimary: e.id === 1, clientX: e.x, clientY: e.y, bubbles: true, cancelable: true };
        target.dispatchEvent(new PointerEvent(e.type, { ...init, buttons: e.type === 'pointerup' ? 0 : 1 }));
      }
    }, events);
  };
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
  /** Two tap targets that overlap make a thumb's tap a coin toss between them. */
  const overlaps = async (where: string) => {
    const all = await hudButtons();
    const found: string[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0.5 && oy > 0.5) found.push(`${where}: ${a.action} and ${b.action} tap targets overlap by ${ox.toFixed(1)}×${oy.toFixed(1)} CSS px`);
      }
    return found;
  };

  /**
   * The lobby at every player count, on its side and upright: from five players the bays go to two rows of small
   * cards, and each card's name, swatch, status and buttons must still fit and stay thumb-sized.
   */
  const crowdedLobby = async () => {
    const land = desc.viewport;
    const upright = { width: land.height, height: land.width };
    const [side, up] = land.width > land.height ? [land, upright] : [upright, land];
    await mp.setViewportSize(side);
    await mp.goto(`${base}r/SHOTL?seed=${seed}${tq}&net=off`);
    await mp.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
    await mp.evaluate(() => document.fonts.ready);
    await mp.waitForTimeout(800);
    await tapHud('join');
    await mp.waitForTimeout(400);
    // The name prompt only comes the first time this browser sits down.
    if ((await menuOpen(mp)) === 'name') {
      await pressMenu(mp, 'keep', 'tap');
      await mp.waitForTimeout(300);
    }
    const bad: string[] = [];
    for (let n = 1; n <= 8; n++) {
      if (n > 1) await mp.evaluate((dev) => (window as any).slagDebug.match.join(dev), `pad${n - 2}`);
      // Someone ready shows the other status: the second seat readies up.
      if (n === 2) await mp.evaluate(() => ((window as any).slagDebug.match.players[1].ready = true));
      for (const [o, vp] of [
        ['side', side],
        ['upright', up],
      ] as const) {
        await mp.setViewportSize(vp);
        await mp.waitForTimeout(250);
        if (o === 'upright' && (await mp.isVisible('.slag-rotate button'))) {
          await mp.tap('.slag-rotate button');
          await mp.waitForTimeout(250);
        }
        if ([1, 4, 5, 8].includes(n)) await shotM(`lobby-${n}p-${o}`);
        await checkTargets(`lobby ${n}p ${o}`);
        bad.push(...(await overlaps(`lobby ${n}p ${o}`)));
        // Everyone ready: Start shows under the bays, offline here and at the room panel's end hosting below.
        const allReady = [2, 5, 8].includes(n);
        if (allReady) {
          await mp.evaluate(() => (window as any).slagDebug.match.players.forEach((p: any) => (p.ready = true)));
          await mp.waitForTimeout(250);
          if (!(await mp.evaluate(() => (window as any).slagDebug.renderer.hud.canStart))) bad.push(`lobby ${n}p ${o}: no Start with everyone ready`);
          if ([2, 8].includes(n)) await shotM(`lobby-${n}p-${o}-ready`);
          await checkTargets(`lobby ${n}p ${o} ready`);
          bad.push(...(await overlaps(`lobby ${n}p ${o} ready`)));
        }
        // Hosting online, staged on a paused frame: the room panel takes height, our card gains Watch, everyone else's a Kick.
        await mp.evaluate(() => {
          const d = (window as any).slagDebug;
          d.pause(true);
          const m = d.match;
          const hud = d.renderer.hud;
          // Only our own seat plays on this screen. (An arrow in an array: the bundler names one in a property with a __name the page lacks.)
          hud.shotDevices ??= hud.devices;
          hud.devices = { ...hud.shotDevices, isLocal: [(dev: string) => dev === 'touch'][0] };
          hud.net = {
            status: `Hosting · ${m.players.length + 1} Connected`,
            seat: 'seated',
            space: 8 - m.players.length,
            inviteUrl: 'x',
            hostSlot: 0,
            kickable: m.players.slice(1).map((p: any) => p.slot),
            watchers: [{ peer: 'w0', name: 'Gawker', afk: false, self: false, kickable: true }],
            peers: m.players.map((p: any, i: number) => ({ name: p.character.name, isHost: i === 0, local: i === 0, pingMs: i ? 30 + i * 25 : undefined })),
          };
          d.render();
        });
        const online = `lobby-${n}p-${o}-online${allReady ? '-ready' : ''}`;
        if ([1, 4, 5, 8].includes(n) || (allReady && n === 2)) await shotM(online);
        await checkTargets(online);
        bad.push(...(await overlaps(online)));
        await mp.evaluate(() => {
          const d = (window as any).slagDebug;
          d.renderer.hud.devices = d.renderer.hud.shotDevices;
          // Back to one seat ready (the second), as the next count expects.
          d.match.players.forEach((p: any, i: number) => (p.ready = i === 1));
          d.pause(false);
        });
      }
    }
    await mp.setViewportSize(land);
    if (bad.length) throw new Error(bad.join('\n'));
  };

  if (opt('only') === 'lobby') {
    await crowdedLobby();
    await ctx.close();
    return;
  }

  await mp.goto(`${base}r/SHOTS?seed=${seed}${tq}&net=off`);
  await mp.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await mp.evaluate(() => document.fonts.ready);
  await mp.waitForTimeout(800);
  await shotM('lobby');
  await checkTargets('lobby');
  // Settings: one sheet per tab, then back out.
  await tapHud('settings');
  await waitMenu(mp, 'settings');
  await mp.waitForTimeout(300);
  await shotM('settings');
  await pressMenu(mp, (c) => c.id.startsWith('tab:') && !c.on, 'tap');
  await mp.waitForTimeout(200);
  await shotM('settings-video');
  const smallest = Math.min(...(await menuControls(mp)).filter((c) => !c.disabled).map((c) => Math.min(c.w, c.h)));
  console.log(`settings: smallest button ${smallest.toFixed(1)} CSS px`);
  // The sheet fills the phone and keeps every control on screen, clear of the notch.
  const view = await mp.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const off = (await menuControls(mp)).filter((c) => c.x < 0 || c.y < 0 || c.x + c.w > view.w + 0.5 || c.y + c.h > view.h + 0.5);
  if (off.length) throw new Error(`settings: controls off screen: ${off.map((c) => c.id).join(', ')}`);
  await pressMenu(mp, 'f:done', 'tap');
  await mp.waitForTimeout(200);
  // Join by tapping the first open slot, then dismiss the name prompt.
  await tapHud('join');
  await waitMenu(mp, 'name');
  await mp.waitForTimeout(400);
  await shotM('name');
  // The name screen's swatches and buttons are thumb targets too.
  const nameMin = Math.min(...(await menuControls(mp)).filter((c) => c.id !== 'name').map((c) => Math.min(c.w, c.h)));
  console.log(`name: smallest target ${nameMin.toFixed(1)} CSS px`);
  if (nameMin < 43.9) throw new Error(`name: a swatch or button under 44 CSS px (${nameMin.toFixed(1)})`);
  await pressMenu(mp, 'keep', 'tap');
  await mp.waitForTimeout(300);
  await shotM('lobby-joined');
  await checkTargets('lobby-joined');
  // Solo on purpose: the close follow only exists with one player in the match.
  await tapHud('ready');
  await mp.waitForTimeout(300);
  await tapHud('start');
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
  // Hold the self-destruct button through the 3, 2, 1 (POP_HOLD is 3 s), standing still, and let go on 1: the rings
  // and the countdown show, and letting go cancels.
  const charge = () =>
    mp.evaluate(() => {
      const m = (window as any).slagDebug.match;
      const slot = m.players.find((q: any) => q.device === 'touch').slot;
      return m.run.runners.find((q: any) => q.slot === slot).pop as number;
    });
  await touch('touchStart', [{ x: L.pop.x, y: L.pop.y, id: 3 }]);
  let mid = 0;
  for (const [n, at] of [
    [3, 20],
    [2, 80],
    [1, 140],
  ]) {
    // Real time runs slow under software GL: wait on the sim, not the clock.
    await mp.waitForFunction(
      (k) => {
        const m = (window as any).slagDebug.match;
        const slot = m.players.find((q: any) => q.device === 'touch').slot;
        return m.run.runners.find((q: any) => q.slot === slot).pop >= k;
      },
      at,
      { timeout: 30_000, polling: 'raf' },
    );
    // Paused for the shot, which takes longer than the rest of the hold would.
    await mp.evaluate(() => (window as any).slagDebug.pause(true));
    mid = await charge();
    await shotM(`race-pop-${n}`);
    if (n === 1) await touch('touchEnd', []);
    await mp.evaluate(() => (window as any).slagDebug.pause(false));
  }
  await mp.waitForTimeout(100);
  const after = await runner();
  console.log('self-destruct charge on 1', mid, 'after letting go', await charge(), JSON.stringify(after));
  if (!mid || !after?.alive) throw new Error('a hold of the self-destruct button let go on 1 should charge and then cancel');
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
  await crowdedLobby();
  await ctx.close();
}

export const shots: Scenarios = {
  mobile: () => mobile(opt('device', 'iPhone 13 landscape')!),
};
