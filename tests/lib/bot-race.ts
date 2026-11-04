import { BotSeats } from '../../src/brain/bots';
import { type BotLevel, Match } from '../../src/game/match';
import type { ProfileOverride } from '../../src/gen/level';
import { isBridgePart } from '../../src/gen/props';
import type { Difficulty } from '../../src/sim/level';
import type { PlacedProp } from '../../src/sim/props';
import type { ThemeId } from '../../src/themes';

export interface BotRace {
  finished: boolean;
  /** Race frames it took (or ran for). */
  frames: number;
  cause: string | null;
}

export interface BotRaceOptions {
  theme?: ThemeId;
  /** Force the level's size class (a theme that never rolls it keeps its own). */
  size?: ProfileOverride['size'];
  limit?: number;
  /** Build the plan's bridges before the race (the default); ignored with `parts`. */
  build?: boolean;
  level?: BotLevel;
  /** This many bots of the same level pick and place a round's parts first, and the racer runs over whatever they left. */
  parts?: number;
  /** Force the level's difficulty (gen/level/difficulty.ts). */
  difficulty?: Difficulty;
}

function botMatch(
  seed: number,
  theme: ThemeId | undefined,
  size: ProfileOverride['size'] | undefined,
  players: number,
  level: BotLevel | undefined,
  difficulty?: Difficulty,
) {
  const m = new Match(seed, theme);
  if (size || difficulty) {
    m.forceProfile = { ...(size ? { size } : {}), ...(difficulty ? { difficulty } : {}) };
    m.newLevel(seed, theme);
  }
  const bots = new BotSeats();
  for (let i = 0; i < players; i++) {
    const p = m.join(bots.add(m))!;
    if (level && level !== 'normal') p.bot = level;
  }
  return { m, bots };
}

/**
 * One bot alone on `seed`'s level with the plan's bridges already built
 * (unless `build` is false), or over the parts `parts` bots placed in a
 * round of their own, raced to the end: does it find its way to the flag?
 * Shared by tests/brain.test.ts and the finish-rate suites in tests/stats/.
 */
export function botRace(seed: number, { theme, size, limit = 60 * 60, build = true, level, parts = 0, difficulty }: BotRaceOptions = {}): BotRace {
  let placed: PlacedProp[] | null = null;
  if (parts > 0) {
    const { m, bots } = botMatch(seed, theme, size, parts, level, difficulty);
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0 };
    m.startMatch();
    for (let f = 0; f < 60 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
    placed = m.placed;
  }
  const { m, bots } = botMatch(seed, theme, size, 1, level, difficulty);
  m.startMatch();
  if (placed) m.placed = placed.map((pp) => ({ ...pp }));
  else if (build) {
    const bridge = m.crate.find((c) => isBridgePart(c.def))?.def;
    if (m.plan.length && !bridge) throw new Error(`seed ${seed}: the crate has no bridge for its plan`);
    for (const b of m.plan) m.placed.push({ uid: 1000 + m.placed.length, def: bridge!, owner: 0, tx: b.x, ty: b.y, rot: 0 });
  }
  m.startRun();
  const run = m.run!;
  const r = run.runners[0];
  while (m.phase === 'run' && r.alive && !r.finished && run.frame < limit) m.step(bots.frames(m));
  return { finished: r.finished, frames: run.frame, cause: r.cause };
}
