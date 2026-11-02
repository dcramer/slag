/** Stepped frames of play, where motion and contact can only be judged frame by frame. */
import { open, opt, out, page, players, seed, sheet, snap, step, tq, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async grabs() {
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
        (window as any).slagDebug.match.run.runners.map((r: any) => `#${r.slot} y=${r.body.y.toFixed(1)} ride=${r.ride} ground=${r.body.onGround}`).join('  '),
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
  },
  async items() {
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
