/** Parts close up: crate cards at every size, placed parts in a race, and every building part. */
import { argv, LAUNCHER_STYLES, open, opt, out, page, seed, sheet, snap, step, type Scenarios } from './ctx';

export const shots: Scenarios = {
  async cards() {
    // Crate cards for `--arch a,b,c`, each at small, medium and large, as many crates as that takes (`--players` sets the crate's size).
    const arch = opt('arch', 'flamer,rope,saw,launcher')!.split(',');
    await open(`seed=${seed}&players=${opt('players', '8')}`);
    await step(30);
    const cardStyles = opt('styles') ? (opt('styles') === 'all' ? LAUNCHER_STYLES : opt('styles')!).split(',') : [];
    const defs = await page.evaluate(
      ([as, styles]) => {
        const d = (window as any).slagDebug;
        const out: any[] = [];
        // `--styles a,b` (or `all`): one launcher card per style.
        for (const want of styles) {
          for (let k = 1; k < 900; k++) {
            d.match.placed.length = 0;
            d.addProps(['launcher'], k);
            const def = d.match.placed[0]?.def;
            if (def?.modules.some((m: any) => m.type === 'launcher' && m.style === want)) {
              out.push(def);
              break;
            }
          }
        }
        for (const want of styles.length ? [] : as) {
          // `platform:tetra`: only parts with a body of that look (a Four-Square).
          const [a, look] = want.split(':');
          const got = new Map<string, any>();
          for (let k = 1; k < 400 && got.size < 3; k++) {
            d.match.placed.length = 0;
            d.addProps([a], k);
            const def = d.match.placed[0]?.def;
            if (look && !def?.modules.some((m: any) => m.look === look)) continue;
            if (def && !got.has(def.size)) got.set(def.size, def);
            if (look && got.size) break;
          }
          for (const sz of ['small', 'medium', 'large']) if (got.has(sz)) out.push(got.get(sz));
        }
        d.match.placed.length = 0;
        return out;
      },
      [arch, cardStyles] as const,
    );
    const files: string[] = [];
    const per = await page.evaluate(() => (window as any).slagDebug.match.crate.length);
    for (let k = 0; k * per < defs.length; k++) {
      await page.evaluate(
        ([ds, from]) => {
          const m = (window as any).slagDebug.match;
          m.crate.forEach((c: any, i: number) => {
            c.def = ds[(from + i) % ds.length];
            c.claimedBy = -1;
          });
        },
        [defs, k * per] as const,
      );
      await step(2);
      files.push(await snap(`cards-${opt('players', '8')}p-${k}`));
    }
    await sheet('cards', files, 1);
  },
  async parts() {
    // Each of `--arch a,b,c` placed for real (`--count` of each), raced for `--frames`, then shot close up
    // one by one: a contact sheet of parts at a close race zoom.
    const arch = opt('arch', 'saw,launcher,spikeblock,spikestrip')!.split(',');
    await open(`seed=${seed}&players=2&race=,&propseed=1`);
    // `--styles crossbow,cannon` (or `all`): one launcher of each style instead of `--arch`; `--aim track` keeps only trackers.
    const styles = opt('styles') ? (opt('styles') === 'all' ? LAUNCHER_STYLES : opt('styles')!).split(',') : [];
    await page.evaluate(
      ([as, n, styles, aim, bait]) => {
        const d = (window as any).slagDebug;
        d.match.placed.length = 0;
        if (styles.length) {
          // One launcher of each style: roll seeds until each turns up.
          for (const want of styles) {
            for (let k = 1; k < 900; k++) {
              const before = d.match.placed.length;
              d.addProps(['launcher'], k);
              const got = d.match.placed[before]?.def.modules.find((m: any) => m.type === 'launcher');
              if (got?.style === want && (!aim || got.aim === aim)) break;
              d.match.placed.length = before;
            }
          }
        } else
          for (let k = 0; k < n; k++)
            for (const want of as) {
              // `platform:tetra`: roll until the part has a body of that look.
              const [a, look] = want.split(':');
              for (let j = 0; j < 400; j++) {
                const before = d.match.placed.length;
                d.addProps([a], 11 + k * 7 + j * 101);
                if (!look || d.match.placed[before]?.def.modules.some((m: any) => m.look === look)) break;
                d.match.placed.length = before;
              }
            }
        d.race([], 1);
        // `--bait`: each runner stands on the nearest floor a few tiles in front of a part, to set it off (a sentry, a dropstone).
        if (bait) {
          // (No named helpers in here: the bundler wraps them in a __name the page doesn't have.)
          const lv = d.match.level;
          d.match.run.runners.forEach((r: any, i: number) => {
            const p = d.match.placed[i % d.match.placed.length];
            for (const dx of [5, 4, 6, 3, 7]) {
              const tx = p.tx + dx;
              for (let ty = Math.max(1, p.ty - 3); ty < Math.min(lv.h - 1, p.ty + 4); ty++) {
                if (tx < lv.w && !lv.tiles[ty * lv.w + tx] && !lv.tiles[(ty - 1) * lv.w + tx] && lv.tiles[(ty + 1) * lv.w + tx] === 1) {
                  r.body.x = tx * 16 + (16 - r.body.w) / 2;
                  r.body.y = (ty + 1) * 16 - r.body.h;
                  r.body.vx = r.body.vy = 0;
                  return;
                }
              }
            }
          });
        }
      },
      [arch, Number(opt('count', '2')), styles, opt('aim') ?? '', argv.includes('--bait')] as const,
    );
    await step(Number(opt('frames', '60')));
    const spots = await page.evaluate(() =>
      (window as any).slagDebug.match.placed.map((p: any) => {
        const xs = p.def.footprint.map((c: number[]) => c[0]);
        const ys = p.def.footprint.map((c: number[]) => c[1]);
        return {
          name: p.def.modules.find((m: any) => m.type === 'launcher')?.style ?? p.def.archetype,
          x: (p.tx + (Math.min(...xs) + Math.max(...xs) + 1) / 2) * 16,
          y: (p.ty + (Math.min(...ys) + Math.max(...ys) + 1) / 2) * 16,
        };
      }),
    );
    const files: string[] = [await snap(`parts-${seed}-race`)];
    const zoom = Number(opt('zoom', '2.6'));
    for (const [i, sp] of spots.entries()) {
      await page.evaluate(
        ([x, y, z]) => {
          const d = (window as any).slagDebug;
          const cam = d.renderer.cam;
          cam.update = () => {};
          cam.snap({ cx: x, cy: y, zoom: z });
          cam.shake = 0;
          d.render();
        },
        [sp.x, sp.y, zoom] as const,
      );
      const size = page.viewportSize()!;
      const path = `${out}/parts-${seed}-${String(i).padStart(2, '0')}-${sp.name}.png`;
      const w = Math.min(size.width, size.height);
      await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: 0, width: w, height: w } });
      files.push(path);
    }
    await sheet(`parts-${seed}`, files.slice(1), 4);
  },
  async parody() {
    // The parody batch in action (docs/PARODY-BACKLOG.md): a Launch Plate, Boost Strip, Panic Button, Fuse
    // Crate, Y-Fling and Four-Square, each on the first stretch of flat floor a level has, worked by a runner
    // on a script, shot close up in the place phase (a plate's dotted flight) and at a few moments of the race.
    const none = {
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
    /** Per part: when to shoot, and what the runner holds on each frame after it's put in place. */
    const stages: { kind: string; at: number[]; inp: (f: number) => Record<string, boolean> }[] = [
      { kind: 'launchplate', at: [14, 30, 50], inp: (f) => ({ right: f < 12, run: f < 12 }) },
      { kind: 'boost', at: [30, 40, 54], inp: (f) => ({ right: f < 30 }) },
      { kind: 'panic', at: [36, 290, 345], inp: (f) => ({ right: f < 30 }) },
      { kind: 'fling', at: [24, 44, 58], inp: (f) => ({ left: f < 40, down: f < 40, jump: f === 40, jumpPressed: f === 40 }) },
      { kind: 'platform:tetra', at: [10], inp: () => ({}) },
      // Last: its blast's smoke would drift into the next stage's shots.
      { kind: 'fuse', at: [70, 150, 182], inp: (f) => ({ left: f > 30 && f < 60 }) },
    ];
    const files: string[] = [];
    const closeup = async (sp: { x: number; y: number }, tag: string) => {
      await page.evaluate(
        ([x, y]) => {
          const d = (window as any).slagDebug;
          const cam = d.renderer.cam;
          cam.update = () => {};
          d.renderer.updateCamera = () => {};
          cam.snap({ cx: x, cy: y, zoom: 2 });
          cam.shake = 0;
          d.render();
        },
        [(sp.x + 8) * 16, (sp.y - 2) * 16] as const,
      );
      const size = page.viewportSize()!;
      const path = `${out}/parody-${seed}-${tag}.png`;
      const w = Math.min(size.width, size.height);
      await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: 0, width: w, height: w } });
      files.push(path);
    };
    await open(`seed=${seed}&players=1&race=,&propseed=1`);
    for (const st of stages) {
      const sp: { x: number; y: number } | null = await page.evaluate(
        ([kind, base]) => {
          // (No named helpers in here: the bundler wraps them in a __name the page doesn't have.)
          const d = (window as any).slagDebug;
          // Levels have no long flat floors on purpose, so cut one: a stage 16 wide in the middle of the level,
          // seven rows of air on two rows of ground, cleared of set pieces (a bomb's redraw paints the change).
          d.loadLevel(base, 'farm');
          const lv = d.match.level;
          const spot = { x: Math.floor(lv.w / 2) - 8, y: Math.floor(lv.h / 2) + 2 };
          for (let x = spot.x - 1; x < spot.x + 17; x++) {
            for (let y = spot.y - 7; y <= spot.y; y++) lv.tiles[y * lv.w + x] = 0;
            for (let y = spot.y + 1; y <= spot.y + 2; y++) lv.tiles[y * lv.w + x] = 1;
          }
          lv.setPieces = [];
          lv.version++;
          d.match.placed.length = 0;
          const [a, look] = kind.split(':');
          let p: any = null;
          for (let j = 0; j < 400 && !p; j++) {
            // A few at once: addProps tries spots by index, and on some level sizes the first index never meets a floor.
            d.addProps([a, a, a, a], 3 + j * 17);
            p = d.match.placed.find((q: any) => (a !== 'boost' || q.def.footprint.length >= 2) && (!look || q.def.modules.some((m: any) => m.look === look)));
            d.match.placed.length = 0;
          }
          if (!p) return null;
          d.match.placed.push(p);
          p.rot = 0;
          const m = p.def.modules[0];
          // The plate, button and crate stand on the floor, the strip lies on it, the fork's stem is planted in it,
          // and the Four-Square floats three rows up.
          p.tx = spot.x + (a === 'launchplate' ? 2 : 3);
          p.ty =
            a === 'boost' ? spot.y + 1 : a === 'fling' ? spot.y - 1 : a === 'platform' ? spot.y - 3 : a === 'panic' ? spot.y - Math.floor(m.at[1]) : spot.y;
          d.race([], 1);
          // A new level's ink goes down a chunk per frame: let it finish before anything is shot.
          for (let i = 0; i < 40; i++) d.render();
          return spot;
        },
        [st.kind, seed] as const,
      );
      if (!sp) {
        console.log(`no floor for ${st.kind}`);
        continue;
      }
      const tag = st.kind.replace(':', '-');
      // The place phase dots in a plate's whole flight. (Rendered, not stepped: a place-phase step would run the
      // place phase on a race.)
      if (st.kind === 'launchplate') {
        await page.evaluate(() => (window as any).slagDebug.match.setPhase('place'));
        await closeup(sp, `${tag}-place`);
        await page.evaluate(() => (window as any).slagDebug.match.setPhase('run'));
      }
      await step(60);
      await page.evaluate(
        ([kind, s]) => {
          const d = (window as any).slagDebug;
          const b = d.match.run.runners[0].body;
          const p = d.match.placed[0];
          let tx = s.x;
          let ty = s.y;
          if (kind === 'fuse') tx = p.tx;
          if (kind === 'fuse') ty = p.ty - 1;
          if (kind === 'platform:tetra') tx = p.tx + p.def.footprint.find((c: number[]) => c[1] === 0)[0];
          if (kind === 'platform:tetra') ty = p.ty - 1;
          b.x = tx * 16 + 8 - b.w / 2;
          b.y = (ty + 1) * 16 - b.h;
          if (kind === 'fling') b.x = (p.tx + 1) * 16 - b.w / 2;
          if (kind === 'fling') b.y = (p.ty + 1) * 16 - b.h / 2;
          b.vx = 0;
          b.vy = 0;
        },
        [st.kind, sp] as const,
      );
      const last = Math.max(...st.at);
      for (let f = 0; f <= last; f++) {
        await page.evaluate(([inp]) => (window as any).slagDebug.step(1, { kb1: inp }), [{ ...none, ...st.inp(f) }] as const);
        if (st.at.includes(f)) await closeup(sp, `${tag}-${f}`);
      }
    }
    await sheet(`parody-${seed}`, files, 4);
  },
  async pipes() {
    // Warp pipes facing every way: two linked pairs and one waiting, in place with a pipe ghost tethered
    // to the waiting one, each pipe close up, then a race with runners caught going in and coming out.
    await open(`seed=${seed}&players=2`);
    await step(20);
    const pipes = await page.evaluate(
      (ps) => {
        const d = (window as any).slagDebug;
        const m = d.match;
        m.placed.length = 0;
        for (const rot of [0, 1, 2, 3, 0]) d.addProps(['pipe'], ps, rot);
        const def = m.placed[0].def;
        m.players.forEach((p: any, i: number) => {
          m.crate[i].def = def;
          m.crate[i].claimedBy = p.slot;
          p.claim = i;
        });
        return m.placed.map((p: any) => ({ uid: p.uid, rot: p.rot, link: p.link ?? null }));
      },
      Number(opt('propseed', '1')),
    );
    console.log(JSON.stringify(pipes));
    await step(60);
    await page.evaluate(() => {
      const m = (window as any).slagDebug.match;
      m.players[0].cursor = { x: m.level.w * 8, y: 60 };
      m.players[1].placed = true;
    });
    await step(2);
    const files = [await snap(`pipes-${seed}-place`)];
    const zoomOn = async (uid: number, name: string) => {
      await page.evaluate(
        ([u, z]) => {
          const d = (window as any).slagDebug;
          const p = d.match.placed.find((q: any) => q.uid === u);
          const cam = d.renderer.cam;
          cam.update = () => {};
          cam.snap({ cx: (p.tx + 1) * 16, cy: (p.ty + 1) * 16, zoom: z });
          cam.shake = 0;
          d.render();
        },
        [uid, Number(opt('zoom', '3'))] as const,
      );
      files.push(await snap(`pipes-${seed}-${name}`));
    };
    // The race: close up on each pipe first (the place view is the whole level), then runner 0 down the
    // first pipe (mouth up) and runner 1 into the second (a side mouth).
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      d.match.startRun();
      d.step(150);
    });
    for (const p of pipes) await zoomOn(p.uid, `rot${p.rot}-${p.uid}`);
    await page.evaluate(() => {
      const d = (window as any).slagDebug;
      const run = d.match.run;
      run.runners.forEach((r: any, i: number) => {
        const m = run.resolved.find((x: any) => x.pp.uid === d.match.placed[i].uid).mods[0];
        const dx = Math.round(Math.cos(m.angle));
        const dy = Math.round(Math.sin(m.angle));
        Object.assign(r.body, {
          x: m.at[0] + (dx * r.body.w) / 2 - r.body.w / 2,
          y: m.at[1] + (dy * r.body.h) / 2 - r.body.h / 2,
          vx: 0,
          vy: 0,
          onGround: dy < 0,
        });
      });
    });
    const inputs = await page.evaluate(() => {
      const d = (window as any).slagDebug;
      const run = d.match.run;
      return d.match.players.map((p: any, i: number) => {
        const m = run.resolved.find((r: any) => r.pp.uid === d.match.placed[i].uid).mods[0];
        const dx = Math.round(Math.cos(m.angle));
        const dy = Math.round(Math.sin(m.angle));
        const want = dy < 0 ? { down: true } : dy > 0 ? { up: true } : dx > 0 ? { left: true } : { right: true };
        return [p.device, want];
      });
    });
    await page.evaluate((inp) => (window as any).slagDebug.step(1, Object.fromEntries(inp)), inputs);
    const raceAt = async (n: number, name: string) => {
      await step(n);
      await page.evaluate(() => {
        const d = (window as any).slagDebug;
        const cam = d.renderer.cam;
        delete cam.update;
        d.render();
      });
      files.push(await snap(`pipes-${seed}-race-${name}`));
    };
    await raceAt(10, 'going-in');
    for (const [i, p] of pipes.slice(0, 2).entries()) await zoomOn(p.uid, `race-in-${i}`);
    await raceAt(20, 'coming-out');
    for (const [i, p] of pipes.slice(0, 2).entries()) await zoomOn(p.link, `race-out-${i}`);
    await sheet(`pipes-${seed}`, files, 3);
    // Every material, on a pipe facing up and one facing down (a match only ever has one).
    const looks: string[] = [];
    for (const look of ['green', 'brass', 'rust', 'porcelain', 'copper']) {
      await page.evaluate((l) => {
        const d = (window as any).slagDebug;
        for (const r of d.match.run.resolved) for (const m of r.mods) if (m.type === 'pipe') m.look = l;
      }, look);
      for (const p of [pipes[0], pipes[2]]) {
        await zoomOn(p.uid, `look-${look}-rot${p.rot}`);
        looks.push(files.pop()!);
      }
    }
    await sheet(`pipes-${seed}-looks`, looks, 4);
  },
  async buildparts() {
    // Every building part: each block material at every size in a race (whole view and close up), then
    // on crate cards, then as place-phase ghosts. `--theme` picks the backdrop.
    const kinds = ['stone', 'metal', 'wood', 'ice', 'conveyor', 'goo', 'jelly', 'crumble'];
    const shapes: [number, number][][] = [
      [[0, 0]],
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
        [3, 1],
      ],
    ];
    // Build defs in the page from a real generated platform, so every field the art reads is there.
    const defsOf = () =>
      page.evaluate(
        ([ks, sh]) => {
          const d = (window as any).slagDebug;
          d.match.placed.length = 0;
          d.addProps(['platform', 'blinker', 'wheel', 'crumble'], 3);
          const got = d.match.placed.map((p: any) => p.def);
          d.match.placed.length = 0;
          const base = got.find((x: any) => x.archetype === 'platform');
          const out: any[] = [];
          for (const k of ks)
            for (const cells of sh) {
              const def = structuredClone(base);
              def.key = `bp-${k}-${cells.length}`;
              def.name = k;
              def.role = 'build';
              def.motion = { type: 'none' };
              def.modules = [
                {
                  type: 'body',
                  cells,
                  material: k,
                  conveyor: k === 'conveyor' ? 80 : 0,
                  breakFrames: k === 'crumble' ? 30 : 0,
                  respawnFrames: k === 'crumble' ? 200 : 0,
                },
              ];
              def.footprint = cells;
              def.span = 3;
              out.push(def);
            }
          for (const x of got) if (x.archetype !== 'platform') out.push(x);
          return out;
        },
        [kinds, shapes] as const,
      );
    await open(`seed=${seed}&players=8`);
    await step(30);
    const defs = await defsOf();
    // Cards: two crates' worth of the build parts.
    const cardShots: string[] = [];
    for (let k = 0; k < 2; k++) {
      await page.evaluate(
        ([ds, from]) => {
          const m = (window as any).slagDebug.match;
          m.crate.forEach((c: any, i: number) => {
            c.def = ds[(from + i * 3) % ds.length];
            c.claimedBy = -1;
          });
        },
        [defs, k] as const,
      );
      await step(2);
      cardShots.push(await snap(`buildparts-cards-${k}`));
    }
    // Ghosts: each player holds one and aims it over open air.
    await page.evaluate((ds) => {
      const m = (window as any).slagDebug.match;
      const pick = [1, 6, 10, 14, 18, 22, 26, 33].map((i) => i % ds.length);
      m.crate.forEach((c: any, i: number) => (c.def = ds[pick[i % pick.length]]));
      m.players.forEach((p: any, i: number) => {
        p.claim = i;
        m.crate[i].claimedBy = p.slot;
      });
    }, defs);
    await step(30);
    await page.evaluate(() => {
      const m = (window as any).slagDebug.match;
      m.players.forEach((p: any, i: number) => (p.cursor = { x: 90 + (i % 4) * 170, y: 110 + Math.floor(i / 4) * 150 }));
    });
    await step(2);
    const ghost = await snap(`buildparts-ghosts`);
    // The race: an empty room with every part laid out on a grid.
    await page.evaluate((ds) => {
      const d = (window as any).slagDebug;
      const m = d.match;
      const L = m.level;
      for (let y = 2; y < L.h - 3; y++) for (let x = 3; x < L.w - 3; x++) L.tiles[y * L.w + x] = 0;
      L.version++;
      m.placed.length = 0;
      let uid = 900;
      ds.forEach((def: any, i: number) => {
        const blocks = i < 32;
        const tx = blocks ? 4 + [0, 3, 8, 15][i % 4] : 26 + ((i - 32) % 2) * 9;
        const ty = blocks ? 3 + Math.floor(i / 4) * 3 : 4 + Math.floor((i - 32) / 2) * 7;
        m.placed.push({ uid: uid++, def, owner: m.players[0].slot, tx, ty, rot: 0 });
      });
      d.race([], 1);
    }, defs);
    await step(40);
    const race = await snap(`buildparts-race`);
    const close: string[] = [];
    for (const [cx, cy] of [
      [200, 110],
      [200, 250],
      [200, 370],
      [560, 200],
    ]) {
      await page.evaluate(
        ([x, y]) => {
          const cam = (window as any).slagDebug.renderer.cam;
          cam.update = () => {};
          cam.snap({ cx: x, cy: y, zoom: 2.4 });
          cam.shake = 0;
          (window as any).slagDebug.render();
        },
        [cx, cy] as const,
      );
      close.push(await snap(`buildparts-race-close-${close.length}`));
    }
    await sheet('buildparts', [race, ...close, ...cardShots, ghost], 2);
  },
};
