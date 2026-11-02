import type { Rng } from '../../../core/rng';
import { type Grid, H, hintGap, W } from '../kit';
import { jumpProfile } from '../probe';

/**
 * Helpers shared by theme sculptors: gap sizing from the measured jump
 * profile, and the "challenge" roll that decides whether a level gets a
 * crossing that needs a bridge prop.
 */

/** A gap (empty columns) that is always jumpable between ledges at equal height. */
export function easyGap(rng: Rng, min = 1): number {
  const j = jumpProfile();
  return rng.int(Math.min(min, j.gap - 1), Math.max(1, j.gap - 1));
}

/**
 * A gap too wide to jump but bridgeable with one 3-wide bridge (the bridge
 * leaves at most `gap - 1` columns on each side).
 */
export function hardGap(rng: Rng): number {
  const j = jumpProfile();
  return rng.int(j.gap + 2, j.gap * 2 + 1);
}

/** Tallest step that is always climbable (one less than measured, for slack). */
export function easyRise(): number {
  return Math.max(1, jumpProfile().rise - 1);
}

/**
 * How many crossings in this level must need a bridge (0, 1 or 2). Later
 * attempts lower the stakes so retries converge.
 */
export function rollChallenges(rng: Rng, pHard: number, pTwo: number, attempt: number): number {
  if (attempt >= 8) pHard *= 0.5;
  if (!rng.chance(pHard)) return 0;
  return rng.chance(pTwo) && attempt < 4 ? 2 : 1;
}

/** Carve a pit (columns x0..x1 empty to the bottom) and hint a bridge at floor row `row` if it's wide. */
export function pit(g: Grid, x0: number, x1: number, row: number, hint: boolean): void {
  g.clear(x0, 0, x1, H - 1);
  if (hint) hintGap(g, x0, x1, row);
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

export function clampRow(r: number, lo = 6, hi = H - 3): number {
  return Math.max(lo, Math.min(hi, r));
}

export { H, W };

/**
 * Horizontal space allocator for landmark stamps: keeps structures from
 * overlapping each other, pits, and the spawn/goal pockets.
 */
export class Slots {
  readonly used: [number, number][] = [];
  constructor(
    readonly lo = 6,
    readonly hi = W - 7,
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
export function flatten(surf: number[], a: number, b: number, row?: number): number {
  let r = row ?? 0;
  if (row === undefined) for (let x = a; x <= b; x++) if (surf[x] < H) r = Math.max(r, surf[x]);
  for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) surf[x] = r;
  return r;
}

/**
 * Smooth a heightmap so neighbors differ by at most `maxStep` rows, moving
 * only unlocked columns (stamps and pit banks stay put). Pits (≥ H) are skipped.
 */
export function relax(surf: number[], locked: Uint8Array | boolean[], maxStep: number): number[] {
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
