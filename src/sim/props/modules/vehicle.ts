import type { Rect, Vec } from '../../../core/geom';
import { DEFAULT_SURFACE } from '../../physics';
import { cellOf, defineModule, solidId } from '../registry';
import type { ModuleOf } from '../types';

type Vehicle = ModuleOf<'vehicle'>;

export interface VehiclePose {
  /** Offset (px) from the route start. */
  x: number;
  /** Travel direction while moving; the direction it will go next while parked. */
  dir: 1 | -1;
  moving: boolean;
  /** Odometer (px), for wheel spin. */
  dist: number;
  /** Signed speed (px/frame), for exhaust and wobble. */
  v: number;
  /** 0..1 progress through the current stop (1 while moving). */
  park: number;
}

/** Frames needed to cover the route once. */
function vehicleTravel(m: Vehicle): number {
  return Math.max(8, Math.round(m.span / Math.max(1e-6, m.speed / 60)));
}

/** Eased route position: gentle pull-away and braking around a linear cruise. */
function ease(u: number): number {
  const k = 0.18;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < k) return (u * u) / (2 * k * (1 - k));
  if (u > 1 - k) return 1 - ((1 - u) * (1 - u)) / (2 * k * (1 - k));
  return (u - k / 2) / (1 - k);
}

/** Where the vehicle is at frame f: out along the route, stop, back, stop. */
export function vehiclePose(m: Vehicle, f: number, phase: number): VehiclePose {
  const T = vehicleTravel(m);
  const P = Math.max(1, m.pause);
  const total = 2 * (T + P);
  const g = f + Math.floor(phase * total);
  const n = Math.floor(g / total);
  const t = g - n * total;
  const span = m.span;
  const base = n * 2 * span;
  if (t < T) {
    const x = span * ease(t / T);
    return { x, dir: 1, moving: true, dist: base + x, v: x - span * ease((t - 1) / T), park: 1 };
  }
  if (t < T + P) return { x: span, dir: -1, moving: false, dist: base + span, v: 0, park: (t - T) / P };
  if (t < 2 * T + P) {
    const u = t - T - P;
    const x = span * (1 - ease(u / T));
    return { x, dir: -1, moving: true, dist: base + 2 * span - x, v: x - span * (1 - ease((u - 1) / T)), park: 1 };
  }
  return { x: 0, dir: 1, moving: false, dist: base + 2 * span, v: 0, park: (t - 2 * T - P) / P };
}

/** Column solids (px) of the body at route offset x. */
export function vehicleCols(m: Vehicle, x: number, off: Vec = [0, 0]): Rect[] {
  return m.cols.map((h, i) => ({ x: m.at[0] + off[0] + x + i * m.colW, y: m.at[1] + off[1] - h, w: m.colW, h }));
}

/** Tractors, carts and boulders patrolling a stretch of ground. Rideable roof; the leading face kills while it moves. */
export const vehicle = defineModule<'vehicle'>({
  type: 'vehicle',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), cols: m.cols.map((h) => h * x.T), colW: m.colW * x.T, span: m.span * x.T, speed: m.speed * x.T }),
  anchors: (m) => [cellOf([m.at[0] + 0.5, m.at[1] - 0.5])],
  // The whole body slides along its route, so a rider just takes the route offset.
  carrier: { at: (m, f, phase) => [vehiclePose(m, f, phase).x, 0], drives: true, period: (m) => 2 * (vehicleTravel(m) + Math.max(1, m.pause)) },
  build(m, ctx, out) {
    const p = vehiclePose(m, ctx.frame, ctx.r.phase);
    const q = vehiclePose(m, ctx.frame - 1, ctx.r.phase);
    const now = vehicleCols(m, p.x, ctx.off);
    const before = vehicleCols(m, q.x, ctx.prev);
    now.forEach((r, i) => {
      out.solids.push({
        ...r,
        id: solidId(ctx.r.pp.uid, ctx.mi, i),
        dx: r.x - before[i].x,
        dy: r.y - before[i].y,
        surface: DEFAULT_SURFACE,
        propUid: ctx.r.pp.uid,
        mi: ctx.mi,
      });
    });
    if (m.hurt === 'lead' && p.moving && Math.abs(p.v) > 0.05) {
      const lead = p.dir > 0 ? now[now.length - 1] : now[0];
      const d = 5;
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: p.dir > 0 ? lead.x + lead.w : lead.x - d, y: lead.y + 3, w: d, h: lead.h - 3 } });
    }
  },
});
