import type { Rng } from '../../../core/rng';
import { jumpMetrics } from '../../../sim/physics';
import { type Grid, hintGap } from '../kit';
import type { RouteShape } from '../../../sim/level';
import { jumpProfile, probeGravity } from '../probe';
import type { SculptCtx } from '../types';

/**
 * Helpers shared by theme sculptors: gap sizing from the measured jump
 * profile, and the "challenge" roll that decides whether a level gets a
 * crossing that needs a bridge prop.
 */

/**
 * A gap (empty columns) that is jumpable between ledges at equal height. By
 * default it is demanding: within a few columns of the longest running jump.
 */
export function easyGap(rng: Rng, min?: number): number {
  const j = jumpProfile();
  const hi = Math.max(1, j.gap - 1);
  return rng.int(Math.min(hi, min ?? Math.max(1, j.gap - 3)), hi);
}

/**
 * A gap no running jump clears (pair it with `undercut` on the far bank so it
 * can't be wall-climbed from below), yet bridgeable with one 3-wide bridge at
 * ledge height: each remaining side stays within a running jump. The upper
 * end also beats long falling jumps from nearby perches.
 */
export function hardGap(rng: Rng): number {
  const j = jumpProfile();
  const lo = j.gap + 2;
  const hi = Math.max(lo, j.gap * 2 + 2);
  return rng.chance(0.5) ? rng.int(lo, Math.min(hi, j.gapAt(-6) + 1)) : rng.int(Math.min(hi, j.gapAt(-6) + 1), hi);
}

/**
 * Comfortable vertical spacing for steps, rungs and shelves: one less than a
 * plain full jump (no wall tricks), so structures keep their proportions.
 * Never below 2: heavy gravity would otherwise give 1-row steps, and a solid
 * flight of those starts on the floor and seals the storey it stands in
 * instead of floating at head height.
 */
export function easyRise(): number {
  return Math.max(2, Math.floor(jumpMetrics(probeGravity()).jumpHeight) - 1);
}

/**
 * How many crossings in this level must need a bridge (0, 1 or 2). Later
 * attempts lower the stakes so retries converge.
 */
export function rollChallenges(rng: Rng, pHard: number, pTwo: number, attempt: number, propNeed = 1): number {
  // The level profile's propNeed tilts the theme's base rate (1 = as tuned, lower = more breathers).
  pHard = Math.min(0.97, pHard * (0.35 + 0.75 * propNeed));
  if (attempt >= 8) pHard *= 0.5;
  if (!rng.chance(pHard)) return 0;
  return rng.chance(pTwo) && attempt < 4 ? 2 : 1;
}

/** Carve a pit (columns x0..x1 empty to the bottom) and hint a bridge at floor row `row` if it's wide. */
export function pit(g: Grid, x0: number, x1: number, row: number, hard: boolean): void {
  g.clear(x0, 0, x1, g.h - 1);
  if (!hard) return;
  hintGap(g, x0, x1, row);
  undercut(g, x1 + 1);
}

/**
 * Undercut the far bank of a hard gap (bank's first column x): its top two
 * rows become a lip over a recess two columns deep. Walls are wall-climbable,
 * so without this a player who drops toward the far wall just climbs out;
 * the lip's underside stops the climb.
 */
export function undercut(g: Grid, x: number, depth = 2): void {
  const top = g.surface(x);
  if (top < g.h - 3) g.clear(x, top + 2, x + depth - 1, g.h - 1);
}

/** Pick `n` distinct, spaced x positions in [lo, hi] (sorted). */
export function spacedXs(rng: Rng, n: number, lo: number, hi: number, minSep: number): number[] {
  const out: number[] = [];
  for (let tries = 0; tries < 60 && out.length < n; tries++) {
    const x = rng.int(lo, hi);
    if (out.every((o) => Math.abs(o - x) >= minSep)) out.push(x);
  }
  return out.sort((a, b) => a - b);
}

export function clampRow(r: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, r));
}

/**
 * Horizontal space allocator for landmark stamps: keeps structures from
 * overlapping each other, pits, and the spawn/goal pockets.
 */
export class Slots {
  readonly used: [number, number][] = [];
  constructor(
    readonly lo: number,
    readonly hi: number,
  ) {}
  free(a: number, b: number, margin = 1): boolean {
    if (a < this.lo || b > this.hi) return false;
    return this.used.every(([u0, u1]) => b + margin < u0 || a - margin > u1);
  }
  mark(a: number, b: number): void {
    this.used.push([a, b]);
  }
  /** Reserve a random free span of width w; returns its left x or null. */
  take(rng: Rng, w: number, margin = 1, lo = this.lo, hi = this.hi): number | null {
    for (let tries = 0; tries < 40; tries++) {
      const a = rng.int(lo, hi - w + 1);
      if (this.free(a, a + w - 1, margin)) {
        this.mark(a, a + w - 1);
        return a;
      }
    }
    return null;
  }
}

/** Flatten a heightmap span to one row (the lower of its extremes by default) so a stamp sits level. */
export function flatten(surf: number[], H: number, a: number, b: number, row?: number): number {
  const W = surf.length;
  let r = row ?? 0;
  if (row === undefined) for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) if (surf[x] < H) r = Math.max(r, surf[x]);
  for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) surf[x] = r;
  return r;
}

/**
 * Smooth a heightmap so neighbors differ by at most `maxStep` rows, moving
 * only unlocked columns (stamps and pit banks stay put). Pits (≥ H) are skipped.
 */
export function relax(surf: number[], H: number, locked: Uint8Array | boolean[], maxStep: number): number[] {
  const W = surf.length;
  for (let pass = 0; pass < 6; pass++) {
    const order = pass % 2 === 0 ? [1, -1] : [-1, 1];
    for (const dir of order) {
      for (let i = 0; i < W; i++) {
        const x = dir > 0 ? i : W - 1 - i;
        if (locked[x] || surf[x] >= H) continue;
        for (const n of [x - 1, x + 1]) {
          if (n < 0 || n >= W || surf[n] >= H) continue;
          if (surf[x] < surf[n] - maxStep) surf[x] = surf[n] - maxStep;
          if (surf[x] > surf[n] + maxStep) surf[x] = surf[n] + maxStep;
        }
      }
    }
  }
  return surf;
}

/**
 * Profile knobs resolved for one sculpt: grid size, a route ramp (how many
 * rows the ground rises toward the goal) and density-scaled feature counts.
 */
export interface Knobs {
  W: number;
  H: number;
  /** 0 sparse … 1 dense. */
  density: number;
  route: RouteShape;
  /** Rows the route climbs from spawn to goal (negative = descends). */
  climb: number;
  /** Row offset of the route at column x: 0 at the low end, -|climb| at the high end. */
  ramp(x: number): number;
  /** Scale a per-classic-level feature count by width and density (at least `min`). */
  count(base: number, min?: number): number;
  /** Width relative to a classic level (1 = 48 columns). */
  wide: number;
  propNeed: number;
}

/**
 * Resolve the profile for a heightmap-style (horizontal) sculptor. `maxClimb`
 * caps the ramp (rows); climbs/descents rise ~22–38% of the height.
 */
export function knobs(ctx: SculptCtx, maxClimb?: number, range: [number, number] = [0.22, 0.38]): Knobs {
  const { profile: p, rng } = ctx;
  const W = p.w;
  const H = p.h;
  const cap = maxClimb ?? Math.round(H * Math.max(0.4, range[1]));
  // Late attempts flatten the route so retries converge.
  const relaxK = ctx.attempt >= 20 ? 0.5 : 1;
  const amount = Math.min(cap, Math.round(rng.range(H * range[0], H * range[1]) * relaxK));
  const climb = p.route === 'climb' || p.route === 'zigzag' ? amount : p.route === 'descent' ? -amount : rng.int(-2, 2);
  const wide = W / 48;
  return {
    W,
    H,
    density: p.density,
    route: p.route,
    climb,
    ramp: (x) => {
      const u = Math.max(0, Math.min(1, x / Math.max(1, W - 1)));
      return climb >= 0 ? -Math.round(climb * u) : -Math.round(-climb * (1 - u));
    },
    count: (base, min = 0) => Math.max(min, Math.round(base * wide * (0.45 + 1.1 * p.density))),
    wide,
    propNeed: p.propNeed,
  };
}

/**
 * Stepped floor: level sections `len` columns long, each a random step from
 * the last (chance `pStep`, ±1..maxStep rows) while tracking the route ramp
 * from base row `f`. Steps stay within ±(maxStep + 1) so they're climbable.
 */
export function stepRows(rng: Rng, k: Knobs, f: number, len: [number, number], pStep: number, maxStep: number): number[] {
  const floor: number[] = [];
  const lo = 6;
  const hi = k.H - 3;
  for (let row = f; floor.length < k.W;) {
    const n = rng.int(len[0], len[1]);
    for (let i = 0; i < n && floor.length < k.W; i++) floor.push(row);
    const want = f + k.ramp(floor.length + (n >> 1));
    let next = row;
    if (rng.chance(pStep)) next = row + rng.pick([-maxStep, -1, 1, maxStep]);
    // Pull toward the route ramp.
    if (next - want > 2) next = row - rng.int(1, maxStep + 1);
    else if (want - next > 2) next = row + rng.int(1, maxStep + 1);
    row = Math.max(lo, Math.min(hi, Math.max(want - 3, Math.min(want + 2, next))));
    row = Math.max(floor[floor.length - 1] - maxStep - 1, Math.min(floor[floor.length - 1] + maxStep + 1, row));
  }
  return floor;
}
