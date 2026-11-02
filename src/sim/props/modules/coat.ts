import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { DEFAULT_SURFACE, type Surface } from '../../physics';
import { defineModule, solidId } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';

/** Coat thickness (px): thin enough to step onto, thick enough to be the surface you touch. */
export const COAT_PX = 3;

export const COAT_SURFACES: Record<'ice' | 'slime', Surface> = {
  ice: { ...DEFAULT_SURFACE, friction: 0.1, speedMult: 1.15, wall: 'slick' },
  slime: { ...DEFAULT_SURFACE, friction: 1.5, speedMult: 0.45, jumpMult: 0.7, wall: 'sticky' },
};

/** The strip just outside a host cell's face, `depth` px thick. */
export function faceRect(cx: number, cy: number, angle: number, depth: number, inset = 0): Rect {
  const [dx, dy] = dirOf(angle);
  const x = cx * TILE;
  const y = cy * TILE;
  if (dx > 0) return { x: x + TILE, y: y + inset, w: depth, h: TILE - inset * 2 };
  if (dx < 0) return { x: x - depth, y: y + inset, w: depth, h: TILE - inset * 2 };
  if (dy > 0) return { x: x + inset, y: y + TILE, w: TILE - inset * 2, h: depth };
  return { x: x + inset, y: y - depth, w: TILE - inset * 2, h: depth };
}

/** Spike strips and ice/slime coats mounted on faces of existing solids. */
export const coat = defineModule<'coat'>({
  type: 'coat',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  build(m: ModuleOf<'coat'>, ctx, out) {
    const uid = ctx.r.pp.uid;
    m.cells.forEach(([cx, cy], i) => {
      if (m.kind === 'spikes') {
        out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: faceRect(cx, cy, m.angle, 7, 2) });
      } else {
        const r = faceRect(cx, cy, m.angle, COAT_PX);
        out.solids.push({ ...r, id: solidId(uid, ctx.mi, i), dx: 0, dy: 0, surface: COAT_SURFACES[m.kind], propUid: uid, mi: ctx.mi });
      }
    });
  },
});
