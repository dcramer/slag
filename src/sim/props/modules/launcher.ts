import { datan, datan2, dcos, dhypot, dsin, sq } from '../../../core/dmath';
import { RUN_COUNTDOWN } from '../../constants';
import { castBeam, castRay } from '../rays';
import { cellOf, defineModule, type TickCtx } from '../registry';
import { AMMO, type ModuleOf } from '../types';

type Launcher = ModuleOf<'launcher'>;
const TRACK_TURN = 0.045; // rad/frame
/** Px of its own housing a tracker's eye sees past. */
export const SIGHT_SKIP = 8;
/** Trackers only notice runners within ±60° of the way they're mounted, so they read as "watching that side". */
export const TRACK_CONE = Math.PI / 3;

export function launcherAngle(m: Launcher, f: number, phase: number): number {
  return m.aim === 'sweep' ? m.angle + m.sweep * dsin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

/** Signed difference a - b, wrapped to [-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Launch angle (screen space) to hit offset (dx, dy) at `speed` under `gravity`; low arc, direct if unreachable. */
function ballisticAngle(dx: number, dy: number, speed: number, gravity: number): number {
  if (gravity <= 0) return datan2(dy, dx);
  const X = Math.abs(dx);
  const Y = -dy;
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * X * X + 2 * Y * v2);
  if (disc < 0 || X < 1) return datan2(dy, dx);
  const th = datan((v2 - Math.sqrt(disc)) / (gravity * X));
  return dx >= 0 ? -th : Math.PI + th;
}

/** Can the eye at (x, y) see this point? Terrain and solids hide a runner; other runners don't. */
export function inSight(ctx: TickCtx, x: number, y: number, tx: number, ty: number): boolean {
  const d = dhypot(tx - x, ty - y);
  return d <= SIGHT_SKIP || castRay(ctx.level, ctx.solids ?? [], x, y, (tx - x) / d, (ty - y) / d, d, SIGHT_SKIP, ctx.r.pp.uid) >= d;
}

/** Turn toward the nearest active runner it can see within TRACK_CONE of the mount's facing. */
function trackAim(cur: number, x: number, y: number, m: Launcher, ctx: TickCtx): number {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const r of ctx.runners) {
    if (!r.active) continue;
    const tx = r.x + r.w / 2;
    const ty = r.y + r.h / 2;
    const d = sq(tx - x) + sq(ty - y);
    if (d < bestD && Math.abs(angleDiff(datan2(ty - y, tx - x), m.angle)) < TRACK_CONE && inSight(ctx, x, y, tx, ty)) {
      bestD = d;
      best = [tx, ty];
    }
  }
  const target = best ? ballisticAngle(best[0] - x, best[1] - y, m.speed, AMMO[m.ammo].gravity * (ctx.level.gravity ?? 1)) : m.angle;
  return cur + Math.max(-TRACK_TURN, Math.min(TRACK_TURN, angleDiff(target, cur)));
}

/**
 * Crossbows, cannons, totems, turrets, star throwers. A launcher stands upright on its block, so a half turn
 * mirrors it (Xform.U): it faces the other way on the same footing, and a lobber still lobs.
 */
export const launcher = defineModule<'launcher'>({
  type: 'launcher',
  resolve: (m, x) => ({ ...m, at: x.U(m.at), angle: x.UA(m.angle) }),
  anchors: (m) => [cellOf(m.at)],
  trace(m, ctx, out) {
    if (m.aim !== 'track') return;
    const a = ctx.state.aim.get(ctx.mi) ?? m.angle;
    castBeam(ctx, out, m.at[0] + ctx.off[0], m.at[1] + ctx.off[1], dcos(a), dsin(a), 600, SIGHT_SKIP, a);
  },
  tick(m, ctx) {
    const f = ctx.frame;
    if (f < RUN_COUNTDOWN) return;
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    let angle = launcherAngle(m, f, ctx.r.phase);
    if (m.aim === 'track') {
      angle = trackAim(ctx.state.aim.get(ctx.mi) ?? m.angle, x, y, m, ctx);
      ctx.state.aim.set(ctx.mi, angle);
    }
    const k = (f - RUN_COUNTDOWN + Math.floor(ctx.r.phase * m.interval)) % m.interval;
    if (k < m.burst * 7 && k % 7 === 0) {
      for (let s = 0; s < m.spread; s++) {
        const a = angle + (s - (m.spread - 1) / 2) * m.spreadAngle;
        ctx.spawn({
          x: x + dcos(a) * 10,
          y: y + dsin(a) * 10,
          vx: dcos(a) * m.speed,
          vy: dsin(a) * m.speed,
          owner: ctx.r.pp.owner,
          ammo: m.ammo,
          source: ctx.r.pp.uid,
        });
      }
      ctx.state.lastFire = f;
      ctx.emit({ type: 'fire', x: x + dcos(angle) * 10, y: y + dsin(angle) * 10, angle, style: m.style });
    }
  },
});
