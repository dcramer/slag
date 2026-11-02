import type { Rect } from '../../../core/geom';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Cart = ModuleOf<'cart'>;

/** Segments of a runaway's cycle. */
export const CART_PARKED = 0;
export const CART_WARN = 1;
export const CART_RUN = 2;
export const CART_BACK = 3;

/** Where the runaway is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const cartCycle = (m: Cart, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.run, m.back]);

/** Smooth 0..1 for the winch: it takes up the slack, hauls, and eases the cart home. */
const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * How far down its run the cart is on frame `f` (0 parked at the top, `span` against the buffer). It breaks
 * loose from a standstill and gathers speed all the way down; the winch hauls it back steadily.
 */
export function cartDist(m: Cart, f: number, phase: number): number {
  const c = cartCycle(m, f, phase);
  if (c.seg === CART_RUN) {
    const u = c.t / Math.max(1, c.len);
    return m.span * u * u;
  }
  if (c.seg === CART_BACK) return m.span * (1 - smooth(c.t / Math.max(1, c.len)));
  return 0;
}

/** The cart's box (px) at distance `d` down its run, with the prop's offset. */
export function cartRect(m: Cart, d: number, ox = 0, oy = 0): Rect {
  const x0 = m.dir > 0 ? m.at[0] + d : m.at[0] - d;
  return { x: x0 + ox, y: m.at[1] - m.h + oy, w: m.w, h: m.h };
}

/**
 * Mine-only, world-only hazard (docs/SETPIECES.md, Mine): a runaway minecart. Unlike a vehicle on patrol it
 * makes one trip, downhill and out of control: parked at the top of its rail, it rocks and rings its bell
 * (drawn, never felt), breaks loose and gathers speed the whole way to the buffer, killing whatever it
 * hits; then a winch hauls it back up, slowly and harmlessly. It's never solid, so nobody rides it, and the
 * run is a fraction of its cycle, so the rail is passable by timing (barrier.ts MIN_OPENING).
 */
export const cart = defineModule<'cart'>({
  type: 'cart',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, h: m.h * x.T, span: m.span * x.T }),
  // Where it's parked.
  anchors: (m) => [cellOf([m.at[0] + 0.5, m.at[1] - 0.5])],
  build(m, ctx, out) {
    if (cartCycle(m, ctx.frame, ctx.r.phase).seg !== CART_RUN) return;
    const r = cartRect(m, cartDist(m, ctx.frame, ctx.r.phase), ctx.off[0], ctx.off[1]);
    // The body and its wheels; a sliver short of the drawn edge all round.
    out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 1 } });
  },
});
