import type { Cell } from '../../../core/geom';
import { TILE } from '../../constants';
import { defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Neon = ModuleOf<'neon'>;

/** Segments of one letter's cycle. */
export const NEON_OFF = 0;
export const NEON_WARN = 1;
export const NEON_ON = 2;

/** Frames cell `c` runs behind the word's first column: the light chases along it. */
export function neonLag(m: Neon, c: Cell): number {
  let x0 = Infinity;
  for (const [x] of m.cells) x0 = Math.min(x0, x);
  return (c[0] - x0) * m.lag;
}

/** Where cell `c` is in its cycle on frame `f`: a pure function of the frame. */
export const neonCycle = (m: Neon, c: Cell, f: number, phase: number) => cycle(f - neonLag(m, c), phase, [m.off, m.warn, m.on]);

/**
 * Rooftops-only, world-only hazard (docs/SETPIECES.md, Rooftops): neon letters you can stand on, live
 * while they're lit. The tubes flicker before each one lights, and the light runs along the word one
 * column at a time, so crossing them is a matter of keeping to the dark ones. A lit letter kills whatever
 * stands on it or brushes it; the letter itself is the `body` beside this module, solid all the time.
 */
export const neon = defineModule<'neon'>({
  type: 'neon',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells,
  build(m, ctx, out) {
    const [ox, oy] = ctx.off;
    for (const c of m.cells) {
      if (neonCycle(m, c, ctx.frame, ctx.r.phase).seg !== NEON_ON) continue;
      // The tube runs round the letter's face: whatever touches it, standing on it or walking into it.
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: c[0] * TILE + ox - 1, y: c[1] * TILE + oy - 3, w: TILE + 2, h: TILE + 3 } });
    }
  },
});
