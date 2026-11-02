import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { GRAVITY } from '../src/gen/level';
import { sanitizeRules } from '../src/net/actions';
import { NetSession } from '../src/net/session';
import { hashMatch } from '../src/net/snapshot';
import { LoopbackHub, type LoopbackOptions } from '../src/net/transport';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

type Script = (s: NetSession, f: number, rng: Rng) => Partial<Record<string, InputFrame>>;

/** A room of in-memory peers on a loopback hub with a shared manual clock. */
class Room {
  hub: LoopbackHub;
  peers = new Map<string, NetSession>();
  rngs = new Map<string, Rng>();
  scripts = new Map<string, Script>();
  frame = 0;
  logs: string[] = [];

  constructor(opts: LoopbackOptions = {}) {
    this.hub = new LoopbackHub(opts);
  }

  join(id: string, script: Script = idle): NetSession {
    const s = new NetSession({
      transport: this.hub.transport(id),
      match: new Match(roomSeed('TEST')),
      now: () => this.hub.now,
      log: (m) => this.logs.push(`${id}: ${m}`),
    });
    this.peers.set(id, s);
    this.rngs.set(id, new Rng(id.charCodeAt(0) * 7919));
    this.scripts.set(id, script);
    return s;
  }

  leave(id: string) {
    this.peers.get(id)!.close();
    this.peers.delete(id);
  }

  /** Advance `ticks` fixed steps: deliver due messages, then tick every peer with its scripted input. */
  run(ticks: number, only?: string[]) {
    for (let i = 0; i < ticks; i++) {
      this.hub.advance(TICK);
      for (const [id, s] of this.peers) {
        if (only && !only.includes(id)) continue;
        s.tick(this.scripts.get(id)!(s, this.frame, this.rngs.get(id)!) as Record<string, InputFrame>);
        void s.view; // exercise prediction like the render loop does
        s.drainEvents();
      }
      this.frame++;
    }
  }

  host(): NetSession {
    return [...this.peers.values()].find((s) => s.isHost)!;
  }

  /** Let guests catch up with a frozen host, then compare state hashes at the same frame. */
  settle() {
    const h = this.host();
    h.flush();
    for (let i = 0; i < 200; i++) {
      this.hub.advance(TICK);
      for (const s of this.peers.values()) if (s !== h) s.tick({});
    }
    return [...this.peers.entries()].map(([id, s]) => ({ id, frame: s.match.frame, hash: hashMatch(s.match), host: s.isHost }));
  }
}

const idle: Script = () => ({});

/** Join + ready in the lobby, click around in pick/place, run right and hop in races, skip scores. */
const player: Script = (s, f, rng) => {
  const m = s.match;
  if (m.phase === 'lobby') {
    // Join right away; ready up (confirm again) once at least two players are in.
    const me = m.players.find((p) => p.device === s.globalDevice('kb1'));
    return (!me || (!me.ready && m.players.length >= 2)) && f % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
  }
  if (m.phase === 'pick' || m.phase === 'place')
    return { kb1: press({ pointer: { x: rng.range(40, 720), y: rng.range(40, 400) }, confirmPressed: rng.next() < 0.08, altPressed: rng.next() < 0.02 }) };
  if (m.phase === 'run') return { kb1: press({ right: rng.next() < 0.8, left: rng.next() < 0.1, jump: f % 30 < 15, jumpPressed: f % 30 === 0 }) };
  return f % 30 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
};

function fastRules(s: NetSession) {
  s.act({ t: 'rules', rules: { targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30, gravity: 'auto' } });
}

describe('host election', () => {
  it('earliest connected peer is host; migrates on leave; rejoin is a guest; empty room → next arrival hosts', () => {
    const r = new Room({ latency: 30 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb');
    r.run(5);
    const c = r.join('cccc');
    r.run(30);
    expect([a.isHost, b.isHost, c.isHost]).toEqual([true, false, false]);
    expect(b.hostId).toBe('aaaa');
    expect(c.synced).toBe(true);

    r.leave('aaaa');
    r.run(30);
    expect(b.isHost).toBe(true);
    expect(c.hostId).toBe('bbbb');
    expect(b.stats.migrations).toBe(1);

    const a2 = r.join('aaaa');
    r.run(60);
    expect(a2.isHost).toBe(false);
    expect(a2.hostId).toBe('bbbb');
    expect(a2.synced).toBe(true);

    r.leave('bbbb');
    r.leave('cccc');
    r.run(30);
    expect(a2.isHost).toBe(true);
    r.leave('aaaa');
    r.run(5);
    const d = r.join('dddd');
    r.run(5);
    expect(d.isHost).toBe(true);
    expect(d.peers().map((p) => [p.id, p.isHost])).toEqual([['dddd', true]]);
  });
});

describe('lockstep', () => {
  it('4 peers with latency, jitter and loss play a full round and stay bit-identical', () => {
    const r = new Room({ latency: 45, jitter: 30, loss: 0.05, seed: 3 });
    const a = r.join('aaaa', player);
    fastRules(a);
    for (const id of ['bbbb', 'cccc', 'dddd']) {
      r.run(10);
      r.join(id, player);
    }
    let sawRun = false;
    let sawScore = false;
    for (let i = 0; i < 60 * 80 && !sawScore; i++) {
      r.run(1);
      sawRun ||= a.match.phase === 'run';
      sawScore ||= sawRun && a.match.phase === 'score';
    }
    expect(a.match.players.length).toBe(4);
    expect(sawRun && sawScore).toBe(true);
    const res = r.settle();
    if (process.env.NETDBG) console.log(res, r.logs.slice(-30));
    expect(new Set(res.map((x) => x.frame)).size).toBe(1);
    expect(new Set(res.map((x) => x.hash)).size).toBe(1);
    expect(a.stats.desyncs).toBe(0);
    // Prediction actually ran on guests during the race.
    expect(r.peers.get('bbbb')!.stats.predicted).toBeGreaterThan(0);
  }, 60_000);

  it('detects a desync by hash and resyncs the guest from the host', () => {
    const r = new Room({ latency: 20 });
    const a = r.join('aaaa', player);
    r.run(5);
    const b = r.join('bbbb', player);
    r.run(120);
    b.match.players[0].score = 999; // corrupt the guest
    r.run(200);
    expect(a.stats.desyncs).toBeGreaterThan(0);
    const res = r.settle();
    if (process.env.NETDBG) console.log(res, r.logs.slice(-30));
    expect(res[0].hash).toBe(res[1].hash);
  });
});

describe('lobby seats', () => {
  const seats = (s: NetSession) => s.match.players.map((p) => `${p.device}/${p.character.name}/${p.character.seed}`);

  it('seats every connected peer with nobody pressing anything, identically on every peer, within a second', () => {
    const r = new Room({ latency: 40, jitter: 10 });
    const a = r.join('aaaa');
    r.run(20);
    expect(a.match.players.map((p) => p.device)).toEqual(['aaaa:kb1']);
    const b = r.join('bbbb');
    r.run(5);
    const c = r.join('cccc');
    r.run(60);
    for (const s of [a, b, c]) expect(s.match.players).toHaveLength(3);
    expect(seats(b)).toEqual(seats(a));
    expect(seats(c)).toEqual(seats(a));
  });

  it('gives every player a distinct name and color, however many seats fill', () => {
    const r = new Room({ latency: 10 });
    const ids = ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff', 'gggg', 'hhhh'];
    for (const id of ids) {
      r.join(id);
      r.run(10);
    }
    r.run(60);
    const a = r.peers.get('aaaa')!;
    expect(a.match.players).toHaveLength(8);
    expect(new Set(a.match.players.map((p) => p.character.name)).size).toBe(8);
    expect(new Set(a.match.players.map((p) => p.character.seed)).size).toBe(8);
    const gaps = (n: number) => {
      const hues = a.match.players.slice(0, n).map((p) => p.character.hue);
      return hues.flatMap((h, i) => hues.slice(i + 1).map((o) => Math.min(Math.abs(h - o), 360 - Math.abs(h - o))));
    };
    // A party reads apart at a glance. A full lobby can't always keep that, but never lands on a near twin.
    expect(Math.min(...gaps(4))).toBeGreaterThanOrEqual(30);
    expect(Math.min(...gaps(8))).toBeGreaterThanOrEqual(15);
  });

  it('refuses a look someone here already has, so two tabs sharing a saved look still differ', () => {
    const r = new Room({ latency: 20 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb');
    r.run(40);
    const look = 123456;
    a.act({ t: 'look', dev: 'aaaa:kb1', seed: look });
    r.run(30);
    b.act({ t: 'look', dev: 'bbbb:kb1', seed: look });
    r.run(30);
    expect(a.match.players.find((p) => p.device === 'aaaa:kb1')!.character.seed).toBe(look);
    expect(a.match.players.find((p) => p.device === 'bbbb:kb1')!.character.seed).not.toBe(look);
    expect(seats(b)).toEqual(seats(a));
    b.act({ t: 'name', dev: 'bbbb:kb1', name: a.match.players[0].character.name });
    r.run(30);
    expect(new Set(a.match.players.map((p) => p.character.name)).size).toBe(2);
  });

  it('syncs a new look to every peer', () => {
    const r = new Room({ latency: 20 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb', (_s, f) => (f === 70 ? { kb1: press({ altPressed: true }) } : {}));
    r.run(60);
    const before = seats(a);
    r.run(40);
    expect(seats(a)).not.toEqual(before);
    expect(seats(b)).toEqual(seats(a));
  });

  it('keeps every bay through a refresh, a late join and a host migration', () => {
    const r = new Room({ latency: 30 });
    const a = r.join('aaaa');
    r.run(5);
    r.join('bbbb');
    r.run(5);
    const c = r.join('cccc');
    r.run(60);
    const name = (s: NetSession, dev: string) => s.match.players.find((p) => p.device === dev)?.character.name;
    const cName = name(a, 'cccc:kb1');
    r.leave('cccc');
    r.run(30);
    expect(a.match.players).toHaveLength(2);
    const c2 = r.join('cccc');
    r.run(60);
    expect(name(c2, 'cccc:kb1')).toBe(cName);
    expect(seats(c2)).toEqual(seats(a));
    const d = r.join('dddd');
    r.run(60);
    expect(seats(d)).toEqual(seats(a));
    expect(a.match.players).toHaveLength(4);
    r.leave('aaaa');
    r.run(90);
    const b = r.peers.get('bbbb')!;
    expect(b.isHost).toBe(true);
    expect(b.match.players.map((p) => p.device).sort()).toEqual(['bbbb:kb1', 'cccc:kb1', 'dddd:kb1']);
    expect(seats(d)).toEqual(seats(b));
    expect(c).toBeDefined();
  });
});

describe('rules', () => {
  it("regenerates the level from the host's gravity, identically on every peer", () => {
    const r = new Room({ latency: 20 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb');
    r.run(60);
    const before = a.match.level.gravity;
    const pick = before === GRAVITY.low ? 'high' : 'low';
    a.act({ t: 'rules', rules: { ...a.match.rules, gravity: pick } });
    r.run(30);
    expect(a.match.rules.gravity).toBe(pick);
    expect(b.match.rules.gravity).toBe(pick);
    expect(a.match.level.gravity).toBe(GRAVITY[pick]);
    expect(b.match.level.gravity).toBe(GRAVITY[pick]);
    expect([...b.match.level.tiles]).toEqual([...a.match.level.tiles]);
  });

  it('turns a junk gravity into the default', () => {
    expect(sanitizeRules({ gravity: 'sideways' as 'low' }).gravity).toBe('auto');
  });
});

describe('kick', () => {
  function lobby() {
    const r = new Room({ latency: 20 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb');
    r.run(5);
    const c = r.join('cccc');
    r.run(60);
    return { r, a, b, c };
  }
  const devices = (s: NetSession) => s.match.players.map((p) => p.device);

  it('removes the peer on every peer, by host authority', () => {
    const { r, a, b, c } = lobby();
    a.kick('bbbb');
    r.run(30);
    expect(b.status).toBe('kicked');
    expect(devices(a)).toEqual(['aaaa:kb1', 'cccc:kb1']);
    expect(devices(c)).toEqual(['aaaa:kb1', 'cccc:kb1']);
    expect(a.members.map((m) => m.id)).toEqual(['aaaa', 'cccc']);
  });

  it('refuses a kicked peer that comes back, and never seats it', () => {
    const { r, a } = lobby();
    a.kick('bbbb');
    r.run(30);
    const back = r.join('bbbb');
    r.run(60);
    expect(back.status).toBe('kicked');
    expect(devices(a)).toEqual(['aaaa:kb1', 'cccc:kb1']);
  });

  it('ignores a kick asked for by a guest', () => {
    const { r, a, b, c } = lobby();
    c.act({ t: 'kick', peer: 'bbbb' });
    c.kick('bbbb');
    r.run(30);
    expect(b.status).toBe('online');
    expect(devices(a)).toHaveLength(3);
    expect(a.ns.kicked).toEqual({});
  });

  it('ignores a kick forged by a peer that is not the host, in a bundle or as a notice', () => {
    const { r, a, b, c } = lobby();
    const frame = b.match.frame + 2;
    c.transport!.send({ t: 'b', b: [{ f: frame, a: [{ t: 'kick', peer: 'bbbb' }] }] }, 'bbbb');
    c.transport!.send({ t: 'kicked' }, 'bbbb');
    r.run(30);
    expect(b.status).toBe('online');
    expect(devices(b)).toHaveLength(3);
    expect(b.ns.kicked).toEqual({});
    expect(a.isHost).toBe(true);
  });

  it('applies in the lobby only', () => {
    const { r, a, b, c } = lobby();
    const ready = press({ confirmPressed: true });
    r.scripts.set('aaaa', (_s, f) => (f % 40 === 0 ? { kb1: ready } : {}));
    r.scripts.set('bbbb', (_s, f) => (f % 40 === 0 ? { kb1: ready } : {}));
    r.scripts.set('cccc', (_s, f) => (f % 40 === 0 ? { kb1: ready } : {}));
    for (let i = 0; i < 200 && a.match.phase === 'lobby'; i++) r.run(1);
    expect(a.match.phase).toBe('pick');
    r.scripts.clear();
    for (const id of ['aaaa', 'bbbb', 'cccc']) r.scripts.set(id, () => ({}));
    a.kick('bbbb');
    a.act({ t: 'kick', peer: 'bbbb' });
    r.run(30);
    expect(b.status).toBe('online');
    expect(devices(c)).toHaveLength(3);
  });

  it('survives a host migration: the new host still refuses the peer', () => {
    const { r, a, b, c } = lobby();
    a.kick('bbbb');
    r.run(30);
    expect(b.status).toBe('kicked');
    r.leave('aaaa');
    r.run(60);
    expect(c.isHost).toBe(true);
    const back = r.join('bbbb');
    r.run(60);
    expect(back.status).toBe('kicked');
    expect(devices(c)).toEqual(['cccc:kb1']);
  });
});

describe('reconnect and late join', () => {
  it('a refresh mid-match gets the same slot, character and score back', () => {
    const r = new Room({ latency: 30 });
    const a = r.join('aaaa', player);
    fastRules(a);
    r.run(5);
    const b = r.join('bbbb', player);
    while (a.match.phase !== 'pick') r.run(1);
    r.run(30);
    const before = a.match.players.find((p) => p.device === 'bbbb:kb1')!;
    const snapshot = { slot: before.slot, name: before.character.name, score: before.score };
    expect(b.isHost).toBe(false);
    r.leave('bbbb');
    r.run(30);
    expect(a.match.players.find((p) => p.device === 'bbbb:kb1')!.away).toBe(true);
    const b2 = r.join('bbbb', player);
    r.run(60);
    const after = b2.match.players.find((p) => p.device === 'bbbb:kb1')!;
    expect({ slot: after.slot, name: after.character.name, score: after.score }).toEqual(snapshot);
    expect(after.away).toBeUndefined();
    expect(
      r
        .settle()
        .map((x) => x.hash)
        .every((h, _, all) => h === all[0]),
    ).toBe(true);
  });

  it('a refresh in the lobby rejoins with the same look', () => {
    const r = new Room({ latency: 30 });
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb', (_s, f) => (f === 30 ? { kb1: press({ confirmPressed: true }) } : {}));
    r.run(60);
    const name = a.match.players.find((p) => p.device === 'bbbb:kb1')!.character.name;
    a.act({ t: 'name', dev: 'aaaa:kb1', name: 'ignored' }); // no player for aaaa: no-op
    r.leave('bbbb');
    r.run(30);
    expect(a.match.players.some((p) => p.device === 'bbbb:kb1')).toBe(false);
    r.join('bbbb');
    r.run(60);
    expect(a.match.players.find((p) => p.device === 'bbbb:kb1')?.character.name).toBe(name);
    expect(b).toBeDefined();
  });

  it('a late joiner mid-race spectates with identical state, then is seated next round', () => {
    const r = new Room({ latency: 40, jitter: 10 });
    const a = r.join('aaaa', player);
    fastRules(a);
    r.run(5);
    r.join('bbbb', player);
    while (a.match.phase !== 'run') r.run(1);
    r.run(100);
    const c = r.join('cccc', player);
    r.run(40);
    expect(c.synced).toBe(true);
    expect(c.match.players.some((p) => p.device.startsWith('cccc:'))).toBe(false);
    const res = r.settle();
    expect(new Set(res.map((x) => x.hash)).size).toBe(1);
    while ((a.match.phase as string) !== 'pick' || a.match.round < 2) r.run(1);
    expect(a.match.players.some((p) => p.device === 'cccc:kb1')).toBe(true);
    r.run(30);
    expect(c.match.players.some((p) => p.device === 'cccc:kb1')).toBe(true);
  }, 30_000);

  it('host leaves mid-race: the next peer takes over and the match continues for everyone', () => {
    const r = new Room({ latency: 35, jitter: 15, loss: 0.02 });
    const a = r.join('aaaa', player);
    fastRules(a);
    r.run(5);
    const b = r.join('bbbb', player);
    r.run(5);
    const c = r.join('cccc', player);
    while (a.match.phase !== 'run') r.run(1);
    r.run(90);
    const runFrame = b.match.run!.frame;
    r.leave('aaaa');
    r.run(120);
    expect(b.isHost).toBe(true);
    expect(c.hostId).toBe('bbbb');
    expect(b.match.run && b.match.run.frame > runFrame + 60).toBe(true);
    expect(b.match.players.find((p) => p.device === 'aaaa:kb1')!.away).toBe(true);
    const res = r.settle();
    expect(new Set(res.map((x) => x.hash)).size).toBe(1);
    expect(c.match.frame).toBe(b.match.frame);
  }, 30_000);
});
