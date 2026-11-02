import type { Rect } from '../../core/geom';
import { PHYS } from '../constants';
import type { Level } from '../level';
import { firstOverlap } from '../physics';
import type { Runner, RunWorld } from '../run';
import type { InputFrame } from '../types';
import { moduleSim } from './registry';

/**
 * Being held by a prop. A rope, keg or pipe grabs a runner and then owns their body:
 * RunWorld skips the controller while `Runner.attach.grip` is set, and the
 * module's `hold` writes position and velocity instead. The hitbox never
 * changes and everything stays plain data beside `status` and `items`.
 *
 * Holding fails safe. Every frame the hold is re-checked against the world, so
 * it ends by itself, keeping the current velocity, when the prop is gone or
 * broken, when a solid moves into the runner, or when anything else writes the
 * body's velocity (a knock, a shield pop, a rocket). Hazards, the pit, the goal
 * and self-destruct all still apply while held, and `kill` and the goal let go.
 */

/** A held runner. Module-owned numbers are named here so a snapshot sees all of it. */
export interface Grip {
  uid: number;
  mi: number;
  /** Frames held. */
  t: number;
  /** Runner center relative to the module's anchor (px). */
  x: number;
  y: number;
  /** Rope: grip distance from the hook (px). */
  len: number;
  /** Rope: speed along the swing (px/s), positive toward +x at the bottom. */
  s: number;
  /** Rope: it hangs from something solid, so it's only as good as that is. */
  hooked: boolean;
  /** Keg: frames left once lit, or -1 while unlit. */
  fuse: number;
  /** Keg: compass direction the aim locked to. */
  aim: number;
  /** Stuffed inside the part: no held items. */
  sealed: boolean;
  /** Pipe: uid of the pipe the runner comes out of, or -1 while still going in. */
  to: number;
  /** Velocity the module last wrote; anything else means something hit this runner. */
  vx: number;
  vy: number;
}

export interface RunnerAttach {
  grip: Grip | null;
  /** Frames before this runner can grab module (cdUid, cdMi) again. Other parts are fair game at once, so ropes chain. */
  cd: number;
  cdUid: number;
  cdMi: number;
  /** Frame a backfire's soot wears off (art). */
  soot: number;
  /**
   * Inputs (LATCH bits) still held from leaving a part: a part you work with the controls ignores
   * them until they're let go and pressed again, so holding down out of a pipe doesn't send you
   * straight back in. Cleared bit by bit as they're released.
   */
  latch: number;
}

/** Bits of `RunnerAttach.latch`. */
export const LATCH = { down: 1, up: 2, left: 4, right: 8, jump: 16 } as const;

/** The LATCH bits of what this input holds. */
export function latchOf(inp: InputFrame): number {
  return (inp.down ? LATCH.down : 0) | (inp.up ? LATCH.up : 0) | (inp.left ? LATCH.left : 0) | (inp.right ? LATCH.right : 0) | (inp.jump ? LATCH.jump : 0);
}

/** What a module's `touch` asks for through `ctx.grab`. */
export interface GrabInit {
  x: number;
  y: number;
  len?: number;
  s?: number;
  hooked?: boolean;
  sealed?: boolean;
  /** `prop` event kind for the moment of the grab. */
  kind: string;
}

export interface GrabRequest {
  r: Runner;
  uid: number;
  mi: number;
  g: GrabInit;
}

/** Frames before you can re-grab what you just left: long enough to clear a rope or a keg's mouth. */
export const REGRAB = 20;

export function newAttach(): RunnerAttach {
  return { grip: null, cd: 0, cdUid: -1, cdMi: -1, soot: 0, latch: 0 };
}

/** World gravity (px/s²) at this level's setting. `Level.gravity` lands with the level-variety work; until then it's absent, which means normal. */
export function worldGravity(level: Level): number {
  return PHYS.gravity * ((level as Level & { gravity?: number }).gravity ?? 1);
}

/** Drop whatever is holding this runner. Their velocity stays as it is. */
export function letGo(r: Runner): void {
  const a = r.attach;
  if (!a.grip) return;
  a.cd = REGRAB;
  a.cdUid = a.grip.uid;
  a.cdMi = a.grip.mi;
  a.grip = null;
}

/** Did something other than the holding module act on this body since last frame? */
function shoved(r: Runner, g: Grip): boolean {
  return r.body.vx !== g.vx || r.body.vy !== g.vy || r.items.thrust > 0;
}

/**
 * One frame of being held, before the runner's usual step. True means a module
 * moved the body this frame, so the controller must not; false means this
 * runner is free, possibly since just now.
 */
export function stepHold(w: RunWorld, r: Runner, inp: InputFrame, f: number): boolean {
  const a = r.attach;
  if (a.cd > 0) a.cd--;
  if (a.latch) a.latch &= latchOf(inp);
  const g = a.grip;
  if (!g) return false;
  const rp = w.resolved.find((x) => x.pp.uid === g.uid);
  const m = rp?.mods[g.mi];
  const sim = m && moduleSim(m.type);
  if (!rp || !m || !sim?.hold || w.isBroken(g.uid) || shoved(r, g) || firstOverlap(r.body, w.world)) {
    letGo(r);
    return false;
  }
  const keep = sim.hold(m, w.touchCtx(rp, g.mi, f, r, undefined, inp), r, g, inp);
  g.t++;
  g.vx = r.body.vx;
  g.vy = r.body.vy;
  if (!keep) letGo(r);
  return true;
}

/** Nothing the body was doing on the ground or a wall carries into a grab. */
function stick(r: Runner): void {
  const b = r.body;
  b.onGround = false;
  b.groundRef = -1;
  b.jumping = false;
  b.coyote = 0;
  b.jumpBuffer = 0;
  b.wallDir = 0;
  b.wallCoyote = 0;
  b.wallLock = 0;
  b.dropFrames = 0;
}

const reach = (q: GrabRequest) => q.g.x * q.g.x + q.g.y * q.g.y;

/**
 * Resolve this frame's grabs once everyone has moved, so nobody wins a tie by
 * runner order: a part holds one runner at a time and goes to the nearest,
 * then the lower slot.
 */
export function settleGrabs(w: RunWorld, grabs: GrabRequest[]): void {
  if (!grabs.length) return;
  grabs.sort((p, q) => p.uid - q.uid || p.mi - q.mi || reach(p) - reach(q) || p.r.slot - q.r.slot);
  for (const { r, uid, mi, g } of grabs) {
    const a = r.attach;
    if (!r.alive || r.finished || a.grip || (a.cd > 0 && a.cdUid === uid && a.cdMi === mi)) continue;
    if (w.runners.some((o) => o.attach.grip?.uid === uid && o.attach.grip.mi === mi)) continue;
    stick(r);
    const { vx, vy } = r.body;
    a.grip = { uid, mi, t: 0, x: g.x, y: g.y, len: g.len ?? 0, s: g.s ?? 0, hooked: !!g.hooked, fuse: -1, aim: 0, sealed: !!g.sealed, to: -1, vx, vy };
    w.events.push({ type: 'prop', kind: g.kind, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2 });
  }
  grabs.length = 0;
}

/** A runner-sized box centered on (cx, cy). */
export function boxAt(b: Rect, cx: number, cy: number): Rect {
  return { x: cx - b.w / 2, y: cy - b.h / 2, w: b.w, h: b.h };
}
