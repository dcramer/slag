import { BotSeats } from '../../src/brain/bots';
import { Match } from '../../src/game/match';
import { isBridgePart } from '../../src/gen/props';
import type { ThemeId } from '../../src/themes';

export interface BotRace {
  finished: boolean;
  /** Race frames it took (or ran for). */
  frames: number;
  cause: string | null;
}

/**
 * One bot alone on `seed`'s level with the plan's bridges already built, raced
 * to the end: does it find its way to the flag? Shared by tests/brain.test.ts
 * and the finish-rate suite in tests/stats/.
 */
export function botRace(seed: number, theme?: ThemeId, limit = 60 * 60): BotRace {
  const m = new Match(seed, theme);
  const bots = new BotSeats();
  const dev = bots.add(m);
  m.join(dev);
  m.startMatch();
  const bridge = m.crate.find((c) => isBridgePart(c.def))?.def;
  if (m.plan.length && !bridge) throw new Error(`seed ${seed}: the crate has no bridge for its plan`);
  for (const b of m.plan) m.placed.push({ uid: 1000 + m.placed.length, def: bridge!, owner: 0, tx: b.x, ty: b.y, rot: 0 });
  m.startRun();
  const run = m.run!;
  const r = run.runners[0];
  while (m.phase === 'run' && r.alive && !r.finished && run.frame < limit) m.step(bots.frames(m));
  return { finished: r.finished, frames: run.frame, cause: r.cause };
}
