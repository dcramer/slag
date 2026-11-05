import { TILE } from '../../constants';
import { DEFAULT_SURFACE, type Surface } from '../../physics';
import { defineModule, solidId, type Xform } from '../registry';
import type { PlacedProp, TileBox } from '../types';

export const SURFACES: Record<string, Surface> = {
  stone: DEFAULT_SURFACE,
  metal: DEFAULT_SURFACE,
  wood: DEFAULT_SURFACE,
  crumble: DEFAULT_SURFACE,
  ice: { friction: 0.12, conveyor: 0, speedMult: 1.15, jumpMult: 1, bounce: 0 },
  goo: { friction: 1.4, conveyor: 0, speedMult: 0.5, jumpMult: 0.72, bounce: 0 },
  jelly: { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1.05, bounce: 0.82 },
};

/** A belt on face `face` (quarter turns clockwise from the top) running `speed` px/s clockwise round the block. */
export function conveyorSurface(speed: number, face = 0): Surface {
  return { ...DEFAULT_SURFACE, conveyor: speed, beltFace: face };
}

/**
 * Which face of a placed conveyor carries its belt: the top as generated, turned with the part. The belt
 * keeps running the same way round the block, so a rightward top becomes a downward right face.
 */
export function beltTurn(pp: Pick<PlacedProp, 'def' | 'rot'>): number {
  return pp.def.mount === 'hang' ? 0 : pp.rot & 3;
}

/** World px rects (x, y, w, h) of a body's sub-tile shape: each rect's corners go through U, so a half turn mirrors it. */
function shapeOf(shape: readonly TileBox[], x: Xform): TileBox[] {
  return shape.map(([sx, sy, sw, sh]) => {
    const [ax, ay] = x.U([sx, sy]);
    const [bx, by] = x.U([sx + sw, sy + sh]);
    return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)];
  });
}

/**
 * Solid cells of some material. Crumble bodies break after being stood on and respawn later. A body with a
 * `shape` collides as those rects instead of its cells (resolved to world px).
 */
defineModule<'body'>({
  type: 'body',
  resolve: (m, x) => (m.shape ? { ...m, cells: x.C(m.cells), shape: shapeOf(m.shape, x) } : { ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  rides: true,
  // Its cells move only with the prop. A block that crumbles away would leave its riders hanging.
  carrier: { at: (m) => (m.material === 'crumble' ? null : [0, 0]), drives: false, period: () => 0 },
  build(m, ctx, out) {
    if (m.material === 'crumble' && ctx.frame < ctx.state.brokenUntil) return;
    const surface = m.material === 'conveyor' ? conveyorSurface(m.conveyor, beltTurn(ctx.r.pp)) : SURFACES[m.material];
    const { off, prev } = ctx;
    const rects = m.shape ?? m.cells.map(([cx, cy]) => [cx * TILE, cy * TILE, TILE, TILE] as const);
    rects.forEach(([x, y, w, h], ci) => {
      out.solids.push({
        x: x + off[0],
        y: y + off[1],
        w,
        h,
        id: solidId(ctx.r.pp.uid, ctx.mi, ci),
        dx: off[0] - prev[0],
        dy: off[1] - prev[1],
        surface,
        propUid: ctx.r.pp.uid,
        mi: ctx.mi,
      });
    });
  },
  onStand(m, ctx) {
    if (m.material === 'crumble' && ctx.state.triggerFrame < 0 && ctx.frame >= ctx.state.brokenUntil) {
      ctx.state.triggerFrame = ctx.frame;
      ctx.emit({ type: 'crumble-start', uid: ctx.r.pp.uid });
    }
  },
  tick(m, ctx) {
    if (m.material !== 'crumble') return;
    const st = ctx.state;
    const f = ctx.frame;
    if (st.triggerFrame >= 0 && f - st.triggerFrame >= m.breakFrames) {
      st.triggerFrame = -1;
      st.brokenUntil = f + m.respawnFrames;
      ctx.emit({ type: 'crumble-break', uid: ctx.r.pp.uid });
    }
    // Don't respawn on top of someone.
    if (st.brokenUntil === f + 1) {
      const blocked = ctx.runners.some(
        (r) => r.active && m.cells.some(([cx, cy]) => r.x < (cx + 1) * TILE && r.x + r.w > cx * TILE && r.y < (cy + 1) * TILE && r.y + r.h > cy * TILE),
      );
      if (blocked) st.brokenUntil++;
    }
  },
});
