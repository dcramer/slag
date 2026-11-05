import { deriveSeed } from '../core/rng';
import type { BotLevel, Match } from '../game/match';
import type { InputFrame } from '../sim/types';
import { botDevice, isBotDevice } from './device';
import { Motor } from './motor';
import { type Personality, rollPersonality } from './personality';
import { rollTemperament, type Temperament, temper } from './temperament';
import { BRAINS, type BrainId } from './registry';
import type { Brain, Intent } from './types';
import { senseView } from './view';

interface Bot {
  kind: BrainId;
  seed: number;
  /** The level its personality was rolled at: its seat's (Player.bot) changing rolls it again. */
  level: BotLevel;
  /** What it wants, the same at every level. */
  mood: Temperament;
  brain: Brain;
  motor: Motor;
  /** It has had a seat: losing it now (a watch, a kick, the lobby emptied) lets the bot go. */
  seated: boolean;
  /** What it last meant to do: kept while the machine has no time for it to think (BotBudget). */
  intent: Intent;
}

/**
 * Wall-clock time this machine gives its bots: every bot gets a full think
 * until `now()` reaches `until`, and the rest play on with their last intent
 * (Motor.drive `rushed`) and think on a later step. A whole frame's catch-up
 * steps share one deadline, so a slow step can't snowball. Only the game
 * passes one: a headless trial thinks every bot every step and replays exactly.
 */
export interface BotBudget {
  until: number;
  now(): number;
}

/**
 * The bots this machine runs, by local device. Each frame, every one that's
 * seated thinks over its view and its motor answers with the seat's input,
 * which the caller hands on with the keyboards' (net/session.ts carries it
 * from there). A bot not yet seated sends nothing.
 */
export class BotSeats {
  private bots = new Map<string, Bot>();

  /**
   * `tune` adjusts every personality it rolls: a headless trial measuring the motor may take the lapses out (personality.ts
   * `steady`). `moods` picks a bot's temperament instead of its seed: a test pitting one against another.
   */
  constructor(
    private readonly tune: (p: Personality) => Personality = (p) => p,
    private readonly moods: (seed: number) => Temperament = rollTemperament,
  ) {}

  private roll(seed: number, level: BotLevel, mood: Temperament): Personality {
    return this.tune(temper(rollPersonality(seed, level), mood));
  }

  /** A new bot's local device; seat it with a join action. `global` names a local device the way the match does. */
  add(match: Match, kind: BrainId = 'runner', global: (dev: string) => string = (d) => d): string {
    let n = 1;
    // Not a seat already ours either: one taken over from a host that left has no brain here until the next frame.
    while (this.bots.has(botDevice(n)) || match.players.some((p) => p.device === global(botDevice(n)))) n++;
    const dev = botDevice(n);
    this.start(match, dev, kind);
    return dev;
  }

  private start(match: Match, dev: string, kind: BrainId) {
    const seed = deriveSeed(match.seed, `bot:${dev}:${match.frame}`);
    const mood = this.moods(seed);
    const traits = this.roll(seed, 'normal', mood);
    this.bots.set(dev, {
      kind,
      seed,
      level: 'normal',
      mood,
      brain: BRAINS[kind].make(seed, traits, mood),
      motor: new Motor(traits, deriveSeed(seed, 'hands')),
      seated: false,
      intent: { do: 'wait' },
    });
  }

  remove(dev: string): void {
    this.bots.delete(dev);
  }

  has(dev: string): boolean {
    return this.bots.has(dev);
  }

  /**
   * This frame's input for every seated bot, by local device. `global` names a local device the way the match does.
   * A bot seat that is ours with no brain here (online, taken over from a host that left: bot seats are the room's,
   * run by whoever hosts) gets a fresh one, at the level its seat shows.
   *
   * With a `budget`, bots take turns going first (by match frame), so the one
   * left without time differs every step; the first always thinks.
   */
  frames(match: Match, global: (dev: string) => string = (d) => d, budget?: BotBudget): Record<string, InputFrame> {
    for (const p of match.players) {
      const dev = p.device.slice(p.device.lastIndexOf(':') + 1);
      if (isBotDevice(dev) && global(dev) === p.device && !this.bots.has(dev)) this.start(match, dev, 'runner');
    }
    const made = new Map<string, InputFrame>();
    const order = [...this.bots];
    if (budget && order.length > 1) {
      const k = match.frame % order.length;
      order.push(...order.splice(0, k));
    }
    let first = true;
    for (const [dev, bot] of order) {
      const p = match.players.find((q) => q.device === global(dev));
      if (p) {
        bot.seated = true;
        const level = p.bot ?? 'normal';
        if (level !== bot.level) {
          const traits = this.roll(bot.seed, level, bot.mood);
          bot.level = level;
          bot.brain = BRAINS[bot.kind].make(bot.seed, traits, bot.mood);
          bot.motor.traits = traits;
        }
        const rushed = !!budget && !first && budget.now() >= budget.until;
        first = false;
        if (!rushed) bot.intent = bot.brain.think(senseView(match, p));
        made.set(dev, bot.motor.drive(match, p, bot.intent, rushed));
      } else if (bot.seated) this.bots.delete(dev);
    }
    // In seat order whoever went first: the caller merges these with the keyboards' as they come.
    const out: Record<string, InputFrame> = {};
    for (const dev of this.bots.keys()) {
      const f = made.get(dev);
      if (f) out[dev] = f;
    }
    return out;
  }
}
