import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import type { Body } from '../../physics';
import type { InputFrame } from '../../types';
import { addTrigger, defineModule, solidId, type TouchCtx } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf, PlacedProp, Resolved } from '../types';
import { SURFACES } from './body';

type Pipe = ModuleOf<'pipe'>;

export const PIPE = {
  /** Mouth width (tiles): every pipe is two tiles across. */
  wide: 2,
  /** How far off-center (px) you can stand and still go in: the mouth less its rim. */
  inner: 12,
  /** Depth (px) of the zone in front of the mouth. */
  depth: 3,
  /** Frames to slide in, and to slide out of the other end. */
  in: 20,
  out: 20,
  /** Speeds (px/s) you leave a mouth with: a hop out of one facing up, a walk out of a side, a drop out of one facing down. */
  hop: 260,
  walk: 100,
  drop: 60,
} as const;

/** Is this placed part a warp pipe? */
export const isPipe = (pp: PlacedProp): boolean => pp.def.modules.some((m) => m.type === 'pipe');

/**
 * Pair the match's pipes. A pair, once made, stays a pair while both stand; a
 * pipe whose partner is gone waits again; and the waiting pipes pair up oldest
 * first, in the order they went in (`placed` is in placement order). So the
 * 1st links with the 2nd and the 3rd with the 4th, a bomb that takes one pipe
 * leaves its partner waiting for the next, and there's never more than one
 * pipe waiting. Writes `PlacedProp.link`; the match calls it whenever its
 * parts change.
 */
export function linkPipes(placed: readonly PlacedProp[]): void {
  const pipes = placed.filter(isPipe);
  const byUid = new Map(pipes.map((p) => [p.uid, p] as const));
  for (const p of pipes) if (p.link !== undefined && byUid.get(p.link)?.link !== p.uid) delete p.link;
  let wait: PlacedProp | undefined;
  for (const p of pipes) {
    if (p.link !== undefined) continue;
    if (!wait) wait = p;
    else {
      wait.link = p.uid;
      p.link = wait.uid;
      wait = undefined;
    }
  }
}

/** The pipe waiting for a partner, if there is one (there's never more than one: see linkPipes). */
export function lonePipe(placed: readonly PlacedProp[]): PlacedProp | undefined {
  return placed.find((p) => isPipe(p) && p.link === undefined);
}

/** Pair numbers for linked pipes, 1 for the first pair placed, so both ends of a pair can wear the same one. */
export function pipePairs(placed: readonly PlacedProp[]): Map<number, number> {
  const out = new Map<number, number>();
  let n = 0;
  for (const p of placed) {
    if (p.link === undefined || !isPipe(p)) continue;
    const mate = out.get(p.link);
    out.set(p.uid, mate ?? ++n);
  }
  return out;
}

/** A linked partner in this race, and its pipe. Both ends have to agree, or neither goes anywhere. */
export function pipeMate(r: Resolved, peer: TouchCtx['peer']): { r: Resolved; m: Pipe } | null {
  const uid = r.pp.link;
  if (uid === undefined || !peer) return null;
  const q = peer(uid);
  if (!q || q.pp.link !== r.pp.uid) return null;
  const m = q.mods.find((x): x is Pipe => x.type === 'pipe');
  return m ? { r: q, m } : null;
}

/** Where a runner stands to be at a mouth: right outside it, centered on it. Pipes never move. */
export function mouthPose(m: Pipe, b: Pick<Body, 'w' | 'h'>): Rect {
  const [dx, dy] = dirOf(m.angle);
  const cx = m.at[0] + (dx * b.w) / 2;
  const cy = m.at[1] + (dy * b.h) / 2;
  return { x: cx - b.w / 2, y: cy - b.h / 2, w: b.w, h: b.h };
}

/**
 * Is this runner asking to go in? On a mouth facing up: standing on it and
 * holding down. Under one facing down: head against it and holding up (or
 * jump). At a side mouth: flush with it and pushing into it, on foot or in
 * the air. Always over the opening, not its rim.
 */
function wantsIn(m: Pipe, b: Body, inp: InputFrame): boolean {
  const [dx, dy] = dirOf(m.angle);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (dy < 0) return inp.down && b.onGround && Math.abs(cx - m.at[0]) <= PIPE.inner && Math.abs(b.y + b.h - m.at[1]) < 1;
  if (dy > 0) return (inp.up || inp.jump) && Math.abs(cx - m.at[0]) <= PIPE.inner && Math.abs(b.y - m.at[1]) < 1.5;
  const push = dx > 0 ? inp.left : inp.right;
  return push && Math.abs(cy - m.at[1]) <= PIPE.inner && Math.abs((dx > 0 ? b.x : b.x + b.w) - m.at[0]) < 1.5;
}

/** Put the body at a mouth, unless something solid is in the way there. */
function pin(ctx: TouchCtx, b: Body, m: Pipe): void {
  const q = mouthPose(m, b);
  if (ctx.blocked(q)) return;
  b.x = q.x;
  b.y = q.y;
}

/**
 * The warp pipe. A solid you stand on like a block, with a mouth. Linked to a
 * partner (linkPipes), it takes you in: you slide down into the mouth, come
 * out of the partner's facing its way, and leave with a little push out of
 * it. A lone pipe is only a block. The trip is a hold (props/attach.ts): the
 * hitbox never changes and stays just outside the mouth you're at, so hazards
 * there still count, the art slides you in and out. If the far mouth is
 * blocked when you get there, the pipe spits you back out of the near one.
 * One runner per pipe at a time; what you carry stays in your pocket.
 */
export const pipe = defineModule<'pipe'>({
  type: 'pipe',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const uid = ctx.r.pp.uid;
    m.cells.forEach(([cx, cy], ci) => {
      out.solids.push({
        x: cx * TILE,
        y: cy * TILE,
        w: TILE,
        h: TILE,
        id: solidId(uid, ctx.mi, ci),
        dx: 0,
        dy: 0,
        surface: SURFACES.metal,
        propUid: uid,
        mi: ctx.mi,
      });
    });
    const [dx, dy] = dirOf(m.angle);
    const half = (PIPE.wide * TILE) / 2;
    const d = PIPE.depth;
    const r: Rect =
      dy !== 0
        ? { x: m.at[0] - half, y: dy < 0 ? m.at[1] - d : m.at[1], w: half * 2, h: d }
        : { x: dx < 0 ? m.at[0] - d : m.at[0], y: m.at[1] - half, w: d, h: half * 2 };
    addTrigger(out, { r, uid, mi: ctx.mi, key: solidId(uid, ctx.mi, 63) });
  },
  touch(m, ctx, who) {
    if (!ctx.live || !ctx.inp || !pipeMate(ctx.r, ctx.peer) || !wantsIn(m, who.body, ctx.inp)) return;
    const b = who.body;
    ctx.grab({ x: b.x + b.w / 2 - m.at[0], y: b.y + b.h / 2 - m.at[1], sealed: true, kind: 'pipe-in' });
  },
  hold(m, ctx, who, g) {
    const b = who.body;
    b.vx = 0;
    b.vy = 0;
    if (g.t < PIPE.in) {
      pin(ctx, b, m);
      return true;
    }
    if (g.t === PIPE.in) {
      const mate = pipeMate(ctx.r, ctx.peer);
      const through = !!mate && !ctx.blocked(mouthPose(mate.m, b));
      const to = through ? mate : { r: ctx.r, m };
      g.to = to.r.pp.uid;
      pin(ctx, b, to.m);
      ctx.state.lastFire = ctx.frame;
      ctx.emit({ type: 'prop', kind: 'pipe-out', x: m.at[0], y: m.at[1], x2: to.m.at[0], y2: to.m.at[1] });
      return true;
    }
    const at = g.to === ctx.r.pp.uid ? m : ctx.peer?.(g.to)?.mods.find((x): x is Pipe => x.type === 'pipe');
    if (!at) return false;
    pin(ctx, b, at);
    if (g.t < PIPE.in + PIPE.out) return true;
    const [dx, dy] = dirOf(at.angle);
    b.vx = dx * PIPE.walk;
    b.vy = dy < 0 ? -PIPE.hop : dy > 0 ? PIPE.drop : 0;
    if (dx) b.facing = dx > 0 ? 1 : -1;
    return false;
  },
});
