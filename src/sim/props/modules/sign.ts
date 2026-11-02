import type { Rect } from '../../../core/geom';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Sign = ModuleOf<'sign'>;

/** Segments of a falling sign's cycle. */
export const SIGN_HANG = 0;
export const SIGN_WARN = 1;
export const SIGN_FALL = 2;
export const SIGN_LIVE = 3;
export const SIGN_LIFT = 4;

/** Where the sign is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const signCycle = (m: Sign, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.fall, m.live, m.lift]);

/** How far it has come down (px, 0 hanging, `drop` on the floor) on frame `f`: accelerating as it falls, eased as it's winched up. */
export function signDrop(m: Sign, f: number, phase: number): number {
  const c = signCycle(m, f, phase);
  if (c.seg === SIGN_FALL) {
    const u = c.t / Math.max(1, c.len);
    return m.drop * u * u;
  }
  if (c.seg === SIGN_LIVE) return m.drop;
  if (c.seg === SIGN_LIFT) {
    const u = c.t / Math.max(1, c.len);
    return m.drop * (1 - u * u * (3 - 2 * u));
  }
  return 0;
}

/** The sign's box on frame `f` (px, with the prop's offset). */
export function signRect(m: Sign, f: number, phase: number, ox = 0, oy = 0): Rect {
  return { x: m.at[0] + ox, y: m.at[1] + oy + signDrop(m, f, phase), w: m.w, h: m.h };
}

/**
 * Rooftops-only, world-only hazard (docs/SETPIECES.md, Rooftops): a sign that comes down. It hangs over a
 * walkway doing nothing; a bracket gives (drawn, never felt), it drops onto the floor below, killing
 * whatever it lands on, and lies there sparking for a moment, its wiring live, before a winch hauls it
 * back up. Nothing about it is solid, so nobody rides it, and the floor under it is only dangerous while
 * it's falling and lying there, so a route under it is passable by timing (barrier.ts MIN_OPENING).
 */
export const sign = defineModule<'sign'>({
  type: 'sign',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, h: m.h * x.T, drop: m.drop * x.T }),
  // Where it lands: the floor's middle, under where it hangs.
  anchors: (m) => [cellOf([m.at[0] + m.w / 2, m.at[1] + m.drop + m.h - 0.5])],
  build(m, ctx, out) {
    const seg = signCycle(m, ctx.frame, ctx.r.phase).seg;
    if (seg !== SIGN_FALL && seg !== SIGN_LIVE) return;
    // A pixel in from each side, so a runner brushing past the edge it lands beside isn't caught by its outline.
    const r = signRect(m, ctx.frame, ctx.r.phase, ctx.off[0], ctx.off[1]);
    out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { x: r.x + 1, y: r.y, w: r.w - 2, h: r.h } });
  },
});
