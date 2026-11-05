import { deriveSeed, Rng } from '../core/rng';
import type { BotLevel } from '../game/match';

/**
 * A bot's own way of playing, rolled from its seed inside the range its level
 * (Player.bot) allows: two Normal bots play differently, and a Hard one is quick
 * and clean where an Easy one dithers and fumbles. No level is flawless (owner
 * decision): a Hard bot still fumbles, chokes on the tight jumps,
 * stops to think on ground it doesn't know and now and then takes a worse
 * line, so a hard level beats it some of the time. It gets harder by being
 * quicker to save a fumble, slower to doubt and better at seeing the forgiving way, not by never making one. The
 * motor reads the hands (everything but pace and spite), the brain the pace
 * and spite: a harder bot is meaner, and better at it.
 */
export interface Personality {
  /** Frames it takes to see what's next after a landing or a surprise, holding what it held meanwhile. */
  reaction: number;
  /** Chance a jump comes out a little off: let go early, pressed a beat late or early, or carried on through the landing (gen/level/precision.ts `slip`). */
  slip: number;
  /** Px of room it keeps from anything that hurts: a careful bot keeps more. */
  margin: number;
  /** Route units it would rather lose on a clear move than wait for a hazard to pass: an impatient bot goes the long way round. */
  hurry: number;
  /** Scales how long it takes over the crate and over placing. */
  pace: number;
  /** Times `slip` on a tight jump (one some slip turns into a fall: gen/level/precision.ts `fatalSlips`), and again with a rival at its heels. */
  choke: number;
  /** Frames a fumbled jump plays out as pressed before it steers again: a steady bot saves one at once. */
  save: number;
  /** Chance it stops to think before a tight jump, or where a hazard made it weigh its moves. Less where it has thought before. */
  think: number;
  /** Frames a pause to think lasts, about. */
  muse: number;
  /** Chance a pause to think ends on a worse line than the best: it doubles back later. */
  stray: number;
  /** Route units it would give up to take a safe move over a tight jump: a careful bot takes the forgiving way. */
  care: number;
  /** Chance a round it acts on a grudge (temperament.ts), and that it does it well: picks the spot that hurts and still leaves a way through. */
  spite: number;
}

type Ranges = { [K in keyof Personality]: readonly [number, number] };

const RANGES: Record<BotLevel, Ranges> = {
  easy: {
    reaction: [10, 18],
    slip: [0.2, 0.3],
    margin: [2.5, 4],
    hurry: [6, 12],
    pace: [1.2, 1.6],
    choke: [2, 2.6],
    save: [8, 14],
    think: [0.5, 0.8],
    muse: [45, 80],
    stray: [0.2, 0.35],
    care: [0, 8],
    spite: [0.2, 0.35],
  },
  normal: {
    reaction: [5, 10],
    slip: [0.1, 0.15],
    margin: [2, 3],
    hurry: [8, 18],
    pace: [0.85, 1.2],
    choke: [1.7, 2.3],
    save: [4, 8],
    think: [0.3, 0.5],
    muse: [30, 55],
    stray: [0.1, 0.2],
    care: [10, 25],
    spite: [0.45, 0.6],
  },
  hard: {
    reaction: [2, 5],
    slip: [0.05, 0.07],
    margin: [2, 2.5],
    hurry: [10, 16],
    pace: [0.35, 0.55],
    choke: [1.6, 2.1],
    save: [0, 3],
    think: [0.15, 0.3],
    muse: [18, 35],
    stray: [0.03, 0.08],
    care: [15, 30],
    spite: [0.8, 0.95],
  },
};

/** The personality of the bot with `seed` at `level`. The same seed sits at the same place in every level's range. */
export function rollPersonality(seed: number, level: BotLevel): Personality {
  const rng = new Rng(deriveSeed(seed, 'personality'));
  const r = RANGES[level];
  const roll = ([lo, hi]: readonly [number, number]) => rng.range(lo, hi);
  return {
    reaction: Math.round(roll(r.reaction)),
    slip: roll(r.slip),
    margin: roll(r.margin),
    hurry: roll(r.hurry),
    pace: roll(r.pace),
    choke: roll(r.choke),
    save: Math.round(roll(r.save)),
    think: roll(r.think),
    muse: roll(r.muse),
    stray: roll(r.stray),
    care: roll(r.care),
    spite: roll(r.spite),
  };
}

/**
 * Hands with no lapses and no lag: no fumbles, no pauses to think, no wrong
 * turns, and it sees what's next at once. Only for measuring the motor itself
 * (tests/stats/bot-hard-routes.test.ts and the motor's regressions), where a
 * bot's mistakes would hide whether its moves and the route still agree.
 */
export function steady(p: Personality): Personality {
  return { ...p, reaction: 0, slip: 0, think: 0, stray: 0 };
}
