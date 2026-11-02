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
        for (const a of styles.length ? [] : as) {
          const got = new Map<string, any>();
          for (let k = 1; k < 80 && got.size < 3; k++) {
            d.match.placed.length = 0;
            d.addProps([a], k);
            const def = d.match.placed[0]?.def;
            if (def && !got.has(def.size)) got.set(def.size, def);
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
    // `--material conveyor,jelly` (instead of `--arch`): `--count` platforms of each block material.
    const materials = opt('material')?.split(',') ?? [];
    await page.evaluate(
      ([as, n, styles, aim, bait, mats]) => {
        const d = (window as any).slagDebug;
        d.match.placed.length = 0;
        if (mats.length) {
          for (const want of mats) {
            let got = 0;
            for (let k = 1; k < 900 && got < n; k++) {
              const before = d.match.placed.length;
              d.addProps(['platform'], k);
              if (d.match.placed[before]?.def.modules.some((m: any) => m.type === 'body' && m.material === want)) got++;
              else d.match.placed.length = before;
            }
          }
        } else if (styles.length) {
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
        } else for (let k = 0; k < n; k++) for (const a of as) d.addProps([a], 11 + k * 7);
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
      [arch, Number(opt('count', '2')), styles, opt('aim') ?? '', argv.includes('--bait'), materials] as const,
    );
    await step(Number(opt('frames', '60')));
    const spots = await page.evaluate(() =>
      (window as any).slagDebug.match.placed.map((p: any) => {
        const xs = p.def.footprint.map((c: number[]) => c[0]);
        const ys = p.def.footprint.map((c: number[]) => c[1]);
        const mods = p.def.modules;
        return {
          name:
            mods.find((m: any) => m.type === 'launcher')?.style ??
            (p.def.archetype === 'platform' ? mods.find((m: any) => m.type === 'body')?.material : undefined) ??
            p.def.archetype,
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
  async looks() {
    // Set-piece looks in a bare room (docs/SETPIECES.md, Wave 1 E): every spike look on a floor, a wall
    // and a ceiling (the walls as coats, the rest as strips on blocks); every geyser look aimed up,
    // sideways and down, rumbling and erupting; the icicle and chandelier droppers at rest and mid-drop.
    // `--only spikes,geysers,droppers` picks sections.
    const only = (opt('only') ?? 'spikes,geysers,droppers').split(',');
    await open(`seed=${seed}&players=2`);
    await step(20);
    type Rect = [number, number, number, number];
    /** Rebuild the room (solid rects on bare walls and floor), place these pieces, start the race. */
    const stage = (solid: Rect[], pieces: unknown[][]) =>
      page.evaluate(
        ([rects, mods]) => {
          const d = (window as any).slagDebug;
          const m = d.match;
          d.match.placed.length = 0;
          d.addProps(['platform'], 3);
          const base = m.placed[0].def;
          m.placed.length = 0;
          const L = m.level;
          for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) L.tiles[y * L.w + x] = y >= L.h - 3 || x < 2 || x >= L.w - 2 ? 1 : 0;
          for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.tiles[y * L.w + x] = 1;
          L.setPieces = [];
          L.version++;
          mods.forEach((ms: any[], i: number) => {
            const def = structuredClone(base);
            def.key = `look-${i}`;
            def.motion = { type: 'none' };
            def.modules = ms;
            const cells = ms.flatMap((q: any) => q.cells ?? []);
            def.footprint = cells.length ? cells : [[Math.floor(ms[0].at?.[0] ?? 0), Math.floor(ms[0].at?.[1] ?? 0)]];
            m.placed.push({ uid: 700 + i, def, owner: -1, tx: 0, ty: 0, rot: 0 });
          });
          d.race([], 1);
        },
        [solid, pieces] as const,
      );
    const close = async (x: number, y: number, z: number, name: string) => {
      await page.evaluate(
        ([cx, cy, zz]) => {
          const d = (window as any).slagDebug;
          const cam = d.renderer.cam;
          cam.update = () => {};
          cam.snap({ cx, cy, zoom: zz });
          cam.shake = 0;
          d.render();
        },
        [x, y, z] as const,
      );
      const size = page.viewportSize()!;
      const w = Math.min(size.width, size.height);
      const path = `${out}/looks-${name}.png`;
      await page.screenshot({ path, clip: { x: (size.width - w) / 2, y: 0, width: w, height: w } });
      console.log(path);
      return path;
    };
    const room = async (name: string) => {
      await page.evaluate(() => {
        const d = (window as any).slagDebug;
        delete d.renderer.cam.update;
        d.render();
      });
      return snap(`looks-${name}`);
    };
    const T = 16;
    if (only.includes('spikes')) {
      const looks = ['glass', 'thorn', 'crystal', 'icicle', 'pitchfork'];
      const solid: Rect[] = [];
      const pieces: unknown[][] = [];
      const shots: [number, number, string][] = [];
      looks.forEach((look, i) => {
        const x = 3 + i * 9;
        const body = (cells: number[][]) => ({ type: 'body', cells, material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
        // Floor: a strip up out of a block. Wall: a coat on a pillar of terrain. Ceiling: a strip under a block.
        const floor = [0, 1, 2].map((k) => [x + k, 20]);
        pieces.push([body(floor), { type: 'spikes', cells: floor, angle: -Math.PI / 2, look }]);
        solid.push([x + 5, 11, x + 5, 15]);
        const wall = [12, 13, 14].map((y) => [x + 5, y]);
        pieces.push([{ type: 'coat', cells: wall, angle: 0, kind: 'spikes', look }]);
        const roof = [0, 1, 2].map((k) => [x + k, 4]);
        pieces.push([body(roof), { type: 'spikes', cells: roof, angle: Math.PI / 2, look }]);
        shots.push(
          [(x + 1.5) * T, 20 * T, `spikes-${look}-floor`],
          [(x + 6) * T, 13.5 * T, `spikes-${look}-wall`],
          [(x + 1.5) * T, 5 * T, `spikes-${look}-ceiling`],
        );
      });
      await stage(solid, pieces);
      await step(200);
      const files = [await room('spikes-room')];
      // Row by row: floors, walls, ceilings.
      for (const where of ['floor', 'wall', 'ceiling'])
        for (const [x, y, name] of shots.filter((s) => s[2].endsWith(where))) files.push(await close(x, y, Number(opt('zoom', '6')), name));
      await sheet('looks-spikes', files.slice(1), 5);
    }
    if (only.includes('geysers')) {
      const files: string[] = [];
      for (const look of (opt('looks') ?? 'water,toxic,snow,lava,steam').split(',')) {
        const lethal = look === 'lava' || look === 'toxic';
        const g = (at: number[], angle: number, length: number, width: number) => ({
          type: 'geyser',
          look,
          at,
          angle,
          width,
          length,
          off: 1,
          warn: 90,
          on: 5000,
          lethal,
          strength: 2600,
        });
        // Up out of the floor; along the floor out of a wall's foot (a wave); down off a ledge (a waterfall).
        const solid: Rect[] = [
          [2, 17, 6, 23],
          [20, 9, 30, 10],
        ];
        await stage(solid, [[g([39.5, 24], -Math.PI / 2, 10, 0.9)], [g([7, 24 - 0.6], 0, 11, 1.2)], [g([25.5, 11], Math.PI / 2, 13, 1.1)]]);
        // Phase each column so it's where we want it on the frame we shoot: rumbling (70% in), then fully up.
        const at = async (mode: 'warn' | 'on', k: number) => {
          await page.evaluate(
            ([tgt, kk]) => {
              const d = (window as any).slagDebug;
              const run = d.match.run;
              for (const r of run.resolved) {
                const m = r.mods.find((q: any) => q.type === 'geyser');
                if (!m) continue;
                const total = m.off + m.warn + m.on;
                const want = tgt === 'warn' ? m.off + Math.round(m.warn * 0.7) : m.off + m.warn + 40;
                r.phase = (((((want - (run.frame + kk)) % total) + total) % total) + 0.5) / total;
              }
            },
            [mode, k] as const,
          );
          await step(k);
        };
        for (const mode of ['warn', 'on'] as const) {
          await at(mode, 12);
          files.push(await close(11 * T, 21.5 * T, 2.2, `geysers-${look}-side-${mode}`));
          files.push(await close(25.5 * T, 17.5 * T, 1.6, `geysers-${look}-down-${mode}`));
          files.push(await close(39.5 * T, 19.5 * T, 1.9, `geysers-${look}-up-${mode}`));
        }
      }
      await sheet('looks-geysers', files, 6);
    }
    if (only.includes('droppers')) {
      const drop = (cells: number[][], look: string) => ({ type: 'dropper', cells, angle: Math.PI / 2, reach: 18, warn: 30, rest: 60, look });
      const solid: Rect[] = [
        [10, 2, 16, 6],
        [28, 2, 36, 4],
      ];
      await stage(solid, [
        [
          drop(
            [
              [12, 7],
              [13, 7],
              [12, 8],
              [13, 8],
            ],
            'icicle',
          ),
        ],
        [
          drop(
            [
              [31, 8],
              [32, 8],
              [33, 8],
            ],
            'chandelier',
          ),
        ],
        [
          drop(
            [
              [22, 9],
              [22, 10],
            ],
            'icicle',
          ),
        ],
      ]);
      await step(260);
      const files = [
        await room('droppers-rest'),
        await close(13 * T, 10 * T, 3, 'droppers-icicle-rest'),
        await close(32.5 * T, 9 * T, 3, 'droppers-chandelier-rest'),
      ];
      // Stand a runner under each big one and wait for the slam to be under way.
      await page.evaluate(() => {
        const d = (window as any).slagDebug;
        const run = d.match.run;
        const spots = [13, 32.5];
        run.runners.forEach((r: any, i: number) => {
          r.body.x = spots[i % 2] * 16 - r.body.w / 2;
          r.body.y = 24 * 16 - r.body.h;
          r.body.vx = r.body.vy = 0;
        });
      });
      // Each shot when its head is a third of the way down, so it's caught slamming, not landed.
      const caught = new Set<number>();
      for (let f = 0; f < 240 && caught.size < 2; f++) {
        await step(1);
        const ds: number[] = await page.evaluate(() => {
          const run = (window as any).slagDebug.match.run;
          return [700, 701].map((u) => (run.propState.get(u)?.vars.get('0:st') === 2 ? run.propState.get(u).vars.get('0:d') : 0));
        });
        for (const [i, d] of ds.entries()) {
          if (caught.has(i) || d < 5 * T) continue;
          caught.add(i);
          const [x, y, name] = i === 0 ? [13, 8, 'icicle'] : [32.5, 8.5, 'chandelier'];
          files.push(await close(x * T, y * T + d, 2.6, `droppers-${name}-falling`));
        }
      }
      if (caught.size < 2) throw new Error('the droppers never fell');
      await sheet('looks-droppers', files, 3);
    }
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
