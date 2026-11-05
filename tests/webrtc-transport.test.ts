import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOp } from '../app/api/net/_server/handlers';
import { Match } from '../src/game/match';
import type { MatchRules } from '../src/game/rules';
import { roomSeed } from '../src/game/room';
import { NetSession } from '../src/net/session';
import { installTelemetry } from '../src/telemetry';
import { SignalError } from '../src/net/signal-client';
import { LIST_TTL_S, type ListedRoom, type MemberInfo } from '../src/net/signal-protocol';
import type { Member } from '../src/net/transport';
import { WebRtcTransport } from '../src/net/webrtc-transport';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { doubleFailure, electionSeeds, flakyGuests } from './lib/election';
import { DirectSignal, FakePc, type Peer, World } from './lib/net-world';

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
    (a.session as any).onWire = (_from: string, m: { blob?: string }) => m.blob && got.push(m);
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
    const perMinute = async (rules: Partial<MatchRules>) => {
      const w = new World();
      const [a] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
      a.session.act({ t: 'rules', rules: { ...a.session.match.rules, ...rules } });
      await w.run(35_000);
      const before = w.store.count;
      await w.run(60_000);
      return w.store.count - before;
    };
    // docs/NETCODE.md: host 21/min, each guest 3/min; listing the room is 3 more a beat, 9 a minute.
    const hidden = await perMinute({ private: true });
    const listed = await perMinute({});
    expect(hidden).toBeLessThanOrEqual(21 + 3 * 3 + 2);
    expect(listed - hidden).toBe(9);
    expect(listed / 4).toBeLessThan(11);
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

describe('lobby list', () => {
  const nameOf = (p: Peer) => p.session.match.players.find((q) => q.device.startsWith(`${p.id}:`))!.character.name;
  const listed = async (w: World): Promise<ListedRoom | undefined> =>
    ((await handleOp('lobbies', {}, { store: w.store, ice: [] })) as { rooms: ListedRoom[] }).rooms.find((r) => r.room === 'ROOM1');

  it('lists a room as soon as it has a host, with its seats, watchers, theme and phase', async () => {
    const w = new World();
    const [a] = await w.room('aaaa');
    await w.run(600);
    expect(await listed(w)).toEqual({
      room: 'ROOM1',
      players: 1,
      max: 8,
      observers: 0,
      theme: a.session.match.level.theme.id,
      phase: 'lobby',
      host: nameOf(a),
    });
    // A player and a watcher arriving show within the nudge, not a beat later; only the host writes the list.
    w.join('bbbb');
    w.join('cccc', true);
    await w.run(7000);
    expect(await listed(w)).toMatchObject({ players: 2, observers: 1 });
    expect(w.peers.get('bbbb')!.signal.calls).toBeLessThan(a.signal.calls);
  });

  it("lists the room again within the nudge when the host's name changes", async () => {
    const w = new World();
    const [a] = await w.room('aaaa', 'bbbb');
    await w.run(6000);
    const dev = a.session.match.players.find((p) => p.device.startsWith('aaaa:'))!.device;
    a.session.act({ t: 'name', dev, name: 'Grimble' });
    await w.run(6000);
    expect(await listed(w)).toMatchObject({ host: 'Grimble' });
  });

  it('takes a room off at once when the host makes it Private, and back when it is public again', async () => {
    const w = new World();
    const [a] = await w.room('aaaa', 'bbbb');
    a.session.act({ t: 'rules', rules: { ...a.session.match.rules, private: true } });
    await w.run(1500);
    expect(await listed(w)).toBeUndefined();
    // Private beats never list it, however long the room lives.
    await w.run(45_000);
    expect(await listed(w)).toBeUndefined();
    a.session.act({ t: 'rules', rules: { ...a.session.match.rules, private: false } });
    await w.run(1500);
    expect(await listed(w)).toMatchObject({ players: 2 });
  });

  it('the next host lists the room when one leaves, and the last one out takes it off with its goodbye', async () => {
    const w = new World();
    const [a, b] = await w.room('aaaa', 'bbbb');
    await w.run(6000);
    expect(await listed(w)).toMatchObject({ players: 2, host: nameOf(a) });
    w.leave('aaaa');
    await w.runUntil(() => w.settled(), 20_000);
    await w.run(6000);
    // Listed under whoever hosts now.
    expect(nameOf(b)).not.toBe(nameOf(a));
    expect(await listed(w)).toMatchObject({ players: 1, host: nameOf(b) });
    w.leave('bbbb');
    await w.run(100);
    expect(await listed(w)).toBeUndefined();
  });

  it('a room whose host crashed alone falls off by itself', async () => {
    const w = new World();
    await w.room('aaaa');
    await w.run(600);
    expect(await listed(w)).toBeDefined();
    w.crash('aaaa');
    await w.run((LIST_TTL_S + 1) * 1000);
    expect(await listed(w)).toBeUndefined();
    expect(w.store.immortalKeys()).toEqual([]);
  }, 30_000);
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

  it('an observer steps behind the players in line: losing the host skips it, and a host who starts watching hands the room on', async () => {
    const w = new World();
    for (const [id, watch] of [
      ['aaaa', false],
      ['oooo', true],
      ['bbbb', false],
      ['cccc', false],
    ] as const) {
      w.join(id, watch);
      await w.run(300);
    }
    const [a, o, b, c] = ['aaaa', 'oooo', 'bbbb', 'cccc'].map((id) => w.peers.get(id)!);
    const order = (p: Peer, id: string) => p.session.members.find((m: Member) => m.id === id)?.order ?? -1;
    await w.runUntil(() => w.settled() && order(a, 'oooo') > order(a, 'cccc') && order(c, 'oooo') > order(c, 'cccc'), 40_000);
    expect(order(a, 'oooo')).toBeGreaterThan(order(a, 'cccc'));
    expect(o.session.seated).toBe(false);
    w.crash('aaaa');
    await w.runUntil(() => w.settled(), 20_000);
    expect(b.session.isHost).toBe(true);
    expect(w.maxHosts).toBe(1);
    b.session.watch();
    await w.runUntil(() => w.settled() && c.session.isHost, 40_000);
    expect(c.session.isHost).toBe(true);
    expect([o, b].every((p) => p.session.hostId === 'cccc' && !p.session.seated)).toBe(true);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a host who starts watching hands the room to a live guest, never to one that crashed and the store still lists', async () => {
    const w = new World();
    const [a, d, b, c] = await w.room('aaaa', 'dddd', 'bbbb', 'cccc');
    // A phone killed in the background: no goodbye, so the store lists it until its liveness runs out (50 s).
    w.crash('dddd');
    await w.run(12_000);
    expect(a.session.members.some((m: Member) => m.id === 'dddd')).toBe(false);
    a.session.watch();
    const took = await w.runUntil(() => w.settled() && b.session.isHost && !a.session.seated, 30_000);
    expect(b.session.isHost).toBe(true);
    expect([a, c].every((p) => p.session.hostId === 'bbbb')).toBe(true);
    expect(took).toBeLessThan(6000);
    expect(w.maxRunning).toBe(1);
    expect(d.gone).toBe(true);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a new host never hands the room to a guest that crashed earlier and the store still lists', async () => {
    const w = new World();
    const [a, d, b, c] = await w.room('aaaa', 'dddd', 'bbbb', 'cccc');
    w.crash('dddd');
    await w.run(12_000);
    expect(a.session.members.some((m: Member) => m.id === 'dddd')).toBe(false);
    w.crash('aaaa');
    await w.runUntil(() => w.settled(), 20_000);
    // Past the new host's rival checks: it stays put.
    await w.run(15_000);
    expect(w.settled()).toBe(true);
    expect(b.session.isHost).toBe(true);
    expect(c.session.hostId).toBe('bbbb');
    expect(b.session.stats.migrations).toBe(1);
    expect(d.gone && w.maxHosts === 1).toBe(true);
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

  it('two guests losing a live host at once: the host freezes first, so only one host ever runs and nothing forks', async () => {
    const w = new World();
    const [a, b] = await w.room('aaaa', 'bbbb', 'cccc');
    const walk = () => ({ kb1: press({ right: true, confirmPressed: true }) });
    await w.runUntil(() => a.session.match.players.length === 3, 5000);
    await w.run(1000, walk);
    // Both of the host's links go silent together: from either guest it looks exactly like the host dying.
    w.net.blocked.add('aaaa,bbbb');
    w.net.blocked.add('aaaa,cccc');
    const frozenAt: number[] = [];
    for (let i = 0; i < 40 && !b.session.isHost; i++) {
      await w.run(100, walk);
      if (a.session.paused && !frozenAt.length) frozenAt.push(Date.now());
    }
    expect(b.session.isHost).toBe(true); // C's offer was B's proof: the room moved
    expect(frozenAt.length).toBe(1); // ...but A froze before then, and stays frozen
    w.net.blocked.clear();
    await w.runUntil(() => w.settled() && b.session.members.length === 3, 30_000, walk);
    expect(w.settled()).toBe(true);
    expect(a.session.hostId).toBe('bbbb');
    expect(w.maxHosts).toBe(2);
    expect(w.maxRunning).toBe(1);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a peer that loses the API as the host dies never hosts blind: the next in line hosts, and it joins once back', async () => {
    const w = new World();
    const [, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    // B loses the API just as A dies. It can't offer anyone (its offers never reach the store), so it proves nothing
    // and waits; C, getting no answer from B, writes it off and hosts.
    w.apiDownFor.add('bbbb');
    w.crash('aaaa');
    await w.runUntil(() => c.session.isHost && !c.session.paused, 25_000);
    expect(c.session.isHost).toBe(true);
    expect(b.session.isHost).toBe(false);
    w.apiDownFor.delete('bbbb');
    const took = await w.runUntil(() => w.settled() && c.session.members.length === 2, 60_000);
    expect(took).toBeLessThan(8000);
    expect(w.settled()).toBe(true);
    expect(b.session.hostId).toBe('cccc');
    expect(w.maxHosts).toBe(1);
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

  it('logs one host migration per migration, by the new host, timed and without player names', async () => {
    const logs: [string, string, Record<string, unknown> | undefined][] = [];
    const events: string[] = [];
    installTelemetry({ error() {}, breadcrumb() {}, event: (name) => events.push(name), log: (level, message, data) => logs.push([message, level, data]) });
    try {
      const w = new World();
      const [, b] = await w.room('aaaa', 'bbbb', 'cccc');
      w.crash('aaaa');
      await w.runUntil(() => w.settled(), 20_000);
      const migrations = logs.filter(([message]) => message === 'host migration');
      expect(migrations).toHaveLength(1);
      expect(migrations[0][2]).toMatchObject({ from: 'aaaa', to: 'bbbb', peers: 2, phase: b.session.match.phase });
      // Its clock runs from noticing the host gone to the room playing again: not zero, and well under the slow mark.
      const ms = migrations[0][2]!.ms as number;
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(20_000);
      expect(events).not.toContain('slow-host-migration');
      for (const [, , data] of logs) for (const v of Object.values(data ?? {})) expect(String(v)).not.toMatch(/[a-z]+ [a-z]+/i);
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

/** Peek at the transport's private state, for timing a case to the moment it has a handshake open or a guest in grace. */
const inner = (p: Peer) => p.transport as unknown as { inbound: Map<string, unknown>; frame(l: unknown, text: string): void };

describe('handing the room on', () => {
  it('a host stepping back while a newcomer is still linking hands it on cleanly, newcomer included', async () => {
    const w = new World();
    const [a] = await w.room('aaaa', 'bbbb');
    await w.run(2000);
    const n = w.join('nnnn');
    for (let i = 0; i < 2000 && inner(a).inbound.size === 0; i++) await vi.advanceTimersByTimeAsync(2);
    expect(inner(a).inbound.size).toBe(1);
    a.transport.reorder();
    const took = await w.runUntil(() => w.settled() && n.session.hostId === 'bbbb' && a.session.hostId === 'bbbb', 30_000);
    expect(took).toBeLessThan(4000);
    expect(w.maxRunning).toBe(1);
  });

  it('a host stepping back while the guest next in line is in its grace never leaves two hosts', async () => {
    const w = new World();
    const [a, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    await w.run(2000);
    w.net.dead.add('bbbb'); // B's network drops out for a moment
    await w.runUntil(() => a.session.members.find((m: Member) => m.id === 'bbbb')?.linking === true, 5000);
    a.transport.reorder();
    await w.run(1000);
    w.net.dead.delete('bbbb');
    await w.runUntil(() => w.settled() && [a, b, c, d].every((p) => p.session.members.length === 4), 30_000);
    await w.run(20_000);
    expect(w.settled()).toBe(true);
    expect(b.session.isHost).toBe(true);
    expect(w.maxRunning).toBe(1);
    expect(new Set(await w.drained()).size).toBe(1);
  });

  it('a lost handover frame: the old host offering to the next in line is a handover, not proof it died', async () => {
    const w = new World();
    const [a, b, c, d] = await w.room('aaaa', 'bbbb', 'cccc', 'dddd');
    await w.run(2000);
    // The `m` frame dies with the links (a real pc.close() can drop what it hasn't sent): guests only see the close.
    const frame = inner(a).frame.bind(a.transport);
    inner(a).frame = (l, text) => (text[0] === 'm' ? undefined : frame(l, text));
    a.transport.reorder();
    const took = await w.runUntil(() => w.settled() && b.session.isHost && [a, c, d].every((p) => p.session.hostId === 'bbbb'), 30_000);
    expect(took).toBeLessThan(6000);
    expect(w.maxRunning).toBe(1);
    expect(b.session.stats.migrations).toBe(1);
  });

  it('a newcomer whose join lands just before the host steps back is sent on, not left to time out', async () => {
    const w = new World();
    const [a] = await w.room('aaaa', 'bbbb');
    await w.run(2000);
    const n = w.join('nnnn');
    await vi.advanceTimersByTimeAsync(1);
    a.transport.reorder();
    const took = await w.runUntil(() => w.settled() && n.session.hostId === 'bbbb' && a.session.hostId === 'bbbb', 30_000);
    expect(took).toBeLessThan(5000);
  });

  it('a host stepping back as its API fails never writes off the next in line, or hosts alone', async () => {
    const w = new World();
    const [a, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    await w.run(2000);
    a.transport.reorder();
    await vi.advanceTimersByTimeAsync(1);
    w.apiDownFor.add('aaaa');
    await w.run(25_000);
    w.apiDownFor.delete('aaaa');
    await w.runUntil(() => w.settled() && [a, b, c].every((p) => p.session.members.length === 3), 40_000);
    expect(w.settled()).toBe(true);
    expect(b.session.isHost).toBe(true);
    expect(w.maxRunning).toBe(1);
  });

  it("the host's page vanishes and its id comes straight back: one migration, and it rejoins as a guest", async () => {
    const w = new World();
    const [, b, c] = await w.room('aaaa', 'bbbb', 'cccc');
    await w.run(2000);
    w.vanish('aaaa');
    await w.run(300);
    const a = w.join('aaaa');
    await w.runUntil(() => w.settled() && b.session.members.length === 3, 30_000);
    await w.run(30_000);
    expect(w.settled()).toBe(true);
    expect(b.session.isHost).toBe(true);
    expect(a.session.hostId).toBe('bbbb');
    expect(b.session.stats.migrations + c.session.stats.migrations + a.session.stats.migrations).toBe(1);
  });
});

describe('a guest the store forgot', () => {
  // A phone asleep past its liveness (50 s): the store forgot it, and its link to the host is dead too. Its re-offer
  // can't be delivered because of *it*, not the host: it rejoins, and never writes off the host or hosts a fork.
  it.each([
    ['alone with the host', ['aaaa', 'bbbb'], 0],
    ['with another guest, over a slow API', ['aaaa', 'bbbb', 'cccc'], 150],
  ] as const)('%s: it rejoins under the same host', async (_label, ids, latency) => {
    const w = new World();
    const peers = await w.room(...ids);
    const [a] = peers;
    const g = peers.at(-1)!;
    w.apiLatency = latency;
    await w.store.run([['DEL', `slag:ROOM1:p:${g.id}`]]);
    w.net.blocked.add(['aaaa', g.id].join());
    await w.run(3000);
    w.net.blocked.delete(['aaaa', g.id].join());
    await w.runUntil(() => w.settled() && a.session.members.length === ids.length, 30_000);
    expect(w.settled()).toBe(true);
    expect(a.session.isHost).toBe(true);
    expect(g.session.stats.migrations).toBe(0);
    expect(w.maxHosts).toBe(1);
  });
});

describe('one peer id in two tabs', () => {
  // A hidden tab's timers can stall past its lease on the peer id (identity.ts), so a second tab opened on the same
  // link takes the id. The store keeps the newer session; the older tab must stop, not share a mailbox and seat with it.
  it.each([
    ['a guest', 'bbbb'],
    ['the host', 'aaaa'],
  ] as const)('the older tab, %s, stops and the newer one plays on in its place', async (_label, id) => {
    const w = new World();
    await w.room('aaaa', 'bbbb', 'cccc');
    const old = w.peers.get(id)!;
    w.peers.delete(id);
    w.peers.set(`${id}-old`, old);
    w.maxHosts = 0;
    const fresh = w.join(id);
    await w.runUntil(
      () =>
        old.session.status === 'unavailable' &&
        w.peers.size === 4 &&
        (() => {
          old.gone = true;
          return w.settled() && fresh.session.members.length === 3;
        })(),
      60_000,
    );
    expect(old.session.status).toBe('unavailable');
    expect(old.session.detail).toBe('Open In Another Tab');
    old.gone = true;
    expect(w.settled()).toBe(true);
    expect(fresh.session.members.map((m) => m.id).sort()).toEqual(['aaaa', 'bbbb', 'cccc']);
  });
});

describe('election under varied timing', () => {
  // A few seeded rooms on every check; tests/stats/election.test.ts runs 32 and 24 of them.
  it.each(electionSeeds(6, 1000))('a double failure lands on the third peer, never two hosts, within 10 s (seed %i)', doubleFailure);
  it.each(electionSeeds(4, 2000))(
    'flaky guests: one alone never moves the room, only one host ever runs, and any split is over within 5 s (seed %i)',
    flakyGuests,
  );
});
