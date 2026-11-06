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
import { POINTS, type RoundResult, scoreRound, scoreSurvival, type Standing } from './scoring';

export type ModeId = 'race' | 'slag' | 'brawl';

export const MODE_IDS: readonly ModeId[] = ['race', 'slag', 'brawl'];

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
  /** With more than one player, what the race camera frames (render/camera-follow.ts): the whole pack, or the leader and a screen behind them. */
  camera: 'pack' | 'leader';
  /**
   * Whether a level set (theme) builds this mode's level as the mode means it. Every set should, since the engine
   * builds the level; one that doesn't yet still plays (Rising Slag in a farm is a classic climb, no loop), and the
   * Level card says so while it's work in progress.
   */
  builds: (theme: ThemeId) => boolean;
  score(o: RoundInput): RoundResult;
}

/** What a brawl's boxes deal, to anyone: things that knock, shove or toss you, a shield, and a punch that comes up from below. */
const BRAWL_ITEMS = ['sword', 'bat', 'bat', 'puck', 'boomerang', 'tremor', 'smoke', 'shield', 'upper'] as const;

export const MODES: Record<ModeId, ModeDef> = {
  race: {
    label: 'Race',
    profile: {},
    run: RACE_RUN,
    crate: RACE_CRATE,
    camera: 'pack',
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
    // A looping shaft of open ledges in every set, owing no part, with boxes of its own up every lap and slag under it.
    // The boxes deal by rank, the way a kart racer's do: whoever is behind draws something that reaches up (the hook
    // that trades places with the one ahead, the punch that flies up through floors, a burst upward, a step, the
    // shell that hunts the leader), and whoever leads something to hold on with. None kills.
    profile: {
      builder: 'shaft',
      loop: true,
      bare: true,
      boxes: { chase: ['hook', 'upper', 'upper', 'rocket', 'block', 'tax'], lead: ['shield', 'sword', 'block'] },
      tide: true,
    },
    run: { flag: false, lastStanding: true, ahead: 'height' },
    // A loop climbs bare, so no bridge is owed: the crate leans to what you put in each other's way, and to
    // utility, and away from building (a shortcut for whoever's ahead) and demolition (nothing needs clearing).
    crate: { bridges: false, roles: { hazard: 1.6, utility: 1.3, build: 0.6, demolish: 0.35 } },
    camera: 'leader',
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
  /**
   * Brawl: a one-screen arena that owes no part, everyone starting from its two ends, and the last one standing takes
   * the round. Nothing kills on its own: items knock and bodies shove, on the race's own physics, and what kills is the
   * level (its hazards, the parts placed in it each round, the drop, and late in the round the slag). Its own boxes
   * hand out what to knock with. A round that runs out of time is a draw.
   */
  brawl: {
    label: 'Brawl',
    // 25 s in, slag pours in from below and the arena closes in, so a round always comes to a fight; 60 s is the end.
    profile: {
      size: 'classic',
      route: 'ltr',
      bare: true,
      ends: true,
      hazards: 4,
      boxes: { chase: [...BRAWL_ITEMS], lead: [...BRAWL_ITEMS] },
      tide: { wait: 25, speed: 0.4, gain: 0.04 },
    },
    run: { flag: false, lastStanding: true, ahead: 'none', seconds: 60 },
    // No gap to cross: the crate leans to hazards to knock people into and utility to throw them about.
    crate: { bridges: false, roles: { hazard: 1.8, utility: 1.2, build: 0.4, demolish: 0.5 } },
    camera: 'pack',
    builds: () => true,
    score: ({ run, standings }) =>
      scoreSurvival(
        run.runners.map((r) => ({ slot: r.slot, alive: r.alive, deathFrame: r.deathFrame })),
        run.kills,
        standings,
        () => 0,
        [POINTS.survive],
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
