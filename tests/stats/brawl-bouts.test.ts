import { describe, expect, it } from 'vitest';
import { type BotMatchTime, botMatchTime } from '../lib/bot-race';

/**
 * What bouts per placement buy a brawl (docs/MODES.md → Brawl, the round-length and match rows): four Normal bots
 * playing whole matches with the lobby's rules, one bout a placement against Brawl's own three, and the share of the
 * match spent fighting rather than picking and placing. Sixteen seeds (about 5 min): four once failed the picking band
 * by 0.0002, and 2,000 draws of sixteen from seeds 1–40 never did (12, 1 in 130).
 */
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

function measure(bouts: number) {
  const runs: BotMatchTime[] = SEEDS.map((s) => botMatchTime(s, { bouts }));
  const sum = (k: 'pick' | 'place' | 'run' | 'score') => runs.reduce((a, r) => a + (r.frames[k] ?? 0), 0);
  const all = sum('pick') + sum('place') + sum('run') + sum('score');
  const fight = sum('run') / all;
  const between = (sum('pick') + sum('place')) / all;
  const per = (n: number) => (n / runs.length).toFixed(1);
  const rounds = runs.reduce((a, r) => a + r.rounds, 0);
  const placements = runs.reduce((a, r) => a + r.placements, 0);
  console.log(
    `${bouts} bout(s): fighting ${Math.round(fight * 100)}%, picking and placing ${Math.round(between * 100)}%, scores ${Math.round((sum('score') / all) * 100)}%; ` +
      `${per(all / 3600)} min a match, ${per(rounds)} rounds, ${per(placements)} placements; ` +
      `${(sum('run') / rounds / 60).toFixed(1)} s a race, ${((sum('pick') + sum('place')) / placements / 60).toFixed(1)} s a pick and place`,
  );
  return { fight, between, ended: runs.every((r) => r.ended) };
}

describe('Brawl bouts', () => {
  it('fights more of the match on three bouts a placement than on one', { timeout: 1_200_000 }, () => {
    const one = measure(1);
    const three = measure(3);
    expect(one.ended && three.ended).toBe(true);
    expect(three.fight).toBeGreaterThan(one.fight);
    expect(three.between).toBeLessThan(one.between / 2);
  });
});
