import { describe, expect, it } from 'vitest';
import type { Personality } from '../../src/brain/personality';
import { LEAD_HOLDS, SLAG_ROUNDS } from '../../src/game/expectations';
import { botRound } from '../lib/bot-race';

/**
 * Catch-up in Rising Slag (src/game/expectations.ts `LEAD_HOLDS`, docs/DESIGN.md → Difficulty): how often whoever
 * leads 15 s after GO wins the round, four Normal bots on a bare loop. Three ways: the loop's boxes as built; the
 * boxes' deal reaching every empty hand every 5 s, used by the bots' item tactics (src/brain/tactics.ts); and the
 * same deal never used (`knack` 0). Rounds over by 15 s, or ending in a tie, aren't counted. The bands hold what's
 * measured since the leader's screen (src/sim/screen.ts) brought it to about half, and how often the lead changes
 * hands (`LEAD_HOLDS`). The boxes' runs also say how long a round lasts (`SLAG_ROUNDS`). Each prints who went out
 * to what: off the bottom of the screen, into the slag, or a hazard.
 */
const SEEDS = Array.from({ length: 128 }, (_, i) => i + 1);
const DEAL = 5 * 60;
const bare = (p: Personality): Personality => ({ ...p, knack: 0 });
/** Uses per item kind in the `items` runs: catch-up needs the pack to use what it's dealt. */
const itemUses: Record<string, number> = {};
/** Seconds each round of the `boxes` runs lasted, from GO: the game as built. */
const lengths: number[] = [];
/** Lead changes a round in each run. */
const changes = new Map<string, number>();

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

function holds(name: string, opts: Parameters<typeof botRound>[1]): number {
  let held = 0;
  let judged = 0;
  let early = 0;
  let leads = 0;
  let bumps = 0;
  const used: Record<string, number> = {};
  const out: Record<string, number> = {};
  for (const seed of SEEDS) {
    const r = botRound(seed, { ...opts, at: LEAD_HOLDS.at, limit: 3 * 60 * 60 });
    if (r.leader < 0) early++;
    if (name === 'boxes') lengths.push(r.frames / 60);
    leads += r.leads;
    bumps += r.bumps;
    if (r.leader >= 0 && r.winner >= 0) {
      judged++;
      if (r.leader === r.winner) held++;
    }
    for (const [k, n] of Object.entries(r.causes)) out[k.replace('+', '')] = (out[k.replace('+', '')] ?? 0) + n;
    for (const [k, n] of Object.entries(r.uses)) {
      used[k] = (used[k] ?? 0) + n;
      if (name === 'items') itemUses[k] = (itemUses[k] ?? 0) + n;
    }
  }
  const rate = held / judged;
  changes.set(name, leads / SEEDS.length);
  const secs = name === 'boxes' ? `, median round ${median(lengths).toFixed(1)} s` : '';
  const gone = Object.values(out).reduce((a, b) => a + b, 0);
  const by = Object.entries(out)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k} ${Math.round((100 * n) / gone)}%`)
    .join(', ');
  console.log(
    `${name}: the 15 s leader won ${held} of ${judged} (${Math.round(rate * 100)}%), ${early} over by then${secs}; ${(leads / SEEDS.length).toFixed(1)} lead changes and ${(bumps / SEEDS.length).toFixed(1)} bumps a round; out to ${by}; used ${JSON.stringify(used)}`,
  );
  return rate;
}

describe('Rising Slag catch-up', () => {
  const rates = new Map<keyof typeof LEAD_HOLDS.bands, number>();
  const rate = (k: keyof typeof LEAD_HOLDS.bands) => {
    let got = rates.get(k);
    if (got === undefined) {
      got = k === 'boxes' ? holds(k, {}) : holds(k, { deal: DEAL, ...(k === 'bare' && { hands: bare }) });
      rates.set(k, got);
    }
    return got;
  };

  for (const k of ['boxes', 'items', 'bare'] as const)
    it(`the leader at 15 s wins about as often as it did (${k})`, { timeout: 600_000 }, () => {
      const [lo, hi] = LEAD_HOLDS.bands[k];
      expect(rate(k)).toBeGreaterThanOrEqual(lo);
      expect(rate(k)).toBeLessThanOrEqual(hi);
    });

  it('the lead changes hands: the screen holds a leader who pulls away', { timeout: 600_000 }, () => {
    rate('boxes');
    const [lo, hi] = LEAD_HOLDS.leads;
    expect(changes.get('boxes')).toBeGreaterThanOrEqual(lo);
    expect(changes.get('boxes')).toBeLessThanOrEqual(hi);
  });

  it('rounds last: few are over by 15 s, and the median is a short round', { timeout: 600_000 }, () => {
    rate('boxes');
    expect(lengths.filter((t) => t < LEAD_HOLDS.at / 60).length / SEEDS.length).toBeLessThanOrEqual(SLAG_ROUNDS.early);
    expect(median(lengths)).toBeGreaterThanOrEqual(SLAG_ROUNDS.median[0]);
    expect(median(lengths)).toBeLessThanOrEqual(SLAG_ROUNDS.median[1]);
  });

  it('bots use the items they hold', { timeout: 600_000 }, () => {
    rate('items');
    expect(Object.values(itemUses).reduce((a, b) => a + b, 0)).toBeGreaterThan(SEEDS.length);
  });
});
