export const POINTS = {
  finish: 10,
  first: 4,
  trap: 2,
  underdog: 3,
} as const;

/** Scoreless rounds in a row before a trailing finisher counts as an underdog. */
export const UNDERDOG_ROUNDS = 2;

/** Where a player stands going into a round. */
export interface Standing {
  score: number;
  /** Rounds in a row without a point. */
  scoreless: number;
}

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
 * - A trailing finisher who hasn't scored in a while earns an underdog bonus, so
 *   a stuck player stays in it without rewarding merely being behind.
 */
export function scoreRound(
  slots: readonly number[],
  finishers: readonly number[],
  kills: readonly { victim: number; killer: number }[],
  standings: Readonly<Record<number, Standing>> = {},
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
    const leader = Math.max(0, ...slots.map((s) => standings[s]?.score ?? 0));
    for (const slot of finishers) {
      const s = standings[slot];
      if (s && s.score < leader && s.scoreless >= UNDERDOG_ROUNDS) awards.push({ slot, points: POINTS.underdog, reason: 'underdog' });
    }
  }
  return { verdict: 'normal', awards, finishers: [...finishers] };
}
