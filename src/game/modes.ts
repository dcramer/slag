/**
 * Playstyle modes (docs/DESIGN.md → Modes). A mode is data the match reads at its seams: what level it asks
 * worldgen for, what a race is played for, and how a round scores. Pick, place, props, items and art are
 * shared, so a new mode is an entry here, not a branch in the match.
 */
import type { ProfileOverride } from '../gen/level';
import { type CrateMix, RACE_CRATE } from '../gen/props';
import type { ThemeId } from '../themes';
import type { ShoveRules } from '../sim/collide';
import { TILE } from '../sim/constants';
import { type BuildUp, feetUp, RACE_RUN, type RunRules, type RunWorld } from '../sim/run';
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
  /** Bouts per placement when the mode is chosen (MatchRules.bouts): fights on one level's parts before the next pick. One if unset. */
  bouts?: number;
  /** Players (bots count) a match needs before it starts: a fight needs someone to fight. One if unset. */
  minPlayers?: number;
  /**
   * Whether a level set (theme) builds this mode's level as the mode means it. Every set should, since the engine
   * builds the level; one that doesn't yet still plays (Rising Slag in a farm is a classic climb, no loop), and the
   * Level card says so while it's work in progress.
   */
  builds: (theme: ThemeId) => boolean;
  score(o: RoundInput): RoundResult;
}

/**
 * What a brawl's boxes deal, to anyone: only things that knock someone into something, the swings most (the noodle,
 * the bat, the punch in a box), then the throws and the slams. Nothing that only moves you, and no shield, which would
 * soak the very hit the mode kills with.
 */
const BRAWL_ITEMS = ['sword', 'sword', 'bat', 'bat', 'glove', 'glove', 'glove', 'puck', 'boomerang', 'tremor', 'upper'] as const;

/**
 * A brawl's bodies (`RunRules.shove`): for putting each other off ledges, where a race's only jostle. Twice the race's
 * shove, and a check only from a real run-up (about 11 tiles/s; a run is 13.4): at three quarters, or a check from 150,
 * bots' rounds ran shorter (19 s with parts placed, 11 of 64 under 10 s) for no more deaths off the sides.
 */
const BRAWL_SHOVE: ShoveRules = { share: 0.5, carry: true, check: 180 };

/**
 * A brawl's build-up (`RunRules.buildup`): every rival's hit taken throws the next a quarter as hard again, up to six.
 * Distance goes as the square of it: a noodle carries someone standing still 10.8 tiles fresh, 25 after two hits, 46 after
 * four; a bat's tap 5.5, 13 and 24. It took the share of deaths knocked from 70% to 73% bare and 63% to 66% with parts
 * placed, rounds staying about 17 s; 0.35 ran most rounds with parts placed under 15 s (41 of 64), 0.1 to 0.2 moved little.
 */
const BRAWL_BUILDUP: BuildUp = { per: 0.25, max: 6 };

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
    // A looping shaft of open ledges in every set, owing no part, with boxes of its own up every lap, two gates across it
    // that shut on a cycle so the leader waits for the pack (gen/level/loop-gates.ts), and slag under it.
    // The boxes deal by rank, the way a kart racer's do: whoever is behind draws something that reaches up (the hook
    // that trades places with the one ahead, the punch that flies up through floors, a burst upward, a step, the
    // shell that hunts the leader), and whoever leads something to hold on with. None kills.
    profile: {
      builder: 'shaft',
      loop: true,
      bare: true,
      boxes: { chase: ['hook', 'upper', 'upper', 'rocket', 'block', 'tax'], lead: ['shield', 'sword', 'block'] },
      gates: true,
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
      // Its own arena in every set: ledges in tiers to the top of the screen, open at the sides (gen/level/builders/arena.ts).
      builder: 'arena',
      size: 'classic',
      route: 'ltr',
      bare: true,
      ends: true,
      // Mist hides a one-screen arena's edges, the very things that kill in it (owner decision).
      noWeather: ['mist'],
      // Deadly from round 1: as many set pieces as fit, from the nastiest of the set's mix, and only what kills or
      // knocks (no platform or lift to stand on).
      hazards: 6,
      danger: 0.9,
      setPieceRoles: ['hazard', 'utility'],
      boxes: { chase: [...BRAWL_ITEMS], lead: [...BRAWL_ITEMS] },
      tide: { wait: 25, speed: 0.4, gain: 0.04 },
    },
    // Bodies shove hard enough to put someone over an edge (sim/collide.ts `ShoveRules`): a walk moves a bystander at
    // half a walk, whoever is shoved off goes out over the drop, and a run-up into someone who isn't pushing back knocks
    // them like a bump. Everyone in the brawl shares it; a race keeps its own.
    run: { flag: false, lastStanding: true, ahead: 'none', seconds: 60, shove: BRAWL_SHOVE, buildup: BRAWL_BUILDUP },
    // No gap to cross: the crate leans to hazards to knock people into and utility to throw them about.
    crate: { bridges: false, roles: { hazard: 1.8, utility: 1.2, build: 0.4, demolish: 0.5 } },
    camera: 'pack',
    // Three fights on each placement, as the party brawler plays rounds back to back: picking and placing (up to 30 s)
    // would otherwise outlast a fight (about 28 s with bots).
    bouts: 3,
    minPlayers: 2,
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

/** Players a match of `mode` needs before it starts (`ModeDef.minPlayers`). */
export const minPlayersOf = (mode: ModeId): number => MODES[mode].minPlayers ?? 1;
