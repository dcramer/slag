import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { roomSeed } from '../src/game/room';
import { applyAction, newNetState } from '../src/net/actions';
import { NetSession } from '../src/net/session';
import { LoopbackHub } from '../src/net/transport';
import { MAX_PLAYERS } from '../src/sim/constants';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * What a host change or a seat changing hands must never do: rewind what a peer already played, play its events
 * twice, ack a request before applying it, or hand out more seats than there are. docs/NETCODE.md → Resume, Seats.
 */

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
type Script = (s: NetSession, f: number) => Partial<Record<string, InputFrame>>;
const still: Script = () => ({});
/** Never ready, never idle. */
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

type Route = (from: string, data: unknown, to?: string) => void;

class Room {
  hub: LoopbackHub;
  peers = new Map<string, NetSession>();
  scripts = new Map<string, Script>();
  frame = 0;
  before: (() => void)[] = [];
  after: (() => void)[] = [];

  constructor(latency = 50) {
    this.hub = new LoopbackHub({ latency, seed: 3 });
  }

  join(id: string, script: Script = still, watch = false, more: { dropFrames?: number } = {}): NetSession {
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
      for (const h of this.before) h();
      for (const [id, s] of this.peers) {
        s.tick(this.scripts.get(id)!(s, this.frame) as Record<string, InputFrame>);
        void s.view;
        s.drainEvents();
      }
      for (const h of this.after) h();
      this.frame++;
    }
  }

  until(what: () => boolean, max: number) {
    for (let i = 0; i < max && !what(); i++) this.run(1);
    expect(what()).toBe(true);
  }

  /** Swap the hub's router, to lose or watch messages; returns the original. */
  route(fn: (orig: Route) => Route): Route {
    const hub = this.hub as unknown as { route: Route };
    const orig = hub.route.bind(this.hub);
    hub.route = fn(orig);
    return orig;
  }
}

const seatedPeer = (s: NetSession, peer: string) => s.match.players.some((p) => p.device.startsWith(`${peer}:`));
const inner = (s: NetSession) => s as unknown as { emittedThrough: number; pendingHash?: [number, number] };

/** The most frames `s` ever went back, from now on. */
function rewinds(r: Room, s: NetSession) {
  let last = s.match.frame;
  let most = 0;
  r.after.push(() => {
    if (s.match.frame < last) most = Math.max(most, last - s.match.frame);
    last = s.match.frame;
  });
  return () => most;
}

describe('a host change never rewinds anyone', () => {
  it('a host stepping back to watch resumes from its own frame, not one behind it', () => {
    const r = new Room(50);
    const a = r.join('aaaa', fidget);
    r.run(5);
    const b = r.join('bbbb', fidget);
    r.run(5);
    const c = r.join('cccc', fidget);
    r.until(() => seatedPeer(a, 'bbbb') && seatedPeer(a, 'cccc'), 300);
    r.run(30);
    const back = rewinds(r, a);
    a.watch();
    r.until(() => b.isHost && !b.paused && a.synced && c.synced && a.hostId === 'bbbb', 900);
    r.run(10);
    expect(back()).toBe(0);
  });

  it('the furthest peer leaving while the new host pulls its state: the next furthest is pulled instead', () => {
    const r = new Room();
    const a = r.join('aaaa', fidget);
    r.run(5);
    const b = r.join('bbbb', fidget);
    r.run(5);
    const c = r.join('cccc', fidget);
    r.run(5);
    const x = r.join('xxxx', fidget);
    r.until(() => [b, c, x].every((s) => s.synced) && seatedPeer(a, 'xxxx'), 300);
    r.run(30);
    // The old host's last bundles: b misses them all, c gets the first three, x gets every one.
    let n = 0;
    let pulled = false;
    const orig = r.route((orig) => (from, data, to) => {
      if ((data as { t: string }).t === 'b' && from === 'aaaa' && !to) {
        n++;
        if (n <= 3) orig(from, data, 'cccc');
        orig(from, data, 'xxxx');
        return;
      }
      orig(from, data, to);
    });
    r.run(12); // past the latency, so x holds the frames c never got
    const cFrame = c.match.frame;
    r.route(() => (from, data, to) => {
      if ((data as { t: string }).t === 'pull' && to === 'xxxx') pulled = true;
      orig(from, data, to);
    });
    r.leave('aaaa');
    r.after.push(() => {
      if (pulled && r.peers.has('xxxx')) r.leave('xxxx');
    });
    r.until(() => b.isHost && !b.paused && c.synced && c.hostId === 'bbbb', 900);
    expect(pulled).toBe(true);
    expect(c.match.frame).toBeGreaterThanOrEqual(cFrame);
  });

  it("a guest predicting a race doesn't play the frames it predicted again when a migration syncs it", () => {
    const r = new Room(60);
    const a = r.join('aaaa', player);
    r.run(5);
    a.act({ t: 'rules', rules: FAST });
    const b = r.join('bbbb', player);
    r.run(3);
    const c = r.join('cccc', player);
    r.until(() => a.match.phase === 'run' && a.match.phaseFrame > 60, 4000);
    void c.view;
    const before = inner(c).emittedThrough;
    r.leave('aaaa');
    let low = Infinity;
    r.after.push(() => (low = Math.min(low, inner(c).emittedThrough)));
    r.until(() => b.isHost && !b.paused && c.synced && c.hostId === 'bbbb', 900);
    expect(low).toBeGreaterThanOrEqual(before);
  });
});

describe('seats never change hands twice', () => {
  it("an idle player back after a watcher won its seat stays watching: the watcher's seat comes at the boundary", () => {
    const r = new Room();
    const ids = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}xx`);
    const host = r.join(ids[0], player);
    r.run(5);
    host.act({ t: 'rules', rules: FAST });
    let idle = false;
    const late: Script = (s, f) => (idle ? {} : player(s, f));
    for (const id of ids.slice(1)) {
      r.join(id, id === 'p7xx' ? late : player);
      r.run(3);
    }
    r.until(() => host.match.players.length === MAX_PLAYERS, 600);
    const w = r.join('wwww', still, true);
    r.until(() => host.match.phase === 'run' && !!host.ns.watching.wwww, 4000);
    r.run(20);
    // The host moves p7 to the watchers for being idle (what reconcile does after IDLE_ROUNDS).
    idle = true;
    host.act({ t: 'watch', dev: 'p7xx:kb1', on: true, afk: true });
    r.until(() => w.space === 1, 120);
    w.play();
    r.until(() => w.seatAsk !== 'asking', 200);
    expect(w.seatAsk).toBe('won');
    idle = false; // p7's next input asks for its seat back (settleIntent): it was taken
    r.run(120);
    expect(host.space).toBeGreaterThanOrEqual(0);
    const p7 = r.peers.get('p7xx')!;
    expect(p7.seatAsk).toBe('taken');
    r.until(() => host.match.phase === 'score', 4000);
    r.until(() => host.match.phase === 'pick', 4000);
    expect(seatedPeer(host, 'wwww')).toBe(true);
    expect(w.queued).toBe(false);
  });

  it('a watcher that won a seat mid-round and refreshes keeps its place in line', () => {
    const r = new Room();
    const a = r.join('aaaa', player);
    r.run(5);
    a.act({ t: 'rules', rules: FAST });
    r.join('bbbb', player);
    let w = r.join('wwww', still, true);
    r.until(() => a.match.phase === 'run' && !!a.ns.watching.wwww, 4000);
    r.run(20);
    w.play();
    r.until(() => w.seatAsk !== 'asking', 200);
    expect(w.queued).toBe(true);
    w.close();
    r.peers.delete('wwww');
    w = r.join('wwww'); // the same tab reloaded: the same peer id
    r.until(() => w.synced, 300);
    r.run(30);
    expect(w.queued).toBe(true);
  });

  it('a sync never acks a Join the host has queued but not yet applied', () => {
    const r = new Room();
    const a = r.join('aaaa', fidget);
    r.run(5);
    r.join('bbbb', fidget);
    r.run(5);
    const o = r.join('oooo', still, true);
    r.until(() => o.synced && !!a.ns.watching.oooo && seatedPeer(a, 'bbbb'), 300);
    r.run(30);
    let asked = false;
    let synced = false;
    let dropped = 0;
    r.route((orig) => (from, data, to) => {
      const d = data as { t: string };
      if (d.t === 'sync' && to === 'oooo' && asked) synced = true;
      if (synced && dropped < 1 && d.t === 'b' && !to) {
        dropped++; // the bundle after the sync is lost on the unreliable channel
        orig(from, data, 'bbbb');
        return;
      }
      orig(from, data, to);
    });
    r.before.push(() => {
      const ph = inner(o).pendingHash;
      if (asked || !ph) return;
      asked = true;
      // O has drifted: the hash in the same message as its Join mismatches, so the host answers with a sync.
      o.match.players[0].score = 999;
      inner(o).pendingHash = [ph[0], ph[1] ^ 1];
      o.play();
    });
    r.until(() => asked && o.seatAsk !== 'asking', 300);
    const told = o.seatAsk;
    r.run(60);
    expect(o.seated).toBe(true);
    expect(told).toBe('won');
  });

  it('a dropped player that keeps its seat leaves no park behind for a later rejoin to restore', () => {
    const m = new Match(roomSeed('SEATS'));
    const ns = newNetState();
    m.join('aaaa:kb1');
    m.join('bbbb:kb1');
    m.startMatch();
    const pb = () => m.players.find((p) => p.device === 'bbbb:kb1')!;
    pb().score = 3;
    applyAction(m, ns, { t: 'leave', dev: 'bbbb:kb1' }); // dropped: gone too long
    applyAction(m, ns, { t: 'seat', dev: 'bbbb:kb1', on: true }); // back in time, and keeps the seat
    expect(pb().leaving).toBeUndefined();
    expect(ns.parked.bbbb).toBeUndefined();
    pb().score = 30;
    applyAction(m, ns, { t: 'leave', dev: 'bbbb:kb1' }); // dropped again
    m.players = m.players.filter((p) => !p.leaving); // the round boundary
    (m as unknown as { phase: string }).phase = 'score';
    applyAction(m, ns, { t: 'seat', dev: 'bbbb:kb1', on: true });
    expect(pb().score).toBe(30);
  });
});
