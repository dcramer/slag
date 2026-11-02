import { dcos, dsin } from '../../../core/dmath';
import type { Vec } from '../../../core/geom';
import { cellOf, defineModule } from '../registry';
import type { ModuleOf } from '../types';

type Swinger = ModuleOf<'swinger'>;

/** Angles of each head at frame f. */
export function swingAngles(m: Swinger, f: number, phase: number): number[] {
  if (m.swing > 0) return [m.angle0 + m.swing * dsin(Math.PI * 2 * (f / m.period + phase))];
  const base = m.angle0 + m.dir * Math.PI * 2 * (f / m.period + phase);
  return Array.from({ length: m.count }, (_, i) => base + (i * Math.PI * 2) / m.count);
}

export function swingHeads(m: Swinger, f: number, phase: number, off: Vec): { x: number; y: number; a: number }[] {
  return swingAngles(m, f, phase).map((a) => ({ x: m.hub[0] + off[0] + dcos(a) * m.arm, y: m.hub[1] + off[1] + dsin(a) * m.arm, a }));
}

/** Saw / mace / axe heads on an arm: static, orbiting, or pendulum. */
export const swinger = defineModule<'swinger'>({
  type: 'swinger',
  resolve: (m, x) => ({ ...m, hub: x.P(m.hub), arm: m.arm * x.T, radius: m.radius * x.T, angle0: m.angle0 + x.da }),
  anchors: (m) => [cellOf(m.hub)],
  build(m, ctx, out) {
    for (const h of swingHeads(m, ctx.frame, ctx.r.phase, ctx.off))
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'circle', x: h.x, y: h.y, r: m.radius * (m.head === 'axe' ? 0.8 : 0.85) });
  },
});
