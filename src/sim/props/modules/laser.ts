import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { cycle, rayToWall } from '../transform';
import type { ModuleOf } from '../types';

type Laser = ModuleOf<'laser'>;

/** Segments: 0 off, 1 charging (telegraph), 2 firing (lethal). */
export const laserCycle = (m: Laser, f: number, phase: number) => cycle(f, phase, [m.off, m.charge, m.fire]);

export function laserAngle(m: Laser, f: number, phase: number): number {
  return m.sweep ? m.angle + m.sweep * Math.sin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

export const laser = defineModule<'laser'>({
  type: 'laser',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    if (laserCycle(m, ctx.frame, ctx.r.phase).seg !== 2) return;
    const a = laserAngle(m, ctx.frame, ctx.r.phase);
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    const len = rayToWall(ctx.level, x, y, a, Math.max(1200, (ctx.level.w + ctx.level.h) * TILE), 9);
    out.hazards.push({
      owner: ctx.r.pp.owner,
      kind: 'seg',
      x1: x + Math.cos(a) * 9,
      y1: y + Math.sin(a) * 9,
      x2: x + Math.cos(a) * len,
      y2: y + Math.sin(a) * len,
      r: 3,
    });
  },
});
