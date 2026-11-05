export const POINTS = {
  finish: 10,
  /** Rising Slag: the last one standing, or a lone runner who outlasted the slag to the top. */
  survive: 10,
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
  reason: 'finish' | 'first' | 'trap' | 'underdog' | 'survive';
}

export interface RoundResult {
  verdict: Verdict;
  awards: Award[];
  /** Who made it: the flag's finishers in order, or Rising Slag's last ones standing. The score board celebrates them. */
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

/** How a runner's race ended, for modes that score by who outlasted whom. */
export interface Fate {
  slot: number;
  alive: boolean;
  /** Run frame it died on (-1 alive). */
  deathFrame: number;
}

/** A trailing scorer who hasn't scored in a while: the underdog bonus (see scoreRound). */
function underdogs(slots: readonly number[], scorers: readonly number[], standings: Readonly<Record<number, Standing>>): Award[] {
  const leader = Math.max(0, ...slots.map((s) => standings[s]?.score ?? 0));
  return scorers.flatMap((slot) => {
    const s = standings[slot];
    return s && s.score < leader && s.scoreless >= UNDERDOG_ROUNDS ? [{ slot, points: POINTS.underdog, reason: 'underdog' as const }] : [];
  });
}

/**
 * Rising Slag scoring (game/modes.ts):
 * - The last one standing scores. Runners caught on the same last frame share it, unless that's everyone:
 *   a slag that takes the whole field at once scores nothing, as a race nobody finishes doesn't.
 * - Every kill pays its killer, standing or not: shoving is free, but a bonk into the slag or a part's
 *   kill is credited the usual way. A trailing survivor gets the underdog bonus.
 * - Alone, nobody can outlast you, so you score for how far the slag had to climb to catch you:
 *   `progress` is that share of the climb to the top (0…1) for a slot, and reaching the top pays a full win.
 */
export function scoreSurvival(
  fates: readonly Fate[],
  kills: readonly { victim: number; killer: number }[],
  standings: Readonly<Record<number, Standing>> = {},
  progress: (slot: number) => number = () => 0,
): RoundResult {
  const slots = fates.map((f) => f.slot);
  if (fates.length === 1) {
    const f = fates[0];
    const points = f.alive ? POINTS.survive : Math.round(POINTS.survive * Math.max(0, Math.min(1, progress(f.slot))));
    if (points <= 0) return { verdict: 'too-hard', awards: [], finishers: [] };
    return { verdict: 'normal', awards: [{ slot: f.slot, points, reason: 'survive' }], finishers: points === POINTS.survive ? [f.slot] : [] };
  }
  const standing = fates.filter((f) => f.alive);
  const last = Math.max(...fates.map((f) => f.deathFrame));
  const winners = (standing.length ? standing : fates.filter((f) => f.deathFrame === last)).map((f) => f.slot);
  if (winners.length === fates.length) return { verdict: 'too-hard', awards: [], finishers: [] };
  const awards: Award[] = winners.map((slot) => ({ slot, points: POINTS.survive, reason: 'survive' }));
  for (const k of kills) if (k.killer !== k.victim && slots.includes(k.killer)) awards.push({ slot: k.killer, points: POINTS.trap, reason: 'trap' });
  awards.push(...underdogs(slots, winners, standings));
  return { verdict: 'normal', awards, finishers: winners };
}
