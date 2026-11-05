import { afterEach, describe, expect, it, vi } from 'vitest';
import { FramePacing, type FrameSummary, FrameWindow, MIN_MS, reportFrames } from '../src/frame-pacing';
import { installTelemetry, MAX_METRICS_PER_NAME, reportMetric, type TelemetryReporter } from '../src/telemetry';

afterEach(() => installTelemetry(null));

function windowOf(intervals: number[]): FrameWindow {
  const w = new FrameWindow();
  for (const ms of intervals) w.push(ms);
  return w;
}

describe('frame window', () => {
  it('counts slow frames and hitches, and puts p95 on the slow tail', () => {
    const w = windowOf([...Array<number>(180).fill(16.7), ...Array<number>(15).fill(25), ...Array<number>(5).fill(80)]);
    expect(w.summary()).toMatchObject({ frames: 200, slow: 20, hitch: 5, p95: 26 });
  });

  it('tells a browser capping the rate from a game too slow to keep up', () => {
    const at = (workMs: number) => {
      const w = new FrameWindow();
      for (let i = 0; i < 200; i++) w.push(33.3, workMs);
      return w.summary();
    };
    expect(at(4)).toMatchObject({ p95: 34, workP95: 5 });
    expect(at(22.5)).toMatchObject({ p95: 34, workP95: 23 });
  });

  it('ignores gaps that are the page not drawing, and nonsense intervals', () => {
    const w = windowOf([16.7, 5000, 0, -3, Number.NaN, 16.7]);
    expect(w.frames).toBe(2);
    expect(w.slow).toBe(0);
  });

  it('reports the slowest frame when the tail is past the histogram', () => {
    expect(windowOf(Array<number>(10).fill(400)).summary()?.p95).toBe(400);
  });

  it('counts a short window but gives it no percentiles, however many frames it drew', () => {
    expect(windowOf(Array<number>(Math.floor(MIN_MS / 8.3)).fill(8.3)).summary()).toMatchObject({ frames: 240, slow: 0, p95: null, workP95: null });
    expect(new FrameWindow().summary()).toBeNull();
    // A device at 6 fps fills its windows with few frames, and those are the ones that matter most.
    expect(windowOf(Array<number>(12).fill(170)).summary()).toMatchObject({ frames: 12, slow: 12, hitch: 12, p95: 170 });
  });
});

describe('frame pacing', () => {
  function run(steps: (p: FramePacing, at: (phase: string, frames: number, ms?: number) => void) => void) {
    const sent: [string, FrameSummary][] = [];
    const p = new FramePacing((phase, s) => sent.push([phase, s]));
    let now = 1000;
    steps(p, (phase, frames, ms = 16.7) => {
      for (let i = 0; i < frames; i++) p.frame((now += ms), phase);
    });
    return sent;
  }

  it('reports one window per phase visit, under the phase it measured', () => {
    const sent = run((p, at) => {
      at('pick', 200);
      at('run', 300, 33);
      at('pick', 10);
      p.pause();
    });
    expect(sent.map(([phase, s]) => [phase, s.frames, s.slow])).toEqual([
      ['pick', 199, 0],
      ['run', 300, 300],
      ['pick', 10, 0],
    ]);
  });

  it('leaves out score screens and does not count a hidden tab as a hitch', () => {
    const sent = run((p, at) => {
      at('score', 300);
      at('run', 150);
      p.pause();
      at('run', 150);
      p.pause();
    });
    expect(sent.map(([phase, s]) => [phase, s.frames, s.hitch])).toEqual([
      ['run', 150, 0],
      ['run', 149, 0],
    ]);
  });
});

describe('frame metrics', () => {
  function recorder() {
    return { error: vi.fn(), event: vi.fn(), breadcrumb: vi.fn(), metric: vi.fn() } satisfies TelemetryReporter;
  }

  it('sends counts that add up across players and the window p95, tagged with the measured phase', () => {
    const r = recorder();
    installTelemetry(r);
    reportFrames('run', { frames: 600, slow: 12, hitch: 0, p95: 18, workP95: 6 });
    const attributes = { 'match.phase': 'run' };
    expect(r.metric.mock.calls).toEqual([
      ['count', 'frame.total', 600, { attributes }],
      ['count', 'frame.slow', 12, { attributes }],
      ['distribution', 'frame.p95', 18, { unit: 'millisecond', attributes }],
      ['distribution', 'frame.work.p95', 6, { unit: 'millisecond', attributes }],
    ]);
    r.metric.mockClear();
    reportFrames('pick', { frames: 40, slow: 40, hitch: 0, p95: null, workP95: null });
    expect(r.metric.mock.calls.map((c) => c[1])).toEqual(['frame.total', 'frame.slow']);
  });

  it('caps each metric per page and drops values that are not numbers', () => {
    const r = recorder();
    installTelemetry(r);
    reportMetric('count', 'x', Number.NaN);
    for (let i = 0; i < MAX_METRICS_PER_NAME + 10; i++) reportMetric('count', 'x', 1);
    expect(r.metric).toHaveBeenCalledTimes(MAX_METRICS_PER_NAME);
  });
});
