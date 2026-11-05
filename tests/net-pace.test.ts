import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { DEFAULT_RULES } from '../src/game/rules';
import { NetSession } from '../src/net/session';
import { hashMatch } from '../src/net/snapshot';
import { LoopbackHub, type LoopbackOptions } from '../src/net/transport';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Lobby: join and ready. Pick and place: click around. Race: run, hop and turn, changing something every few frames. */
function play(s: NetSession, f: number, rng: Rng): Record<string, InputFrame> {
  const m = s.match;
  if (m.phase === 'lobby') {
    const me = m.players.find((p) => p.device === s.globalDevice('kb1'));
    return (!me || (!me.ready && m.players.length >= 2)) && f % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
  }
  if (m.phase === 'pick' || m.phase === 'place')
    return { kb1: press({ pointer: { x: rng.range(40, 720), y: rng.range(40, 400) }, confirmPressed: rng.next() < 0.08 }) };
  if (m.phase === 'run') {
    const beat = Math.floor(f / 9);
    return { kb1: press({ right: beat % 5 !== 0, left: beat % 5 === 0, run: beat % 3 === 0, jump: f % 23 < 12, jumpPressed: f % 23 === 0 }) };
  }
  return f % 30 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
}

interface Peer {
  s: NetSession;
  rng: Rng;
  /** Ms of its own clock not yet ticked away, as the game loop's accumulator. */
  acc: number;
  frame: number;
}

/**
 * Two peers on their own clocks, ticking the way the game loop does (time scaled by `pace`, catching up after a
 * stall), over a hub stepped a millisecond at a time, so arrivals land between ticks rather than on them.
 */
function race(opts: LoopbackOptions, hitchEveryMs: number) {
  const hub = new LoopbackHub(opts);
  const peers: Peer[] = [];
  const join = (id: string, acc: number) => {
    const s = new NetSession({ transport: hub.transport(id), match: new Match(roomSeed('PACE')), now: () => hub.now });
    peers.push({ s, rng: new Rng(id.charCodeAt(0) * 7919), acc, frame: 0 });
    return s;
  };
  const host = join('aaaa', 0);
  host.act({ t: 'rules', rules: { ...DEFAULT_RULES, targetScore: 999, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 } });
  const guest = join('bbbb', 7);
  for (let ms = 0; ms < 240_000 && guest.stats.ownFrames < 2400; ms++) {
    hub.advance(1);
    for (const p of peers) {
      // The host's page stalls for 300 ms now and then (a GC, a busy tab), then runs the ticks it owes.
      if (p.s === host && hitchEveryMs && ms % hitchEveryMs < 300) continue;
      p.acc += (p.s === host && hitchEveryMs && ms % hitchEveryMs === 300 ? 301 : 1) * p.s.pace;
      while (p.acc >= TICK) {
        p.acc -= TICK;
        p.s.tick(play(p.s, p.frame++, p.rng));
        void p.s.view;
        p.s.drainEvents();
      }
    }
  }
  const played = { ...host.stats };
  for (let i = 0; i < 300; i++) {
    if (i % 20 === 0) host.flush();
    hub.advance(TICK);
    guest.tick({});
  }
  return { host, guest, played };
}

describe('pacing', () => {
  it('a guest under jitter, burst loss and host stalls rarely has its own runner corrected, and agrees with the host', () => {
    const { host, guest, played } = race({ latency: 40, jitter: 30, loss: 0.02, burst: 4, lossyOnly: true, seed: 5 }, 4000);
    const miss = guest.stats.ownMisses / guest.stats.ownFrames;
    if (process.env.NETDBG) console.log({ miss, depth: played.queuedFrames / played.hostTicks, guest: guest.stats, host: played });
    expect(guest.stats.ownFrames).toBeGreaterThan(1200);
    // Before pacing, late frames shifting the rest, and acks a frame behind: 24% of the guest's race frames.
    expect(miss).toBeLessThan(0.02);
    // Host stalls drain as fast as they came: nothing folded but the odd long dip.
    expect(played.foldedFrames).toBeLessThan(10);
    // Paid for with a deeper queue, but not an unbounded one: under 100 ms however lossy the link.
    expect(played.queuedFrames / played.hostTicks).toBeLessThan(4);
    expect(guest.match.frame).toBe(host.match.frame);
    expect(hashMatch(guest.match)).toBe(hashMatch(host.match));
    expect(host.stats.desyncs).toBe(0);
  }, 60_000);

  it('adds no lag on a clean link: a frame arrives just before the tick that plays it', () => {
    const { guest, played } = race({ latency: 40, seed: 5 }, 0);
    expect(guest.stats.ownMisses).toBe(0);
    expect(played.queuedFrames / played.hostTicks).toBeLessThan(1.1);
  }, 60_000);
});
