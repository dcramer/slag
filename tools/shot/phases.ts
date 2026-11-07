/** The match phases as players see them: lobby, pick, place, race and the round score. */
import { addParts, frames, open, opt, page, players, secret, secretRule, seed, snap, step, type Scenarios, flag } from './ctx';

export const shots: Scenarios = {
  async lobby() {
    await open(`seed=${seed}`);
    await page.evaluate((n) => {
      const d = (window as any).slagDebug;
      for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'].slice(0, n)) d.match.join(dev);
    }, players);
    // `--bots 2`: that many built-in bots take the next seats (they ready themselves), at Easy, Normal, Hard in turn.
    await page.evaluate(
      (n) => {
        const d = (window as any).slagDebug;
        // Levels cycle Easy, Normal, Hard so the shot shows each card.
        for (let i = 0; i < n; i++) d.addBot((['easy', 'normal', 'hard'] as const)[i % 3]);
        // The live loop sets this each frame and shots pause it: the first open bay offers a bot, as it does to a seated host.
        d.renderer.hud.canAddBots = true;
      },
      Number(opt('bots') ?? 0),
    );
    // `--ready`: everyone seated readies, and Start shows, as it does to whoever may press it (offline, or the host).
    const ready = flag('ready');
    if (ready) await page.evaluate(() => (window as any).slagDebug.match.players.forEach((p: any) => (p.ready = true)));
    await step(30);
    if (ready)
      await page.evaluate(() => {
        const d = (window as any).slagDebug;
        d.renderer.hud.canStart = d.match.canStart();
        d.render();
      });
    await snap(`lobby-${seed}${ready ? '-ready' : ''}`);
  },
  async pick() {
    await open(`seed=${seed}&players=${players}`);
    await secretRule();
    await addParts();
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
  },
  async place() {
    await open(`seed=${seed}&players=${players}`);
    await secretRule();
    await addParts();
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
    // `--cursor x,y` aims the first player's ghost (view px, before place starts); `--then-race N` places it and shoots the race N frames in.
    await page.evaluate(
      (at) => {
        if (at) (window as any).slagDebug.match.players[0].cursor = { x: at[0], y: at[1] };
      },
      opt('cursor')?.split(',').map(Number) ?? null,
    );
    await step(60);
    // `--cell x,y` aims the first player's ghost at that level cell (the ghost's middle), once place has begun.
    const cell = opt('cell')?.split(',').map(Number);
    if (cell) {
      await page.evaluate((c) => {
        const p = (window as any).slagDebug.match.players[0];
        p.cursor = { x: (c[0] + 0.5) * 16, y: (c[1] + 0.5) * 16 };
      }, cell);
      await step(2);
    }
    await snap(`place-${seed}${secret ? '-secret' : ''}${cell ? `-${cell.join('-')}` : ''}`);
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
  },
  async race() {
    // `?race=,` races the level as it stands (no parts but its set pieces); `?race=` alone would sit in pick.
    const race = opt('race') || ',';
    // `--bots N` seats bots first, and with `--players 0` they race alone.
    await open(`seed=${seed}&players=${players}&race=${race}&propseed=${opt('propseed', '1')}${opt('bots') ? `&bots=${opt('bots')}` : ''}`);
    // `--bout N`: play the bouts before it out (the runners as they are: bots, or players standing still) into bout N's race.
    const bout = Number(opt('bout', '1'));
    if (bout > 1) {
      const got = await page.evaluate((n) => {
        const d = (window as any).slagDebug;
        for (let f = 0; f < 600 && !(d.match.phase === 'run' && d.match.bout >= n); f++) d.step(30);
        return d.match.phase === 'run' ? d.match.bout : -1;
      }, bout);
      if (got !== bout)
        throw new Error(`never reached bout ${bout} (the rules give ${await page.evaluate(() => (window as any).slagDebug.match.rules.bouts)})`);
      // The HUD's phase wipe runs on the clock, which stood still while the frames were stepped: let it finish.
      await page.waitForTimeout(600);
      await page.evaluate(() => (window as any).slagDebug.render());
    }
    const exact = opt('runframe');
    if (exact) {
      // Boot time decides how far the race got before the pause, so step to the frame rather than by a count.
      const now = await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0);
      await step(Number(exact) - now - 4);
      if (flag('spread')) {
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
      // `--hits 0,2,4`: the runners' build-up (RunnerItems.hits) in turn, as if they'd taken that many rivals' hits.
      const hits = opt('hits')?.split(',').map(Number);
      if (hits)
        await page.evaluate((hs) => {
          (window as any).slagDebug.match.run.runners.forEach((r: any, i: number) => (r.items.hits = hs[i % hs.length]));
        }, hits);
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
      await snap(`race-${seed}${bout > 1 ? `-bout${bout}` : ''}-${exact}`);
      return;
    }
    const pop = Number(opt('pop', '0'));
    if (pop) {
      // `--pop N`: after `--frames`, the first runner (`--popall`: every runner) presses self-destruct and holds it N frames.
      const all = flag('popall');
      await step(frames);
      await page.evaluate(
        ([n, every]) => {
          const d = (window as any).slagDebug;
          const idle = {
            left: false,
            right: false,
            up: false,
            down: false,
            jump: false,
            jumpPressed: false,
            confirmPressed: false,
            altPressed: false,
            downPressed: false,
          };
          const devs: string[] = d.match.players.slice(0, every ? undefined : 1).map((p: any) => p.device);
          // No named helpers in here: the bundler's __name wrapper doesn't exist in the page.
          d.step(1, Object.fromEntries(devs.map((dev) => [dev, { ...idle, alt: true, altPressed: true }])));
          d.step(n - 1, Object.fromEntries(devs.map((dev) => [dev, { ...idle, alt: true }])));
        },
        [pop, all] as const,
      );
      await snap(`race-${seed}-pop${pop}${all ? '-all' : ''}`);
      return;
    }
    for (const f of [frames, 40, 40]) {
      await step(f);
      await snap(`race-${seed}-${await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0)}`);
    }
  },
  async score() {
    await open(`seed=${seed}&players=${players}&race=saw`);
    // Everyone but the leader finishes, the trailing one first and overdue a point, and the second one
    // traps the leader: every award in one round. `--nobody` keeps it scoreless. With no flag (`--game slag|brawl`)
    // they fall in turn instead, the last one standing, and the second one, overdue a point, knocks out the
    // first and the third before falling.
    await page.evaluate((nobody) => {
      const m = (window as any).slagDebug.match;
      const slots = m.players.map((p: any) => p.slot);
      m.players.forEach((p: any, i: number) => (p.score = 6 + i * 6));
      if (!nobody && m.rules.mode !== 'race') {
        m.players[1].scoreless = 2;
        m.run.runners.forEach((r: any, i: number) => {
          if (i < slots.length - 1) Object.assign(r, { alive: false, deathFrame: m.run.frame - 60 + i });
        });
        for (const i of [0, 2]) if (i < slots.length - 1 && i !== 1) m.run.kills.push({ victim: slots[i], killer: slots[1] });
      } else if (!nobody) {
        m.players[0].scoreless = 2;
        m.run.finishOrder = slots.length > 1 ? slots.slice(0, -1) : slots;
        if (slots.length > 2) m.run.kills.push({ victim: slots.at(-1), killer: slots[1] }, { victim: slots.at(-1), killer: slots[1] });
      }
      m.finishRound();
    }, flag('nobody'));
    // Blocks mid-fall, mid-slide, and settled.
    for (const at of [27, 60, 120]) {
      await step(at - (await page.evaluate(() => (window as any).slagDebug.match.phaseFrame)));
      await snap(`score-${seed}-${at}`);
    }
  },
};
