import { fieldOf } from '../gen/level';
import type { Level } from '../sim/level';
import { buildSolids, type Contrib, type Hazard, motionOffset, newPropState, type PlacedProp, type Resolved, traceRays } from '../sim/props';
import { goalField } from '../sim/reach';
import type { RunWorld } from '../sim/run';

/**
 * The race as a route sees it, shared by every bot on this machine: the
 * level with its parts written in the way the solvability proof writes them
 * (plain blocks are rock, whatever hurts or moves is no-go: fieldOf), and the
 * distance to a target over moves the controller is sure of. A hazard
 * that's clear long enough to slip past isn't in the field: the motor times
 * it with `hazards`.
 */
export interface RaceMap {
  field: Level;
  /** Route distance to `target` (a cell, y * w + x) by proven moves, in tenths of a tile; Infinity where none lead. */
  dist(target: number): Float64Array;
  /** The same with open air linking everything, so there's always a direction: what a bot falls back on with no route. */
  rough(target: number): Float64Array;
  /**
   * What hurts on race frame `f`, as the parts' own cycles say it will:
   * what a player learns by watching a saw come round. Shots in flight and
   * anything set off by a runner aren't in it.
   */
  hazards(f: number): readonly Hazard[];
}

const maps = new WeakMap<RunWorld, RaceMap>();

/** The map of `run`, made once per race (parts stand still once it starts). */
export function raceMap(run: RunWorld): RaceMap {
  let m = maps.get(run);
  if (!m) {
    m = mapOf(run.level, run.placed, run.resolved);
    maps.set(run, m);
  }
  return m;
}

function mapOf(level: Level, placed: readonly PlacedProp[], resolved: readonly Resolved[]): RaceMap {
  const field = fieldOf(level, placed);
  const ahead = new Map<number, Hazard[]>();
  const state = newPropState();
  const hazards = (f: number) => {
    let hs = ahead.get(f);
    if (!hs) {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [], beams: [] };
      const ctx = (r: Resolved, mi: number) => ({ level, frame: f, r, off: motionOffset(r, f), prev: motionOffset(r, f - 1), state, mi, live: true });
      buildSolids(resolved, ctx, out);
      traceRays(resolved, ctx, out);
      hs = out.hazards;
      ahead.set(f, hs);
    }
    return hs;
  };
  const exact = new Map<number, Float64Array>();
  const loose = new Map<number, Float64Array>();
  const cached = (cache: Map<number, Float64Array>, target: number, air: boolean) => {
    let d = cache.get(target);
    if (!d) {
      d = goalField(field, { air, target, careful: true });
      cache.set(target, d);
    }
    return d;
  };
  return { field, dist: (t) => cached(exact, t, false), rough: (t) => cached(loose, t, true), hazards };
}
