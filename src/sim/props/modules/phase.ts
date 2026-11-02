import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { defineModule, solidId } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf, PropState } from '../types';
import { SURFACES } from './body';

type Phase = ModuleOf<'phase'>;

/** Frames of flicker before vanishing / of outline fill before appearing (art and fairness). */
export const PHASE_WARN = 30;

/** Segment 0 = solid, 1 = gone. `t`/`len` drive the telegraphs. */
export const phaseCycle = (m: Phase, f: number, phase: number) => cycle(f + m.offset, phase, [m.on, m.off]);

const holdKey = (mi: number) => `${mi}:hold`;

/** Is cell `ci` solid at frame f? Cells due back while a runner is inside them wait until it's clear. */
export function phaseSolid(m: Phase, f: number, phase: number, st: PropState | undefined, mi: number, ci: number): boolean {
  if (phaseCycle(m, f, phase).seg !== 0) return false;
  const hold = st?.vars.get(holdKey(mi)) ?? 0;
  return (hold & (1 << ci)) === 0;
}

function cellRect(cx: number, cy: number, ox: number, oy: number): Rect {
  return { x: cx * TILE + ox, y: cy * TILE + oy, w: TILE, h: TILE };
}

/**
 * Blink blocks: solid on a fixed timer, flickering before they vanish and
 * filling in before they return. Pairs alternate (one set is solid while the
 * other is gone), so you hop across in rhythm. Never materializes inside a
 * runner: an occupied cell stays open until they leave it.
 */
export const phase = defineModule<'phase'>({
  type: 'phase',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const { off, prev } = ctx;
    m.cells.forEach(([cx, cy], ci) => {
      if (!phaseSolid(m, ctx.frame, ctx.r.phase, ctx.state, ctx.mi, ci)) return;
      out.solids.push({
        ...cellRect(cx, cy, off[0], off[1]),
        id: solidId(ctx.r.pp.uid, ctx.mi, ci),
        dx: off[0] - prev[0],
        dy: off[1] - prev[1],
        surface: SURFACES.stone,
        propUid: ctx.r.pp.uid,
        mi: ctx.mi,
      });
    });
  },
  tick(m, ctx) {
    const f = ctx.frame;
    const next = phaseCycle(m, f + 1, ctx.r.phase).seg === 0;
    let hold = ctx.state.vars.get(holdKey(ctx.mi)) ?? 0;
    if (!next) hold = 0;
    else {
      m.cells.forEach(([cx, cy], ci) => {
        const bit = 1 << ci;
        const solidNow = phaseSolid(m, f, ctx.r.phase, ctx.state, ctx.mi, ci);
        const r = cellRect(cx, cy, ctx.off[0], ctx.off[1]);
        const inside = ctx.runners.some((p) => p.active && p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y);
        if (!solidNow && inside) hold |= bit;
        else if (!inside) hold &= ~bit;
      });
    }
    ctx.state.vars.set(holdKey(ctx.mi), hold);
  },
});
