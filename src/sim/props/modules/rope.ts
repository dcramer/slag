import { type Cell, clamp } from '../../../core/geom';
import { DT } from '../../constants';
import { boxAt, worldGravity } from '../attach';
import { addTrigger, cellOf, defineModule, solidId, type TouchCtx } from '../registry';

export const ROPE = {
  /** Half-width of the grab zone around the hanging rope (px). */
  reach: 4,
  /** Shortest pendulum (px): grabbing right by the hook still swings. */
  minLen: 20,
  /** Share of world gravity that drives the swing: slower than a fall, so you can time the release. */
  gravity: 0.7,
  /** Left/right push along the swing (px/s²). */
  pump: 560,
  /** Share of swing speed lost per second. */
  drag: 0.35,
  /** Top swing speed, as the share of the rope's height it could climb: the arc stops short of level. */
  top: 0.88,
  /** Lowest the rider can be below the hook, as a share of the grip distance. */
  ceil: 0.1,
  /** Speed kept when the swing hits something. */
  bounce: 0.3,
  /** Upward kick on letting go (px/s), so a release at the bottom of the arc still clears the floor. */
  hop: 90,
  /** Frames after a grab before jump lets go, so mashing into the rope doesn't drop you straight off. */
  grace: 6,
  /** Frames before snapping that the links start to strain. */
  creak: 80,
} as const;

/** Strain from 0 (fine) to 1 (about to snap) after `t` frames held. */
export const ropeStrain = (strain: number, t: number): number => clamp((t - (strain - ROPE.creak)) / ROPE.creak, 0, 1);

/** Is there something solid right above this hook? */
const hooked = (ctx: TouchCtx, x: number, y: number): boolean => ctx.blocked({ x: x - 1, y: y - 2, w: 2, h: 2 });

/**
 * A swing on a butcher's hook, from a ceiling or, under open sky, on a string
 * from above. You grab it in the air wherever you touch it (your distance from
 * the hook is the pendulum's length) and your velocity becomes swing speed, so
 * a running jump swings at once.
 *
 * The pendulum is a point on a circle, stepped along its tangent and pulled
 * back to the radius. That needs only sqrt, so it stays bit-identical across
 * browsers without any trig. Letting go leaves on that tangent. Hanging on too
 * long snaps it, which also stops anyone from hogging a rope.
 */
export const rope = defineModule<'rope'>({
  type: 'rope',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), length: m.length * x.T }),
  anchors(m) {
    const [x, y] = cellOf(m.at);
    return Array.from({ length: m.length }, (_, i): Cell => [x, y + i]);
  },
  build(m, ctx, out) {
    if (ctx.frame < ctx.state.brokenUntil) return;
    const r = ROPE.reach;
    addTrigger(out, {
      r: { x: m.at[0] + ctx.off[0] - r, y: m.at[1] + ctx.off[1], w: r * 2, h: m.length },
      uid: ctx.r.pp.uid,
      mi: ctx.mi,
      key: solidId(ctx.r.pp.uid, ctx.mi, 0),
    });
  },
  touch(m, ctx, who) {
    const b = who.body;
    const ax = m.at[0] + ctx.off[0];
    const ay = m.at[1] + ctx.off[1];
    if (!ctx.live || b.onGround) return;
    const x = b.x + b.w / 2 - ax;
    const y = b.y + b.h / 2 - ay;
    const d = Math.sqrt(x * x + y * y);
    const len = clamp(d, ROPE.minLen, m.length + b.h / 2);
    const k = len / Math.max(d, 1);
    const px = x * k;
    const py = y * k;
    ctx.grab({ x: px, y: py, len, s: (b.vx * py - b.vy * px) / len, hooked: hooked(ctx, ax, ay), kind: 'rope-grab' });
  },
  hold(m, ctx, who, g, inp) {
    const b = who.body;
    const ax = m.at[0] + ctx.off[0];
    const ay = m.at[1] + ctx.off[1];
    if (g.hooked && !hooked(ctx, ax, ay)) return false;
    if (g.t >= m.strain) {
      ctx.state.brokenUntil = ctx.frame + m.regrow;
      ctx.emit({ type: 'prop', kind: 'rope-snap', x: ax + g.x, y: ay + g.y });
      return false;
    }
    const L = g.len;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) b.facing = dir > 0 ? 1 : -1;
    const G = worldGravity(ctx.level) * ROPE.gravity;
    const top = Math.sqrt(2 * G * L * ROPE.top);
    const push = dir * ROPE.pump * (g.y / L) - (G * g.x) / L;
    const s = clamp((g.s + push * DT) * (1 - ROPE.drag * DT), -top, top);
    let nx = g.x + (g.y / L) * s * DT;
    let ny = g.y - (g.x / L) * s * DT;
    const n = L / Math.sqrt(nx * nx + ny * ny);
    nx *= n;
    ny *= n;
    const box = boxAt(b, ax + nx, ay + ny);
    if (ny < L * ROPE.ceil || ctx.blocked(box)) g.s = -s * ROPE.bounce;
    else {
      g.x = nx;
      g.y = ny;
      g.s = s;
      b.x = box.x;
      b.y = box.y;
    }
    b.vx = (g.y / L) * g.s;
    b.vy = -(g.x / L) * g.s;
    if (!inp.jumpPressed || g.t < ROPE.grace) return true;
    b.vy -= ROPE.hop;
    ctx.emit({ type: 'prop', kind: 'rope-off', x: ax + g.x, y: ay + g.y });
    return false;
  },
});
