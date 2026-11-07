export const POINTS = {
  finish: 10,
  /** Rising Slag: the last one standing, or a lone runner who outlasted the slag to the top. */
  survive: 10,
  first: 4,
  trap: 2,
  /**
   * A race's comeback: a trailing finisher who hadn't scored in a while. Most of a finish again, as the build-then-race
   * party game pays its comeback four fifths of a finish (docs/MODES.md → Race).
   */
  underdog: 8,
  /** The same for a trailing scorer in a mode scored by outlasting or by knockouts (Rising Slag, Brawl). */
  survivor: 3,
  /** Brawl: each rival knocked out (`scoreKnockouts`). */
  knockout: 5,
  /**
   * Brawl: the last one standing, one knockout's worth, so two knockouts beat hiding to the end. At 5 a match of four
   * bots runs the 8.5 bouts it did on the old 10 a win and 2 a kill; at 4 or 3 it ran 9.3 and 10 (docs/MODES.md → Brawl).
   */
  lastStanding: 5,
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
  reason: 'finish' | 'first' | 'trap' | 'underdog' | 'survive' | 'knockout';
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
function underdogs(
  slots: readonly number[],
  scorers: readonly number[],
  standings: Readonly<Record<number, Standing>>,
  points: number = POINTS.survivor,
): Award[] {
  const leader = Math.max(0, ...slots.map((s) => standings[s]?.score ?? 0));
  return scorers.flatMap((slot) => {
    const s = standings[slot];
    return s && s.score < leader && s.scoreless >= UNDERDOG_ROUNDS ? [{ slot, points, reason: 'underdog' as const }] : [];
  });
}

/** Rising Slag's points by place, the last one standing first: who outlasted the most of the field. */
export const SURVIVE_PLACES = [POINTS.survive, 6, 3] as const;

/**
 * Rising Slag scoring (game/modes.ts):
 * - The field scores by how long it outlasted the slag: the last one standing, then the last to fall before
 *   them, then the one before that (`SURVIVE_PLACES`), so a round pays more than its winner, as a race pays
 *   every finisher. Never everyone: the first one out always gets nothing, so a duel pays only its winner.
 *   Runners caught on the same frame share the better place, and a slag that takes the whole field at once
 *   scores nothing, as a race nobody finishes doesn't.
 * - Every kill pays its killer, standing or not: shoving is free, but a bonk into the slag or a part's
 *   kill is credited the usual way. A trailing scorer gets the underdog bonus.
 * - Alone, nobody can outlast you, so you score for how far the slag had to climb to catch you:
 *   `progress` is that share of the climb to the top (0…1) for a slot, and reaching the top pays a full win.
 */
export function scoreSurvival(
  fates: readonly Fate[],
  kills: readonly { victim: number; killer: number }[],
  standings: Readonly<Record<number, Standing>> = {},
  progress: (slot: number) => number = () => 0,
): RoundResult {
  const places = SURVIVE_PLACES;
  const slots = fates.map((f) => f.slot);
  if (fates.length === 1) {
    const f = fates[0];
    const points = f.alive ? POINTS.survive : Math.round(POINTS.survive * Math.max(0, Math.min(1, progress(f.slot))));
    if (points <= 0) return { verdict: 'too-hard', awards: [], finishers: [] };
    return { verdict: 'normal', awards: [{ slot: f.slot, points, reason: 'survive' }], finishers: points === POINTS.survive ? [f.slot] : [] };
  }
  // Outlasting order: whoever's standing, then the latest caught first. A frame's worth of deaths is one place.
  const when = (f: Fate) => (f.alive ? Infinity : f.deathFrame);
  const order = [...fates].sort((a, b) => when(b) - when(a));
  if (when(order[0]) === when(order[order.length - 1])) return { verdict: 'too-hard', awards: [], finishers: [] };
  const awards: Award[] = [];
  let place = 0;
  for (let i = 0; i < order.length && place < places.length && i < order.length - 1;) {
    const tied = order.filter((f) => when(f) === when(order[i]));
    // The first ones out never score, however the ties fall.
    if (i + tied.length >= order.length) break;
    for (const f of tied) awards.push({ slot: f.slot, points: places[place], reason: 'survive' });
    i += tied.length;
    place += tied.length;
  }
  const winners = order.filter((f) => when(f) === when(order[0])).map((f) => f.slot);
  for (const k of kills) if (k.killer !== k.victim && slots.includes(k.killer)) awards.push({ slot: k.killer, points: POINTS.trap, reason: 'trap' });
  awards.push(
    ...underdogs(
      slots,
      awards.filter((a) => a.reason === 'survive').map((a) => a.slot),
      standings,
    ),
  );
  return { verdict: 'normal', awards, finishers: winners };
}

/**
 * Brawl scoring (game/modes.ts): a fight pays for what you did to the field, not for waiting it out (owner decision:
 * "you shouldn't be able to win by just standing around").
 * - Every rival you knocked out pays `POINTS.knockout`, standing or not, and in a draw too: the knockout happened.
 *   A kill is yours when the run credits it (sim/items/world.ts `creditKill`): your item hit, body check or part, or
 *   the level soon after your knock. A fall of your own, or one nobody knocked, pays nobody.
 * - The last one standing gets `POINTS.lastStanding`, one knockout's worth, so whoever knocked out two and then fell
 *   beats whoever hid to the end. Nobody standing, or the last ones caught on the same frame, is a draw: no win.
 * - A trailing scorer who hadn't scored in a while gets the underdog bonus, as in the other modes.
 */
export function scoreKnockouts(
  fates: readonly Fate[],
  kills: readonly { victim: number; killer: number }[],
  standings: Readonly<Record<number, Standing>> = {},
): RoundResult {
  const slots = fates.map((f) => f.slot);
  const awards: Award[] = [];
  // The last one out, even if the slag caught them in the beat after the round ended.
  const when = (f: Fate) => (f.alive ? Infinity : f.deathFrame);
  const last = Math.max(...fates.map(when));
  const top = fates.filter((f) => when(f) === last);
  const winners = fates.length > 1 && top.length === 1 ? [top[0].slot] : [];
  for (const slot of winners) awards.push({ slot, points: POINTS.lastStanding, reason: 'survive' });
  for (const k of kills) if (k.killer !== k.victim && slots.includes(k.killer)) awards.push({ slot: k.killer, points: POINTS.knockout, reason: 'knockout' });
  awards.push(...underdogs(slots, [...new Set(awards.map((a) => a.slot))], standings));
  return { verdict: awards.length ? 'normal' : 'too-hard', awards, finishers: winners };
}
