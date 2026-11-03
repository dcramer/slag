/** Whole pages and contact sheets: levels, prop crates, the main menu, rules, settings, the lobby list, About and the codex. */
import { devices } from 'playwright';
import { hoverMenu, menuControl, menuControls, menuOpen, menuOverflow, menuSelected, pressMenu, waitMenu } from '../lib/menu';
import { base, browser, errors, H, mode, open, opt, out, page, pet, seed, sheet, snap, step, theme, W, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async levels() {
    const themes =
      opt('themes') === 'all'
        ? ['farm', 'factory', 'castle', 'jungle', 'volcano', 'harbor', 'mine', 'rooftops', 'glacier', 'space']
        : opt('themes')?.split(',');
    const seeds = opt('seeds')?.split(',') ?? Array.from({ length: themes ? themes.length : Number(opt('count', '9')) }, (_, i) => `lv${i}`);
    const files: string[] = [];
    // The lobby's cards cover most of the view: a contact sheet is for reading level shapes.
    await open(`seed=${seeds[0]}&ui=0`);
    for (let i = 0; i < seeds.length; i++) {
      const th = themes?.[i % themes.length] ?? theme;
      await page.evaluate(([x, t]) => (window as any).slagDebug.loadLevel(x, t || undefined), [seeds[i], th ?? ''] as const);
      await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
      await step(90);
      files.push(await snap(`level-${th ? `${th}-` : ''}${seeds[i]}`));
    }
    await sheet('levels', files);
  },
  async props() {
    const count = Number(opt('count', '18'));
    const files: string[] = [];
    for (let r = 0; r < Math.ceil(count / 6); r++) {
      await open(`seed=${seed}${r}&players=4`);
      await step(40);
      files.push(await snap(`props-${seed}${r}`));
    }
    await sheet('props', files, 2);
  },
  async home() {
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
    await waitMenu(page, 'settings', 15_000);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await snap('home-settings');
    await mctx.close();
  },
  async rules() {
    // Fails the run if the card doesn't fit the window.
    await open(`seed=${seed}`);
    await step(5);
    await page.mouse.click(((768 - 196 + 42) / 768) * W, (28 / 432) * H);
    await waitMenu(page, 'rules', 5000);
    await snap(`rules-${W}x${H}`);
    const over = await menuOverflow(page);
    if (over > 0) throw new Error(`rules card overflows by ${over}px`);
  },
  async settings() {
    // Fails the run if a tab doesn't fit, or an input doesn't do what its prompt says.
    const tabOf = async (p: typeof page) => (await menuControls(p)).find((c) => c.id.startsWith('tab:') && c.on)?.id.slice(4);
    const expectTab = async (p: typeof page, want: string) => {
      await p.waitForTimeout(150);
      if ((await tabOf(p)) !== want) throw new Error(`settings: on tab ${await tabOf(p)}, expected ${want}`);
    };
    const expectFit = async (p: typeof page, label: string) => {
      const over = await menuOverflow(p);
      if (over > 0) throw new Error(`settings: ${label} overflows by ${over}px`);
    };
    // A returning player: no first-visit name prompt opening when the loop resumes, where it would take the pad's Start.
    await page.addInitScript(() => localStorage.setItem('slag.profile.v1', JSON.stringify({ version: 1, name: null, prompted: true })));
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
    await waitMenu(page, 'settings');
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
    await pressMenu(page, 'tab:keyboard');
    await expectTab(page, 'keyboard');
    await pressMenu(page, 'p:split');
    await page.waitForTimeout(100);
    await expectFit(page, 'split keyboard');
    await snap('settings-keyboard-split');
    await pressMenu(page, 'p:split');
    await page.waitForTimeout(100);
    // Rebinding by key: Q is captured as the new key, not read as "previous tab". Selection stays put.
    const selected = () => menuSelected(page);
    const bindings = () => page.evaluate(() => JSON.parse(localStorage.getItem('slag.input.v1') ?? '{}').single?.jump);
    await hoverMenu(page, 'p:split');
    await page.mouse.move(2, 2);
    await presses('ArrowDown', 5);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    if (!String(await selected()).startsWith('Jump, Keys 1')) throw new Error(`settings: arrows landed on ${await selected()}`);
    await snap('settings-keyboard-selection');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).slagUi.controls().some((c: any) => c.label.endsWith('press a key')));
    await snap('settings-keyboard-listen');
    await page.keyboard.press('q');
    await page.waitForTimeout(100);
    await expectTab(page, 'keyboard');
    if ((await bindings())?.[0] !== 'KeyQ') throw new Error(`settings: rebinding saved ${await bindings()}`);
    if (!String(await selected()).startsWith('Jump, Keys 1')) throw new Error(`settings: rebinding moved the selection to ${await selected()}`);
    await pressMenu(page, 'f:reset');
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
    if (await menuOpen(page)) throw new Error('settings: pad B did not close the menu');
    // Opening runs through the game loop's input sampling, which screenshots keep paused.
    await page.evaluate(() => (window as any).slagDebug.pause(false));
    // Hold Start until the menu opens: the live loop under software GL can take longer than a quick tap to sample it.
    await page.evaluate(() => (window as any).slagShotPad.add(9));
    await waitMenu(page, 'settings');
    await page.evaluate(() => (window as any).slagShotPad.delete(9));
    await page.waitForTimeout(120);
    await expectTab(page, 'audio');
    // Closing too: with the loop live, one software-GL frame can outlast a tap, and the menu polls pads once a frame.
    await page.evaluate(() => (window as any).slagShotPad.add(9));
    await waitMenu(page, null).catch(() => {});
    await page.evaluate(() => (window as any).slagShotPad.delete(9));
    if (await menuOpen(page)) throw new Error('settings: pad Start did not close the menu');

    // Saved settings survive a reload. Reopening lands on the tab you left.
    await page.reload();
    await page.waitForFunction(() => 'slagDebug' in window);
    await page.keyboard.press('Escape');
    await waitMenu(page, 'settings');
    const master = (await menuControl(page, 'p:vol:master')).value;
    if (Math.abs((master ?? 0) - 0.9) > 1e-9) throw new Error(`settings: master reloaded as ${master}`);
    await page.keyboard.press('e');
    await page.keyboard.press('Escape');
    await waitMenu(page, null);
    await page.keyboard.press('Escape');
    await waitMenu(page, 'settings');
    await expectTab(page, 'video');

    // The same menu over the main menu: picks persist for the game to read, and no A falls through on Done.
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await page.click('text=SETTINGS');
    await waitMenu(page, 'settings');
    await page.keyboard.press('e');
    await expectTab(page, 'video');
    await page.waitForTimeout(200);
    await pressMenu(page, 'p:quality:low');
    await snap('settings-home');
    const saved = await page.evaluate(() => localStorage.getItem('slag.quality'));
    if (saved !== 'low') throw new Error(`settings: home saved ${saved}`);
    // Tab stays inside the card; the arrows reach Done from the page.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    if ((await menuOpen(page)) !== 'settings' || !(await selected())) throw new Error('settings: Tab left the card');
    await page.keyboard.press('ArrowDown');
    if ((await selected())?.trim().endsWith('Done') !== true) throw new Error(`settings: arrows landed on ${await selected()}`);
    await pad(0);
    await page.waitForTimeout(300);
    if (await menuOpen(page)) throw new Error('settings: pad A on Done left the menu open, or reopened it');

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
      await waitMenu(phone, 'settings');
      for (const tab of ['audio', 'video', 'touch']) {
        await pressMenu(phone, `tab:${tab}`, 'tap');
        await expectTab(phone, tab);
        const small = (await menuControls(phone)).filter((c) => !c.disabled && Math.min(c.w, c.h) < 44).length;
        if (small) throw new Error(`settings: ${small} controls under 44 px on ${name}`);
        await phone.screenshot({ path: `${out}/settings-${name}-${tab}.png` });
        console.log(`${out}/settings-${name}-${tab}.png`);
        pet();
      }
      await ctx.close();
    }
  },
  async codex() {
    // Map cards paint a still the first time they're in view: wait for the ones on screen (or go on after `ms`).
    const drawn = (p: typeof page, ms = 15_000) =>
      p
        .waitForFunction(
          () =>
            [...document.querySelectorAll('.cx-card[data-map] .cx-well')].every((w) => {
              const r = w.getBoundingClientRect();
              return r.bottom < 0 || r.top > innerHeight || w.classList.contains('drawn');
            }),
          null,
          { timeout: ms },
        )
        .catch(() => console.log('codex: some map stills still painting'))
        .finally(pet);
    await page.goto(`${base}codex`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    // Scroll through so lazily-animated cards and map stills paint, then capture the whole page.
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 600) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
      await drawn(page);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const p = `${out}/codex.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(p);
    await snap('codex-top');
    // Open the first part from the keyboard, as a pad or keys would.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await snap('codex-open');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cx-modal[hidden]', { state: 'attached', timeout: 5000 });
    // The maps (`--map <theme>`): its section from the index, its look, a landmark browsed to with the keys, and a hazard.
    const mapTheme = opt('map', 'castle');
    await page.waitForSelector(`.cx-index [data-sec=map-${mapTheme}]`, { timeout: 60_000 });
    await page.click(`.cx-index [data-sec=map-${mapTheme}]`);
    await page.waitForTimeout(400);
    await drawn(page);
    await snap('codex-maps');
    await page.click(`#map-${mapTheme} .cx-card[data-map=theme]`);
    await page.waitForTimeout(1500);
    await snap('codex-map-theme');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    await snap('codex-map-landmark');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cx-modal[hidden]', { state: 'attached', timeout: 5000 });
    await page.click(`#map-${mapTheme} .cx-card[data-map=hazard]`);
    await page.waitForTimeout(1500);
    await snap('codex-map-hazard');
    // Esc closes the close-up, then backs out to the main menu.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.cx-modal[hidden]', { state: 'attached', timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-screen=home]', { timeout: 5000 });
    // A phone: the top of the catalog, a section, a part opened by tap; then a theme's maps and a landmark up close.
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    mp.on('pageerror', (e: Error) => errors.push(String(e)));
    const mshot = async (name: string) => {
      await mp.screenshot({ path: `${out}/${name}.png` });
      console.log(`${out}/${name}.png`);
    };
    /** Every button on screen is a tap target: fails on one under 44 CSS px either way. */
    const taps = async () => {
      const small = await mp.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.codex button')].flatMap((b) => {
          const r = b.getBoundingClientRect();
          const seen = r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
          return seen && (r.width < 44 || r.height < 44) ? [`${b.className || b.dataset.sec} ${Math.round(r.width)}x${Math.round(r.height)}`] : [];
        }),
      );
      if (small.length) throw new Error(`codex: tap targets under 44 CSS px: ${small.join(', ')}`);
    };
    await mp.goto(`${base}codex`);
    await mp.evaluate(() => document.fonts.ready);
    await mp.waitForTimeout(1200);
    await mshot('codex-mobile');
    await taps();
    await mp.tap('.cx-index [data-sec=launchers]');
    await mp.waitForTimeout(800);
    await mshot('codex-mobile-launchers');
    const card = await mp.$('#launchers .cx-card');
    if (card) {
      await card.tap();
      await mp.waitForTimeout(800);
      await mshot('codex-mobile-open');
      await taps();
      await mp.tap('.cx-modal [data-act=close]');
      await mp.waitForTimeout(300);
    }
    // The maps join the index once their registries load, which a busy machine can take a while over.
    await mp.waitForSelector(`.cx-index [data-sec=map-${mapTheme}]`, { timeout: 60_000 });
    await mp.locator(`.cx-index [data-sec=map-${mapTheme}]`).scrollIntoViewIfNeeded();
    await mp.tap(`.cx-index [data-sec=map-${mapTheme}]`);
    await mp.waitForTimeout(600);
    await drawn(mp);
    await mshot('codex-mobile-maps');
    await taps();
    await mp.tap(`#map-${mapTheme} .cx-card[data-map=landmark]`);
    await mp.waitForTimeout(1500);
    await mshot('codex-mobile-landmark');
    await taps();
    await mctx.close();
  },
  /**
   * The Lobbies screen with a made-up list (the API is stubbed, so the shot needs no rooms; one host has no name, one the
   * widest name fits, one a name that is markup and must show as text): the Join filter, Watch, and the empty state
   * on a desktop; then a phone upright and on its side, failing on a tap target under 44 CSS px.
   */
  async lobbies() {
    const ROOMS = [
      { room: 'K7QX2', players: 3, max: 8, observers: 1, theme: 'farm', phase: 'lobby', host: 'Wobblesnout' },
      { room: 'BRRR9', players: 6, max: 8, observers: 0, theme: 'glacier', phase: 'run', host: 'MMMMMMMMMMMM' },
      { room: 'ZAPZAP', players: 1, max: 8, observers: 0, theme: 'space', phase: 'lobby' },
      { room: 'M4GMA', players: 2, max: 8, observers: 3, theme: 'volcano', phase: 'place', host: '<b>Jo</b>' },
      { room: 'PACKED', players: 8, max: 8, observers: 2, theme: 'castle', phase: 'pick', host: 'Dot' },
      { room: 'CRAMMD', players: 8, max: 8, observers: 0, theme: 'harbor', phase: 'score', host: 'Grimble' },
    ];
    let rooms = ROOMS;
    const stub = (p: typeof page) =>
      p.route('**/api/net/lobbies', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms }) }));
    await stub(page);
    await page.goto(`${base}lobbies`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('.lb-row');
    await page.waitForTimeout(600);
    await snap('lobbies');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('e');
    await page.waitForSelector('.lb-tab[data-filter=watch][aria-selected=true]');
    await page.waitForTimeout(200);
    await snap('lobbies-watch');
    rooms = [];
    await page.goto(`${base}lobbies`);
    await page.waitForSelector('.lobbies[data-state=empty]');
    await page.waitForTimeout(400);
    await snap('lobbies-empty');
    // Esc leaves for the main menu, and the menu's Lobbies item comes back here.
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-screen=home] .menu-item:not([disabled])');
    await page.click('[data-id=lobbies]');
    await page.waitForSelector('[data-screen=lobbies]');
    rooms = ROOMS;
    for (const d of ['iPhone 13', 'iPhone SE landscape']) {
      const { defaultBrowserType: _ignored, ...desc } = devices[d];
      const ctx = await browser.newContext(desc);
      const mp = await ctx.newPage();
      mp.on('pageerror', (e: Error) => errors.push(String(e)));
      await stub(mp);
      await mp.goto(`${base}lobbies`);
      await mp.evaluate(() => document.fonts.ready);
      await mp.waitForSelector('.lb-row');
      await mp.waitForTimeout(500);
      const small = await mp.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('[data-screen=lobbies] button')]
            .filter((b) => b.offsetParent !== null)
            .map((b) => b.getBoundingClientRect())
            .filter((r) => r.width < 44 || r.height < 44).length,
      );
      if (small) throw new Error(`lobbies: ${small} tap targets under 44 px on ${d}`);
      const name = `${out}/lobbies-${d.toLowerCase().replaceAll(/\W+/g, '-')}.png`;
      await mp.screenshot({ path: name, fullPage: true });
      console.log(name);
      pet();
      await ctx.close();
    }
  },
  /** About, reached from the main menu by keys; then a phone upright and on its side, failing on a tap target under 44 CSS px. */
  async about() {
    await page.goto(base);
    await page.waitForSelector('[data-screen=home] .menu-item:not([disabled])');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-screen=about]');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await snap('about');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await snap('about-license');
    // Esc leaves for the main menu.
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-screen=home]');
    for (const d of ['iPhone 13', 'iPhone SE landscape']) {
      const { defaultBrowserType: _ignored, ...desc } = devices[d];
      const ctx = await browser.newContext(desc);
      const mp = await ctx.newPage();
      mp.on('pageerror', (e: Error) => errors.push(String(e)));
      await mp.goto(`${base}about`);
      await mp.evaluate(() => document.fonts.ready);
      await mp.waitForTimeout(500);
      const small = await mp.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('[data-screen=about] :is(a, button)')]
            .filter((b) => b.offsetParent !== null)
            .map((b) => b.getBoundingClientRect())
            .filter((r) => r.width < 44 || r.height < 44).length,
      );
      if (small) throw new Error(`about: ${small} tap targets under 44 px on ${d}`);
      const name = `${out}/about-${d.toLowerCase().replaceAll(/\W+/g, '-')}.png`;
      await mp.screenshot({ path: name, fullPage: true });
      console.log(name);
      pet();
      await ctx.close();
    }
  },
  /** The 404 and error screens, on a desktop and a phone. The error screen is forced by refusing the codex's code. */
  async screens() {
    const sizes = [
      { name: 'desktop', viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
      { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    ];
    for (const s of sizes) {
      const { name, ...opts } = s;
      const ctx = await browser.newContext(opts);
      const p = await ctx.newPage();
      p.on('pageerror', (e: Error) => errors.push(String(e)));
      await p.goto(`${base}no/such/place`);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/missing-${name}.png` });
      console.log(`${out}/missing-${name}.png`);
      // MAIN MENU is selected from the start: Enter (or a tap) leaves.
      if (opts.hasTouch) await p.tap('.btn-link');
      else await p.keyboard.press('Enter');
      await p.waitForSelector('[data-screen=home]', { timeout: 10_000 });
      // The error screen: the codex can't load, as on a dropped connection mid-deploy. That logs errors on purpose, so they aren't collected.
      const ep = await ctx.newPage();
      await ep.goto(base);
      await ep.evaluate(() => document.fonts.ready);
      await ep.waitForSelector('.menu-item:not([disabled])');
      await ep.route('**/_next/static/chunks/**', (r) => r.abort());
      await ep.click('[data-id=codex]');
      await ep.waitForSelector('[data-screen=error]', { timeout: 15_000 });
      await ep.waitForTimeout(1200);
      await ep.screenshot({ path: `${out}/error-${name}.png` });
      console.log(`${out}/error-${name}.png`);
      pet();
      await ctx.close();
    }
  },
};
