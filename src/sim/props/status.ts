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
}

export const FREEZE_FRAMES = 50;
export const SLOW_FRAMES = 110;
/** Horizontal speed cap (px/s) applied before each step while slowed (one frame of acceleration lands on top: ~70 px/s on foot). */
export const SLOW_VX = 40;
/** Take-off speed cap (px/s) while slowed: about half a normal jump's height. */
export const SLOW_JUMP = 330;

export function newStatus(): RunnerStatus {
  return { frozen: 0, slowed: 0, inside: [] };
}

/** The controls a runner actually gets this frame. Frozen runners can still give up (alt). */
export function statusInput(st: RunnerStatus, inp: InputFrame): InputFrame {
  if (st.frozen > 0) return inp.altPressed ? { ...NO_INPUT, altPressed: true } : NO_INPUT;
  return inp;
}

/** Before `stepBody`: clamp speed while slowed. */
export function statusPreStep(st: RunnerStatus, b: Body): void {
  if (st.slowed > 0 && Math.abs(b.vx) > SLOW_VX) b.vx = b.vx > 0 ? SLOW_VX : -SLOW_VX;
}

/** After `stepBody`: weaken jumps while slowed, and run the timers down. */
export function statusPostStep(st: RunnerStatus, b: Body): void {
  if (st.slowed > 0) {
    if (b.jumping && b.vy < -SLOW_JUMP) b.vy = -SLOW_JUMP;
    st.slowed--;
  }
  if (st.frozen > 0) st.frozen--;
}
