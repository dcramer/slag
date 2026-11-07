/**
 * A bot sits in a seat as one more local device of the machine that runs
 * it (`bot1`, online `<peer>:bot1`), so its inputs travel exactly like a
 * second keyboard's. These helpers are all the rest of the game needs to
 * know about that.
 */

const PREFIX = 'bot';

/** Local device id of bot `n`. */
export function botDevice(n: number): string {
  return `${PREFIX}${n}`;
}

/** Is this device (local or global) a bot's? */
export function isBotDevice(dev: string): boolean {
  return dev.slice(dev.lastIndexOf(':') + 1).startsWith(PREFIX);
}
