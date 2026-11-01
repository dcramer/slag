export const POINTS = {
  finish: 10,
  first: 4,
  trap: 3,
} as const;

export type Verdict = 'normal' | 'too-easy' | 'too-hard';

export interface Award {
  slot: number;
  points: number;
  reason: 'finish' | 'first' | 'trap';
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
 * - Otherwise finishers score, the first finisher gets a bonus, and each
 *   kill of *another* player by your prop earns you trap points.
 */
export function scoreRound(slots: readonly number[], finishers: readonly number[], kills: readonly { victim: number; killer: number }[]): RoundResult {
  const n = slots.length;
  if (finishers.length === 0) return { verdict: 'too-hard', awards: [], finishers: [...finishers] };
  if (n > 1 && finishers.length === n) return { verdict: 'too-easy', awards: [], finishers: [...finishers] };
  const awards: Award[] = finishers.map((slot) => ({ slot, points: POINTS.finish, reason: 'finish' }));
  if (n > 1) {
    awards.push({ slot: finishers[0], points: POINTS.first, reason: 'first' });
    for (const k of kills) {
      if (k.killer >= 0 && k.killer !== k.victim && slots.includes(k.killer)) awards.push({ slot: k.killer, points: POINTS.trap, reason: 'trap' });
    }
  }
  return { verdict: 'normal', awards, finishers: [...finishers] };
}
