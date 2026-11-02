import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import { isProtected, type Level, T_EMPTY, tileAt } from '../../level';
import { defineModule, solidId } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf, PropState } from '../types';
import { SURFACES } from './body';

type Dropper = ModuleOf<'dropper'>;

/** Dropper states, stored in PropState.vars. */
export const DROP_IDLE = 0;
export const DROP_WARN = 1;
export const DROP_FALL = 2;
export const DROP_REST = 3;
export const DROP_RISE = 4;

/** Slam acceleration and top speed (px/frame², px/frame), return speed (px/frame), re-arm delay (frames). */
export const DROP_ACCEL = 0.6;
export const DROP_MAX = 9;
export const DROP_RISE_SPEED = 0.75;
export const DROP_COOL = 30;

export interface DropperPose {
  state: number;
  /** Frames since entering the state. */
  t: number;
  /** Current travel (px) along the slam direction, and last frame's. */
  d: number;
  pd: number;
}

const k = (mi: number, n: string) => `${mi}:${n}`;

export function dropperPose(st: PropState | undefined, mi: number, f: number): DropperPose {
  if (!st) return { state: DROP_IDLE, t: 999, d: 0, pd: 0 };
  return {
    state: st.vars.get(k(mi, 'st')) ?? DROP_IDLE,
    t: f - (st.vars.get(k(mi, 't')) ?? -999),
    d: st.vars.get(k(mi, 'd')) ?? 0,
    pd: st.vars.get(k(mi, 'pd')) ?? 0,
  };
}

/** Bounding rect (px) of the head at rest. */
export function dropperRect(m: Dropper, ox = 0, oy = 0): Rect {
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
  return { x: x0 * TILE + ox, y: y0 * TILE + oy, w: (x1 - x0) * TILE, h: (y1 - y0) * TILE };
}

/** Whole tiles the head can travel before it would enter terrain, a one-way ledge or a protected zone, up to `reach`. */
export function dropperTravel(level: Level | null, m: Dropper): number {
  if (!level) return m.reach * TILE;
  const [dx, dy] = dirOf(m.angle);
  let n = 0;
  for (let s = 1; s <= m.reach; s++) {
    const free = ([x, y]: readonly [number, number]) => {
      const tx = x + dx * s;
      const ty = y + dy * s;
      return ty < level.h && tileAt(level, tx, ty) === T_EMPTY && !isProtected(level, tx, ty);
    };
    if (!m.cells.every(free)) break;
    n = s;
  }
  return n * TILE;
}

function shifted(r: Rect, angle: number, d: number): Rect {
  const [dx, dy] = dirOf(angle);
  return { x: r.x + dx * d, y: r.y + dy * d, w: r.w, h: r.h };
}

/**
 * Proximity crusher. It hangs still, watching the lane in front of its face;
 * when someone enters the lane it shakes (telegraph), then slams until it
 * meets terrain, rests, and crawls back. The head is solid all the time:
 * its leading face is deadly while slamming, it squashes anyone it pins,
 * and its back is a slow elevator on the way home.
 */
export const dropper = defineModule<'dropper'>({
  type: 'dropper',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const p = dropperPose(ctx.state, ctx.mi, ctx.frame);
    const base = dropperRect(m, ctx.off[0], ctx.off[1]);
    const prevBase = dropperRect(m, ctx.prev[0], ctx.prev[1]);
    const head = shifted(base, m.angle, p.d);
    const before = shifted(prevBase, m.angle, p.pd);
    out.solids.push({
      ...head,
      id: solidId(ctx.r.pp.uid, ctx.mi, 0),
      dx: head.x - before.x,
      dy: head.y - before.y,
      surface: SURFACES.stone,
      propUid: ctx.r.pp.uid,
      mi: ctx.mi,
    });
    if (p.state === DROP_FALL) {
      const [dx, dy] = dirOf(m.angle);
      const e = 5;
      const lead: Rect =
        dx > 0
          ? { x: head.x + head.w, y: head.y + 1, w: e, h: head.h - 2 }
          : dx < 0
            ? { x: head.x - e, y: head.y + 1, w: e, h: head.h - 2 }
            : dy > 0
              ? { x: head.x + 1, y: head.y + head.h, w: head.w - 2, h: e }
              : { x: head.x + 1, y: head.y - e, w: head.w - 2, h: e };
      out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: lead });
    }
  },
  tick(m, ctx) {
    const f = ctx.frame;
    const st = ctx.state;
    const p = dropperPose(st, ctx.mi, f);
    const travel = dropperTravel(ctx.level, m);
    const set = (state: number) => {
      st.vars.set(k(ctx.mi, 'st'), state);
      st.vars.set(k(ctx.mi, 't'), f);
    };
    let d = p.d;
    switch (p.state) {
      case DROP_IDLE: {
        if (!ctx.live || p.t < DROP_COOL || travel <= 0) break;
        const base = dropperRect(m, ctx.off[0], ctx.off[1]);
        const [dx, dy] = dirOf(m.angle);
        // The lane: the head's path, from its face to where it would land.
        const lane: Rect = {
          x: dx > 0 ? base.x + base.w : dx < 0 ? base.x - travel : base.x,
          y: dy > 0 ? base.y + base.h : dy < 0 ? base.y - travel : base.y,
          w: dx !== 0 ? travel : base.w,
          h: dy !== 0 ? travel : base.h,
        };
        const seen = ctx.runners.some((r) => r.active && r.x < lane.x + lane.w && r.x + r.w > lane.x && r.y < lane.y + lane.h && r.y + r.h > lane.y);
        if (seen) {
          set(DROP_WARN);
          ctx.emit({ type: 'prop', kind: 'dropper-warn', x: base.x + base.w / 2, y: base.y + base.h / 2 });
        }
        break;
      }
      case DROP_WARN:
        if (p.t >= m.warn) {
          set(DROP_FALL);
          st.vars.set(k(ctx.mi, 'v'), 0);
        }
        break;
      case DROP_FALL: {
        const v = Math.min(DROP_MAX, (st.vars.get(k(ctx.mi, 'v')) ?? 0) + DROP_ACCEL);
        st.vars.set(k(ctx.mi, 'v'), v);
        d = Math.min(travel, d + v);
        if (d >= travel) {
          set(DROP_REST);
          const head = shifted(dropperRect(m, ctx.off[0], ctx.off[1]), m.angle, d);
          const [dx, dy] = dirOf(m.angle);
          ctx.emit({ type: 'prop', kind: 'thud', x: head.x + head.w / 2 + (dx * head.w) / 2, y: head.y + head.h / 2 + (dy * head.h) / 2 });
        }
        break;
      }
      case DROP_REST:
        if (p.t >= m.rest) set(DROP_RISE);
        break;
      case DROP_RISE:
        d = Math.max(0, d - DROP_RISE_SPEED);
        if (d <= 0) set(DROP_IDLE);
        break;
    }
    st.vars.set(k(ctx.mi, 'pd'), p.d);
    st.vars.set(k(ctx.mi, 'd'), d);
  },
});
