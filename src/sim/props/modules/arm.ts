import { dcos, dsin } from '../../../core/dmath';
import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Arm = ModuleOf<'arm'>;

/** Segments of a robot arm's cycle. */
export const ARM_REST = 0;
export const ARM_WARN = 1;
export const ARM_STRIKE = 2;
export const ARM_WELD = 3;
export const ARM_BACK = 4;

/** The welding head's radius, as a share of a tile. */
export const HEAD_R = 0.45;

const DEG = Math.PI / 180;
/**
 * The arm's poses, as (shoulder, elbow) angles: the shoulder's from +x toward the side it strikes, the
 * elbow's relative to the upper arm. Raised and poised; chopped down in front of its pedestal, forearm
 * hanging; reached out along the floor. With both segments `reach` long, the head ends near a runner's
 * middle a pedestal's height under the shoulder, every pose in between above the floor.
 */
const RAISED = [-100 * DEG, 70 * DEG] as const;
const CHOP = [-40 * DEG, 130 * DEG] as const;
const OUT = [5 * DEG, 20 * DEG] as const;
/** Share of the strike spent chopping down, the rest sweeping out. */
const CHOP_BY = 0.4;

/** Where the arm is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const armCycle = (m: Arm, f: number, phase: number) => cycle(f, phase, [m.rest, m.warn, m.strike, m.weld, m.back]);

const mix = (a: readonly [number, number], b: readonly [number, number], u: number): [number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const ease = (u: number) => u * u * (3 - 2 * u);

/** The (shoulder, elbow) angles on frame `f`, in the arm's own frame (toward +x). */
export function armAngles(m: Arm, f: number, phase: number): [number, number] {
  const c = armCycle(m, f, phase);
  const u = c.t / Math.max(1, c.len);
  if (c.seg === ARM_STRIKE) return u < CHOP_BY ? mix(RAISED, CHOP, u / CHOP_BY) : mix(CHOP, OUT, (u - CHOP_BY) / (1 - CHOP_BY));
  if (c.seg === ARM_WELD) return [OUT[0], OUT[1]];
  if (c.seg === ARM_BACK) return mix(OUT, RAISED, ease(u));
  return [RAISED[0], RAISED[1]];
}

/** Shoulder, elbow and head (px, with the prop's offset) on frame `f`: the art draws these, the sim hurts with the head. */
export function armJoints(m: Arm, f: number, phase: number, ox = 0, oy = 0): { sx: number; sy: number; ex: number; ey: number; hx: number; hy: number } {
  const [a, b] = armAngles(m, f, phase);
  const sx = m.at[0] + ox;
  const sy = m.at[1] + oy;
  const ex = sx + m.dir * dcos(a) * m.reach;
  const ey = sy + dsin(a) * m.reach;
  return { sx, sy, ex, ey, hx: ex + m.dir * dcos(a + b) * m.reach, hy: ey + dsin(a + b) * m.reach };
}

/** Is the head hot on frame `f` (striking or welding)? */
export const armHot = (m: Arm, f: number, phase: number) => {
  const s = armCycle(m, f, phase).seg;
  return s === ARM_STRIKE || s === ARM_WELD;
};

/**
 * Factory-only, world-only hazard (docs/SETPIECES.md, Factory): an assembly-line robot arm on its
 * pedestal. Raised and cold most of the time; its lamp blinks (drawn, never felt), then it strikes: the
 * welding head chops down in front of the pedestal and sweeps out along the floor, welds a moment at the
 * end of its reach, then folds back up cold, slower than it struck. Only the head hurts, and only while
 * it strikes and welds, so the floor in front is passable by timing (barrier.ts MIN_OPENING). The pedestal
 * is its piece's own block; nothing of the arm is solid.
 */
export const arm = defineModule<'arm'>({
  type: 'arm',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), reach: m.reach * x.T }),
  // The shoulder's cell, on top of the pedestal.
  anchors: (m) => [cellOf([m.at[0], m.at[1] - 0.5])],
  build(m, ctx, out) {
    if (!armHot(m, ctx.frame, ctx.r.phase)) return;
    const j = armJoints(m, ctx.frame, ctx.r.phase, ctx.off[0], ctx.off[1]);
    out.hazards.push({ owner: ctx.r.pp.owner, ignites: true, kind: 'circle', x: j.hx, y: j.hy, r: HEAD_R * TILE });
  },
});
