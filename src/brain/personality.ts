import { deriveSeed, Rng } from '../core/rng';
import type { BotLevel } from '../game/match';

/**
 * A bot's own way of playing, rolled from its seed inside the range its level
 * (Player.bot) allows: two Normal bots play differently, and a Hard one is quick
 * and clean where an Easy one dithers and fumbles. The motor reads the hands
 * (reaction, slip, margin, hurry), the brain the pace.
 */
export interface Personality {
  /** Frames it takes to see what's next after a landing or a surprise, holding what it held meanwhile. */
  reaction: number;
  /** Chance a jump comes out a little off (pressed late or let go early), played through without correcting. */
  slip: number;
  /** Px of room it keeps from anything that hurts: a careful bot keeps more. */
  margin: number;
  /** Route units it would rather lose on a clear move than wait for a hazard to pass: an impatient bot goes the long way round. */
  hurry: number;
  /** Scales how long it takes over the crate and over placing. */
  pace: number;
}

type Ranges = { [K in keyof Personality]: readonly [number, number] };

const RANGES: Record<BotLevel, Ranges> = {
  easy: { reaction: [8, 16], slip: [0.1, 0.2], margin: [2.5, 4], hurry: [6, 12], pace: [1.2, 1.6] },
  normal: { reaction: [2, 6], slip: [0.03, 0.08], margin: [2, 3], hurry: [8, 18], pace: [0.85, 1.2] },
  hard: { reaction: [0, 1], slip: [0, 0.01], margin: [2, 2.5], hurry: [10, 16], pace: [0.35, 0.55] },
};

/** The personality of the bot with `seed` at `level`. The same seed sits at the same place in every level's range. */
export function rollPersonality(seed: number, level: BotLevel): Personality {
  const rng = new Rng(deriveSeed(seed, 'personality'));
  const r = RANGES[level];
  const roll = ([lo, hi]: readonly [number, number]) => rng.range(lo, hi);
  return { reaction: Math.round(roll(r.reaction)), slip: roll(r.slip), margin: roll(r.margin), hurry: roll(r.hurry), pace: roll(r.pace) };
}
