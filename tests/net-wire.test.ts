import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/game/rules';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { generateCharacter } from '../src/gen/character';
import { ACTION_AUTH, deviceId, localOf, type NetAction, newNetState, peerOf } from '../src/net/actions';
import { ACTS_PER_TICK, NetSession } from '../src/net/session';
import { MAX_PEERS } from '../src/net/signal-protocol';
import { hashMatch, snapshotMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { ACTS_PER_MSG, BUNDLES_PER_MSG, FRAMES_PER_MSG, parseAction, parseMsg } from '../src/net/wire';

const TICK = 1000 / 60;

/** One of every action, as a well-behaved peer sends it. The mapped type won't compile without a new action's. */
const SAMPLES: { [K in NetAction['t']]: Extract<NetAction, { t: K }> } = {
  join: { t: 'join', dev: 'cccc:kb1', char: generateCharacter(7) },
  leave: { t: 'leave', dev: 'aaaa:kb1' },
  away: { t: 'away', dev: 'aaaa:kb1', on: true },
  name: { t: 'name', dev: 'aaaa:kb1', name: 'Dot' },
  look: { t: 'look', dev: 'aaaa:kb1', seed: 99, color: 2 },
  color: { t: 'color', dev: 'aaaa:kb1', color: 3 },
  bot: { t: 'bot', dev: 'aaaa:bot1', level: 'hard' },
  adopt: { t: 'adopt', dev: 'aaaa:bot1', to: deviceId('gggg', 'bot1') },
  salt: { t: 'salt', salt: 12345 },
  start: { t: 'start' },
  rules: { t: 'rules', rules: { ...DEFAULT_RULES, pickSeconds: 20 } },
  level: { t: 'level', seed: 777, theme: 'glacier' },
  kick: { t: 'kick', peer: 'aaaa', client: 'c1', until: 600 },
  watch: { t: 'watch', dev: 'aaaa:kb1', on: true, name: 'Dot' },
  seat: { t: 'seat', dev: 'aaaa:kb1', on: true },
};
const ALL = Object.values(SAMPLES) as NetAction[];
const wire = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
/** One snapshot for every message that carries one: building a Match is most of what these tests cost. */
let snapCache: ReturnType<typeof snapshotMatch> | undefined;
const snap = () => (snapCache ??= snapshotMatch(new Match(roomSeed('TEST'))));

describe('device ids', () => {
  it('split back into the peer and the local device they were built from', () => {
    const d = deviceId('k3j9x2ab', 'kb1');
    expect(d).toBe('k3j9x2ab:kb1');
    expect([peerOf(d), localOf(d)]).toEqual(['k3j9x2ab', 'kb1']);
    expect([peerOf('kb1'), localOf('kb1')]).toEqual(['', 'kb1']);
  });
});

describe('parseAction', () => {
  it('takes back every action a peer sends, unchanged', () => {
    for (const a of ALL) expect(parseAction(wire(a))).toEqual(a);
  });

  it('refuses an unknown type, a missing field and a field of the wrong type', () => {
    expect(parseAction({ t: 'teleport', dev: 'aaaa:kb1' })).toBeNull();
    expect(parseAction({ t: 'toString' })).toBeNull();
    expect(parseAction({ t: '__proto__' })).toBeNull();
    expect(parseAction(null)).toBeNull();
    expect(parseAction('join')).toBeNull();
    expect(parseAction([SAMPLES.join])).toBeNull();
    for (const a of ALL) {
      for (const k of Object.keys(a)) {
        if (k === 't') continue;
        const broken: Record<string, unknown> = { ...(wire(a) as object) };
        broken[k] = [1];
        expect(parseAction(broken), `${a.t}.${k} as an array`).toBeNull();
      }
    }
    const { dev: _, ...noDev } = SAMPLES.name;
    expect(parseAction(noDev)).toBeNull();
    expect(parseAction({ ...SAMPLES.look, seed: 1.5 })).toBeNull();
    expect(parseAction({ ...SAMPLES.level, theme: 'atlantis' })).toBeNull();
    expect(parseAction({ ...SAMPLES.bot, level: 'godlike' })).toBeNull();
    expect(parseAction({ ...SAMPLES.adopt, to: 'nocolon' })).toBeNull();
    expect(parseAction({ ...SAMPLES.adopt, to: ':bot1' })).toBeNull();
    expect(parseAction({ ...SAMPLES.watch, afk: 'yes' })).toBeNull();
    expect(parseAction({ ...SAMPLES.kick, until: null })).toBeNull();
    expect(parseAction({ ...SAMPLES.join, char: { ...generateCharacter(7), kind: 'nonesuch' } })).toBeNull();
    expect(parseAction({ ...SAMPLES.name, dev: 'x'.repeat(1000) })).toBeNull();
  });

  it('drops fields it does not know, so a relayed action carries nothing extra', () => {
    expect(parseAction({ ...SAMPLES.seat, smuggled: { huge: 'x'.repeat(100) } })).toEqual(SAMPLES.seat);
  });
});

/** A real host's messages, as they cross the wire. */
function hostTraffic(): unknown[] {
  const hub = new LoopbackHub({ latency: 20 });
  const a = new NetSession({ transport: hub.transport('aaaa'), match: new Match(roomSeed('TEST')), now: () => hub.now });
  const seen: unknown[] = [];
  hub.transport('zzzz').start({ status() {}, members() {}, message: (_f, d) => seen.push(d) });
  for (let i = 0; i < 200; i++) {
    hub.advance(TICK);
    a.tick({});
  }
  return seen;
}

describe('parseMsg', () => {
  it('takes back every kind of message a session sends', () => {
    const ns = { ...newNetState(), watching: { bbbb: { name: 'Bo', afk: true as const } }, queue: [{ peer: 'cccc', dev: 'cccc:kb1' }] };
    const msgs = [
      { t: 'in', s: 1_700_000_000_000, f: [{ kb1: 1 }, {}, { kb1: [65, 10.5, 20] }], a: ALL.map((a, i) => [1_700_000_000_000 + i, a]), c: 30, h: [60, 123456] },
      { t: 'b', b: [{ f: 10, i: { 'aaaa:kb1': 3 }, a: [SAMPLES.salt], k: { bbbb: [5, 6] } }, { f: 11 }] },
      { t: 'sync', s: snap(), k: { bbbb: [1, 2] }, ns, last: { 'aaaa:kb1': 1 }, why: 'hello' },
      { t: 'hello', f: -1, c: 'client1' },
      { t: 'hello', f: 40 },
      { t: 'need', f: 12 },
      { t: 'pull' },
      { t: 'state', s: snap(), k: {}, ns: newNetState(), last: {} },
      { t: 'ping', ts: 12.5 },
      { t: 'pong', ts: 12.5 },
      { t: 'pings', p: { bbbb: 40 } },
      { t: 'kicked', left: 1000 },
      { t: 'kicked' },
    ];
    for (const m of msgs) expect(parseMsg(wire(m)), (m as { t: string }).t).toEqual(wire(m));
    const real = hostTraffic();
    expect(real.length).toBeGreaterThan(10);
    for (const m of real) expect(parseMsg(m)).toEqual(m);
  });

  it('refuses wrong types, missing fields, oversized arrays and unknown types', () => {
    const bad: unknown[] = [
      null,
      42,
      'in',
      [],
      {},
      { t: 'nope' },
      { t: 'constructor' },
      { t: 'hasOwnProperty' },
      // Wrong types: each of these used to reach the session as it came.
      { t: 'in', s: 1, f: 'not frames', c: 0 },
      { t: 'in', s: 1, f: { 0: { kb1: 1 } }, c: 0 },
      { t: 'in', s: '1', f: [], c: 0 },
      { t: 'in', s: 1, f: [{ kb1: 'jump' }], c: 0 },
      { t: 'in', s: 1, f: [{ kb1: [1, 2] }], c: 0 },
      { t: 'in', s: 1, f: [{ 'bbbb:kb1': 1 }], c: 0 },
      { t: 'in', s: 1, f: [], c: 0, a: [[2, { t: 'name', dev: 'x:kb1', name: 7 }]] },
      { t: 'in', s: 1, f: [], c: 0, a: [{ t: 'seat' }] },
      { t: 'in', s: 1, f: [], c: 0, h: 'hash' },
      { t: 'b', b: [{ f: 'ten' }] },
      { t: 'b', b: [{ f: 1, a: [{ t: 'kick' }] }] },
      { t: 'b', b: [{ f: 1, k: { bbbb: [1] } }] },
      { t: 'hello', f: 'far' },
      { t: 'hello', f: 1, c: 5 },
      { t: 'pings', p: { bbbb: 'fast' } },
      { t: 'kicked', left: 'soon' },
      { t: 'ping', ts: null },
      // Missing fields.
      { t: 'in', f: [], c: 0 },
      { t: 'b' },
      { t: 'need' },
      { t: 'pong' },
      { t: 'sync', s: snap(), k: {}, last: {}, why: 'x' },
      { t: 'sync', k: {}, ns: newNetState(), last: {}, why: 'x' },
      { t: 'sync', s: snap(), k: {}, ns: { ...newNetState(), queue: undefined }, last: {}, why: 'x' },
      { t: 'state', s: { frame: 1 }, k: {}, ns: newNetState(), last: {} },
      // Oversized.
      { t: 'in', s: 1, f: Array.from({ length: FRAMES_PER_MSG + 1 }, () => ({})), c: 0 },
      { t: 'in', s: 1, f: [], c: 0, a: Array.from({ length: ACTS_PER_MSG + 1 }, (_, i) => [i + 1, SAMPLES.seat]) },
      { t: 'in', s: 1, f: [Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`pad${i}`, 1]))], c: 0 },
      { t: 'b', b: Array.from({ length: BUNDLES_PER_MSG + 1 }, (_, f) => ({ f })) },
      { t: 'pings', p: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`p${i}`, 1])) },
      { t: 'hello', f: 1, c: 'x'.repeat(100_000) },
    ];
    for (const m of bad) expect(parseMsg(wire(m)), JSON.stringify(m).slice(0, 120)).toBeNull();
  });
});

/** A host and a guest in a lobby, and a third peer whose transport sends whatever the test hands it. */
function roomWithRaw() {
  const hub = new LoopbackHub({ latency: 20, jitter: 5, seed: 9 });
  const mk = (id: string) => new NetSession({ transport: hub.transport(id), match: new Match(roomSeed('TEST')), now: () => hub.now });
  const a = mk('aaaa');
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      hub.advance(TICK);
      for (const s of [a, b]) {
        s.tick({});
        void s.view;
      }
    }
  };
  hub.advance(TICK);
  a.tick({});
  const b = mk('bbbb');
  run(10);
  const got: NetAction[] = [];
  /** Each bundle's actions, by frame: a lossy resend repeats one, so this keeps each frame once. */
  const bundles = new Map<number, NetAction[]>();
  const pings: Record<string, number>[] = [];
  const raw = hub.transport('gggg');
  raw.start({
    status() {},
    members() {},
    message: (_from, d) => {
      const m = parseMsg(d);
      if (m?.t === 'b')
        for (const x of m.b) {
          got.push(...(x.a ?? []));
          bundles.set(x.f, x.a ?? []);
        }
      if (m?.t === 'pings') pings.push(m.p);
    },
  });
  run(30);
  return { hub, a, b, raw, run, got, bundles, pings };
}

describe('hostile peers', () => {
  it('a malformed message of every kind is dropped, and the room plays on in step', () => {
    const { hub, a, b, raw, run } = roomWithRaw();
    // Seated, so its input frames are read, not ignored.
    raw.send({ t: 'in', s: 1, f: [], c: 0, a: [[1, { t: 'join', dev: 'gggg:kb1' }]] }, 'aaaa');
    run(30);
    expect(a.match.players.some((p) => p.device === 'gggg:kb1')).toBe(true);
    const junk: unknown[] = [
      { t: 'in', s: 1, f: 'boom', c: 0 },
      { t: 'in', s: 2, f: [null], c: 0 },
      { t: 'in', s: 3, f: [{ kb1: { bits: 1 } }], c: 0 },
      { t: 'in', s: 4, f: [], c: 0, a: [[5, { t: 'rules', rules: null }]] },
      { t: 'in', s: 5, f: [], c: 0, a: [[6, { t: 'name', dev: 'gggg:kb1', name: { toString: null } }]] },
      { t: 'hello', f: { toString: 1 } },
      { t: 'need', f: [] },
      { t: 'state', s: null },
      { t: 'sync', s: 1, k: 1, ns: 1, last: 1, why: 1 },
      { t: 'b', b: [{ f: 0, i: { x: 'y' } }] },
      { t: 'pings', p: [1, 2] },
      { t: 'kicked', left: {} },
      { t: 'pong', ts: '0' },
      { t: '__proto__' },
      'garbage',
      null,
    ];
    for (const to of ['aaaa', 'bbbb']) for (const m of junk) raw.send(m, to);
    expect(() => run(30)).not.toThrow();
    expect(a.stats.malformed).toBe(junk.length);
    expect(b.stats.malformed).toBe(junk.length);
    expect(b.status).toBe('online');
    expect(a.match.players.map((p) => p.device).sort()).toEqual(['aaaa:kb1', 'bbbb:kb1', 'gggg:kb1']);
    // Freeze the host and let the guest catch up, so both hashes are taken at the same frame.
    a.flush();
    for (let i = 0; i < 60; i++) {
      hub.advance(TICK);
      b.tick({});
    }
    expect(b.match.frame).toBe(a.match.frame);
    expect(hashMatch(b.match)).toBe(hashMatch(a.match));
  });

  it('a guest flooding requests gets a few sequenced a tick, and nobody else waits on it', () => {
    const { a, b, raw, run, bundles } = roomWithRaw();
    let n = 1;
    // Ten full messages a tick, every request new: far more than any bundle could carry.
    const flood = () => {
      for (let i = 0; i < 10; i++) {
        const acts = Array.from({ length: ACTS_PER_MSG }, (_, j) => [n++, { t: 'color', dev: 'gggg:kb1', color: j % 8 }]);
        raw.send({ t: 'in', s: 1, f: [], c: 0, a: acts }, 'aaaa');
      }
    };
    for (let i = 0; i < 20; i++) {
      flood();
      run(1);
    }
    b.act({ t: 'name', dev: 'bbbb:kb1', name: 'Bea' });
    let waited = 0;
    while (a.match.players.find((p) => p.device === 'bbbb:kb1')!.character.name !== 'Bea' && waited < 60) {
      flood();
      run(1);
      waited++;
    }
    expect(waited).toBeLessThan(10);
    const floods = [...bundles.values()].map((acts) => acts.filter((x) => 'dev' in x && x.dev === 'gggg:kb1').length);
    expect(Math.max(...floods)).toBe(ACTS_PER_TICK);
  });

  it('peers that come and go are forgotten: pings, and a guest’s acks, stay the size of the room', () => {
    const { hub, a, b, run, pings } = roomWithRaw();
    // Two crowds of passers-by, between them more than a guest keeps acks for.
    for (let round = 0; round < 2; round++) {
      const crowd = Array.from({ length: MAX_PEERS + 1 }, (_, i) => {
        // All a passer-by needs to leave a trace: input (an ack entry everywhere) and a pong (a ping on the host).
        const t = hub.transport(`t${round}${String(i).padStart(2, '0')}`);
        t.start({ status() {}, members() {}, message: (_f, d) => parseMsg(d)?.t === 'ping' && t.send({ t: 'pong', ts: (d as { ts: number }).ts }, 'aaaa') });
        t.send({ t: 'in', s: 1, f: [], c: 0 }, 'aaaa');
        return t;
      });
      run(70);
      for (const t of crowd) t.close();
      run(5);
    }
    run(130); // a ping round after the last one left
    const members = new Set(a.members.map((m) => m.id));
    expect(Object.keys(pings.at(-1)!).every((id) => members.has(id))).toBe(true);
    const acks = (b as unknown as { acks: Record<string, unknown> }).acks;
    expect(Object.keys(acks).length).toBeLessThanOrEqual(2 * MAX_PEERS + 1);
  });

  it('a guest sending each host-only action, or acting for another peer’s device, gets none of them sequenced', () => {
    const { a, raw, run, got } = roomWithRaw();
    const before = { rules: { ...a.match.rules }, seed: a.match.seed, salt: a.match.nextSalt };
    const hostOnly = (Object.keys(ACTION_AUTH) as NetAction['t'][]).filter((t) => ACTION_AUTH[t] === 'host');
    expect(hostOnly.length).toBeGreaterThan(0);
    // Self actions for a device that isn't the sender's.
    const others = ALL.filter((x) => ACTION_AUTH[x.t] === 'self');
    // And one it may send, so the test sees that the pipe works.
    const mine: NetAction = { t: 'watch', dev: 'gggg:kb1', on: true, name: 'Gee' };
    const sent = [...hostOnly.map((t) => SAMPLES[t]), ...others, mine];
    // Resent every tick, as a guest does until they're acked: the host takes a few a tick.
    for (let i = 0; i < 60; i++) {
      raw.send({ t: 'in', s: 1, f: [], c: 0, a: sent.map((x, j) => [j + 1, x]) }, 'aaaa');
      run(1);
    }
    expect(got).toContainEqual(mine);
    for (const x of [...hostOnly.map((t) => SAMPLES[t]), ...others]) expect(got, x.t).not.toContainEqual(x);
    // Nothing a guest can't ask for came out: the host's own lobby joins are all there is of those.
    for (const x of got) if (hostOnly.includes(x.t)) expect(x).toEqual({ t: 'join', dev: expect.stringMatching(/^(aaaa|bbbb):kb1$/) });
    expect(a.match.rules).toEqual(before.rules);
    expect(a.match.seed).toBe(before.seed);
    expect(a.match.nextSalt).toBe(before.salt);
    expect(a.ns.kicked).toEqual({});
    expect(a.match.players.some((p) => p.device === 'cccc:kb1')).toBe(false);
  });
});
