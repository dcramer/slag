/** A flood (stage concepts) let into a level, shot where its crest kills: warning, rising and held. */
import { open, opt, page, players, seed, sheet, snap, step, type Scenarios } from './ctx';

export const shots: Scenarios = {
  /**
   * `pnpm shot flood [--look lava|toxic|water] [--low 2] [--high 5]`: a tide across the whole level, with
   * runners standing at heights around its range. Shot full and close up at mid-warning, either side of the rising crest taking the first runner, and high water.
   */
  async flood() {
    const look = opt('look', 'lava')!;
    await open(`seed=${seed}&players=${Math.max(players, 4)}&lettering=0`);
    await step(2);
    const plan = await page.evaluate(
      ([lk, low, high]) => {
        const d = (window as any).slagDebug;
        const m = d.match;
        const lv = m.level;
        const fm = { type: 'flood', look: lk, at: [0, lv.h], w: lv.w, low, high, off: 120, warn: 90, rise: 120, hold: 240, fall: 120 };
        const footprint: number[][] = [];
        for (let y = lv.h - Math.ceil(high); y < lv.h; y++) for (let x = 0; x < lv.w; x++) footprint.push([x, y]);
        const style = { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 };
        const def = {
          key: 'flood',
          name: 'flood',
          maker: 'the level',
          archetype: 'flamer',
          role: 'hazard',
          style,
          motion: { type: 'none' },
          modules: [fm],
          footprint,
        };
        lv.setPieces = [...lv.setPieces, { uid: 7777, def, owner: -1, tx: 0, ty: 0, rot: 0 }];
        d.race([], 1);
        const run = m.run;
        // Stand runners on ground just under, in and just over the flood's range, away from the spawn.
        const wants = [high - 1.5, high - 0.5, high + 1, low + 1];
        const spots: number[][] = [];
        run.runners.forEach((_: unknown, i: number) => {
          let best: number[] | null = null;
          let bestErr = 1e9;
          for (let y = 1; y < lv.h; y++)
            for (let x = 2; x < lv.w - 2; x++) {
              if (lv.tiles[y * lv.w + x] !== 1 || lv.tiles[(y - 1) * lv.w + x] !== 0) continue;
              if (Math.abs(x - lv.spawn.tx) < 4 || spots.some((u) => Math.abs(u[0] - x) < 3)) continue;
              const err = Math.abs(lv.h - y - wants[i % wants.length]);
              if (err < bestErr) {
                bestErr = err;
                best = [x, y];
              }
            }
          if (best) spots.push(best);
        });
        const rp = run.resolved.find((p: any) => p.pp.uid === 7777);
        const lens = [fm.off, fm.warn, fm.rise, fm.hold, fm.fall];
        const total = lens.reduce((x, y) => x + y, 0);
        const shift = Math.floor(rp.phase * total);
        // Mid-warning, the frames either side of the rising crest taking the first runner, and high water.
        let warn = (((Math.floor(lens[0] + 0.6 * lens[1]) - shift) % total) + total) % total;
        while (warn < run.frame + 70) warn += total;
        // One cycle of surface heights from there, in tiles: floodState's arithmetic (the page can't import it, or name a helper).
        const hs: number[] = [];
        for (let i = 0; i < total; i++) {
          let t = (((warn + i + shift) % total) + total) % total;
          let seg = 0;
          while (t >= lens[seg]) t -= lens[seg++];
          const u = t / lens[seg];
          const e = u * u * (3 - 2 * u);
          hs.push(seg === 2 ? low + (high - low) * e : seg === 3 ? high : seg === 4 ? high - (high - low) * e : low);
        }
        const r0h = run.runners[0].body.h;
        const feet = spots.length ? lv.h - spots[0][1] : (low + high) / 2;
        // Lava and toxic take you as the crest passes your feet (hitboxes are inset 1.5 px); water once it's over your head.
        const reach = (lk === 'water' ? r0h : 1.5) / 16;
        let kill = 0;
        while (kill < total - 1 && hs[kill] <= feet + reach) kill++;
        let hold = kill;
        while (hold < total - 1 && hs[hold] !== high) hold++;
        return { frames: [warn, warn + kill, warn + kill + 1, warn + hold + 60], spots, w: lv.w, h: lv.h, now: run.frame };
      },
      [look, Number(opt('low', '2')), Number(opt('high', '5'))] as const,
    );
    console.log(`runners at ${JSON.stringify(plan.spots)}; frames ${plan.frames.join(',')}`);
    const files: string[] = [];
    let now = plan.now;
    const [sx, sy] = plan.spots[0] ?? [plan.w / 2, plan.h - 4];
    // Pinned views: the whole level, and close on the first runner.
    const view = (v: number[]) =>
      page.evaluate((c) => {
        const d = (window as any).slagDebug;
        const cam = d.renderer.cam;
        cam.update = () => {};
        cam.snap({ cx: c[0], cy: c[1], zoom: c[2] });
        cam.shake = 0;
        d.render();
      }, v);
    const whole = [plan.w * 8, plan.h * 8, Math.min(768 / (plan.w * 16), 432 / (plan.h * 16))];
    for (const f of plan.frames) {
      await view(whole);
      await step(f - now);
      now = f;
      // They wait in the spawn until the flood is down, then stand still: it comes to them.
      if (f === plan.frames[0])
        await page.evaluate((ss) => {
          const d = (window as any).slagDebug;
          d.match.run.runners.forEach((r: any, i: number) => {
            if (!ss[i]) return;
            r.body.x = ss[i][0] * 16 + (16 - r.body.w) / 2;
            r.body.y = ss[i][1] * 16 - r.body.h;
            r.body.vx = r.body.vy = 0;
          });
          d.step(1);
        }, plan.spots);
      if (f === plan.frames[0]) now = f + 1;
      const state = await page.evaluate(() => {
        const run = (window as any).slagDebug.match.run;
        const beam = run.beams.find((b: any) => b.uid === 7777);
        return {
          crestY: run.level.h * 16 - beam.len,
          runners: run.runners.map((r: any) => (r.alive ? `feet ${r.body.y + r.body.h}` : `${r.cause} @${r.deathFrame}`)),
        };
      });
      console.log(`frame ${f}: crest y ${state.crestY.toFixed(2)}; runners ${state.runners.join(', ')}`);
      files.push(await snap(`flood-${look}-${seed}-${f}`));
      await view([sx * 16 + 8, sy * 16 - 8, 4]);
      files.push(await snap(`flood-${look}-${seed}-${f}-close`));
    }
    await sheet(`flood-${look}-${seed}`, files, 2);
  },
};
