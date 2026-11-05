import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { defineModule, solidId, type TickCtx, touchesHazard } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { SURFACES } from './body';

type Fuse = ModuleOf<'fuse'>;

/** Frames a crate's blast stays lethal: a flash, never a wall. */
export const FUSE_BLAST = 6;
/** How close (px) a shot, beam or blast has to come to set a crate off: touching is enough. */
const SPARK = 2;

const litKey = (mi: number) => `${mi}:lit`;
const boomKey = (mi: number) => `${mi}:boom`;
const backKey = (mi: number) => `${mi}:back`;

/** Where a crate is in its life at frame f. `left` counts down while lit; `since` counts up from the blast. */
export type FuseState = { mode: 'idle' } | { mode: 'lit'; left: number } | { mode: 'gone'; since: number; back: number };

export function fuseState(m: Fuse, st: PropState | undefined, mi: number, f: number): FuseState {
  const boom = st?.vars.get(boomKey(mi));
  const back = st?.vars.get(backKey(mi)) ?? 0;
  if (boom !== undefined && f >= boom && f < back) return { mode: 'gone', since: f - boom, back };
  const lit = st?.vars.get(litKey(mi));
  if (lit !== undefined) return { mode: 'lit', left: Math.max(0, m.count - (f - lit)) };
  return { mode: 'idle' };
}

/** The crate's cells, as one box (px). */
function crateBox(m: Fuse, ctx: { off: readonly number[] }): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of m.cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return { x: x0 * TILE + ctx.off[0], y: y0 * TILE + ctx.off[1], w: (x1 - x0) * TILE, h: (y1 - y0) * TILE };
}

/** Did a shot, a beam or another blast touch the crate this frame? */
function sparked(box: Rect, ctx: TickCtx): boolean {
  const r = { x: box.x - SPARK, y: box.y - SPARK, w: box.w + SPARK * 2, h: box.h + SPARK * 2 };
  if (ctx.struck?.some(([x, y]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) return true;
  return !!ctx.hazards?.some((h) => h.ignites && touchesHazard(r, h));
}

/** Blow next frame: the blast is built from then, and the crate is gone until it regrows. */
function blow(m: Fuse, ctx: TickCtx, box: Rect): void {
  const st = ctx.state;
  st.vars.delete(litKey(ctx.mi));
  st.vars.set(boomKey(ctx.mi), ctx.frame + 1);
  st.vars.set(backKey(ctx.mi), ctx.frame + 1 + m.regrow);
  st.lastFire = ctx.frame;
  ctx.emit({ type: 'explosion', x: box.x + box.w / 2, y: box.y + box.h / 2, r: m.radius * TILE });
}

/**
 * Fuse Crate: a crate you can stand on, for a while. Landing on it lights a
 * `count`-frame fuse (it doesn't care who's on it by then); then it blasts
 * everyone within `radius` tiles of its middle and is gone for `regrow` frames,
 * coming back only when nobody's in its way. A shot, a flame, a laser, an arc
 * or another crate's blast touching it sets it off at once, so crates chain.
 * The blast clears no terrain and no props; kills go to whoever placed it.
 */
defineModule<'fuse'>({
  type: 'fuse',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const s = fuseState(m, ctx.state, ctx.mi, ctx.frame);
    const uid = ctx.r.pp.uid;
    if (s.mode !== 'gone') {
      const { off, prev } = ctx;
      m.cells.forEach(([cx, cy], ci) =>
        out.solids.push({
          x: cx * TILE + off[0],
          y: cy * TILE + off[1],
          w: TILE,
          h: TILE,
          id: solidId(uid, ctx.mi, ci),
          dx: off[0] - prev[0],
          dy: off[1] - prev[1],
          surface: SURFACES.wood,
          propUid: uid,
          mi: ctx.mi,
        }),
      );
    } else if (s.since < FUSE_BLAST) {
      const b = crateBox(m, ctx);
      out.hazards.push({ owner: ctx.r.pp.owner, ignites: true, kind: 'circle', x: b.x + b.w / 2, y: b.y + b.h / 2, r: m.radius * TILE });
    }
  },
  onStand(m, ctx) {
    if (m.trigger !== 'land' || !ctx.live || fuseState(m, ctx.state, ctx.mi, ctx.frame).mode !== 'idle') return;
    ctx.state.vars.set(litKey(ctx.mi), ctx.frame);
    const b = crateBox(m, ctx);
    ctx.emit({ type: 'prop', kind: 'fuse-lit', x: b.x + b.w / 2, y: b.y });
  },
  tick(m, ctx) {
    const f = ctx.frame;
    const s = fuseState(m, ctx.state, ctx.mi, f);
    const box = crateBox(m, ctx);
    if (s.mode === 'gone') {
      // Never regrow around a runner: wait a frame at a time until they're clear.
      if (s.back === f + 1 && ctx.runners.some((r) => r.active && r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y))
        ctx.state.vars.set(backKey(ctx.mi), s.back + 1);
      return;
    }
    if (!ctx.live) return;
    if (sparked(box, ctx) || (s.mode === 'lit' && s.left <= 1)) blow(m, ctx, box);
    else if (s.mode === 'lit' && s.left % 60 === 0) ctx.emit({ type: 'prop', kind: 'fuse-tick', x: box.x + box.w / 2, y: box.y });
  },
});
