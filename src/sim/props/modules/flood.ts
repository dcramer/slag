import type { Cell } from '../../../core/geom';
import { defineModule } from '../registry';

/**
 * Rising liquid (stage concepts, docs/SETPIECES.md). Wave 0 registers the type
 * so concepts can name it: it claims the basin it fills for placement and does
 * nothing yet. Its cycle, crest and kill line come with its own task.
 */
export const flood = defineModule<'flood'>({
  type: 'flood',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, low: m.low * x.T, high: m.high * x.T }),
  anchors: (m) => {
    const out: Cell[] = [];
    for (let y = Math.floor(m.at[1] - m.high); y < Math.ceil(m.at[1]); y++)
      for (let x = Math.floor(m.at[0]); x < Math.ceil(m.at[0] + m.w); x++) out.push([x, y]);
    return out;
  },
});
