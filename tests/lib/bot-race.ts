import { BotSeats } from '../../src/brain/bots';
import { type Personality, steady as steadyHands } from '../../src/brain/personality';
import { type BotLevel, Match } from '../../src/game/match';
import type { ProfileOverride } from '../../src/gen/level';
import { isBridgePart } from '../../src/gen/props';
import type { Difficulty } from '../../src/sim/level';
import type { PlacedProp } from '../../src/sim/props';
import { RUN_COUNTDOWN } from '../../src/sim/constants';
import type { ThemeId } from '../../src/themes';

export interface BotRace {
  finished: boolean;
  /** Race frames it took (or ran for). */
  frames: number;
  cause: string | null;
  /** The longest stretch (frames) it stood still on the ground pressing nothing. */
  pause: number;
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
  /** Bots with no lapses (no fumbles, pauses or wrong turns): measures the motor, not a player. */
  steady?: boolean;
  /** Adjusts every bot's rolled personality (after `steady`). */
  hands?: (p: Personality) => Personality;
}

function botMatch(
  seed: number,
  theme: ThemeId | undefined,
  size: ProfileOverride['size'] | undefined,
  players: number,
  level: BotLevel | undefined,
  difficulty?: Difficulty,
  hands: (p: Personality) => Personality = (p) => p,
) {
  const m = new Match(seed, theme);
  if (size || difficulty) {
    m.forceProfile = { ...(size ? { size } : {}), ...(difficulty ? { difficulty } : {}) };
    m.newLevel(seed, theme);
  }
  const bots = new BotSeats(hands);
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
export function botRace(
  seed: number,
  { theme, size, limit = 60 * 60, build = true, level, parts = 0, difficulty, steady = false, hands = (p) => p }: BotRaceOptions = {},
): BotRace {
  const tune = steady ? (p: Personality) => hands(steadyHands(p)) : hands;
  let placed: PlacedProp[] | null = null;
  if (parts > 0) {
    const { m, bots } = botMatch(seed, theme, size, parts, level, difficulty, tune);
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0 };
    m.startMatch();
    for (let f = 0; f < 60 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
    placed = m.placed;
  }
  const { m, bots } = botMatch(seed, theme, size, 1, level, difficulty, tune);
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
  let pause = 0;
  let still = 0;
  while (m.phase === 'run' && r.alive && !r.finished && run.frame < limit) {
    const frames = bots.frames(m);
    const idle = Object.values(frames).every((f) => !f.left && !f.right && !f.jump && !f.down && !f.up);
    still = idle && r.body.onGround && Math.abs(r.body.vx) < 0.5 && run.frame > RUN_COUNTDOWN ? still + 1 : 0;
    pause = Math.max(pause, still);
    m.step(frames);
  }
  return { finished: r.finished, frames: run.frame, cause: r.cause, pause };
}
