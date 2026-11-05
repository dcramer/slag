import { expect } from 'vitest';
import { Rng } from '../../src/core/rng';
import { World } from './net-world';

/**
 * Seeded rooms over the knobs that decide who hears what when: API latency per peer, whether a dead peer's
 * handshake fails or hangs, when the second host dies (before, while or after answering). Each seed is one
 * deterministic room. tests/webrtc-transport.test.ts runs a few on every check, tests/stats/election.test.ts all.
 * Both need fake timers (`vi.useFakeTimers`).
 */
export const electionSeeds = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i);

/** The host and then the next in line crash: the third peer hosts, never two at once, within 10 s. */
export async function doubleFailure(seed: number) {
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
}

/** Guests that can't reach the host for a while: one alone never moves the room, and any split is over within 5 s. */
export async function flakyGuests(seed: number) {
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
}
