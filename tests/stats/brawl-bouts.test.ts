import { describe, expect, it } from 'vitest';
import type { Phase } from '../../src/game/match';
import { type BotMatchTime, botMatchTime } from '../lib/bot-race';

/**
 * What bouts per placement buy a brawl (docs/MODES.md → Brawl, the round-length and match rows): four Normal bots
 * playing whole matches with the lobby's rules, one bout a placement against Brawl's own three, and the share of the
 * time spent fighting rather than picking and placing. Sixteen seeds (about 8 min).
 *
 * Compared on the same parts: the first `PLACEMENTS` placements of each match, with their picks and places, the bouts
 * fought on them and those bouts' score cards. Over whole matches parts pile up three times faster under one bout, and a
 * crowded arena runs longer races (16.3 s a race on the first two placements, 19.1 s after, seeds 1–40), which would
 * decide it instead of the bouts. Two, because every match reaches the second placement under either count; a
 * three-bout match often ends on the third's first bout, a whole pick paid for one race. The whole-match shares are
 * printed beside them. On seeds 1–40 the three-bout picking share is 0.44 of the one-bout share (0.5 passes), and 2,000
 * draws of sixteen of them failed once (the worst 0.503).
 */
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const PLACEMENTS = 2;

type Frames = Partial<Record<Phase, number>>;

/** Shares of `frames` (summed over matches) spent fighting, picking and placing, and on score cards. */
function shares(frames: Frames[]) {
  const sum = (k: Phase) => frames.reduce((a, f) => a + (f[k] ?? 0), 0);
  const all = sum('pick') + sum('place') + sum('run') + sum('score');
  return {
    all,
    run: sum('run'),
    between: sum('pick') + sum('place'),
    fight: sum('run') / all,
    picking: (sum('pick') + sum('place')) / all,
    scores: sum('score') / all,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function measure(bouts: number) {
  const runs: BotMatchTime[] = SEEDS.map((s) => botMatchTime(s, { bouts }));
  const whole = shares(runs.map((r) => r.frames));
  const rounds = runs.reduce((a, r) => a + r.rounds, 0);
  const placements = runs.reduce((a, r) => a + r.placements, 0);
  const same = shares(runs.flatMap((r) => r.byPlacement.slice(0, PLACEMENTS)));
  const races = runs.reduce((a, r) => a + r.boutsOn.slice(0, PLACEMENTS).reduce((b, n) => b + n, 0), 0);
  const per = (n: number) => (n / runs.length).toFixed(1);
  console.log(
    `${bouts} bout(s), placements 1–${PLACEMENTS}: fighting ${pct(same.fight)}, picking and placing ${pct(same.picking)} (${same.picking.toFixed(4)}), scores ${pct(same.scores)}; ` +
      `${per(races)} races, ${(same.run / races / 60).toFixed(1)} s a race\n` +
      `  whole match: fighting ${pct(whole.fight)}, picking and placing ${pct(whole.picking)} (${whole.picking.toFixed(4)}), scores ${pct(whole.scores)}; ` +
      `${per(whole.all / 3600)} min a match, ${per(rounds)} rounds, ${per(placements)} placements; ` +
      `${(whole.run / rounds / 60).toFixed(1)} s a race, ${(whole.between / placements / 60).toFixed(1)} s a pick and place`,
  );
  return { fight: same.fight, between: same.picking, reached: runs.every((r) => r.placements >= PLACEMENTS), ended: runs.every((r) => r.ended) };
}

describe('Brawl bouts', () => {
  it('fights more of the same placements on three bouts a placement than on one', { timeout: 1_200_000 }, () => {
    const one = measure(1);
    const three = measure(3);
    expect(one.ended && three.ended).toBe(true);
    expect(one.reached && three.reached).toBe(true);
    expect(three.fight).toBeGreaterThan(one.fight);
    expect(three.between).toBeLessThan(one.between / 2);
  });
});
