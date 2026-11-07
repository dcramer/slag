import { describe, expect, it } from 'vitest';
import { type BotMatchTime, botMatchTime } from '../lib/bot-race';

/**
 * What a brawl pays for (docs/MODES.md → Brawl, the match row): four Normal bots playing whole matches with the lobby's
 * rules, then the same with one seat standing still through every fight. Knockouts should be what wins a match, and
 * waiting it out shouldn't (owner decision: "you shouldn't be able to win by just standing around").
 */
const SEEDS = [1, 2, 3, 4, 5, 6];

const total = (r: BotMatchTime, seat: number) => Object.values(r.points[seat]).reduce((a, b) => a + b, 0);

function report(label: string, runs: BotMatchTime[]) {
  const rounds = runs.reduce((a, r) => a + r.rounds, 0) / runs.length;
  const by: Record<string, number> = {};
  for (const r of runs) for (const p of r.points) for (const [k, v] of Object.entries(p)) by[k] = (by[k] ?? 0) + v;
  const all = Object.values(by).reduce((a, b) => a + b, 0);
  const shares = Object.entries(by)
    .map(([k, v]) => `${k} ${Math.round((v / all) * 100)}%`)
    .join(', ');
  console.log(`${label}: ${rounds.toFixed(1)} rounds a match, ${(all / runs.length).toFixed(0)} points a match (${shares})`);
}

describe('Brawl knockouts', () => {
  it('wins a match with knockouts, not by waiting it out', { timeout: 1_800_000 }, () => {
    const fair = SEEDS.map((s) => botMatchTime(s));
    report('four fighters', fair);
    // A match's top knocker among its winners.
    const knockerWins = fair.filter((r) => r.winners.some((w) => r.knockouts[w] === Math.max(...r.knockouts))).length;
    console.log(`top knocker wins ${knockerWins} of ${fair.length}; knockouts per seat ${fair.map((r) => r.knockouts.join('/')).join(' ')}`);

    const idle = SEEDS.map((s) => botMatchTime(s, { idle: 0 }));
    report('one standing still', idle);
    const still = idle.reduce((a, r) => a + total(r, 0), 0) / idle.length;
    const fighters = idle.reduce((a, r) => a + (total(r, 1) + total(r, 2) + total(r, 3)) / 3, 0) / idle.length;
    const stillWins = idle.filter((r) => r.winners.includes(0)).length;
    console.log(`standing still: ${still.toFixed(1)} points a match against the fighters' ${fighters.toFixed(1)}, won ${stillWins} of ${idle.length}`);

    expect(fair.every((r) => r.ended) && idle.every((r) => r.ended)).toBe(true);
    expect(knockerWins).toBeGreaterThan(fair.length / 2);
    expect(still).toBeLessThan(fighters);
  });
});
