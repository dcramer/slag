/**
 * Playstyle modes (docs/DESIGN.md → Modes). A mode is data the match reads at its seams: what level it asks
 * worldgen for, what a race is played for, and how a round scores. Pick, place, props, items and art are
 * shared, so a new mode is an entry here, not a branch in the match.
 */
import type { ProfileOverride } from '../gen/level';
import { type CrateMix, RACE_CRATE } from '../gen/props';
import type { ThemeId } from '../themes';
import type { ShoveRules } from '../sim/collide';
import type { ScreenRules } from '../sim/screen';
import { TILE } from '../sim/constants';
import { type Armed, type BuildUp, feetUp, RACE_RUN, type RunRules, type RunWorld } from '../sim/run';
import { type RoundResult, scoreKnockouts, scoreRound, scoreSurvival, type Standing } from './scoring';

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
 * the bat, the punch in a box), then what reaches someone a swing can't (the clock lobbed onto a ledge, the rod that
 * reels them off it), then the throws and the slams. Nothing that only moves you, and no shield, which would soak the
 * very hit the mode kills with.
 */
const BRAWL_ITEMS = [
  'sword',
  'sword',
  'bat',
  'bat',
  'glove',
  'glove',
  'glove',
  'clock',
  'clock',
  'rod',
  'rod',
  'puck',
  'boomerang',
  'tremor',
  'upper',
] as const;

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

/**
 * Rising Slag's screen (sim/screen.ts): fall off the bottom of the leader's and you're out, 21 rows under their feet
 * (the first lap's leash is 25), with three quarters of a second to climb back. It follows the leader wherever they go
 * (owner decision: the leader runs free). A solid top that rose no faster than 5 rows a second, holding a leader who
 * pulled away until the field came up, brought the 15 s leader's wins to 44%, 47% and 47% (boxes, items, bare; 512
 * seeds) with 2.4 lead changes a round, and was dropped. Free, with the climb's items and bots that see only the
 * screen (brain/view.ts `sight`), 52%, 43% and 52% with 2.3 lead changes; with bots that saw the whole shaft, 67%, 45%
 * and 68% with 1.5. Catch-up is the climb's items' to bring. 29 rows or 34, 45 or 90 frames of grace, moved nothing
 * past the noise.
 */
const SLAG_SCREEN: ScreenRules = { rows: 29, up: 8, grace: 45, follow: 0.08, keep: 4 };

/**
 * What a brawl starts everyone holding (`RunRules.armed`), so the first seconds are a fight: something from the stands'
 * deal, good for one go, and then to a stand for more. With an item's own uses, half the bare rounds with bots ran under
 * 15 s (47 of 96) and 31 in 15–30 s; one go, 41 and 43.
 */
const BRAWL_ARMED: Armed = { deal: BRAWL_ITEMS, uses: 1 };

/**
 * A brawl's slag (`LevelProfile.tide`): the last resort that ends a stalemate, not what does the killing. It starts
 * `deep` rows under the arena, out of sight, so till then the drop is only a drop, and pours up `wait` s after GO at
 * `speed` tiles/s gaining `gain` tiles/s², in view about 4 s later. Pooled in the drop from GO, it took 101 of 144
 * deaths on the bare arena, nearly all falls into it; from under, 8, the rest knocks into the drop, a hazard or off the
 * side. Waiting 30 s left as many rounds in 15–30 s and stalemates running longer.
 */
const BRAWL_TIDE = { wait: 25, speed: 0.4, gain: 0.04, deep: 2 };

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
    // The leader's screen (`SLAG_SCREEN`) is what puts out whoever falls behind.
    // The boxes deal by rank, the way a kart racer's do: whoever is behind draws something that reaches up (the hook
    // that trades places with the one ahead twice as often, the punch that flies up through floors, the grapple to a
    // ledge overhead three times as often, the stamp that shakes off whoever is under them), and whoever leads something
    // to hold on with (the wrap, the spill on the ledges under them, a step). None kills. The shell that hunted the
    // leader is out (0.09 rivals knocked a round from these boxes, 0.5 a use against the Upper Hand's 0.8), and so is the
    // noodle, which swings across where the leader's rivals are under it (0.04). Every lap's riskiest lips hold Leg Days.
    profile: {
      builder: 'shaft',
      loop: true,
      bare: true,
      boxes: { chase: ['hook', 'hook', 'upper', 'grapple', 'grapple', 'grapple', 'jolt'], lead: ['shield', 'slick', 'block'] },
      surges: true,
      tide: true,
    },
    run: { flag: false, lastStanding: true, ahead: 'height', screen: SLAG_SCREEN },
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
    // Late in a round slag pours in from below and the arena closes in, so a stalemate always comes to an end; 60 s is the end.
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
      // Its boxes are weapon stands, as the party brawler's spawners are: on the floor, showing what they hold, taken by
      // walking in, a fresh one a few seconds on (gen/level/loop-boxes.ts, sim/props/modules/stand.ts).
      boxes: { chase: [...BRAWL_ITEMS], lead: [...BRAWL_ITEMS] },
      stands: true,
      tide: BRAWL_TIDE,
    },
    // Bodies shove hard enough to put someone over an edge (sim/collide.ts `ShoveRules`): a walk moves a bystander at
    // half a walk, whoever is shoved off goes out over the drop, and a run-up into someone who isn't pushing back knocks
    // them like a bump. Everyone in the brawl shares it; a race keeps its own.
    run: { flag: false, lastStanding: true, ahead: 'none', seconds: 60, shove: BRAWL_SHOVE, buildup: BRAWL_BUILDUP, armed: BRAWL_ARMED },
    // No gap to cross: the crate leans to hazards to knock people into and utility to throw them about.
    crate: { bridges: false, roles: { hazard: 1.8, utility: 1.2, build: 0.4, demolish: 0.5 } },
    camera: 'pack',
    // Three fights on each placement, as the party brawler plays rounds back to back: picking and placing (up to 30 s)
    // would otherwise outlast a fight (about 28 s with bots).
    bouts: 3,
    minPlayers: 2,
    builds: () => true,
    // Knockouts pay, and the last one standing one knockout's worth: hiding while the others fight doesn't win (owner decision).
    score: ({ run, standings }) =>
      scoreKnockouts(
        run.runners.map((r) => ({ slot: r.slot, alive: r.alive, deathFrame: r.deathFrame })),
        run.kills,
        standings,
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
