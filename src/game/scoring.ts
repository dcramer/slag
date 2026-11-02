export const POINTS = {
  finish: 10,
  first: 4,
  trap: 2,
} as const;

/** A finisher trailing the leader earns +1 per this many points behind, up to UNDERDOG_MAX. */
export const UNDERDOG_GAP = 10;
export const UNDERDOG_MAX = 5;

export type Verdict = 'normal' | 'too-easy' | 'too-hard';

export interface Award {
  slot: number;
  points: number;
  reason: 'finish' | 'first' | 'trap' | 'underdog';
}

export interface RoundResult {
  verdict: Verdict;
  awards: Award[];
  finishers: number[];
}

/**
 * Scoring rules (the core tension of the genre):
 * - Nobody finishes → nobody scores ("too hard").
 * - Everybody finishes in a multiplayer game → nobody scores ("too easy").
 * - Otherwise finishers score, the first finisher gets a bonus, and a finisher
 *   earns a small bonus for each *other* player their prop killed. Traps alone
 *   don't pay: you have to reach the flag too.
 * - A finisher trailing the leader going into the round earns an underdog bonus,
 *   so a match stays open without letting anyone leapfrog on one good round.
 */
export function scoreRound(
  slots: readonly number[],
  finishers: readonly number[],
  kills: readonly { victim: number; killer: number }[],
  scores: Readonly<Record<number, number>> = {},
): RoundResult {
  const n = slots.length;
  if (finishers.length === 0) return { verdict: 'too-hard', awards: [], finishers: [...finishers] };
  if (n > 1 && finishers.length === n) return { verdict: 'too-easy', awards: [], finishers: [...finishers] };
  const awards: Award[] = finishers.map((slot) => ({ slot, points: POINTS.finish, reason: 'finish' }));
  if (n > 1) {
    awards.push({ slot: finishers[0], points: POINTS.first, reason: 'first' });
    for (const k of kills) {
      if (k.killer !== k.victim && finishers.includes(k.killer)) awards.push({ slot: k.killer, points: POINTS.trap, reason: 'trap' });
    }
    const leader = Math.max(0, ...slots.map((s) => scores[s] ?? 0));
    for (const slot of finishers) {
      const points = Math.min(UNDERDOG_MAX, Math.floor((leader - (scores[slot] ?? 0)) / UNDERDOG_GAP));
      if (points > 0) awards.push({ slot, points, reason: 'underdog' });
    }
  }
  return { verdict: 'normal', awards, finishers: [...finishers] };
}
