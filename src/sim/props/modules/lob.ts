import type { Vec } from '../../../core/geom';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Lob = ModuleOf<'lob'>;

/** Segments of a lob's cycle. */
export const LOB_OFF = 0;
export const LOB_WARN = 1;
export const LOB_FLIGHT = 2;

/** Frames from the head leaving to the last segment landing. */
export const lobFlight = (m: Lob) => m.flight + Math.max(0, m.count - 1) * m.lag;

/** Where the lob is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const lobCycle = (m: Lob, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, lobFlight(m)]);

/** The point `u` (0..1) of the way along the arc: the straight line between the ends, lifted by `apex` at its middle. */
export function lobPoint(m: Lob, u: number, ox = 0, oy = 0): Vec {
  const x = m.from[0] + (m.to[0] - m.from[0]) * u;
  const y = m.from[1] + (m.to[1] - m.from[1]) * u - 4 * m.apex * u * (1 - u);
  return [x + ox, y + oy];
}

/** A segment's radius (px once resolved): the head full size, the tail tapering. The art draws this very circle. */
export const lobRadius = (m: Lob, i: number) => m.radius * (i === 0 ? 1 : 0.86 - (0.36 * i) / Math.max(1, m.count));

/** One segment in the air: where it is along the arc (0..1) and its index, 0 the head. */
export interface LobSeg {
  i: number;
  u: number;
}

/** The segments in the air on frame `f`, head first. Empty off the flight. */
export function lobSegs(m: Lob, f: number, phase: number): LobSeg[] {
  const c = lobCycle(m, f, phase);
  if (c.seg !== LOB_FLIGHT) return [];
  const out: LobSeg[] = [];
  for (let i = 0; i < m.count; i++) {
    const u = (c.t - i * m.lag) / m.flight;
    if (u >= 0 && u <= 1) out.push({ i, u });
  }
  return out;
}

/**
 * Volcano-only, world-only hazard (docs/SETPIECES.md, Volcano): something molten thrown along one fixed
 * arc on a cycle. A magma serpent leaps out of the lava and dives back, its linked segments following the
 * head along the same arc; a volcanic bomb falls out of the sky onto one spot. Nothing about it is solid,
 * so nobody rides it. It warns first, the warning drawn and never felt (the lava boils at the leap, a
 * shadow grows on the spot it lands), then each segment kills where it is. It's in the air only for its
 * flight, so a route under it is passable by timing (barrier.ts MIN_OPENING).
 */
defineModule<'lob'>({
  type: 'lob',
  resolve: (m, x) => ({ ...m, from: x.P(m.from), to: x.P(m.to), apex: m.apex * x.T, radius: m.radius * x.T }),
  // Where it lands: the spot its shadow falls on.
  anchors: (m) => [cellOf(m.to)],
  build(m, ctx, out) {
    const owner = ctx.r.pp.owner;
    for (const s of lobSegs(m, ctx.frame, ctx.r.phase)) {
      const [x, y] = lobPoint(m, s.u, ctx.off[0], ctx.off[1]);
      out.hazards.push({ owner, kind: 'circle', x, y, r: lobRadius(m, s.i) });
    }
  },
});
