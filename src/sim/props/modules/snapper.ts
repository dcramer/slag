import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { defineModule } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { faceRect } from './coat';

type Snapper = ModuleOf<'snapper'>;

/** Snapper segments. */
export const SNAP_IDLE = 0;
export const SNAP_ARM = 1;
export const SNAP_UP = 2;
export const SNAP_COOL = 3;

/** How far in front of its face (px) a snapper notices you. */
export const SNAP_SENSE = TILE * 1.25;
/** Height (px) of the popped spikes' lethal strip. */
export const SNAP_SPIKE = 9;

const t0Key = (mi: number) => `${mi}:t0`;

/** Where the plate is in its click → spikes → cooldown sequence. `u` is 0..1 through the segment. */
export function snapperPhase(m: Snapper, st: PropState | undefined, mi: number, f: number): { seg: number; u: number } {
  const t0 = st?.vars.get(t0Key(mi)) ?? -1;
  if (t0 < 0) return { seg: SNAP_IDLE, u: 0 };
  const s = f - t0;
  if (s < m.warn) return { seg: SNAP_ARM, u: s / m.warn };
  if (s < m.warn + m.up) return { seg: SNAP_UP, u: (s - m.warn) / m.up };
  if (s < m.warn + m.up + m.cool) return { seg: SNAP_COOL, u: (s - m.warn - m.up) / m.cool };
  return { seg: SNAP_IDLE, u: 0 };
}

/** The box around the zones in front of the plate: where it sounds from when one is tripped. */
export function snapperSense(m: Snapper): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [cx, cy] of m.cells) {
    const r = faceRect(cx, cy, m.angle, SNAP_SENSE);
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Pop-up spike plate, mounted flush on a face like a spike strip. Harmless
 * until someone steps in front of it: it clicks and its tips peek out
 * (telegraph), then the spikes shoot up for a moment and retract, and it
 * needs a cooldown before it can fire again. Keep moving and you're fine;
 * hesitate on it, or get pushed back onto it, and you're not.
 */
export const snapper = defineModule<'snapper'>({
  type: 'snapper',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    if (snapperPhase(m, ctx.state, ctx.mi, ctx.frame).seg !== SNAP_UP) return;
    for (const [cx, cy] of m.cells) out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: faceRect(cx, cy, m.angle, SNAP_SPIKE, 1) });
  },
  tick(m, ctx) {
    if (!ctx.live || snapperPhase(m, ctx.state, ctx.mi, ctx.frame + 1).seg !== SNAP_IDLE) return;
    // Cell by cell: a plate split by trimming has no sensor over the gap.
    const zones = m.cells.map(([cx, cy]) => faceRect(cx, cy, m.angle, SNAP_SENSE));
    if (ctx.runners.some((r) => r.active && zones.some((z) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y))) {
      const z = snapperSense(m);
      ctx.state.vars.set(t0Key(ctx.mi), ctx.frame + 1);
      ctx.emit({ type: 'prop', kind: 'snap-arm', x: z.x + z.w / 2, y: z.y + z.h / 2 });
    }
  },
});
