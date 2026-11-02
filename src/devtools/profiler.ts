import type { Match } from '../game/match';
import type { Renderer } from '../render/renderer';

/**
 * Frame profiler for the dev overlay and `pnpm perf`.
 *
 * It instruments by wrapping methods on the live Match/Renderer objects
 * instead of sprinkling timers through hot files many people edit. Each
 * wrapped method adds its wall time to a named section of the current
 * frame. A frame ends when `renderer.render` returns. Wrappers whose target
 * is missing (renamed or refactored) are skipped, and their time shows up
 * under `other`. When the profiler is idle a wrapper costs one boolean check.
 *
 * Timings are CPU wall time on the main thread. Canvas2D/WebGL work that
 * the browser defers (GPU raster, texture upload) lands wherever it gets
 * flushed, usually in `post`. Set `sync` to read back one pixel after
 * compositing, which charges the GPU's work to `post` (slower, but honest).
 */

/** Sections inside a render call, in draw order. `other` = render minus the rest (props, characters, markers). */
export const SECTIONS = ['bake', 'bg', 'terrain', 'fx', 'liquid', 'lights', 'post', 'hud', 'other'] as const;
export type Section = (typeof SECTIONS)[number];
/** Per-frame metrics stored in the ring buffer. */
export const METRICS = ['frame', 'sim', 'steps', 'render', ...SECTIONS] as const;
export type Metric = (typeof METRICS)[number];

const CAP = 2048;

export interface Counts {
  particles: number;
  lights: number;
  props: number;
  projectiles: number;
  runners: number;
}

export interface Stat {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface Summary {
  frames: number;
  seconds: number;
  fps: number;
  stats: Record<Metric, Stat>;
  /** Mean ms of one sim step (sim ÷ steps over the window). */
  simStep: number;
  longTasks: { count: number; ms: number };
  peak: Counts;
  heapMB: number | null;
}

type AnyFn = (...a: any[]) => any;

export class Profiler {
  /** Recording (wrappers time their calls). */
  on = false;
  /** Force a GPU sync after compositing so `post` includes GPU time. */
  sync = false;
  readonly buf: Record<Metric, Float32Array>;
  private n = 0;
  private head = 0;
  private cur: Record<Section, number>;
  private simAcc = 0;
  private stepAcc = 0;
  private lastFrameStart = 0;
  private t0 = 0;
  private longTasks = { count: 0, ms: 0 };
  readonly counts: Counts = { particles: 0, lights: 0, props: 0, projectiles: 0, runners: 0 };
  readonly peak: Counts = { particles: 0, lights: 0, props: 0, projectiles: 0, runners: 0 };
  /** ms of the last level generation seen through match.newLevel. */
  lastGenMs = 0;
  /** Set when a new level was generated; the next frame's terrain/backdrop bake is charged to `bake`. */
  private pendingBake = false;
  private inRender = false;
  private renderer: Renderer;
  private match: Match;

  constructor(match: Match, renderer: Renderer) {
    this.match = match;
    this.renderer = renderer;
    this.buf = Object.fromEntries(METRICS.map((m) => [m, new Float32Array(CAP)])) as Record<Metric, Float32Array>;
    this.cur = Object.fromEntries(SECTIONS.map((s) => [s, 0])) as Record<Section, number>;
    this.instrument();
    try {
      new PerformanceObserver((list) => {
        if (!this.on) return;
        for (const e of list.getEntries()) {
          this.longTasks.count++;
          this.longTasks.ms += e.duration;
        }
      }).observe({ type: 'longtask', buffered: false });
    } catch {
      // longtask entries are Chromium-only
    }
  }

  start() {
    this.reset();
    this.on = true;
  }

  reset() {
    this.n = 0;
    this.head = 0;
    this.simAcc = 0;
    this.stepAcc = 0;
    this.lastFrameStart = 0;
    this.longTasks = { count: 0, ms: 0 };
    this.t0 = performance.now();
    for (const k of Object.keys(this.peak) as (keyof Counts)[]) this.peak[k] = 0;
  }

  /** The next frame interval isn't meaningful (harness paused, GPU flushed): leave it out of `frame` stats. */
  gap() {
    this.lastFrameStart = 0;
  }

  /** Wait for the GPU to finish queued work (outside any timed section). */
  flushGpu() {
    const r = this.renderer as unknown as { comp?: { gl?: WebGL2RenderingContext }; glCanvas?: HTMLCanvasElement };
    if (r.comp) syncGpu(r.comp, r.glCanvas);
  }

  /** Last `k` values of a metric, oldest first. */
  series(m: Metric, k = CAP): Float32Array {
    const len = Math.min(k, this.n);
    const out = new Float32Array(len);
    const b = this.buf[m];
    for (let i = 0; i < len; i++) out[i] = b[(this.head - len + i + CAP) % CAP];
    return out;
  }

  summary(): Summary {
    const stats = {} as Record<Metric, Stat>;
    for (const m of METRICS) stats[m] = stat(this.series(m));
    const steps = this.series('steps').reduce((a, b) => a + b, 0);
    const sim = this.series('sim').reduce((a, b) => a + b, 0);
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const seconds = (performance.now() - this.t0) / 1000;
    return {
      frames: Math.min(this.n, CAP),
      seconds,
      fps: this.n / Math.max(1e-3, seconds),
      stats,
      simStep: steps ? sim / steps : 0,
      longTasks: { ...this.longTasks },
      peak: { ...this.peak },
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
    };
  }

  // -------------------------------------------------------------- instrumentation

  private instrument() {
    const r = this.renderer as unknown as Record<string, any>;
    // Sim: every Match.step call, wherever it comes from (game loop, slagDebug.step, netcode).
    this.wrap(this.match as unknown as Record<string, unknown>, 'step', (dt) => {
      this.simAcc += dt;
      this.stepAcc++;
    });
    this.wrap(this.match as unknown as Record<string, unknown>, 'newLevel', (dt) => {
      this.lastGenMs = dt;
      this.pendingBake = true;
    });
    const sec = (s: Section) => (dt: number) => {
      if (this.inRender) this.cur[s] += dt;
    };
    if (r.backdrop) {
      this.wrap(r.backdrop, 'draw', sec('bg'));
      this.wrap(r.backdrop, 'drawLiquid', sec('liquid'));
      this.wrap(r.backdrop, 'drawMotes', sec('liquid'));
    }
    if (r.terrain) {
      this.wrap(r.terrain, 'ensure', sec('bake'));
      for (const m of ['drawShadow', 'draw', 'drawLive']) this.wrap(r.terrain, m, sec('terrain'));
    }
    if (r.fx) for (const m of ['update', 'draw']) this.wrap(r.fx, m, sec('fx'));
    this.wrap(r, 'paintLights', sec('lights'), (_level: unknown, lights: unknown[]) => {
      this.counts.lights = lights?.length ?? 0;
    });
    if (r.comp) {
      this.wrap(r.comp, 'render', sec('post'), undefined, () => {
        if (this.sync) syncGpu(r.comp, r.glCanvas);
      });
    }
    if (r.hud) this.wrap(r.hud, 'draw', sec('hud'));
    // The frame itself.
    const render = r.render as AnyFn;
    r.render = (...a: unknown[]) => {
      if (!this.on) return render.apply(r, a);
      const t = performance.now();
      this.inRender = true;
      for (const s of SECTIONS) this.cur[s] = 0;
      try {
        return render.apply(r, a);
      } finally {
        this.inRender = false;
        this.endFrame(t, performance.now());
      }
    };
  }

  /**
   * Replace obj[name] with a timing wrapper. `done(ms)` gets the call's wall time; `before`
   * sees the arguments; `after` runs inside the timed region (e.g. a GPU sync).
   */
  private wrap(obj: Record<string, unknown>, name: string, done: (ms: number) => void, before?: AnyFn, after?: () => void) {
    const fn = obj?.[name];
    if (typeof fn !== 'function') return;
    obj[name] = (...a: unknown[]) => {
      if (!this.on) return fn.apply(obj, a);
      before?.(...a);
      const t = performance.now();
      try {
        const v = fn.apply(obj, a);
        after?.();
        return v;
      } finally {
        done(performance.now() - t);
      }
    };
  }

  private endFrame(start: number, end: number) {
    const c = this.cur;
    const render = end - start;
    // The first frame after a new level re-bakes terrain and backdrop: book it as `bake`, not `bg`/`terrain`.
    if (this.pendingBake) {
      c.bake += c.bg + c.terrain;
      c.bg = 0;
      c.terrain = 0;
      this.pendingBake = false;
    }
    let known = 0;
    for (const s of SECTIONS) if (s !== 'other') known += c[s];
    c.other = Math.max(0, render - known);
    const i = this.head;
    const b = this.buf;
    b.frame[i] = this.lastFrameStart ? start - this.lastFrameStart : Number.NaN;
    b.sim[i] = this.simAcc;
    b.steps[i] = this.stepAcc;
    b.render[i] = render;
    for (const s of SECTIONS) b[s][i] = c[s];
    this.lastFrameStart = start;
    this.simAcc = 0;
    this.stepAcc = 0;
    this.head = (i + 1) % CAP;
    this.n++;
    this.sampleCounts();
  }

  private sampleCounts() {
    const m = this.match;
    const fx = (this.renderer as unknown as { fx?: { ps?: unknown[] } }).fx;
    const k = this.counts;
    k.particles = fx?.ps?.length ?? 0;
    const run = m.phase === 'run' ? m.run : null;
    k.props = run ? run.resolved.length : m.level.setPieces.length + m.placed.length;
    k.projectiles = run?.projectiles.length ?? 0;
    k.runners = run ? run.runners.filter((x) => x.alive).length : m.players.length;
    for (const key of Object.keys(k) as (keyof Counts)[]) if (k[key] > this.peak[key]) this.peak[key] = k[key];
  }
}

function syncGpu(comp: { gl?: WebGL2RenderingContext }, canvas?: HTMLCanvasElement) {
  const gl = comp.gl ?? (canvas?.getContext('webgl2') as WebGL2RenderingContext | null);
  if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PIXEL);
}
const PIXEL = new Uint8Array(4);

/** Percentiles of a series (NaN entries = no sample). */
export function stat(v: Float32Array): Stat {
  const s = v.filter((x) => !Number.isNaN(x)).sort();
  if (!s.length) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  let sum = 0;
  for (const x of s) sum += x;
  return { mean: sum / s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}
