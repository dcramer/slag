/**
 * Perf harness. Builds (if sources changed) and boots the production server,
 * runs scripted scenarios in headless Chromium, and reports per-frame timing
 * percentiles from the in-game profiler (src/devtools/profiler.ts, loaded
 * with `?debug=perf` → window.slagPerf).
 *
 *   pnpm perf                          every scenario + gen + load
 *   pnpm perf --only race8,lobby       a subset (scenario names below; also `gen`, `load`)
 *   pnpm perf --frames 240 --size 1280x720 --runs 2
 *   pnpm perf --compare shots/perf/<earlier>.json   flag regressions
 *   pnpm perf --mode raf --seconds 8   real-time game loop instead of stepped frames
 *   pnpm perf --sync                   read back a pixel after compositing so `post` includes GPU time
 *   pnpm perf --canvas cpu             rasterize Canvas2D on the main thread (fill-rate proxy)
 *   pnpm perf --query "size=large"     extra URL params for every scenario
 *   pnpm perf --cpu 4                  slow the main thread by this factor, to stand in for a phone's CPU
 *
 * Default mode `step` pauses the real-time loop and runs exactly one sim step
 * and one render per frame on a fixed 60 Hz clock (keyboard player 1 runs
 * and hops in races), so two runs do the same work and A/B comparisons are
 * fair. `frame` is then the CPU cost of one whole frame.
 *
 * Writes shots/perf/<timestamp>.json (and latest.json) and prints tables.
 *
 * Caveat: headless Chromium uses SwiftShader (software GL), so `post` (and
 * any fps from `--mode raf`) is pessimistic. Compare runs on the same
 * machine and focus on CPU-side sections (sim, bg, terrain, fx, lights, hud,
 * other) and on relative change. The report records os.loadavg(): a busy
 * machine skews everything, so re-run before trusting a regression.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Browser, Page } from 'playwright';
import type { Summary } from '../src/devtools/profiler';
import { THEME_IDS } from '../src/themes';
import { argReader, launchBrowser, startServer } from './lib/server';

const argv = process.argv.slice(2);
const { opt, flag } = argReader(argv);
const seconds = Number(opt('seconds', '8'));
const mode = opt('mode', 'step') as 'step' | 'raf';
const maxFrames = Number(opt('frames', mode === 'step' ? '240' : '600'));
const warmup = Number(opt('warmup', '2'));
const runs = Number(opt('runs', '1'));
const [W, H] = opt('size', '1280x720')!.split('x').map(Number);
const extra = opt('query', '');
const only = opt('only')?.split(',');
const outDir = resolve(opt('out', 'shots/perf')!);
const compare = opt('compare');
const sync = flag('sync');
/**
 * Canvas2D raster. 'gpu' (default, like real browsers): raster runs in the GPU process (SwiftShader), so sections
 * measure JS + canvas API cost on the main thread. 'cpu': Skia software raster on the main thread, so each section
 * also pays for its pixels (a fill-rate / overdraw proxy for weak devices).
 */
const canvasMode = opt('canvas', 'gpu');
const cpuSlow = Number(opt('cpu', '1'));

interface Scenario {
  name: string;
  /** URL query (seed, theme, players, race…). */
  q: string;
  /** Join N lobby players without starting (lobby scenarios). */
  lobbyPlayers?: number;
  /** Hold right and hop with keyboard player 1 so the camera, dust and trails move. */
  drive?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'lobby', q: 'seed=perf1', lobbyPlayers: 4 },
  { name: 'race8', q: 'seed=perf1&players=8&race=all', drive: true },
  { name: 'race8-volcano', q: 'seed=perf2&theme=volcano&players=8&race=all', drive: true },
  { name: 'race8-factory', q: 'seed=perf3&theme=factory&players=8&race=all', drive: true },
  { name: 'race8-jungle', q: 'seed=perf4&theme=jungle&players=8&race=all', drive: true },
  { name: 'race2-harbor', q: 'seed=perf5&theme=harbor&players=2&race=saw,laser,launcher', drive: true },
];
/** Frames per page.evaluate in step mode; the GPU is drained between chunks. */
const CHUNK = 6;
const COLS = ['frame', 'sim', 'render', 'bg', 'terrain', 'fx', 'liquid', 'lights', 'post', 'hud', 'other'] as const;

interface ScenarioResult {
  name: string;
  query: string;
  summary: Summary;
  info: Record<string, unknown>;
  errors: string[];
}

interface Report {
  meta: {
    date: string;
    git: string | null;
    loadavgStart: number[];
    loadavgEnd?: number[];
    [setting: string]: unknown;
  };
  scenarios: ScenarioResult[];
  gen?: { theme: string; genMs: number[]; bakeMs: number[]; frameMs?: number[]; frames?: number[] }[];
  load?: Record<string, unknown>;
}

mkdirSync(outDir, { recursive: true });
const server = await startServer();
console.log(`server up at ${server.base}`);
const browser = await launchBrowser(canvasMode === 'gpu' ? [] : ['--disable-accelerated-2d-canvas']);
const report: Report = {
  meta: {
    date: new Date().toISOString(),
    git: safe(() => execSync('git rev-parse --short HEAD').toString().trim()),
    dirty: safe(() => execSync('git status --porcelain -- src app').toString().trim().length > 0),
    chromium: browser.version(),
    viewport: `${W}x${H}`,
    seconds,
    warmup,
    runs,
    sync,
    canvas: canvasMode,
    mode,
    frames: maxFrames,
    cpus: cpus().length,
    loadavgStart: loadavg().map((x) => +x.toFixed(2)),
  },
  scenarios: [],
};

try {
  for (const sc of SCENARIOS) {
    if (only && !only.includes(sc.name)) continue;
    for (let r = 0; r < runs; r++) {
      const res = await runScenario(browser, sc);
      report.scenarios.push(res);
      console.log(`${sc.name}${runs > 1 ? ` #${r + 1}` : ''}: ${res.summary.fps.toFixed(1)} fps, render p50 ${res.summary.stats.render.p50.toFixed(2)} ms`);
    }
  }
  if (!only || only.includes('gen')) report.gen = await genScenario(browser);
  if (!only || only.includes('load')) report.load = await loadScenario(browser);
} finally {
  await browser.close();
  await server.close();
}
report.meta.loadavgEnd = loadavg().map((x) => +x.toFixed(2));

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = `${outDir}/${stamp}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
writeFileSync(`${outDir}/latest.json`, JSON.stringify(report, null, 2));
printTables(report);
if (compare) printCompare(JSON.parse(readFileSync(compare, 'utf8')) as Report, report);
console.log(file);
if (report.meta.loadavgStart[0] > cpus().length)
  console.log(`note: load average ${report.meta.loadavgStart.join(' ')} on ${cpus().length} CPUs: numbers are noisy`);
if (report.scenarios.some((s) => s.errors.length)) {
  for (const s of report.scenarios) if (s.errors.length) console.error(`${s.name} page errors:\n${s.errors.join('\n')}`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------

function safe<T>(f: () => T): T | null {
  try {
    return f();
  } catch {
    return null;
  }
}

async function newPage(b: Browser): Promise<{ page: Page; errors: string[] }> {
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  if (cpuSlow > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpuSlow });
  return { page, errors };
}

async function openGame(page: Page, q: string) {
  await page.goto(`${server.base}r/PERF?${q}&debug=perf${sync ? '&perfsync=1' : ''}${extra ? `&${extra}` : ''}`);
  await page.waitForFunction(() => 'slagPerf' in window, null, { timeout: 60_000 });
}

async function runScenario(b: Browser, sc: Scenario): Promise<ScenarioResult> {
  const { page, errors } = await newPage(b);
  await openGame(page, sc.q);
  if (sc.lobbyPlayers) {
    await page.evaluate((n) => {
      const d = (window as any).slagDebug;
      for (const dev of ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'].slice(0, n)) d.match.join(dev);
    }, sc.lobbyPlayers);
  }
  if (mode === 'raf') {
    await page.locator('canvas').first().focus();
    const driving = sc.drive ? drive(page) : null;
    await page.waitForTimeout(warmup * 1000);
    await page.evaluate(() => (window as any).slagPerf.start());
    // Stop at `frames` rendered frames or `seconds`, whichever comes first (software GL can be very slow).
    for (const t0 = Date.now(); Date.now() - t0 < seconds * 1000;) {
      await page.waitForTimeout(250);
      if ((await page.evaluate(() => (window as any).slagPerf.profiler.summary().frames)) >= maxFrames) break;
    }
    if (driving) driving.stop = true;
  } else {
    // Deterministic: pause the real-time loop, then 1 sim step + 1 render per frame on a fixed 60 Hz clock,
    // in chunks (so the page stays responsive). Keyboard player 1 runs right and hops when `drive` is set.
    await page.evaluate(() => (window as any).slagDebug.pause(true));
    const chunk = async (from: number, n: number, record: boolean) =>
      page.evaluate(
        ([from, n, record, drive]) => {
          const d = (window as any).slagDebug;
          const perf = (window as any).slagPerf;
          if (record && from === 0) perf.start();
          const base = perf.clock ?? (perf.clock = performance.now());
          for (let f = from; f < from + n; f++) {
            const hop = f % 36 < 15;
            const inp = drive
              ? {
                  kb1: {
                    left: false,
                    right: true,
                    up: false,
                    down: false,
                    jump: hop,
                    jumpPressed: f % 36 === 0,
                    run: true,
                    confirmPressed: false,
                    altPressed: false,
                    downPressed: false,
                  },
                }
              : {};
            d.match.step(inp);
            d.render(base + (f * 1000) / 60);
          }
          // Let SwiftShader drain its queue between chunks (untimed), or the backlog stalls random later frames.
          perf.profiler.flushGpu();
          perf.profiler.gap();
        },
        [from, n, record, !!sc.drive] as const,
      );
    const warm = Math.round(warmup * 60);
    for (let f = 0; f < warm; f += CHUNK) await chunk(f - warm, Math.min(CHUNK, warm - f), false);
    for (let f = 0; f < maxFrames; f += CHUNK) await chunk(f, Math.min(CHUNK, maxFrames - f), true);
  }
  const summary = (await page.evaluate(() => (window as any).slagPerf.summary())) as Summary;
  const info = (await page.evaluate(() => (window as any).slagPerf.info())) as Record<string, unknown>;
  await page.close();
  return { name: sc.name, query: sc.q, summary, info, errors };
}

/** Hold right + run and hop every ~0.6 s (keyboard player 1). */
function drive(page: Page) {
  const ctl = { stop: false };
  void (async () => {
    try {
      await page.keyboard.down('KeyD');
      await page.keyboard.down('ShiftLeft');
      while (!ctl.stop) {
        await page.keyboard.down('Space');
        await page.waitForTimeout(250);
        await page.keyboard.up('Space');
        await page.waitForTimeout(350);
      }
    } catch {
      // page closed
    }
  })();
  return ctl;
}

/** Level generation + first-frame bake cost in the browser, per theme. */
async function genScenario(b: Browser) {
  const { page } = await newPage(b);
  await openGame(page, 'seed=gen0');
  const out = await page.evaluate(
    ([themes, n]) => {
      const d = (window as any).slagDebug;
      d.pause(true);
      const rows: { theme: string; genMs: number[]; bakeMs: number[]; frameMs: number[]; frames: number[] }[] = [];
      for (const theme of themes) {
        const row = { theme, genMs: [] as number[], bakeMs: [] as number[], frameMs: [] as number[], frames: [] as number[] };
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          d.loadLevel(`gen-${theme}-${i}`, theme);
          const t1 = performance.now();
          d.render();
          row.genMs.push(+(t1 - t0).toFixed(2));
          row.bakeMs.push(+(performance.now() - t1).toFixed(2));
          // The same level again as the live game loads it: inked a chunk per frame. What a player
          // feels is the worst of those frames, not the total.
          d.loadLevel(`gen-${theme}-${i}b`, theme);
          d.renderer.bakeBudgetMs = 5;
          let worst = 0;
          let frames = 0;
          do {
            const f0 = performance.now();
            d.render();
            worst = Math.max(worst, performance.now() - f0);
            frames++;
            // Untimed, as the game's own loop presents every frame: frames run back to back without it pile up
            // GPU work until one random frame stalls for all of it, a spike no player sees.
            (window as any).slagPerf.profiler.flushGpu();
          } while ((d.renderer.terrain.baking || d.renderer.surround.baking) && frames < 2000);
          d.renderer.bakeBudgetMs = Infinity;
          row.frameMs.push(+worst.toFixed(2));
          row.frames.push(frames);
        }
        rows.push(row);
      }
      return rows;
    },
    [THEME_IDS, Number(opt('gen', '4'))] as const,
  );
  await page.close();
  console.log('gen: done');
  return out;
}

/** Cold-cache page loads: JS bytes per route (raw/gzip), time to first frame, and a server-bundle leak check. */
async function loadScenario(b: Browser) {
  const routes: Record<string, unknown> = {};
  for (const [name, path, ready] of [
    // `debug=load` marks the first frame without pulling the devtools chunk into the numbers.
    ['room', 'r/LOADTEST?debug=load', 'slag:first-frame'],
    ['home', '', null],
    ['codex', 'codex', null],
  ] as const) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    const scripts: { url: string; bytes: number; gzip: number }[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', (r) => {
      if (r.request().resourceType() !== 'script') return;
      pending.push(
        r
          .body()
          .then((buf) => void scripts.push({ url: r.url().replace(server.base, '/'), bytes: buf.length, gzip: gzipSync(buf).length }))
          .catch(() => {}),
      );
    });
    const t0 = Date.now();
    await page.goto(`${server.base}${path}`, { waitUntil: 'load' });
    let firstFrame: number | null = null;
    if (ready) {
      await page.waitForFunction((m) => performance.getEntriesByName(m).length > 0, ready, { timeout: 60_000 });
      firstFrame = await page.evaluate((m) => performance.getEntriesByName(m)[0].startTime, ready);
    } else await page.waitForTimeout(1500);
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return { domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd };
    });
    await Promise.all(pending);
    scripts.sort((a, b2) => b2.bytes - a.bytes);
    routes[name] = {
      wallMs: Date.now() - t0,
      ...nav,
      firstFrameMs: firstFrame,
      jsBytes: scripts.reduce((a, s) => a + s.bytes, 0),
      jsGzip: scripts.reduce((a, s) => a + s.gzip, 0),
      scripts,
    };
    await ctx.close();
  }
  // No game code in the server bundle: look for literals only the client game contains.
  const markers = ['#version 300 es', 'slagDebug', 'createDynamicsCompressor', 'quickStart'];
  const leaks: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js')) {
        const src = readFileSync(p, 'utf8');
        for (const m of markers) if (src.includes(m)) leaks.push(`${p.replace(/^\.next\//, '')}: ${m}`);
      }
    }
  };
  walk('.next/server');
  console.log('load: done');
  return { routes, serverLeaks: leaks };
}

// ---------------------------------------------------------------------------

function printTables(r: Report) {
  const rows = r.scenarios.map((s) => {
    const st = s.summary.stats;
    const row: Record<string, string | number> = { scenario: s.name, fps: +s.summary.fps.toFixed(1) };
    for (const c of COLS) row[c] = `${st[c].p50.toFixed(2)}/${st[c].p95.toFixed(2)}`;
    row.steps = +st.steps.mean.toFixed(2);
    row.simStep = +s.summary.simStep.toFixed(3);
    row.longTasks = `${s.summary.longTasks.count}/${s.summary.longTasks.ms.toFixed(0)}ms`;
    row.peak = `p${s.summary.peak.particles} l${s.summary.peak.lights} pr${s.summary.peak.props} pj${s.summary.peak.projectiles}`;
    return row;
  });
  if (rows.length) {
    console.log('frame-time ms, p50/p95 per rendered frame (sim = all sim steps in that frame)');
    console.table(rows);
  }
  if (r.gen) {
    console.table(
      r.gen.map((g) => ({
        theme: g.theme,
        genMsMedian: median(g.genMs),
        genMsMax: Math.max(...g.genMs),
        bakeMsMedian: median(g.bakeMs),
        bakeMsMax: Math.max(...g.bakeMs),
        // Progressive: the worst single frame while a new level inks in, and how many frames it took.
        frameMsMax: g.frameMs ? Math.max(...g.frameMs) : undefined,
        framesMax: g.frames ? Math.max(...g.frames) : undefined,
      })),
    );
  }
  if (r.load) {
    const routes = r.load.routes as Record<
      string,
      { jsBytes: number; jsGzip: number; firstFrameMs: number | null; domContentLoaded: number; scripts: unknown[] }
    >;
    console.table(
      Object.entries(routes).map(([k, v]) => ({
        route: k,
        scripts: v.scripts.length,
        jsKB: +(v.jsBytes / 1024).toFixed(1),
        gzipKB: +(v.jsGzip / 1024).toFixed(1),
        dclMs: +v.domContentLoaded.toFixed(0),
        firstFrameMs: v.firstFrameMs === null ? '-' : +v.firstFrameMs.toFixed(0),
      })),
    );
    const leaks = r.load.serverLeaks as string[];
    console.log(leaks.length ? `server bundle contains game code:\n  ${leaks.join('\n  ')}` : 'server bundle: no game code');
  }
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Flag p50/p95 changes worse than 15 % and 0.25 ms (both), per scenario and section. */
function printCompare(prev: Report, cur: Report) {
  const rows: Record<string, string>[] = [];
  let regressions = 0;
  for (const s of cur.scenarios) {
    const p = prev.scenarios.find((x) => x.name === s.name);
    if (!p) continue;
    for (const c of ['sim', 'render', ...COLS.slice(3)] as const) {
      for (const q of ['p50', 'p95'] as const) {
        const a = p.summary.stats[c]?.[q];
        const b = s.summary.stats[c]?.[q];
        if (a === undefined || b === undefined) continue;
        const d = b - a;
        const rel = a > 0 ? d / a : 0;
        const bad = d > 0.25 && rel > 0.15;
        const good = d < -0.25 && rel < -0.15;
        if (bad) regressions++;
        if (bad || good)
          rows.push({
            scenario: s.name,
            metric: `${c}.${q}`,
            before: a.toFixed(2),
            after: b.toFixed(2),
            change: `${(rel * 100).toFixed(0)}%`,
            verdict: bad ? 'REGRESSION' : 'faster',
          });
      }
    }
  }
  console.log(`compare vs ${prev.meta.date} (${prev.meta.git ?? 'unknown commit'}):`);
  if (rows.length) console.table(rows);
  else console.log('  no significant changes');
  if (regressions)
    console.log(
      `${regressions} regression(s): re-run to rule out machine noise (loadavg before: ${prev.meta.loadavgStart.join(' ')}, now: ${cur.meta.loadavgStart.join(' ')})`,
    );
}
