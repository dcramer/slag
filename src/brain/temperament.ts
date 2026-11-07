import { deriveSeed, Rng } from '../core/rng';
import type { Personality } from './personality';

/**
 * What a bot wants, apart from how well it plays (owner decision): its level
 * and personality are its hands, its temperament is who it holds a grudge
 * against and what it does about one. Rolled from the bot's seed at every
 * level, so a bot keeps its temperament when its level changes, and never
 * shown: players work out who's who from how it plays (docs/DESIGN.md →
 * Discovery).
 */
export interface Temperament {
  id: TemperamentId;
  /** Heat a rival earns with it per slight (grudge.ts `Slight`). */
  heat: Record<Slight, number>;
  /** Share of its heat it carries into the next round: how long it remembers. */
  memory: number;
  /** Chance a round, with no grudge to act on, that it takes a hazard and puts it somewhere for the fun of it. */
  mischief: number;
  /** Scales its hands (personality.ts), on top of its level's roll: a speedrunner takes the risky line. */
  hands?: Partial<Record<keyof Personality, number>>;
}

/** What a rival did to earn heat: killed it with a part, put a part on its way, leads on points, took the card it was reaching for. */
export type Slight = 'kill' | 'route' | 'lead' | 'snatch';

/** Heat at which a rival becomes the one it acts against. */
export const GRUDGE = 1;

const defs = {
  /** Plays its own game: builds, forgets a slight by the next round. */
  builder: { heat: { kill: 0.7, route: 0.2, lead: 0, snatch: 0.2 }, memory: 0.2, mischief: 0.03, hands: { care: 1.3, block: 0.6, press: 0.85 } },
  /** Takes the hazard because it's a hazard, and puts it wherever anyone ran, its own way too. */
  gremlin: { heat: { kill: 0.6, route: 0.3, lead: 0.3, snatch: 0.6 }, memory: 0.4, mischief: 0.6, hands: { press: 1.1 } },
  /** Remembers who hurt it, for rounds. */
  grudger: { heat: { kill: 2.5, route: 1.2, lead: 0.2, snatch: 1.2 }, memory: 0.75, mischief: 0.05, hands: { press: 1.15 } },
  /** Goes after whoever leads on points. */
  sheriff: { heat: { kill: 0.8, route: 0.4, lead: 1.6, snatch: 0.3 }, memory: 0.5, mischief: 0.05 },
  /** Only its own race matters: takes the quick, risky line and lets slights go. */
  speedrunner: { heat: { kill: 0.4, route: 0.2, lead: 0, snatch: 0 }, memory: 0.1, mischief: 0, hands: { care: 0.5, think: 0.6, hurry: 1.4 } },
} satisfies Record<string, Omit<Temperament, 'id'>>;

export type TemperamentId = keyof typeof defs;

export const TEMPERAMENTS: Record<TemperamentId, Temperament> = Object.fromEntries(Object.entries(defs).map(([id, t]) => [id, { id, ...t }])) as Record<
  TemperamentId,
  Temperament
>;

export const TEMPERAMENT_IDS = Object.keys(TEMPERAMENTS) as TemperamentId[];

/** The temperament of the bot with `seed`, the same at every level. */
export function rollTemperament(seed: number): Temperament {
  return TEMPERAMENTS[new Rng(deriveSeed(seed, 'temperament')).pick(TEMPERAMENT_IDS)];
}

/** Hands `p` as `mood` plays them. */
export function temper(p: Personality, mood: Temperament): Personality {
  const out = { ...p };
  for (const [k, x] of Object.entries(mood.hands ?? {}) as [keyof Personality, number][]) out[k] = p[k] * x;
  return out;
}
