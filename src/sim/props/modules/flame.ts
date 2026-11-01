import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { cycle, dirOf, rayToWall } from '../transform';
import type { ModuleOf } from '../types';

/** Segments: 0 off, 1 warn (sputter), 2 on (lethal). */
export const flameCycle = (m: ModuleOf<'flame'>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

export const flame = defineModule<'flame'>({
  type: 'flame',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, length: m.length * x.T }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    if (flameCycle(m, ctx.frame, ctx.r.phase).seg !== 2) return;
    const ax = m.at[0] + ctx.off[0];
    const ay = m.at[1] + ctx.off[1];
    const len = rayToWall(ctx.level, ax, ay, m.angle, m.length + TILE / 2, 8);
    const [dx, dy] = dirOf(m.angle);
    out.hazards.push({ owner: ctx.r.pp.owner, kind: 'seg', x1: ax + dx * TILE * 0.5, y1: ay + dy * TILE * 0.5, x2: ax + dx * len, y2: ay + dy * len, r: 5 });
  },
});
