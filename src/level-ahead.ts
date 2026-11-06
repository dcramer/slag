import 'client-only';
import { hasLevel, keepLevels, levelKey, type LevelRequest, offerLevel } from './gen/level/pregen';
import type { GenInfo } from './gen/level';
import type { Level } from './sim/level';
import { reportEvent } from './telemetry';

/** What the worker says about how a level was made. */
export type GenSummary = Pick<GenInfo, 'fallback' | 'conceptFallback' | 'attempts'>;

/**
 * Report a level the generator had to fall back on: the flat floor or legacy sculptor (`fallback`), or a plain
 * level after the stage concept's landmark kept failing (`concept-fallback`). Either is a generator bug for that
 * request, reproducible with `pnpm level <seed> --theme <theme>`, so the request is the report.
 */
export function reportGenFallback(gen: GenSummary, req: LevelRequest): void {
  const kind = gen.fallback ? 'fallback' : gen.conceptFallback ? 'concept-fallback' : '';
  if (!kind) return;
  const data = { seed: req.seed >>> 0, theme: req.theme ?? 'auto', profile: JSON.stringify(req.profile), attempts: gen.attempts };
  reportEvent('level-fallback', gen.fallback ? 'error' : 'warning', data, { group: kind });
}

/**
 * Keeps the levels a match could ask for next built and waiting, so a new
 * level costs a frame instead of tens of them. The sim can't wait for a
 * worker: every peer has to change level on the same frame, from a pure
 * function of the inputs. So nothing about the sim changes. Levels are made
 * ahead in a worker and `buildLevel` finds them there, and asking faster than
 * the worker can keep up only means generating on the spot, as tests and
 * tools always do. Without Worker support it does nothing, with the same result.
 */
export class LevelAhead {
  private worker: Worker | null = null;
  private wanted: LevelRequest[] = [];
  /** Key of the request the worker is on. */
  private busy: string | null = null;
  /** Requests someone is waiting on (`first`), by key: they stay queued whatever `want` says. */
  private waiters = new Map<string, { req: LevelRequest; done: (() => void)[] }>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./level-worker.ts', import.meta.url), { name: 'levels' });
      this.worker.onmessage = ({ data }: MessageEvent<{ key: string; req: LevelRequest; level: Level; gen?: GenSummary }>) => {
        this.busy = null;
        if (data.gen) reportGenFallback(data.gen, data.req);
        offerLevel(data.req, data.level);
        this.settle(data.key);
        this.pump();
      };
      this.worker.onerror = (e) => {
        e.preventDefault();
        this.stop();
      };
    } catch {
      this.stop();
    }
  }

  /** Replace the queue: these levels, most wanted first. Levels built for anything else are let go. */
  want(requests: readonly LevelRequest[]): void {
    const waited = [...this.waiters.values()].map((w) => w.req);
    this.wanted = [...waited, ...requests];
    keepLevels(new Set(this.wanted.map(levelKey)));
    this.pump();
  }

  /** Resolves once `req` is built, or as soon as it's clear it won't be. */
  first(req: LevelRequest): Promise<void> {
    const key = levelKey(req);
    if (!this.worker || hasLevel(key)) return Promise.resolve();
    if (this.busy !== key) this.wanted.unshift(req);
    return new Promise((done) => {
      const w = this.waiters.get(key) ?? { req, done: [] };
      w.done.push(done);
      this.waiters.set(key, w);
      this.pump();
    });
  }

  /** Is the worker on `req`, or is it queued? */
  building(req: LevelRequest): boolean {
    const key = levelKey(req);
    return this.busy === key || this.wanted.some((r) => levelKey(r) === key);
  }

  private pump(): void {
    if (!this.worker || this.busy) return;
    for (let req = this.wanted.shift(); req; req = this.wanted.shift()) {
      const key = levelKey(req);
      if (hasLevel(key)) {
        this.settle(key);
        continue;
      }
      this.busy = key;
      this.worker.postMessage({ key, req }, []);
      return;
    }
  }

  /** Wake whoever waits on `key`. */
  private settle(key: string): void {
    const w = this.waiters.get(key);
    this.waiters.delete(key);
    for (const done of w?.done ?? []) done();
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.busy = null;
    for (const w of this.waiters.values()) for (const done of w.done) done();
    this.waiters.clear();
  }
}
