import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import type { Level } from '../../level';
import { type Wind, windSpeed } from '../../wind';
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

type Column = NonNullable<ReturnType<typeof geyserColumn>>;

/** Rect the erupting column covers (the lava hazard). */
export function geyserRect(m: Geyser, col: Column): Rect {
  const hw = m.width / 2;
  const x = Math.min(col.x, col.x + col.dx * col.len) - (col.dx === 0 ? hw : 0);
  const y = Math.min(col.y, col.y + col.dy * col.len) - (col.dy === 0 ? hw : 0);
  return { x, y, w: col.dx === 0 ? m.width : col.len, h: col.dy === 0 ? m.width : col.len };
}

/** Steam updraft of an erupting column: 2 px wider, reaching half a tile past the plume's tip. The art draws from this too. */
export function geyserWind(m: Geyser, col: Column): Wind {
  const r = geyserRect(m, col);
  const ext = TILE * 0.5;
  const pad = 2;
  return {
    x: r.x - (col.dx === 0 ? pad : col.dx < 0 ? ext : 0),
    y: r.y - (col.dy === 0 ? pad : col.dy < 0 ? ext : 0),
    w: r.w + (col.dx === 0 ? 2 * pad : ext),
    h: r.h + (col.dy === 0 ? 2 * pad : ext),
    dx: col.dx,
    dy: col.dy,
    speed: windSpeed(m.strength),
    k: col.k,
  };
}

/**
 * Lava/steam geyser: a timed column. Lava kills; steam is an updraft
 * (windSpeed(strength)) that only blows while erupting (segment 2, ramped by
 * k), carrying runners up to float at the plume's tip until it collapses.
 */
export const geyser = defineModule<'geyser'>({
  type: 'geyser',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, width: m.width * x.T, length: m.length * x.T }),
  // The first cell the column passes through (the vent sits on the ground surface).
  anchors: (m) => [cellOf([m.at[0] + Math.cos(m.angle) * 0.5, m.at[1] + Math.sin(m.angle) * 0.5])],
  build(m, ctx, out) {
    const col = geyserColumn(m, ctx.frame, ctx.r.phase, ctx.level, ctx.off[0], ctx.off[1]);
    if (!col || col.len < 2) return;
    if (m.lethal) out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: geyserRect(m, col) });
    else out.winds.push(geyserWind(m, col));
  },
});
