import { reportMetric } from './telemetry';

/**
 * Frame pacing in the field: whether real players get the frame rate the game
 * is built for. `pnpm perf` answers that on one machine; this answers it across
 * every device that plays, so a release that makes phones stutter shows up.
 *
 * Each phase visit is one window. A window keeps a 1 ms histogram of frame
 * intervals and, when it ends, sends a few metrics: frame counts (total, slow,
 * hitch), which add up across players into "share of slow frames", and the
 * window's p95. Nothing is sent per frame. The host stamps the game's tags on
 * each metric, so they slice by device class, quality tier, theme and players.
 */

/** Over this an interval missed a 50 Hz refresh: the player sees a stutter, not just a lower rate. */
export const SLOW_MS = 20;
/** Long enough to read as a freeze: a jump lands late, a run feels sticky. */
export const HITCH_MS = 50;
/** Longer gaps are the page not drawing (hidden tab, debugger, OS suspend), not a slow frame. */
export const GAP_MS = 1000;
/** A window with less drawn time than this says nothing on its own. Time, not frames: a frame count would leave out exactly the slow devices. */
export const MIN_MS = 2000;
/** Histogram buckets are 1 ms up to this; slower intervals share the last one. */
const HIST_MS = 100;

/** Phases a window is reported for: the ones played in, not the score cards between them. */
const MEASURED: ReadonlySet<string> = new Set(['lobby', 'pick', 'place', 'run']);

export interface FrameSummary {
  frames: number;
  /** Intervals over `SLOW_MS`. */
  slow: number;
  /** Intervals over `HITCH_MS`. */
  hitch: number;
  /** 95th percentile interval, ms, rounded up to the bucket. */
  p95: number;
}

/** Frame intervals over one stretch of play. Fixed memory, nothing allocated per frame. */
export class FrameWindow {
  private hist = new Uint32Array(HIST_MS + 1);
  private max = 0;
  private ms = 0;
  frames = 0;
  slow = 0;
  hitch = 0;

  push(ms: number): void {
    if (!(ms > 0) || ms > GAP_MS) return;
    this.frames++;
    this.ms += ms;
    if (ms > SLOW_MS) this.slow++;
    if (ms > HITCH_MS) this.hitch++;
    this.hist[Math.min(HIST_MS, Math.floor(ms))]++;
    if (ms > this.max) this.max = ms;
  }

  /** The interval `q` of frames came in under: a bucket's upper edge, or the slowest frame past the last bucket. */
  percentile(q: number): number {
    let need = Math.ceil(this.frames * q);
    for (let i = 0; i < HIST_MS; i++) {
      need -= this.hist[i];
      if (need <= 0) return i + 1;
    }
    return Math.ceil(this.max);
  }

  /** The window's numbers, or null if it was too short to mean anything. */
  summary(): FrameSummary | null {
    if (this.ms < MIN_MS) return null;
    return { frames: this.frames, slow: this.slow, hitch: this.hitch, p95: this.percentile(0.95) };
  }

  reset(): void {
    this.hist.fill(0);
    this.max = this.ms = this.frames = this.slow = this.hitch = 0;
  }
}

/** Splits drawn frames into one window per phase visit and reports each as it ends. */
export class FramePacing {
  private win = new FrameWindow();
  private phase = '';
  private last = 0;

  constructor(private send: (phase: string, s: FrameSummary) => void = reportFrames) {}

  /** One frame drawn at `now` (requestAnimationFrame ms) during `phase`. */
  frame(now: number, phase: string): void {
    if (phase !== this.phase) {
      this.end();
      this.phase = phase;
    }
    if (this.last) this.win.push(now - this.last);
    this.last = now;
  }

  /** The loop stopped drawing (tab hidden, loop paused, lobby left): end the window, and don't count the gap. */
  pause(): void {
    this.end();
    this.last = 0;
  }

  private end(): void {
    const s = this.win.summary();
    if (s && MEASURED.has(this.phase)) this.send(this.phase, s);
    this.win.reset();
  }
}

/** One window's metrics. Zero counts are left out: they add nothing to a sum. */
export function reportFrames(phase: string, s: FrameSummary): void {
  // Named like the tag so it replaces it: by the time a window ends the match is in the next phase.
  const attributes = { 'match.phase': phase };
  for (const [name, n] of [
    ['frame.total', s.frames],
    ['frame.slow', s.slow],
    ['frame.hitch', s.hitch],
  ] as const)
    if (n > 0) reportMetric('count', name, n, { attributes });
  reportMetric('distribution', 'frame.p95', s.p95, { unit: 'millisecond', attributes });
}
