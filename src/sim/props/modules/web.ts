import { TILE } from '../../constants';
import { addTrigger, defineModule, solidId } from '../registry';

/** Inside a web you sink at most this fast (px/s) and can't rise faster than this. */
const WEB_FALL = 30;
const WEB_RISE = 230;
/** Slow status refreshed while inside (frames): you stay sluggish a moment after breaking free. */
const WEB_SLOW = 14;

/**
 * Sticky web: heavy drag while you're in it. Falls are caught (you sink
 * slowly), runs become a crawl, and you can hop upward through it a little
 * at a time: a net to climb, or a snare in front of something nasty.
 */
defineModule<'web'>({
  type: 'web',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    // One key for the whole web, so overlapping two cells only drags once.
    const key = solidId(ctx.r.pp.uid, ctx.mi, 0);
    for (const [cx, cy] of m.cells)
      addTrigger(out, { r: { x: cx * TILE + ctx.off[0] + 1, y: cy * TILE + ctx.off[1] + 1, w: TILE - 2, h: TILE - 2 }, uid: ctx.r.pp.uid, mi: ctx.mi, key });
  },
  touch(m, ctx, who, _t, first) {
    const b = who.body;
    b.vx *= 1 - m.drag;
    b.vy *= 1 - m.drag;
    if (b.vy > WEB_FALL) b.vy = WEB_FALL;
    if (b.vy < -WEB_RISE) b.vy = -WEB_RISE;
    // You can always push off the strands: a short hop counts as grounded.
    if (b.coyote < 2) b.coyote = 2;
    if (who.status.slowed < WEB_SLOW) who.status.slowed = WEB_SLOW;
    if (first) ctx.emit({ type: 'prop', kind: 'web', x: b.x + b.w / 2, y: b.y + b.h / 2 });
  },
});
