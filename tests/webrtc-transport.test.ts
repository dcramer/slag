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
import { Rng } from '../src/core/rng';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
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

  it.each(seeds(24, 2000))(
    'flaky guests: one alone never moves the room, only one host ever runs, and any split is over within 5 s (seed %i)',
    async (seed) => {
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
        // Caught up too: a guest whose silence was shorter than SILENCE_MS is still 'online' but frames behind.
        const caughtUp = peers.every((p) => p.gone || !host || host.session.match.frame - p.session.match.frame < 30);
        return w.settled() && !!host && !host.session.members.some((m) => m.linking) && caughtUp;
      };
      await w.runUntil(done, 30_000);
      expect(done()).toBe(true);
      // Two guests losing the host at once look exactly like the host dying, so the room may move then, but only once,
      // and the old host is frozen before the new one exists: two may think they host for a moment, never two play.
      expect(w.splitMs).toBeLessThan(5000);
      expect(w.maxRunning).toBe(1);
      expect(new Set(await w.drained()).size).toBe(1);
      if (flaky.length === 1 && !a.gone) {
        expect(a.session.isHost).toBe(true);
        expect(w.maxHosts).toBe(1);
      }
    },
  );
});
