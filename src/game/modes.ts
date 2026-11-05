/**
 * Playstyle modes (docs/DESIGN.md → Modes). A mode is data the match reads at its seams: what level it asks
 * worldgen for, what a race is played for, and how a round scores. Pick, place, props, items and art are
 * shared, so a new mode is an entry here, not a branch in the match.
 */
import type { ProfileOverride } from '../gen/level';
import { TILE } from '../sim/constants';
import { RACE_RUN, type RunRules, type RunWorld } from '../sim/run';
import { tideStart } from '../sim/tide';
import { type RoundResult, scoreRound, scoreSurvival, type Standing } from './scoring';

export type ModeId = 'race' | 'slag';

export const MODE_IDS: readonly ModeId[] = ['race', 'slag'];

/** What a finished race hands its mode's scorer. */
export interface RoundInput {
  slots: readonly number[];
  run: RunWorld;
  standings: Readonly<Record<number, Standing>>;
}

export interface ModeDef {
  /** Button text in the Rules menu. */
  label: string;
  /** Knobs the mode forces on every level it plays (rulesProfile): a level is built for its mode. */
  profile: ProfileOverride;
  /** What a race is for (sim/run.ts). */
  run: RunRules;
  score(o: RoundInput): RoundResult;
}

export const MODES: Record<ModeId, ModeDef> = {
  race: {
    label: 'Race',
    profile: {},
    run: RACE_RUN,
    score: ({ slots, run, standings }) => scoreRound(slots, run.finishOrder, run.kills, standings),
  },
  /**
   * Rising Slag: a level that climbs, slag rising under it from GO, no flag. The last one standing wins the
   * round; the top is only the last place the slag reaches. Parts still go in every round, so the climb gets
   * harder (or shorter) as the match goes on.
   */
  slag: {
    label: 'Rising Slag',
    profile: { tide: true },
    run: { flag: false, lastStanding: true },
    score: ({ run, standings }) =>
      scoreSurvival(
        run.runners.map((r) => ({ slot: r.slot, alive: r.alive, deathFrame: r.deathFrame })),
        run.kills,
        standings,
        (slot) => climbed(run, slot),
      ),
  },
};

/** Share of the climb to the top `slot` made before the slag took it: 1 at the goal's floor. */
export function climbed(run: RunWorld, slot: number): number {
  const start = tideStart(run.level);
  const r = run.runners.find((x) => x.slot === slot);
  if (start === null || !r) return 0;
  const top = (run.level.goal.ty + 1) * TILE;
  return (start - (r.body.y + r.body.h)) / Math.max(TILE, start - top);
}
