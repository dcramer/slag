/** The match phases as players see them: lobby, pick, place, race and the round score. */
import { addParts, argv, frames, open, opt, page, players, secret, secretRule, seed, snap, step, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async lobby() {
    await open(`seed=${seed}`);
    await page.evaluate((n) => {
      const d = (window as any).slagDebug;
      for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'].slice(0, n)) d.match.join(dev);
    }, players);
    await step(30);
    await snap(`lobby-${seed}`);
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
  },
  async race() {
    // `?race=,` races the level as it stands (no parts but its set pieces); `?race=` alone would sit in pick.
    const race = opt('race') || ',';
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
      return;
    }
    for (const f of [frames, 40, 40]) {
      await step(f);
      await snap(`race-${seed}-${await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0)}`);
    }
  },
  async score() {
    await open(`seed=${seed}&players=${players}&race=saw`);
    await page.evaluate(() => {
      const m = (window as any).slagDebug.match;
      m.players.forEach((p: any, i: number) => (p.score = 6 + i * 7));
      m.finishRound();
    });
    await step(100);
    await snap(`score-${seed}`);
  },
};
