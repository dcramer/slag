import { sq } from '../../../core/dmath';
import { frac, type Rect, type Vec } from '../../../core/geom';
import { TILE } from '../../constants';
import { cellOf, defineModule, solidId } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';
import { SURFACES } from './body';

type Piston = ModuleOf<'piston'>;

/** Extension 0..1 and whether it's currently slamming outward. */
export function pistonState(m: Piston, f: number, phase: number): { ext: number; slamming: boolean } {
  const t = frac(f / m.period + phase);
  if (t < 0.12) return { ext: sq(t / 0.12), slamming: true };
  if (t < 0.45) return { ext: 1, slamming: false };
  if (t < 0.9) {
    const u = (t - 0.45) / 0.45;
    return { ext: 1 - u * u * (3 - 2 * u), slamming: false };
  }
  return { ext: 0, slamming: false };
}

export function pistonHead(m: Piston, ext: number, off: Vec): Rect {
  const [dx, dy] = dirOf(m.angle);
  const thick = TILE * 0.5;
  const d = TILE * 0.5 + thick / 2 + ext * m.reach;
  const cx = m.at[0] + off[0] + dx * d;
  const cy = m.at[1] + off[1] + dy * d;
  const w = dx !== 0 ? thick : m.width;
  const h = dx !== 0 ? m.width : thick;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Crusher: a solid head that slams out (lethal leading edge) and slowly retracts. */
export const piston = defineModule<'piston'>({
  type: 'piston',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, reach: m.reach * x.T, width: m.width * x.T }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    const st = pistonState(m, ctx.frame, ctx.r.phase);
    const head = pistonHead(m, st.ext, ctx.off);
    const prevHead = pistonHead(m, pistonState(m, ctx.frame - 1, ctx.r.phase).ext, ctx.prev);
    out.solids.push({
      ...head,
      id: solidId(ctx.r.pp.uid, ctx.mi, 63),
      dx: head.x - prevHead.x,
      dy: head.y - prevHead.y,
      surface: SURFACES.metal,
      propUid: ctx.r.pp.uid,
      mi: ctx.mi,
    });
    if (st.slamming) {
      const [dx, dy] = dirOf(m.angle);
      const lead: Rect =
        dx > 0
          ? { x: head.x + head.w, y: head.y, w: 4, h: head.h }
          : dx < 0
            ? { x: head.x - 4, y: head.y, w: 4, h: head.h }
            : dy > 0
              ? { x: head.x, y: head.y + head.h, w: head.w, h: 4 }
              : { x: head.x, y: head.y - 4, w: head.w, h: 4 };
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: lead });
    }
  },
});
