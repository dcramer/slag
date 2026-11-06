import { describe, expect, it, vi } from 'vitest';
import { Match } from '../src/game/match';
import { generateLevel } from '../src/gen/level';
import { hasLevel, type LevelRequest, levelKey, offerLevel } from '../src/gen/level/pregen';
import { NetSession } from '../src/net/session';
import { hashMatch, type LevelSource, type MatchSnap, prepareSnapLevel, restoreMatch, snapLevel, snapLevelAtHand, snapshotMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';

// Every main-thread generation goes through here; the "worker" below hands levels over with offerLevel instead.
vi.mock(import('../src/gen/level/index'), async (original) => {
  const mod = await original();
  return { ...mod, generateLevel: vi.fn(mod.generateLevel) };
});
const generated = () => vi.mocked(generateLevel).mock.calls.length;

/** What a worker's postMessage does to a level. */
const overTheWire = <T>(v: T): T => structuredClone(v);

/**
 * A host on a level no page in this process has built (and so kept): the snapshot a late joiner gets, and the
 * request the host's match asked for it with. Each test takes its own seed.
 */
function hostOn(seed: number): { host: Match; asked: LevelRequest; snap: MatchSnap; worker: () => ReturnType<typeof generateLevel> } {
  const host = new Match(1);
  const asked = { seed, theme: undefined, profile: host.profileOverride() };
  const built = generateLevel(asked.seed, asked.theme, asked.profile);
  host.seed = seed;
  host.level = overTheWire(built);
  return { host, asked, snap: snapshotMatch(host), worker: () => overTheWire(built) };
}

/** A worker that's busy on `asked` until `finish` is called. */
function busyWorker(asked: LevelRequest, finish: Promise<void>) {
  const firsts: string[] = [];
  const levels: LevelSource = {
    building: (req) => levelKey(req) === levelKey(asked),
    first: (req) => {
      firsts.push(levelKey(req));
      return levelKey(req) === levelKey(asked) ? finish : Promise.resolve();
    },
  };
  return { levels, firsts };
}

describe("a late joiner's level", () => {
  it('restores from the level the worker built for the rules, without generating it', { timeout: 30_000 }, () => {
    const { host, asked, snap, worker } = hostOn(5101);
    const guest = new Match(1);
    const offered = worker();
    offerLevel(asked, offered);
    expect(snapLevelAtHand(snap)).toBe(true);
    const before = generated();
    restoreMatch(guest, snap);
    expect(generated()).toBe(before);
    expect(guest.level.theme).toBe(offered.theme);
    expect(hasLevel(levelKey(asked))).toBe(false);
    expect(hashMatch(guest)).toBe(hashMatch(host));
  });

  it('waits for the worker already building it rather than asking for a second build', { timeout: 30_000 }, async () => {
    const { asked, snap, worker } = hostOn(5102);
    let done = () => {};
    const { levels, firsts } = busyWorker(
      asked,
      new Promise<void>((resolve) => {
        done = () => {
          offerLevel(asked, worker());
          resolve();
        };
      }),
    );
    const guest = new Match(1);
    const before = generated();
    const ready = prepareSnapLevel(snap, levels);
    await Promise.resolve();
    expect(snapLevelAtHand(snap)).toBe(false);
    done();
    await ready;
    expect(firsts).toEqual([levelKey(asked)]);
    expect(snapLevelAtHand(snap)).toBe(true);
    restoreMatch(guest, snap);
    expect(generated()).toBe(before);
  });

  it('holds a joining guest until the worker has its level, then syncs to the same state', { timeout: 30_000 }, async () => {
    const { host: match, snap, worker } = hostOn(5103);
    const exact = snapLevel(snap);
    let finish = () => {};
    const asks: string[] = [];
    const levels: LevelSource = {
      building: () => false,
      first: (req) => {
        asks.push(levelKey(req));
        return new Promise((resolve) => {
          finish = () => {
            offerLevel(req, worker());
            resolve();
          };
        });
      },
    };
    const hub = new LoopbackHub({ latency: 20 });
    const host = new NetSession({ transport: hub.transport('aaaa'), match, now: () => hub.now });
    let guest: NetSession | undefined;
    const ticks = (n: number) => {
      for (let i = 0; i < n; i++) {
        hub.advance(1000 / 60);
        host.tick({});
        guest?.tick({});
      }
    };
    ticks(5);
    guest = new NetSession({ transport: hub.transport('bbbb'), match: new Match(1), now: () => hub.now, levels });
    const before = generated();
    ticks(90);
    expect(asks).toContain(levelKey(exact));
    expect(guest.synced).toBe(false);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(guest.synced).toBe(true);
    expect(generated()).toBe(before);
    ticks(30);
    // Freeze the host and let the guest catch up, as net.test.ts settles a room.
    for (let i = 0; i < 60; i++) {
      if (i % 20 === 0) host.flush();
      hub.advance(1000 / 60);
      guest.tick({});
    }
    expect(guest.match.frame).toBe(host.match.frame);
    expect(hashMatch(guest.match)).toBe(hashMatch(host.match));
  });
});
