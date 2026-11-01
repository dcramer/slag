import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { dirOf } from '../transform';

/** Launch pad; RunWorld applies the impulse when a runner overlaps the trigger. */
export const spring = defineModule<'spring'>({
  type: 'spring',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    const [dx, dy] = dirOf(m.angle);
    const ox = m.at[0] + ctx.off[0] - TILE / 2;
    const oy = m.at[1] + ctx.off[1] - TILE / 2;
    const pad = { x: ox + 2, y: oy + 2, w: TILE - 4, h: TILE - 4 };
    if (dy < 0) pad.y = oy + TILE / 2;
    if (dy > 0) pad.h = TILE / 2;
    if (dx > 0) pad.w = TILE / 2;
    if (dx < 0) pad.x = ox + TILE / 2;
    out.springs.push({ rect: pad, angle: m.angle, power: m.power, uid: ctx.r.pp.uid });
  },
});
