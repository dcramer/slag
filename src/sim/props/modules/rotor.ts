import { dcos, dsin } from '../../../core/dmath';
import type { Rect, Vec } from '../../../core/geom';
import { DEFAULT_SURFACE } from '../../physics';
import { cellOf, defineModule, solidId } from '../registry';
import type { ModuleOf } from '../types';
import { SURFACES } from './body';

type Rotor = ModuleOf<'rotor'>;

export interface RotorArm {
  /** Platform center (px). */
  x: number;
  y: number;
  /** Arm angle (rad, screen space). */
  a: number;
}

/** Arm angles at frame f: a pendulum swings around angle0, a wheel turns continuously. */
export function rotorAngles(m: Rotor, f: number, phase: number): number[] {
  const t = Math.PI * 2 * (f / m.period + phase);
  if (m.swing > 0) return [m.angle0 + m.swing * dsin(t)];
  const base = m.angle0 + m.dir * t;
  return Array.from({ length: m.count }, (_, i) => base + (i * Math.PI * 2) / m.count);
}

function smoothArms(m: Rotor, f: number, phase: number, off: Vec): RotorArm[] {
  return rotorAngles(m, f, phase).map((a) => ({ x: m.hub[0] + off[0] + dcos(a) * m.arm, y: m.hub[1] + off[1] + dsin(a) * m.arm, a }));
}

/**
 * Platform centers at frame f. Art draws from this so it always matches the sim.
 *
 * Carry-safe path: the rider is carried by moving it along x and then y
 * (physics `stepBody`), so a platform that rises *and* slides in the same
 * frame would overlap its rider during the x move and shove it off. On odd
 * frames the platform therefore takes the next frame's x at the lower of
 * the two neighbouring heights, and on even frames it rises straight up:
 * every step is either sideways-or-down or straight up. The path deviates
 * from the smooth circle by at most one frame of vertical travel.
 */
export function rotorArms(m: Rotor, f: number, phase: number, off: Vec = [0, 0]): RotorArm[] {
  if ((f & 1) === 0) return smoothArms(m, f, phase, off);
  const a = smoothArms(m, f - 1, phase, off);
  const b = smoothArms(m, f + 1, phase, off);
  const mid = rotorAngles(m, f, phase);
  return b.map((p, i) => ({ x: p.x, y: Math.max(a[i].y, p.y), a: mid[i] }));
}

/** The (always level) platform rect around an arm end. */
export function rotorPlatform(m: Rotor, p: { x: number; y: number }): Rect {
  return { x: p.x - m.width / 2, y: p.y - m.thick / 2, w: m.width, h: m.thick };
}

/** Wheels and pendulums carrying level platforms (windmill sails, chandeliers, crane hooks). */
export const rotor = defineModule<'rotor'>({
  type: 'rotor',
  resolve: (m, x) => ({
    ...m,
    hub: x.P(m.hub),
    mastX: x.P([m.mastX, 0])[0],
    arm: m.arm * x.T,
    width: m.width * x.T,
    thick: m.thick * x.T,
    angle0: m.angle0 + x.da,
  }),
  anchors: (m) => [cellOf(m.hub)],
  // Each platform stays level as it goes round, so what's stuck to one just follows its center.
  carrier: {
    at: (m, f, phase, part) => {
      const p = rotorArms(m, f, phase)[part];
      return p ? [p.x, p.y] : null;
    },
    drives: true,
    period: (m) => m.period,
  },
  build(m, ctx, out) {
    const now = rotorArms(m, ctx.frame, ctx.r.phase, ctx.off);
    const before = rotorArms(m, ctx.frame - 1, ctx.r.phase, ctx.prev);
    const surface = SURFACES[m.material] ?? DEFAULT_SURFACE;
    now.forEach((p, i) => {
      const r = rotorPlatform(m, p);
      const q = rotorPlatform(m, before[i]);
      out.solids.push({ ...r, id: solidId(ctx.r.pp.uid, ctx.mi, i), dx: r.x - q.x, dy: r.y - q.y, surface, propUid: ctx.r.pp.uid, mi: ctx.mi });
    });
  },
});
