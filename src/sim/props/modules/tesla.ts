import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

/** Segments: 0 off, 1 warn (sparks), 2 arcing (lethal). */
export const teslaCycle = (m: ModuleOf<'tesla'>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

export const tesla = defineModule<'tesla'>({
  type: 'tesla',
  resolve: (m, x) => ({ ...m, a: x.P(m.a), b: x.P(m.b) }),
  anchors: (m) => [cellOf(m.a), cellOf(m.b)],
  build(m, ctx, out) {
    if (teslaCycle(m, ctx.frame, ctx.r.phase).seg !== 2) return;
    const [ox, oy] = ctx.off;
    out.hazards.push({ owner: ctx.r.pp.owner, kind: 'seg', x1: m.a[0] + ox, y1: m.a[1] + oy, x2: m.b[0] + ox, y2: m.b[1] + oy, r: 4 });
  },
});
