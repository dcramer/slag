import type { SignalOp } from '../../../../src/net/signal-protocol';
import { StoreError } from './store';

/**
 * How the signaling route reports a store failure. It answers the caller with
 * a 503, so nothing reports it automatically, and an exhausted free tier
 * fails every poll in the world at once: one report a minute per instance,
 * carrying how many were held back. Tags are the op and the store's answer,
 * never the room or the caller.
 */

export const REPORT_EVERY_MS = 60_000;

/** What went wrong, as a short fixed string: the store's HTTP status, `rejected` (a command failed), or `network`. */
export function storeStatus(e: unknown): string {
  if (e instanceof StoreError) return e.status === undefined ? 'rejected' : String(e.status);
  return 'network';
}

export interface StoreFailureReport {
  tags: { area: 'signal-store'; op: SignalOp; 'store.status': string };
  /** Groups by what the store said: a quota (429) is a different problem from an outage. */
  fingerprint: string[];
  /** Failures since the last report that weren't reported. */
  suppressed: number;
}

/** Throttles store-failure reports; `now` is injectable for tests. */
export class StoreFailureThrottle {
  private last = -Infinity;
  private held = 0;
  constructor(private now: () => number = Date.now) {}

  /** The report to send for this failure, or null while throttled. */
  next(e: unknown, op: SignalOp): StoreFailureReport | null {
    const t = this.now();
    if (t - this.last < REPORT_EVERY_MS) {
      this.held++;
      return null;
    }
    this.last = t;
    const suppressed = this.held;
    this.held = 0;
    const status = storeStatus(e);
    return { tags: { area: 'signal-store', op, 'store.status': status }, fingerprint: ['signal-store', status], suppressed };
  }
}
