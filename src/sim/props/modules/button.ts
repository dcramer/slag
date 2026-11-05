import { TILE } from '../../constants';
import { addTrigger, cellOf, defineModule, solidId } from '../registry';
import type { PropState } from '../types';
import { SURFACES } from './body';
import { padRect } from './spring';

const fromKey = (mi: number) => `${mi}:from`;
const untilKey = (mi: number) => `${mi}:until`;
const holdKey = (mi: number) => `${mi}:hold`;

/** Frame the outline goes back to dotted lines (0 if the button was never pressed). */
export function buttonUntil(st: PropState | undefined, mi: number): number {
  return st?.vars.get(untilKey(mi)) ?? 0;
}

/** Is the button holding its outline up at frame f? A press counts from the frame after it, since the frame it happened in is already built. */
export const buttonOn = (st: PropState | undefined, mi: number, f: number): boolean => (st?.vars.get(fromKey(mi)) ?? 0) <= f && f < buttonUntil(st, mi);

/** Is outline cell `ci` solid at frame f? One with a runner in it when the button went down waits until it's clear. */
export function buttonSolid(st: PropState | undefined, mi: number, f: number, ci: number): boolean {
  if (!buttonOn(st, mi, f)) return false;
  return ((st?.vars.get(holdKey(mi)) ?? 0) & (1 << ci)) === 0;
}

/** Child-sized ids for the outline cells, after the button's own pad. */
const CELL = 1;

/**
 * Panic Button: press it (stand on it or bump it) and its dotted outline turns
 * to solid blocks for `on` frames, ticking for the last `warn`. Press it again
 * while it's on and the timer starts over. The blink-block rule holds: a cell
 * never fills in around a runner, it waits until they've left.
 */
defineModule<'button'>({
  type: 'button',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), angle: m.angle + x.da, cells: x.C(m.cells) }),
  anchors: (m) => [cellOf(m.at), ...m.cells],
  build(m, ctx, out) {
    const uid = ctx.r.pp.uid;
    addTrigger(out, { r: padRect(m.at, m.angle, ctx.off), uid, mi: ctx.mi, key: solidId(uid, ctx.mi, 0) });
    const { off, prev } = ctx;
    m.cells.forEach(([cx, cy], ci) => {
      if (!buttonSolid(ctx.state, ctx.mi, ctx.frame, ci)) return;
      out.solids.push({
        x: cx * TILE + off[0],
        y: cy * TILE + off[1],
        w: TILE,
        h: TILE,
        id: solidId(uid, ctx.mi, CELL + ci),
        dx: off[0] - prev[0],
        dy: off[1] - prev[1],
        surface: SURFACES.stone,
        propUid: uid,
        mi: ctx.mi,
      });
    });
  },
  touch(m, ctx, _who, _t, first) {
    if (!ctx.live || !first) return;
    const st = ctx.state;
    if (!buttonOn(st, ctx.mi, ctx.frame)) st.vars.set(fromKey(ctx.mi), ctx.frame + 1);
    st.vars.set(untilKey(ctx.mi), ctx.frame + 1 + m.on);
    st.lastFire = ctx.frame;
    ctx.emit({ type: 'prop', kind: 'button-press', x: m.at[0] + ctx.off[0], y: m.at[1] + ctx.off[1] });
  },
  tick(m, ctx) {
    const f = ctx.frame;
    const st = ctx.state;
    let hold = st.vars.get(holdKey(ctx.mi)) ?? 0;
    if (!buttonOn(st, ctx.mi, f + 1)) hold = 0;
    else {
      m.cells.forEach(([cx, cy], ci) => {
        const bit = 1 << ci;
        const x = cx * TILE + ctx.off[0];
        const y = cy * TILE + ctx.off[1];
        const inside = ctx.runners.some((p) => p.active && p.x < x + TILE && p.x + p.w > x && p.y < y + TILE && p.y + p.h > y);
        if (!buttonSolid(st, ctx.mi, f, ci) && inside) hold |= bit;
        else if (!inside) hold &= ~bit;
      });
    }
    st.vars.set(holdKey(ctx.mi), hold);
    if (buttonUntil(st, ctx.mi) === f + 1) ctx.emit({ type: 'prop', kind: 'button-off', x: m.at[0] + ctx.off[0], y: m.at[1] + ctx.off[1] });
  },
});
