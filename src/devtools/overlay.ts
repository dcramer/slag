import type { SlagDebug } from '../debug';
import { loadProfile } from '../ui/profile';
import { type METRICS, Profiler, SECTIONS, stat } from './profiler';

/**
 * Dev overlay: FPS, frame-time breakdown, entity counts, canvas sizes, heap
 * and level info, plus a frame-time graph. See `installDevtoolsHooks` in
 * src/debug.ts for how it's reached; tools/perf.ts drives the same profiler
 * through `window.slagPerf`.
 *
 * Loaded lazily, so the main bundle carries none of it. It's DOM text
 * refreshed at 4 Hz plus a small canvas graph redrawn on the same tick, so
 * having it open costs well under a millisecond per frame.
 */

export interface SlagPerf {
  profiler: Profiler;
  /** Clear samples and start recording. */
  start(): void;
  stop(): void;
  summary(): ReturnType<Profiler['summary']>;
  /** Raw per-frame series for `metric` (oldest first). */
  series(metric: (typeof METRICS)[number]): number[];
  /** Static facts: canvas sizes, DPR, compositor kind, level/theme. */
  info(): Record<string, unknown>;
  /** Show or hide the overlay; with no argument, toggle it. */
  show(on?: boolean): void;
}

const GRAPH_W = 240;
const GRAPH_H = 48;
const BUDGET = 1000 / 60;

/** Installs the profiler and a hidden overlay, once. Wrapping the same objects twice would double-count every section. */
export function installDevtools(dbg: SlagDebug): SlagPerf {
  const existing = (window as unknown as { slagPerf?: SlagPerf }).slagPerf;
  if (existing) return existing;
  const prof = new Profiler(dbg.match, dbg.renderer);
  prof.sync = new URLSearchParams(location.search).get('perfsync') === '1';
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;left:6px;top:6px;z-index:99999;pointer-events:none;background:rgba(8,8,14,0.78);color:#cfe;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:4px;white-space:pre;display:none';
  const graph = document.createElement('canvas');
  graph.width = GRAPH_W;
  graph.height = GRAPH_H;
  graph.style.cssText = `display:block;width:${GRAPH_W}px;height:${GRAPH_H}px;margin-top:4px`;
  const text = document.createElement('div');
  root.append(text, graph);
  document.body.append(root);
  let timer = 0;

  const info = () => {
    const r = dbg.renderer as unknown as Record<string, any>;
    const m = dbg.match;
    const size = (c?: HTMLCanvasElement | null) => (c ? `${c.width}×${c.height}` : '-');
    return {
      dpr: window.devicePixelRatio,
      viewport: `${innerWidth}×${innerHeight}`,
      webgl: r.comp?.webgl ?? null,
      canvases: {
        gl: size(r.glCanvas),
        scene: size(r.scene),
        glow: size(r.glow),
        light: size(r.lightC),
        hud: size(r.hudCanvas),
        terrainBake: size(r.terrain?.bake),
      },
      seed: m.seed,
      theme: m.level.theme.id,
      style: m.level.style,
      level: `${m.level.w}×${m.level.h}`,
      phase: m.phase,
      players: m.players.length,
      profile: loadProfile().name ?? '(random name)',
    };
  };

  const refresh = () => {
    const s = prof.summary();
    const k = prof.counts;
    const i = info();
    const recent = (m: (typeof METRICS)[number]) => stat(prof.series(m, 60));
    const f = recent('frame');
    const ms = (x: number) => x.toFixed(2).padStart(8);
    const rows = SECTIONS.map((sec) => {
      const st = recent(sec);
      return `  ${sec.padEnd(8)}${ms(st.mean)}${ms(st.p95)}`;
    });
    const sim = recent('sim');
    const steps = recent('steps');
    const render = recent('render');
    text.textContent = [
      `slag dev   ${(1000 / Math.max(1e-3, f.mean)).toFixed(0)} fps   frame ${f.mean.toFixed(1)} ms (p95 ${f.p95.toFixed(1)})`,
      `ms (60f)      mean     p95`,
      `sim     ${ms(sim.mean)}${ms(sim.p95)}   ${steps.mean.toFixed(2)} steps/render, ${s.simStep.toFixed(3)} ms/step`,
      `render  ${ms(render.mean)}${ms(render.p95)}`,
      ...rows,
      `long tasks ${s.longTasks.count} (${s.longTasks.ms.toFixed(0)} ms)   gen ${prof.lastGenMs.toFixed(0)} ms`,
      `particles ${k.particles}  lights ${k.lights}  props ${k.props}  proj ${k.projectiles}  runners ${k.runners}`,
      `gl ${i.canvases.gl} scene ${i.canvases.scene} light ${i.canvases.light} bake ${i.canvases.terrainBake}`,
      `dpr ${i.dpr}  view ${i.viewport}  ${i.webgl ? 'webgl2' : 'canvas2d fallback'}  heap ${s.heapMB === null ? 'n/a' : `${s.heapMB.toFixed(1)} MB`}`,
      `seed ${i.seed}  ${i.theme}/${i.style}  ${i.level}  ${i.phase}  p${i.players}  profile:${i.profile}`,
    ].join('\n');
    drawGraph(graph, prof.series('frame', GRAPH_W), prof.series('render', GRAPH_W));
  };

  const api: SlagPerf = {
    profiler: prof,
    start: () => prof.start(),
    stop: () => {
      prof.on = false;
    },
    summary: () => prof.summary(),
    series: (m) => Array.from(prof.series(m)),
    info,
    show(on = root.style.display === 'none') {
      root.style.display = on ? 'block' : 'none';
      clearInterval(timer);
      prof.on = on;
      if (on) {
        prof.start();
        refresh();
        timer = window.setInterval(refresh, 250);
      }
    },
  };
  (window as unknown as { slagPerf: SlagPerf }).slagPerf = api;
  return api;
}

function drawGraph(c: HTMLCanvasElement, frame: Float32Array, render: Float32Array) {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  const scale = GRAPH_H / (BUDGET * 3);
  const x0 = GRAPH_W - frame.length;
  for (let i = 0; i < frame.length; i++) {
    const fh = Math.min(GRAPH_H, frame[i] * scale);
    const rh = Math.min(GRAPH_H, render[i] * scale);
    g.fillStyle = frame[i] > BUDGET * 1.5 ? '#f65' : '#4a8';
    g.fillRect(x0 + i, GRAPH_H - fh, 1, fh);
    g.fillStyle = 'rgba(120,180,255,0.9)';
    g.fillRect(x0 + i, GRAPH_H - rh, 1, rh);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, GRAPH_H - BUDGET * scale, GRAPH_W, 1);
  g.fillRect(0, GRAPH_H - BUDGET * 2 * scale, GRAPH_W, 1);
}
