import { dhypot } from '../../../core/dmath';
import { castBeam } from '../rays';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

/** Segments: 0 off, 1 warn (sparks), 2 arcing (lethal). */
export const teslaCycle = (m: ModuleOf<'tesla'>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

/** An arc needs a clear line between its coils: anything in the way shorts the whole gate. */
export const tesla = defineModule<'tesla'>({
  type: 'tesla',
  resolve: (m, x) => ({ ...m, a: x.P(m.a), b: x.P(m.b) }),
  anchors: (m) => [cellOf(m.a), cellOf(m.b)],
  trace(m, ctx, out) {
    const [ox, oy] = ctx.off;
    const x1 = m.a[0] + ox;
    const y1 = m.a[1] + oy;
    const x2 = m.b[0] + ox;
    const y2 = m.b[1] + oy;
    const span = dhypot(x2 - x1, y2 - y1);
    const beam = castBeam(ctx, out, x1, y1, (x2 - x1) / span, (y2 - y1) / span, span, 0);
    if (!beam.hit && teslaCycle(m, ctx.frame, ctx.r.phase).seg === 2) out.hazards.push({ owner: ctx.r.pp.owner, kind: 'seg', x1, y1, x2, y2, r: 4 });
  },
});
