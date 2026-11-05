import { botDevice, isBotDevice } from '../brain/device';
import { IDLE_ROUNDS, type Match } from '../game/match';
import { DT, MAX_PLAYERS } from '../sim/constants';
import { addBreadcrumb, reportEvent, reportLog } from '../telemetry';
import type { Runner } from '../sim/run';
import type { GameEvent, InputFrame } from '../sim/types';
import {
  applyAction,
  bannedFor,
  cleanCharacter,
  cleanName,
  deviceId,
  freeSeats,
  guestMay,
  KICK_BAN_FRAMES,
  localOf,
  type NetAction,
  type NetState,
  newNetState,
  peerOf,
  personOf,
  relayAction,
  SEAT_PHASES,
  type Watcher,
  type Wear,
  cleanWear,
} from './actions';
import { CONFIRM_BIT, decode, type Enc, encode, held, heldPeerFrame, mergePeerFrames, type PeerFrame, PRESSED, samePeerFrame } from './codec';
import { type Depth, foldTo, newDepth, paceFor, QUEUE_HARD, type Queued, relieve, sampleSlack } from './pace';
import { Predictor } from './predict';
import { MAX_PEERS, type RoomListing } from './signal-protocol';
import { hashMatch, hashSnap, type MatchSnap, restoreMatch, snapshotMatch } from './snapshot';
import type { LinkStatus, Member, Transport } from './transport';
import { ACTS_PER_BUNDLE, ACTS_PER_MSG, type Bundle, BUNDLES_PER_MSG, FRAMES_PER_MSG, type Msg, parseMsg } from './wire';

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
/**
 * Ticks in a row a guest's frames may be late and still keep their slots (see consume). Longer than any burst of
 * loss or jitter: past it the guest has stalled, and its frames wait their turn when they come.
 */
const SKIP_MAX = 30;
/** Ms since the host's last tick for this one to count as on time: a worker timer fires every 8 ms, and catching up runs ticks back to back. */
const ON_TIME_MS = [4, 40];
/**
 * Bundles a send to one guest may carry: everything since the frame it last said it needs, newest first, so a lost
 * datagram costs nothing until a whole burst of them is lost. Within this many characters, so the datagram stays one
 * packet (a bigger one is split, and losing any piece loses all of it), and a big room's upload stays what it was.
 * Always at least the new bundles and the one before.
 */
const RESEND_BUNDLES = 30;
const RESEND_CHARS = 1100;
/** A guest that hasn't heard how deep its queue is for this long ticks at its own pace. */
const PACE_STALE_MS = 1000;
/**
 * A state hash rides the lossy input channel, so it goes out this many times, this many ticks apart: a burst of
 * loss can't skip a check. The host compares each frame's hash once.
 */
const HASH_REPEATS = 4;
const HASH_SPACING = 12;
/** Repeated desyncs with one guest resync it after 1, 2, 4… s, never more than this far apart: each is a whole snapshot. */
const RESYNC_MAX_FRAMES = 30 * 60;
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
/**
 * Requests one guest gets sequenced per host tick; the rest wait in its next message, unacked. A guest flooding
 * requests (or messages) only ever gets this many, so nobody else's wait on the host grows with it.
 */
export const ACTS_PER_TICK = 4;
/** Ack entries a guest keeps before forgetting peers no longer here (the host forgets them as they go). */
const ACKS_KEEP = 2 * MAX_PEERS;
/** An observer ahead of a player in join order waits this long, then moves to the back (see maybeReorder). */
const REORDER_AFTER_MS = 2000;
const REORDER_EVERY_MS = 10_000;
/**
 * A player whose peer has been gone this long mid-match (no goodbye, no return) is dropped: out at the round
 * boundary, its seat free for a Join from then. Long enough for a reload, a dead phone battery swapped for a
 * charger, or a browser restart; short enough that a closed tab doesn't hold a seat all match.
 */
export const DROP_FRAMES = 40 * 60;

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
  onKicked?: (until: number) => void;
  /** This browser's own id (identity.ts): a kick keeps it out, whatever tab or peer id it comes back with. */
  client?: string;
  /** How long a kick keeps someone out, in sim frames (KICK_BAN_FRAMES; tests shorten it). Only the host's counts. */
  banFrames?: number;
  /** How long a player may be gone mid-match before it's dropped, in sim frames (DROP_FRAMES; tests shorten it). */
  dropFrames?: number;
  /** Arrive as an observer (an invite opened with `?watch`). */
  watch?: boolean;
  /** The name an observer's chip shows, read when it starts watching. */
  name?: () => string;
  /** The look this person saved, read each time a seat is asked for, so the host seats them already wearing it. */
  wear?: () => Wear | undefined;
  log?: (msg: string) => void;
}

interface RemoteQueue {
  /** Frames not played yet. */
  frames: Queued[];
  consumed: number;
  /** The last action sequenced from this peer: queued for the next bundle, maybe not applied yet. */
  actN: number;
  /** The last action a bundle has applied, which is all a snapshot may ack (see syncMsg). */
  ackN: number;
  last: PeerFrame;
  /** Host ticks in a row with nothing queued. */
  dry: number;
  /** Requests sequenced from this peer since the host's last tick (see ACTS_PER_TICK). */
  took: number;
  /**
   * Seqs played with held buttons because they hadn't arrived (see consume), with the host time of that tick (NaN on
   * a tick that wasn't on time), and dry ticks in a row that did that: SKIP_MAX until a frame has come since it was
   * seated, since a guest whose stream hasn't started isn't late, and counting its frames as played would leave every
   * one of them a round trip late.
   */
  late: { seq: number; at: number }[];
  skips: number;
  /** Edges of late frames that came after all, for the next frame played. */
  carry: PeerFrame | null;
  /** The frame this guest last said it needs next (its `c`): bundles to it start there. -1: unknown. */
  have: number;
  /** Its queue's depth against what its link needs, which the guest paces itself by. */
  depth: Depth;
  /** The last frame whose hash was compared, and the frame of the last snapshot sent it (hashes before it are moot). */
  hashed: number;
  syncedAt: number;
  /** Resyncs in a row with no matching hash between, and the frame before which a mismatch doesn't earn another. */
  desyncs: number;
  resyncAt: number;
}

function newQueue(consumed: number, actN: number, last: PeerFrame): RemoteQueue {
  return {
    frames: [],
    consumed,
    actN,
    ackN: actN,
    last,
    dry: 0,
    took: 0,
    late: [],
    skips: SKIP_MAX,
    carry: null,
    have: -1,
    depth: newDepth(),
    hashed: -1,
    syncedAt: -1,
    desyncs: 0,
    resyncAt: 0,
  };
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
  /**
   * Counters for the HUD/debug overlay and tests. `ownFrames` are race frames a guest confirmed while it had a guess
   * for its own input there, and `ownMisses` those where the host played something else: each one re-simulates its
   * own runner, which is the correction a player feels.
   */
  stats = {
    desyncs: 0,
    syncs: 0,
    migrations: 0,
    bundles: 0,
    predicted: 0,
    dryTicks: 0,
    foldedFrames: 0,
    queuedFrames: 0,
    hostTicks: 0,
    malformed: 0,
    ownFrames: 0,
    ownMisses: 0,
  };

  private now: () => number;
  private sendEvery: number;
  private predict: boolean;
  private resumeFn: SessionOptions['resume'];
  private onKickedFn: SessionOptions['onKicked'];
  private client: string;
  private banFrames: number;
  private dropFrames: number;
  /** Host: each guest's client id, from its hello. A new host learns them as everyone says hello again. */
  private clients = new Map<string, string>();
  /** Wall-clock ms when this peer may come back, once kicked or refused. For the screen only. */
  kickedUntil = 0;
  private log: (msg: string) => void;
  private ticks = 0;
  private events: GameEvent[] = [];
  private emittedThrough = -1;
  private predictor = new Predictor();
  private viewMatch: Match;
  private viewDirty = true;
  private primaryFn: () => string;
  private nameFn: () => string;
  private wearFn: () => Wear | undefined;
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
  private hostActions: NetAction[] = [];
  /** JSON length of each bundle sent, for the resend budget. */
  private sizes = new WeakMap<Bundle, number>();
  private lastTickAt = -1e9;
  private hashes = new Map<number, number>();
  /** Devices asking to be seated, with the look each asked to wear. */
  private wants = new Map<string, Wear | undefined>();
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
  /** This guest's last state hash, its sends so far and the tick of the last (see HASH_REPEATS). */
  private hash: [number, number] | undefined;
  private hashSends = 0;
  private hashSentAt = -1e9;
  /** The host's last word on our queue's depth (see pace.ts), and when it came. */
  private paceErr = 0;
  private paceAt = -1e9;
  private wantSentTo = '';
  private wantAt = 0;
  private stash: { from: string; msg: Msg; at: number }[] = [];
  /** True once this peer has followed the room's timeline, so its frame number means something to a new host. */
  private onTimeline = false;
  /** Set while a freshly promoted host gathers the room (see collectTick). */
  private collecting: { until: number; got: Map<string, number>; pulled: string; pullAt: number; chose: boolean } | null = null;
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
    this.client = opts.client ?? '';
    this.banFrames = Math.max(1, Math.round(opts.banFrames ?? KICK_BAN_FRAMES));
    this.dropFrames = Math.max(1, Math.round(opts.dropFrames ?? DROP_FRAMES));
    const primary = opts.primaryDevice ?? 'kb1';
    this.primaryFn = typeof primary === 'function' ? primary : () => primary;
    this.nameFn = opts.name ?? (() => '');
    this.wearFn = opts.wear ?? (() => undefined);
    this.intent = opts.watch ? 'watch' : 'play';
    this.log = opts.log ?? (() => {});
    // Input/action sequence numbers start at wall-clock ms: a refreshed page always counts higher than its old self.
    this.seq = Math.floor(Date.now());
    this.actN = this.seq;
    this.status = opts.transport ? 'connecting' : 'offline';
    this.members = [{ id: this.self, order: 0 }];
    opts.transport?.list?.(() => this.listing());
    opts.transport?.start({
      status: (s, d) => this.onStatus(s, d),
      members: (l) => this.onMembers(l),
      message: (from, d) => this.onWire(from, d),
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

  /** How fast this peer's ticks should run, against its own clock (see pacing). The game loop scales its time by it. */
  get pace(): number {
    if (this.role !== 'guest' || this.now() - this.paceAt > PACE_STALE_MS) return 1;
    return paceFor(this.paceErr);
  }

  /** Global id for a local device ('kb1' → '<peer>:kb1'). Offline sessions keep raw ids. */
  globalDevice(local: string): string {
    return this.transport ? deviceId(this.self, local) : local;
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
    if (this.role !== 'host' || this.match.phase !== 'lobby' || peer === this.self) return;
    // Never our own browser's id: a host that kicks another tab of its own would lock itself out.
    const c = this.clients.get(peer);
    this.hostActions.push({ t: 'kick', peer, client: c && c !== this.client ? c : undefined, until: this.match.frame + this.banFrames });
  }

  /** Refused before connecting: this tab was kicked and its ban hasn't run out (client.ts keeps it per tab). */
  refuse(until: number) {
    this.kickedUntil = until;
    this.status = 'kicked';
  }

  /** This peer's person holds a seat in the match (bots it runs don't count: they're the room's). Offline, everyone on this machine does. */
  get seated(): boolean {
    return !this.transport || this.match.players.some((p) => personOf(p.device) === this.self);
  }

  /** This machine has inputs to send: a seat of its own, or a bot seat it runs. */
  private get drives(): boolean {
    return !this.transport || this.match.players.some((p) => peerOf(p.device) === this.self);
  }

  /** A device's input counts: anything but a bot nobody seated, whose input could only seat it again (a lobby confirm). */
  private counts(dev: string): boolean {
    return !isBotDevice(dev) || this.match.players.some((p) => p.device === dev);
  }

  /** Watching, by choice or for being idle, as the room has it. */
  get watching(): Watcher | undefined {
    return this.ns.watching[this.self];
  }

  /** Seats a Join could still win: nobody holds them past the round boundary, and nobody is owed them. */
  get space(): number {
    return freeSeats(this.match, this.ns);
  }

  /** What the public lobby list shows of this room while we host it, or null: a Private room stays off it. */
  listing(): RoomListing | null {
    if (this.match.rules.private) return null;
    const seated = new Set(this.match.players.map((p) => personOf(p.device)));
    const l: RoomListing = {
      players: Math.min(MAX_PLAYERS, Math.max(0, MAX_PLAYERS - this.space)),
      max: MAX_PLAYERS,
      observers: this.members.filter((m) => !seated.has(m.id)).length,
      theme: this.match.level.theme.id,
      phase: this.match.phase,
    };
    const host = this.nameOf(this.self);
    if (host) l.host = host;
    if (this.match.rules.mode !== 'race') l.mode = this.match.rules.mode;
    return l;
  }

  /** A peer's display name: its first player's, or the one it watches under; '' if it has neither. */
  private nameOf(id: string): string {
    const mine = this.match.players.find((p) => (!!id && personOf(p.device) === id) || (id === this.self && !p.device.includes(':')));
    return mine?.character.name ?? this.ns.watching[id]?.name ?? '';
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
    const mine = this.match.players.filter((p) => personOf(p.device) === this.self);
    if (this.asked || (mine.length && !mine.some((p) => p.leaving)) || this.queued) return;
    const wear = this.wearFn();
    const a: NetAction = { t: 'seat', dev: this.globalDevice(this.primaryFn()), on: true, ...(wear ? { wear } : {}) };
    this.asked = a;
    this.seatAsk = 'asking';
    addBreadcrumb('room', 'join request', { frame: this.match.frame });
    this.act(a);
  }

  /** Watch instead of playing. A seat is given up at once in the lobby, at the round boundary mid-match; a place in line at once. */
  watch() {
    this.intent = 'watch';
    this.seatAsk = 'none';
    if (!this.watching || this.queued || this.match.players.some((p) => personOf(p.device) === this.self && !p.leaving))
      this.act({ t: 'watch', dev: this.globalDevice(this.primaryFn()), on: true, name: this.nameFn() });
  }

  /** The seat request, once the host has sequenced it: applied everywhere at the same frame, so the answer is in our own state. */
  private settleAsk() {
    const a = this.asked;
    if (!a || this.pendingActs.some(([, x]) => x === a) || this.hostActions.includes(a)) return;
    this.asked = null;
    // A seat it still holds but is leaving, kept because the room had no seat to give back, isn't one.
    const won = this.match.players.some((p) => personOf(p.device) === this.self && !p.leaving) || this.queued;
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
      const players = this.match.players.filter((p) => personOf(p.device) === m.id || (isSelf && !p.device.includes(':')));
      const watching = this.ns.watching[m.id];
      return {
        id: m.id,
        order: m.order,
        isHost,
        isSelf,
        ping,
        quality,
        slots: players.map((p) => p.slot),
        name: this.nameOf(m.id),
        seated: players.length > 0,
        watching,
      };
    });
  }

  /** Send any batched bundles now (e.g. before the page hides), with what each peer may have missed. */
  flush() {
    if (this.role === 'host' && this.history.length && this.remoteCount) this.sendBundles();
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
      // Owed a seat already (a refresh after winning one): keep the place in line.
      if ((this.intent === 'watch' && !w) || (!w && !this.seated && !this.queued && this.match.phase !== 'lobby')) this.watch();
    }
    // Without a seat mid-match and not asking for one (dropped while gone, say): watching, with Join a click away.
    if (this.arrived && !w && this.intent === 'play' && !this.seated && !this.queued && !this.asked && this.match.phase !== 'lobby') this.watch();
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
      this.members.some((m) => m.order > me.order && !m.linking && this.match.players.some((p) => personOf(p.device) === m.id));
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
    // A peer that comes back says hello and is measured again.
    for (const map of [this.rtt, this.heard, this.clients]) for (const id of map.keys()) if (!present.has(id)) map.delete(id);
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
      if (was === 'host') {
        this.log(`${host} is host`);
        // Stepped aside (a watcher at the head of the line) with our own requests not yet in a bundle: they go to the
        // new host instead, a Join included. Guests' requests it held are resent by their senders, so they go.
        const mine = this.hostActions.filter((a) => 'dev' in a && peerOf(a.dev) === this.self);
        this.hostActions = [];
        for (const a of mine) this.pendingActs.push([++this.actN, a]);
      }
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
    this.collecting = { until: this.now() + COLLECT_MS, got: new Map(), pulled: '', pullAt: 0, chose: false };
  }

  /** Host-side view of each guest, from the ack and input state every peer tracks out of bundles. */
  private rebuildQueues() {
    this.queues.clear();
    for (const m of this.members) {
      if (m.id === this.self) continue;
      const k = this.acks[m.id] ?? [0, 0];
      const last: PeerFrame = {};
      for (const [dev, e] of Object.entries(this.lastInputs)) if (peerOf(dev) === m.id) last[localOf(dev)] = e;
      this.queues.set(m.id, newQueue(k[0], k[1], heldPeerFrame(last)));
    }
  }

  /** Ends the gathering once everyone reachable has reported and any further-ahead state is in. */
  private collectTick(t: number) {
    const c = this.collecting!;
    if (c.pulled) {
      if (this.members.some((m) => m.id === c.pulled) && t - c.pullAt <= PULL_MS) return;
      // Gone or silent: the next furthest, so a peer that was ahead of us is never rewound to our frame.
      c.got.delete(c.pulled);
      c.pulled = '';
    }
    if (!c.chose) {
      const others = this.members.filter((m) => m.id !== this.self);
      const everyone = others.every((m) => !m.linking && c.got.has(m.id));
      if (!everyone && t < c.until) return;
      c.chose = true;
    }
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
    for (const m of this.members) if (m.id !== this.self) this.sendSync('migrate', m.id);
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
    this.ns.parked = Object.fromEntries(Object.entries(ns.parked ?? {}).map(([k, v]) => [k, v.map((x) => ({ ...x, char: cleanCharacter(x.char) }))]));
    // Numbers only: a save from before bans ran out marked a kick `true`.
    this.ns.kicked = Object.fromEntries(Object.entries(ns.kicked ?? {}).filter(([, v]) => typeof v === 'number'));
    this.ns.banned = ns.banned ?? {};
    // A watcher's label the name filter refuses goes blank, as it would have off the wire.
    this.ns.watching = Object.fromEntries(Object.entries(ns.watching ?? {}).map(([k, w]) => [k, { ...w, name: cleanName(w.name) }]));
    this.ns.queue = ns.queue ?? [];
  }

  private onKicked(left: number) {
    if (this.status === 'kicked') return;
    this.status = 'kicked';
    this.kickedUntil = Date.now() + Math.max(0, left);
    this.onKickedFn?.(this.kickedUntil);
    this.transport?.close();
  }

  /** Ms until a peer may come back, by the room's frame count. */
  private banLeft(peer: string, client?: string): number {
    return (bannedFor(this.match, this.ns, peer, client) * 1000) / 60;
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

  /** Everything a peer sends arrives here, and only what parses goes further (wire.ts). */
  private onWire(from: string, data: unknown) {
    const msg = parseMsg(data);
    if (msg) return this.onMessage(from, msg);
    // A hostile or broken peer can send one every frame: the first few say who, and the count says the rest.
    if (++this.stats.malformed <= 5) this.log(`malformed message from ${from} dropped`);
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
      else if (msg.t === 'hello') this.onHello(from, msg.f, msg.c);
      else if (msg.t === 'need') this.onNeed(from, msg.f);
      else if (msg.t === 'state') this.onState(from, msg);
      else if (msg.t === 'b' || msg.t === 'sync') this.stashMsg(from, msg); // someone else thinks they're host: presence lag
      return;
    }
    if (msg.t === 'kicked') {
      if (from === this.hostId) this.onKicked(msg.left ?? (this.banFrames * 1000) / 60);
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
      if (msg.d !== undefined) {
        this.paceErr = msg.d;
        this.paceAt = this.now();
      }
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
      q = newQueue(0, 0, {});
      this.queues.set(peer, q);
    }
    return q;
  }

  private onInput(from: string, msg: Extract<Msg, { t: 'in' }>) {
    if (!this.members.some((m) => m.id === from) || this.banLeft(from, this.clients.get(from)) > 0) return;
    const q = this.queue(from);
    q.have = Math.max(q.have, Math.min(msg.c, this.match.frame + 1));
    const tail = q.frames.length ? q.frames[q.frames.length - 1].seq : q.consumed;
    // Observers send no input, and anything one sends anyway (a seat just given up) plays no part.
    if (this.match.players.some((p) => peerOf(p.device) === from)) {
      const t = this.now();
      for (const [j, f] of msg.f.entries()) {
        const seq = msg.s + j;
        if (seq > tail) q.frames.push({ seq, f, at: t });
        const i = seq > tail ? -1 : q.late.findIndex((l) => l.seq === seq);
        if (i < 0) continue;
        // Its slot went by with held buttons: what it pressed comes on the next frame instead of never.
        if (!Number.isNaN(q.late[i].at)) sampleSlack(q.depth, q.late[i].at - t);
        q.late.splice(i, 1);
        q.carry = q.carry ? mergePeerFrames(q.carry, f) : f;
      }
      this.stats.foldedFrames += foldTo(q.frames, QUEUE_HARD);
    }
    for (const [n, a] of msg.a ?? []) {
      if (n <= q.actN) continue;
      // Unacked, so the guest sends it again: its requests stay in order, only later.
      if (q.took >= ACTS_PER_TICK) break;
      q.took++;
      q.actN = n;
      if (a.t === 'join') {
        if (peerOf(a.dev) === from) this.wants.set(a.dev, a.wear && cleanWear(a.wear)); // seated by reconcile() between rounds
      } else if (guestMay(from, a)) this.hostActions.push(relayAction(this.match, a));
    }
    if (msg.h) this.checkHash(from, q, msg.h);
  }

  /**
   * A guest's state hash against ours for that frame, once per frame. A mismatch resyncs it with a snapshot, but one
   * that keeps coming back (a determinism bug on that browser) only every 1, 2, 4… s: each is a whole snapshot, and a
   * snapshot every second would crowd out everything else on its link.
   */
  private checkHash(from: string, q: RemoteQueue, [frame, theirs]: [number, number]) {
    const mine = this.hashes.get(frame);
    if (mine === undefined || frame <= q.hashed || frame <= q.syncedAt) return;
    q.hashed = frame;
    if (mine === theirs) {
      q.desyncs = 0;
      return;
    }
    if (this.match.frame < q.resyncAt) return;
    q.desyncs++;
    q.resyncAt = this.match.frame + Math.min(RESYNC_MAX_FRAMES, HASH_EVERY * 2 ** (q.desyncs - 1));
    this.stats.desyncs++;
    this.log(`desync with ${from} at frame ${frame}: resync`);
    reportEvent('desync', 'error', { frame, peer: from, localHash: mine, remoteHash: theirs, phase: this.match.phase, streak: q.desyncs });
    this.sendSync('desync', from);
  }

  private onHello(from: string, f: number, client?: string) {
    if (client) this.clients.set(from, client);
    const left = this.banLeft(from, client);
    if (left > 0) {
      addBreadcrumb('room', 'rejoin refused (banned)', { peer: from, left: Math.round(left) });
      return this.send({ t: 'kicked', left }, from);
    }
    if (this.collecting) this.collecting.got.set(from, f);
    else this.sendSync('hello', from);
  }

  private onNeed(from: string, f: number) {
    const first = this.history[0]?.f ?? Infinity;
    if (f >= first && f <= this.match.frame) {
      const slice = this.history.slice(f - first);
      for (let i = 0; i < slice.length; i += BUNDLES_PER_MSG) this.send({ t: 'b', b: slice.slice(i, i + BUNDLES_PER_MSG) }, from);
    } else {
      this.sendSync('behind', from);
    }
  }

  /** A snapshot to one peer: it hashes and asks for bundles from there. */
  private sendSync(why: string, to: string) {
    const q = this.queues.get(to);
    if (q) {
      q.syncedAt = this.match.frame;
      q.have = -1;
    }
    this.send(this.syncMsg(why), to);
  }

  private syncMsg(why: string): Msg {
    const k: Record<string, [number, number]> = {};
    // Applied actions only: one sequenced since the last bundle isn't in this state, and acking it would prune it from
    // the asker, which then reads its answer from a state that doesn't have it (or loses it if we die first).
    for (const [p, q] of this.queues) k[p] = [q.consumed, q.ackN];
    const last: Record<string, Enc> = {};
    for (const [p, q] of this.queues) for (const [d, e] of Object.entries(q.last)) last[deviceId(p, d)] = e;
    return { t: 'sync', s: snapshotMatch(this.match), k, ns: structuredCloneJson(this.ns), last, why };
  }

  private hostTick(own: PeerFrame) {
    if (this.collecting) this.collectTick(this.now());
    if (this.paused) return;
    const inputs: Record<string, Enc> = {};
    if (this.drives) for (const [d, e] of Object.entries(own)) if (this.counts(this.globalDevice(d))) inputs[this.globalDevice(d)] = e;
    const seatedPeers = new Set(this.match.players.map((p) => peerOf(p.device)));
    // A tick run late (the page catching up after a stall) says nothing about how early a guest's frames come.
    const t = this.now();
    const onTime = t - this.lastTickAt >= ON_TIME_MS[0] && t - this.lastTickAt <= ON_TIME_MS[1];
    this.lastTickAt = t;
    const k: Record<string, [number, number]> = {};
    for (const [peer, q] of this.queues) {
      q.ackN = q.actN; // every action sequenced so far goes out in this bundle
      q.took = 0;
      if (seatedPeers.has(peer)) this.consume(peer, q, inputs, onTime);
      else {
        // An observer: nothing to wait for and nothing to hold down.
        q.frames = [];
        q.last = {};
        q.dry = 0;
        q.late = [];
        q.skips = SKIP_MAX;
        q.carry = null;
      }
      // After consuming: this bundle plays that frame, so a guest predicting from it starts at the next one.
      const sig = `${q.consumed},${q.actN}`;
      if (this.sentK.get(peer) !== sig) {
        this.sentK.set(peer, sig);
        k[peer] = [q.consumed, q.actN];
      }
    }
    // What a bundle can't carry waits a frame: guests refuse a longer one (wire.ts).
    const settled = this.reconcile();
    const actions = [...settled, ...this.hostActions.splice(0, Math.max(0, ACTS_PER_BUNDLE - settled.length))];
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

  /**
   * One seated guest's frame for this tick, from its queue (its depth paced by the guest, see pace.ts). The guest
   * predicts that its next frame plays on the next bundle, so the host keeps to that: a frame that hasn't arrived
   * in time is played with held buttons and its seq counted as played, so every later frame still lands where it was
   * predicted; its edges come a frame late, if it comes at all (onInput).
   */
  private consume(peer: string, q: RemoteQueue, inputs: Record<string, Enc>, onTime: boolean) {
    const t = this.now();
    this.stats.foldedFrames += relieve(q.depth, q.frames, t);
    this.stats.hostTicks++;
    this.stats.queuedFrames += q.frames.length;
    const next = q.frames.shift();
    let f: PeerFrame;
    if (next) {
      if (onTime) sampleSlack(q.depth, t - next.at);
      q.consumed = next.seq;
      q.last = next.f;
      q.dry = 0;
      q.skips = 0;
      f = next.f;
    } else {
      this.stats.dryTicks++;
      if (q.skips < SKIP_MAX) {
        q.skips++;
        q.late.push({ seq: ++q.consumed, at: onTime ? t : Number.NaN });
        if (q.late.length > SKIP_MAX) q.late.shift();
      }
      // Never wait: hold its buttons through a hiccup, then let go of them (soft disconnect, see SOFT_TICKS).
      f = ++q.dry > SOFT_TICKS ? {} : heldPeerFrame(q.last);
    }
    if (q.carry) {
      f = mergePeerFrames(q.carry, f);
      q.carry = null;
    }
    for (const [d, e] of Object.entries(f)) if (e !== 0 && this.counts(deviceId(peer, d))) inputs[deviceId(peer, d)] = e;
  }

  /**
   * To each peer, the new bundles and every one since the frame it last said it needs, within RESEND_CHARS: on an
   * unreliable channel that turns a burst of lost datagrams into nothing instead of a `need` and a round trip. A
   * guest gets how deep its queue is against what its link needs, to pace itself by.
   */
  private sendBundles() {
    // Others follow our frames now: this timeline is the room's, so a hello after we step aside says how far it got.
    this.onTimeline = true;
    const h = this.history;
    if (!h.length) return;
    const first = h[0].f;
    const newest = h[h.length - 1].f;
    // At the least the bundle before this batch, as a peer that hasn't said what it holds (a watcher) always gets.
    const base = (this.outbox[0]?.f ?? newest) - 1;
    const seated = new Set(this.match.players.map((p) => peerOf(p.device)));
    for (const m of this.members) {
      if (m.id === this.self) continue;
      const q = this.queues.get(m.id);
      const from = Math.max(first, newest - RESEND_BUNDLES + 1, Math.min(base, q && q.have >= 0 ? q.have : base));
      // History is one bundle per frame from `first` (onNeed relies on the same); a gap in it sends only the batch.
      let i = h[from - first]?.f === from ? from - first : Math.max(0, h.length - this.outbox.length);
      for (let chars = 0, j = h.length - 1; j >= i; j--) {
        chars += this.sizeOf(h[j]);
        if (chars > RESEND_CHARS && h[j].f < base) {
          i = j + 1;
          break;
        }
      }
      const msg: Extract<Msg, { t: 'b' }> = { t: 'b', b: h.slice(i) };
      if (q && seated.has(m.id) && Number.isFinite(q.depth.err)) msg.d = Math.round(q.depth.err * 100) / 100;
      this.send(msg, m.id, true);
    }
  }

  private sizeOf(b: Bundle): number {
    let n = this.sizes.get(b);
    if (n === undefined) {
      n = JSON.stringify(b).length;
      this.sizes.set(b, n);
    }
    return n;
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
    const devices = new Set(m.players.map((p) => p.device));
    let n = 1;
    for (const p of m.players) {
      const peer = peerOf(p.device);
      if (!peer) continue;
      // Bot seats are the room's, run by whoever hosts: never away or dropped with a peer, but taken over, fresh.
      if (isBotDevice(p.device)) {
        if (peer === this.self) continue;
        while (devices.has(deviceId(this.self, botDevice(n)))) n++;
        const to = deviceId(this.self, botDevice(n));
        devices.add(to);
        out.push({ t: 'adopt', dev: p.device, to });
        continue;
      }
      if (!present.has(peer)) {
        if (m.phase === 'lobby') out.push({ t: 'leave', dev: p.device });
        else if (!p.away) out.push({ t: 'away', dev: p.device, on: true });
      } else if (p.away) out.push({ t: 'away', dev: p.device, on: false });
      // Gone too long mid-match: dropped, its seat free for a watcher's Join (the leave action parks score and look).
      if (!present.has(peer) && m.phase !== 'lobby' && p.away && !p.leaving && m.frame - (p.awayAt ?? m.frame) >= this.dropFrames)
        out.push({ t: 'leave', dev: p.device });
    }
    // Idle (game/match.ts): moved to the watchers, freeing the seat. In the lobby only when a watcher could use it (an
    // idle lobby holds nobody up: AFK doesn't block Ready, and people wait there for friends); mid-match after
    // IDLE_ROUNDS rounds AFK, the seat freeing at the boundary.
    const wanted = m.players.length >= MAX_PLAYERS && this.members.some((x) => !m.players.some((p) => personOf(p.device) === x.id));
    for (const peer of new Set(m.players.map((p) => personOf(p.device)))) {
      const mine = m.players.filter((p) => personOf(p.device) === peer);
      const gone = (p: (typeof mine)[number]) => p.afk && !p.away && (m.phase === 'lobby' ? wanted : (p.afkRounds ?? 0) >= IDLE_ROUNDS);
      if (!peer || this.ns.watching[peer] || !present.has(peer) || !mine.every(gone)) continue;
      out.push({ t: 'watch', dev: mine[0].device, on: true, afk: true });
    }
    let seats = m.players.length;
    const seated = new Set(m.players.map((p) => p.device));
    // Seats won mid-round, taken at the boundary in the order they were won; a winner who left gives theirs back.
    for (const q of this.ns.queue) {
      if (!present.has(q.peer)) out.push({ t: 'seat', dev: q.dev, on: false });
      else if (SEAT_PHASES.has(m.phase) && seats < MAX_PLAYERS && !seated.has(q.dev)) {
        out.push(q.wear ? { t: 'join', dev: q.dev, wear: q.wear } : { t: 'join', dev: q.dev });
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
      if (m.phase === 'lobby' && !this.seated && this.intent === 'play' && !this.watching) this.wants.set(this.globalDevice(this.primaryFn()), this.wearFn());
      for (const [dev, wear] of this.wants) {
        if (!present.has(peerOf(dev)) || seated.has(dev) || seats >= MAX_PLAYERS || this.banLeft(peerOf(dev), this.clients.get(peerOf(dev))) > 0) continue;
        out.push(wear ? { t: 'join', dev, wear } : { t: 'join', dev });
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
        this.send({ t: 'hello', f: this.onTimeline ? this.match.frame : -1, c: this.client || undefined }, this.hostId);
      }
      return;
    }
    // An observer sends no input: only its requests and its state hash. Bots it still runs (a host that just stepped aside) do.
    const seated = this.drives;
    if (seated) {
      this.unacked.push({ seq: ++this.seq, f: own });
      // Fold, not drop: through a long stall the oldest frames can hold a click.
      if (this.unacked.length > FRAMES_PER_MSG) {
        const [a, b] = this.unacked;
        this.unacked.splice(0, 2, { seq: b.seq, f: mergePeerFrames(a.f, b.f) });
      }
    } else this.unacked = [];
    this.maybeWant(own, t);
    this.applyInbox(t);
    const pressed = seated && Object.values(own).some((e) => (typeof e === 'number' ? e : e[0]) & PRESSED);
    const hashDue = !!this.hash && this.hashSends < HASH_REPEATS && this.ticks - this.hashSentAt >= HASH_SPACING;
    if ((seated && this.ticks % this.sendEvery === 0) || pressed || this.pendingActs.length || hashDue) {
      const msg: Msg = { t: 'in', s: this.unacked[0]?.seq ?? this.seq + 1, f: this.unacked.map((u) => u.f), c: this.match.frame };
      // The oldest first, a message's worth at a time: the host acks them and the next message carries on.
      if (this.pendingActs.length) msg.a = this.pendingActs.slice(0, ACTS_PER_MSG);
      if (hashDue) {
        msg.h = this.hash;
        this.hashSends++;
        this.hashSentAt = this.ticks;
      }
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
    const wear = this.wearFn();
    this.pendingActs.push([++this.actN, { t: 'join', dev: this.globalDevice(pick), ...(wear ? { wear } : {}) }]);
  }

  private applyInbox(t: number) {
    let n = 0;
    while (n < MAX_APPLY_PER_TICK) {
      const b = this.inbox.get(this.match.frame);
      if (!b) break;
      this.inbox.delete(b.f);
      if (this.match.phase === 'run') this.checkOwn(b);
      this.apply(b);
      n++;
      if (this.match.frame % HASH_EVERY === 0) this.newHash([this.match.frame, hashMatch(this.match)]);
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

  private newHash(h: [number, number] | undefined) {
    this.hash = h;
    this.hashSends = 0;
    this.hashSentAt = -1e9;
  }

  /** Counts whether the host played, on this frame, the input our prediction stepped there (the oldest unacked). */
  private checkOwn(b: Bundle) {
    const guess = this.unacked[0]?.f;
    if (!guess) return;
    const played: PeerFrame = {};
    for (const [dev, e] of Object.entries(b.i ?? {})) if (peerOf(dev) === this.self) played[localOf(dev)] = e;
    this.stats.ownFrames++;
    if (!samePeerFrame(guess, played)) this.stats.ownMisses++;
  }

  private onSync(msg: Extract<Msg, { t: 'sync' }>) {
    const m = this.match;
    const fresh = !this.synced;
    if ((fresh || m.frame !== msg.s.frame || hashMatch(m) !== hashSnap(msg.s)) && !this.tryRestore(msg.s)) {
      if (fresh) this.refused = true;
      return;
    }
    this.refused = false;
    this.newHash(undefined); // of the state this replaced
    this.adoptNet(msg.ns);
    this.acks = msg.k;
    this.lastInputs = msg.last;
    for (const f of this.inbox.keys()) if (f < m.frame) this.inbox.delete(f);
    const mine = msg.k[this.self];
    if (mine) this.prune(mine);
    // A newcomer starts emitting from here; a peer already on the timeline (a migration's sync) has emitted the frames it
    // simulated, predicted ones included, and won't again.
    if ((fresh && !this.onTimeline) || Math.abs(this.emittedThrough - m.frame) > 120) this.emittedThrough = m.frame;
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
      const was = a.t === 'kick' ? this.ns.kicked[a.peer] : undefined;
      applyAction(m, this.ns, a);
      if (a.t === 'join' || a.t === 'leave') addBreadcrumb('room', a.t, { dev: a.dev });
      else if (a.t === 'away') addBreadcrumb('room', a.on ? 'away' : 'back', { dev: a.dev });
      // By what was applied, not what was asked: outside the lobby this did nothing.
      if (a.t === 'kick' && this.ns.kicked[a.peer] !== was) {
        addBreadcrumb('room', 'kick', { peer: a.peer });
        const left = this.banLeft(a.peer);
        if (a.peer === this.self) return this.onKicked(left);
        if (this.role === 'host') this.send({ t: 'kicked', left }, a.peer);
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
      // Only a member's acks seed a new host's queues (rebuildQueues). Kept until the table grows, so a peer that
      // drops out of our list for a moment keeps its place.
      if (Object.keys(this.acks).length > ACKS_KEEP) {
        const present = new Set(this.members.map((x) => x.id));
        for (const p of Object.keys(this.acks)) if (!present.has(p)) delete this.acks[p];
      }
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
    for (const [dev, f] of Object.entries(local)) {
      const mine = peerOf(dev) === this.self;
      if (!mine && this.transport && dev.includes(':')) continue; // a HUD button for someone else's player
      const d = mine ? localOf(dev) : dev;
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
        const v = drawnVelocity(r);
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
        const dev = localOf(p.device);
        for (const u of this.unacked) {
          const inp = decode(u.f[dev]); // a frame with no buttons still ends a held direction's speed ramp
          d.moveCursor(p, inp);
          if (pick && inp.confirmPressed && p.claim < 0 && m.acceptsConfirm()) {
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
 * How fast a runner really moves, for projecting where it's drawn. `vx` is what it's trying to do: one held up by
 * bodies (sim/collide.ts) barely moves however hard it walks, so projecting by `vx` would draw pushers inside who
 * they push. A head is a perch, not ground: a rider isn't carried, so its own velocity is all it has.
 */
export function drawnVelocity(r: Runner): { x: number; y: number } {
  return { x: r.press > 0 ? 0 : r.body.vx, y: r.body.vy };
}

function structuredCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
