import { fieldOf } from '../gen/level';
import type { Level } from '../sim/level';
import type { Rect } from '../core/geom';
import { buildSolids, type Contrib, type Hazard, motionOffset, newPropState, type PlacedProp, type Resolved, traceRays } from '../sim/props';
import { goalField, ReachCache } from '../sim/reach';
import type { RunWorld } from '../sim/run';
import type { Solid } from '../sim/physics';
import type { Wind } from '../sim/wind';

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
   * anything set off by a runner aren't in it (foresight.ts has those).
   */
  hazards(f: number): readonly Hazard[];
  /**
   * The parts' solids that stand somewhere else on race frame `f` than at the
   * start: a gate, an arm, a crusher coming round. A move traced among the
   * solids as they stand now can be bumped by one of these.
   */
  moving(f: number): readonly Rect[];
  /** The parts' wind columns on race frame `f` (fans, vents), without the weather's gust. */
  winds(f: number): readonly Wind[];
  /** Every part's solid on race frame `f`, where the parts' cycles put them: what a part set off moves among (foresight.ts). */
  solids(f: number): readonly Solid[];
}

const maps = new WeakMap<RunWorld, RaceMap>();

/**
 * Careful reach traces by level, kept from race to race: a round's parts
 * change a few cells, so a race's distance fields re-trace only those instead
 * of the whole level inside one step. Answers never depend on what ran before.
 */
const traces = new Map<string, ReachCache>();
const MAX_TRACES = 2;

function tracesFor(field: Level): ReachCache {
  const key = `${field.seed}:${field.theme.id}:${field.w}x${field.h}:${field.gravity ?? 1}`;
  let c = traces.get(key);
  if (c) traces.delete(key);
  else c = new ReachCache(field, undefined, true);
  traces.set(key, c);
  if (traces.size > MAX_TRACES) traces.delete(traces.keys().next().value!);
  c.rebase(field.tiles);
  return c;
}

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
  const ahead = new Map<number, { hazards: Hazard[]; moving: Rect[]; winds: Wind[]; solids: Solid[] }>();
  const state = newPropState();
  const at = (f: number): Contrib => {
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [], beams: [] };
    const ctx = (r: Resolved, mi: number) => ({ level, frame: f, r, off: motionOffset(r, f), prev: motionOffset(r, f - 1), state, mi, live: true });
    buildSolids(resolved, ctx, out);
    traceRays(resolved, ctx, out);
    return out;
  };
  // Where every solid stands at the start: anything elsewhere later has moved.
  const still = new Map<number, Rect>();
  for (const s of at(0).solids) still.set(s.id, s);
  const frame = (f: number) => {
    let hit = ahead.get(f);
    if (!hit) {
      const out = at(f);
      const moving = out.solids.filter((s) => {
        if (s.oneWay || s.film) return false;
        const o = still.get(s.id);
        return !o || o.x !== s.x || o.y !== s.y || o.w !== s.w || o.h !== s.h;
      });
      hit = { hazards: out.hazards, moving, winds: out.winds, solids: out.solids };
      ahead.set(f, hit);
    }
    return hit;
  };
  const hazards = (f: number) => frame(f).hazards;
  const moving = (f: number) => frame(f).moving;
  const winds = (f: number) => frame(f).winds;
  const solids = (f: number) => frame(f).solids;
  const exact = new Map<number, Float64Array>();
  const loose = new Map<number, Float64Array>();
  const cached = (cache: Map<number, Float64Array>, target: number, air: boolean) => {
    let d = cache.get(target);
    if (!d) {
      d = goalField(field, { air, target, careful: true, cache: tracesFor(field) });
      cache.set(target, d);
    }
    return d;
  };
  return { field, dist: (t) => cached(exact, t, false), rough: (t) => cached(loose, t, true), hazards, moving, winds, solids };
}
