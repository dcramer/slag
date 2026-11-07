/** Stepped frames of play, where motion and contact can only be judged frame by frame. */
import { ITEM_KINDS } from '../../src/sim/items/types';
import { open, opt, out, page, players, seed, sheet, snap, step, tq, type Scenarios, flag } from './ctx';

export const shots: Scenarios = {
  async grabs() {
    // Swing, keg shot, backfire and the slingshot as stepped frames: motion can't be judged from a single still.
    await open(`seed=${seed}&players=1&race=rope,rope,keg,keg,fling&propseed=${opt('propseed', '1')}`);
    await step(70);
    const [vw] = [page.viewportSize()!.width];
    const k = vw / 768;
    const go = (type: string, vx: number): Promise<[number, number]> =>
      page.evaluate(
        ([t, v]) => {
          const run = (window as any).slagDebug.match.run;
          // A slingshot is a keg with a player's aim.
          const sling = t === 'fling';
          const m = run.resolved.find((r: any) => r.mods[0].type === (sling ? 'keg' : t) && (r.mods[0].aim === 'player') === sling).mods[0];
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
    // The slingshot: run in holding right (the rest aim stays), point up-left, then up-right and fire
    // holding it through the flight; then a second sit left alone until the band shivers and snaps.
    const fling: string[] = [];
    const yf = await go('fling', 215);
    const ur = { right: true, up: true };
    for (const [n, inp] of [
      [3, { right: true, run: true }],
      [12, { left: true, up: true }],
      [30, { left: true, up: true }],
      [20, ur],
    ] as const) {
      await press(n, inp);
      await crop(`grabs-fling-${String(fling.length).padStart(2, '0')}`, yf, fling);
    }
    await press(1, { ...ur, jump: true, jumpPressed: true });
    for (const n of [3, 5, 6, 8, 10, 14]) {
      await press(n, ur);
      await crop(`grabs-fling-${String(fling.length).padStart(2, '0')}`, yf, fling);
    }
    await press(400, {});
    const burn = await page.evaluate(() => (window as any).slagDebug.match.run.resolved.find((r: any) => r.mods[0].aim === 'player').mods[0].burn as number);
    await go('fling', 0);
    let held = 0;
    for (const t of [burn - 60, burn - 30, burn - 12, burn - 4, burn + 6, burn + 30]) {
      await press(t - held, {});
      held = t;
      await crop(`grabs-fling-${String(fling.length).padStart(2, '0')}`, yf, fling);
    }
    await sheet(`grabs-fling-${seed}`, fling, 4);
  },
  async lineup() {
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
  },
  async stack() {
    // Body contact as stepped frames. A head is a perch, not ground: three runners stack and the bottom one's jump bucks
    // them off; then one rider at a time slides off an off-centre perch, is thrown forward by a hard stop, is knocked
    // off the back by a base walking away, tips off a still base, and jumps off a head.
    await open(`seed=${seed}&players=4&race=mystery&propseed=${opt('propseed', '1')}`);
    await step(190);
    const spot = await page.evaluate(() => {
      const run = (window as any).slagDebug.match.run;
      const L = run.level;
      for (let ty = 8; ty < L.h - 2; ty++) {
        for (let tx = 4; tx < L.w - 16; tx++) {
          const clear = [...Array(10).keys()].every(
            (dx) => L.tiles[(ty + 1) * L.w + tx + dx] === 1 && [0, 1, 2, 3, 4, 5, 6, 7].every((dy) => L.tiles[(ty - dy) * L.w + tx + dx] === 0),
          );
          if (!clear) continue;
          const x = (tx + 4) * 16 + 3;
          const feet = (ty + 1) * 16;
          run.runners.forEach((r: any, i: number) => {
            r.body.x = x;
            r.body.y = feet - r.body.h - i * 26;
            r.body.vx = r.body.vy = 0;
            r.body.onGround = false;
            r.body.groundRef = -1;
          });
          return [x, feet - 40, (tx + 1) * 16];
        }
      }
      throw new Error('no open floor for a stack');
    });
    const zk = page.viewportSize()!.width / 768;
    const crop = async (name: string, files: string[]) => {
      // The camera drifts and zooms during a race, so ask it where the stack landed on screen.
      const cam = await page.evaluate(() => {
        const d = (window as any).slagDebug;
        return { x: d.renderer.cam.x, y: d.renderer.cam.y, zoom: d.renderer.cam.zoom };
      });
      const [w, h] = [300 * zk, 200 * zk];
      const size = page.viewportSize()!;
      const px = ((spot[0] - cam.x) * cam.zoom + 384) * zk;
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
          .map((r: any) => `#${r.slot} x=${r.body.x.toFixed(1)} y=${r.body.y.toFixed(1)} ride=${r.ride} perch=${r.perch}`)
          .join('  '),
      );
    const frames: string[] = [];
    const shoot = async (label: string) => {
      await crop(`stack-${String(frames.length).padStart(2, '0')}-${label}`, frames);
      console.log(label, await rows());
    };
    /** Runner 0 back on the floor at the spot, runner 1 just over its head `off` px right of centre, the other two parked to the left. */
    const perch = (off: number) =>
      page.evaluate(
        ([[x, , park], o]) => {
          const run = (window as any).slagDebug.match.run;
          const feet = run.runners[0].body.y + run.runners[0].body.h;
          run.runners.forEach((r: any, i: number) => {
            const b = r.body;
            b.x = i === 0 ? x : i === 1 ? x + o : park + (i - 2) * 14;
            b.y = i === 1 ? feet - 2 * b.h - 2 : feet - b.h;
            b.vx = b.vy = 0;
            b.onGround = i !== 1;
            b.groundRef = i === 1 ? -1 : -2;
            r.perch = 0;
          });
        },
        [spot, off] as const,
      );
    const jump = { jump: true, jumpPressed: true };
    // Runners 1..3 fall onto runner 0 and stack, dead centre.
    await press(4, {});
    await shoot('falling');
    await press(36, {});
    await shoot('stacked');
    // The bottom jumps: everyone above is bucked up and off, a pop rather than a lift.
    await press(1, { kb1: jump });
    await press(4, { kb1: { jump: true } });
    await shoot('bucked');
    await press(10, { kb1: { jump: true } });
    await shoot('bucked-apex');
    await press(40, {});
    await shoot('spilled');
    // A rider 3 px off centre slides off the rounded top toward its side.
    await perch(3);
    await press(6, {});
    await shoot('off-centre');
    await press(12, {});
    await shoot('sliding');
    await press(14, {});
    await shoot('slid-off');
    // Base and rider walk together; the base stops hard and the rider flies on.
    await perch(0);
    await press(6, {});
    await press(24, { kb1: { right: true }, kb2: { right: true } });
    await shoot('walking-together');
    await press(4, { kb2: { right: true } });
    await shoot('hard-stop');
    await press(10, { kb2: { right: true } });
    await shoot('thrown-forward');
    // The base walks off from under a rider standing still: it's left behind, knocked off the back.
    await perch(0);
    await press(6, {});
    await press(4, { kb1: { right: true } });
    await shoot('walked-out');
    await press(10, { kb1: { right: true } });
    await shoot('knocked-back');
    // Dead centre on a base standing still: a moment, then it tips.
    await perch(0);
    await press(56, {});
    await shoot('held');
    await press(10, {});
    await shoot('tipped');
    // Jumping off a head still works.
    await perch(1);
    await press(6, {});
    await press(1, { kb2: jump });
    await press(10, { kb2: { jump: true } });
    await shoot('jump-off');
    await sheet(`stack-${seed}`, frames, 4);
  },
  async items() {
    // Every item in hand, then everyone uses theirs at once: one frame set per moment worth looking at.
    // `--give bat,tax` picks the items (default all, cycled over the runners); one of each lies loose too.
    // `--close` stages one item up close instead: its user, one rival beside them, and crops around the action;
    // `--gap 6` stands the rival that many tiles off, for what reaches (the clock, the rod).
    const give = opt('give', 'all')!;
    const close = flag('close');
    const gap = Number(opt('gap', '0'));
    const n = close ? 2 : 6;
    await open(`seed=${seed}&players=${n}&race=mystery,mystery,mystery&give=${give}&propseed=${opt('propseed', '1')}`);
    await step(190);
    // Spread the runners along open ground, with one loose item of each kind beside them.
    await page.evaluate(
      ([list, near, off]) => {
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
        // With a gap, the first spot whose floor carries on that far at the same height, unbroken, so the rival stands level.
        // (No named helpers in here: the page has no __name for them.)
        const first = off
          ? Math.max(
              0,
              spots.findIndex(([x, y]) => {
                for (let k = 0; k <= off; k++)
                  if (L.tiles[y * L.w + x + k] !== 1 || L.tiles[(y - 1) * L.w + x + k] || L.tiles[(y - 2) * L.w + x + k]) return false;
                return true;
              }),
            )
          : 0;
        run.runners.forEach((r: any, i: number) => {
          const [tx, ty] = spots[near ? first : Math.floor((i * spots.length) / run.runners.length)];
          // Up close, the rival stands just in front (behind, for a block, so the floor ahead is free).
          r.body.x = tx * 16 + 2 + (near && i === 1 ? (list === 'block' ? -18 : off ? off * 16 : 14) : 0);
          r.body.y = ty * 16 - r.body.h;
          r.body.vx = r.body.vy = 0;
          r.body.facing = near && i === 1 ? -1 : 1;
          if (near && i === 1) r.items.held = null;
        });
        const kinds = list.split(',');
        kinds.forEach((kind, i) => {
          const [tx, ty] = spots[(Math.floor((i * spots.length) / kinds.length) + 1) % spots.length];
          run.items.drops.push({ id: 90 + i, kind, uses: 1, x: tx * 16 + 8, y: ty * 16 - 6, vx: 0, vy: 0, born: run.frame, grace: 600, onGround: false });
        });
      },
      [(give === 'all' ? ITEM_KINDS : give.split(',')).join(','), close, gap] as const,
    );
    const shot = async (name: string) => {
      if (!close) {
        await snap(`items-${seed}-${name}`);
        return;
      }
      // Crop round the action: the shell if one is flying, else the two runners.
      const r = await page.evaluate(() => {
        const d = (window as any).slagDebug;
        const run = d.match.run;
        const c = d.renderer.cam;
        const sh = run.items.shells[0];
        const [a, b] = run.runners;
        const x = sh ? sh.x : (a.body.x + b.body.x) / 2 + 5;
        const y = sh ? sh.y + 20 : a.body.y;
        return { x: (x - c.x) * c.zoom + 384, y: (y - c.y) * c.zoom + 216, zoom: c.zoom };
      });
      const size = page.viewportSize()!;
      const k = size.width / 768;
      const w = 200 * r.zoom * k;
      const h = 120 * r.zoom * k;
      const path = `${out}/items-${seed}-${give}-${name}.png`;
      await page.screenshot({
        path,
        clip: { x: Math.min(size.width - w, Math.max(0, r.x * k - w / 2)), y: Math.min(size.height - h, Math.max(0, r.y * k - h / 2)), width: w, height: h },
      });
      console.log(path);
    };
    await step(20);
    await shot('held');
    const use = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3'].slice(0, close ? 1 : n);
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
    await shot('swing');
    await step(4);
    await shot('use');
    // The brick comes down, a full bat wind-up lets go, and the tax hovers over the leader and dives.
    await step(7);
    await shot('slam');
    await step(22);
    await shot('wound');
    await step(11);
    await shot('after');
    await step(52);
    await shot('later');
    await step(30);
    await shot('dive');
    await step(30);
    await shot('last');
    // A Pocket Block cracking just before it crumbles.
    await step(70);
    await shot('crumble');
  },
  async climb() {
    // Rising Slag's own items and its Leg Days (docs/MODES.md → Rising Slag), on a shaft (`--game slag`, any `--theme`):
    // four runners up a column of ledges, the top one pouring a Slippery Slope, the third hooking a Social Climber, the
    // second stamping a Trickle-Down on those under it, then a Leg Day taken, with the view pinned on each.
    await open(`seed=${seed}&players=4&race=,`);
    await step(200);
    const lv = await page.evaluate(() => {
      const L = (window as any).slagDebug.match.run.level;
      return { w: L.w as number, h: L.h as number, tiles: Array.from(L.tiles as Uint8Array), loop: (L.loop ?? 0) as number };
    });
    const at = (x: number, y: number) => (x < 0 || x >= lv.w || y < 0 || y >= lv.h ? 1 : lv.tiles[y * lv.w + x]);
    const stands = (x: number, y: number) => at(x, y) === 0 && at(x, y - 1) === 0 && (at(x, y + 1) === 1 || at(x, y + 1) === 2);
    // A column of four stand cells, each 4–8 rows under the last, within a few tiles across, from mid-shaft.
    let column: [number, number][] = [];
    for (let x0 = 6; x0 < lv.w - 6 && column.length < 4; x0++) {
      column = [];
      let y = Math.floor(lv.h / 2) - 14;
      let x = x0;
      while (column.length < 4 && y < lv.h - 4) {
        let found: [number, number] | null = null;
        for (let dy = column.length ? 3 : 0; dy <= (column.length ? 8 : 4) && !found; dy++)
          for (const dx of [0, 1, -1, 2, -2, 3, -3]) if (stands(x + dx, y + dy)) found ??= [x + dx, y + dy];
        if (!found) break;
        column.push(found);
        [x, y] = found;
      }
    }
    if (column.length < 4) throw new Error('no column of ledges to stage the climb items on');
    const cam = column[1];
    await page.evaluate(
      ([cells, c]) => {
        const d = (window as any).slagDebug;
        const run = d.match.run;
        run.runners.forEach((r: any, i: number) => {
          const [tx, ty] = cells[i];
          r.body.x = tx * 16 + 3;
          r.body.y = (ty + 1) * 16 - r.body.h;
          r.body.vx = r.body.vy = 0;
          r.items.held = { kind: ['slick', 'jolt', 'grapple', 'grapple'][i], uses: 1 };
        });
        const view = d.renderer.cam;
        view.update = () => {};
        view.snap({ cx: c[0] * 16 + 8, cy: c[1] * 16 + 24, zoom: 2 });
        view.shake = 0;
      },
      [column, cam] as const,
    );
    const press = (who: number) =>
      page.evaluate((k) => {
        const d = (window as any).slagDebug;
        const dev = d.match.players[k].device;
        d.step(1, { [dev]: { usePressed: true } });
      }, who);
    const name = (n: string) => `climb-${seed}${opt('theme') ? `-${opt('theme')}` : ''}-${n}`;
    await step(2);
    await snap(name('held'));
    await press(0);
    await step(14);
    await snap(name('slick'));
    await press(2);
    await step(5);
    await snap(name('grapple'));
    await step(18);
    await snap(name('grapple-up'));
    await press(1);
    await step(14);
    await snap(name('jolt'));
    await step(10);
    await snap(name('jolt-hit'));
    // A Leg Day: the level's own, pinned in view, then taken.
    const surge = await page.evaluate(() => {
      const run = (window as any).slagDebug.match.run;
      const rp = run.resolved.find((x: any) => x.mods[0].type === 'surge');
      return rp ? (rp.mods[0].cells[0] as [number, number]) : null;
    });
    if (!surge) throw new Error('this shaft has no Leg Day');
    await page.evaluate((c) => {
      const d = (window as any).slagDebug;
      d.renderer.cam.snap({ cx: c[0] * 16 + 8, cy: c[1] * 16, zoom: 2.5 });
      const r = d.match.run.runners[2];
      r.items.daze = 0;
      r.body.x = (c[0] - 2) * 16 + 3;
      r.body.y = (c[1] + 1) * 16 - r.body.h;
      r.body.vx = r.body.vy = 0;
    }, surge);
    await step(2);
    await snap(name('legday'));
    await page.evaluate((c) => {
      const r = (window as any).slagDebug.match.run.runners[2];
      r.body.x = c[0] * 16 + 3;
    }, surge);
    await step(3);
    await snap(name('legday-taken'));
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      d.step(1, { [d.match.players[2].device]: { jump: true, jumpPressed: true } });
    });
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      d.step(9, { [d.match.players[2].device]: { jump: true } });
    });
    await snap(name('legday-jump'));
  },
  async blood() {
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
  },
};
