import { describe, expect, it } from 'vitest';
import { IDLE_FRAMES, LOBBY_IDLE_FRAMES, Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { roomSeed } from '../src/game/room';
import { NetSession } from '../src/net/session';
import { hashMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { MAX_PLAYERS } from '../src/sim/constants';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** Observers, seats and idle peers online (docs/NETCODE.md → Seats and observers). */

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
type Script = (s: NetSession, f: number) => Partial<Record<string, InputFrame>>;
const still: Script = () => ({});
/** Never ready, never idle: a pointer that keeps moving. */
const fidget: Script = (_s, f) => ({ kb1: press({ pointer: { x: 100 + (f % 9), y: 200 } }) });
/** Ready up, pick the first free card, place wherever, run right, skip scores. */
const player: Script = (s, f) => {
  const m = s.match;
  const me = m.players.find((p) => p.device === s.globalDevice('kb1'));
  if (m.phase === 'lobby')
    return me && !me.ready && m.players.filter((p) => !p.afk).length >= 2 && f % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
  if (m.phase === 'pick') {
    const card = m.crate.find((c) => c.claimedBy < 0);
    return card ? { kb1: press({ pointer: { x: card.rect.x + 8, y: card.rect.y + 8 }, confirmPressed: f % 15 === 0 }) } : {};
  }
  if (m.phase === 'run') return { kb1: press({ right: true, jump: f % 30 < 15, jumpPressed: f % 30 === 0 }) };
  return { kb1: press({ pointer: { x: 100 + (f % 600), y: 60 + (f % 300) }, confirmPressed: f % 30 === 0 }) };
};
const FAST = { ...DEFAULT_RULES, targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 };

class Room {
  hub = new LoopbackHub({ latency: 30, jitter: 10, seed: 3 });
  peers = new Map<string, NetSession>();
  scripts = new Map<string, Script>();
  /** Peers whose page has stopped ticking (a frozen or throttled tab). Messages still reach them. */
  frozen = new Set<string>();
  frame = 0;

  join(id: string, script: Script = still, watch = false, more: { client?: string; banFrames?: number; dropFrames?: number } = {}): NetSession {
    const s = new NetSession({
      transport: this.hub.transport(id),
      match: new Match(roomSeed('SEATS')),
      now: () => this.hub.now,
      watch,
      name: () => `W${id}`,
      ...more,
    });
    this.peers.set(id, s);
    this.scripts.set(id, script);
    return s;
  }

  leave(id: string) {
    this.peers.get(id)!.close();
    this.peers.delete(id);
  }

  run(ticks: number) {
    for (let i = 0; i < ticks; i++) {
      this.hub.advance(TICK);
      for (const [id, s] of this.peers) {
        if (this.frozen.has(id)) continue;
        s.tick(this.scripts.get(id)!(s, this.frame) as Record<string, InputFrame>);
        void s.view;
        s.drainEvents();
      }
      this.frame++;
    }
  }

  until(what: () => boolean, max: number): number {
    for (let i = 0; i < max; i++) {
      if (what()) return i;
      this.run(1);
    }
    throw new Error(`timed out after ${max} ticks`);
  }

  /** Same frame, same state, everywhere: stop the host's clock and let everyone catch up. */
  hashes(): Set<number> {
    const h = [...this.peers.values()].find((s) => s.isHost)!;
    for (let i = 0; i < 120; i++) {
      if (i % 20 === 0) h.flush();
      this.hub.advance(TICK);
      for (const s of this.peers.values()) if (s !== h) s.tick({});
    }
    return new Set([...this.peers.values()].map((s) => s.match.frame * 1e10 + hashMatch(s.match)));
  }
}

const seatedPeer = (s: NetSession, peer: string) => s.match.players.some((p) => p.device.startsWith(`${peer}:`));

describe('observers', () => {
  it('an observer from a watch link is never seated, sends no input, never holds the room up, and sees the same match', () => {
    const r = new Room();
    const a = r.join('aaaa', player);
    r.run(5);
    a.act({ t: 'rules', rules: FAST });
    r.join('bbbb', player);
    // Pressing everything there is: an observer's buttons reach nobody.
    const o = r.join('oooo', (_s, f) => ({ kb1: press({ confirmPressed: f % 10 === 0, right: true }) }), true);
    r.until(() => a.match.phase === 'pick', 600);
    expect(o.intent).toBe('watch');
    expect(o.seated).toBe(false);
    expect(a.ns.watching.oooo).toEqual({ name: 'Woooo' });
    expect(seatedPeer(a, 'oooo')).toBe(false);
    // Its page stops: the room doesn't notice.
    r.frozen.add('oooo');
    const f0 = a.match.frame;
    r.run(240);
    expect(a.match.frame - f0).toBeGreaterThanOrEqual(239);
    r.frozen.delete('oooo');
    r.until(() => a.match.phase === 'run', 3000);
    r.run(60);
    expect(new Set(a.match.run!.runners.map((x) => a.match.player(x.slot)!.device.split(':')[0]))).toEqual(new Set(['aaaa', 'bbbb']));
    expect(r.hashes().size).toBe(1);
  }, 20_000);

  it('Watch in the lobby frees the seat at once, Play takes one back, and Watch mid-match waits for the round boundary', () => {
    const r = new Room();
    const a = r.join('aaaa', fidget);
    r.run(5);
    a.act({ t: 'rules', rules: FAST });
    const b = r.join('bbbb', still);
    const c = r.join('cccc', fidget);
    r.until(() => seatedPeer(a, 'bbbb') && seatedPeer(a, 'cccc'), 300);
    b.watch();
    r.run(20);
    expect(seatedPeer(a, 'bbbb')).toBe(false);
    expect(a.ns.watching.bbbb?.name).toBe('Wbbbb');
    expect(b.watching).toBeDefined();
    b.play();
    r.until(() => seatedPeer(a, 'bbbb'), 200);
    expect(a.ns.watching.bbbb).toBeUndefined();
    // Everyone readies, then mid-race c chooses to watch: it plays the round out and is gone when it's scored.
    for (const id of ['aaaa', 'bbbb', 'cccc']) r.scripts.set(id, player);
    r.until(() => a.match.phase === 'run', 3000);
    c.watch();
    r.run(20);
    expect(a.match.players.find((p) => p.device === 'cccc:kb1')?.leaving).toBe(true);
    expect(a.match.run!.runners.length).toBe(3);
    r.until(() => a.match.phase === 'score', 3000);
    expect(seatedPeer(a, 'cccc')).toBe(false);
    r.run(10);
    expect(c.seated).toBe(false);
    expect(c.intent).toBe('watch');
    expect(r.hashes().size).toBe(1);
  }, 20_000);

  it('a full lobby seats arrivals as observers, and a seat freeing up is theirs to take, not a seat they are put in', () => {
    const r = new Room();
    const ids = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}xx`);
    for (const id of ids) {
      r.join(id);
      r.run(3);
    }
    const host = r.peers.get(ids[0])!;
    r.until(() => host.match.players.length === MAX_PLAYERS, 600);
    const late = r.join('late');
    r.until(() => !!host.ns.watching.late, 300);
    expect(late.intent).toBe('watch');
    expect(late.space).toBe(0);
    // Asking while it's full is answered, not left hanging.
    late.play();
    r.until(() => late.seatAsk !== 'asking', 120);
    expect(late.seatAsk).toBe('taken');
    expect(late.intent).toBe('watch');
    r.leave(ids[5]);
    r.until(() => late.space === 1, 300);
    r.run(120);
    expect(seatedPeer(host, 'late')).toBe(false);
    late.play();
    late.play(); // a double click is the same request
    r.until(() => seatedPeer(host, 'late'), 300);
    r.run(10);
    expect(late.seatAsk).toBe('won');
    expect(host.match.players.filter((p) => p.device.startsWith('late:')).length).toBe(1);
    expect(r.hashes().size).toBe(1);
  }, 20_000);

  it('two watchers ask for the last seat at once: the host’s order picks one, the other is told, and every peer agrees', () => {
    const r = new Room();
    const ids = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `p${i}xx`);
    for (const id of ids) {
      r.join(id, fidget);
      r.run(3);
    }
    const host = r.peers.get(ids[0])!;
    const x = r.join('xxxx', still, true);
    const y = r.join('yyyy', still, true);
    r.until(() => host.match.players.length === MAX_PLAYERS - 1 && !!host.ns.watching.xxxx && !!host.ns.watching.yyyy, 600);
    r.run(20);
    expect(x.space).toBe(1);
    x.play();
    y.play();
    r.until(() => x.seatAsk !== 'asking' && y.seatAsk !== 'asking', 200);
    expect([x.seatAsk, y.seatAsk].sort()).toEqual(['taken', 'won']);
    const winner = x.seatAsk === 'won' ? 'xxxx' : 'yyyy';
    const loser = winner === 'xxxx' ? y : x;
    expect(host.match.players.length).toBe(MAX_PLAYERS);
    expect(seatedPeer(host, winner)).toBe(true);
    expect(loser.watching).toBeDefined();
    expect(loser.space).toBe(0);
    for (const s of r.peers.values()) expect(s.match.players.map((p) => p.device)).toEqual(host.match.players.map((p) => p.device));
    expect(r.hashes().size).toBe(1);
  }, 20_000);

  it('a seat request in flight when the host goes: the new host decides it, once', () => {
    const r = new Room();
    const a = r.join('aaaa', fidget);
    r.run(5);
    const b = r.join('bbbb', fidget);
    r.run(5);
    const o = r.join('oooo', still, true);
    r.until(() => seatedPeer(a, 'bbbb') && !!a.ns.watching.oooo, 300);
    r.run(30);
    o.play();
    r.leave('aaaa'); // gone before the request reaches it
    r.until(() => b.isHost && !b.paused && o.seatAsk !== 'asking', 900);
    expect(o.seatAsk).toBe('won');
    expect(b.match.players.filter((p) => p.device.startsWith('oooo:')).length).toBe(1);
    expect(r.hashes().size).toBe(1);
  }, 20_000);

  it('an observer moves behind players in the line, so losing the host never picks it; with only observers left, one hosts', () => {
    const r = new Room();
    const a = r.join('aaaa', still);
    r.run(5);
    const o = r.join('oooo', still, true);
    r.run(5);
    const b = r.join('bbbb', still);
    r.until(() => seatedPeer(a, 'bbbb') && !!a.ns.watching.oooo, 300);
    const order = (s: NetSession, id: string) => s.members.find((m) => m.id === id)!.order;
    r.until(() => order(a, 'oooo') > order(a, 'bbbb'), 600);
    r.leave('aaaa');
    r.until(() => b.isHost && o.hostId === 'bbbb' && o.synced, 600);
    expect(seatedPeer(b, 'bbbb')).toBe(true);
    expect(r.hashes().size).toBe(1);
    r.leave('bbbb');
    r.until(() => o.isHost && !o.paused, 900);
    expect(o.seated).toBe(false);
    expect(o.watching).toBeDefined();
  }, 20_000);
});

describe('idle peers', () => {
  it('an idle lobby player keeps its seat until a watcher could use it, then goes to the watchers, and any input brings them back', () => {
    const r = new Room();
    const ids = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}xx`);
    for (const id of ids) {
      r.join(id, id === 'p7xx' ? still : fidget);
      r.run(3);
    }
    const a = r.peers.get('p0xx')!;
    const b = r.peers.get('p7xx')!;
    r.until(() => a.match.players.length === MAX_PLAYERS, 600);
    r.until(() => !!a.match.players.find((p) => p.device === 'p7xx:kb1')?.afk, LOBBY_IDLE_FRAMES + 120);
    r.run(30);
    expect(seatedPeer(a, 'p7xx')).toBe(true); // full, but nobody waiting: an idle lobby holds nobody up
    r.join('wwww', still, true);
    r.until(() => !!a.ns.watching.p7xx, 300);
    expect(a.ns.watching.p7xx.afk).toBe(true);
    expect(seatedPeer(a, 'p7xx')).toBe(false);
    r.run(10);
    expect(b.intent).toBe('watch');
    r.scripts.set('p7xx', (_s, f) => (f % 30 === 0 ? { kb1: press({ left: true }) } : {}));
    r.until(() => seatedPeer(a, 'p7xx'), 300);
    expect(a.ns.watching.p7xx).toBeUndefined();
  }, 30_000);

  it("a guest that stops sending has its buttons let go, gives up the race when idle, and agrees with the room when it's back", () => {
    const r = new Room();
    const a = r.join('aaaa', player);
    r.run(5);
    a.act({ t: 'rules', rules: { ...FAST, raceSeconds: 0 } });
    r.join('bbbb', player);
    r.until(() => a.match.phase === 'run', 3000);
    r.run(120);
    // a stands still holding a key (input, not idle); b's page freezes mid-run with right held.
    r.scripts.set('aaaa', () => ({ kb1: press({ down: true }) }));
    r.frozen.add('bbbb');
    const slotB = a.match.players.find((p) => p.device === 'bbbb:kb1')!.slot;
    const runnerB = () => a.match.run!.runners.find((x) => x.slot === slotB)!;
    r.run(90);
    expect(Math.abs(runnerB().body.vx)).toBeLessThan(1); // let go after SOFT_TICKS, and it has stopped
    if (runnerB().alive) r.until(() => !runnerB().alive, IDLE_FRAMES + 60);
    r.frozen.delete('bbbb');
    r.run(30);
    expect(r.hashes().size).toBe(1);
  }, 20_000);
});

describe('kicks', () => {
  it('keep the browser out until the ban runs out, whatever peer id it comes back with, across a host migration', () => {
    const r = new Room();
    const ban = 240;
    const a = r.join('aaaa', still, false, { client: 'clientaaaaaa', banFrames: ban });
    r.run(5);
    const b = r.join('bbbb', still, false, { client: 'clientbbbbbb', banFrames: ban });
    r.run(5);
    const c = r.join('cccc', still, false, { client: 'clientcccccc', banFrames: ban });
    r.until(() => seatedPeer(a, 'bbbb') && seatedPeer(a, 'cccc'), 300);
    a.kick('bbbb');
    r.run(20);
    expect(b.status).toBe('kicked');
    expect(b.kickedUntil).toBeGreaterThan(Date.now() + 2000);
    r.leave('bbbb');
    // A new tab of the same browser: a new peer id, the same client id.
    const tab = r.join('b2b2', still, false, { client: 'clientbbbbbb' });
    r.until(() => tab.status === 'kicked', 120);
    expect(seatedPeer(a, 'b2b2')).toBe(false);
    r.leave('b2b2');
    // The host goes: the new host refuses it just the same.
    r.leave('aaaa');
    r.until(() => c.isHost && !c.paused, 600);
    const again = r.join('b3b3', still, false, { client: 'clientbbbbbb' });
    r.until(() => again.status === 'kicked', 120);
    r.leave('b3b3');
    // Once the ban has run out, it's let back in and seated.
    r.until(() => c.match.frame > (c.ns.banned.clientbbbbbb ?? 0), ban + 600);
    const back = r.join('b4b4', still, false, { client: 'clientbbbbbb' });
    r.until(() => seatedPeer(c, 'b4b4'), 300);
    expect(back.status).toBe('online');
    expect(r.hashes().size).toBe(1);
  }, 20_000);
});

describe('players gone for good', () => {
  it('a player gone too long mid-match shows as away, then is dropped: its seat frees, and its look and points come back with it', () => {
    const r = new Room();
    const drop = 180;
    const a = r.join('aaaa', player, false, { dropFrames: drop });
    r.run(5);
    a.act({ t: 'rules', rules: FAST });
    r.join('bbbb', player);
    r.join('cccc', player);
    r.until(() => a.match.phase === 'run', 3000);
    const before = a.match.players.find((p) => p.device === 'bbbb:kb1')!;
    const look = before.character.seed;
    r.leave('bbbb'); // the tab closed: no goodbye that keeps a seat
    r.until(() => !!a.match.players.find((p) => p.device === 'bbbb:kb1')?.away, 120);
    r.run(10);
    expect(r.peers.get('cccc')!.match.players.find((p) => p.device === 'bbbb:kb1')!.away).toBe(true);
    const space = a.space;
    r.until(() => !!a.match.players.find((p) => p.device === 'bbbb:kb1')?.leaving, drop + 60);
    expect(a.space).toBe(space + 1);
    r.until(() => !seatedPeer(a, 'bbbb'), 3000);
    const score = a.ns.parked.bbbb?.[0]?.score;
    expect(score).toBeDefined();
    // Back later: watching, and a Join seats it next round as it was.
    const back = r.join('bbbb', player);
    r.until(() => back.synced && !!back.watching, 300);
    back.play();
    r.until(() => seatedPeer(a, 'bbbb'), 4000);
    const again = a.match.players.find((p) => p.device === 'bbbb:kb1')!;
    expect(again.character.seed).toBe(look);
    expect(again.score).toBe(score);
    expect(r.hashes().size).toBe(1);
  }, 30_000);
});
