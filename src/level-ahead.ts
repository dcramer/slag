import 'client-only';
import { hasLevel, keepLevels, levelKey, type LevelRequest, offerLevel } from './gen/level/pregen';
import type { Level } from './sim/level';

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
  private waiters = new Map<string, () => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./level-worker.ts', import.meta.url), { name: 'levels' });
      this.worker.onmessage = ({ data }: MessageEvent<{ key: string; level: Level }>) => {
        this.busy = null;
        offerLevel(data.key, data.level);
        this.waiters.get(data.key)?.();
        this.waiters.delete(data.key);
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
    this.wanted = [...requests];
    keepLevels(new Set(requests.map(levelKey)));
    this.pump();
  }

  /** Resolves once `req` is built, or as soon as it's clear it won't be. */
  first(req: LevelRequest): Promise<void> {
    const key = levelKey(req);
    if (!this.worker || hasLevel(key)) return Promise.resolve();
    this.wanted.unshift(req);
    return new Promise((done) => {
      this.waiters.set(key, done);
      this.pump();
    });
  }

  private pump(): void {
    if (!this.worker || this.busy) return;
    for (let req = this.wanted.shift(); req; req = this.wanted.shift()) {
      const key = levelKey(req);
      if (hasLevel(key)) continue;
      this.busy = key;
      this.worker.postMessage({ key, req }, []);
      return;
    }
  }

  private stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.busy = null;
    for (const done of this.waiters.values()) done();
    this.waiters.clear();
  }
}
