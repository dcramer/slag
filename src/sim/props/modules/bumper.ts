import { addTrigger, cellOf, defineModule, solidId } from '../registry';

/** Frames the bumper stays lit after a kick (art). */
export const BUMPER_FLASH = 12;
/** Minimum upward speed (px/s) after a kick, so side hits on the ground still hop you clear. */
export const BUMPER_LIFT = 140;

/**
 * Pinball bumper: touching it sets your velocity straight away from its
 * center at `power` px/s (with a little lift so ground hits don't skid).
 * The angle you hit it at is the angle you leave at, which makes it a tool
 * for both shortcuts and shoves into danger.
 */
export const bumper = defineModule<'bumper'>({
  type: 'bumper',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), radius: m.radius * x.T }),
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
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
    const b = who.body;
    const cx = m.at[0] + ctx.off[0];
    const cy = m.at[1] + ctx.off[1];
    let nx = b.x + b.w / 2 - cx;
    let ny = b.y + b.h / 2 - cy;
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d < 1e-3) {
      nx = 0;
      ny = -1;
    } else {
      nx /= d;
      ny /= d;
    }
    // Already flying away? Leave them be (no double kicks while still overlapping).
    if (b.vx * nx + b.vy * ny > m.power * 0.6) return;
    b.vx = nx * m.power;
    b.vy = Math.min(ny * m.power, -BUMPER_LIFT);
    b.onGround = false;
    b.groundRef = -1;
    b.jumping = false;
    b.coyote = 0;
    ctx.state.lastFire = ctx.frame;
    ctx.emit({ type: 'prop', kind: 'bump', x: cx + nx * m.radius, y: cy + ny * m.radius });
  },
});
