import { deriveSeed } from '../core/rng';
import type { BotLevel, Match } from '../game/match';
import type { InputFrame } from '../sim/types';
import { botDevice, isBotDevice } from './device';
import { Motor } from './motor';
import { type Personality, rollPersonality } from './personality';
import { BRAINS, type BrainId } from './registry';
import type { Brain } from './types';
import { senseView } from './view';

interface Bot {
  kind: BrainId;
  seed: number;
  /** The level its personality was rolled at: its seat's (Player.bot) changing rolls it again. */
  level: BotLevel;
  brain: Brain;
  motor: Motor;
  /** It has had a seat: losing it now (a watch, a kick, the lobby emptied) lets the bot go. */
  seated: boolean;
}

/**
 * The bots this machine runs, by local device. Each frame, every one that's
 * seated thinks over its view and its motor answers with the seat's input,
 * which the caller hands on with the keyboards' (net/session.ts carries it
 * from there). A bot not yet seated sends nothing.
 */
export class BotSeats {
  private bots = new Map<string, Bot>();

  /** `tune` adjusts every personality it rolls: a headless trial measuring the motor may take the lapses out (personality.ts `steady`). */
  constructor(private readonly tune: (p: Personality) => Personality = (p) => p) {}

  private roll(seed: number, level: BotLevel): Personality {
    return this.tune(rollPersonality(seed, level));
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
    const traits = this.roll(seed, 'normal');
    this.bots.set(dev, {
      kind,
      seed,
      level: 'normal',
      brain: BRAINS[kind].make(seed, traits),
      motor: new Motor(traits, deriveSeed(seed, 'hands')),
      seated: false,
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
   */
  frames(match: Match, global: (dev: string) => string = (d) => d): Record<string, InputFrame> {
    for (const p of match.players) {
      const dev = p.device.slice(p.device.lastIndexOf(':') + 1);
      if (isBotDevice(dev) && global(dev) === p.device && !this.bots.has(dev)) this.start(match, dev, 'runner');
    }
    const out: Record<string, InputFrame> = {};
    for (const [dev, bot] of this.bots) {
      const p = match.players.find((q) => q.device === global(dev));
      if (p) {
        bot.seated = true;
        const level = p.bot ?? 'normal';
        if (level !== bot.level) {
          const traits = this.roll(bot.seed, level);
          bot.level = level;
          bot.brain = BRAINS[bot.kind].make(bot.seed, traits);
          bot.motor.traits = traits;
        }
        out[dev] = bot.motor.drive(match, p, bot.brain.think(senseView(match, p)));
      } else if (bot.seated) this.bots.delete(dev);
    }
    return out;
  }
}
