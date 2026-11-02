import type { Rect, Vec } from '../../../core/geom';
import { addTrigger, cellOf, defineModule, solidId } from '../registry';
import type { ModuleOf } from '../types';

type Portal = ModuleOf<'portal'>;

/** Pad trigger size (px): about a runner's size. */
export const PORTAL_W = 10;
export const PORTAL_H = 14;

/** Pad centers (px) including motion offset. */
export function portalPads(m: Portal, off: Vec): [Vec, Vec] {
  return [
    [m.a[0] + off[0], m.a[1] + off[1]],
    [m.b[0] + off[0], m.b[1] + off[1]],
  ];
}

/**
 * Paired teleporter. Entering either pad moves you by the pad-to-pad offset,
 * keeping your velocity, facing and position relative to the pad, so a
 * running jump into one pad comes out of the other mid-jump. The exit pad is
 * marked as already entered, so you don't bounce straight back; step off and
 * on again to return. If the exit is blocked, the pad does nothing.
 */
export const portal = defineModule<'portal'>({
  type: 'portal',
  resolve: (m, x) => ({ ...m, a: x.P(m.a), b: x.P(m.b) }),
  anchors: (m) => [cellOf(m.a), cellOf(m.b)],
  build(m, ctx, out) {
    const uid = ctx.r.pp.uid;
    portalPads(m, ctx.off).forEach((p, i) => {
      const r: Rect = { x: p[0] - PORTAL_W / 2, y: p[1] - PORTAL_H / 2, w: PORTAL_W, h: PORTAL_H };
      addTrigger(out, { r, uid, mi: ctx.mi, key: solidId(uid, ctx.mi, i) });
    });
  },
  touch(m, ctx, who, t, first) {
    if (!first || !ctx.live) return;
    const uid = ctx.r.pp.uid;
    const from = t.key === solidId(uid, ctx.mi, 0) ? 0 : 1;
    const pads = portalPads(m, ctx.off);
    const dx = pads[1 - from][0] - pads[from][0];
    const dy = pads[1 - from][1] - pads[from][1];
    const b = who.body;
    const dest: Rect = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
    if (ctx.blocked(dest)) return;
    b.x = dest.x;
    b.y = dest.y;
    b.onGround = false;
    b.groundRef = -1;
    ctx.mark(solidId(uid, ctx.mi, 1 - from));
    ctx.state.lastFire = ctx.frame;
    ctx.state.vars.set(`${ctx.mi}:from`, from);
    ctx.emit({ type: 'prop', kind: 'teleport', x: pads[from][0], y: pads[from][1], x2: pads[1 - from][0], y2: pads[1 - from][1] });
  },
});
