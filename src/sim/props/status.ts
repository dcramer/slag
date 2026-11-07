import type { Body } from '../physics';
import { type InputFrame, NO_INPUT } from '../types';

/**
 * Per-runner status effects and contact bookkeeping, as plain data (snapshot
 * friendly). Props and projectiles set these; RunWorld applies them around
 * `stepBody` through `statusInput` / `statusPostStep`, so the movement
 * controller itself stays untouched.
 */
export interface RunnerStatus {
  /** Frames left frozen solid: no control (momentum and gravity still apply). */
  frozen: number;
  /** Frames left slowed (goo, webs): capped run speed and weak jumps. */
  slowed: number;
  /** Trigger keys overlapped last frame (enter detection). */
  inside: number[];
  /** Frames left on a Boost Strip's kick, and the horizontal speed (px/s) it holds you at until then. */
  boost: number;
  boostVx: number;
  /** Frames left of a Leg Day's spring: every jump, off the ground or a wall, takes off `SURGE.lift` times as fast. */
  surge: number;
}

export const FREEZE_FRAMES = 50;
export const SLOW_FRAMES = 110;
/** Horizontal speed cap (px/s) applied before each step while slowed (one frame of acceleration lands on top: ~70 px/s on foot). */
const SLOW_VX = 40;
/** Take-off speed cap (px/s) while slowed: about half a normal jump's height. */
const SLOW_JUMP = 330;

/**
 * A Leg Day (a climb's pickup, ./modules/surge.ts): jumps take off 1.3 times as fast for four seconds, near twice as
 * high (a full jump 6.2 rows from 3.7), so a shaft's next row and the one past it through a board are one jump, and a
 * wall climbs faster. One is back `refill` frames after it's taken, for whoever is a few seconds behind.
 */
export const SURGE = { lift: 1.3, frames: 4 * 60, refill: 3 * 60 } as const;

/** What `statusPostStep` needs from before the step to tell a take-off: on its feet (or coyote), and wall jumps so far. */
export interface Takeoff {
  ground: boolean;
  walls: number;
}

export function newStatus(): RunnerStatus {
  return { frozen: 0, slowed: 0, inside: [], boost: 0, boostVx: 0, surge: 0 };
}

/** The controls a runner actually gets this frame. Frozen runners can still give up (alt). */
export function statusInput(st: RunnerStatus, inp: InputFrame): InputFrame {
  if (st.frozen > 0) return inp.altPressed ? { ...NO_INPUT, altPressed: true } : NO_INPUT;
  return inp;
}

/** Before `stepBody`: hold a boost's speed (no skid while it lasts, faster ways the same way kept), and clamp speed while slowed. */
export function statusPreStep(st: RunnerStatus, b: Body): void {
  if (st.boost > 0 && !(b.vx * st.boostVx > 0 && Math.abs(b.vx) > Math.abs(st.boostVx))) b.vx = st.boostVx;
  if (st.slowed > 0 && Math.abs(b.vx) > SLOW_VX) b.vx = b.vx > 0 ? SLOW_VX : -SLOW_VX;
}

/** Before `stepBody`, while a Leg Day lasts: what a take-off this step is told from (null otherwise). */
export function takeoffMark(st: RunnerStatus, b: Body): Takeoff | null {
  return st.surge > 0 ? { ground: b.onGround || b.coyote > 0, walls: b.wallJumps } : null;
}

/** After `stepBody`: spring a Leg Day's take-off, weaken jumps while slowed, and run the timers down. */
export function statusPostStep(st: RunnerStatus, b: Body, mark: Takeoff | null = null): void {
  if (mark && st.surge > 0 && b.vy < 0 && ((mark.ground && b.jumping && !b.onGround && b.coyote === 0) || b.wallJumps > mark.walls)) b.vy *= SURGE.lift;
  if (st.surge > 0) st.surge--;
  if (st.slowed > 0) {
    if (b.jumping && b.vy < -SLOW_JUMP) b.vy = -SLOW_JUMP;
    st.slowed--;
  }
  if (st.frozen > 0) st.frozen--;
  if (st.boost > 0) st.boost--;
}
