import { FPS, RUN_COUNTDOWN, TILE } from './constants';
import type { Level } from './level';
import { DEFAULT_SURFACE, type Solid } from './physics';
import type { Runner, RunRules } from './run';
import { leaderOf, progressOf } from './standing';

/**
 * The leader's screen (Rising Slag, docs/MODES.md): the lead-camera racer's rule, fall off the bottom of the leader's
 * screen and you're out. A window a fixed number of rows tall rides over whoever leads (sim/standing.ts), and a
 * runner whose whole body has been under its bottom edge for `grace` frames is out. The race camera shows exactly
 * this window (render/camera-follow.ts), so what you see is what kills. It's only there with more than one runner.
 *
 * The window eases after the leader rather than sitting on their feet, so a leader's jump doesn't bob the edge
 * under the pack, and it rises no faster than `rise`. Nobody climbs off its top: the top edge is solid
 * (`screenSolids`), so a leader who climbs faster than the screen rises waits at the top of it while the field
 * climbs up, the screen being the arena. It never lets the leader out of it either way: their feet stay at least `keep`
 * rows over its bottom however fast they fall, and their head under its top however they got up there (a swap). The
 * leader is whoever is highest, so the window follows a pack's front however often it changes hands; when the leader
 * goes out it eases down to the next one, which only ever spares someone.
 */
export interface ScreenRules {
  /** Rows the window is tall. */
  rows: number;
  /** Rows from the window's top edge down to the leader's feet, when the window has caught up with them. */
  up: number;
  /** Frames a runner may spend wholly under the bottom edge before it's out: a slip it climbs back from is no loss. */
  grace: number;
  /** Share of the way to the leader the window moves every frame (a smoothing, not a speed). */
  follow: number;
  /** Fastest the window rises, rows a second. */
  rise: number;
  /** Fewest rows the leader's feet stand over the bottom edge. */
  keep: number;
}

/** The window's state, plain data on the RunWorld (a snapshot carries it). */
export interface Screen {
  /** Climbed world y (sim/run.ts `feetUp`) of the leader's feet as the window has followed them. */
  y: number;
  /** Frames each runner (by index) has been wholly under the bottom edge, 0 when it isn't. */
  under: number[];
}

/** What the window reads of a race. */
interface Race {
  level: Level;
  rules: RunRules;
  runners: readonly Runner[];
}

/** The window's edges, climbed world y: `top` over the followed feet, `bottom` the edge that kills. */
export function screenEdges(s: ScreenRules, screen: Screen): { top: number; bottom: number } {
  return { top: screen.y - s.up * TILE, bottom: screen.y + (s.rows - s.up) * TILE };
}

/** The window at the start of a race: on the spawn's floor, where everyone stands at GO. */
export function newScreen(level: Level, runners: number): Screen {
  return { y: (level.spawn.ty + 1) * TILE, under: new Array<number>(runners).fill(0) };
}

/** Feet of `r` in climbed coordinates, as standing reads them (higher is further along). */
const feetOf = (race: Race, r: Runner) => -progressOf(race, r);

/** One frame of the window, before anyone moves: follow the leader, then count who is under its bottom edge. */
export function stepScreen(race: Race, s: ScreenRules, screen: Screen, f: number): void {
  const lead = f >= RUN_COUNTDOWN ? leaderOf(race) : -1;
  if (lead >= 0) {
    const feet = feetOf(race, race.runners[lead]);
    const head = feet - race.runners[lead].body.h;
    let y = screen.y + (feet - screen.y) * s.follow;
    y = Math.max(y, screen.y - (s.rise * TILE) / FPS);
    y = Math.min(y, head + s.up * TILE);
    y = Math.max(y, feet - (s.rows - s.up - s.keep) * TILE);
    screen.y = y;
  }
  const { bottom } = screenEdges(s, screen);
  race.runners.forEach((r, i) => {
    if (!r.alive || r.finished || f < RUN_COUNTDOWN) return void (screen.under[i] = 0);
    // Wholly under the edge: its head (feet less its height) is past it.
    screen.under[i] = feetOf(race, r) - r.body.h > bottom ? screen.under[i] + 1 : 0;
  });
}

/** Id of the top edge's solid (`screenSolids`) for lap 0; each lap's copy counts down from it. */
const TOP_ID = -600;
/** How thick the top edge's solid is: more than anything rises in a frame. */
const TOP_PX = 2 * TILE;

/**
 * The window's top edge as a slab of solid over it, one copy for every lap someone is racing on (each sees the window
 * shifted by its lap). Built after the window has moved, from where it is now, so it never stands where the leader
 * is; it comes down only after a leader who fell, and stays over their head, so it never pushes anyone.
 */
export function screenSolids(race: Race, s: ScreenRules, screen: Screen, out: Solid[]): void {
  const L = (race.level.loop ?? 0) * TILE;
  const { top } = screenEdges(s, screen);
  const laps: number[] = [];
  for (const r of race.runners) if (r.alive && !r.finished && !laps.includes(r.lap)) laps.push(r.lap);
  laps.sort((a, b) => a - b);
  for (const lap of laps)
    out.push({
      x: -2 * TILE,
      y: top + lap * L - TOP_PX,
      w: (race.level.w + 4) * TILE,
      h: TOP_PX,
      id: TOP_ID - lap,
      dx: 0,
      dy: 0,
      surface: DEFAULT_SURFACE,
      propUid: -1,
      mi: -1,
    });
}

/** Is runner index `i` out to the window this frame: under its bottom edge for the whole grace? */
export function offScreen(s: ScreenRules, screen: Screen, i: number): boolean {
  return screen.under[i] >= s.grace;
}
