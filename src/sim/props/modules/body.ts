import { TILE } from '../../constants';
import { DEFAULT_SURFACE, type Surface } from '../../physics';
import { defineModule, solidId } from '../registry';

export const SURFACES: Record<string, Surface> = {
  stone: DEFAULT_SURFACE,
  metal: DEFAULT_SURFACE,
  wood: DEFAULT_SURFACE,
  crumble: DEFAULT_SURFACE,
  ice: { friction: 0.12, conveyor: 0, speedMult: 1.15, jumpMult: 1, bounce: 0 },
  goo: { friction: 1.4, conveyor: 0, speedMult: 0.5, jumpMult: 0.72, bounce: 0 },
  jelly: { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1.05, bounce: 0.82 },
};

export function conveyorSurface(speed: number): Surface {
  return { ...DEFAULT_SURFACE, conveyor: speed };
}

/** Solid cells of some material. Crumble bodies break after being stood on and respawn later. */
export const body = defineModule<'body'>({
  type: 'body',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    if (m.material === 'crumble' && ctx.frame < ctx.state.brokenUntil) return;
    const surface = m.material === 'conveyor' ? conveyorSurface(ctx.r.pp.rot >= 2 ? -m.conveyor : m.conveyor) : SURFACES[m.material];
    const { off, prev } = ctx;
    m.cells.forEach(([cx, cy], ci) => {
      out.solids.push({
        x: cx * TILE + off[0],
        y: cy * TILE + off[1],
        w: TILE,
        h: TILE,
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
