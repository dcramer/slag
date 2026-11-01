import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { defineModule } from '../registry';
import { dirOf } from '../transform';

/** Spike strip on one face of some cells (the cells belong to a body module). */
export const spikes = defineModule<'spikes'>({
  type: 'spikes',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), angle: m.angle + x.da }),
  anchors: () => [],
  build(m, ctx, out) {
    const [dx, dy] = dirOf(m.angle);
    const owner = ctx.r.pp.owner;
    for (const [cx, cy] of m.cells) {
      const x = cx * TILE + ctx.off[0];
      const y = cy * TILE + ctx.off[1];
      const d = 7;
      const r: Rect =
        dx > 0
          ? { x: x + TILE, y: y + 2, w: d, h: TILE - 4 }
          : dx < 0
            ? { x: x - d, y: y + 2, w: d, h: TILE - 4 }
            : dy > 0
              ? { x: x + 2, y: y + TILE, w: TILE - 4, h: d }
              : { x: x + 2, y: y - d, w: TILE - 4, h: d };
      out.hazards.push({ owner, kind: 'rect', r });
    }
  },
});
