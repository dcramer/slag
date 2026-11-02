import { dcos, dsin } from '../../../core/dmath';
import { RUN_COUNTDOWN } from '../../constants';
import { cellOf, defineModule } from '../registry';
import type { ModuleOf } from '../types';

type Cannon = ModuleOf<'cannon'>;

/** Frames between shots inside a burst. */
export const CANNON_BURST_GAP = 12;

/**
 * Firing schedule: `k` counts frames since the start of the current
 * interval (shots at k = 0, gap, 2·gap… while k < burst·gap). `since` is
 * frames since the last shot (large before the first), `until` frames to
 * the next volley — the art uses it for the fuse telegraph.
 */
export function cannonTiming(m: Cannon, f: number, phase: number): { k: number; since: number; until: number; firing: boolean } {
  const o = Math.floor(phase * m.interval);
  const g = f - RUN_COUNTDOWN + o;
  const k = ((g % m.interval) + m.interval) % m.interval;
  const lastShot = Math.min(m.burst - 1, Math.floor(k / CANNON_BURST_GAP));
  const since = k - lastShot * CANNON_BURST_GAP;
  // Shots only happen once the countdown is over (g >= o).
  const fired = g - since >= o;
  return { k, since: fired ? since : 999, until: m.interval - k, firing: f >= RUN_COUNTDOWN && k < m.burst * CANNON_BURST_GAP && k % CANNON_BURST_GAP === 0 };
}

/** Muzzle point (px). */
export function cannonMuzzle(m: Cannon, ox = 0, oy = 0): [number, number] {
  return [m.at[0] + ox + dcos(m.angle) * m.length, m.at[1] + oy + dsin(m.angle) * m.length];
}

/** Big fixed guns (castle cannons, dart totems, magma spitters). Shots on a fixed rhythm leave safe windows. */
export const cannon = defineModule<'cannon'>({
  type: 'cannon',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, length: m.length * x.T }),
  anchors: (m) => [cellOf(m.at)],
  tick(m, ctx) {
    const t = cannonTiming(m, ctx.frame, ctx.r.phase);
    if (!t.firing) return;
    const [x, y] = cannonMuzzle(m, ctx.off[0], ctx.off[1]);
    ctx.spawn({ x, y, vx: dcos(m.angle) * m.speed, vy: dsin(m.angle) * m.speed, owner: ctx.r.pp.owner, ammo: m.ammo, source: ctx.r.pp.uid });
    ctx.state.lastFire = ctx.frame;
    ctx.emit({ type: 'fire', x, y, angle: m.angle, style: m.look === 'totem' ? 'totem' : 'cannon' });
  },
});
