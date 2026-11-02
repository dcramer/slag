import { TILE } from '../../constants';
import { beamHazard, castBeam } from '../rays';
import { cellOf, defineModule } from '../registry';
import { cycle, dirOf } from '../transform';
import type { ModuleOf } from '../types';

/** Segments: 0 off, 1 warn (sputter), 2 on (lethal). */
export const flameCycle = (m: ModuleOf<'flame'>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

export const flame = defineModule<'flame'>({
  type: 'flame',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, length: m.length * x.T }),
  anchors: (m) => [cellOf(m.at)],
  trace(m, ctx, out) {
    const ax = m.at[0] + ctx.off[0];
    const ay = m.at[1] + ctx.off[1];
    const [dx, dy] = dirOf(m.angle);
    const beam = castBeam(ctx, out, ax, ay, dx, dy, m.length + TILE / 2, 8);
    if (flameCycle(m, ctx.frame, ctx.r.phase).seg === 2) beamHazard(ctx, out, ax, ay, dx, dy, TILE / 2, beam, 5);
  },
});
