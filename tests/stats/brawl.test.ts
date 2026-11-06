import { describe, expect, it } from 'vitest';
import { BRAWL_ROUNDS } from '../../src/game/expectations';
import { type BotRound, botRound, botRounds } from '../lib/bot-race';

/**
 * Brawl with bots (src/game/expectations.ts `BRAWL_ROUNDS`, docs/MODES.md → Brawl): four Normal bots, how often a
 * round is a draw, how long rounds run, and the share of deaths a rival's knock put there. On the bare arena (round 1
 * before anyone has placed a part, `botRound`) and through the first rounds of a match, picking and placing, as the
 * parts pile up (`botRounds`).
 */
const BARE_SEEDS = Array.from({ length: 48 }, (_, i) => i + 1);
const MATCH_SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const ROUNDS = 4;
/** Past the round's own 60 s cap: every round ends by itself. */
const LIMIT = 61 * 60;

type Arena = keyof typeof BRAWL_ROUNDS.bands;

interface Measure {
  draws: number;
  seconds: number;
  knocked: number;
}

function measure(name: Arena, rounds: BotRound[]): Measure {
  let deaths = 0;
  let knocked = 0;
  const causes: Record<string, number> = {};
  for (const r of rounds)
    for (const [k, n] of Object.entries(r.causes)) {
      causes[k] = (causes[k] ?? 0) + n;
      deaths += n;
      if (k.endsWith('+')) knocked += n;
    }
  const secs = rounds.map((r) => r.frames / 60);
  const m = {
    draws: rounds.filter((r) => r.winner < 0).length / rounds.length,
    seconds: secs.reduce((a, b) => a + b, 0) / rounds.length,
    knocked: knocked / deaths,
  };
  const within = secs.filter((s) => s >= BRAWL_ROUNDS.targets.seconds[0] && s <= BRAWL_ROUNDS.targets.seconds[1]).length;
  console.log(
    `${name}: ${rounds.length} rounds, ${Math.round(m.draws * 100)}% draws, ${m.seconds.toFixed(1)} s a round (${within} in 20–40 s), ${Math.round(m.knocked * 100)}% of ${deaths} deaths knocked into it; ${JSON.stringify(causes)}`,
  );
  return m;
}

describe('Brawl with bots', () => {
  const measured = new Map<Arena, Measure>();
  const get = (k: Arena) => {
    let m = measured.get(k);
    if (!m) {
      m =
        k === 'bare'
          ? measure(
              k,
              BARE_SEEDS.map((s) => botRound(s, { mode: 'brawl', limit: LIMIT })),
            )
          : measure(
              k,
              MATCH_SEEDS.flatMap((s) => botRounds(s, ROUNDS, { limit: LIMIT })),
            );
      measured.set(k, m);
    }
    return m;
  };

  for (const k of ['bare', 'placed'] as const)
    for (const what of ['draws', 'seconds', 'knocked'] as const)
      it(`${k}: ${what} about as they were`, { timeout: 600_000 }, () => {
        const [lo, hi] = BRAWL_ROUNDS.bands[k][what];
        const got = get(k)[what];
        expect(got).toBeGreaterThanOrEqual(lo);
        expect(got).toBeLessThanOrEqual(hi);
      });
});
