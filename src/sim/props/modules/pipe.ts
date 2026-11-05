import { sq } from '../../../core/dmath';
import type { Rect } from '../../../core/geom';
import { TILE } from '../../constants';
import type { Body } from '../../physics';
import type { InputFrame } from '../../types';
import { LATCH, latchOf } from '../attach';
import { addTrigger, defineModule, solidId, type TouchCtx } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf, PlacedProp, Resolved } from '../types';
import { SURFACES } from './body';

type Pipe = ModuleOf<'pipe'>;

export const PIPE = {
  /** Mouth width (tiles): every pipe is two tiles across, its lip included. */
  wide: 2,
  /** The lip: how deep it is down the pipe (px), and how far it stands out past the shaft on each side (px). */
  lip: 8,
  overhang: 4,
  /** Corner radii (px): the lip is a rolled rim, round at all four corners; the shaft's far end is softened. */
  roll: 4,
  foot: 2,
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

/** The LATCH bits that ask to go into a mouth facing this way. */
function entering(m: Pipe): number {
  const [dx, dy] = dirOf(m.angle);
  return dy < 0 ? LATCH.down : dy > 0 ? LATCH.up | LATCH.jump : dx > 0 ? LATCH.left : LATCH.right;
}

/**
 * Is this runner asking to go in? On a mouth facing up: standing on it and
 * holding down. Under one facing down: head against it and holding up (or
 * jump). At a side mouth: flush with it and pushing into it, on foot or in
 * the air. Always over the opening, not its rim, and never with an input still
 * held from coming out of a pipe (`latch`): that one has to be pressed again.
 */
function wantsIn(m: Pipe, b: Body, inp: InputFrame, latch: number): boolean {
  const [dx, dy] = dirOf(m.angle);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (!(latchOf(inp) & entering(m) & ~latch)) return false;
  if (dy < 0) return b.onGround && Math.abs(cx - m.at[0]) <= PIPE.inner && Math.abs(b.y + b.h - m.at[1]) < 1;
  if (dy > 0) return Math.abs(cx - m.at[0]) <= PIPE.inner && Math.abs(b.y - m.at[1]) < 1.5;
  return Math.abs(cy - m.at[1]) <= PIPE.inner && Math.abs((dx > 0 ? b.x : b.x + b.w) - m.at[0]) < 1.5;
}

/**
 * The pipe's outline in its own frame: its half-width (px) at depth `v` down the pipe from the mouth,
 * for a pipe `len` px long. A lip the full two tiles across and PIPE.lip deep, rolled round at every
 * corner, then a shaft PIPE.overhang narrower on each side whose far corners are softened. The art
 * draws exactly this curve; the sim steps it (pipeBands).
 */
export function pipeHalfWidth(v: number, len: number): number {
  const half = (PIPE.wide * TILE) / 2;
  const shaft = half - PIPE.overhang;
  const round = (r: number, d: number) => r - Math.sqrt(Math.max(0, r * r - sq(Math.max(0, r - d))));
  if (v < PIPE.lip) return half - round(PIPE.roll, Math.min(v, PIPE.lip - v));
  return shaft - round(PIPE.foot, len - v);
}

/**
 * Where the stepped solids cut the outline (depths from the mouth): fine where a corner curves, one
 * band where it's straight, so every band's edge stays within about a pixel of the curve.
 */
function pipeCuts(len: number): number[] {
  const L = PIPE.lip;
  return [0, 0.3, 1, 2, L - 2, L - 1, L - 0.3, L, len - 1.2, len - 0.4, len];
}

/** The outline as bands (pipe space): each one as wide as the curve at its middle depth. */
export function pipeBands(len: number): { v0: number; v1: number; hw: number }[] {
  const cuts = pipeCuts(len);
  const out: { v0: number; v1: number; hw: number }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) out.push({ v0: cuts[i], v1: cuts[i + 1], hw: pipeHalfWidth((cuts[i] + cuts[i + 1]) / 2, len) });
  return out;
}

/**
 * The pipe's solids: its outline (pipeHalfWidth) stepped into world px rects, so the round lip and
 * the softened foot have a hitbox within about a pixel of what's drawn. They sit inside the footprint,
 * which still takes every cell for placing and for the winnability proof. `lip` are the rim's bands.
 */
export function pipeRects(m: Pipe): { lip: Rect[]; shaft: Rect[] } {
  const [dx, dy] = dirOf(m.angle);
  const len = (m.cells.length / PIPE.wide) * TILE;
  // Pipe space (u across the mouth, v down the pipe from it) to a world rect.
  const box = (u0: number, u1: number, v0: number, v1: number): Rect => {
    const xa = m.at[0] - dy * u0 - dx * v0;
    const xb = m.at[0] - dy * u1 - dx * v1;
    const ya = m.at[1] + dx * u0 - dy * v0;
    const yb = m.at[1] + dx * u1 - dy * v1;
    return { x: Math.min(xa, xb), y: Math.min(ya, yb), w: Math.abs(xb - xa), h: Math.abs(yb - ya) };
  };
  const out: { lip: Rect[]; shaft: Rect[] } = { lip: [], shaft: [] };
  for (const b of pipeBands(len)) (b.v0 < PIPE.lip ? out.lip : out.shaft).push(box(-b.hw, b.hw, b.v0, b.v1));
  return out;
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
defineModule<'pipe'>({
  type: 'pipe',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), at: x.P(m.at), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const uid = ctx.r.pp.uid;
    const { lip, shaft } = pipeRects(m);
    // The rim stands a quarter tile proud of the shaft in steps: each one walked over, not jumped.
    [...lip, ...shaft].forEach((r, i) => {
      out.solids.push({
        ...r,
        id: solidId(uid, ctx.mi, i),
        dx: 0,
        dy: 0,
        surface: SURFACES.metal,
        propUid: uid,
        mi: ctx.mi,
        ...(i < lip.length ? { step: PIPE.overhang } : {}),
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
    if (!ctx.live || !ctx.inp || !pipeMate(ctx.r, ctx.peer) || !wantsIn(m, who.body, ctx.inp, who.attach.latch)) return;
    const b = who.body;
    ctx.grab({ x: b.x + b.w / 2 - m.at[0], y: b.y + b.h / 2 - m.at[1], sealed: true, kind: 'pipe-in' });
  },
  hold(m, ctx, who, g, inp) {
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
    // Whatever would send you straight back into this mouth has to be let go first.
    who.attach.latch |= latchOf(inp) & entering(at);
    return false;
  },
});
