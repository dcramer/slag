import { describe, expect, it } from 'vitest';
import { BRAWL_ROUNDS, type BrawlMeasure } from '../../src/game/expectations';
import { type BotRound, botRound, botRounds } from '../lib/bot-race';

/**
 * Brawl with bots (src/game/expectations.ts `BRAWL_ROUNDS`, docs/MODES.md → Brawl): four Normal bots, how often a
 * round is a draw, how long rounds run, the share of deaths a rival's knock put there, and how hard it's fought:
 * how soon they meet and hit, how often they swing, and how much they stand still, back off or keep their distance. On the bare arena (round 1
 * before anyone has placed a part, `botRound`) and through the first rounds of a match, picking and placing, as the
 * parts pile up (`botRounds`).
 */
const BARE_SEEDS = Array.from({ length: 48 }, (_, i) => i + 1);
const MATCH_SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const ROUNDS = 4;
/** Past the round's own 60 s cap: every round ends by itself. */
const LIMIT = 61 * 60;

type Arena = keyof typeof BRAWL_ROUNDS.bands;

/** What `BRAWL_ROUNDS` bands (`tests/lib/bot-race.ts` `Fight` for the fight's own). */
interface Measure extends Record<BrawlMeasure, number> {
  draws: number;
  seconds: number;
  knocked: number;
  /** Seconds from GO to the first touch or bonk, and to the first bonk, mean over rounds (a round with none counts its length). */
  contact: number;
  hit: number;
  /** Items used a round. */
  uses: number;
  /** Shares of the frames someone was in it standing still, and moving away from the nearest rival, and the mean tiles to that rival. */
  still: number;
  retreat: number;
  gap: number;
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
  const sum = (f: (r: BotRound) => number) => rounds.reduce((a, r) => a + f(r), 0);
  const frames = sum((r) => r.fight.frames);
  const m: Measure = {
    draws: rounds.filter((r) => r.winner < 0).length / rounds.length,
    seconds: secs.reduce((a, b) => a + b, 0) / rounds.length,
    knocked: knocked / deaths,
    contact: sum((r) => (r.fight.contact < 0 ? r.frames : r.fight.contact)) / 60 / rounds.length,
    hit: sum((r) => (r.fight.hit < 0 ? r.frames : r.fight.hit)) / 60 / rounds.length,
    uses: sum((r) => Object.values(r.uses).reduce((a, b) => a + b, 0)) / rounds.length,
    still: sum((r) => r.fight.still) / frames,
    retreat: sum((r) => r.fight.retreat) / frames,
    gap: sum((r) => r.fight.gap) / frames,
  };
  const within = secs.filter((s) => s >= BRAWL_ROUNDS.targets.seconds[0] && s <= BRAWL_ROUNDS.targets.seconds[1]).length;
  const quick = rounds.filter((r) => r.frames < 10 * 60);
  // A quick round nobody was knocked or shoved out of: the field walked into the level by itself.
  const blind = quick.filter((r) => r.fight.shoved === 0 && !Object.keys(r.causes).some((k) => k.endsWith('+'))).length;
  console.log(
    `${name}: ${rounds.length} rounds, ${Math.round(m.draws * 100)}% draws, ${m.seconds.toFixed(1)} s a round (${within} in 20–40 s, ${rounds.filter((r) => r.frames < 15 * 60).length} under 15 s, ${quick.length} under 10 s, ${blind} with nobody knocked or shoved), ${Math.round(m.knocked * 100)}% of ${deaths} deaths knocked into it; ${JSON.stringify(causes)}`,
  );
  console.log(
    `${name}: first contact ${m.contact.toFixed(1)} s, first bonk ${m.hit.toFixed(1)} s, ${(sum((r) => r.fight.bonks) / rounds.length).toFixed(1)} bonks and ${m.uses.toFixed(1)} uses a round, ${Math.round(m.still * 100)}% still, ${Math.round(m.retreat * 100)}% retreating, ${m.gap.toFixed(1)} tiles to the nearest rival, ${sum((r) => r.fight.shoved)} deaths shoved, ${Math.round(
      (sum((r) => r.fight.safe) /
        Math.max(
          1,
          sum((r) => r.fight.grounded),
        )) *
        100,
    )}% of the time on the ground somewhere safe`,
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
    for (const what of Object.keys(BRAWL_ROUNDS.bands[k]) as BrawlMeasure[])
      it(`${k}: ${what} about as they were`, { timeout: 600_000 }, () => {
        const [lo, hi] = BRAWL_ROUNDS.bands[k][what];
        const got = get(k)[what];
        expect(got).toBeGreaterThanOrEqual(lo);
        expect(got).toBeLessThanOrEqual(hi);
      });
});
