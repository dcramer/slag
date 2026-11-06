import { DT, TILE } from '../constants';
import { lapShift } from '../level';
import { letGo } from '../props/attach';
import type { Runner, RunWorld } from '../run';
import { BONK_CREDIT, bonk, cx, cy, isActive, itemEvent, launch } from './common';
import { routeDistance } from './tax';
import type { HookLine, UpperFist } from './types';

/**
 * The two items that reach the runner ahead when ahead is up (docs/MODES.md → Rising Slag): on a climb the leader is
 * above you, where a throw or a swing doesn't go.
 *
 * Queue Jumper: a line that reels out to whoever is just ahead of you and trades your places, the climb's take on
 * the lead-camera racer's swap hook. Nothing blocks it; it's a catch-up, so the leader never draws it from a loop box.
 *
 * Upper Hand: a gloved firework that flies straight up through floors, leaning toward whoever is nearest above, and
 * punches everyone it reaches back down. It leans slower than a run, so a runner who sees it coming can step aside.
 */
export const HOOK = {
  /** Frames the line takes to reach its mark: long enough to see who it's after. */
  reel: 24,
} as const;

export const UPPER = {
  /** Rise (px/s), and how fast it leans sideways toward its mark: slower than a walk. */
  speed: 420,
  lean: 90,
  /** It bursts on its own after rising this far (px). */
  rise: 20 * TILE,
  /** Everyone whose center is this close (px) when it reaches one of them is punched. */
  radius: 1.75 * TILE,
  /** How far below the glove (px) a runner's center can be and still be punched. */
  over: 2,
  /** Down and out: the punch knocks a runner off what they stood on. */
  knockVx: 150,
  knockVy: 160,
  cooldown: 40,
} as const;

/** A loop's height (px), or 0. */
const loopPx = (w: RunWorld) => (w.level.loop ?? 0) * TILE;

/** `d` round a loop to its nearest copy: two points a lap apart are the same place. */
function wrapped(w: RunWorld, d: number): number {
  const p = loopPx(w);
  if (!p) return d;
  const m = ((d % p) + p) % p;
  return m > p / 2 ? m - p : m;
}

/** How far along a runner is: climbed height on a climb (laps counted), nearness to the flag by route in a race. Bigger is further. */
function progress(w: RunWorld, r: Runner): number {
  if (w.level.tide) return -(r.body.y + r.body.h - r.lap * loopPx(w));
  return -routeDistance(w.level, r);
}

/** Someone a hook or a fist can reach: racing, out of the spawn zone, not shut inside a part. */
const reachable = (w: RunWorld, r: Runner) => isActive(r) && !w.isSafe(r) && !r.attach.grip?.sealed;

/** The runner just ahead of `r`: the least far along of everyone further along. -1 if `r` leads. Ties go to the lower slot. */
export function aheadOf(w: RunWorld, r: Runner): number {
  const mine = progress(w, r);
  let best = -1;
  let bestP = 0;
  w.runners.forEach((o, i) => {
    if (o === r || !reachable(w, o)) return;
    const p = progress(w, o);
    if (!(p > mine) || !Number.isFinite(p)) return;
    if (best < 0 || p < bestP || (p === bestP && o.slot < w.runners[best].slot)) {
      best = i;
      bestP = p;
    }
  });
  return best;
}

/** Throw a Queue Jumper at whoever is just ahead. False (nothing spent) if nobody is. */
export function throwHook(w: RunWorld, r: Runner): boolean {
  const target = aheadOf(w, r);
  if (target < 0) return false;
  w.items.hooks.push({ id: w.items.nextId++, owner: w.runners.indexOf(r), target, t: 0 });
  itemEvent(w, 'use', 'hook', r.slot, cx(r), cy(r));
  return true;
}

/**
 * Trade two runners' places: where each stands and how each is moving, laps and all. Both have the one hitbox, so
 * each lands somewhere a runner fits. Anything holding either lets go, and a death soon after credits the thrower.
 */
function swap(w: RunWorld, a: Runner, b: Runner): void {
  letGo(a);
  letGo(b);
  const body = { ...a.body };
  Object.assign(a.body, b.body);
  Object.assign(b.body, body);
  const lap = a.lap;
  a.lap = b.lap;
  b.lap = lap;
  b.items.bonkedBy = a.slot;
  b.items.bonkCredit = BONK_CREDIT;
  itemEvent(w, 'hit', 'hook', a.slot, cx(b), cy(b));
}

/** One line, one frame. False once it's done. Its mark is whoever is just ahead of the thrower now, so an overtake moves it. */
function stepHook(w: RunWorld, h: HookLine): boolean {
  const owner = w.runners[h.owner];
  if (!isActive(owner)) return false;
  const ahead = aheadOf(w, owner);
  if (ahead < 0) {
    itemEvent(w, 'fizzle', 'hook', -1, cx(owner), cy(owner));
    return false;
  }
  h.target = ahead;
  if (++h.t < HOOK.reel) return true;
  swap(w, owner, w.runners[ahead]);
  return false;
}

/** Every line in flight, in throw order. */
export function stepHooks(w: RunWorld): void {
  if (w.items.hooks.length) w.items.hooks = w.items.hooks.filter((h) => stepHook(w, h));
}

/** Fire an Upper Hand from the runner's head. */
export function fireUpper(w: RunWorld, r: Runner): void {
  w.items.fists.push({ id: w.items.nextId++, owner: r.slot, x: cx(r), y: r.body.y - 2, rose: 0, born: w.frame });
  r.items.cooldown = UPPER.cooldown;
  itemEvent(w, 'use', 'upper', r.slot, cx(r), r.body.y);
}

/** Rivals of the fist's owner it could punch, with where each is from it (dy < 0: above). */
function marks(w: RunWorld, f: UpperFist): { r: Runner; dx: number; dy: number }[] {
  const out = [];
  for (const r of w.runners) if (r.slot !== f.owner && reachable(w, r)) out.push({ r, dx: cx(r) - f.x, dy: wrapped(w, cy(r) - f.y) });
  return out;
}

/** One fist, one frame. False once it has burst or run out of rise. */
function stepFist(w: RunWorld, f: UpperFist): boolean {
  const all = marks(w, f);
  // Only the runner it reaches from below: someone level with the thrower is beside it, not over it.
  const hit = all.filter((m) => m.dy <= UPPER.over && m.dx * m.dx + m.dy * m.dy <= UPPER.radius * UPPER.radius);
  if (hit.length) {
    for (const { r, dx } of hit) {
      launch(r.body, (dx > 0 ? 1 : dx < 0 ? -1 : r.body.facing) * UPPER.knockVx, UPPER.knockVy);
      bonk(r, f.owner);
    }
    itemEvent(w, 'hit', 'upper', f.owner, f.x, f.y);
    return false;
  }
  if (f.rose >= UPPER.rise) {
    itemEvent(w, 'fizzle', 'upper', -1, f.x, f.y);
    return false;
  }
  // Lean toward the nearest rival above it, then by who's nearer across.
  let mark: (typeof all)[number] | null = null;
  for (const m of all) if (m.dy < 0 && (!mark || m.dy > mark.dy || (m.dy === mark.dy && Math.abs(m.dx) < Math.abs(mark.dx)))) mark = m;
  if (mark) {
    const step = UPPER.lean * DT;
    f.x += Math.max(-step, Math.min(step, mark.dx));
  }
  const rise = UPPER.speed * DT;
  f.y -= rise;
  f.rose += rise;
  f.y += lapShift(w.level, f.y) * loopPx(w);
  return true;
}

/** Every fist in flight, in launch order (a punch only moves runners, and later fists judge where they are now). */
export function stepFists(w: RunWorld): void {
  if (w.items.fists.length) w.items.fists = w.items.fists.filter((f) => stepFist(w, f));
}
