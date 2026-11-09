/**
 * Cross-engine determinism: the same seeds, themes and scripted inputs run headless in Chromium, Firefox and WebKit,
 * in pages from the production build, and every frame's state hash must agree with Chromium's. Lockstep only works if
 * the sim is a pure function of (seed, inputs) in every browser, not just in V8, and nothing else checks that.
 *
 *   pnpm determinism                          # every case, every engine (~3 min)
 *   pnpm determinism -- --engines chromium,webkit
 *   pnpm determinism -- --only levels,race-farm,match
 *
 * Cases: `levels` (every theme × size × a few seeds: tiles, set pieces, look, crate), `race-<theme>` (eight runners
 * with one of every archetype placed, weather rotated, held items on half of them, ~15 s of scripted input), `gravity`
 * (forced low and high gravity), `match` (four players through pick, place, race and scoring for several rounds,
 * clicking at random), and `brawl` (four of the page's own bots on an arena, armed, pressing the fight round after
 * round, each on a fresh arena, so knocks bounce off rock, swings sweep their dsin/dcos boxes, and bodies bump, check,
 * shove and slip). On a mismatch it prints the first frame that differs and the snapshot fields that differ there.
 * Exits non-zero on any divergence or page error.
 */
import { argReader, type Engine, engineList, launchEngine, startServer, watchdog } from './lib/server';
import type { Browser, Page } from 'playwright';
import { THEME_IDS } from '../src/themes';
import { WEATHER_KINDS } from '../src/sim/weather';

const args = argReader(process.argv.slice(2));
const engines = engineList(args.opt('engines'));
const only = args.opt('only')?.split(',');
const pet = watchdog(Number(process.env.SHOT_TIMEOUT ?? 300));

interface Case {
  name: string;
  /** Page query (debug params: `race`, `players`, `theme`, `seed`, `weather`, `give`, `gravity`, `size`). */
  query: string;
  frames: number;
  /** Seed of the scripted input stream. */
  inputSeed: number;
  /** Rules applied before the first frame (a full match needs timers, or nothing ever advances). */
  rules?: Record<string, number>;
  /** The page's own bots play every seat (`?bots=N`): brawl's fighters, who press the fight as people do. */
  bots?: boolean;
}

const RACE_FRAMES = 2400;
/** Short timers, so a case that outlives its race goes on through pick, place and the next race with every part still placed. */
const CYCLE = { pickSeconds: 4, placeSeconds: 6, raceSeconds: 20, targetScore: 80, maxRounds: 25 };
const cases: Case[] = [
  ...THEME_IDS.map((t, i) => ({
    name: `race-${t}`,
    query: `race=all&players=8&theme=${t}&seed=xe${t}&weather=${WEATHER_KINDS[i % WEATHER_KINDS.length]}${i % 2 ? '&give=all' : ''}`,
    frames: RACE_FRAMES,
    inputSeed: 1000 + i,
    rules: CYCLE,
  })),
  { name: 'gravity-low', query: 'race=all&players=6&theme=castle&seed=xelow&gravity=0.7&size=tall&give=all', frames: RACE_FRAMES, inputSeed: 77, rules: CYCLE },
  { name: 'gravity-high', query: 'race=all&players=6&theme=harbor&seed=xehigh&gravity=1.35&size=wide', frames: RACE_FRAMES, inputSeed: 78, rules: CYCLE },
  {
    name: 'match',
    query: 'players=4&seed=xematch',
    frames: 7200,
    inputSeed: 5,
    rules: CYCLE,
  },
  {
    name: 'brawl',
    query: 'mode=brawl&bots=4&race=,&seed=xebrawl',
    frames: 4800,
    inputSeed: 9,
    rules: CYCLE,
    bots: true,
  },
];
const LEVEL_SEEDS = [11, 2024, 90210];
const LEVEL_SIZES = ['classic', 'wide', 'tall'] as const;

/**
 * Runs in the page. Steps the paused match `frames` times with inputs from a xorshift stream (integer ops only, so
 * the stream is the same everywhere) and returns the state hash after every frame, or, with `snapAt`, the snapshot
 * at that frame. Runners walk right mostly, jump, run, drop, use items and now and then hold alt; in pick and place
 * the pointer wanders and clicks.
 */
function drive(o: { frames: number; seed: number; rules?: Record<string, number>; snapAt?: number; bots?: boolean }): {
  hashes: number[];
  phases: Record<string, number>;
  /** What the case got up to: item hits and bumps, deaths, and dazed bodies sent back the way they came (bounces). */
  seen: Record<string, number>;
  snap?: string;
} {
  const d = (window as any).slagDebug;
  const m = d.match;
  if (o.rules) Object.assign(m.rules, o.rules);
  let s = o.seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const state = new Map<string, { dir: number; dirLeft: number; jump: number; run: boolean; down: number; up: number; alt: number; px: number; py: number }>();
  const hashes: number[] = [];
  const phases: Record<string, number> = {};
  const seen: Record<string, number> = {};
  const lastVx = new Map<number, number>();
  for (let f = 1; f <= o.frames; f++) {
    phases[m.phase] = (phases[m.phase] ?? 0) + 1;
    const inputs: Record<string, unknown> = {};
    const aiming = m.phase === 'pick' || m.phase === 'place';
    for (const p of m.players) {
      let st = state.get(p.device);
      if (!st) {
        st = { dir: 1, dirLeft: 0, jump: 0, run: false, down: 0, up: 0, alt: 0, px: 384, py: 216 };
        state.set(p.device, st);
      }
      if (--st.dirLeft <= 0) {
        const r = rnd();
        st.dir = r < 0.7 ? 1 : r < 0.85 ? -1 : 0;
        st.dirLeft = 20 + Math.floor(rnd() * 70);
        st.run = rnd() < 0.5;
      }
      const jumpPressed = st.jump === 0 && rnd() < 0.06;
      if (jumpPressed) st.jump = 3 + Math.floor(rnd() * 18);
      else if (st.jump > 0) st.jump--;
      if (st.down > 0) st.down--;
      else if (rnd() < 0.01) st.down = 4 + Math.floor(rnd() * 10);
      if (st.up > 0) st.up--;
      else if (rnd() < 0.01) st.up = 10 + Math.floor(rnd() * 30);
      const altPressed = st.alt === 0 && rnd() < 0.0005;
      if (altPressed) st.alt = 20 + Math.floor(rnd() * 80);
      else if (st.alt > 0) st.alt--;
      let pointer: { x: number; y: number } | undefined;
      if (aiming && rnd() < 0.3) {
        st.px = Math.max(0, Math.min(767, st.px + Math.floor(rnd() * 121) - 60));
        st.py = Math.max(0, Math.min(431, st.py + Math.floor(rnd() * 81) - 40));
        pointer = { x: st.px, y: st.py };
      }
      inputs[p.device] = {
        left: st.dir < 0,
        right: st.dir > 0,
        up: st.up > 0,
        down: st.down > 0,
        jump: st.jump > 0,
        jumpPressed,
        run: st.run,
        confirmPressed: aiming ? rnd() < 0.03 : rnd() < 0.005,
        altPressed,
        alt: st.alt > 0,
        downPressed: st.down > 0 && rnd() < 0.2,
        usePressed: rnd() < 0.01,
        pointer,
      };
    }
    m.step(o.bots ? d.botInputs() : inputs);
    for (const e of m.drainEvents()) {
      const k = e.type === 'item' && e.what === 'hit' ? `hit:${e.kind}` : e.type === 'death' ? 'death' : '';
      if (k) seen[k] = (seen[k] ?? 0) + 1;
    }
    for (const r of m.run?.runners ?? []) {
      const was = lastVx.get(r.slot) ?? 0;
      if (r.items.daze > 0 && Math.abs(was) > 100 && r.body.vx * was < 0) seen.bounce = (seen.bounce ?? 0) + 1;
      lastVx.set(r.slot, r.body.vx);
    }
    if (o.snapAt === f) return { hashes, phases, seen, snap: JSON.stringify(d.snapshot()) };
    hashes.push(d.hash());
  }
  return { hashes, phases, seen };
}

/** Runs in the page: every theme × size × seed generated fresh, hashed over the whole level and the crate it deals. */
function levels(o: { themes: string[]; sizes: string[]; seeds: number[]; only?: string }): { key: string; hash: number; json?: string }[] {
  const d = (window as any).slagDebug;
  const m = d.match;
  const fnv = (str: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
    return h >>> 0;
  };
  const plain = (_k: string, v: unknown) => (v instanceof Uint8Array ? Array.from(v) : v instanceof Map ? [...v.entries()] : v);
  const out: { key: string; hash: number; json?: string }[] = [];
  for (const theme of o.themes)
    for (const size of o.sizes)
      for (const seed of o.seeds) {
        const key = `${theme}/${size}/${seed}`;
        if (o.only && o.only !== key) continue;
        m.forceProfile = { size };
        m.newLevel(seed, theme);
        const json = JSON.stringify({ level: m.level, snap: d.snapshot() }, plain);
        out.push({ key, hash: fnv(json), json: o.only ? json : undefined });
      }
  return out;
}

/** Paths where two JSON values differ, at most `max`. */
function diff(a: unknown, b: unknown, path = '', out: string[] = [], max = 25): string[] {
  if (out.length >= max) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (a !== b && JSON.stringify(a) !== JSON.stringify(b))
      out.push(`${path || '.'}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`);
    return out;
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out, max);
  return out;
}

const server = await startServer({ env: { SLAG_SIGNAL_STORE: 'memory' } });
const browsers = new Map<Engine, Browser>();
let failures = 0;
const errors: string[] = [];

/** A paused game page: the setter pauses the loop the moment the debug API exists, before any real-time frame runs. */
async function open(engine: Engine, query: string): Promise<Page> {
  let b = browsers.get(engine);
  if (!b) browsers.set(engine, (b = await launchEngine(engine)));
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.addInitScript('window.__name = (f) => f'); // tsx wraps named functions in code handed to evaluate
  await ctx.addInitScript(() => {
    let api: any;
    Object.defineProperty(window, 'slagDebug', {
      configurable: true,
      get: () => api,
      set: (v) => {
        api = v;
        v?.pause(true);
      },
    });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${engine}: ${String(e)}`));
  p.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon/.test(msg.text())) errors.push(`${engine}: ${msg.text()}`);
  });
  await p.goto(`${server.base}r/XENGINE?net=off&ui=0&salt=1&${query}`);
  await p.waitForFunction(() => (window as any).slagDebug?.match, null, { timeout: 120_000 });
  return p;
}

async function closePage(p: Page) {
  await p.context().close();
}

async function runCase(c: Case) {
  const t0 = performance.now();
  const results = await Promise.all(
    engines.map(async (e) => {
      const p = await open(e, c.query);
      const r = await p.evaluate(drive, { frames: c.frames, seed: c.inputSeed, rules: c.rules, bots: c.bots });
      const info = await p.evaluate(() => {
        const m = (window as any).slagDebug.match;
        return `${m.level.style} ${m.level.w}×${m.level.h} g${m.level.gravity ?? 1} ${m.level.weather?.kind ?? 'clear'}, ${m.players.length} players, ${m.placed.length} parts, round ${m.round}`;
      });
      await closePage(p);
      pet();
      return {
        e,
        hashes: r.hashes,
        info: `${info}, ${[...Object.entries(r.phases), ...Object.entries(c.bots ? r.seen : {})].map(([k, n]) => `${k} ${n}`).join(' ')}`,
      };
    }),
  );
  const ref = results[0];
  let bad = false;
  for (const r of results.slice(1)) {
    const at = r.hashes.findIndex((h, i) => h !== ref.hashes[i]);
    if (at < 0 && r.hashes.length === ref.hashes.length) continue;
    bad = true;
    const frame = at + 1;
    console.log(`  FAIL ${c.name}: ${r.e} parts from ${ref.e} after scripted frame ${frame}`);
    const snaps = await Promise.all(
      [ref.e, r.e].map(async (e) => {
        const p = await open(e, c.query);
        const s = await p.evaluate(drive, { frames: c.frames, seed: c.inputSeed, rules: c.rules, bots: c.bots, snapAt: frame });
        await closePage(p);
        return JSON.parse(s.snap ?? 'null');
      }),
    );
    for (const line of diff(snaps[0], snaps[1])) console.log(`       ${line}`);
  }
  if (bad) failures++;
  else
    console.log(
      `  ok   ${c.name}: ${ref.hashes.length} frames agree on ${engines.join(', ')} (${ref.info}; ${((performance.now() - t0) / 1000).toFixed(0)} s)`,
    );
}

async function runLevels() {
  const t0 = performance.now();
  const o = { themes: [...THEME_IDS], sizes: [...LEVEL_SIZES], seeds: LEVEL_SEEDS };
  const results = await Promise.all(
    engines.map(async (e) => {
      const p = await open(e, '');
      const r = await p.evaluate(levels, o);
      await closePage(p);
      pet();
      return { e, r };
    }),
  );
  const ref = results[0];
  let bad = 0;
  for (const { e, r } of results.slice(1)) {
    for (let i = 0; i < r.length; i++) {
      if (r[i].hash === ref.r[i].hash) continue;
      bad++;
      console.log(`  FAIL levels: ${r[i].key} differs between ${ref.e} and ${e}`);
      const jsons = await Promise.all(
        [ref.e, e].map(async (x) => {
          const p = await open(x, '');
          const one = await p.evaluate(levels, { ...o, only: r[i].key });
          await closePage(p);
          return JSON.parse(one[0].json ?? 'null');
        }),
      );
      for (const line of diff(jsons[0], jsons[1])) console.log(`       ${line}`);
    }
  }
  if (bad) failures++;
  else console.log(`  ok   levels: ${ref.r.length} levels agree on ${engines.join(', ')} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
}

console.log(`engines: ${engines.join(', ')}`);
try {
  if (!only || only.includes('levels')) await runLevels();
  for (const c of cases) if (!only || only.includes(c.name)) await runCase(c);
} finally {
  for (const b of browsers.values()) await b.close().catch(() => {});
  await server.close();
}
if (errors.length) {
  failures++;
  console.log(`  FAIL page errors:\n    ${[...new Set(errors)].slice(0, 20).join('\n    ')}`);
}
console.log(failures ? `\n${failures} determinism check(s) failed` : '\nevery engine agrees');
process.exit(failures ? 1 : 0);
