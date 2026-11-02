import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { castBeam } from '../rays';
import { cellOf, type Contrib, defineModule, type PropCtx } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Ladle = ModuleOf<'ladle'>;

/** Segments of a ladle's cycle. */
export const LADLE_OFF = 0;
export const LADLE_WARN = 1;
export const LADLE_POUR = 2;
export const LADLE_SET = 3;

/** Px the stream is across: a rope of slag, a third of a tile. */
export const STREAM_W = 5;
/** Px the spill stands off the floor: low enough to hop, high enough that standing in it burns. */
export const SPILL_H = 4;
/** Share of the pour it takes the spill to run out to its full reach. */
const SPREAD_BY = 0.55;
/** Px the stream starts under the lip, so the lip itself never stops it. */
const LIP_SKIP = 1;

/** Where the ladle is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const ladleCycle = (m: Ladle, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.pour, m.set]);

/** How far it's tipped on frame `f`, 0 upright to 1 pouring: easing over in the warning, righting itself after the pour. */
export function ladleTilt(m: Ladle, f: number, phase: number): number {
  const c = ladleCycle(m, f, phase);
  const u = c.t / Math.max(1, c.len);
  if (c.seg === LADLE_WARN) return 0.4 * u * u;
  if (c.seg === LADLE_POUR) return Math.min(1, 0.4 + 0.6 * (c.t / 8));
  if (c.seg === LADLE_SET) return Math.max(0, 1 - u * 1.6);
  return 0;
}

/** 0..1, how far the spill has run out on frame `f` (0 when there's none). */
export function spillReach(m: Ladle, f: number, phase: number): number {
  const c = ladleCycle(m, f, phase);
  if (c.seg === LADLE_POUR) return Math.min(1, (c.t + 1) / Math.max(1, m.pour * SPREAD_BY));
  if (c.seg === LADLE_SET) return 1;
  return 0;
}

/** The spill's rect (px, with the prop's offset) at full reach `k` (0..1), lying on the floor `drop` under the lip. */
export function spillRect(m: Ladle, k: number, ox = 0, oy = 0): Rect {
  const x = m.at[0] + ox;
  const floor = m.at[1] + oy + m.drop;
  const l = m.spill[0] * k + STREAM_W / 2;
  const r = m.spill[1] * k + STREAM_W / 2;
  return { x: x - l, y: floor - SPILL_H, w: l + r, h: SPILL_H };
}

/** Did the stream stop on the floor it was poured for (`len` px, `hit` something)? Then it spills; stopped short, or with the floor blown away, it doesn't. */
export const landed = (m: Ladle, len: number, hit: boolean) => hit && Math.abs(len - m.drop) <= 1;

/**
 * Factory-only, world-only hazard (docs/SETPIECES.md, Factory): a ladle of molten slag that tips on a
 * cycle. The warning is the ladle easing over, the lip glowing: drawn, never felt. Then the slag pours
 * straight down from the lip, stopped by the first thing in its way (a part held up under it catches the
 * stream), and where it reaches its floor it spills out either way along it, a molten skin you hop or
 * burn in, until it crusts over after the pour. Nothing about it is solid. It's off far longer than it's
 * on, so a route under it is passable by timing (barrier.ts MIN_OPENING).
 */
export const ladle = defineModule<'ladle'>({
  type: 'ladle',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), drop: m.drop * x.T, spill: [m.spill[0] * x.T, m.spill[1] * x.T], hang: m.hang * x.T }),
  // The cell under the lip, where the stream leaves.
  anchors: (m) => [cellOf([m.at[0], m.at[1] + 0.5])],
  trace(m, ctx: PropCtx, out: Contrib) {
    const c = ladleCycle(m, ctx.frame, ctx.r.phase);
    if (c.seg !== LADLE_POUR && c.seg !== LADLE_SET) return;
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    // Cast every frame of the pour and the set, so the art and the spill read one reach.
    const beam = castBeam(ctx, out, x, y, 0, 1, m.drop + TILE * 0.25, LIP_SKIP);
    const owner = ctx.r.pp.owner;
    if (c.seg === LADLE_POUR && beam.len > LIP_SKIP)
      out.hazards.push({ owner, ignites: true, kind: 'rect', r: { x: x - STREAM_W / 2, y: y + LIP_SKIP, w: STREAM_W, h: beam.len - LIP_SKIP } });
    if (!landed(m, beam.len, beam.hit)) return;
    out.hazards.push({ owner, ignites: true, kind: 'rect', r: spillRect(m, spillReach(m, ctx.frame, ctx.r.phase), ctx.off[0], ctx.off[1]) });
  },
});
