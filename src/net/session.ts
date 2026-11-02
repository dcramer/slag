import type { Match } from '../game/match';
import { MAX_PLAYERS } from '../sim/constants';
import type { GameEvent, InputFrame } from '../sim/types';
import { applyAction, type NetAction, type NetState, newNetState, peerOf, sanitizeRules } from './actions';
import { decode, type Enc, encode, heldPeerFrame, mergePeerFrames, type PeerFrame } from './codec';
import { Predictor } from './predict';
import { hashMatch, hashSnap, type MatchSnap, restoreMatch, snapshotMatch } from './snapshot';
import type { LinkStatus, Member, Transport } from './transport';

/**
 * Online session: host election, host-sequenced lockstep, prediction,
 * snapshots for joins/migration, desync detection. See docs/NETCODE.md.
 *
 * Every peer runs the same deterministic Match. The host (the connected
 * member that joined the room earliest) runs the clock: each tick it takes
 * its own local input plus the latest input received from every guest,
 * stamps them with the frame number, steps, and broadcasts the bundle.
 * Guests step only on bundles, so all peers walk the exact same frames.
 * Because everyone holds the full state, host migration is just "the next
 * peer in join order keeps going from its last confirmed frame" (and sends a
 * snapshot so stragglers line up).
 */

export const HASH_EVERY = 60;
const HISTORY = 600;
const PING_MS = 1000;
const HELLO_RETRY_MS = 1000;
const NEED_AFTER_MS = 150;
const MAX_UNACKED = 90;
const QUEUE_HIGH = 6;
const QUEUE_KEEP = 3;
const MAX_APPLY_PER_TICK = 900;
const MAX_PREDICT = 24;

export type NetStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'unavailable';
export type Role = 'host' | 'guest';

/** Per-peer info for the HUD (lobby list, crown, ping). */
export interface PeerInfo {
  id: string;
  /** Join order in the room (lower = earlier). */
  order: number;
  isHost: boolean;
  isSelf: boolean;
  /** Round trip to the host in ms (host: 0); null until measured. */
  ping: number | null;
  quality: 'good' | 'ok' | 'bad' | 'unknown';
  /** Match slots this peer's devices occupy. */
  slots: number[];
  /** Display name: the peer's first player's name, or 'spectator'. */
  name: string;
}

interface Bundle {
  f: number;
  /** Global device → input; devices with no buttons are omitted. */
  i?: Record<string, Enc>;
  a?: NetAction[];
  /** Ack deltas: peer → [last consumed input seq, last accepted action n]. */
  k?: Record<string, [number, number]>;
}

type Msg =
  | { t: 'in'; s: number; f: PeerFrame[]; a?: [number, NetAction][]; c: number; h?: [number, number] }
  | { t: 'b'; b: Bundle[] }
  | { t: 'sync'; s: MatchSnap; k: Record<string, [number, number]>; ns: NetState; last: Record<string, Enc>; why: string }
  | { t: 'hello' }
  | { t: 'need'; f: number }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'pings'; p: Record<string, number> };

export interface SessionOptions {
  transport: Transport | null;
  match: Match;
  /** Monotonic ms clock (injectable for tests). */
  now?: () => number;
  /** Guests send input every N ticks and the host flushes bundles every N ticks (1 = every frame). */
  sendEvery?: number;
  /** Client-side prediction during races (guests). */
  predict?: boolean;
  /** Local device a spectator asks to be seated with (the keyboard/mouse player). */
  primaryDevice?: string;
  /** Called with a resumable snapshot when we become host of an empty room; return one to resume. */
  resume?: () => { snap: MatchSnap; ns: NetState } | null;
  log?: (msg: string) => void;
}

interface RemoteQueue {
  frames: { seq: number; f: PeerFrame }[];
  consumed: number;
  actN: number;
  last: PeerFrame;
}

export class NetSession {
  readonly match: Match;
  readonly self: string;
  readonly transport: Transport | null;
  readonly ns: NetState = newNetState();
  status: NetStatus;
  /** Extra detail for the status line (e.g. why online is unavailable). */
  detail = '';
  role: Role = 'host';
  hostId: string;
  members: Member[] = [];
  /** Guests: true once the host's snapshot arrived (before that we show a frozen lobby). */
  synced = true;
  /** Counters for the HUD/debug overlay and tests. */
  stats = { desyncs: 0, syncs: 0, migrations: 0, bundles: 0, predicted: 0 };

  private now: () => number;
  private sendEvery: number;
  private predict: boolean;
  private resumeFn: SessionOptions['resume'];
  private log: (msg: string) => void;
  private ticks = 0;
  private events: GameEvent[] = [];
  private emittedThrough = -1;
  private predictor = new Predictor();
  private viewMatch: Match;
  private viewDirty = true;
  private primary: string;

  // host state
  private queues = new Map<string, RemoteQueue>();
  private history: Bundle[] = [];
  private outbox: Bundle[] = [];
  private hostActions: NetAction[] = [];
  private hashes = new Map<number, number>();
  private wants = new Set<string>();
  private sentK = new Map<string, string>();

  // guest state
  private seq: number;
  private unacked: { seq: number; f: PeerFrame }[] = [];
  private actN: number;
  private pendingActs: [number, NetAction][] = [];
  private acks: Record<string, [number, number]> = {};
  private lastInputs: Record<string, Enc> = {};
  private inbox = new Map<number, Bundle>();
  private gapSince = -1;
  private lastNeed = -1e9;
  private lastHello = -1e9;
  private pendingHash: [number, number] | undefined;
  private wantSentTo = '';
  private stash: { from: string; msg: Msg; at: number }[] = [];

  // pings
  private rtt = new Map<string, number>();
  private heard = new Map<string, number>();
  private remotePings: Record<string, number> = {};
  private lastPing = -1e9;
  private resumed = false;

  constructor(opts: SessionOptions) {
    this.match = opts.match;
    this.viewMatch = opts.match;
    this.transport = opts.transport;
    this.self = opts.transport?.self ?? 'local';
    this.hostId = this.self;
    this.now = opts.now ?? (() => performance.now());
    this.sendEvery = Math.max(1, opts.sendEvery ?? 2);
    this.predict = opts.predict ?? true;
    this.resumeFn = opts.resume;
    this.primary = opts.primaryDevice ?? 'kb1';
    this.log = opts.log ?? (() => {});
    // Input/action sequence numbers start at wall-clock ms: a refreshed page always counts higher than its old self.
    this.seq = Math.floor(Date.now());
    this.actN = this.seq;
    this.status = opts.transport ? 'connecting' : 'offline';
    this.members = [{ id: this.self, order: 0 }];
    opts.transport?.start({
      status: (s, d) => this.onStatus(s, d),
      members: (l) => this.onMembers(l),
      message: (from, d) => this.onMessage(from, d as Msg),
    });
  }

  // ------------------------------------------------------------------ public API

  get isHost(): boolean {
    return this.role === 'host';
  }

  get online(): boolean {
    return this.status === 'online';
  }

  /** Remote peers currently connected. */
  get remoteCount(): number {
    return this.members.filter((m) => m.id !== this.self).length;
  }

  /**
   * True while the sim must not advance: we lost the link and other
   * machines' players are in the match (resuming alone would fork the room),
   * or we are a guest still waiting for the host's snapshot.
   */
  get paused(): boolean {
    if (this.role === 'guest') return !this.synced;
    return this.status === 'reconnecting' && this.match.players.some((p) => peerOf(p.device) && peerOf(p.device) !== this.self);
  }

  /** The match to render: confirmed state, or (guests, races) the predicted copy. Read it before drainEvents(). */
  get view(): Match {
    if (this.viewDirty) {
      this.viewDirty = false;
      this.updateView();
    }
    return this.viewMatch;
  }

  /** Global id for a local device ('kb1' → '<peer>:kb1'). Offline sessions keep raw ids. */
  globalDevice(local: string): string {
    return this.transport ? `${this.self}:${local}` : local;
  }

  /** True if this global device belongs to this machine. */
  isLocal(dev: string): boolean {
    return !this.transport || peerOf(dev) === this.self || !dev.includes(':');
  }

  /** Request an action (name change, rules…). Sequenced by the host; guests' requests are resent until acked. */
  act(a: NetAction) {
    if (this.role === 'host') this.hostActions.push(a);
    else this.pendingActs.push([++this.actN, a]);
  }

  /** Events from frames simulated for the first time since the last drain (confirmed or predicted). */
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  peers(): PeerInfo[] {
    const t = this.now();
    return this.members.map((m) => {
      const isSelf = m.id === this.self;
      const isHost = m.id === this.hostId;
      let ping: number | null;
      if (isHost) ping = 0;
      else if (this.role === 'host') ping = this.rtt.get(m.id) ?? null;
      else ping = isSelf ? (this.rtt.get(this.hostId) ?? null) : (this.remotePings[m.id] ?? null);
      const stale = !isSelf && this.role === 'host' && t - (this.heard.get(m.id) ?? t) > 3000;
      const quality = stale ? 'bad' : ping === null ? 'unknown' : ping < 90 ? 'good' : ping < 180 ? 'ok' : 'bad';
      const players = this.match.players.filter((p) => peerOf(p.device) === m.id || (isSelf && !p.device.includes(':')));
      return { id: m.id, order: m.order, isHost, isSelf, ping, quality, slots: players.map((p) => p.slot), name: players[0]?.character.name ?? 'spectator' };
    });
  }

  /** Send any batched bundles now (e.g. before the page hides). */
  flush() {
    if (this.role === 'host' && this.outbox.length && this.remoteCount) this.send({ t: 'b', b: this.outbox });
    this.outbox = [];
  }

  close() {
    this.flush();
    this.transport?.close();
  }

  /**
   * One fixed 60 Hz step. `local` is this machine's sampled input keyed by
   * local device ('kb1', 'pad0'; HUD presses may already be global ids).
   */
  tick(local: Readonly<Record<string, InputFrame>>): void {
    this.ticks++;
    const frame = this.localFrame(local);
    const t = this.now();
    if (this.transport && t - this.lastPing >= PING_MS) {
      this.lastPing = t;
      if (this.role === 'host') {
        this.send({ t: 'ping', ts: t });
        if (this.ticks % 2 === 0) this.send({ t: 'pings', p: Object.fromEntries(this.rtt) });
      } else if (this.hostId !== this.self) this.send({ t: 'ping', ts: t }, this.hostId);
    }
    if (this.role === 'host') this.hostTick(frame);
    else this.guestTick(frame, t);
    this.viewDirty = true;
  }

  // ------------------------------------------------------------------ transport events

  private onStatus(s: LinkStatus, detail?: string) {
    this.detail = detail ?? '';
    this.status =
      s === 'open' ? 'online' : s === 'connecting' ? 'connecting' : s === 'reconnecting' ? 'reconnecting' : s === 'closed' ? 'offline' : 'unavailable';
    if (s !== 'open') {
      // Presence is unknown while disconnected; keep the last list but forget everyone else's queues.
      this.log(`link ${s}${detail ? ` (${detail})` : ''}`);
    }
    if (s === 'closed' || s === 'unavailable') this.onMembers([{ id: this.self, order: 0 }]);
  }

  private onMembers(list: Member[]) {
    if (!list.some((m) => m.id === this.self)) list = [...list, { id: this.self, order: Number.MAX_SAFE_INTEGER }];
    this.members = list;
    const host = list[0].id;
    const present = new Set(list.map((m) => m.id));
    for (const id of this.queues.keys()) {
      if (present.has(id)) continue;
      this.queues.delete(id);
      this.sentK.delete(id);
    }
    if (host !== this.hostId) this.changeHost(host);
    else if (this.role === 'host' && !this.resumed && list.length === 1) this.tryResume();
    // Replay anything the new host sent before presence told us it was host (newcomers are synced on hello).
    const stash = this.stash;
    this.stash = [];
    for (const s of stash) if (s.from === this.hostId && this.role === 'guest') this.onMessage(s.from, s.msg);
  }

  private changeHost(host: string) {
    const was = this.role;
    const prev = this.hostId;
    this.hostId = host;
    if (host === this.self) {
      this.role = 'host';
      if (was === 'guest') {
        this.stats.migrations++;
        this.log(`host migrated ${prev} → me at frame ${this.match.frame}`);
        this.promote();
      } else this.tryResume();
    } else {
      this.role = 'guest';
      this.resumed = true; // we joined a live room: its state wins over any local save
      this.synced = false;
      this.inbox.clear();
      this.wantSentTo = '';
      this.lastHello = -1e9;
      this.unacked = [];
      if (was === 'host') this.log(`${host} is host`);
    }
  }

  /** Guest → host: carry on from our confirmed frame; everyone gets our snapshot so stragglers line up. */
  private promote() {
    this.resumed = true;
    this.queues.clear();
    for (const m of this.members) {
      if (m.id === this.self) continue;
      const k = this.acks[m.id] ?? [0, 0];
      const last: PeerFrame = {};
      for (const [dev, e] of Object.entries(this.lastInputs)) if (peerOf(dev) === m.id) last[dev.slice(m.id.length + 1)] = e;
      this.queues.set(m.id, { frames: [], consumed: k[0], actN: k[1], last: heldPeerFrame(last) });
    }
    // Our own unacked inputs and actions never made it into a bundle: apply them as host now.
    for (const [, a] of this.pendingActs) this.hostActions.push(a);
    this.pendingActs = [];
    this.unacked = [];
    this.history = [];
    this.outbox = [];
    this.hashes.clear();
    this.synced = true;
    if (this.remoteCount) this.send(this.syncMsg('migrate'));
  }

  private tryResume() {
    if (this.resumed) return;
    this.resumed = true;
    const r = this.resumeFn?.();
    if (!r) return;
    try {
      restoreMatch(this.match, r.snap);
      this.ns.parked = r.ns.parked ?? {};
      this.emittedThrough = this.match.frame;
      this.log(`resumed saved room state at frame ${this.match.frame}`);
    } catch (e) {
      this.log(`resume failed: ${String(e)}`);
    }
  }

  private send(m: Msg, to?: string) {
    this.transport?.send(m, to);
  }

  private onMessage(from: string, msg: Msg) {
    this.heard.set(from, this.now());
    switch (msg.t) {
      case 'ping':
        this.send({ t: 'pong', ts: msg.ts }, from);
        return;
      case 'pong':
        this.rtt.set(from, Math.max(0, this.now() - msg.ts));
        return;
      case 'pings':
        if (from === this.hostId) this.remotePings = msg.p;
        return;
    }
    if (this.role === 'host') {
      if (msg.t === 'in') this.onInput(from, msg);
      else if (msg.t === 'hello') this.onHello(from);
      else if (msg.t === 'need') this.onNeed(from, msg.f);
      else if (msg.t === 'b' || msg.t === 'sync') this.stashMsg(from, msg); // someone else thinks they're host: presence lag
      return;
    }
    if (msg.t !== 'b' && msg.t !== 'sync') return;
    if (from !== this.hostId) {
      this.stashMsg(from, msg);
      return;
    }
    if (msg.t === 'sync') this.onSync(msg);
    else for (const b of msg.b) if (b.f >= this.match.frame && !this.inbox.has(b.f)) this.inbox.set(b.f, b);
  }

  /** Host-only messages from a peer we don't (yet) consider host: presence may lag behind. Keep briefly. */
  private stashMsg(from: string, msg: Msg) {
    const t = this.now();
    this.stash = this.stash.filter((s) => t - s.at < 3000).slice(-400);
    this.stash.push({ from, msg, at: t });
  }

  // ------------------------------------------------------------------ host

  private queue(peer: string): RemoteQueue {
    let q = this.queues.get(peer);
    if (!q) {
      q = { frames: [], consumed: 0, actN: 0, last: {} };
      this.queues.set(peer, q);
    }
    return q;
  }

  private onInput(from: string, msg: Extract<Msg, { t: 'in' }>) {
    if (!this.members.some((m) => m.id === from)) return;
    const q = this.queue(from);
    const tail = q.frames.length ? q.frames[q.frames.length - 1].seq : q.consumed;
    msg.f.forEach((f, j) => {
      const seq = msg.s + j;
      if (seq > tail) q.frames.push({ seq, f });
    });
    for (const [n, a] of msg.a ?? []) {
      if (n <= q.actN) continue;
      q.actN = n;
      if (a.t === 'join') {
        if (peerOf(a.dev) === from) this.wants.add(a.dev); // seated by reconcile() between rounds
      } else if (this.allowed(from, a)) this.hostActions.push(a);
    }
    if (msg.h) {
      const mine = this.hashes.get(msg.h[0]);
      if (mine !== undefined && mine !== msg.h[1]) {
        this.stats.desyncs++;
        this.log(`desync with ${from} at frame ${msg.h[0]}: resync`);
        this.send(this.syncMsg('desync'), from);
      }
    }
  }

  /** Guests may only act for their own devices; rules and seating belong to the host. */
  private allowed(from: string, a: NetAction): boolean {
    if (a.t === 'rules' || a.t === 'join') return false;
    return peerOf(a.dev) === from;
  }

  private onHello(from: string) {
    this.send(this.syncMsg('hello'), from);
  }

  private onNeed(from: string, f: number) {
    const first = this.history[0]?.f ?? Infinity;
    if (f >= first && f <= this.match.frame) {
      const slice = this.history.slice(f - first);
      for (let i = 0; i < slice.length; i += 120) this.send({ t: 'b', b: slice.slice(i, i + 120) }, from);
    } else {
      this.send(this.syncMsg('behind'), from);
    }
  }

  private syncMsg(why: string): Msg {
    const k: Record<string, [number, number]> = {};
    for (const [p, q] of this.queues) k[p] = [q.consumed, q.actN];
    const last: Record<string, Enc> = {};
    for (const [p, q] of this.queues) for (const [d, e] of Object.entries(q.last)) last[`${p}:${d}`] = e;
    return { t: 'sync', s: snapshotMatch(this.match), k, ns: structuredCloneJson(this.ns), last, why };
  }

  private hostTick(own: PeerFrame) {
    if (this.paused) return;
    const inputs: Record<string, Enc> = {};
    for (const [d, e] of Object.entries(own)) inputs[this.globalDevice(d)] = e;
    const k: Record<string, [number, number]> = {};
    for (const [peer, q] of this.queues) {
      // Bound latency: if a burst piled up, fold the oldest frames together (edges are kept, see codec.merge).
      if (q.frames.length > QUEUE_HIGH) {
        while (q.frames.length > QUEUE_KEEP) {
          const [a, b] = q.frames;
          q.frames.splice(0, 2, { seq: b.seq, f: mergePeerFrames(a.f, b.f) });
        }
      }
      const next = q.frames.shift();
      let f: PeerFrame;
      if (next) {
        q.consumed = next.seq;
        q.last = next.f;
        f = next.f;
      } else f = heldPeerFrame(q.last);
      for (const [d, e] of Object.entries(f)) if (e !== 0) inputs[`${peer}:${d}`] = e;
      const sig = `${q.consumed},${q.actN}`;
      if (this.sentK.get(peer) !== sig) {
        this.sentK.set(peer, sig);
        k[peer] = [q.consumed, q.actN];
      }
    }
    const actions = [...this.reconcile(), ...this.hostActions.splice(0)];
    const b: Bundle = { f: this.match.frame };
    if (Object.keys(inputs).length) b.i = inputs;
    if (actions.length) b.a = actions;
    if (Object.keys(k).length) b.k = k;
    this.apply(b);
    this.history.push(b);
    if (this.history.length > HISTORY) this.history.shift();
    if (this.match.frame % HASH_EVERY === 0) {
      this.hashes.set(this.match.frame, hashMatch(this.match));
      for (const f of this.hashes.keys()) if (f < this.match.frame - HASH_EVERY * 30) this.hashes.delete(f);
    }
    if (this.remoteCount === 0) {
      this.outbox = [];
      return;
    }
    this.outbox.push(b);
    if (this.ticks % this.sendEvery === 0 || actions.length) {
      this.send({ t: 'b', b: this.outbox });
      this.outbox = [];
    }
  }

  /**
   * Host bookkeeping turned into actions: mark players of vanished peers away
   * (or drop them from the lobby), bring them back when they return, restore
   * parked lobby seats, and seat spectators between rounds.
   */
  private reconcile(): NetAction[] {
    if (!this.transport || this.ticks % 6 !== 0) return [];
    const m = this.match;
    const present = new Set(this.members.map((x) => x.id));
    const out: NetAction[] = [];
    for (const p of m.players) {
      const peer = peerOf(p.device);
      if (!peer) continue;
      if (!present.has(peer)) {
        if (m.phase === 'lobby') out.push({ t: 'leave', dev: p.device });
        else if (!p.away) out.push({ t: 'away', dev: p.device, on: true });
      } else if (p.away) out.push({ t: 'away', dev: p.device, on: false });
    }
    let seats = m.players.length;
    const seated = new Set(m.players.map((p) => p.device));
    if (m.phase === 'lobby') {
      for (const [peer, list] of Object.entries(this.ns.parked)) {
        if (!present.has(peer)) continue;
        for (const x of list) {
          if (seated.has(x.dev) || seats >= MAX_PLAYERS) continue;
          out.push({ t: 'join', dev: x.dev, char: x.char });
          seats++;
          seated.add(x.dev);
        }
      }
    }
    if (m.phase === 'lobby' || m.phase === 'score' || m.phase === 'victory') {
      for (const dev of this.wants) {
        if (!present.has(peerOf(dev)) || seated.has(dev) || seats >= MAX_PLAYERS) continue;
        out.push({ t: 'join', dev });
        seats++;
        seated.add(dev);
      }
      this.wants.clear();
    }
    return out;
  }

  // ------------------------------------------------------------------ guest

  private guestTick(own: PeerFrame, t: number) {
    if (!this.synced) {
      if (this.status === 'online' && t - this.lastHello > HELLO_RETRY_MS) {
        this.lastHello = t;
        this.send({ t: 'hello' }, this.hostId);
      }
      return;
    }
    this.unacked.push({ seq: ++this.seq, f: own });
    if (this.unacked.length > MAX_UNACKED) this.unacked.shift();
    this.maybeWant(own);
    this.applyInbox(t);
    const pressed = Object.values(own).some((e) => (typeof e === 'number' ? e : e[0]) & 0x1e0);
    if (this.ticks % this.sendEvery === 0 || pressed || this.pendingActs.length) {
      const msg: Msg = { t: 'in', s: this.unacked[0]?.seq ?? this.seq + 1, f: this.unacked.map((u) => u.f), c: this.match.frame };
      if (this.pendingActs.length) msg.a = this.pendingActs;
      if (this.pendingHash) msg.h = this.pendingHash;
      this.pendingHash = undefined;
      this.send(msg, this.hostId);
    }
  }

  /** Spectators (joined mid-match) ask for a seat; the host grants it between rounds. */
  private maybeWant(own: PeerFrame) {
    const m = this.match;
    if (m.phase === 'lobby') return;
    const mine = m.players.some((p) => peerOf(p.device) === this.self);
    if (mine || this.wantSentTo === this.hostId) return;
    const dev = Object.keys(own).find((d) => {
      const e = own[d];
      return ((typeof e === 'number' ? e : e[0]) & (1 << 6)) !== 0;
    });
    const auto = this.wantSentTo === '' ? this.primary : undefined;
    const pick = dev ?? auto;
    if (!pick) return;
    this.wantSentTo = this.hostId;
    this.pendingActs.push([++this.actN, { t: 'join', dev: this.globalDevice(pick) }]);
  }

  private applyInbox(t: number) {
    let n = 0;
    while (n < MAX_APPLY_PER_TICK) {
      const b = this.inbox.get(this.match.frame);
      if (!b) break;
      this.inbox.delete(b.f);
      this.apply(b);
      n++;
      if (this.match.frame % HASH_EVERY === 0) this.pendingHash = [this.match.frame, hashMatch(this.match)];
    }
    for (const f of this.inbox.keys()) if (f < this.match.frame) this.inbox.delete(f);
    // A hole in the stream (lost packet): ask the host to resend from there.
    if (this.inbox.size && !this.inbox.has(this.match.frame)) {
      if (this.gapSince < 0) this.gapSince = t;
      if (t - this.gapSince > NEED_AFTER_MS && t - this.lastNeed > NEED_AFTER_MS * 2) {
        this.lastNeed = t;
        this.send({ t: 'need', f: this.match.frame }, this.hostId);
      }
    } else this.gapSince = -1;
  }

  private onSync(msg: Extract<Msg, { t: 'sync' }>) {
    const m = this.match;
    const fresh = !this.synced;
    if (fresh || m.frame !== msg.s.frame || hashMatch(m) !== hashSnap(msg.s)) restoreMatch(m, msg.s);
    this.ns.parked = msg.ns.parked;
    this.acks = msg.k;
    this.lastInputs = msg.last;
    for (const f of this.inbox.keys()) if (f < m.frame) this.inbox.delete(f);
    const mine = msg.k[this.self];
    if (mine) this.prune(mine);
    if (fresh || Math.abs(this.emittedThrough - m.frame) > 120) this.emittedThrough = m.frame;
    this.synced = true;
    this.stats.syncs++;
    this.log(`synced (${msg.why}) at frame ${m.frame}`);
  }

  private prune([seq, actN]: [number, number]) {
    while (this.unacked.length && this.unacked[0].seq <= seq) this.unacked.shift();
    while (this.pendingActs.length && this.pendingActs[0][0] <= actN) this.pendingActs.shift();
  }

  // ------------------------------------------------------------------ shared

  /** Apply one bundle: actions, then the frame's inputs. Identical on every peer. */
  private apply(b: Bundle) {
    const m = this.match;
    for (const a of b.a ?? []) {
      if (a.t === 'rules') applyAction(m, this.ns, { t: 'rules', rules: sanitizeRules(a.rules) });
      else applyAction(m, this.ns, a);
    }
    const inputs: Record<string, InputFrame> = {};
    for (const [d, e] of Object.entries(b.i ?? {})) inputs[d] = decode(e);
    m.step(inputs);
    this.stats.bundles++;
    this.lastInputs = b.i ?? {};
    if (b.k) {
      for (const [p, v] of Object.entries(b.k)) this.acks[p] = v;
      const mine = b.k[this.self];
      if (mine) this.prune(mine);
    }
    this.collect(m);
  }

  private collect(m: Match) {
    const ev = m.drainEvents();
    if (m.frame > this.emittedThrough) {
      this.emittedThrough = m.frame;
      if (ev.length) this.events.push(...ev);
    }
  }

  private localFrame(local: Readonly<Record<string, InputFrame>>): PeerFrame {
    const out: PeerFrame = {};
    const prefix = `${this.self}:`;
    for (const [dev, f] of Object.entries(local)) {
      let d = dev;
      if (d.startsWith(prefix)) d = d.slice(prefix.length);
      else if (this.transport && d.includes(':')) continue; // a HUD button for someone else's player
      const e = encode(f);
      if (e === 0) continue;
      out[d] = out[d] !== undefined ? mergePeerFrames({ x: out[d] }, { x: e }).x : e;
    }
    return out;
  }

  /** Guests in a race: re-predict from the confirmed state with our unacked inputs. */
  private updateView() {
    const m = this.match;
    if (!this.predict || this.role !== 'guest' || !this.synced || m.phase !== 'run' || this.unacked.length === 0) {
      this.viewMatch = m;
      return;
    }
    const d = this.predictor.copy(m);
    const others: Record<string, InputFrame> = {};
    for (const [dev, e] of Object.entries(this.lastInputs)) if (peerOf(dev) !== this.self) others[dev] = decode(heldOf(e));
    const n = Math.min(MAX_PREDICT, this.unacked.length);
    for (let i = 0; i < n; i++) {
      const inputs: Record<string, InputFrame> = { ...others };
      for (const [dev, e] of Object.entries(this.unacked[i].f)) inputs[this.globalDevice(dev)] = decode(e);
      d.step(inputs);
      this.stats.predicted++;
      this.collect(d);
      if (d.phase !== 'run') break;
    }
    this.viewMatch = d;
  }
}

function heldOf(e: Enc): Enc {
  return (typeof e === 'number' ? e : e[0]) & 0x1f;
}

function structuredCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
