import type { Vec } from '../../../core/geom';
import { TILE } from '../../constants';
import { type Level, tileAt } from '../../level';
import { type Wind, windSpeed } from '../../wind';
import { cellOf, defineModule } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';

/**
 * Wind column of a fan, truncated at the first solid tile. Fans never cycle:
 * the column is always on at windSpeed(strength). The art draws from this too.
 */
export function fanZone(level: Level, m: ModuleOf<'fan'>, off: Vec = [0, 0]): Wind {
  const [dx, dy] = dirOf(m.angle);
  const tx = Math.floor(m.at[0] / TILE);
  const ty = Math.floor(m.at[1] / TILE);
  let len = 0;
  while (len < m.length && tileAt(level, tx + dx * (len + 1), ty + dy * (len + 1)) !== 1) len++;
  const x0 = Math.min(tx, tx + dx * len) + (dx > 0 ? 1 : 0);
  const y0 = Math.min(ty, ty + dy * len) + (dy > 0 ? 1 : 0);
  const w = dx !== 0 ? len : 1;
  const h = dy !== 0 ? len : 1;
  return { x: x0 * TILE - 2 + off[0], y: y0 * TILE - 2 + off[1], w: w * TILE + 4, h: h * TILE + 4, dx, dy, speed: windSpeed(m.strength), k: 1 };
}

export const fan = defineModule<'fan'>({
  type: 'fan',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    out.winds.push(fanZone(ctx.level, m, ctx.off));
  },
});
