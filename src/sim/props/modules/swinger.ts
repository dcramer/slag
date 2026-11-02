import { dcos, dsin } from '../../../core/dmath';
import type { Rect, Vec } from '../../../core/geom';
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

/** A log head's length and thickness, in radii: a trunk three and a half radii long, a little over one thick. */
export const LOG_LEN = 3.4;
export const LOG_THICK = 1.1;

/**
 * Where a log head hurts: the whole log, level whatever the swing (it hangs on two parallel ropes, so it
 * stays level as it swings), centred on the head. The art draws the same box.
 */
export function logBox(m: Swinger, h: { x: number; y: number }): Rect {
  const L = m.radius * LOG_LEN;
  const T = m.radius * LOG_THICK;
  return { x: h.x - L / 2, y: h.y - T / 2, w: L, h: T };
}

/** Saw / mace / axe heads on an arm: static, orbiting, or pendulum; or a log slung level, battering along its length. */
export const swinger = defineModule<'swinger'>({
  type: 'swinger',
  resolve: (m, x) => ({ ...m, hub: x.P(m.hub), arm: m.arm * x.T, radius: m.radius * x.T, angle0: m.angle0 + x.da }),
  anchors: (m) => [cellOf(m.hub)],
  build(m, ctx, out) {
    for (const h of swingHeads(m, ctx.frame, ctx.r.phase, ctx.off)) {
      if (m.head === 'log') out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: logBox(m, h) });
      else out.hazards.push({ owner: ctx.r.pp.owner, kind: 'circle', x: h.x, y: h.y, r: m.radius * (m.head === 'axe' ? 0.8 : 0.85) });
    }
  },
});
