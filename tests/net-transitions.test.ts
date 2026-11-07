import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES } from '../src/game/rules';
import type { Phase } from '../src/game/match';
import { peerOf } from '../src/net/actions';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { type Peer, World } from './lib/net-world';

/**
 * Host changes, joins and leaves at each point of a match, over the real transport, handlers and store (World:
 * only RTC and HTTP are faked). Every case ends the same way: one host, everyone online and synced, nothing forked,
 * the match moving, and every seat where it should be. docs/NETCODE.md → Host election and migration, Joining.
 */

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
const FAST = { ...DEFAULT_RULES, targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 };

/** People in the room: ready up when told, click a free card, place anywhere, run right, skip scores. */
function drive(ready: () => boolean) {
  return (p: Peer): Record<string, InputFrame> => {
    const s = p.session;
    const m = s.match;
    const f = m.frame;
    const me = m.players.find((q) => q.device === s.globalDevice('kb1'));
    if (!me) return {};
    if (m.phase === 'lobby') {
      // The host presses Start once everyone is ready, as its screen would.
      if (s.isHost && m.canStart()) s.act({ t: 'start' });
      return ready() && !me.ready && f % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
    }
    if (m.phase === 'pick') {
      const card = m.crate.find((c) => c.claimedBy < 0);
      return card ? { kb1: press({ pointer: { x: card.rect.x + 8, y: card.rect.y + 8 }, confirmPressed: f % 15 === 0 }) } : {};
    }
    if (m.phase === 'run') return { kb1: press({ right: true, jump: f % 30 < 15, jumpPressed: f % 30 === 0 }) };
    return { kb1: press({ pointer: { x: 100 + (f % 600), y: 60 + (f % 300) }, confirmPressed: f % 30 === 0 }) };
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  vi.useRealTimers();
});

interface Room {
  w: World;
  peers: Peer[];
  run: (ms: number) => Promise<void>;
  until: (cond: () => boolean, ms: number) => Promise<number>;
  live: () => Peer[];
  host: () => Peer;
}

/** Host aaaa and guests bbbb, cccc (and more), seated, at `phase`. */
async function roomAt(phase: Phase, ids = ['aaaa', 'bbbb', 'cccc']): Promise<Room> {
  const w = new World();
  let ready = false;
  const inputs = drive(() => ready);
  const peers = await w.room(...ids);
  peers[0].session.act({ t: 'rules', rules: FAST });
  const r: Room = {
    w,
    peers,
    run: (ms) => w.run(ms, inputs),
    until: (cond, ms) => w.runUntil(cond, ms, inputs),
    live: () => [...w.peers.values()].filter((p) => !p.gone),
    host: () => r.live().find((p) => p.session.isHost)!,
  };
  await r.until(() => peers.every((p) => p.session.match.players.length === ids.length), 5000);
  if (phase !== 'lobby') {
    ready = true;
    await r.until(() => peers.every((p) => p.session.match.phase === phase), 60_000);
  }
  expect(peers.map((p) => p.session.match.phase)).toEqual(peers.map(() => phase));
  await r.run(300);
  w.maxHosts = 0;
  w.maxRunning = 0;
  return r;
}

/** One host, everyone online and synced, never two hosts running the sim, identical state, and the match moving. */
async function healthy(r: Room, within: number) {
  const took = await r.until(() => r.w.settled(), within);
  expect(r.w.settled()).toBe(true);
  expect(r.w.maxRunning).toBe(1);
  const f = r.host().session.match.frame;
  await r.run(500);
  expect(r.host().session.match.frame).toBeGreaterThan(f + 20);
  expect(new Set(await r.w.drained()).size).toBe(1);
  return took;
}

const seat = (r: Room, id: string) => r.host().session.match.players.find((p) => peerOf(p.device) === id);

describe('host changes at every point of a match', () => {
  for (const phase of ['lobby', 'pick', 'run', 'score'] as const) {
    it(`the host crashes in ${phase}: the next in line hosts, its player away (gone in the lobby)`, async () => {
      const r = await roomAt(phase);
      r.w.crash('aaaa');
      expect(await healthy(r, 15_000)).toBeLessThan(10_000);
      expect(r.peers[1].session.isHost).toBe(true);
      const a = seat(r, 'aaaa');
      if (phase === 'lobby') expect(a).toBeUndefined();
      else expect(a?.away).toBe(true);
      expect(seat(r, 'bbbb')?.away).toBeUndefined();
      expect(seat(r, 'cccc')?.away).toBeUndefined();
    });
  }

  for (const phase of ['lobby', 'place'] as const) {
    it(`the host says goodbye in ${phase}: the room moves without waiting for silence`, async () => {
      const r = await roomAt(phase);
      r.w.leave('aaaa');
      expect(await healthy(r, 10_000)).toBeLessThan(4000);
      expect(r.peers[1].session.isHost).toBe(true);
    });
  }

  for (const phase of ['lobby', 'pick'] as const) {
    it(`the host starts watching in ${phase}: it stays, watching, and the room goes to the next in line`, async () => {
      const r = await roomAt(phase);
      const [a, b] = r.peers;
      a.session.watch();
      // Mid-match the seat goes at the round boundary; the handover follows it.
      await r.until(() => b.session.isHost && r.w.settled(), 90_000);
      await healthy(r, 10_000);
      expect(a.session.isHost).toBe(false);
      expect(a.session.watching).toBeDefined();
      expect(seat(r, 'aaaa')).toBeUndefined();
      expect(r.w.maxHosts).toBe(1);
    });
  }
});

describe('joins and leaves around a host change', () => {
  for (const phase of ['pick', 'run'] as const) {
    it(`someone arrives while the room is migrating in ${phase}: it syncs and watches`, async () => {
      const r = await roomAt(phase);
      r.w.crash('aaaa');
      await r.run(1500);
      const e = r.w.join('eeee');
      await healthy(r, 25_000);
      expect(e.session.synced).toBe(true);
      expect(e.session.hostId).toBe('bbbb');
      expect(e.session.watching).toBeDefined();
    });
  }

  it('a guest leaves while the new host is gathering the room: the room resumes without it', async () => {
    const r = await roomAt('run', ['aaaa', 'bbbb', 'cccc', 'dddd']);
    r.w.crash('aaaa');
    await r.until(() => r.peers[1].session.isHost, 10_000);
    r.w.leave('dddd');
    await healthy(r, 15_000);
    expect(seat(r, 'dddd')?.away).toBe(true);
  });

  for (const phase of ['lobby', 'place'] as const) {
    it(`the old host refreshes after the room moved in ${phase}: it comes back as a guest, in its own seat`, async () => {
      const r = await roomAt(phase);
      const slot = seat(r, 'aaaa')!.slot;
      const name = seat(r, 'aaaa')!.character.name;
      r.w.leave('aaaa');
      await healthy(r, 10_000);
      const a = r.w.join('aaaa');
      await r.until(() => a.session.synced && !!seat(r, 'aaaa') && !seat(r, 'aaaa')!.away, 20_000);
      await healthy(r, 10_000);
      expect(a.session.isHost).toBe(false);
      expect(seat(r, 'aaaa')!.character.name).toBe(name);
      if (phase !== 'lobby') expect(seat(r, 'aaaa')!.slot).toBe(slot);
    });
  }

  for (const phase of ['lobby', 'run'] as const) {
    it(`two people arrive at once in ${phase}: both sync, seated in the lobby, watching mid-match`, async () => {
      const r = await roomAt(phase);
      const d = r.w.join('dddd');
      const e = r.w.join('eeee');
      await r.until(() => [d, e].every((p) => p.session.synced) && (phase !== 'lobby' || (!!seat(r, 'dddd') && !!seat(r, 'eeee'))), 20_000);
      await healthy(r, 10_000);
      for (const p of [d, e]) {
        if (phase === 'lobby') expect(seat(r, p.id)).toBeDefined();
        else expect(p.session.watching).toBeDefined();
      }
    });
  }
});
