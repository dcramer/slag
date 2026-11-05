/**
 * Playstyle modes (docs/DESIGN.md → Modes). A mode is data the match reads at its seams: what level it asks
 * worldgen for, what a race is played for, and how a round scores. Pick, place, props, items and art are
 * shared, so a new mode is an entry here, not a branch in the match.
 */
import type { ProfileOverride } from '../gen/level';
import { type CrateMix, RACE_CRATE } from '../gen/props';
import type { ThemeId } from '../themes';
import { TILE } from '../sim/constants';
import { feetUp, RACE_RUN, type RunRules, type RunWorld } from '../sim/run';
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
  /** How its crates are dealt (gen/props.ts `CrateMix`). */
  crate: CrateMix;
  /**
   * Whether a level set (theme) builds this mode's level as the mode means it. Every set should, since the engine
   * builds the level; one that doesn't yet still plays (Rising Slag in a farm is a classic climb, no loop), and the
   * Level card says so while it's work in progress.
   */
  builds: (theme: ThemeId) => boolean;
  score(o: RoundInput): RoundResult;
}

export const MODES: Record<ModeId, ModeDef> = {
  race: {
    label: 'Race',
    profile: {},
    run: RACE_RUN,
    crate: RACE_CRATE,
    builds: () => true,
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
    // A loop climbs bare, so no bridge is owed: the crate leans to what you put in each other's way, and to
    // utility, and away from building (a shortcut for whoever's ahead) and demolition (nothing needs clearing).
    crate: { bridges: false, roles: { hazard: 1.6, utility: 1.3, build: 0.6, demolish: 0.35 } },
    // Every set builds a looping shaft: its tower kit (gen/level/sculptors/tall.ts).
    builds: () => true,
    score: ({ run, standings }) =>
      scoreSurvival(
        run.runners.map((r) => ({ slot: r.slot, alive: r.alive, deathFrame: r.deathFrame })),
        run.kills,
        standings,
        (slot) => climbed(run, slot),
      ),
  },
};

/** Share of the climb from the spawn's floor to the top `slot` made before the slag took it: 1 at the goal's floor, or three laps round a loop. */
export function climbed(run: RunWorld, slot: number): number {
  const r = run.runners.find((x) => x.slot === slot);
  if (!run.level.tide || !r) return 0;
  const start = (run.level.spawn.ty + 1) * TILE;
  // Round a loop, the top is three laps up, where the hard laps start; anywhere else, the goal's floor.
  const top = run.level.loop ? start - 3 * run.level.loop * TILE : (run.level.goal.ty + 1) * TILE;
  return (start - feetUp(run.level, r)) / Math.max(TILE, start - top);
}
