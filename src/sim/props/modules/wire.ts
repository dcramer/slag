import type { Vec } from '../../../core/geom';
import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Wire = ModuleOf<'wire'>;

export const WIRE_WARN = 1;
export const WIRE_RUN = 2;

/** The spark's radius as a share of a tile: what the art draws as its hot core. */
export const SPARK_R = 0.36;

/** Where the wire is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const wireCycle = (m: Wire, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.run]);

/** The point `u` (0 at `a`, 1 at `b`) along the cable, sagging `sag` at its middle: the curve both the spark and the art follow. */
export function wirePoint(m: Wire, u: number, ox = 0, oy = 0): Vec {
  return [m.a[0] + (m.b[0] - m.a[0]) * u + ox, m.a[1] + (m.b[1] - m.a[1]) * u + m.sag * 4 * u * (1 - u) + oy];
}

/** Where the spark is on frame `f` (px, with the prop's offset), or null while it isn't running. */
export function sparkAt(m: Wire, f: number, phase: number, ox = 0, oy = 0): Vec | null {
  const c = wireCycle(m, f, phase);
  if (c.seg !== WIRE_RUN) return null;
  return wirePoint(m, c.t / Math.max(1, c.len - 1), ox, oy);
}

/**
 * Rooftops-only, world-only hazard (docs/SETPIECES.md, Rooftops): a live cable with a spark running along
 * it. The insulator at its start crackles first (drawn, never felt), then the spark races from one end to
 * the other and kills whatever it touches on the way; the cable itself is harmless. Every point along it
 * is dangerous only for the moment the spark passes, so it's crossed by timing (barrier.ts MIN_OPENING).
 */
defineModule<'wire'>({
  type: 'wire',
  resolve: (m, x) => ({ ...m, a: x.P(m.a), b: x.P(m.b), sag: m.sag * x.T }),
  anchors: (m) => [cellOf(m.a), cellOf(m.b)],
  build(m, ctx, out) {
    const p = sparkAt(m, ctx.frame, ctx.r.phase, ctx.off[0], ctx.off[1]);
    if (p) out.hazards.push({ owner: ctx.r.pp.owner, kind: 'circle', x: p[0], y: p[1], r: SPARK_R * TILE });
  },
});
