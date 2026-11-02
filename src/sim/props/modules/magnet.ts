import { DT } from '../../constants';
import { addTrigger, cellOf, defineModule, solidId } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Magnet = ModuleOf<'magnet'>;

/** Speed caps (px/s) inside a field, so a strong well can't fling you across the map. */
export const MAGNET_VX = 300;
export const MAGNET_UP = 360;
/**
 * Seconds of field force a grounded runner feels per frame as direct drift
 * (px/s = force × this). Ground friction would otherwise eat the whole force,
 * and a well that can't drag you off a ledge isn't much of a well.
 */
export const MAGNET_GROUND_DRIFT = 0.12;

/** Segments: 0 off, 1 warn (charging), 2 on. Always-on fields (off 0) report seg 2. */
export function magnetCycle(m: Magnet, f: number, phase: number) {
  if (m.off <= 0) return { seg: 2, t: f, len: 1 };
  return cycle(f, phase, [m.off, m.warn, m.on]);
}

/**
 * Gravity well / repulsor. Inside the radius you're pulled toward (or pushed
 * away from) the core with a force that's strongest at the core and fades
 * to nothing at the edge. Pulling fields bend jumps and drag you sideways
 * off ledges; pushing fields hold you off an area or float you over gaps.
 */
export const magnet = defineModule<'magnet'>({
  type: 'magnet',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), radius: m.radius * x.T }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    if (magnetCycle(m, ctx.frame, ctx.r.phase).seg !== 2) return;
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    const r = m.radius;
    addTrigger(out, {
      r: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
      circle: { x, y, r },
      uid: ctx.r.pp.uid,
      mi: ctx.mi,
      key: solidId(ctx.r.pp.uid, ctx.mi, 0),
    });
  },
  touch(m, ctx, who) {
    if (!ctx.live) return;
    const b = who.body;
    const dx = m.at[0] + ctx.off[0] - (b.x + b.w / 2);
    const dy = m.at[1] + ctx.off[1] - (b.y + b.h / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 2 || d >= m.radius) return;
    const force = m.strength * (1 - d / m.radius) * m.polarity;
    if (b.onGround) {
      const shift = (dx / d) * force * MAGNET_GROUND_DRIFT * DT;
      if (!ctx.blocked({ x: b.x + shift, y: b.y, w: b.w, h: b.h })) b.x += shift;
      return;
    }
    const k = (force * DT) / d;
    b.vx += dx * k;
    b.vy += dy * k;
    if (b.vx > MAGNET_VX) b.vx = MAGNET_VX;
    if (b.vx < -MAGNET_VX) b.vx = -MAGNET_VX;
    if (b.vy < -MAGNET_UP) b.vy = -MAGNET_UP;
  },
});
