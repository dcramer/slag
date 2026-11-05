import type { Vec } from '../../../core/geom';
import { TILE } from '../../constants';
import type { Level } from '../../level';
import type { Solid } from '../../physics';
import { type Wind, windSpeed } from '../../wind';
import { castRay, reportBeam } from '../rays';
import { cellOf, defineModule } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';

/** The column reaching `reach` px past a fan's own cell. Fans never cycle: it's always on at windSpeed(strength). The art draws from this too. */
export function fanColumn(m: ModuleOf<'fan'>, reach: number, off: Vec = [0, 0]): Wind {
  const [dx, dy] = dirOf(m.angle);
  const cx = Math.floor(m.at[0] / TILE) * TILE;
  const cy = Math.floor(m.at[1] / TILE) * TILE;
  const x = dx > 0 ? cx + TILE : dx < 0 ? cx - reach : cx;
  const y = dy > 0 ? cy + TILE : dy < 0 ? cy - reach : cy;
  const w = dx !== 0 ? reach : TILE;
  const h = dy !== 0 ? reach : TILE;
  return { x: x - 2 + off[0], y: y - 2 + off[1], w: w + 4, h: h + 4, dx, dy, speed: windSpeed(m.strength), k: 1 };
}

/** How far a fan's column gets before terrain or a solid cuts it off. */
function fanReach(level: Level, solids: readonly Solid[], m: ModuleOf<'fan'>, off: Vec, uid: number): number {
  const [dx, dy] = dirOf(m.angle);
  const x = (Math.floor(m.at[0] / TILE) + 0.5) * TILE + off[0];
  const y = (Math.floor(m.at[1] / TILE) + 0.5) * TILE + off[1];
  return castRay(level, solids, x, y, dx, dy, (m.length + 0.5) * TILE, TILE / 2, uid) - TILE / 2;
}

/** A fan's column with only terrain in the way. */
export function fanZone(level: Level, m: ModuleOf<'fan'>, off: Vec = [0, 0]): Wind {
  return fanColumn(m, fanReach(level, [], m, off, -1), off);
}

defineModule<'fan'>({
  type: 'fan',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  trace(m, ctx, out) {
    const reach = fanReach(ctx.level, out.solids, m, ctx.off, ctx.r.pp.uid);
    reportBeam(ctx, out, reach, reach < m.length * TILE);
    out.winds.push(fanColumn(m, reach, ctx.off));
  },
});
