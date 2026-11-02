import { Rng } from '../core/rng';

/**
 * Room transports. A transport connects this browser to everyone else in
 * room /r/<code> and provides two things:
 *
 * 1. **Presence**: the ordered member list. `order` is the join order
 *    (lower = joined earlier); the session elects the lowest order as host.
 * 2. **Messages**: JSON-serializable payloads to one member or to all others.
 *    Reliable sends from one sender arrive in order. A lossy send may vanish
 *    or overtake others; the session copes (resends, nacks, snapshots).
 *
 * Implementations:
 * - `WebRtcTransport` (webrtc-transport.ts): the real one, a data channel star
 *   around the host, found through the signaling API.
 * - `BroadcastTransport` (below): BroadcastChannel between tabs of one
 *   browser. Zero setup, for local testing (`?net=bc`).
 * - `LoopbackHub` (below): in-memory, with injectable latency/jitter/loss and
 *   a manual clock, for unit tests.
 */

export interface Member {
  id: string;
  /** Join order: lower joined earlier. Ties break on id. */
  order: number;
  /** Known to be in the room but its link isn't up yet: a new host waits for these before resuming. */
  linking?: boolean;
}

export type LinkStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unavailable';

export interface TransportHandlers {
  status(s: LinkStatus, detail?: string): void;
  /** Full member list including self, sorted by (order, id). Called on every change. */
  members(list: Member[]): void;
  message(from: string, data: unknown): void;
}

export interface Transport {
  readonly kind: 'webrtc' | 'broadcast' | 'loopback';
  /** This peer's id (stable across refreshes, see identity.ts). */
  readonly self: string;
  start(h: TransportHandlers): void;
  /** Send to one member, or to every other member when `to` is omitted. `lossy` trades delivery for latency. */
  send(data: unknown, to?: string, lossy?: boolean): void;
  close(): void;
  /** Join the order again at the back, keeping links: an observer ahead of a player does this (see NetSession.maybeReorder). */
  reorder?(): void;
}

export function sortMembers(list: Member[]): Member[] {
  return [...list].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------------------------------------------------------------- loopback (tests)

export interface LoopbackOptions {
  /** One-way latency in ms. */
  latency?: number;
  /** Extra random latency in [0, jitter) ms (per-sender order is still preserved, like a socket). */
  jitter?: number;
  /** Probability [0, 1] that a message is dropped (presence is never dropped). */
  loss?: number;
  seed?: number;
}

interface Pending {
  at: number;
  seq: number;
  run: () => void;
}

/**
 * In-memory room for tests. Join order is a hub counter, and time is manual:
 * call `advance(ms)`.
 * Messages are JSON round-tripped so tests catch anything that wouldn't
 * survive the wire.
 */
export class LoopbackHub {
  now = 0;
  private order = 0;
  private seq = 0;
  private queue: Pending[] = [];
  private peers = new Map<string, { t: LoopbackTransport; order: number }>();
  /** Last scheduled delivery time per receiver: each peer receives everything in one FIFO stream. */
  private lastAt = new Map<string, number>();
  private rng: Rng;

  constructor(public opts: LoopbackOptions = {}) {
    this.rng = new Rng(opts.seed ?? 1);
  }

  transport(id: string): LoopbackTransport {
    return new LoopbackTransport(this, id);
  }

  /** Run everything due up to now + ms, in time order. */
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.queue[0];
      if (!next || next.at > end) break;
      this.queue.shift();
      this.now = Math.max(this.now, next.at);
      next.run();
    }
    this.now = end;
  }

  members() {
    return sortMembers([...this.peers.entries()].map(([id, p]) => ({ id, order: p.order })));
  }

  /** @internal */
  connect(t: LoopbackTransport) {
    const old = this.peers.get(t.self);
    if (old && old.t !== t) old.t.kill();
    this.peers.set(t.self, { t, order: this.order++ });
    this.broadcastPresence();
  }

  /** @internal */
  reorder(t: LoopbackTransport) {
    if (this.peers.get(t.self)?.t !== t) return;
    this.peers.set(t.self, { t, order: this.order++ });
    this.broadcastPresence();
  }

  /** @internal */
  disconnect(t: LoopbackTransport) {
    if (this.peers.get(t.self)?.t !== t) return;
    this.peers.delete(t.self);
    this.broadcastPresence();
  }

  private broadcastPresence() {
    const list = this.members();
    // Presence goes out with the base latency so it orders with messages.
    for (const { t } of this.peers.values()) this.schedule(t.self, () => t.handlers?.members(list), false);
  }

  /** @internal */
  route(from: string, data: unknown, to?: string) {
    const text = JSON.stringify(data);
    const targets = to ? [to] : [...this.peers.keys()].filter((id) => id !== from);
    for (const id of targets) {
      if (!this.peers.has(id)) continue;
      if (this.rng.next() < (this.opts.loss ?? 0)) continue;
      this.schedule(id, () => {
        const p = this.peers.get(id);
        if (p && this.peers.has(from)) p.t.handlers?.message(from, JSON.parse(text));
      });
    }
  }

  private schedule(to: string, run: () => void, jitter = true) {
    const key = to;
    const base = this.now + (this.opts.latency ?? 0) + (jitter ? this.rng.next() * (this.opts.jitter ?? 0) : 0);
    const at = Math.max(base, this.lastAt.get(key) ?? 0);
    this.lastAt.set(key, at);
    this.queue.push({ at, seq: this.seq++, run });
  }
}

export class LoopbackTransport implements Transport {
  readonly kind = 'loopback';
  handlers: TransportHandlers | null = null;
  private alive = false;

  constructor(
    private hub: LoopbackHub,
    readonly self: string,
  ) {}

  start(h: TransportHandlers) {
    this.handlers = h;
    this.alive = true;
    h.status('open');
    this.hub.connect(this);
  }

  send(data: unknown, to?: string) {
    if (this.alive) this.hub.route(this.self, data, to);
  }

  reorder() {
    if (this.alive) this.hub.reorder(this);
  }

  close() {
    if (!this.alive) return;
    this.alive = false;
    this.hub.disconnect(this);
    this.handlers?.status('closed');
    this.handlers = null;
  }

  /** Hub-side kill (replaced by a newer connection with the same id). */
  kill() {
    this.alive = false;
    this.handlers?.status('closed', 'replaced');
    this.handlers = null;
  }
}

// ---------------------------------------------------------------- BroadcastChannel (same browser)

const BC_HEARTBEAT_MS = 700;
const BC_TIMEOUT_MS = 2500;
const BC_DISCOVERY_MS = 250;

type BcPacket = { k: 'hello' | 'beat' | 'bye'; from: string; at: number; reply?: boolean } | { k: 'msg'; from: string; to?: string; d: string };

/**
 * Tabs of one browser talk over a BroadcastChannel named after the room.
 * There is no server, so presence is peer-reported: each tab announces its
 * join time (one shared clock within a browser, so every tab orders the same
 * way) and heartbeats; silent tabs expire after BC_TIMEOUT_MS, and a closing
 * tab says goodbye on pagehide.
 */
export class BroadcastTransport implements Transport {
  readonly kind = 'broadcast';
  private ch: BroadcastChannel | null = null;
  private h: TransportHandlers | null = null;
  private seen = new Map<string, { at: number; last: number }>();
  private joinedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSig = '';
  private ready = false;

  constructor(
    readonly room: string,
    readonly self: string,
  ) {}

  start(h: TransportHandlers) {
    this.h = h;
    if (typeof BroadcastChannel === 'undefined') {
      h.status('unavailable', 'BroadcastChannel not supported');
      return;
    }
    this.ch = new BroadcastChannel(`slag-room-${this.room}`);
    this.joinedAt = Date.now();
    this.ch.onmessage = (e) => this.onPacket(e.data as BcPacket);
    this.post({ k: 'hello', from: this.self, at: this.joinedAt });
    this.timer = setInterval(() => this.beat(), BC_HEARTBEAT_MS);
    // Give existing tabs a moment to answer our hello before reporting presence,
    // so a newcomer doesn't briefly believe it is alone (and host).
    setTimeout(() => {
      if (!this.ch) return;
      this.ready = true;
      h.status('open');
      this.emitMembers();
    }, BC_DISCOVERY_MS);
  }

  send(data: unknown, to?: string) {
    this.post({ k: 'msg', from: this.self, to, d: JSON.stringify(data) });
  }

  reorder() {
    if (!this.ch) return;
    this.joinedAt = Date.now();
    this.post({ k: 'hello', from: this.self, at: this.joinedAt });
    this.lastSig = '';
    this.emitMembers();
  }

  close() {
    if (!this.ch) return;
    this.post({ k: 'bye', from: this.self, at: this.joinedAt });
    if (this.timer) clearInterval(this.timer);
    this.ch.close();
    this.ch = null;
    this.h?.status('closed');
    this.h = null;
  }

  private post(p: BcPacket) {
    try {
      this.ch?.postMessage(p);
    } catch {
      // channel closed
    }
  }

  private beat() {
    this.post({ k: 'beat', from: this.self, at: this.joinedAt });
    const now = Date.now();
    for (const [id, s] of this.seen) if (now - s.last > BC_TIMEOUT_MS) this.seen.delete(id);
    this.emitMembers();
  }

  private onPacket(p: BcPacket) {
    if (p.from === this.self) {
      // Another tab with our id (duplicated tab): the later one should pick a new id; see identity.ts.
      return;
    }
    if (p.k === 'msg') {
      if (!p.to || p.to === this.self) {
        if (!this.seen.has(p.from)) return; // not (yet) a member: drop
        this.h?.message(p.from, JSON.parse(p.d));
      }
      return;
    }
    if (p.k === 'bye') {
      this.seen.delete(p.from);
    } else {
      const known = this.seen.get(p.from);
      this.seen.set(p.from, { at: p.at, last: Date.now() });
      // Answer a newcomer so it learns about us right away instead of on the next heartbeat.
      if (p.k === 'hello' && !p.reply) this.post({ k: 'hello', from: this.self, at: this.joinedAt, reply: true });
      if (known && known.at === p.at) {
        this.emitMembers();
        return;
      }
    }
    this.emitMembers();
  }

  private emitMembers() {
    if (!this.ready) return;
    const list = sortMembers([{ id: this.self, order: this.joinedAt }, ...[...this.seen.entries()].map(([id, s]) => ({ id, order: s.at }))]);
    const sig = list.map((m) => `${m.id}@${m.order}`).join();
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.h?.members(list);
  }
}
