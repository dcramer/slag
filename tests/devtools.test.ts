import { describe, expect, it } from 'vitest';
import { METRICS, Profiler, SECTIONS, stat } from '../src/devtools/profiler';
import { Match } from '../src/game/match';
import type { Renderer } from '../src/render/renderer';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** Just the parts of Renderer the profiler looks at: `render` calls one named section. */
function fakeRenderer() {
  const r = {
    fx: {
      ps: [1, 2, 3],
      update() {},
      draw() {},
    },
    hud: { draw() {} },
    render() {
      r.fx.draw();
      r.hud.draw();
    },
  };
  return r;
}

const asRenderer = (r: ReturnType<typeof fakeRenderer>) => r as unknown as Renderer;

/** A short match with scripted input, returning everything a run decides. */
function play(seed: number, profiled: boolean) {
  const m = new Match(seed);
  const r = fakeRenderer();
  if (profiled) new Profiler(m, asRenderer(r)).start();
  const held = (over: Partial<InputFrame>) => ({ kb1: { ...NO_INPUT, ...over }, kb2: { ...NO_INPUT, ...over } });
  m.step(held({ confirmPressed: true })); // join
  m.step(held({ confirmPressed: true })); // ready
  for (let f = 0; f < 240; f++) {
    m.step(held({ right: true, jump: f % 40 < 20, jumpPressed: f % 40 === 0, confirmPressed: f % 30 === 0 }));
    r.render();
    m.drainEvents();
  }
  return {
    frame: m.frame,
    phase: m.phase,
    scores: m.players.map((p) => p.score),
    tiles: Array.from(m.level.tiles),
    placed: m.placed.length,
  };
}

describe('devtools profiler', () => {
  it('does not change the simulation', () => {
    expect(play(4242, true)).toEqual(play(4242, false));
  });

  it('counts sim steps and render frames, and keeps return values', () => {
    const m = new Match(1);
    const r = fakeRenderer();
    const p = new Profiler(m, asRenderer(r));
    p.start();
    m.step({});
    m.step({});
    r.render();
    r.render();
    const s = p.summary();
    expect(s.frames).toBe(2);
    expect(p.series('steps')).toEqual(new Float32Array([2, 0]));
    expect(s.peak.particles).toBe(3);
    expect(s.stats.render.mean).toBeGreaterThanOrEqual(0);
    expect(Object.keys(s.stats).sort()).toEqual([...METRICS].sort());
  });

  it('records nothing until started', () => {
    const m = new Match(1);
    const r = fakeRenderer();
    const p = new Profiler(m, asRenderer(r));
    m.step({});
    r.render();
    expect(p.summary().frames).toBe(0);
  });

  it('skips targets that were renamed instead of failing, leaving their time in `other`', () => {
    const r = { render() {} };
    const p = new Profiler(new Match(1), r as unknown as Renderer);
    p.start();
    r.render();
    expect(p.summary().frames).toBe(1);
    expect(p.series('other').length).toBe(1);
    expect(SECTIONS).toContain('other');
  });
});

describe('stat', () => {
  it('summarizes a series and ignores frames with no sample', () => {
    const s = stat(new Float32Array([4, Number.NaN, 1, 3, 2]));
    expect(s.mean).toBe(2.5);
    expect(s.max).toBe(4);
    expect(s.p50).toBe(3);
  });

  it('is all zeros for an empty series', () => {
    expect(stat(new Float32Array(0))).toEqual({ mean: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });
});
