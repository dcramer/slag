import type { Rect } from '../core/geom';
import { DT } from './constants';

/**
 * Wind (fans, rooftop AC condensers, steam vents) as a steady velocity
 * field rather than a raw acceleration.
 *
 * Inside a column the air moves at a target speed (from the source's
 * `strength`) along the column's axis-aligned direction:
 *
 *  - Vertical columns: while the body is slower than the air (along the
 *    wind), gravity is suspended (× (1 − k)) and its vertical speed eases
 *    toward the air's speed (exponential approach, `WIND.response`). When
 *    it's already faster (a jump inside an up-draft), normal gravity
 *    slows it back down to the air speed, so a jump simply adds to the lift.
 *    Because gravity is cancelled rather than out-pushed, the target is
 *    independent of any gravity scale and *every* up-fan lifts at its speed.
 *  - Up-drafts taper to zero over the last `WIND.taper` px (measured from
 *    the body's feet), so you float with your feet at the column's end
 *    instead of bouncing in and out of it.
 *  - Horizontal columns shift the frame the run controller steers in: you
 *    drift with the air when not steering, walking (106 px/s) loses to most
 *    side fans and running (215 px/s) beats the weaker ones.
 *  - Grounding is left entirely to stepBody, so coyote time and jumping
 *    work normally while standing in (or at the base of) a column.
 *
 * Pure arithmetic only (no transcendental Math): deterministic at the
 * fixed 60 Hz step.
 */
export const WIND = {
  /** Target air speed (px/s) per unit of module `strength`: 1300 → 117, 2200 → 198, 2800 → 252. */
  speedPerStrength: 0.09,
  /** Fraction of the gap to the air speed closed per second (×DT per frame: 0.15). ~90% in a quarter second. */
  response: 9,
  /** Up-drafts and side winds slow to zero over this many px before the column's end (a soft top to float at). */
  taper: 32,
  /** Up-drafts: depth (px, feet below the column end) where the air stands still — the float height. */
  hoverDepth: 2,
  /** Side winds: minimum horizontal accel (px/s²) toward the air's speed when not steering. */
  grip: 1500,
} as const;

/** One frame's wind column. Axis-aligned; produced by prop modules (fan, geyser). */
export interface Wind extends Rect {
  /** Unit push direction: exactly one of dx/dy is ±1. */
  dx: number;
  dy: number;
  /** Air speed along (dx, dy) at full strength, px/s. */
  speed: number;
  /** 0..1 source strength this frame (geyser eruption ramps); 1 for fans. */
  k: number;
}

/** The wind acting on one body this frame (aggregated from all overlapping columns). */
export interface WindForce {
  /** Horizontal air speed (px/s, + right); the run controller steers relative to it. */
  vx: number;
  /** Vertical air speed (px/s, + down) at the body. Only meaningful when ky > 0. */
  vy: number;
  /** 0..1 strength of the vertical field (gravity suspension and pull toward vy). */
  ky: number;
  /** Direction of the vertical column: -1 up-draft, 1 down-draft, 0 none. */
  dy: number;
}

/** Air speed (px/s) of a wind source with module `strength`. */
export function windSpeed(strength: number): number {
  return strength * WIND.speedPerStrength;
}

/** Ease-out taper 0..1: eases off full speed, but stays linear-ish at the very end so a floating body settles fast. */
const taperCurve = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * (2 - t));

/**
 * Fraction (0..1, slightly negative just past an up-draft's float height) of
 * the column's air speed at `depth` px before its far end. Up-drafts and side
 * winds taper over the last WIND.taper px (at most half the column) so you
 * float / drift to a stop; down-drafts don't (gravity takes over past their
 * end). The art uses this too, so streaks fade exactly where the push does.
 */
export function windProfile(w: Wind, depth: number): number {
  if (w.dy > 0) return 1;
  const taper = Math.min(WIND.taper, (w.dy < 0 ? w.h : w.w) * 0.5);
  if (w.dy < 0) {
    const d = depth - WIND.hoverDepth;
    return d >= 0 ? taperCurve(d / taper) : (2 * d) / taper;
  }
  return taperCurve(depth / taper);
}

/** Air speed along the wind at body `b`, from its trailing edge's distance to the column end. */
function airSpeed(b: Rect, w: Wind): number {
  const depth = w.dy < 0 ? b.y + b.h - w.y : w.dy > 0 ? w.y + w.h - b.y : w.dx > 0 ? w.x + w.w - b.x : b.x + b.w - w.x;
  return w.speed * windProfile(w, depth);
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Combine every column overlapping `b` into one force: per axis the
 * strongest column wins (two side-by-side AC fans don't stack). Null when
 * no wind touches the body.
 */
export function windAt(b: Rect, winds: readonly Wind[]): WindForce | null {
  let f: WindForce | null = null;
  let bestX = 0;
  let bestY = 0;
  for (const w of winds) {
    if (w.k <= 0 || !overlaps(b, w)) continue;
    f ??= { vx: 0, vy: 0, ky: 0, dy: 0 };
    const s = airSpeed(b, w);
    if (w.dx !== 0) {
      const v = s * w.k;
      if (Math.abs(v) > bestX) {
        bestX = Math.abs(v);
        f.vx = w.dx * v;
      }
    } else if (w.k * w.speed > bestY) {
      bestY = w.k * w.speed;
      f.vy = w.dy * s;
      f.ky = w.k;
      f.dy = w.dy;
    }
  }
  return f;
}

/**
 * Gravity multiplier this frame (applied with the controller's own gravity).
 * Up-drafts suspend it; down-drafts only while the body is slower than the
 * air (falling faster than a down-draft is just falling).
 */
export function windGravityScale(vy: number, f: WindForce): number {
  if (f.ky <= 0 || (f.dy > 0 && vy > f.vy)) return 1;
  return 1 - f.ky;
}

/**
 * Ease vertical speed toward the air's, after gravity and jumps, before
 * integration. `g` is this frame's gravity before windGravityScale.
 *
 * Slower than the air: exponential approach (WIND.response). Rising faster
 * than an up-draft (a jump): the suspended gravity is re-applied, but never
 * past the air speed — so a jump arcs normally and then rides the draft,
 * and the float at the top settles instead of chattering.
 */
export function windPushY(b: { vy: number }, f: WindForce, g: number): void {
  if (f.ky <= 0) return;
  const k = f.ky;
  if (f.dy < 0 && b.vy < f.vy) {
    b.vy = Math.min(f.vy, b.vy + g * DT * k);
    return;
  }
  if (f.dy > 0 && b.vy > f.vy) return;
  b.vy += (f.vy - b.vy) * WIND.response * DT * k;
}
