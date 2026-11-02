import type { Cell } from '../../../core/geom';
import { defineModule } from '../registry';

/** Scenery dressing for set pieces. Occupies its cells for placement; no runtime behavior. */
export const deco = defineModule<'deco'>({
  type: 'deco',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, h: m.h * x.T }),
  anchors: (m) => {
    const out: Cell[] = [];
    for (let y = Math.floor(m.at[1]); y < Math.ceil(m.at[1] + m.h); y++) for (let x = Math.floor(m.at[0]); x < Math.ceil(m.at[0] + m.w); x++) out.push([x, y]);
    return out;
  },
});
