import { expect, vi } from 'vitest';
import { handleOp } from '../../app/api/net/_server/handlers';
import { MemoryStore } from '../../app/api/net/_server/store';
import { Match } from '../../src/game/match';
import { roomSeed } from '../../src/game/room';
import { NetSession, type SessionOptions } from '../../src/net/session';
import { deliveredOrThrow, SignalError, type SignalApi } from '../../src/net/signal-client';
import { DEFAULT_ICE, type Mail, type MemberInfo, type RoomListing, type Signal } from '../../src/net/signal-protocol';
import { hashMatch } from '../../src/net/snapshot';
import { type RtcChannel, type RtcPeer, WebRtcTransport } from '../../src/net/webrtc-transport';
import type { InputFrame } from '../../src/sim/types';

/**
 * The real transport, real handlers and real store, with only the two things
 * a test can't have swapped out: RTCPeerConnection (a fake network below) and
 * HTTP (a direct call into the handlers). Time is vitest's fake clock.
 */

export const TICK = 1000 / 60;

export class FakeNet {
  pcs = new Map<string, FakePc>();
  /** Crashed machines: nothing in or out, and nobody gets told. */
  dead = new Set<string>();
  /** Pairs with no route, like two strict NATs. */
  blocked = new Set<string>();
  slowIce = false;
  /** A crashed remote never answers ICE checks, so a handshake with it hangs instead of failing, as in a real browser. */
  deadHangs = false;
  n = 0;
  route(a: string, b: string) {
    return !this.dead.has(a) && !this.dead.has(b) && !this.blocked.has([a, b].sort().join());
  }
}

export class FakeChannel implements RtcChannel {
  readyState = 'connecting';
  bufferedAmount = 0;
  other: FakeChannel | null = null;
  onopen: any = null;
  onclose: any = null;
  onmessage: any = null;
  sent = 0;
  constructor(
    readonly label: string,
    public owner: string,
    private net: FakeNet,
  ) {}
  send(data: string) {
    this.sent++;
    const to = this.other;
    if (!to || !this.net.route(this.owner, to.owner)) return;
    setTimeout(() => to.onmessage?.({ data }), 5);
  }
  open() {
    this.readyState = 'open';
    this.onopen?.();
  }
  close() {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    this.onclose?.();
    // A browser closing its end tells the other (SCTP abort) when there's a route; with none, the other end hears nothing.
    const to = this.other;
    if (to && this.net.route(this.owner, to.owner)) setTimeout(() => to.close(), 5);
  }
}

export class FakePc implements RtcPeer {
  connectionState = 'new';
  iceGatheringState: string;
  localDescription: { sdp: string } | null = null;
  onicegatheringstatechange: any = null;
  onconnectionstatechange: any = null;
  ondatachannel: any = null;
  channels: FakeChannel[] = [];
  id: string;
  constructor(
    public owner: string,
    private net: FakeNet,
  ) {
    this.id = `pc${net.n++}`;
    net.pcs.set(this.id, this);
    // Slow ICE: gathering never reports complete, so every handshake waits out the gather timeout, as with STUN unreachable.
    this.iceGatheringState = net.slowIce ? 'gathering' : 'complete';
  }
  createDataChannel(label: string) {
    const c = new FakeChannel(label, this.owner, this.net);
    this.channels.push(c);
    return c;
  }
  createOffer = async () => ({ type: 'offer' as const, sdp: this.id });
  createAnswer = async () => ({ type: 'answer' as const, sdp: this.id });
  async setLocalDescription(d: { sdp?: string }) {
    this.localDescription = { sdp: d.sdp! };
  }
  async setRemoteDescription(d: { type: 'offer' | 'answer'; sdp: string }) {
    if (d.type !== 'answer') return;
    const remote = this.net.pcs.get(d.sdp)!;
    setTimeout(() => {
      if (this.net.deadHangs && this.net.dead.has(remote.owner)) return;
      if (!this.net.route(this.owner, remote.owner)) {
        this.connectionState = 'failed';
        this.onconnectionstatechange?.();
        return;
      }
      for (const c of this.channels) {
        const twin = new FakeChannel(c.label, remote.owner, this.net);
        c.other = twin;
        twin.other = c;
        remote.channels.push(twin);
        remote.ondatachannel?.({ channel: twin });
      }
      for (const c of [...this.channels, ...remote.channels]) c.open();
    }, 20);
  }
  close() {
    this.connectionState = 'closed';
    for (const c of this.channels) c.close();
  }
}

export class DirectSignal implements SignalApi {
  calls = 0;
  polls = 0;
  constructor(
    private store: MemoryStore,
    private room: string,
    private peer: string,
    private world: World,
  ) {}
  private async call(op: Parameters<typeof handleOp>[0], extra: Record<string, unknown> = {}): Promise<any> {
    if (this.world.net.dead.has(this.peer) || this.world.apiDown || this.world.apiDownFor.has(this.peer)) throw new SignalError('network');
    this.calls++;
    const latency = this.world.apiLatencyFor.get(this.peer) ?? this.world.apiLatency;
    if (latency) await new Promise((r) => setTimeout(r, latency));
    return handleOp(op, { room: this.room, peer: this.peer, ...extra }, { store: this.store, ice: DEFAULT_ICE });
  }
  join = (since: number) => this.call('join', { since });
  beat = (since: number, host: boolean, list?: RoomListing | false) => this.call('beat', list === undefined ? { since, host } : { since, host, list });
  members = (): Promise<MemberInfo[]> => this.call('members').then((r) => r.members);
  gone = (peer: string, order: number): Promise<MemberInfo[]> => this.call('gone', { gone: peer, order }).then((r) => r.members);
  send = async (to: string, signal: Signal): Promise<boolean> => {
    if (this.world.lose(this.peer, to, signal)) return true; // the store took it and it vanished
    const r = await this.call('signal', { to, signal });
    const die = this.world.dieAfterAnswer;
    if (signal.k === 'answer' && (die === this.peer || die === `${this.peer}>${to}`)) this.world.crash(this.peer);
    return deliveredOrThrow(r);
  };
  poll = (): Promise<Mail[]> => {
    this.polls++;
    return this.call('poll').then((r) => r.mail);
  };
  leave(order: number, since: number, unlist = false) {
    void this.call('leave', unlist ? { order, since, unlist } : { order, since }).catch(() => {});
  }
}

export interface Peer {
  id: string;
  transport: WebRtcTransport;
  session: NetSession;
  signal: DirectSignal;
  status: string[];
  gone: boolean;
}

export class World {
  net = new FakeNet();
  store = new MemoryStore();
  apiDown = false;
  apiDownFor = new Set<string>();
  apiLatency = 0;
  apiLatencyFor = new Map<string, number>();
  /** `peer` crashes right after sending any answer; `peer>to`, right after answering `to`. */
  dieAfterAnswer = '';
  /** Handshake messages the store says it delivered but nobody ever reads. */
  lose: (from: string, to: string, s: Signal) => boolean = () => false;
  /** Most live peers ever hosting at once, sampled every tick: anything over 1 is a split brain. */
  maxHosts = 0;
  /** How long more than one live peer hosted. */
  splitMs = 0;
  /** Most live hosts ever advancing the sim at once (hosting and not paused): over 1 is a fork, not just a split. */
  maxRunning = 0;
  peers = new Map<string, Peer>();
  hidden = false;

  join(id: string, watch = false, opts: Partial<SessionOptions> = {}) {
    const signal = new DirectSignal(this.store, 'ROOM1', id, this);
    const transport = new WebRtcTransport('ROOM1', id, { signal, rtc: () => new FakePc(id, this.net), hidden: () => this.hidden });
    const status: string[] = [];
    const inner = transport.start.bind(transport);
    transport.start = (h) =>
      inner({
        ...h,
        status: (s, d) => {
          status.push(s);
          h.status(s, d);
        },
      });
    const session = new NetSession({ transport, match: new Match(roomSeed('TEST')), now: () => Date.now(), watch, ...opts });
    const p: Peer = { id, transport, session, signal, status, gone: false };
    this.peers.set(id, p);
    return p;
  }

  /** Crash: no goodbye of any kind, and its timers talk to nothing from now on. */
  crash(id: string) {
    this.net.dead.add(id);
    this.peers.get(id)!.gone = true;
  }

  leave(id: string) {
    const p = this.peers.get(id)!;
    p.session.close();
    p.gone = true;
  }

  /**
   * The page is gone without a word (a refresh whose goodbye never went out, a phone's tab killed) and its peer id
   * may come back with `join`: its links go silent and its timers stop, but the id itself stays usable.
   */
  vanish(id: string) {
    const p = this.peers.get(id)!;
    const t = p.transport as unknown as { closed: boolean; stopTimers(): void };
    t.closed = true;
    t.stopTimers();
    p.gone = true;
    const ghost = `${id}~${this.net.n}`;
    for (const pc of this.net.pcs.values()) {
      if (pc.owner !== id) continue;
      pc.owner = ghost;
      for (const ch of pc.channels) ch.owner = ghost;
    }
    this.net.dead.add(ghost);
    this.peers.delete(id);
  }

  async run(ms: number, inputs: (p: Peer) => Record<string, InputFrame> = () => ({})) {
    const ticks = Math.ceil(ms / TICK);
    for (let i = 0; i < ticks; i++) {
      await vi.advanceTimersByTimeAsync(TICK);
      for (const p of this.peers.values()) {
        if (p.gone) continue;
        p.session.tick(inputs(p));
        void p.session.view;
        p.session.drainEvents();
      }
      const hosts = [...this.peers.values()].filter((p) => !p.gone && p.session.isHost && p.session.status !== 'unavailable').length;
      this.maxHosts = Math.max(this.maxHosts, hosts);
      if (hosts > 1) this.splitMs += TICK;
      const running = [...this.peers.values()].filter((p) => !p.gone && p.session.isHost && !p.session.paused && p.session.status !== 'unavailable').length;
      this.maxRunning = Math.max(this.maxRunning, running);
    }
  }

  async runUntil(cond: () => boolean, ms: number, inputs?: (p: Peer) => Record<string, InputFrame>) {
    const start = Date.now();
    while (!cond() && Date.now() - start < ms) await this.run(100, inputs);
    return Date.now() - start;
  }

  /** Everyone who's left agrees on a host and is running. */
  settled() {
    const live = [...this.peers.values()].filter((p) => !p.gone);
    return (
      live.every((p) => p.session.status === 'online' && p.session.synced && !p.session.paused) &&
      new Set(live.map((p) => p.session.hostId)).size === 1 &&
      live.filter((p) => p.session.isHost).length === 1 &&
      // The session and its transport agree on who hosts.
      live.every((p) => p.session.hostId === (p.transport as unknown as { hostId: string }).hostId)
    );
  }

  liveHashes() {
    const live = [...this.peers.values()].filter((p) => !p.gone);
    const host = live.find((p) => p.session.isHost)!;
    host.session.flush();
    return live.map((p) => [p.session.match.frame, hashMatch(p.session.match)]);
  }

  /** Freeze the host and let guests drain, so state is comparable frame for frame. */
  async drained() {
    const live = [...this.peers.values()].filter((p) => !p.gone);
    const host = live.find((p) => p.session.isHost)!;
    const guests = live.filter((p) => p !== host);
    host.session.flush();
    for (let i = 0; i < 60; i++) {
      await vi.advanceTimersByTimeAsync(TICK);
      for (const g of guests) g.session.tick({});
    }
    return live.map((p) => `${p.session.match.frame}:${hashMatch(p.session.match)}`);
  }

  async room(...ids: string[]) {
    for (const id of ids) {
      this.join(id);
      await this.run(300);
    }
    await this.runUntil(() => this.settled() && [...this.peers.values()].every((p) => p.session.members.length === ids.length), 20_000);
    expect(this.settled()).toBe(true);
    this.maxHosts = 0;
    this.splitMs = 0;
    this.maxRunning = 0;
    return ids.map((id) => this.peers.get(id)!);
  }
}
