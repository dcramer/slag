import { TILE } from '../../constants';
import { defineModule, type RunnerView } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { mysteryKey, mysteryState } from './mystery';

type Surge = ModuleOf<'surge'>;

/**
 * Leg Day: a climb's pickup, a protein shaker floating on the lip of a risky line (gen/level/loop-surges.ts). Touch it
 * and every jump springs higher for a few seconds (props/status.ts `SURGE`), so the hard line pays; another stands
 * there `refill` frames later. Nothing about it is solid, so it changes no route. It keeps a crate's counters
 * (`mysteryState`): how many it has given and when it's back, two numbers every peer agrees on.
 */

/** Px of a runner's body the grab reaches into from each side of the cell. */
const INSET = 3;

/** Whether `m` is there to take (false while it refills). */
export const surgeReady = (st: PropState | undefined, mi: number, frame: number) => frame >= mysteryState(st, mi).ready;

/** How far `m` has refilled, 0 just taken to 1 full. */
export function surgeFill(m: Surge, st: PropState | undefined, mi: number, frame: number): number {
  const left = mysteryState(st, mi).ready - frame;
  return left <= 0 ? 1 : 1 - left / Math.max(1, m.refill);
}

const reaches = (r: RunnerView, x: number, y: number) => r.x + r.w > x + INSET && r.x < x + TILE - INSET && r.y + r.h > y && r.y < y + TILE;

defineModule<'surge'>({
  type: 'surge',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  rides: true,
  anchors: (m) => m.cells.slice(),
  tick(m, ctx) {
    if (!ctx.live || !ctx.surge || !surgeReady(ctx.state, ctx.mi, ctx.frame)) return;
    const [cx, cy] = m.cells[0];
    const x = cx * TILE + ctx.off[0];
    const y = cy * TILE + ctx.off[1];
    // Everyone reaching in, nearest its middle first (by runner order only on an exact tie).
    const mid = x + TILE / 2;
    const by = ctx.runners
      .map((r, i) => ({ i, d: Math.abs(r.x + r.w / 2 - mid), r }))
      .filter((q) => q.r.active && reaches(q.r, x, y))
      .sort((a, b) => a.d - b.d || a.i - b.i);
    for (const q of by) {
      if (!ctx.surge(q.i, m.frames)) continue;
      ctx.state.vars.set(mysteryKey(ctx.mi, 'pops'), mysteryState(ctx.state, ctx.mi).pops + 1);
      ctx.state.vars.set(mysteryKey(ctx.mi, 'ready'), ctx.frame + m.refill);
      ctx.state.vars.set(mysteryKey(ctx.mi, 'popAt'), ctx.frame);
      ctx.state.lastFire = ctx.frame;
      return;
    }
  },
});
