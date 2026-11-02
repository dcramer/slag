import { dcos, dsin } from '../../../core/dmath';
import { beamHazard, castBeam } from '../rays';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Laser = ModuleOf<'laser'>;

/** Segments: 0 off, 1 charging (telegraph), 2 firing (lethal). */
export const laserCycle = (m: Laser, f: number, phase: number) => cycle(f, phase, [m.off, m.charge, m.fire]);

export function laserAngle(m: Laser, f: number, phase: number): number {
  return m.sweep ? m.angle + m.sweep * dsin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

export const laser = defineModule<'laser'>({
  type: 'laser',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  trace(m, ctx, out) {
    const a = laserAngle(m, ctx.frame, ctx.r.phase);
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    const dx = dcos(a);
    const dy = dsin(a);
    const beam = castBeam(ctx, out, x, y, dx, dy, 1200, 9, a);
    if (laserCycle(m, ctx.frame, ctx.r.phase).seg === 2) beamHazard(ctx, out, x, y, dx, dy, 9, beam, 3);
  },
});
