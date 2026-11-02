import { IDLE_ROUNDS, type Match } from '../game/match';
import { DT, MAX_PLAYERS } from '../sim/constants';
import { addBreadcrumb, reportEvent, reportLog } from '../telemetry';
import type { Runner } from '../sim/run';
import type { GameEvent, InputFrame } from '../sim/types';
import { applyAction, freeSeats, type NetAction, type NetState, newNetState, peerOf, sanitizeRules, SEAT_PHASES, type Watcher } from './actions';
import { CONFIRM_BIT, decode, type Enc, encode, held, heldPeerFrame, mergePeerFrames, type PeerFrame, PRESSED } from './codec';
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
 *
 * Because everyone holds the full state, host migration needs no handover:
 * the next peer in join order pauses, waits for the others to link up and say
 * how far they got, takes a snapshot from whoever is furthest (some bundles
 * may have reached only some peers), and syncs everyone to it.
 */

export const HASH_EVERY = 60;
const HISTORY = 600;
const PING_MS = 1000;
const HELLO_RETRY_MS = 1000;
const REFUSED_RETRY_MS = 10_000;
const NEED_AFTER_MS = 150;
const MAX_UNACKED = 90;
/**
 * Frames a guest may have waiting on the host. Every frame beyond one is 17 ms
 * of lag for everyone watching, and the host only eats one a tick, so a queue
 * left alone never drains. Two absorbs ordinary jitter.
 */
const QUEUE_MAX = 2;
const MAX_APPLY_PER_TICK = 900;
const WANT_RETRY_MS = 1000;
const MAX_PREDICT = 24;
/** How long a new host waits for the room to report in, and for the furthest peer's snapshot. */
const COLLECT_MS = 7000;
const PULL_MS = 1500;
/**
 * A migration slower than this, from noticing the host gone to the room playing again, is reported. The designed
 * worst case is under 18 s (the old host's probe window, a candidate's, then COLLECT_MS and PULL_MS); measured ones
 * take 4–8 s including the 2.5 s of silence before anyone notices.
 */
const SLOW_MIGRATION_MS = 20_000;
/** Per-view-update step of a remote cursor toward its confirmed position. Presentation only. */
const CURSOR_SMOOTH = 0.5;
/** What's left of a drawn runner's prediction error after one frame. Presentation only. */
const CORRECTION_KEEP = 0.85;
/** A correction this large (px) is a respawn or a pipe, not an error: show it. A late jump at 100 ms round trip is already about 50. */
const CORRECTION_MAX = 120;
const CORRECTION_MAX_STEPS = 4;
/**
 * Host ticks a seated guest may send no input before the host stops holding its buttons down for it. A frozen
 * tab or a dead link otherwise keeps running its runner into whatever is ahead until the link times out.
 * From there the idle rules (game/match.ts) decide when the room stops waiting on it.
 */
const SOFT_TICKS = 60;
/** An observer ahead of a player in join order waits this long, then moves to the back (see maybeReorder). */
const REORDER_AFTER_MS = 2000;
const REORDER_EVERY_MS = 10_000;

export type NetStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'unavailable' | 'kicked';
export type Role = 'host' | 'guest';
/**
 * What this peer wants to be: `play` (seated, or asking for a seat) or `watch`. Arriving in the lobby is
 * playing; arriving mid-match is watching, with Join a click away.
 */
export type Intent = 'play' | 'watch';
/** How this peer's last request for a seat went: the host's order settles a race for the last one. */
export type SeatAsk = 'none' | 'asking' | 'won' | 'taken';

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
  /** Display name: the peer's first player's name, or the name it watches under. */
  name: string;
  /** Has a seat in the match. A peer without one sends no input. */
  seated: boolean;
  /** Watching by choice, or moved there for being idle. */
  watching?: Watcher;
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
  /** `f`: the furthest frame this peer holds, -1 if it never joined this room's timeline. */
  | { t: 'hello'; f: number }
  | { t: 'need'; f: number }
  /** New host to the furthest guest: send me your state. */
  | { t: 'pull' }
  | { t: 'state'; s: MatchSnap; k: Record<string, [number, number]>; ns: NetState; last: Record<string, Enc> }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'pings'; p: Record<string, number> }
  /** Host to a peer it removed. */
  | { t: 'kicked' };

export interface SessionOptions {
  transport: Transport | null;
  match: Match;
  /** Monotonic ms clock (injectable for tests). */
  now?: () => number;
  /** Guests send input every N ticks and the host flushes bundles every N ticks. Waiting saves little and costs 17 ms each way. */
  sendEvery?: number;
  /** Client-side prediction during races (guests). */
  predict?: boolean;
  /**
   * Local device an unseated peer asks to be seated with. A function is read at each ask, so the seat goes to
   * whatever the person is using by then: a page can't know it's on a phone until its touch input is up.
   */
  primaryDevice?: string | (() => string);
  /** Called with a resumable snapshot when we become host of an empty room; return one to resume. */
  resume?: () => { snap: MatchSnap; ns: NetState } | null;
  /** The host removed this peer: it's already out of the room. */
  onKicked?: () => void;
  /** Arrive as an observer (an invite opened with `?watch`). */
  watch?: boolean;
  /** The name an observer's chip shows, read when it starts watching. */
  name?: () => string;
  log?: (msg: string) => void;
}

interface RemoteQueue {
  frames: { seq: number; f: PeerFrame }[];
  consumed: number;
  actN: number;
  last: PeerFrame;
  /** Host ticks in a row with nothing queued. */
  dry: number;
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
  /** Guests: the host's snapshot is from another build (see restoreMatch), so this page can't join until one of us reloads. */
  refused = false;
  /** Crate card this peer has clicked and the host hasn't ruled on yet (-1: none). Never a claim: the host decides those. */
  pendingCard = -1;
  /** See Intent. Starts as `play` (or `watch` from a watch link) and becomes `watch` on arriving mid-match. */
  intent: Intent;
  /** The last Join: still with the host, won (seated, or owed a seat at the round boundary), or lost to someone quicker. */
  seatAsk: SeatAsk = 'none';
  /** Counters for the HUD/debug overlay and tests. */
  stats = { desyncs: 0, syncs: 0, migrations: 0, bundles: 0, predicted: 0, dryTicks: 0, foldedFrames: 0, queuedFrames: 0, hostTicks: 0 };

  private now: () => number;
  private sendEvery: number;
  private predict: boolean;
  private resumeFn: SessionOptions['resume'];
  private onKickedFn: SessionOptions['onKicked'];
  private log: (msg: string) => void;
  private ticks = 0;
  private events: GameEvent[] = [];
  private emittedThrough = -1;
  private predictor = new Predictor();
  private viewMatch: Match;
  private viewDirty = true;
  private primaryFn: () => string;
  private nameFn: () => string;
  /** The intent has been squared with the room's state once (see settleIntent). */
  private arrived = false;
  private wasWatching = false;
  /** Back from idle: the seat has been asked for once. */
  private backAsked = false;
  private lineSince = -1;
  private lastReorder = -1e9;
  /** The seat request with the host, if any (see play). */
  private asked: NetAction | null = null;
  /** The transport has told us who's here at least once. */
  private heardMembers = false;

  // host state
  private queues = new Map<string, RemoteQueue>();
  private history: Bundle[] = [];
  private outbox: Bundle[] = [];
  private resend: Bundle | null = null;
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
  private wantAt = 0;
  private stash: { from: string; msg: Msg; at: number }[] = [];
  /** True once this peer has followed the room's timeline, so its frame number means something to a new host. */
  private onTimeline = false;
  /** Set while a freshly promoted host gathers the room (see collectTick). */
  private collecting: { until: number; got: Map<string, number>; pulled: string; pullAt: number } | null = null;
  private smooth = new Map<number, { x: number; y: number }>();
  /** Where each runner was last drawn in a predicted view. */
  private eased = new Map<number, { x: number; y: number }>();
  private easedFrame = 0;

  // pings
  private rtt = new Map<string, number>();
  private heard = new Map<string, number>();
  private remotePings: Record<string, number> = {};
  private lastPing = -1e9;
  private resumed = false;
  private closed = false;
  private reportedRefusal = false;
  /** When this peer lost its host or its link, for timing the recovery; -1 when settled. */
  private lostAt = -1;
  /** The host this peer took over from, for the migration's report. */
  private migratedFrom = '';

  constructor(opts: SessionOptions) {
    this.match = opts.match;
    this.viewMatch = opts.match;
    this.transport = opts.transport;
    this.self = opts.transport?.self ?? 'local';
    this.hostId = this.self;
    this.now = opts.now ?? (() => performance.now());
    this.sendEvery = Math.max(1, opts.sendEvery ?? 1);
    this.predict = opts.predict ?? true;
    this.resumeFn = opts.resume;
    this.onKickedFn = opts.onKicked;
    const primary = opts.primaryDevice ?? 'kb1';
    this.primaryFn = typeof primary === 'function' ? primary : () => primary;
    this.nameFn = opts.name ?? (() => '');
    this.intent = opts.watch ? 'watch' : 'play';
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
   * we just became host and are gathering the room, or we are a guest still
   * waiting for the host's snapshot.
   */
  get paused(): boolean {
    if (this.role === 'guest') return !this.synced;
    if (this.collecting) return true;
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

  /** Host, lobby: remove a peer. Goes out in a bundle like any action, so every peer applies it at the same frame. */
  kick(peer: string) {
    if (this.role === 'host' && this.match.phase === 'lobby' && peer !== this.self) this.hostActions.push({ t: 'kick', peer });
  }

  /** This peer holds a seat in the match. Offline, everyone on this machine does. */
  get seated(): boolean {
    return !this.transport || this.match.players.some((p) => peerOf(p.device) === this.self);
  }

  /** Watching, by choice or for being idle, as the room has it. */
  get watching(): Watcher | undefined {
    return this.ns.watching[this.self];
  }

  /** Seats a Join could still win: nobody holds them past the round boundary, and nobody is owed them. */
  get space(): number {
    return freeSeats(this.match, this.ns);
  }

  /** Owed a seat at the next round boundary. */
  get queued(): boolean {
    return this.ns.queue.some((q) => q.peer === this.self);
  }

  /**
   * Join: ask the host for a seat, taken at once in the lobby and between rounds, at the round boundary
   * mid-round. A sequenced action, so when two ask for the last seat the host's order decides, the same on
   * every peer; `seatAsk` says how it went. Asking again while it's out is the same request.
   */
  play() {
    this.intent = 'play';
    const mine = this.match.players.filter((p) => peerOf(p.device) === this.self);
    if (this.asked || (mine.length && !mine.some((p) => p.leaving)) || this.queued) return;
    const a: NetAction = { t: 'seat', dev: this.globalDevice(this.primaryFn()), on: true };
    this.asked = a;
    this.seatAsk = 'asking';
    addBreadcrumb('room', 'join request', { frame: this.match.frame });
    this.act(a);
  }

  /** Watch instead of playing. A seat is given up at once in the lobby, at the round boundary mid-match; a place in line at once. */
  watch() {
    this.intent = 'watch';
    this.seatAsk = 'none';
    if (!this.watching || this.queued || this.match.players.some((p) => peerOf(p.device) === this.self && !p.leaving))
      this.act({ t: 'watch', dev: this.globalDevice(this.primaryFn()), on: true, name: this.nameFn() });
  }

  /** The seat request, once the host has sequenced it: applied everywhere at the same frame, so the answer is in our own state. */
  private settleAsk() {
    const a = this.asked;
    if (!a || this.pendingActs.some(([, x]) => x === a) || this.hostActions.includes(a)) return;
    this.asked = null;
    const won = this.seated || this.queued;
    this.seatAsk = won ? 'won' : 'taken';
    addBreadcrumb('room', won ? 'join won' : 'join lost', { frame: this.match.frame, queued: this.queued });
    if (!won) this.intent = 'watch';
  }

  /** True while an action this peer requested hasn't been applied yet. */
  get pending(): boolean {
    return this.pendingActs.length > 0 || this.hostActions.length > 0;
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
      const watching = this.ns.watching[m.id];
      const name = players[0]?.character.name ?? watching?.name ?? '';
      return { id: m.id, order: m.order, isHost, isSelf, ping, quality, slots: players.map((p) => p.slot), name, seated: players.length > 0, watching };
    });
  }

  /** Send any batched bundles now (e.g. before the page hides), repeating the last one in case it was lost. */
  flush() {
    if (this.role === 'host' && (this.outbox.length || this.resend) && this.remoteCount) this.sendBundles();
    this.outbox = [];
  }

  /**
   * Leave the room. Nothing the transport says afterwards counts: its last word is a member list of just us, which
   * would otherwise make a guest "take over" its own empty room on the way out, report a migration and resume a save.
   */
  close() {
    this.flush();
    this.closed = true;
    this.transport?.close();
    if (this.transport && this.status !== 'kicked') this.status = 'offline';
  }

  /**
   * One fixed 60 Hz step. `local` is this machine's sampled input keyed by
   * local device ('kb1', 'pad0'; HUD presses may already be global ids).
   */
  tick(local: Readonly<Record<string, InputFrame>>): void {
    if (this.status === 'kicked') return;
    this.ticks++;
    const frame = this.localFrame(local);
    const t = this.now();
    if (this.transport && t - this.lastPing >= PING_MS) {
      this.lastPing = t;
      if (this.role === 'host') {
        this.send({ t: 'ping', ts: t }, undefined, true);
        if (this.ticks % 2 === 0) this.send({ t: 'pings', p: Object.fromEntries(this.rtt) }, undefined, true);
      } else if (this.hostId !== this.self) this.send({ t: 'ping', ts: t }, this.hostId, true);
    }
    if (this.heardMembers && (this.role === 'host' ? !this.collecting : this.synced)) this.settleIntent(frame);
    if (this.role === 'host') this.hostTick(frame);
    else this.guestTick(frame, t);
    this.settleAsk();
    this.maybeReorder(t);
    this.viewDirty = true;
  }

  /**
   * Square what this peer wants with what the room says, once the room's state is known: a watch link, or
   * arriving mid-match, is watching; being moved to the watchers (idle) is followed; and any input from someone
   * moved there for being idle asks for the seat back.
   */
  private settleIntent(own: PeerFrame) {
    const w = this.watching;
    if (!!w !== this.wasWatching) {
      this.wasWatching = !!w;
      this.backAsked = false;
      if (w) this.intent = 'watch';
    }
    if (!this.arrived) {
      this.arrived = true;
      // A watch link, or a match already running: watch, with Join a click away.
      if ((this.intent === 'watch' && !w) || (!w && !this.seated && this.match.phase !== 'lobby')) this.watch();
    }
    if (w?.afk && !this.backAsked && Object.keys(own).length) {
      this.backAsked = true;
      addBreadcrumb('room', 'back from idle', { frame: this.match.frame });
      this.play();
    }
  }

  /**
   * The host is the lowest join order present (the store, every newcomer and every election agree on that
   * without asking anyone), so an observer must never be ahead of a player in it, or losing the host would
   * hand the room to someone with no stake in the match. An observer ahead of a seated peer rejoins the order
   * at the back. A host doing it hands the room to the next in line. With only observers left, the earliest
   * of them hosts until someone takes a seat.
   */
  private maybeReorder(t: number) {
    const tr = this.transport;
    const me = this.members.find((m) => m.id === this.self);
    const behind =
      !!tr?.reorder &&
      !!me &&
      this.status === 'online' &&
      !this.paused &&
      !this.seated &&
      this.members.some((m) => m.order > me.order && !m.linking && this.match.players.some((p) => peerOf(p.device) === m.id));
    if (!behind) {
      this.lineSince = -1;
      return;
    }
    if (this.lineSince < 0) this.lineSince = t;
    if (t - this.lineSince < REORDER_AFTER_MS || t - this.lastReorder < REORDER_EVERY_MS) return;
    this.lastReorder = t;
    this.lineSince = -1;
    this.log('observer ahead of a player: moving to the back of the line');
    tr!.reorder!();
  }

  // ------------------------------------------------------------------ transport events

  private onStatus(s: LinkStatus, detail?: string) {
    if (this.status === 'kicked' || this.closed) return;
    this.detail = detail ?? '';
    this.status =
      s === 'open' ? 'online' : s === 'connecting' ? 'connecting' : s === 'reconnecting' ? 'reconnecting' : s === 'closed' ? 'offline' : 'unavailable';
    if (s !== 'open') {
      // Presence is unknown while disconnected; keep the last list but forget everyone else's queues.
      this.log(`link ${s}${detail ? ` (${detail})` : ''}`);
    }
    if (s === 'reconnecting' && this.lostAt < 0) this.lostAt = this.now();
    // A host whose API came back without a migration: nothing to time.
    else if (s === 'open' && this.role === 'host' && !this.collecting) this.lostAt = -1;
    // Grouped by why: an unconfigured store, a host behind NAT and a browser without WebRTC are different problems.
    if (s === 'unavailable') reportEvent('net-unavailable', 'warning', { detail }, { group: detail || 'unknown' });
    if (s === 'closed' || s === 'unavailable') this.onMembers([{ id: this.self, order: 0 }]);
  }

  private onMembers(list: Member[]) {
    if (this.status === 'kicked' || this.closed) return;
    if (!list.some((m) => m.id === this.self)) list = [...list, { id: this.self, order: Number.MAX_SAFE_INTEGER }];
    this.heardMembers = true;
    if (list.length !== this.members.length) addBreadcrumb('net', list.length > this.members.length ? 'peer joined' : 'peer left', { peers: list.length });
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
    if (this.collecting && this.role !== 'host') this.collecting = null;
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
        if (this.lostAt < 0) this.lostAt = this.now(); // a goodbye skips 'reconnecting'
        this.migratedFrom = prev;
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

  /**
   * Guest → host. Nothing advances until the room has reported in, because
   * the old host's last bundles may have reached only some peers: the sim
   * resumes from the furthest frame anyone holds, so nothing that happened is
   * undone, and in-flight inputs that never made a bundle simply never happened.
   */
  private promote() {
    this.resumed = true;
    this.rebuildQueues();
    // Our own unacked inputs and actions never made it into a bundle: apply them as host now.
    for (const [, a] of this.pendingActs) this.hostActions.push(a);
    this.pendingActs = [];
    this.unacked = [];
    this.history = [];
    this.outbox = [];
    this.hashes.clear();
    this.synced = true;
    this.collecting = { until: this.now() + COLLECT_MS, got: new Map(), pulled: '', pullAt: 0 };
  }

  /** Host-side view of each guest, from the ack and input state every peer tracks out of bundles. */
  private rebuildQueues() {
    this.queues.clear();
    for (const m of this.members) {
      if (m.id === this.self) continue;
      const k = this.acks[m.id] ?? [0, 0];
      const last: PeerFrame = {};
      for (const [dev, e] of Object.entries(this.lastInputs)) if (peerOf(dev) === m.id) last[dev.slice(m.id.length + 1)] = e;
      this.queues.set(m.id, { frames: [], consumed: k[0], actN: k[1], last: heldPeerFrame(last), dry: 0 });
    }
  }

  /** Ends the gathering once everyone reachable has reported and any further-ahead state is in. */
  private collectTick(t: number) {
    const c = this.collecting!;
    if (c.pulled) {
      if (t - c.pullAt > PULL_MS) this.finishCollect();
      return;
    }
    const others = this.members.filter((m) => m.id !== this.self);
    const everyone = others.every((m) => !m.linking && c.got.has(m.id));
    if (!everyone && t < c.until) return;
    let furthest = this.onTimeline ? this.match.frame : -1;
    let from = '';
    for (const [id, f] of c.got) {
      if (f > furthest) {
        furthest = f;
        from = id;
      }
    }
    if (!from) return this.finishCollect();
    this.log(`resuming from ${from} at frame ${furthest} (we had ${this.match.frame})`);
    c.pulled = from;
    c.pullAt = t;
    this.send({ t: 'pull' }, from);
  }

  private finishCollect() {
    this.collecting = null;
    // Only the new host reports, so one migration is one report; its clock runs from its own loss of the old host.
    const ms = this.lostAt >= 0 ? Math.round(this.now() - this.lostAt) : 0;
    this.lostAt = -1;
    const timeline = { ms, from: this.migratedFrom, to: this.self, peers: this.members.length, frame: this.match.frame, phase: this.match.phase };
    reportLog('host migration', 'info', timeline);
    if (ms > SLOW_MIGRATION_MS) reportEvent('slow-host-migration', 'warning', timeline);
    for (const m of this.members) if (m.id !== this.self) this.send(this.syncMsg('migrate'), m.id);
  }

  private onState(from: string, msg: Extract<Msg, { t: 'state' }>) {
    if (this.collecting?.pulled !== from) return;
    if (this.tryRestore(msg.s)) {
      this.adoptNet(msg.ns);
      this.acks = msg.k;
      this.lastInputs = msg.last;
      this.emittedThrough = Math.max(this.emittedThrough, this.match.frame);
      this.rebuildQueues();
    }
    this.finishCollect(); // refused: the room carries on from our own state
  }

  /** Load a peer's snapshot; false, with `match` untouched, if this build can't (see restoreMatch). */
  private tryRestore(s: MatchSnap): boolean {
    try {
      restoreMatch(this.match, s);
      return true;
    } catch (e) {
      this.log(`snapshot refused: ${String(e)}`);
      // Once a page: a refused guest asks again every few seconds.
      if (!this.reportedRefusal) reportEvent('snapshot-refused', 'warning', { error: String(e), frame: this.match.frame });
      this.reportedRefusal = true;
      return false;
    }
  }

  /** Tolerates a resume save from before a field existed. */
  private adoptNet(ns: Partial<NetState>) {
    this.ns.parked = ns.parked ?? {};
    this.ns.kicked = ns.kicked ?? {};
    this.ns.watching = ns.watching ?? {};
    this.ns.queue = ns.queue ?? [];
  }

  private onKicked() {
    if (this.status === 'kicked') return;
    this.status = 'kicked';
    this.onKickedFn?.();
    this.transport?.close();
  }

  private tryResume() {
    if (this.resumed) return;
    this.resumed = true;
    const r = this.resumeFn?.();
    if (!r) return;
    try {
      restoreMatch(this.match, r.snap);
      this.adoptNet(r.ns);
      this.emittedThrough = this.match.frame;
      this.log(`resumed saved room state at frame ${this.match.frame}`);
    } catch (e) {
      this.log(`resume failed: ${String(e)}`);
    }
  }

  private send(m: Msg, to?: string, lossy?: boolean) {
    this.transport?.send(m, to, lossy);
  }

  private onMessage(from: string, msg: Msg) {
    if (this.closed) return;
    this.heard.set(from, this.now());
    switch (msg.t) {
      case 'ping':
        this.send({ t: 'pong', ts: msg.ts }, from, true);
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
      else if (msg.t === 'hello') this.onHello(from, msg.f);
      else if (msg.t === 'need') this.onNeed(from, msg.f);
      else if (msg.t === 'state') this.onState(from, msg);
      else if (msg.t === 'b' || msg.t === 'sync') this.stashMsg(from, msg); // someone else thinks they're host: presence lag
      return;
    }
    if (msg.t === 'kicked') {
      if (from === this.hostId) this.onKicked();
      return;
    }
    if (msg.t === 'pull') {
      if (from === this.hostId) {
        const last = { ...this.lastInputs };
        this.send({ t: 'state', s: snapshotMatch(this.match), k: this.acks, ns: structuredCloneJson(this.ns), last }, from);
      }
      return;
    }
    if (msg.t !== 'b' && msg.t !== 'sync') return;
    if (from !== this.hostId) {
      this.stashMsg(from, msg);
      return;
    }
    if (msg.t === 'sync') this.onSync(msg);
    else {
      for (const b of msg.b) if (b.f >= this.match.frame && !this.inbox.has(b.f)) this.inbox.set(b.f, b);
      // Now, not on the next tick: that wait would only add to what everyone sees.
      if (this.synced) {
        this.applyInbox(this.now());
        this.viewDirty = true;
      }
    }
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
      q = { frames: [], consumed: 0, actN: 0, last: {}, dry: 0 };
      this.queues.set(peer, q);
    }
    return q;
  }

  private onInput(from: string, msg: Extract<Msg, { t: 'in' }>) {
    if (!this.members.some((m) => m.id === from) || this.ns.kicked[from]) return;
    const q = this.queue(from);
    const tail = q.frames.length ? q.frames[q.frames.length - 1].seq : q.consumed;
    // Observers send no input, and anything one sends anyway (a seat just given up) plays no part.
    if (this.match.players.some((p) => peerOf(p.device) === from)) {
      msg.f.forEach((f, j) => {
        const seq = msg.s + j;
        if (seq > tail) q.frames.push({ seq, f });
      });
    }
    for (const [n, a] of msg.a ?? []) {
      if (n <= q.actN) continue;
      q.actN = n;
      if (a.t === 'join') {
        if (peerOf(a.dev) === from) this.wants.add(a.dev); // seated by reconcile() between rounds
      } else if (this.allowed(from, a)) this.hostActions.push(a.t === 'watch' ? { t: 'watch', dev: a.dev, on: a.on, name: a.name } : a); // idleness is the host's call
    }
    if (msg.h) {
      const mine = this.hashes.get(msg.h[0]);
      if (mine !== undefined && mine !== msg.h[1]) {
        this.stats.desyncs++;
        this.log(`desync with ${from} at frame ${msg.h[0]}: resync`);
        reportEvent('desync', 'error', { frame: msg.h[0], peer: from, localHash: mine, remoteHash: msg.h[1], phase: this.match.phase });
        this.send(this.syncMsg('desync'), from);
      }
    }
  }

  /** Guests may only act for their own devices; rules and seating belong to the host. */
  private allowed(from: string, a: NetAction): boolean {
    if (a.t === 'rules' || a.t === 'join' || a.t === 'salt' || a.t === 'kick') return false;
    return peerOf(a.dev) === from;
  }

  private onHello(from: string, f: number) {
    if (this.ns.kicked[from]) return this.send({ t: 'kicked' }, from);
    if (this.collecting) this.collecting.got.set(from, typeof f === 'number' ? f : -1);
    else this.send(this.syncMsg('hello'), from);
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
    if (this.collecting) this.collectTick(this.now());
    if (this.paused) return;
    const inputs: Record<string, Enc> = {};
    if (this.seated) for (const [d, e] of Object.entries(own)) inputs[this.globalDevice(d)] = e;
    const seatedPeers = new Set(this.match.players.map((p) => peerOf(p.device)));
    const k: Record<string, [number, number]> = {};
    for (const [peer, q] of this.queues) {
      const sig = `${q.consumed},${q.actN}`;
      if (this.sentK.get(peer) !== sig) {
        this.sentK.set(peer, sig);
        k[peer] = [q.consumed, q.actN];
      }
      if (!seatedPeers.has(peer)) {
        // An observer: nothing to wait for and nothing to hold down.
        q.frames = [];
        q.last = {};
        q.dry = 0;
        continue;
      }
      // Bound latency: fold the oldest frames together (edges are kept, see codec.merge).
      while (q.frames.length > QUEUE_MAX) {
        const [a, b] = q.frames;
        q.frames.splice(0, 2, { seq: b.seq, f: mergePeerFrames(a.f, b.f) });
        this.stats.foldedFrames++;
      }
      this.stats.hostTicks++;
      this.stats.queuedFrames += q.frames.length;
      const next = q.frames.shift();
      let f: PeerFrame;
      if (next) {
        q.consumed = next.seq;
        q.last = next.f;
        q.dry = 0;
        f = next.f;
      } else {
        this.stats.dryTicks++;
        // Never wait: hold its buttons through a hiccup, then let go of them (soft disconnect, see SOFT_TICKS).
        f = ++q.dry > SOFT_TICKS ? {} : heldPeerFrame(q.last);
      }
      for (const [d, e] of Object.entries(f)) if (e !== 0) inputs[`${peer}:${d}`] = e;
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
      this.sendBundles();
      this.outbox = [];
    }
  }

  /** Each send repeats the last bundle: on an unreliable channel that turns a lost packet into nothing instead of a stall. */
  private sendBundles() {
    const b = this.resend ? [this.resend, ...this.outbox] : this.outbox;
    this.send({ t: 'b', b }, undefined, true);
    this.resend = this.outbox.at(-1) ?? this.resend;
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
    // Idle (game/match.ts): moved to the watchers, at once in the lobby, and mid-match after IDLE_ROUNDS rounds AFK, freeing the seat at the boundary.
    for (const peer of new Set(m.players.map((p) => peerOf(p.device)))) {
      const mine = m.players.filter((p) => peerOf(p.device) === peer);
      const gone = (p: (typeof mine)[number]) => p.afk && !p.away && (m.phase === 'lobby' || (p.afkRounds ?? 0) >= IDLE_ROUNDS);
      if (!peer || this.ns.watching[peer] || !present.has(peer) || !mine.every(gone)) continue;
      out.push({ t: 'watch', dev: mine[0].device, on: true, afk: true });
    }
    let seats = m.players.length;
    const seated = new Set(m.players.map((p) => p.device));
    // Seats won mid-round, taken at the boundary in the order they were won; a winner who left gives theirs back.
    for (const q of this.ns.queue) {
      if (!present.has(q.peer)) out.push({ t: 'seat', dev: q.dev, on: false });
      else if (SEAT_PHASES.has(m.phase) && seats < MAX_PLAYERS && !seated.has(q.dev)) {
        out.push({ t: 'join', dev: q.dev });
        seats++;
        seated.add(q.dev);
      }
    }
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
      if (m.phase === 'lobby' && !this.seated && this.intent === 'play' && !this.watching) this.wants.add(this.globalDevice(this.primaryFn()));
      for (const dev of this.wants) {
        if (!present.has(peerOf(dev)) || seated.has(dev) || seats >= MAX_PLAYERS || this.ns.kicked[peerOf(dev)]) continue;
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
      // Refused: every hello costs the host a whole snapshot, and only a reload or a new host can change the answer.
      if (this.status === 'online' && t - this.lastHello > (this.refused ? REFUSED_RETRY_MS : HELLO_RETRY_MS)) {
        this.lastHello = t;
        this.send({ t: 'hello', f: this.onTimeline ? this.match.frame : -1 }, this.hostId);
      }
      return;
    }
    // An observer sends no input: only its requests and its state hash.
    const seated = this.seated;
    if (seated) {
      this.unacked.push({ seq: ++this.seq, f: own });
      // Fold, not drop: through a long stall the oldest frames can hold a click.
      if (this.unacked.length > MAX_UNACKED) {
        const [a, b] = this.unacked;
        this.unacked.splice(0, 2, { seq: b.seq, f: mergePeerFrames(a.f, b.f) });
      }
    } else this.unacked = [];
    this.maybeWant(own, t);
    this.applyInbox(t);
    const pressed = seated && Object.values(own).some((e) => (typeof e === 'number' ? e : e[0]) & PRESSED);
    if ((seated && this.ticks % this.sendEvery === 0) || pressed || this.pendingActs.length || this.pendingHash) {
      const msg: Msg = { t: 'in', s: this.unacked[0]?.seq ?? this.seq + 1, f: this.unacked.map((u) => u.f), c: this.match.frame };
      if (this.pendingActs.length) msg.a = this.pendingActs;
      if (this.pendingHash) msg.h = this.pendingHash;
      this.pendingHash = undefined;
      this.send(msg, this.hostId, true);
    }
  }

  /**
   * Being connected is being in the room, so every peer asks for a seat without
   * anyone pressing a thing: the host seats it in the lobby, or between rounds
   * if the match is running. Asked again until seated: a seat can go to someone
   * else, and a new host starts with a clean slate.
   */
  private maybeWant(own: PeerFrame, t: number) {
    const m = this.match;
    // Only an arrival in the lobby is seated without asking; anyone else asks with Join (play).
    if (this.seated || this.intent !== 'play' || this.watching || m.phase !== 'lobby' || this.asked || this.queued) return;
    // A full lobby makes an arrival an observer, and a seat freeing up lights up Join for it rather than seating it.
    if (m.phase === 'lobby' && m.players.length >= MAX_PLAYERS) return this.watch();
    if (this.wantSentTo === this.hostId && t - this.wantAt < WANT_RETRY_MS) return;
    const dev = Object.keys(own).find((d) => {
      const e = own[d];
      return ((typeof e === 'number' ? e : e[0]) & CONFIRM_BIT) !== 0;
    });
    const pick = dev ?? this.primaryFn();
    this.wantSentTo = this.hostId;
    this.wantAt = t;
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
    if ((fresh || m.frame !== msg.s.frame || hashMatch(m) !== hashSnap(msg.s)) && !this.tryRestore(msg.s)) {
      if (fresh) this.refused = true;
      return;
    }
    this.refused = false;
    this.adoptNet(msg.ns);
    this.acks = msg.k;
    this.lastInputs = msg.last;
    for (const f of this.inbox.keys()) if (f < m.frame) this.inbox.delete(f);
    const mine = msg.k[this.self];
    if (mine) this.prune(mine);
    if (fresh || Math.abs(this.emittedThrough - m.frame) > 120) this.emittedThrough = m.frame;
    this.synced = true;
    this.onTimeline = true;
    this.stats.syncs++;
    this.lostAt = -1;
    this.log(`synced (${msg.why}) at frame ${m.frame}`);
    // A join's first sync is routine; the others mean this peer had fallen out of step.
    if (!fresh) reportLog('net resync', 'info', { why: msg.why, frame: m.frame });
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
      if (a.t === 'join' || a.t === 'leave') addBreadcrumb('room', a.t, { dev: a.dev });
      else if (a.t === 'away') addBreadcrumb('room', a.on ? 'away' : 'back', { dev: a.dev });
      // By what was applied, not what was asked: outside the lobby this did nothing.
      if (a.t === 'kick' && this.ns.kicked[a.peer]) {
        addBreadcrumb('room', 'kick', { peer: a.peer });
        if (a.peer === this.self) return this.onKicked();
        if (this.role === 'host') this.send({ t: 'kicked' }, a.peer);
      }
      // Seats changing hands, by peer id (never a name). The asker's own join request, won and lost are in play/settleAsk.
      if (a.t === 'watch' && a.on && this.ns.watching[peerOf(a.dev)]) addBreadcrumb('room', a.afk ? 'idle' : 'watch', { peer: peerOf(a.dev), frame: m.frame });
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

  private updateView() {
    const m = this.match;
    this.pendingCard = -1;
    if (!this.transport || !this.predict) {
      this.viewMatch = m;
      return;
    }
    if (m.phase === 'pick' || m.phase === 'place') this.cursorView();
    else if (this.role === 'guest' && this.synced && m.phase === 'run') this.raceView();
    else this.viewMatch = m;
  }

  /** Guests in a race: re-predict from the confirmed state with our unacked inputs. */
  private raceView() {
    const m = this.match;
    const d = this.predictor.copy(m);
    const others: Record<string, InputFrame> = {};
    for (const [dev, e] of Object.entries(this.lastInputs)) if (peerOf(dev) !== this.self) others[dev] = decode(held(e));
    const n = Math.min(MAX_PREDICT, this.unacked.length);
    for (let i = 0; i < n; i++) {
      const inputs: Record<string, InputFrame> = { ...others };
      for (const [dev, e] of Object.entries(this.unacked[i].f)) inputs[this.globalDevice(dev)] = decode(e);
      d.step(inputs);
      this.stats.predicted++;
      this.collect(d);
      if (d.phase !== 'run') break;
    }
    if (d.run) this.easeRunners(d);
    this.viewMatch = d;
  }

  /**
   * Prediction guesses others keep holding their buttons, so every jump or
   * turn is wrong for a round trip and then corrected. Drawn straight, that's
   * a teleport. Each runner keeps moving from where it was drawn and the error
   * bleeds away over a few frames. This writes only to the view copy, which
   * is rebuilt from confirmed state every update and never stepped again.
   */
  private easeRunners(d: Match) {
    const run = d.run!;
    if (run.frame < this.easedFrame || run.frame - this.easedFrame > CORRECTION_MAX_STEPS) this.eased.clear();
    const steps = run.frame - this.easedFrame;
    this.easedFrame = run.frame;
    for (const r of run.runners) {
      const b = r.body;
      const was = this.eased.get(r.slot);
      if (was) {
        const v = drawnVelocity(run.runners, r);
        const dx = was.x + v.x * DT * steps - b.x;
        const dy = was.y + v.y * DT * steps - b.y;
        if (Math.sqrt(dx * dx + dy * dy) <= CORRECTION_MAX) {
          b.x += dx * CORRECTION_KEEP;
          b.y += dy * CORRECTION_KEEP;
        }
      }
      this.eased.set(r.slot, { x: b.x, y: b.y });
    }
  }

  /**
   * Pick and place: everyone's cursors and ghosts come from match state, and
   * nothing but cursors is altered here. Our own cursor runs ahead through the
   * inputs the host hasn't sequenced yet, so it doesn't lag a round trip;
   * remote cursors glide between bundles. This copy is never stepped, so a
   * click can't show a claim: claims appear only once sequenced, and until
   * then `pendingCard` marks the card as asked for.
   */
  private cursorView() {
    const m = this.match;
    const d = this.predictor.copy(m);
    const pick = m.phase === 'pick';
    for (const p of d.players) {
      if (this.isLocal(p.device)) {
        const dev = p.device.slice(p.device.indexOf(':') + 1);
        for (const u of this.unacked) {
          const inp = decode(u.f[dev]); // a frame with no buttons still ends a held direction's speed ramp
          d.moveCursor(p, inp);
          if (pick && inp.confirmPressed && p.claim < 0 && m.phaseFrame > 10) {
            const i = m.crateItemAt(p.cursor.x, p.cursor.y);
            if (i >= 0 && m.crate[i].claimedBy < 0) this.pendingCard = i;
          }
        }
        continue;
      }
      const s = this.smooth.get(p.slot);
      if (!s || m.phaseFrame < 2) {
        this.smooth.set(p.slot, { ...p.cursor });
        continue;
      }
      s.x += (p.cursor.x - s.x) * CURSOR_SMOOTH;
      s.y += (p.cursor.y - s.y) * CURSOR_SMOOTH;
      p.cursor.x = s.x;
      p.cursor.y = s.y;
    }
    this.viewMatch = d;
  }
}

/**
 * How fast a runner really moves, for projecting where it's drawn. `vx` is what
 * it's trying to do: one held up by bodies (sim/collide.ts) barely moves however
 * hard it walks, and a rider goes where its base goes on top of its own walk.
 * Projecting by `vx` alone draws pushers inside who they push and riders lagging
 * their base.
 */
export function drawnVelocity(runners: readonly Runner[], r: Runner): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let at: Runner | undefined = r;
  for (let n = 0; at && n < runners.length; n++) {
    if (at.press <= 0) x += at.body.vx;
    y += at.body.vy;
    const under: number = at.ride;
    at = under >= 0 ? runners.find((o) => o.slot === under) : undefined;
  }
  return { x, y };
}

function structuredCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
