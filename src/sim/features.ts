import type { Rect } from '../core/geom';
import { TILE } from './constants';
import type { DeathCause, Runner, RunWorld } from './run';
import { firstOut, stepTide } from './tide';

/**
 * What a race has beyond running the level: each is a feature with hooks the run step calls (sim/run.ts), on when the
 * level or the rules call for it. Today that's the slag rising under a climb; a mode's shrinking arena or a team's
 * shared fail is another entry here, not more code in the step. A feature keeps its state as plain data on the
 * RunWorld, so a snapshot carries it.
 */
export interface RunFeature {
  /** Whether this race has it. Asked once, when the race starts. */
  on(w: RunWorld): boolean;
  /** Once a frame, before anyone moves. */
  step?(w: RunWorld, f: number): void;
  /** Whether it kills `r` this frame (`hb` is the hurtbox): the cause, or null. Asked after the level's own kills. */
  kills?(w: RunWorld, r: Runner, hb: Rect): DeathCause | null;
}

/** Feet in climbed coordinates (world y, minus a loop's rows for every lap up), as sim/run.ts `feetUp`. */
const feet = (w: RunWorld, r: Runner, y: number) => y - r.lap * (w.level.loop ?? 0) * TILE;

/**
 * The slag (sim/tide.ts): it rises at its floor pace on a leash to whoever is highest, tightening once someone is out,
 * and burns everything under its surface, the spawn zone included, as the pit takes you anywhere. Its surface is `RunWorld.slag`.
 */
const tide: RunFeature = {
  on: (w) => w.slag !== null,
  step(w, f) {
    let top: number | null = null;
    for (const r of w.runners) if (r.alive && !r.finished) top = Math.min(top ?? Infinity, feet(w, r, r.body.y + r.body.h));
    w.slag = stepTide(w.level, w.slag!, f, top, firstOut(w.runners));
  },
  kills: (w, r, hb) => (feet(w, r, hb.y + hb.h) > w.slag! ? 'hazard' : null),
};

/** Every feature, in the order the step runs them. */
export const RUN_FEATURES: readonly RunFeature[] = [tide];
