import { TILE } from './constants';
import { goalRect, type Level } from './level';
import { goalField } from './reach';
import type { Runner, RunRules } from './run';

/**
 * Who is ahead in a race, the one way everything asks it: the items that hunt the leader or the runner just ahead,
 * the boxes that deal by rank, the bots' rank, the camera's lap and the stats. The mode says what ahead means
 * (`RunRules.ahead`): nearer the flag by route (a race), or higher up, laps and all (a climb). A new mode with a
 * new sense of ahead adds a case here, not a branch in each of them.
 */
/** What the standing order reads of a race: its level and its rules. */
interface Race {
  level: Level;
  rules: RunRules;
  runners: readonly Runner[];
}

/** The field per level, rebuilt when the level's tiles change (a crater bumps `version`). Derived data only: every peer computes the same. */
const FIELDS = new WeakMap<Level, { version: number; field: Float64Array }>();

/** Route distance to the flag from every cell of `level` (tenths of a tile), computed once per level version. */
export function goalFieldOf(level: Level): Float64Array {
  const hit = FIELDS.get(level);
  if (hit && hit.version === level.version) return hit.field;
  const field = goalField(level);
  FIELDS.set(level, { version: level.version, field });
  return field;
}

const cx = (r: Runner) => r.body.x + r.body.w / 2;
const cy = (r: Runner) => r.body.y + r.body.h / 2;
const active = (r: Runner) => r.alive && !r.finished;

/** A runner's route distance to the flag: the field at their center, or under their feet if they're clipping a wall. */
export function routeDistance(level: Level, r: Runner): number {
  const f = goalFieldOf(level);
  const tx = Math.floor(cx(r) / TILE);
  if (tx < 0 || tx >= level.w) return Number.POSITIVE_INFINITY;
  for (const y of [cy(r), r.body.y + r.body.h + 1]) {
    const ty = Math.floor(y / TILE);
    if (ty >= 0 && ty < level.h && Number.isFinite(f[ty * level.w + tx])) return f[ty * level.w + tx];
  }
  return Number.POSITIVE_INFINITY;
}

/** How far along `r` is: bigger is further. Height climbed (px, laps counted), minus the route to the flag, or 0 where nobody is ahead. */
export function progressOf(race: Pick<Race, 'level' | 'rules'>, r: Runner): number {
  if (race.rules.ahead === 'none') return 0;
  if (race.rules.ahead === 'height') return -(r.body.y + r.body.h - r.lap * (race.level.loop ?? 0) * TILE);
  return -routeDistance(race.level, r);
}

/** Between two runners equally far along: nearer the flag in a straight line (a race), then the lower slot. */
function tiebreak(race: Race, a: Runner, b: Runner): number {
  if (race.rules.ahead === 'route') {
    const g = goalRect(race.level);
    const gx = g.x + g.w / 2;
    const gy = g.y + g.h / 2;
    const d = (r: Runner) => (cx(r) - gx) * (cx(r) - gx) + (cy(r) - gy) * (cy(r) - gy);
    const e = d(a) - d(b);
    if (e) return e;
  }
  return a.slot - b.slot;
}

/** Is `a` ahead of `b`? Further along, then the tiebreak. */
function beats(race: Race, a: Runner, pa: number, b: Runner, pb: number): boolean {
  return pa > pb || (pa === pb && tiebreak(race, a, b) < 0);
}

/** The live, unfinished runner furthest along, as a runner index; -1 if nobody's racing. */
export function leaderOf(race: Race): number {
  let best = -1;
  let bestP = 0;
  race.runners.forEach((r, i) => {
    if (!active(r)) return;
    const p = progressOf(race, r);
    if (best < 0 || beats(race, r, p, race.runners[best], bestP)) {
      best = i;
      bestP = p;
    }
  });
  return best;
}

/** Runners ahead of `r`: everyone finished, and everyone still racing further along. 0 leads; a runner out of the race is 0. */
export function rankOf(race: Race, r: Runner): number {
  if (!active(r)) return 0;
  const mine = progressOf(race, r);
  return race.runners.filter((q) => q !== r && (q.finished || (active(q) && progressOf(race, q) > mine))).length;
}

/**
 * The runner just ahead of `r` among those `can` allows: the least far along of everyone further along, as a runner
 * index; -1 if none is. Ties go to the lower slot.
 */
export function aheadOf(race: Race, r: Runner, can: (q: Runner) => boolean = active): number {
  const mine = progressOf(race, r);
  let best = -1;
  let bestP = 0;
  race.runners.forEach((q, i) => {
    if (q === r || !can(q)) return;
    const p = progressOf(race, q);
    if (!(p > mine) || !Number.isFinite(p)) return;
    if (best < 0 || p < bestP || (p === bestP && q.slot < race.runners[best].slot)) {
      best = i;
      bestP = p;
    }
  });
  return best;
}
