import { dcos, dsin } from '../../../core/dmath';
import { TILE } from '../../constants';
import type { Level } from '../../level';
import { cellOf, defineModule } from '../registry';
import { cycle, dirOf, rayToWall } from '../transform';
import type { ModuleOf } from '../types';

type Geyser = ModuleOf<'geyser'>;

/** Segments: 0 dormant, 1 rumbling (telegraph), 2 erupting. */
export const geyserCycle = (m: Geyser, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

/** Frames for the column to shoot up / collapse at the ends of an eruption. */
const RAMP = 8;

/**
 * Current column: base point, direction, reach (px) and 0..1 strength.
 * Null when dormant or rumbling. The column stops at the first solid tile.
 */
export function geyserColumn(
  m: Geyser,
  f: number,
  phase: number,
  level: Level | null,
  ox = 0,
  oy = 0,
): { x: number; y: number; dx: number; dy: number; len: number; k: number } | null {
  const c = geyserCycle(m, f, phase);
  if (c.seg !== 2) return null;
  const k = Math.min(1, (c.t + 1) / RAMP, (c.len - c.t) / RAMP);
  const x = m.at[0] + ox;
  const y = m.at[1] + oy;
  const full = level ? rayToWall(level, x, y, m.angle, m.length, 2) : m.length;
  const [dx, dy] = dirOf(m.angle);
  return { x, y, dx, dy, len: full * Math.min(1, (c.t + 1) / RAMP), k };
}

/** Lava/steam geyser: a timed column. Lava kills; steam is a strong updraft that launches runners. */
export const geyser = defineModule<'geyser'>({
  type: 'geyser',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, width: m.width * x.T, length: m.length * x.T }),
  // The first cell the column passes through (the vent sits on the ground surface).
  anchors: (m) => [cellOf([m.at[0] + dcos(m.angle) * 0.5, m.at[1] + dsin(m.angle) * 0.5])],
  build(m, ctx, out) {
    const col = geyserColumn(m, ctx.frame, ctx.r.phase, ctx.level, ctx.off[0], ctx.off[1]);
    if (!col || col.len < 2) return;
    const hw = m.width / 2;
    const x0 = Math.min(col.x, col.x + col.dx * col.len) - (col.dx === 0 ? hw : 0);
    const y0 = Math.min(col.y, col.y + col.dy * col.len) - (col.dy === 0 ? hw : 0);
    const w = col.dx === 0 ? m.width : col.len;
    const h = col.dy === 0 ? m.width : col.len;
    if (m.lethal) out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: x0, y: y0, w, h } });
    else out.winds.push({ x: x0 - 2, y: y0 - TILE * 0.5, w: w + 4, h: h + TILE * 0.5, ax: col.dx * m.strength * col.k, ay: col.dy * m.strength * col.k });
  },
});
