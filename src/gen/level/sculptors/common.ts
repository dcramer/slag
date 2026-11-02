import type { Rng } from '../../../core/rng';
import { jumpMetrics } from '../../../sim/physics';
import { type Grid, hintGap } from '../kit';
import { BRIDGE_W } from '../types';
import type { RouteShape } from '../../../sim/level';
import { jumpProfile, probeGravity } from '../probe';
import type { SculptCtx } from '../types';

/**
 * Helpers shared by theme sculptors: gap sizing from the measured jump
 * profile, and the "challenge" roll that decides whether a level gets a
 * crossing that needs a bridge prop.
 */

/** Share of levels that need two parts; every other level needs one. */
export const TWO_PARTS = 0.22;
/** First attempt that may give up on needing parts at all (the pipeline stops insisting here too). */
export const LAST_RESORT = 22;

/**
 * A gap (empty columns) jumpable between ledges at equal height. Mostly a
 * walking hop, sometimes one that takes a run-up: a run is a choice you make
 * for speed, so a level shouldn't keep demanding it. Only use this where the
 * near ledge is long enough to run on; short ledges want `hopGap`.
 */
export function easyGap(rng: Rng, min = 2): number {
  const j = jumpProfile();
  const walk = Math.max(min, j.walkGap);
  const run = Math.max(walk, j.gap - 1);
  return rng.chance(0.4) ? rng.int(Math.min(run, walk + 1), run) : rng.int(min, walk);
}

/** A gap you can clear with a walking jump, from a stone or perch too short to run on. */
export function hopGap(rng: Rng, min = 1): number {
  return rng.int(min, Math.max(min, jumpProfile().walkGap));
}

/**
 * A gap no running jump clears (pair it with `undercut` on the far bank so it
 * can't be wall-climbed from below), but that `parts` bridges close (1 or 2).
 * A bridge is too short to run on, so a player runs and jumps onto it from
 * the near bank and walks off the far end. One bridge covers a running jump,
 * its own width and most of a walking jump (the last columns only work from
 * a few exact spots, which the solver doesn't count on); no single bridge
 * spans a running jump, its width and a full walking jump. Widths are checked
 * against an exhaustive search in tests/routes.test.ts. The widest gaps also
 * beat long falling jumps from nearby perches, so they're the likelier roll.
 */
export function hardGap(rng: Rng, parts = 1): number {
  const j = jumpProfile();
  const lo = parts === 1 ? j.gap + 2 : j.gap + BRIDGE_W + j.walkGap + 2;
  const hi = Math.max(lo, parts === 1 ? BRIDGE_W + j.walkGap * 2 : j.gap + BRIDGE_W * 2 + j.walkGap);
  const far = Math.min(hi, Math.max(lo, j.gapAt(-6) + 1));
  return rng.chance(0.3) ? rng.int(lo, far) : rng.int(far, hi);
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
 * How many parts this level asks for: every level needs at least one, and
 * TWO_PARTS of them need two. Later attempts lower the stakes so retries
 * converge, and the very last ones drop the ask altogether: a level no
 * sculpt could make hard is rarer than a generator that can't finish.
 *
 * The count is decided once per level (k.challenge), not per attempt: harder
 * shapes are rejected more often, so a per-attempt roll would quietly select
 * for easy ones.
 */
export function rollChallenges(attempt: number, k: Pick<Knobs, 'challenge'>): number {
  if (attempt >= LAST_RESORT) return 0;
  return k.challenge < TWO_PARTS && attempt < 16 ? 2 : 1;
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
export function undercut(g: Grid, x: number, depth = 2, from = 0): void {
  const top = g.surface(x, from);
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

/**
 * Keep landmarks off a hard crossing's banks: a tower or spire on the lip
 * leaves a bridge nowhere to land, and walls by the edge give walls to climb.
 */
export function keepClear(slots: Slots, a: number, w: number): void {
  slots.mark(a - 4, a + w + 6);
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
  /** This level's challenge roll in [0, 1), the same on every attempt. */
  challenge: number;
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
    challenge: ctx.challenge,
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
