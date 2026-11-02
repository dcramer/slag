import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOp } from '../app/api/net/_server/handlers';
import { MemoryStore } from '../app/api/net/_server/store';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { NetSession } from '../src/net/session';
import { installTelemetry } from '../src/telemetry';
import { SignalError, type SignalApi } from '../src/net/signal-client';
import { DEFAULT_ICE, type Mail, type MemberInfo, type Signal } from '../src/net/signal-protocol';
import { hashMatch } from '../src/net/snapshot';
import type { Member } from '../src/net/transport';
import { type RtcChannel, type RtcPeer, WebRtcTransport } from '../src/net/webrtc-transport';
import { Rng } from '../src/core/rng';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * The real transport, real handlers and real store, with only the two things
 * a test can't have swapped out: RTCPeerConnection (a fake network below) and
 * HTTP (a direct call into the handlers). Time is vitest's fake clock.
 */

const TICK = 1000 / 60;

class FakeNet {
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

class FakeChannel implements RtcChannel {
  readyState = 'connecting';
  bufferedAmount = 0;
  other: FakeChannel | null = null;
  onopen: any = null;
  onclose: any = null;
  onmessage: any = null;
  sent = 0;
  constructor(
    readonly label: string,
    readonly owner: string,
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
  }
}

class FakePc implements RtcPeer {
  connectionState = 'new';
  iceGatheringState: string;
  localDescription: { sdp: string } | null = null;
  onicegatheringstatechange: any = null;
  onconnectionstatechange: any = null;
  ondatachannel: any = null;
  channels: FakeChannel[] = [];
  id: string;
  constructor(
    readonly owner: string,
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

class DirectSignal implements SignalApi {
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
  beat = (host: boolean) => this.call('beat', { host });
  members = (): Promise<MemberInfo[]> => this.call('members').then((r) => r.members);
  gone = (peer: string, order: number): Promise<MemberInfo[]> => this.call('gone', { gone: peer, order }).then((r) => r.members);
  send = async (to: string, signal: Signal): Promise<boolean> => {
    if (this.world.lose(this.peer, to, signal)) return true; // the store took it and it vanished
    const r = await this.call('signal', { to, signal });
    const die = this.world.dieAfterAnswer;
    if (signal.k === 'answer' && (die === this.peer || die === `${this.peer}>${to}`)) this.world.crash(this.peer);
    return r.delivered;
  };
  poll = (): Promise<Mail[]> => {
    this.polls++;
    return this.call('poll').then((r) => r.mail);
  };
  leave(order: number, since: number) {
    void this.call('leave', { order, since }).catch(() => {});
  }
}

interface Peer {
  id: string;
  transport: WebRtcTransport;
  session: NetSession;
  signal: DirectSignal;
  status: string[];
  gone: boolean;
}

class World {
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
  peers = new Map<string, Peer>();
  hidden = false;

  join(id: string) {
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
    const session = new NetSession({ transport, match: new Match(roomSeed('TEST')), now: () => Date.now() });
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
    }
  }

  async runUntil(cond: () => boolean, ms: number) {
    const start = Date.now();
    while (!cond() && Date.now() - start < ms) await this.run(100);
    return Date.now() - start;
  }

  /** Everyone who's left agrees on a host and is running. */
  settled() {
    const live = [...this.peers.values()].filter((p) => !p.gone);
    return (
      live.every((p) => p.session.status === 'online' && p.session.synced && !p.session.paused) &&
      new Set(live.map((p) => p.session.hostId)).size === 1 &&
      live.filter((p) => p.session.isHost).length === 1
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
    return ids.map((id) => this.peers.get(id)!);
  }
}

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  it('the first peer hosts; later peers link to it and sync', async () => {
    const w = new World();
    const [a, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    expect(a.session.isHost).toBe(true);
    expect(b.session.hostId).toBe('aaaa');
    expect(c.session.hostId).toBe('aaaa');
    expect(a.session.members.map((m: Member) => m.id)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(c.session.members.map((m: Member) => m.id)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(await w.drained()).toSatisfy((h: string[]) => new Set(h).size === 1);
  });

  it('carries a snapshot too big for one data channel message, in pieces', async () => {
    const w = new World();
    const [a, b] = await w.room('aaaa', 'bbbb');
    const big = 'x'.repeat(50_000);
    const got: unknown[] = [];
    (a.session as any).onMessage = (_from: string, m: { blob?: string }) => m.blob && got.push(m);
    b.transport.send({ blob: big }, 'aaaa');
    await w.run(100);
    expect(got).toEqual([{ blob: big }]);
  });

  it('fails clearly when the API says online is not set up, and stays playable', async () => {
    const w = new World();
    const signal = new DirectSignal(w.store, 'ROOM1', 'aaaa', w);
    signal.join = () => Promise.reject(new SignalError('unconfigured'));
    const t = new WebRtcTransport('ROOM1', 'aaaa', { signal, rtc: () => new FakePc('aaaa', w.net) });
    const s = new NetSession({ transport: t, match: new Match(roomSeed('TEST')), now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(10);
    expect(s.status).toBe('unavailable');
    expect(s.detail).toBe('Online Not Set Up');
    const before = s.match.frame;
    s.tick({});
    expect(s.match.frame).toBe(before + 1);
    expect(signal.calls).toBe(0);
  });

  /** A session whose join takes `ms` to reach the store (a cold function), with its resume calls counted. */
  function slowJoiner(w: World, id: string, ms: number) {
    const signal = new DirectSignal(w.store, 'ROOM1', id, w);
    const join = signal.join;
    signal.join = async (since) => {
      await new Promise((r) => setTimeout(r, ms));
      return join(since);
    };
    const t = new WebRtcTransport('ROOM1', id, { signal, rtc: () => new FakePc(id, w.net) });
    const resumed = { n: 0 };
    const s = new NetSession({ transport: t, match: new Match(roomSeed('TEST')), now: () => Date.now(), resume: () => (resumed.n++, null) });
    return { s, resumed };
  }
  const inStore = async (w: World) =>
    ((await handleOp('members', { room: 'ROOM1', peer: 'zzzz' }, { store: w.store, ice: [] })) as { members: MemberInfo[] }).members.map((m) => m.id);

  it('leaves nothing in the store when the session closes while its join is on the way, and takes no host role on the way out', async () => {
    const w = new World();
    const { s, resumed } = slowJoiner(w, 'aaaa', 3000);
    await vi.advanceTimersByTimeAsync(100);
    s.close();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await inStore(w)).toEqual([]);
    expect(resumed.n).toBe(0);
    expect(s.status).toBe('offline');
    // A guest that leaves doesn't promote itself into its own empty room either.
    const [, b] = await w.room('bbbb', 'cccc');
    b.session.close();
    await w.run(500);
    expect(b.session.stats.migrations).toBe(0);
    expect(b.session.isHost).toBe(false);
  });

  it("keeps the newer session's seat when an older session of the same peer joins late and leaves", async () => {
    const w = new World();
    const old = slowJoiner(w, 'aaaa', 3000);
    await vi.advanceTimersByTimeAsync(100);
    old.s.close(); // the lobby remounted: a new session of this tab's peer starts straight away
    const [a] = await w.room('aaaa');
    await w.run(5000); // the old join lands after the new one, then the old session sends its leave
    expect(await inStore(w)).toEqual(['aaaa']);
    expect(a.session.isHost && a.session.status === 'online').toBe(true);
    w.leave('aaaa');
    await w.run(200);
    expect(await inStore(w)).toEqual([]);
  });

  it('turns a refused seat into a clear state', async () => {
    const w = new World();
    const signal = new DirectSignal(w.store, 'ROOM1', 'aaaa', w);
    signal.join = () => Promise.reject(new SignalError('full'));
    const t = new WebRtcTransport('ROOM1', 'aaaa', { signal, rtc: () => new FakePc('aaaa', w.net) });
    const s = new NetSession({ transport: t, match: new Match(roomSeed('TEST')), now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(10);
    expect(s.detail).toBe('Room Is Full');
  });

  it('reports a pair that cannot connect without evicting the healthy host', async () => {
    const w = new World();
    await w.room('aaaa');
    w.net.blocked.add('aaaa,bbbb');
    const b = w.join('bbbb');
    await w.runUntil(() => b.session.status === 'unavailable', 60_000);
    expect(b.session.status).toBe('unavailable');
    expect(b.session.detail).toBe('Cannot Reach Host');
    b.gone = true;
    const members = (await handleOp('members', { room: 'ROOM1', peer: 'aaaa' }, { store: w.store, ice: [] })) as { members: MemberInfo[] };
    expect(members.members.map((m) => m.id)).toEqual(['aaaa']);
    expect(w.peers.get('aaaa')!.session.isHost).toBe(true);
  });
});

describe('free tier budget', () => {
  it('stops signaling on guests once linked, leaving a low-rate heartbeat', async () => {
    const w = new World();
    const [, b] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    await w.run(35_000); // past the wake window
    const pollsBefore = b.signal.polls;
    const callsBefore = b.signal.calls;
    await w.run(60_000);
    expect(b.signal.polls).toBe(pollsBefore);
    expect(b.signal.calls - callsBefore).toBeLessThanOrEqual(3);
  });

  it('holds the documented commands per player per minute in a playing room', async () => {
    const w = new World();
    await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    await w.run(35_000);
    const before = w.store.count;
    await w.run(60_000);
    const perMinute = w.store.count - before;
    // docs/NETCODE.md: host 24/min, each guest 3/min.
    expect(perMinute).toBeLessThanOrEqual(24 + 3 * 3 + 2);
    expect(perMinute / 4).toBeLessThan(9);
  });

  it('backs a lone host off, and a hidden lone host leaves the room until shown', async () => {
    const w = new World();
    const [a] = await w.room('aaaa');
    w.hidden = true;
    await w.run(11 * 60_000);
    const before = w.store.count;
    await w.run(60_000);
    expect(w.store.count - before).toBe(0);
    w.hidden = false;
    a.transport.resume();
    await w.run(1000);
    const m = (await handleOp('members', { room: 'ROOM1', peer: 'aaaa' }, { store: w.store, ice: [] })) as { members: MemberInfo[] };
    expect(m.members.map((x) => x.id)).toEqual(['aaaa']);
    w.hidden = false;
  }, 60_000);

  it('survives the store going away while the game is linked', async () => {
    const w = new World();
    const [a, b] = await w.room('aaaa', 'bbbb');
    w.apiDown = true;
    await w.run(30_000);
    expect(a.session.status).toBe('online');
    expect(b.session.status).toBe('online');
    expect(a.session.paused).toBe(false);
  });
});

describe('host migration', () => {
  it('a silent crash: the next in order takes over fast and everyone resumes identically', async () => {
    const w = new World();
    const [, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    await w.run(1000);
    const t0 = Date.now();
    w.crash('aaaa');
    const took = await w.runUntil(() => w.settled(), 20_000);
    expect(w.settled()).toBe(true);
    expect(b.session.isHost).toBe(true);
    expect(c.session.hostId).toBe('bbbb');
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(took).toBeLessThan(8000);
    expect(w.maxHosts).toBe(1);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('wakes polling on guests the moment the host goes quiet', async () => {
    const w = new World();
    const [, b] = await w.room('aaaa', 'bbbb', 'cccc');
    await w.run(35_000);
    const before = b.signal.polls;
    w.crash('aaaa');
    await w.run(3500);
    expect(b.signal.polls).toBeGreaterThan(before);
  });

  it('a goodbye moves the room without waiting for silence', async () => {
    const w = new World();
    const [, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    w.leave('aaaa');
    const took = await w.runUntil(() => w.settled(), 10_000);
    expect(took).toBeLessThan(2500);
    expect(b.session.isHost).toBe(true);
    expect(c.session.hostId).toBe('bbbb');
  });

  it('the new host dying straight after taking over: the walk carries on to the next', async () => {
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.crash('aaaa');
    await w.runUntil(() => b.session.isHost, 10_000);
    w.crash('bbbb');
    await w.runUntil(() => w.settled(), 20_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(w.maxHosts).toBe(1);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a slow handshake is not a dead peer: everyone waits for the next in line', async () => {
    const w = new World();
    const [, , c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.net.slowIce = true;
    w.apiLatency = 600;
    w.crash('aaaa');
    await w.run(3500);
    w.crash('bbbb');
    await w.runUntil(() => w.settled(), 30_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(c.session.stats.migrations + d.session.stats.migrations).toBe(1);
    expect(w.maxHosts).toBe(1);
  });

  it.each([
    ['fails at once', false],
    ['hangs, as with a real crashed peer', true],
  ])('a new host dying between its answer and the link opening costs no more than one dying silently (handshake %s)', async (_, hangs) => {
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.net.deadHangs = hangs;
    w.dieAfterAnswer = 'bbbb';
    w.crash('aaaa');
    await w.runUntil(() => b.session.status === 'online' && w.peers.get('bbbb')!.gone, 12_000);
    expect(w.peers.get('bbbb')!.gone).toBe(true);
    const t0 = Date.now();
    await w.runUntil(() => w.settled(), 30_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(w.maxHosts).toBe(1);
  });

  it('a candidate still settling its own handshake is not presumed dead: no split brain after a double failure', async () => {
    // The online-test failure: B takes over and dies having linked D but only answered C. D notices the silence and offers
    // to C at once; C was still waiting out its handshake with B and couldn't answer, so D wrote C off and hosted, C hosted
    // too when its own wait ran out, and the store settled it 30 s later for the wrong peer.
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.net.deadHangs = true;
    w.apiLatencyFor.set('cccc', 1200); // a loaded machine: C's offer reaches B last, so D links first, and C is slow to settle
    w.dieAfterAnswer = 'bbbb>cccc';
    w.crash('aaaa');
    await w.runUntil(() => b.gone, 15_000);
    expect(b.gone).toBe(true);
    expect(d.transport['links'].has('bbbb')).toBe(true);
    const t0 = Date.now();
    await w.runUntil(() => w.settled(), 40_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(w.maxHosts).toBe(1);
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a lower peer leaving at the same moment: everyone still lands on one host', async () => {
    const w = new World();
    const [, , c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.crash('aaaa');
    w.crash('bbbb');
    await w.runUntil(() => w.settled(), 25_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(w.maxHosts).toBe(1);
  });

  it('a flaky guest does not move the room: the live host answers its re-offer', async () => {
    const w = new World();
    const [a, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    w.net.blocked.add('aaaa,cccc');
    await w.run(3000); // both ends go quiet
    w.net.blocked.delete('aaaa,cccc');
    await w.runUntil(() => w.settled() && a.session.members.length === 3, 15_000);
    expect(w.settled()).toBe(true);
    expect(a.session.isHost).toBe(true);
    expect(b.session.hostId).toBe('aaaa');
    expect(c.session.hostId).toBe('aaaa');
    expect(b.session.stats.migrations + c.session.stats.migrations).toBe(0);
  });

  it('a brief drop costs a guest nothing: not its seat, not its turn', async () => {
    const w = new World();
    const [a, b] = await w.room('aaaa', 'bbbb');
    await w.runUntil(() => a.session.match.players.length === 2, 5000);
    const before = a.session.match.players.map((p) => p.device);
    let lost = false;
    w.net.blocked.add('aaaa,bbbb');
    for (let i = 0; i < 40; i++) {
      await w.run(100);
      lost ||= a.session.match.players.length !== 2 || a.session.match.players.some((p) => p.away);
      if (i === 30) w.net.blocked.delete('aaaa,bbbb');
    }
    await w.runUntil(() => w.settled() && a.session.members.length === 2 && !a.session.members.some((m) => m.linking), 10_000);
    expect(lost).toBe(false);
    expect(a.session.match.players.map((p) => p.device)).toEqual(before);
    expect(b.session.hostId).toBe('aaaa');
  });

  it('a guest gone for good loses its seat once the grace is up, and a goodbye loses it at once', async () => {
    const w = new World();
    const [a] = await w.room('aaaa', 'bbbb', 'cccc');
    await w.runUntil(() => a.session.match.players.length === 3, 5000);
    w.leave('cccc');
    await w.run(600);
    expect(a.session.match.players).toHaveLength(2);
    w.crash('bbbb');
    await w.run(4000);
    expect(a.session.match.players).toHaveLength(2);
    await w.runUntil(() => a.session.match.players.length === 1, 10_000);
    expect(a.session.match.players).toHaveLength(1);
  });

  it('a host that was written off comes back as a guest, never a second host', async () => {
    const w = new World();
    const [a, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    // A's whole connection drops: no links, no API. The room moves on.
    w.net.dead.add('aaaa');
    await w.runUntil(() => b.session.isHost && c.session.hostId === 'bbbb', 15_000);
    w.net.dead.delete('aaaa');
    await w.runUntil(() => w.settled() && a.session.hostId === 'bbbb', 40_000);
    expect(a.session.isHost).toBe(false);
    expect(a.session.hostId).toBe('bbbb');
    expect(b.session.isHost).toBe(true);
    expect(w.settled()).toBe(true);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('two peers that both host: the store settles it for the lower order', async () => {
    const w = new World();
    const [, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    // B loses the API just as A dies. B hosts by the roster; C, getting no answer from B, writes it off and hosts too.
    w.apiDownFor.add('bbbb');
    w.crash('aaaa');
    await w.runUntil(() => b.session.isHost && c.session.isHost, 25_000);
    expect(b.session.isHost && c.session.isHost).toBe(true);
    w.apiDownFor.delete('bbbb');
    const took = await w.runUntil(() => w.settled() && !b.session.isHost, 60_000);
    expect(took).toBeLessThan(8000); // B checks the store as soon as its API is back, not at its next heartbeat
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(b.session.hostId).toBe('cccc');
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('two hosts with the store up: the one written off steps down within seconds, not a heartbeat later', async () => {
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.crash('aaaa');
    await w.runUntil(() => b.session.isHost, 10_000);
    // D's offers to C are lost, so C, still waiting out its own windows, can't answer: D writes it off and hosts.
    w.lose = (from, to, s) => from === 'dddd' && to === 'cccc' && s.k === 'offer';
    w.crash('bbbb');
    await w.runUntil(() => c.session.isHost && d.session.isHost, 30_000);
    expect(c.session.isHost && d.session.isHost).toBe(true);
    w.lose = () => false;
    const took = await w.runUntil(() => w.settled() && w.peers.get('cccc')!.session.members.length === 2, 30_000);
    expect(w.settled()).toBe(true);
    expect(took).toBeLessThan(4000);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a pair that cannot connect during a migration drops out with a clear state, and the room carries on', async () => {
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.net.blocked.add('bbbb,cccc');
    w.crash('aaaa');
    await w.runUntil(() => c.session.status === 'unavailable', 60_000);
    expect(c.session.detail).toBe('Cannot Reach Host');
    c.gone = true;
    await w.runUntil(() => w.settled(), 20_000);
    expect(b.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('bbbb');
  });

  it('reports one host-migration event per migration, by the new host, without player names', async () => {
    const events: [string, string, Record<string, unknown> | undefined][] = [];
    installTelemetry({ error() {}, breadcrumb() {}, event: (name, level, data) => events.push([name, level, data]) });
    try {
      const w = new World();
      const [, b] = await w.room('aaaa', 'bbbb', 'cccc');
      w.crash('aaaa');
      await w.runUntil(() => w.settled(), 20_000);
      const migrations = events.filter(([name]) => name === 'host-migration');
      expect(migrations).toHaveLength(1);
      expect(migrations[0][1]).toBe('warning');
      expect(migrations[0][2]).toMatchObject({ from: 'aaaa', to: 'bbbb', frame: b.session.match.frame > 0 ? expect.any(Number) : 0 });
    } finally {
      installTelemetry(null);
    }
  });

  it('resumes from the furthest frame anyone holds, so nothing that happened is undone', async () => {
    const w = new World();
    const [a, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    const seats = (p: Peer) => ({ kb1: press({ confirmPressed: p.session.match.players.every((q) => q.device !== `${p.id}:kb1`) }) });
    await w.run(1000, seats);
    await w.run(1000);
    // C alone receives the host's last frames (B's link is cut first).
    w.net.blocked.add('aaaa,bbbb');
    await w.run(400);
    const bFrame = b.session.match.frame;
    const cFrame = c.session.match.frame;
    expect(cFrame).toBeGreaterThan(bFrame);
    w.crash('aaaa');
    await w.runUntil(() => w.settled(), 20_000);
    expect(b.session.isHost).toBe(true);
    expect(b.session.match.frame).toBeGreaterThanOrEqual(cFrame);
    expect(new Set(await w.drained()).size).toBe(1);
    expect(a.gone).toBe(true);
  });
});

describe('election under varied timing', () => {
  // Seeded runs over the knobs that decide who hears what when: API latency per peer, whether a dead peer's handshake
  // fails or hangs, when the second host dies (before, while or after answering). Each seed is one deterministic room.
  const seeds = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i);

  it.each(seeds(32, 1000))('a double failure lands on the third peer, never two hosts, within 10 s (seed %i)', async (seed) => {
    const r = new Rng(seed);
    const w = new World();
    const [, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    w.net.deadHangs = r.chance(0.6);
    for (const id of ['bbbb', 'cccc', 'dddd']) if (r.chance(0.5)) w.apiLatencyFor.set(id, r.int(0, 900));
    const mode = r.next();
    if (mode < 0.3) w.dieAfterAnswer = 'bbbb';
    else if (mode < 0.5) w.dieAfterAnswer = r.chance(0.5) ? 'bbbb>cccc' : 'bbbb>dddd';
    const together = mode > 0.9;
    const after = r.int(0, 2500);
    w.crash('aaaa');
    if (together) w.crash('bbbb');
    await w.runUntil(() => b.gone || b.session.isHost, 15_000);
    if (!b.gone) {
      await w.run(after);
      w.crash('bbbb');
    }
    const t0 = Date.now();
    await w.runUntil(() => w.settled(), 40_000);
    expect(w.settled()).toBe(true);
    expect(c.session.isHost).toBe(true);
    expect(d.session.hostId).toBe('cccc');
    expect(w.maxHosts).toBe(1);
    expect(Date.now() - t0).toBeLessThan(together ? 15_000 : 10_000);
  });

  it.each(seeds(24, 2000))('flaky guests: one alone never moves the room, and any split is over within 5 s (seed %i)', async (seed) => {
    const r = new Rng(seed);
    const w = new World();
    const ids = ['aaaa', 'bbbb', 'cccc', 'dddd'];
    const peers = await w.room(...ids);
    const a = peers[0];
    for (const id of ids) if (r.chance(0.5)) w.apiLatencyFor.set(id, r.int(0, 900));
    let flaky = ids.slice(1).filter(() => r.chance(0.4));
    if (!flaky.length) flaky = [ids[r.int(1, 3)]];
    const pairs = flaky.map((f) => ['aaaa', f].sort().join());
    for (const p of pairs) w.net.blocked.add(p);
    await w.run(r.int(2000, 4000));
    for (const p of pairs) w.net.blocked.delete(p);
    // A guest whose handshakes with the host keep failing drops to local play by design ('Cannot Reach Host'): it's out.
    const done = () => {
      for (const p of peers) if (p.session.status === 'unavailable') p.gone = true;
      const host = peers.find((p) => !p.gone && p.session.isHost);
      return w.settled() && !!host && !host.session.members.some((m) => m.linking);
    };
    await w.runUntil(done, 30_000);
    expect(done()).toBe(true);
    // Two guests losing the host at once look exactly like the host dying, so the room may move then, but only once.
    expect(w.splitMs).toBeLessThan(5000);
    if (flaky.length === 1 && !a.gone) {
      expect(a.session.isHost).toBe(true);
      expect(w.maxHosts).toBe(1);
    }
  });
});
