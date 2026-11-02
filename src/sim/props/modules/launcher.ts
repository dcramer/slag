import { RUN_COUNTDOWN } from '../../constants';
import { cellOf, defineModule, type RunnerView } from '../registry';
import { AMMO, type ModuleOf } from '../types';

type Launcher = ModuleOf<'launcher'>;
const TRACK_TURN = 0.045; // rad/frame
/** Trackers only notice runners within ±60° of the way they're mounted, so they read as "watching that side". */
export const TRACK_CONE = Math.PI / 3;

export function launcherAngle(m: Launcher, f: number, phase: number): number {
  return m.aim === 'sweep' ? m.angle + m.sweep * Math.sin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Launch angle (screen space) to hit offset (dx, dy) at `speed` under `gravity`; low arc, direct if unreachable. */
export function ballisticAngle(dx: number, dy: number, speed: number, gravity: number): number {
  if (gravity <= 0) return Math.atan2(dy, dx);
  const X = Math.abs(dx);
  const Y = -dy;
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * X * X + 2 * Y * v2);
  if (disc < 0 || X < 1) return Math.atan2(dy, dx);
  const th = Math.atan((v2 - Math.sqrt(disc)) / (gravity * X));
  return dx >= 0 ? -th : Math.PI + th;
}

/** Turn toward the nearest active runner within TRACK_CONE of the mount's facing. */
function trackAim(cur: number, x: number, y: number, m: Launcher, runners: readonly RunnerView[], gravityScale: number): number {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const r of runners) {
    if (!r.active) continue;
    const tx = r.x + r.w / 2;
    const ty = r.y + r.h / 2;
    const d = (tx - x) ** 2 + (ty - y) ** 2;
    if (Math.abs(angleDiff(Math.atan2(ty - y, tx - x), m.angle)) < TRACK_CONE && d < bestD) {
      bestD = d;
      best = [tx, ty];
    }
  }
  const target = best ? ballisticAngle(best[0] - x, best[1] - y, m.speed, AMMO[m.ammo].gravity * gravityScale) : m.angle;
  return cur + Math.max(-TRACK_TURN, Math.min(TRACK_TURN, angleDiff(target, cur)));
}

/** Crossbows, cannons, totems, turrets, star throwers. */
export const launcher = defineModule<'launcher'>({
  type: 'launcher',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  tick(m, ctx) {
    const f = ctx.frame;
    if (f < RUN_COUNTDOWN) return;
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    let angle = launcherAngle(m, f, ctx.r.phase);
    if (m.aim === 'track') {
      angle = trackAim(ctx.state.aim.get(ctx.mi) ?? m.angle, x, y, m, ctx.runners, ctx.level.gravity ?? 1);
      ctx.state.aim.set(ctx.mi, angle);
    }
    const k = (f - RUN_COUNTDOWN + Math.floor(ctx.r.phase * m.interval)) % m.interval;
    if (k < m.burst * 7 && k % 7 === 0) {
      for (let s = 0; s < m.spread; s++) {
        const a = angle + (s - (m.spread - 1) / 2) * m.spreadAngle;
        ctx.spawn({
          x: x + Math.cos(a) * 10,
          y: y + Math.sin(a) * 10,
          vx: Math.cos(a) * m.speed,
          vy: Math.sin(a) * m.speed,
          owner: ctx.r.pp.owner,
          ammo: m.ammo,
        });
      }
      ctx.state.lastFire = f;
      ctx.emit({ type: 'fire', x: x + Math.cos(angle) * 10, y: y + Math.sin(angle) * 10, angle, style: m.style });
    }
  },
});
