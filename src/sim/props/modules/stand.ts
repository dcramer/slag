import { TILE } from '../../constants';
import type { ItemKind } from '../../items/types';
import { defineModule, type RunnerView } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { mysteryKey, mysteryState, rollItem } from './mystery';

type Stand = ModuleOf<'stand'>;

/**
 * An item stand: the party brawler's weapon spawner, a pedestal on the floor that holds one item where everyone can
 * see it. Walk into it with empty hands and it's yours; another, rolled fresh, stands there `refill` frames later.
 * Nothing about it is solid, so it changes no route. It keeps the crate's counters (`mysteryState`): what it holds
 * is the roll for how many it has given, so its state is two numbers and every peer sees the same item.
 */

/** Px of a runner's body the grab reaches into from each side of the pedestal's cell, and above it where the item floats. */
const INSET = 3;
const ABOVE = 6;

/** What `m` holds once it's full: the roll for how many it has given. While it refills, that's the one on its way. */
export function standNext(m: Stand, st: PropState | undefined, mi: number, seed: number, uid: number): ItemKind {
  return rollItem(m.pool, seed, uid, mi, mysteryState(st, mi).pops);
}

/** What `m` holds now (the item on show), or null while it refills. */
export function standHolds(m: Stand, st: PropState | undefined, mi: number, frame: number, seed: number, uid: number): ItemKind | null {
  return frame >= mysteryState(st, mi).ready ? standNext(m, st, mi, seed, uid) : null;
}

/** How far `m` has refilled, 0 just taken to 1 full. */
export function standFill(m: Stand, st: PropState | undefined, mi: number, frame: number): number {
  const left = mysteryState(st, mi).ready - frame;
  return left <= 0 ? 1 : 1 - left / Math.max(1, m.refill);
}

/** Does `r` reach into the stand at (x, y) px: its body over the pedestal or the item over it. */
function reaches(r: RunnerView, x: number, y: number): boolean {
  return r.x + r.w > x + INSET && r.x < x + TILE - INSET && r.y + r.h > y - ABOVE && r.y < y + TILE;
}

defineModule<'stand'>({
  type: 'stand',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  rides: true,
  anchors: (m) => m.cells.slice(),
  tick(m, ctx) {
    if (!ctx.live || !ctx.handItem) return;
    const seed = ctx.itemSeed ?? ctx.level.seed;
    const kind = standHolds(m, ctx.state, ctx.mi, ctx.frame, seed, ctx.r.pp.uid);
    if (!kind) return;
    const [cx, cy] = m.cells[0];
    const x = cx * TILE + ctx.off[0];
    const y = cy * TILE + ctx.off[1];
    // Everyone reaching in, nearest the item first (by slot order only on an exact tie): the first with empty hands has it.
    const mid = x + TILE / 2;
    const by = ctx.runners
      .map((r, i) => ({ i, d: Math.abs(r.x + r.w / 2 - mid), r }))
      .filter((q) => q.r.active && reaches(q.r, x, y))
      .sort((a, b) => a.d - b.d || a.i - b.i);
    for (const q of by) {
      if (!ctx.handItem(q.i, kind)) continue;
      const st = mysteryState(ctx.state, ctx.mi);
      ctx.state.vars.set(mysteryKey(ctx.mi, 'pops'), st.pops + 1);
      ctx.state.vars.set(mysteryKey(ctx.mi, 'ready'), ctx.frame + m.refill);
      ctx.state.vars.set(mysteryKey(ctx.mi, 'popAt'), ctx.frame);
      ctx.state.lastFire = ctx.frame;
      return;
    }
  },
});
