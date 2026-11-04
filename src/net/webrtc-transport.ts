import { SignalError, type SignalApi, sessionStamp } from './signal-client';
import {
  BEAT_MS,
  DEFAULT_ICE,
  type IceServer,
  isSignal,
  type Mail,
  MAX_PEERS,
  type MemberInfo,
  PEER_TTL_S,
  type RoomListing,
  type Signal,
} from './signal-protocol';
import { type LinkStatus, type Member, sortMembers, type Transport, type TransportHandlers } from './transport';

/**
 * Online transport: WebRTC data channels in a star around the host, found
 * through the signaling API. See docs/NETCODE.md for the full picture.
 *
 * Roster and election. The host owns the roster (who is in the star, in join
 * order) and pushes it to every guest. Guests have no links to each other, so
 * when the host dies nobody can ask anyone anything: each peer independently
 * walks its last roster and takes the lowest order it doesn't believe dead.
 * That needs no store read and no agreement round, so it stays fast.
 *
 * Losing the host. A peer that stops hearing the host doesn't conclude it
 * died: a flaky guest must not move the whole room. It wakes polling, offers
 * to the old host again and, at the same time, to whoever is next in line. The
 * old host answering means only the link broke. The next in line stays a
 * candidate until the old host misses its window or another peer turns up
 * having lost it too, which is enough proof to take over at once.
 *
 * Disagreement. A candidate that won't answer inside its window is presumed
 * dead too and the walk moves on, so everyone lands on the same peer, even
 * when a lower peer left at the same moment. Proof runs both ways: a peer with
 * no host that gets an offer from one behind it takes over at once (claim), so
 * it's never written off for being slow to settle its own handshake. If two
 * peers do end up hosting (a pair that can't connect), the store settles it:
 * whoever took over wrote the other off, so that one's heartbeat finds itself
 * gone, rejoins later in the order and hands its guests to the lower host.
 * Fresh hosts check every few seconds (RIVAL_CHECK_MS), so that takes seconds,
 * not a heartbeat. The store's lowest order alone proves nothing: a guest that
 * died without a goodbye stays listed until its liveness runs out.
 *
 * Fencing. Two guests that lose a live host at once look exactly like it
 * dying: one's offer is the other's proof, and they elect a new host. So a
 * host that hears two or more guests go quiet freezes before either of them
 * could suspect it (QUIET_MS against SILENCE_MS), and keeps answering offers.
 * It plays on once each of them is back, or, if one never came back, once the
 * store says it still holds the room; written off, it steps down as below.
 * Two hosts may exist for a moment, but only one of them ever runs the sim.
 *
 * The store is only ever told a peer is gone after that peer failed an offer.
 * Rejoining always gets a later order, so a peer that was wrongly written off
 * comes back as a guest, never as a second host.
 */

export interface RtcChannel {
  readonly label: string;
  readonly readyState: string;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(): void;
  onopen: ((e: never) => void) | null;
  onclose: ((e: never) => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
}

export interface RtcPeer {
  readonly connectionState: string;
  readonly iceGatheringState: string;
  readonly localDescription: { sdp: string } | null;
  createDataChannel(label: string, init: { ordered: boolean; maxRetransmits?: number }): RtcChannel;
  createOffer(): Promise<{ type: 'offer'; sdp?: string }>;
  createAnswer(): Promise<{ type: 'answer'; sdp?: string }>;
  setLocalDescription(d: { type: 'offer' | 'answer'; sdp?: string }): Promise<void>;
  setRemoteDescription(d: { type: 'offer' | 'answer'; sdp: string }): Promise<void>;
  close(): void;
  onicegatheringstatechange: ((e: never) => void) | null;
  onconnectionstatechange: ((e: never) => void) | null;
  ondatachannel: ((e: { channel: RtcChannel }) => void) | null;
}

export type RtcFactory = (ice: IceServer[]) => RtcPeer;

/** Browser RTCPeerConnection, or null where there is none. */
export function browserRtc(): RtcFactory | null {
  if (typeof RTCPeerConnection === 'undefined') return null;
  return (ice) => new RTCPeerConnection({ iceServers: ice }) as unknown as RtcPeer;
}

const REL = 'rel'; // ordered, reliable: control frames, snapshots, actions
const RT = 'rt'; // unordered, no retransmits: inputs and bundles, which the session re-sends itself

/** Link liveness: heartbeat period, and the silence that makes us suspect a peer. */
const HEARTBEAT_MS = 500;
const SILENCE_MS = 2500;
/**
 * A host that hasn't heard this long from two or more guests at once (or lost them) freezes: those guests may be
 * about to elect a host between them (see Fencing above), and playing on would fork the room. Every live guest
 * speaks at least once a second (heartbeats, and the session's pings from its worker-driven tick), and it is well
 * short of SILENCE_MS plus a watch tick, so the fence is up before any guest can suspect the host.
 */
const QUIET_MS = 1800;
/**
 * How long a fenced host waits for a guest it lost before asking the store whether it still holds the room. By then
 * a guest that wrote it off has told the store: by proof that's at once, by an unanswered probe PROBE_MS after the
 * offer lands, and a fenced host answers offers.
 */
const FENCE_HOLD_MS = 7000;
/** Timers stalled this long mean we froze (background tab, sleep), not that everyone else died. */
const FROZEN_MS = 2000;
/**
 * How long a peer gets to answer, counted from when our offer lands, so it's
 * judged on its own response alone. An answer can take its poll interval, plus
 * up to ICE_GATHER_MS, plus two store round trips: calling a slow peer dead
 * makes a second host. The old host wakes polling when it notices the same
 * silence, and a third peer's offer ends the wait early, so the common path
 * doesn't sit these out.
 */
const PROBE_MS = 4000;
const CANDIDATE_MS = 5000;
/** Extra time for our own gathering and for delivering the offer. */
const OFFER_SEND_MS = 6000;
/** A first join may land on a host polling at its idle rate (hidden tabs: twice that). */
const JOIN_OFFER_MS = 12_000;
/** After an answer, how long the channels get to open before we call the pair unreachable. */
const OPEN_MS = 6000;
/**
 * Mid-migration, an answered handshake still not open after this long may be
 * with a peer that died right after answering: ask the next in line as well
 * (see stuck). Channels open well within it on a working pair.
 */
const STUCK_MS = 2000;
const UNREACHABLE_TRIES = 2;
/** Non-trickle ICE: one offer and one answer carrying all candidates, so a connection costs two store writes. */
const ICE_GATHER_MS = 1000;
/** A new host keeps expected guests in the roster this long so they aren't marked away while they re-signal. */
const LINK_GRACE_MS = 6000;
/**
 * A guest whose link drops without a goodbye keeps its seat this long. A stalled
 * tab or a Wi-Fi blip re-offers within a few seconds, and being marked away costs
 * a player real things: their placement, their runner.
 */
const GUEST_GRACE_MS = 5000;
/** Polling. Urgent: a peer waiting on an answer. Wake: right after anything happened. Then idle, then solo. */
const POLL_URGENT_MS = 400;
const POLL_WAKE_MS = 1000;
const POLL_IDLE_MS = 5000;
const POLL_SOLO_MS = 15_000;
const WAKE_WINDOW_MS = 30_000;
const SOLO_AFTER_MS = 10 * 60_000;
/** A hidden tab alone in a room this long leaves it, and rejoins when shown. A forgotten tab must not spend the free tier. */
const SLEEP_AFTER_MS = 10 * 60_000;
const BACKOFF_MAX_MS = 30_000;
/**
 * A host fresh from a migration, or whose API just came back, asks the store
 * this often for a while whether it was written off, instead of waiting for the
 * next BEAT_MS: two hosts must not run for long.
 */
const RIVAL_CHECK_MS = 2000;
const RIVAL_WINDOW_MS = 12_000;
/**
 * A host lists its room again before its next beat when what a browser would see changed (seats, watchers, theme,
 * lobby or match), at most this often: someone browsing sees a seat fill in seconds, not a beat later.
 * Going Private doesn't wait for this: it is off the list at once (retried no faster than UNLIST_RETRY_MS).
 */
const LIST_NUDGE_MS = 5000;
const UNLIST_RETRY_MS = 1000;
/** Offers read while we weren't host, kept in case we become it. */
const STASH_MS = 10_000;
/** An offer the API failed to take is sent again this soon. */
const OFFER_RETRY_MS = 1000;
/**
 * The store's head that isn't in our roster is a guest that died without a goodbye or a host we split from. A ghost
 * leaves the store once its liveness runs out; one still listed past this is alive, and a host with guests yields to it.
 */
const RIVAL_PROVEN_MS = (PEER_TTL_S + 10) * 1000;
/** A host handing the room on keeps its old links this long, so the handover frame goes out before they close. */
const HANDOVER_CLOSE_MS = 1000;
/** Safe across browsers; bigger messages are split. */
const CHUNK_CHARS = 16_000;
/** Above this the channel is backed up: drop realtime traffic, the session recovers it. */
const RT_BUFFER_MAX = 64 * 1024;

interface Link {
  id: string;
  c: string;
  order: number;
  pc: RtcPeer;
  rel: RtcChannel | null;
  rt: RtcChannel | null;
  open: boolean;
  answered: boolean;
  /** When our offer reached the store (0: not yet). One that never did (the API was down) proves nothing about the peer. */
  sent: number;
  heard: number;
  /** Reassembly of a split reliable message. */
  parts: string;
}

interface Dial {
  link: Link;
  timer: ReturnType<typeof setTimeout>;
  /** Answer window, kept for a retry: a peer we're waiting on mid-migration doesn't get a newcomer's patience. */
  window: number;
}

/** Ways the join can fail for good; the session turns the text into the UI's status line. */
const FATAL: Record<string, string> = {
  unconfigured: 'Online Not Set Up',
  full: 'Room Is Full',
};

export interface WebRtcOptions {
  signal: SignalApi;
  rtc: RtcFactory;
  hidden?: () => boolean;
}

export class WebRtcTransport implements Transport {
  readonly kind = 'webrtc';
  private h: TransportHandlers | null = null;
  private signal: SignalApi;
  private rtc: RtcFactory;
  private hidden: () => boolean;

  private closed = false;
  private asleep = false;
  /** This session's stamp in the store, so a late write from another session of this peer can't pass for ours. */
  private readonly since = sessionStamp();
  private order = -1;
  private ice: IceServer[] = DEFAULT_ICE;
  private role: 'none' | 'host' | 'guest' = 'none';
  private hostId = '';
  private roster = new Map<string, Member>();
  /** Open links by peer: every guest (host), or the host (guest). */
  private links = new Map<string, Link>();
  /** Outbound attempts by peer, including a re-offer to a host we still have a link object for. */
  private dials = new Map<string, Dial>();
  /** Inbound links still opening, by attempt. */
  private inbound = new Map<string, Link>();
  /** Peers we wrote off, with the order of the session we mean. */
  private dead = new Map<string, number>();
  /** The store's head when it wasn't us, and since when (see RIVAL_PROVEN_MS). */
  private rival = '';
  private rivalSince = 0;
  /** Stepped behind the players while the room was settling: hand it on once it has (see handOn). */
  private stepBack = false;
  /** The host we lost and are re-offering to: nothing is decided until it fails or is contradicted. */
  private probing = '';
  /** We're next in line, holding off until the probe settles. */
  private candidate = false;
  private failures = new Map<string, number>();
  private stash: { mail: Mail; at: number }[] = [];
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Host: guests lost without a goodbye and when, until they relink or FENCE_HOLD_MS passes. */
  private lost = new Map<string, number>();
  /** Host frozen: guests that lost us may be electing a host without us (see Fencing above). */
  private fenced = false;
  /** A lost guest never came back while we were fenced: we play on only after a beat begun after this says we still host. */
  private fenceAsk = 0;

  private lastStatus = '';
  private lastMembers = '';
  private hadGuests = false;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAt = 0;
  private polling = false;
  private pollFails = 0;
  /** When a mailbox read last succeeded. */
  private lastMail = 0;
  private wakeUntil = 0;
  private soloSince = 0;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastWatch = 0;
  private lastBeat = -1e9;
  private beating = false;
  private reordering = false;
  /** Until when a host checks the store for a rival every RIVAL_CHECK_MS. */
  private checkUntil = 0;
  /** What the lobby list shows of the room while we host it; null keeps it off (Private). The session supplies it. */
  private listing: () => RoomListing | null = () => null;
  /** What our beats last put on the list, as `listedKey`; '' when the room isn't listed by us. */
  private listed = '';
  private lastNudge = -1e9;

  constructor(
    readonly room: string,
    readonly self: string,
    opts: WebRtcOptions,
  ) {
    this.signal = opts.signal;
    this.rtc = opts.rtc;
    this.hidden = opts.hidden ?? (() => false);
  }

  start(h: TransportHandlers) {
    this.h = h;
    this.setStatus('connecting');
    void this.enter();
  }

  list(fn: () => RoomListing | null) {
    this.listing = fn;
  }

  /** Leave the store, taking the room off the lobby list if we listed it. */
  private leaveStore(order: number) {
    this.signal.leave(order, this.since, this.role === 'host' && this.listed !== '');
    this.listed = '';
  }

  /** Join the room over the API, retrying while it can't be reached. Permanent refusals end online play for this page. */
  private async enter() {
    for (let tries = 0; !this.closed; tries++) {
      try {
        const r = await this.signal.join(this.since);
        if (this.closed) return this.signal.leave(r.order, this.since); // closed while the join was on the way: take the seat back out
        this.order = r.order;
        this.ice = r.ice;
        this.startTimers();
        this.roster = new Map(r.members.map((m) => [m.id, m]));
        this.roster.set(this.self, { id: this.self, order: r.order });
        this.settle();
        return;
      } catch (e) {
        const code = e instanceof SignalError ? e.code : 'network';
        if (FATAL[code]) return this.giveUp(FATAL[code]);
        if (tries >= 4) return this.giveUp('Signaling Unreachable');
        await sleep(Math.min(BACKOFF_MAX_MS, 500 * 2 ** tries));
      }
    }
  }

  /** Decide our part from the roster: host if we're first, otherwise reach whoever is. */
  private settle() {
    const next = this.elect();
    if (next === this.self) this.takeOver();
    else this.follow(next, JOIN_OFFER_MS);
  }

  private elect(): string {
    return sortMembers([...this.roster.values()])[0].id;
  }

  private giveUp(why: string) {
    this.stopTimers();
    for (const id of [...this.links.keys(), ...this.dials.keys()]) this.dropPeer(id);
    if (this.order >= 0) this.leaveStore(this.order);
    this.order = -1;
    this.role = 'none';
    this.setStatus('unavailable', why);
  }

  // ---------------------------------------------------------------- transport API

  send(data: unknown, to?: string, lossy = false) {
    const text = JSON.stringify(data);
    const targets = to ? [this.links.get(to)] : [...this.links.values()];
    for (const l of targets) if (l?.open) this.sendOn(l, text, lossy);
  }

  private sendOn(l: Link, text: string, lossy: boolean) {
    try {
      if (lossy && text.length <= CHUNK_CHARS) {
        if (l.rt?.readyState === 'open' && l.rt.bufferedAmount < RT_BUFFER_MAX) l.rt.send(text);
        return;
      }
      if (l.rel?.readyState !== 'open') return;
      let i = 0;
      for (; text.length - i > CHUNK_CHARS; i += CHUNK_CHARS) l.rel.send(`p${text.slice(i, i + CHUNK_CHARS)}`);
      l.rel.send(`d${text.slice(i)}`);
    } catch {
      // Closing under us: the close handler deals with it.
    }
  }

  private frame(l: Link, text: string) {
    try {
      if (l.rel?.readyState === 'open') l.rel.send(text);
    } catch {
      // as above
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopTimers();
    for (const l of this.links.values()) this.frame(l, 'x');
    if (this.order >= 0) this.leaveStore(this.order);
    for (const l of this.links.values()) l.pc.close();
    for (const d of this.dials.values()) {
      clearTimeout(d.timer);
      d.link.pc.close();
    }
    for (const l of this.inbound.values()) l.pc.close();
    this.links.clear();
    this.dials.clear();
    this.inbound.clear();
    this.h?.status('closed');
    this.h = null;
  }

  /**
   * Take a new, later join order without dropping any link: an observer ahead of a player (the session decides).
   * A guest tells the host, which pushes the roster, so every peer's election skips it from then on. A host
   * that is no longer first hands the room to the first guest linked to it (see handOn).
   */
  reorder() {
    if (this.order < 0 || this.closed || this.reordering) return;
    this.reordering = true;
    void this.signal
      .join(this.since)
      .then((r) => {
        if (this.closed) return this.signal.leave(r.order, this.since);
        this.order = r.order;
        const self = this.roster.get(this.self);
        if (self) self.order = r.order;
        if (this.role === 'guest') {
          const host = this.links.get(this.hostId);
          if (host?.open) this.frame(host, `o${r.order}`);
        }
        this.emitMembers();
        if (this.role === 'host') {
          this.pushRoster();
          this.handOn();
        }
      })
      .catch(() => {
        // The session asks again later.
      })
      .finally(() => {
        this.reordering = false;
      });
  }

  /** Page shown again (or asked to check now): rejoin if we slept, and don't sit out the next poll. */
  resume() {
    if (this.closed) return;
    if (this.asleep) {
      this.asleep = false;
      void this.enter();
    } else this.wake();
  }

  // ---------------------------------------------------------------- status

  private setStatus(s: LinkStatus, detail?: string) {
    const sig = `${s}:${detail ?? ''}`;
    if (sig === this.lastStatus) return;
    this.lastStatus = sig;
    this.h?.status(s, detail);
  }

  private emitMembers() {
    const list = sortMembers([...this.roster.values()]);
    const sig = JSON.stringify(list);
    if (sig === this.lastMembers) return;
    this.lastMembers = sig;
    this.h?.members(list);
  }

  private pushRoster() {
    const list = sortMembers([...this.roster.values()]);
    const text = `r${JSON.stringify(list)}`;
    for (const l of this.links.values()) if (l.open) this.frame(l, text);
  }

  // ---------------------------------------------------------------- guest: reaching a host

  private follow(id: string, timeout: number) {
    this.clearFence();
    // Handshakes a host was still answering: once open they would take the newcomer for our host (and it us).
    // They re-offer to whoever hosts, and we send them there (see hostLinked).
    for (const l of this.inbound.values()) quiet(l);
    this.inbound.clear();
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = null;
    this.stepBack = false;
    this.role = 'guest';
    this.listed = ''; // the host we follow lists the room now
    this.hostId = id;
    this.candidate = false;
    this.emitMembers();
    this.dial(id, timeout);
  }

  private newLink(id: string, c: string, order: number): Link {
    const pc = this.rtc(this.ice);
    const link: Link = { id, c, order, pc, rel: null, rt: null, open: false, answered: false, sent: 0, heard: Date.now(), parts: '' };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.onLinkDown(link);
    };
    return link;
  }

  private dial(id: string, timeout: number) {
    if (this.dials.has(id) || this.closed) return;
    const link = this.newLink(id, randomId(), this.roster.get(id)?.order ?? 0);
    const rel = link.pc.createDataChannel(REL, { ordered: true });
    const rt = link.pc.createDataChannel(RT, { ordered: false, maxRetransmits: 0 });
    this.wire(link, rel);
    this.wire(link, rt);
    const timer = setTimeout(() => this.dialFailed(id, link), timeout + OFFER_SEND_MS);
    this.dials.set(id, { link, timer, window: timeout });
    this.wake();
    void this.sendOffer(id, link, timeout);
  }

  private async sendOffer(id: string, link: Link, timeout: number) {
    try {
      await link.pc.setLocalDescription(await link.pc.createOffer());
      await gathered(link.pc);
      const sdp = link.pc.localDescription?.sdp;
      if (!sdp || this.dials.get(id)?.link !== link) return;
      let delivered: boolean;
      for (;;) {
        try {
          delivered = await this.signal.send(id, { k: 'offer', c: link.c, o: this.order, sdp });
          break;
        } catch (e) {
          // The API is out (a phone back from sleep, a blip): try again shortly rather than sit out the whole window,
          // which outlasts the grace the other side gives us. Forgotten by the store (our liveness lapsed): the beat
          // rejoins us, and then the offer goes.
          if (e instanceof SignalError && e.code === 'forgotten') void this.heartbeat();
          await sleep(OFFER_RETRY_MS);
          if (this.closed || this.dials.get(id)?.link !== link) return;
        }
      }
      link.sent = Date.now();
      if (!delivered) return this.dialFailed(id, link, true); // the store already knows it's gone: no need to wait
      const d = this.dials.get(id);
      if (d?.link !== link || link.answered) return;
      clearTimeout(d.timer);
      d.timer = setTimeout(() => this.dialFailed(id, link), timeout);
    } catch {
      // Network trouble: the dial times out and the walk carries on from there.
    }
  }

  private async onAnswer(from: string, s: Extract<Signal, { k: 'answer' }>) {
    const d = this.dials.get(from);
    if (!d || d.link.c !== s.c || d.link.answered) return;
    d.link.answered = true;
    clearTimeout(d.timer);
    d.timer = setTimeout(() => this.dialFailed(from, d.link), OPEN_MS);
    if (d.window < JOIN_OFFER_MS) setTimeout(() => this.stuck(from, d.link), STUCK_MS);
    try {
      await d.link.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
    } catch {
      this.dialFailed(from, d.link);
    }
  }

  private onRedirect(from: string, s: Extract<Signal, { k: 'redirect' }>) {
    const d = this.dials.get(from);
    if (!d || d.link.c !== s.c) return;
    if (s.to === '') return this.giveUp(FATAL.full);
    if (s.to === this.self) return;
    this.dropDial(from);
    if (!this.roster.has(s.to)) this.roster.set(s.to, { id: s.to, order: -1 });
    if (this.role === 'guest') {
      this.hostId = s.to;
      this.emitMembers();
      this.dial(s.to, CANDIDATE_MS);
    }
  }

  private stuck(id: string, link: Link) {
    if (this.dials.get(id)?.link === link && !link.open) this.reachPast(id);
  }

  /**
   * Mid-migration, `id` answered but the link didn't open (yet). It may have
   * died just after answering, and waiting out OPEN_MS and a retry costs
   * everyone over 10 s, so reach whoever is next as well, as a probe does: a
   * peer stuck on the same host takes our offer as proof (claim) and hosts. If
   * `id` was only slow, whichever link opens first wins and the store settles
   * the rest.
   */
  private reachPast(id: string) {
    if (this.closed || this.role !== 'guest') return;
    const next = sortMembers([...this.roster.values()].filter((m) => m.id !== id && m.id !== this.probing))[0]?.id;
    if (next && next !== this.self && !this.links.has(next)) this.dial(next, CANDIDATE_MS);
  }

  private dropDial(id: string) {
    const d = this.dials.get(id);
    if (!d) return;
    clearTimeout(d.timer);
    this.dials.delete(id);
    d.link.pc.onconnectionstatechange = null;
    d.link.pc.close();
  }

  /** `refused`: the store said `id` is gone, which is proof; a window running out is proof only if we could read our mail. */
  private dialFailed(id: string, link: Link, refused = false) {
    const d = this.dials.get(id);
    if (!d || d.link !== link) return;
    const answered = link.answered;
    const window = d.window;
    this.dropDial(id);
    // The offer never reached the store, or we couldn't read our mail since (the API was down): nothing is known about
    // the peer, and an answer may be waiting. Ask again.
    if (!answered && !refused && (!link.sent || this.lastMail <= link.sent)) return this.dial(id, window);
    if (answered) {
      // It answered but we can't get through: a NAT problem, or it died just now. Try again: a dead peer won't answer twice.
      const tries = (this.failures.get(id) ?? 0) + 1;
      this.failures.set(id, tries);
      if (tries >= UNREACHABLE_TRIES) return this.giveUp('Cannot Reach Host');
      this.dial(id, window);
      if (window < JOIN_OFFER_MS) this.reachPast(id);
      return;
    }
    this.confirmDead(id);
  }

  // ---------------------------------------------------------------- losing the host

  private onHostLost(id: string, graceful: boolean) {
    if (this.role !== 'guest' || this.hostId !== id || this.probing === id) return;
    this.setStatus('reconnecting');
    this.wake();
    if (graceful) {
      this.closeLink(id);
      this.confirmDead(id);
      return;
    }
    this.probing = id;
    this.dropDial(id);
    this.dial(id, PROBE_MS);
    this.reachNext();
  }

  /** Reach out to whoever is next without giving up on the host we're probing. */
  private reachNext() {
    const next = sortMembers([...this.roster.values()].filter((m) => m.id !== this.probing))[0]?.id ?? this.self;
    if (next !== this.self) {
      if (!this.links.has(next)) this.dial(next, CANDIDATE_MS);
    } else if (!this.probing) this.takeOver();
    else if (this.stash.some((x) => x.mail.s.k === 'offer' && this.roster.has(x.mail.from) && Date.now() - x.at < STASH_MS)) this.confirmDead(this.probing);
    else this.candidate = true;
  }

  /** `id` failed to answer an offer (or said goodbye): it's out of the roster and the store, and the walk moves on. */
  private confirmDead(id: string) {
    this.writeOff(id);
    if (this.role !== 'guest' || this.hostId !== id) {
      if (this.role === 'guest' && !this.links.has(this.hostId) && !this.dials.has(this.hostId)) this.reachNext();
      return;
    }
    const next = this.elect();
    this.hostId = next;
    if (next === this.self) {
      this.takeOver();
      return;
    }
    this.emitMembers();
    if (!this.links.has(next)) this.dial(next, CANDIDATE_MS);
  }

  /** Out of the roster and, once the report lands, the store. */
  private writeOff(id: string) {
    const was = this.roster.get(id);
    if (this.probing === id) this.probing = '';
    this.closeLink(id);
    if (!was) return;
    this.roster.delete(id);
    if (was.order < 0) return; // a redirect's placeholder: we never knew which session it was
    this.dead.set(id, was.order);
    void this.reportDead(id, was.order);
  }

  private async reportDead(id: string, order: number) {
    try {
      await this.signal.gone(id, order);
      this.dead.delete(id);
    } catch {
      // Retried on the next heartbeat.
    }
  }

  /** Become host. Everyone we knew stays in the roster, marked linking, while they re-signal to us. */
  private takeOver() {
    const hadRoster = [...this.roster.values()].filter((m) => m.id !== this.self);
    for (const id of this.dials.keys()) this.dropDial(id);
    this.failures.clear(); // handshakes that failed under another host say nothing about the next one
    this.candidate = false;
    this.probing = '';
    this.clearFence();
    this.role = 'host';
    this.hostId = this.self;
    this.soloSince = Date.now();
    this.roster = new Map(hadRoster.map((m) => [m.id, { ...m, linking: true }]));
    this.roster.set(this.self, { id: this.self, order: this.order });
    if (hadRoster.length) {
      this.checkUntil = Date.now() + RIVAL_WINDOW_MS;
      if (this.graceTimer) clearTimeout(this.graceTimer);
      this.graceTimer = setTimeout(() => this.endGrace(), LINK_GRACE_MS);
    }
    this.setStatus('open');
    this.emitMembers();
    this.wake();
    const stash = this.stash;
    this.stash = [];
    for (const s of stash) if (Date.now() - s.at < STASH_MS) void this.onMail(s.mail);
  }

  private endGrace() {
    this.graceTimer = null;
    for (const m of this.roster.values()) if (m.linking) this.roster.delete(m.id);
    this.emitMembers();
    this.pushRoster();
  }

  // ---------------------------------------------------------------- host: accepting guests

  private async onOffer(from: string, s: Extract<Signal, { k: 'offer' }>) {
    if (this.role !== 'host') return;
    const known = this.roster.has(from);
    if (!known && this.roster.size >= MAX_PEERS) {
      await this.signal.send(from, { k: 'redirect', c: s.c, to: '' }).catch(() => false);
      return;
    }
    const link = this.newLink(from, s.c, s.o);
    this.inbound.set(s.c, link);
    link.pc.ondatachannel = (e) => this.wire(link, e.channel);
    this.wake();
    try {
      await link.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
      await link.pc.setLocalDescription(await link.pc.createAnswer());
      await gathered(link.pc);
      const sdp = link.pc.localDescription?.sdp;
      if (sdp) await this.signal.send(from, { k: 'answer', c: s.c, sdp });
    } catch {
      this.inbound.delete(s.c);
      link.pc.close();
      return;
    }
    setTimeout(() => {
      if (this.inbound.get(s.c) !== link) return;
      this.inbound.delete(s.c);
      link.pc.close();
    }, OPEN_MS);
  }

  private wire(link: Link, ch: RtcChannel) {
    if (ch.label === REL) link.rel = ch;
    else link.rt = ch;
    ch.onopen = () => this.onChannelOpen(link);
    ch.onclose = () => this.onLinkDown(link);
    ch.onmessage = (e) => this.onData(link, e.data);
    if (ch.readyState === 'open') this.onChannelOpen(link);
  }

  private onChannelOpen(link: Link) {
    if (link.open || link.rel?.readyState !== 'open' || link.rt?.readyState !== 'open') return;
    link.open = true;
    link.heard = Date.now();
    if (this.role === 'host') this.guestLinked(link);
    else this.hostLinked(link);
  }

  private guestLinked(link: Link) {
    if (this.inbound.get(link.c) === link) this.inbound.delete(link.c);
    const old = this.links.get(link.id);
    this.links.set(link.id, link);
    if (old && old !== link) quiet(old);
    this.roster.set(link.id, { id: link.id, order: link.order });
    this.dead.delete(link.id);
    this.lost.delete(link.id);
    this.hadGuests = true;
    this.soloSince = 0;
    this.emitMembers();
    this.pushRoster();
    this.checkFence();
  }

  /** A dialled peer answered. If it's the host we were probing, nothing changed but the link; if it's the next in line, the host really is gone. */
  private hostLinked(link: Link) {
    const d = this.dials.get(link.id);
    if (d?.link === link) {
      clearTimeout(d.timer);
      this.dials.delete(link.id);
    }
    const old = this.links.get(link.id);
    this.links.set(link.id, link);
    if (old && old !== link) quiet(old);
    this.failures.delete(link.id);
    if (this.probing && this.probing !== link.id) {
      // A host now behind the one we reached in line stepped back (its handover frame lost with the link): it's a
      // guest of the room now, not dead, and writing it off would take it out of the store with its mailbox.
      const was = this.roster.get(this.probing);
      if (was && was.order > link.order) this.closeLink(this.probing);
      else this.confirmDead(this.probing);
    }
    this.probing = '';
    this.candidate = false;
    this.hostId = link.id;
    for (const id of this.dials.keys()) if (id !== link.id) this.dropDial(id);
    for (const [id, l] of this.links) {
      if (id === link.id) continue;
      this.links.delete(id);
      quiet(l);
    }
    // Offers that reached us while we had no host (a newcomer that took us for host just as we stepped back, a peer
    // that lost the old host too): send them on now, rather than leave them to time out.
    const stash = this.stash;
    this.stash = [];
    for (const x of stash) {
      if (x.mail.from === link.id || x.mail.s.k !== 'offer' || Date.now() - x.at >= STASH_MS) continue;
      void this.signal.send(x.mail.from, { k: 'redirect', c: x.mail.s.c, to: link.id }).catch(() => false);
    }
    // Status goes open when the host's roster arrives: only then do we know the room.
  }

  private onLinkDown(link: Link) {
    if (this.inbound.get(link.c) === link) {
      this.inbound.delete(link.c);
      link.pc.close();
      return;
    }
    if (this.dials.get(link.id)?.link === link) {
      if (link.pc.connectionState === 'failed') this.dialFailed(link.id, link);
      return;
    }
    if (this.links.get(link.id) !== link) return;
    if (this.role === 'guest') this.onHostLost(link.id, false);
    else this.onGuestLost(link);
  }

  private onGuestLost(link: Link, goodbye = false) {
    this.links.delete(link.id);
    quiet(link);
    const m = this.roster.get(link.id);
    if (m && !goodbye) {
      this.lost.set(link.id, Date.now());
      this.roster.set(link.id, { ...m, linking: true });
      setTimeout(() => this.expireGuest(link.id), GUEST_GRACE_MS);
      // Guests that lost us take over from us if they find each other: the store would know before we do.
      this.checkUntil = Date.now() + RIVAL_WINDOW_MS;
    } else this.roster.delete(link.id);
    this.emitMembers();
    this.pushRoster();
    if (this.links.size === 0) this.soloSince = Date.now();
    // It might be re-offering right now; and if everyone vanished, we may be the one who dropped off.
    this.wake();
    if (this.links.size === 0 && this.hadGuests) void this.heartbeat();
    this.checkFence();
  }

  private expireGuest(id: string) {
    if (this.closed || this.links.has(id) || !this.roster.get(id)?.linking) return;
    this.roster.delete(id);
    this.emitMembers();
    this.pushRoster();
  }

  private closeLink(id: string) {
    const l = this.links.get(id);
    if (!l) return;
    this.links.delete(id);
    quiet(l);
  }

  private dropPeer(id: string) {
    this.dropDial(id);
    this.closeLink(id);
  }

  private onData(link: Link, data: unknown) {
    if (typeof data !== 'string') return;
    link.heard = Date.now();
    // The host we were worried about is talking on the old link after all.
    if (this.probing === link.id && this.links.get(link.id) === link && this.dials.get(link.id)?.link !== link) {
      this.probing = '';
      this.candidate = false;
      this.dropDial(link.id);
      for (const id of this.dials.keys()) this.dropDial(id);
      this.setStatus('open');
    }
    const kind = data[0];
    if (kind === 'h') return;
    if (kind === '{') return this.deliver(link, data);
    if (kind === 'p') {
      link.parts += data.slice(1);
    } else if (kind === 'd') {
      const text = link.parts + data.slice(1);
      link.parts = '';
      this.deliver(link, text);
    } else if (kind === 'x' && this.role === 'host') this.onGuestLost(link, true);
    else if (kind === 'o' && this.role === 'host') this.onReorder(link, Number(data.slice(1)));
    else if (link.id === this.hostId && this.role === 'guest') this.onHostFrame(link, data);
  }

  /** A guest rejoined the order at the back (see reorder): everyone's roster says so, so no election picks it first. */
  private onReorder(link: Link, order: number) {
    const m = this.roster.get(link.id);
    if (!m || !Number.isSafeInteger(order) || order <= m.order) return;
    link.order = order;
    this.roster.set(link.id, { ...m, order });
    this.emitMembers();
    this.pushRoster();
  }

  private onHostFrame(link: Link, data: string) {
    if (data === 'x') return this.onHostLost(link.id, true);
    if (data[0] === 'm') return this.onHandover(data.slice(1));
    if (data[0] !== 'r') return;
    try {
      const list = JSON.parse(data.slice(1)) as Member[];
      if (!Array.isArray(list)) return;
      this.roster = new Map(list.map((m) => [m.id, { id: m.id, order: m.order }]));
      if (!this.roster.has(this.self)) this.roster.set(this.self, { id: this.self, order: this.order });
      this.setStatus('open');
      this.emitMembers();
    } catch {
      // A bad frame from the host changes nothing.
    }
  }

  private deliver(link: Link, text: string) {
    let data: unknown;
    try {
      data = JSON.parse(text);
      this.h?.message(link.id, data);
    } catch (e) {
      console.warn('net: dropped a bad message', e);
    }
  }

  /** Our host stepped aside for a lower-order peer: follow it. */
  private onHandover(to: string) {
    if (!this.roster.has(to)) this.roster.set(to, { id: to, order: -1 });
    this.closeLink(this.hostId);
    this.roster.delete(this.hostId);
    this.setStatus('reconnecting');
    this.hostId = to;
    if (to === this.self) return this.takeOver();
    this.emitMembers();
    this.dial(to, CANDIDATE_MS);
  }

  /**
   * We stepped behind the players, so the room goes to the first of them in line, by our roster: only a guest linked
   * to us now is sure to be alive. The store's lowest order may be a guest that died without a goodbye (a phone
   * killed in the background stays listed until its liveness runs out), and handing the room to it strands everyone.
   */
  private handOn() {
    this.stepBack = false;
    if (this.role !== 'host' || this.closed) return;
    const ahead = sortMembers([...this.roster.values()].filter((m) => m.id !== this.self && m.order < this.order));
    if (!ahead.length) return;
    // Not while the room is settling: a guest in its grace may be alive, and is then the next in line (passing it over
    // leaves it hosting alone); a newcomer mid-handshake should land here first and move with everyone. The watchdog
    // asks again (a lost guest is let go within GUEST_GRACE_MS, a handshake within OPEN_MS).
    if (ahead.some((m) => m.linking) || this.inbound.size) {
      this.stepBack = true;
      return;
    }
    const next = ahead.find((m) => this.links.get(m.id)?.open);
    if (next) this.yieldTo(next.id, next.order);
  }

  /** `id` keeps the room (a lower order hosting too, or the next in line after we stepped back); we bring our guests over. */
  private yieldTo(id: string, order: number) {
    // RTCPeerConnection.close() aborts the association and can drop what it hasn't sent, so the handover frame gets a
    // moment to go out first; guests close their end as soon as they read it. Out of `links`, nothing they say counts.
    const old = [...this.links.values()];
    this.links.clear();
    for (const l of old) this.frame(l, `m${id}`);
    setTimeout(() => old.forEach(quiet), HANDOVER_CLOSE_MS);
    this.roster = new Map([
      [id, { id, order }],
      [this.self, { id: this.self, order: this.order }],
    ]);
    this.setStatus('reconnecting');
    this.follow(id, JOIN_OFFER_MS);
  }

  // ---------------------------------------------------------------- fencing (host)

  /** Guests the fence waits on: quiet on an open link, or lost and still inside FENCE_HOLD_MS. Drops lost ones past it. */
  private fenceWaitingOn(t: number): number {
    for (const [id, at] of this.lost) {
      if (t - at < FENCE_HOLD_MS) continue;
      this.lost.delete(id);
      if (this.fenced) this.fenceAsk = t; // it may be hosting without us: the store knows
    }
    let quiet = 0;
    for (const l of this.links.values()) if (l.open && t - l.heard > QUIET_MS) quiet++;
    return quiet + this.lost.size;
  }

  /** Freeze when two or more guests may have lost us; thaw when none may have, asking the store first if one never came back. */
  private checkFence(t = Date.now()) {
    if (this.role !== 'host' || this.closed) return;
    const waiting = this.fenceWaitingOn(t);
    if (!this.fenced) {
      if (waiting < 2) return;
      this.fenced = true;
      this.fenceAsk = 0;
      this.setStatus('reconnecting');
      this.wake(); // they re-offer to us: answer fast
      return;
    }
    if (waiting > 0) return;
    if (!this.fenceAsk) this.unfence();
    else if (this.lastBeat < this.fenceAsk) void this.heartbeat();
  }

  private unfence() {
    this.fenced = false;
    this.fenceAsk = 0;
    this.setStatus('open');
  }

  private clearFence() {
    this.fenced = false;
    this.fenceAsk = 0;
    this.lost.clear();
  }

  // ---------------------------------------------------------------- polling and heartbeats

  private startTimers() {
    if (!this.beatTimer) this.beatTimer = setInterval(() => void this.heartbeat(), BEAT_MS);
    if (!this.watchdog) {
      this.lastWatch = Date.now();
      this.watchdog = setInterval(() => this.watch(), HEARTBEAT_MS);
    }
  }

  private stopTimers() {
    if (this.beatTimer) clearInterval(this.beatTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.beatTimer = this.watchdog = this.pollTimer = this.graceTimer = null;
  }

  private watch() {
    const t = Date.now();
    const froze = t - this.lastWatch > FROZEN_MS;
    this.lastWatch = t;
    for (const l of this.links.values()) {
      if (froze) l.heard = t;
      if (!l.open) continue;
      try {
        if (l.rt?.readyState === 'open') l.rt.send('h');
      } catch {
        // close handler
      }
    }
    if (froze) return;
    for (const l of this.links.values()) {
      if (t - l.heard <= SILENCE_MS) continue;
      if (this.role === 'guest') this.onHostLost(l.id, false);
      else this.onGuestLost(l);
    }
    this.checkFence(t);
    if (this.stepBack) this.handOn();
    if (this.role === 'host' && (t < this.checkUntil || this.fenced) && t - this.lastBeat >= RIVAL_CHECK_MS) void this.heartbeat();
    else if (this.role === 'host') this.relist(t);
    this.maybeSleep(t);
  }

  /** A host whose listing changed since its last beat beats now (see LIST_NUDGE_MS), rather than at the next BEAT_MS. */
  private relist(t: number) {
    if (this.beating) return;
    const shown = this.listing();
    if ((shown ? listedKey(shown) : '') === this.listed) return;
    if (t - this.lastNudge < (shown ? LIST_NUDGE_MS : UNLIST_RETRY_MS)) return;
    this.lastNudge = t;
    void this.heartbeat();
  }

  private maybeSleep(t: number) {
    if (this.role !== 'host' || this.links.size > 0 || !this.soloSince || !this.hidden() || t - this.soloSince < SLEEP_AFTER_MS) return;
    this.stopTimers();
    this.leaveStore(this.order);
    this.order = -1;
    this.asleep = true;
    this.role = 'none';
  }

  private async heartbeat() {
    // One at a time: two overlapping beats that both find us forgotten would join twice.
    if (this.order < 0 || this.closed || this.beating) return;
    this.beating = true;
    const started = (this.lastBeat = Date.now());
    for (const [id, order] of this.dead) void this.reportDead(id, order);
    try {
      const host = this.role === 'host';
      // A host lists the room (unless it's Private), or takes it off the list once it went Private.
      const shown = host ? this.listing() : null;
      const r = await this.signal.beat(host, shown ?? (host && this.listed ? false : undefined));
      this.noteSignalOk();
      if (host) this.listed = shown && r.alive ? listedKey(shown) : '';
      if (this.closed) return;
      if (!r.alive) await this.rejoin();
      // Not first in the store's line while it still holds us: the store can't tell a rival host from a guest that died
      // without a goodbye (it stays listed until its liveness runs out), so only our own linked guests count (handOn).
      // A real rival host wrote us off when it took over, and the branch above settles that.
      else if (this.role === 'host' && r.head && r.head !== this.self && !this.dead.has(r.head)) {
        const t = Date.now();
        if (this.rival !== r.head) [this.rival, this.rivalSince] = [r.head, t];
        // A host with nobody linked or expected has no room to lose: it goes to the room's head (one that turns out
        // dead fails its offer and the walk moves on). One of our own guests ahead of us: we stepped back (handOn).
        // Anyone else must outlast a ghost's liveness first (RIVAL_PROVEN_MS).
        if (this.links.size === 0 && ![...this.roster.values()].some((m) => m.linking)) await this.checkRival();
        else if (this.roster.has(r.head)) this.handOn();
        else if (t - this.rivalSince >= RIVAL_PROVEN_MS) await this.checkRival();
      } else this.rival = '';
      // Still the room's host after everyone we were waiting on came back or ran out of time: play on.
      if (this.fenced && this.role === 'host' && started >= this.fenceAsk && this.fenceWaitingOn(Date.now()) === 0) this.unfence();
    } catch {
      this.noteSignalFail();
    } finally {
      this.beating = false;
    }
  }

  /** The store forgot us (expired, or written off while we were away). We come back later in the order. */
  private async rejoin() {
    const r = await this.signal.join(this.since);
    if (this.closed) return this.signal.leave(r.order, this.since);
    this.order = r.order;
    this.ice = r.ice;
    const self = this.roster.get(this.self);
    if (self) self.order = r.order;
    if (this.role === 'host') this.rivalFrom(r.members);
  }

  private async checkRival() {
    this.rivalFrom(await this.signal.members());
  }

  private rivalFrom(list: MemberInfo[]) {
    const rival = sortMembers(list.filter((m) => !this.dead.has(m.id)))[0];
    if (rival && rival.id !== this.self && rival.order < this.order) this.yieldTo(rival.id, rival.order);
  }

  private noteSignalOk() {
    // Back from an outage: someone may have written us off, or hosted, meanwhile.
    if (this.pollFails && this.role === 'host') this.checkUntil = Date.now() + RIVAL_WINDOW_MS;
    this.pollFails = 0;
    if (this.role === 'host' && !this.fenced && this.lastStatus.startsWith('reconnecting')) this.setStatus('open');
  }

  /** A broken API only matters to a host that has also lost its guests: with links up the game doesn't need it. */
  private noteSignalFail() {
    this.pollFails++;
    if (this.role === 'host' && this.hadGuests && this.links.size === 0 && this.pollFails >= 2) this.setStatus('reconnecting', 'Signaling Unreachable');
  }

  private wake() {
    this.wakeUntil = Date.now() + WAKE_WINDOW_MS;
    this.schedulePoll();
  }

  /** Time to the next mailbox read, or null when none is due: a guest with a working link has nothing to wait for. */
  private pollDelay(): number | null {
    if (this.closed || this.asleep || this.order < 0) return null;
    let delay: number;
    if (this.role === 'guest') {
      if (this.dials.size === 0 && !this.probing && this.links.has(this.hostId)) return null;
      delay = POLL_URGENT_MS;
    } else {
      const t = Date.now();
      if (this.dials.size > 0 || t < this.wakeUntil) delay = POLL_WAKE_MS;
      else delay = this.links.size === 0 && this.soloSince && t - this.soloSince > SOLO_AFTER_MS ? POLL_SOLO_MS : POLL_IDLE_MS;
      if (this.hidden()) delay *= 2;
    }
    return this.pollFails ? Math.max(delay, Math.min(BACKOFF_MAX_MS, 1000 * 2 ** this.pollFails)) : delay;
  }

  private schedulePoll() {
    if (this.polling) return;
    const delay = this.pollDelay();
    if (delay === null) return;
    const at = Date.now() + delay;
    if (this.pollTimer) {
      if (this.pollAt <= at) return;
      clearTimeout(this.pollTimer);
    }
    this.pollAt = at;
    this.pollTimer = setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    this.pollTimer = null;
    this.polling = true;
    try {
      const mail = await this.signal.poll();
      this.lastMail = Date.now();
      this.noteSignalOk();
      for (const m of mail) await this.onMail(m);
    } catch {
      this.noteSignalFail();
    }
    this.polling = false;
    this.schedulePoll();
  }

  private async onMail(m: Mail) {
    const s = m.s;
    if (!isSignal(s)) return;
    if (s.k === 'answer') return this.onAnswer(m.from, s);
    if (s.k === 'redirect') return this.onRedirect(m.from, s);
    if (this.role === 'host') return this.onOffer(m.from, s);
    // Our own host offering to us from behind us in line has handed us the room (it stepped back, its handover frame
    // lost with the link): take it. Never proof that it died, and never a redirect back to itself. (From ahead of us
    // it's only a probe: a peer that lost the same host, or a new session of it reaching for us as host.)
    if (this.role === 'guest' && m.from === this.hostId && Number.isSafeInteger(s.o) && s.o > this.order) {
      this.stash.push({ mail: m, at: Date.now() });
      this.closeLink(m.from);
      this.dropDial(m.from);
      return this.takeOver();
    }
    // Settled under a host, so this peer has the wrong idea of who hosts.
    if (this.role === 'guest' && !this.probing && this.links.has(this.hostId)) {
      await this.signal.send(m.from, { k: 'redirect', c: s.c, to: this.hostId }).catch(() => false);
      return;
    }
    this.stash = this.stash.filter((x) => Date.now() - x.at < STASH_MS);
    this.stash.push({ mail: m, at: Date.now() });
    // We were waiting on our own probe, and now someone else has lost the same host: that's proof, take over.
    if (this.candidate && this.roster.has(m.from) && this.probing) this.confirmDead(this.probing);
    else if (this.role === 'guest' && (this.roster.get(m.from)?.order ?? -1) > this.order) this.claim();
  }

  /**
   * A peer behind us in the roster offered to us while we have no host. It only
   * offers here once it can't reach anyone ahead of us, and we can't reach them
   * either: that's the proof a candidate waits for, so take over now. Waiting
   * out our own windows instead (a handshake that was answered and then never
   * opened costs OPEN_MS and a retry) is how it ends up writing us off and
   * hosting alongside us.
   */
  private claim() {
    for (const m of sortMembers([...this.roster.values()])) {
      if (m.id === this.self) break;
      this.dropDial(m.id);
      this.writeOff(m.id);
    }
    this.takeOver();
  }
}

function quiet(l: Link) {
  l.pc.onconnectionstatechange = null;
  if (l.rel) l.rel.onclose = null;
  if (l.rt) l.rt.onclose = null;
  l.pc.close();
}

function randomId(): string {
  return Math.floor(Math.random() * 2 ** 40).toString(36);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** What of a listing is worth listing again early: seats, watchers, theme, the host's name, and lobby or match (not every phase of a round). */
function listedKey(l: RoomListing): string {
  return `${l.players}/${l.max}/${l.observers}/${l.theme}/${l.phase === 'lobby' ? 'lobby' : 'match'}/${l.host ?? ''}`;
}

/** Wait for all ICE candidates to land in the local description, within reason. */
function gathered(pc: RtcPeer): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.onicegatheringstatechange = null;
      resolve();
    };
    const timer = setTimeout(done, ICE_GATHER_MS);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
  });
}
