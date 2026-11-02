/** Renderer checks: WebGL failure paths, the cel pass timing, and partial ink redraws against full bakes. */
import { writeFileSync } from 'node:fs';
import { argv, base, browser, errors, frames, H, open, opt, out, page, pet, players, seed, snap, step, tq, W, type Scenarios } from './ctx';
import { forceLandmark } from './landmarks';

export const shots: Scenarios = {
  async webgl() {
    // The compositor's failure paths: a context lost mid-race and given back, shaders that won't build, and no WebGL2.
    const q = `seed=${seed}&players=${players}&race=${opt('race', 'saw,laser')}&propseed=1`;
    await open(q);
    await step(frames);
    const style = () => page.evaluate(() => (window as any).slagDebug.renderer.renderStyle as string);
    const raceFrame = () => page.evaluate(() => (window as any).slagDebug.match.run?.frame as number);
    console.log('before', await style());
    await snap(`webgl-${seed}-1-cel`);
    const glCall = (what: 'loseContext' | 'restoreContext') =>
      page.evaluate((w) => {
        // A lost context hands out no extensions, so keep the one that can give it back.
        const keep = window as unknown as { loseGL?: WEBGL_lose_context };
        const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean)!;
        keep.loseGL ??= gl.getExtension('WEBGL_lose_context')!;
        keep.loseGL[w]();
      }, what);
    await glCall('loseContext');
    await page.waitForFunction(() => (window as any).slagDebug.renderer.renderStyle.startsWith('canvas2d'), null, { timeout: 10_000 });
    const f0 = await raceFrame();
    await step(30);
    console.log('lost', await style(), 'race frames', f0, '→', await raceFrame());
    await snap(`webgl-${seed}-2-lost`);
    await glCall('restoreContext');
    await page.waitForFunction(() => (window as any).slagDebug.renderer.renderStyle.startsWith('webgl2'), null, { timeout: 10_000 });
    await step(30);
    console.log('restored', await style());
    await snap(`webgl-${seed}-3-restored`);
    // A fresh page per broken GPU: the breakage has to be in place before the game boots.
    const broken = async (name: string, script: string) => {
      const bp = await browser.newPage({ viewport: { width: W, height: H } });
      bp.on('pageerror', (e: Error) => errors.push(String(e)));
      bp.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));
      await bp.addInitScript(script);
      await bp.goto(`${base}r/SHOTS?${q}${tq}&net=off`);
      await bp.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
      await bp.evaluate(() => document.fonts.ready);
      await bp.evaluate(() => (window as any).slagDebug.pause(true));
      await bp.evaluate((n) => (window as any).slagDebug.step(n), frames);
      console.log(name, await bp.evaluate(() => (window as any).slagDebug.renderer.renderStyle));
      const p = `${out}/webgl-${seed}-${name}.png`;
      await bp.screenshot({ path: p });
      console.log(p);
      pet();
      await bp.close();
    };
    await broken('4-shaderfail', 'WebGL2RenderingContext.prototype.getShaderParameter = function () { return false; };');
    await broken(
      '5-nowebgl2',
      "{ const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return k === 'webgl2' ? null : get.call(this, k, ...a); }; }",
    );
  },
  async inkdraw() {
    // The cel pass on its own: re-issues just its fullscreen draw and flushes, so the time is that shader's and nothing else's.
    await open(`seed=${seed}&players=${players}&race=${opt('race', 'all')}&propseed=1`);
    await step(60);
    await page.evaluate('globalThis.__name = (f) => f');
    const report = await page.evaluate(async () => {
      const d = (window as any).slagDebug;
      const px = new Uint8Array(4);
      const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean) as WebGL2RenderingContext;
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      const once = () => {
        d.render?.();
        const t0 = performance.now();
        for (let i = 0; i < 10; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return (performance.now() - t0) / 10;
      };
      const samples: number[] = [];
      for (let i = 0; i < 24; i++) {
        samples.push(once());
        await new Promise((r) => setTimeout(r, 0));
      }
      samples.sort((a, b) => a - b);
      return {
        gpu: gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        size: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
        drawMs: +samples[samples.length >> 1].toFixed(3),
        minMs: +samples[0].toFixed(3),
      };
    });
    console.log(JSON.stringify(report));
  },
  async inkblast() {
    // Bites craters out of a level, times the redraw, and checks each partial bake against a full one.
    await open(`seed=${seed}&players=${players}&race=&propseed=1`);
    await step(30);
    // `--skin planks [--shell facade]`: bite into a test landmark drawn in that skin (./landmarks.ts).
    const skin = opt('skin');
    if (skin) await forceLandmark(skin, opt('shell'));
    // tsx names functions through a helper that the page doesn't have.
    await page.evaluate('globalThis.__name = (f) => f');
    const report = await page.evaluate(async (timing) => {
      const d = (window as any).slagDebug;
      const lv = d.match.level;
      const tp = d.renderer.terrain;
      const px = new Uint8Array(4);
      const gl = [...document.querySelectorAll('canvas')].map((c) => c.getContext('webgl2')).find(Boolean) as WebGL2RenderingContext;
      const flush = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const render = () => {
        d.render?.();
        flush();
        // Canvas 2D work is deferred: the composite above makes the clock pay for it. Comparing bakes needs a
        // readback, which flips a GPU canvas to software, so `--timing` skips it and PW_GPU runs stay honest.
        if (!timing) tp.bake.getContext('2d').getImageData(0, 0, 1, 1);
      };
      const clone = () => {
        const c = document.createElement('canvas');
        c.width = tp.bake.width;
        c.height = tp.bake.height;
        c.getContext('2d')!.drawImage(tp.bake, 0, 0);
        return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      };
      const surface: [number, number][] = [];
      for (let x = 6; x < lv.w - 6; x += 7) {
        for (let y = 2; y < lv.h - 2; y++) {
          if (lv.tiles[y * lv.w + x] === 1 && lv.tiles[(y - 1) * lv.w + x] === 0) {
            surface.push([x, y]);
            break;
          }
        }
      }
      // A landmark gets craters of its own: across its top, and at its foot where it meets the ground.
      const lm = lv.landmark?.skin ? lv.landmark.rect : null;
      if (lm) {
        for (let x = lm.x; x < lm.x + lm.w; x += 3) {
          for (let y = lm.y; y < lm.y + lm.h; y++) {
            if (lv.tiles[y * lv.w + x] === 1) {
              surface.push([x, y]);
              break;
            }
          }
        }
        surface.push([lm.x + lm.w - 1, lm.y + lm.h - 1]);
      }
      // The page inked its first level a chunk per frame before the harness paused it: start from a
      // whole bake, so each crater is compared against the same picture it was cut into.
      tp.fullBakes = true;
      tp.inkKey = '';
      lv.version++;
      render();
      tp.fullBakes = false;
      let idle = 0;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        render();
        idle += (performance.now() - t0) / 5;
      }
      const partial: number[] = [];
      const full: number[] = [];
      const wrong: unknown[] = [];
      for (const [cx, cy] of surface) {
        for (let y = cy - 3; y <= cy + 3; y++) {
          for (let x = cx - 3; x <= cx + 3; x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 <= 10 && y >= 0 && y < lv.h && x >= 0 && x < lv.w && lv.tiles[y * lv.w + x] === 1) lv.tiles[y * lv.w + x] = 0;
          }
        }
        lv.version++;
        const t0 = performance.now();
        render();
        partial.push(performance.now() - t0 - idle);
        const a = timing ? null : clone();
        const dumpA = timing ? '' : tp.bake.toDataURL('image/png');
        tp.fullBakes = true;
        tp.inkKey = '';
        tp.texKey = '';
        lv.version++;
        const t1 = performance.now();
        render();
        full.push(performance.now() - t1 - idle);
        tp.fullBakes = false;
        if (!a) continue;
        const b = clone();
        let bad = 0;
        let worst = 0;
        let box = [1e9, 1e9, -1, -1];
        for (let i = 0; i < a.length; i++) {
          const e = Math.abs(a[i] - b[i]);
          if (!e) continue;
          bad++;
          worst = Math.max(worst, e);
          const px = i >> 2;
          const x = px % tp.bake.width;
          const y = (px - x) / tp.bake.width;
          box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
        }
        wrong.push({ bytes: bad, worst, box, crater: [cx, cy], a: bad > 10000 ? dumpA : '', b: bad > 10000 ? tp.bake.toDataURL('image/png') : '' });
        await new Promise((r) => setTimeout(r, 0));
      }
      const med = (v: number[]) => [...v].sort((p, q) => p - q)[v.length >> 1];
      return {
        level: `${lv.w}x${lv.h}`,
        bake: `${tp.bake.width}x${tp.bake.height}`,
        craters: surface.length,
        landmark: lm,
        idle: Math.round(idle),
        partialMs: Math.round(med(partial)),
        partialMax: Math.round(Math.max(...partial)),
        fullMs: Math.round(med(full)),
        wrong,
      };
    }, argv.includes('--timing'));
    (report.wrong as { a: string; b: string }[]).forEach((w, i) => {
      if (w.a) {
        writeFileSync(`${out}/partial-${i}.png`, Buffer.from(w.a.split(',')[1], 'base64'));
        writeFileSync(`${out}/full-${i}.png`, Buffer.from(w.b.split(',')[1], 'base64'));
      }
      w.a = w.b = '';
    });
    console.log(JSON.stringify(report));
  },
};
