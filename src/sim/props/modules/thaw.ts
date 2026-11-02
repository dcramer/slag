import { TILE } from '../../constants';
import { ICE_SURFACE } from '../../ground';
import { defineModule, solidId } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf, PropState } from '../types';

type Thaw = ModuleOf<'thaw'>;

/** Segments of thin ice's cycle. */
export const THAW_FROZEN = 0;
export const THAW_WARN = 1;
export const THAW_OPEN = 2;

/** Px under the ice's top where the open water starts: the waterline sits a little below the brim. */
export const WATERLINE = 4;

/** Where the ice is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it but the hold. */
export const thawCycle = (m: Thaw, f: number, phase: number) => cycle(f, phase, [m.frozen, m.warn, m.open]);

const holdKey = (mi: number) => `${mi}:thaw`;

/** Is cell `ci` ice at frame f? Ice due back over a runner waits until it's clear, as blink blocks do. */
export function thawSolid(m: Thaw, f: number, phase: number, st: PropState | undefined, mi: number, ci: number): boolean {
  if (thawCycle(m, f, phase).seg === THAW_OPEN) return false;
  return ((st?.vars.get(holdKey(mi)) ?? 0) & (1 << ci)) === 0;
}

/** The open water under the ice (px, before the prop's offset): from the waterline down `depth` rows. */
export function thawWater(m: Thaw): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y = Infinity;
  for (const [cx, cy] of m.cells) {
    x0 = Math.min(x0, cx);
    x1 = Math.max(x1, cx + 1);
    y = Math.min(y, cy);
  }
  return { x: x0 * TILE, y: y * TILE + WATERLINE, w: (x1 - x0) * TILE, h: m.depth * TILE - WATERLINE };
}

/**
 * Glacier-only, world-only hazard (docs/SETPIECES.md, Glacier): thin ice over open water, the floor itself
 * on a cycle. Frozen, it's ice flush with the floor either side: slick, and it carries you. Then it cracks,
 * and the cracks are drawn and heard, never felt: it still holds. Then it's gone, and the water under it
 * takes whoever's in it (a `sink`, a fall: you went through the ice). Then it skins over again, never over
 * a runner. The plan never stands on it: the ice is a timed solid and the water a timed hazard, so the
 * proof hops the hole, and an ice sheet parked over a crossing is a free ride `noFreeRide` refuses.
 */
export const thaw = defineModule<'thaw'>({
  type: 'thaw',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const { off, prev } = ctx;
    if (thawCycle(m, ctx.frame, ctx.r.phase).seg === THAW_OPEN) {
      const w = thawWater(m);
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: w.x + off[0], y: w.y + off[1], w: w.w, h: w.h }, sink: true });
    }
    m.cells.forEach(([cx, cy], ci) => {
      if (!thawSolid(m, ctx.frame, ctx.r.phase, ctx.state, ctx.mi, ci)) return;
      out.solids.push({
        x: cx * TILE + off[0],
        y: cy * TILE + off[1],
        w: TILE,
        h: TILE,
        id: solidId(ctx.r.pp.uid, ctx.mi, ci),
        dx: off[0] - prev[0],
        dy: off[1] - prev[1],
        surface: ICE_SURFACE,
        propUid: ctx.r.pp.uid,
        mi: ctx.mi,
      });
    });
  },
  tick(m, ctx) {
    const f = ctx.frame;
    const next = thawCycle(m, f + 1, ctx.r.phase).seg !== THAW_OPEN;
    let hold = ctx.state.vars.get(holdKey(ctx.mi)) ?? 0;
    if (!next) hold = 0;
    else
      m.cells.forEach(([cx, cy], ci) => {
        const bit = 1 << ci;
        const x = cx * TILE + ctx.off[0];
        const y = cy * TILE + ctx.off[1];
        const inside = ctx.runners.some((p) => p.active && p.x < x + TILE && p.x + p.w > x && p.y < y + TILE && p.y + p.h > y);
        if (!thawSolid(m, f, ctx.r.phase, ctx.state, ctx.mi, ci) && inside) hold |= bit;
        else if (!inside) hold &= ~bit;
      });
    ctx.state.vars.set(holdKey(ctx.mi), hold);
  },
});
