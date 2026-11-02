/**
 * The lobby list's reply, kept for a moment per function instance. Every open list polls it (LIST_POLL_MS), and
 * each read costs store commands, so an instance answers everyone browsing from one read for this long: the store
 * pays per instance, not per browser. A list a second or two old is still the list.
 */
export const LIST_CACHE_MS = 2000;

export class ReplyCache<T> {
  private at = -Infinity;
  private value: T | null = null;
  private pending: Promise<T> | null = null;

  constructor(
    private now: () => number = Date.now,
    private ttl = LIST_CACHE_MS,
  ) {}

  /** The cached reply while fresh; otherwise `load` (shared by every caller that asks while it runs). */
  async get(load: () => Promise<T>): Promise<T> {
    if (this.value !== null && this.now() - this.at < this.ttl) return this.value;
    this.pending ??= load().then(
      (v) => {
        this.value = v;
        this.at = this.now();
        this.pending = null;
        return v;
      },
      (e: unknown) => {
        this.pending = null;
        throw e;
      },
    );
    return this.pending;
  }
}
