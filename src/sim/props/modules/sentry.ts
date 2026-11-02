import { datan2, dcos, dsin, sq } from '../../../core/dmath';
import { RUN_COUNTDOWN, TILE } from '../../constants';
import { castBeam } from '../rays';
import { cellOf, defineModule, type TickCtx } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { angleDiff, inSight, SIGHT_SKIP } from './launcher';

type Sentry = ModuleOf<'sentry'>;

/**
 * The sentry gun (docs/PARODY.md, sentry). Unlike a launcher, which fires on a clock, it is a small state
 * machine driven by who it can see: waiting (sweeping its cone), locked (beeped, turning after its target,
 * spinning up, then firing one burst), and cooling down. Every gap a runner can use comes from that cycle:
 * a lock never fires before `spin`, the head never turns faster than `turn`, so a runner close in can
 * outrun it, and after each burst it holds fire for `cool` frames.
 *
 * Its state is plain numbers in the prop's PropState (`aim` for the head, `vars` for the mode and when
 * it began), so a snapshot carries it with nothing new.
 */

export type SentryMode = 'wait' | 'lock' | 'cool';
const MODES: readonly SentryMode[] = ['wait', 'lock', 'cool'];

/** Px out along the barrel where a round leaves it. */
export const SENTRY_MUZZLE = 10;

const modeKey = (mi: number) => `${mi}:mode`;
const sinceKey = (mi: number) => `${mi}:since`;

/** What a sentry is doing and the frame it started; art reads this to light the sensor and draw the sight. */
export function sentryMode(st: PropState, mi: number): { mode: SentryMode; since: number } {
  return { mode: MODES[st.vars.get(modeKey(mi)) ?? 0], since: st.vars.get(sinceKey(mi)) ?? 0 };
}

function setMode(st: PropState, mi: number, mode: SentryMode, f: number) {
  st.vars.set(modeKey(mi), MODES.indexOf(mode));
  st.vars.set(sinceKey(mi), f);
}

/** Where the head is pointing (the mount's facing until the race has turned it). */
export const sentryAim = (st: PropState | undefined, mi: number, m: Sentry): number => st?.aim.get(mi) ?? m.angle;

/** Where an idle head is heading on frame `f`: a slow sweep across its cone. */
export function sentrySweep(m: Sentry, f: number, phase: number): number {
  return m.angle + m.cone * dsin(Math.PI * 2 * (f / m.sweepPeriod + phase));
}

/** Frames between the start of a lock and the burst's last round, after which it cools down. */
export const sentryFiring = (m: Sentry) => m.spin + (m.burst - 1) * m.gap;

/** Angle to the nearest active runner within range, inside the mount's cone and in sight, or null. */
function spot(m: Sentry, ctx: TickCtx, x: number, y: number): number | null {
  const reach = sq(m.range * TILE);
  let best: number | null = null;
  let bestD = Infinity;
  for (const r of ctx.runners) {
    if (!r.active) continue;
    const tx = r.x + r.w / 2;
    const ty = r.y + r.h / 2;
    const d = sq(tx - x) + sq(ty - y);
    if (d > reach || d >= bestD) continue;
    const a = datan2(ty - y, tx - x);
    if (Math.abs(angleDiff(a, m.angle)) > m.cone || !inSight(ctx, x, y, tx, ty)) continue;
    bestD = d;
    best = a;
  }
  return best;
}

export const sentry = defineModule<'sentry'>({
  type: 'sentry',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => [cellOf(m.at)],
  trace(m, ctx, out) {
    // The sight line along the barrel, out to its range: the art's laser sight stops where this stops.
    const a = sentryAim(ctx.state, ctx.mi, m);
    castBeam(ctx, out, m.at[0] + ctx.off[0], m.at[1] + ctx.off[1], dcos(a), dsin(a), m.range * TILE, SIGHT_SKIP, a);
  },
  tick(m, ctx) {
    const f = ctx.frame;
    if (f < RUN_COUNTDOWN) return;
    const st = ctx.state;
    const mi = ctx.mi;
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    const seen = spot(m, ctx, x, y);
    let { mode, since } = sentryMode(st, mi);
    if (mode === 'cool' && f - since >= m.cool) {
      mode = 'wait';
      setMode(st, mi, mode, f);
    }
    if (mode === 'wait' && seen !== null) {
      mode = 'lock';
      since = f;
      setMode(st, mi, mode, f);
      ctx.emit({ type: 'prop', kind: 'sentry-lock', x, y });
    } else if (mode === 'lock' && seen === null && f - since < m.spin) {
      // Lost them while spinning up: back to sweeping, and the next lock spins up from scratch.
      mode = 'wait';
      setMode(st, mi, mode, f);
    }

    // The head turns at its turn rate, whatever it wants: a target, its last bearing mid-burst, or the sweep.
    const cur = sentryAim(st, mi, m);
    const want = seen ?? (mode === 'lock' ? cur : sentrySweep(m, f, ctx.r.phase));
    const a = cur + Math.max(-m.turn, Math.min(m.turn, angleDiff(want, cur)));
    st.aim.set(mi, a);

    if (mode !== 'lock') return;
    const k = f - since - m.spin;
    if (k < 0 || k % m.gap !== 0) return;
    const c = dcos(a);
    const s = dsin(a);
    ctx.spawn({
      x: x + c * SENTRY_MUZZLE,
      y: y + s * SENTRY_MUZZLE,
      vx: c * m.speed,
      vy: s * m.speed,
      owner: ctx.r.pp.owner,
      ammo: m.ammo,
      source: ctx.r.pp.uid,
    });
    st.lastFire = f;
    ctx.emit({ type: 'fire', x: x + c * SENTRY_MUZZLE, y: y + s * SENTRY_MUZZLE, angle: a, style: 'sentry' });
    if (f - since >= sentryFiring(m)) setMode(st, mi, 'cool', f);
  },
});
