import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { doubleFailure, electionSeeds, flakyGuests } from '../lib/election';

/** Host election over many seeded rooms (tests/lib/election.ts); tests/webrtc-transport.test.ts runs a few of them. */
beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('election under varied timing', () => {
  it.each(electionSeeds(32, 1000))('a double failure lands on the third peer, never two hosts, within 10 s (seed %i)', doubleFailure);
  it.each(electionSeeds(24, 2000))(
    'flaky guests: one alone never moves the room, only one host ever runs, and any split is over within 5 s (seed %i)',
    flakyGuests,
  );
});
