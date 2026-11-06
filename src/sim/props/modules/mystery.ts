import { deriveSeed, Rng } from '../../../core/rng';
import { TILE } from '../../constants';
import { T_SOLID, tileAt } from '../../level';
import type { ItemKind } from '../../items/types';
import { defineModule, type RunnerView, solidId } from '../registry';
import type { ModuleOf, PropState } from '../types';
import { SURFACES } from './body';

type Mystery = ModuleOf<'mystery'>;

/** PropState.vars keys for a crate module. */
const key = (mi: number, name: 'pops' | 'ready' | 'popAt') => `${mi}:${name}`;

/** Pops so far, the frame it's ready again, and the last pop frame (for the pop animation). */
export function mysteryState(st: PropState | undefined, mi: number): { pops: number; ready: number; popAt: number } {
  return {
    pops: st?.vars.get(key(mi, 'pops')) ?? 0,
    ready: st?.vars.get(key(mi, 'ready')) ?? 0,
    popAt: st?.vars.get(key(mi, 'popAt')) ?? -999,
  };
}

/** Spent: a limited crate that has popped all its items. */
export const mysterySpent = (m: Mystery, pops: number) => m.uses > 0 && pops >= m.uses;

/** Deterministic crate roll: same race seed, crate and pop count give the same item on every peer. */
export function rollItem(pool: readonly ItemKind[], seed: number, uid: number, mi: number, pops: number): ItemKind {
  return new Rng(deriveSeed(deriveSeed(deriveSeed(seed, 'mystery'), uid * 16 + mi), pops)).pick(pool);
}

/**
 * What a Rising Slag loop's box deals by rank (gen/level/loop-boxes.ts), the way a kart racer's boxes do: whoever
 * is behind draws something that reaches up (the hook that trades places with the one ahead, the punch that flies up
 * through floors, a burst upward, a step, the shell that hunts the leader), and whoever leads something to hold on
 * with. None kills.
 */
export const CATCH_UP: { chase: readonly ItemKind[]; lead: readonly ItemKind[] } = {
  chase: ['hook', 'upper', 'upper', 'rocket', 'block', 'tax'],
  lead: ['shield', 'sword', 'block'],
};

/** Is the runner who knocked the box the leader, highest of everyone still racing (`RunnerView.up`)? */
function leads(r: RunnerView, all: readonly RunnerView[]): boolean {
  if (r.up === undefined) return true;
  return !all.some((o) => o !== r && o.active && o.up !== undefined && o.up < r.up!);
}

/**
 * Hit from below (head flush with the underside) or bumped from the side
 * (flush with a side face, overlapping vertically). Standing on it never counts.
 */
function touches(r: RunnerView, x: number, y: number): boolean {
  const ox = Math.min(r.x + r.w, x + TILE) - Math.max(r.x, x);
  const oy = Math.min(r.y + r.h, y + TILE) - Math.max(r.y, y);
  const below = ox >= 2 && r.y >= y + TILE - 0.75 && r.y <= y + TILE + 1.5;
  const side = oy >= 3 && (Math.abs(r.x + r.w - x) <= 1.5 || Math.abs(r.x - (x + TILE)) <= 1.5);
  return below || side;
}

/** A solid crate block that pops a random held item. */
defineModule<'mystery'>({
  type: 'mystery',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells) }),
  rides: true,
  anchors: (m) => m.cells.slice(),
  build(m, ctx, out) {
    const { off, prev } = ctx;
    m.cells.forEach(([cx, cy], ci) => {
      out.solids.push({
        x: cx * TILE + off[0],
        y: cy * TILE + off[1],
        w: TILE,
        h: TILE,
        id: solidId(ctx.r.pp.uid, ctx.mi, ci),
        dx: off[0] - prev[0],
        dy: off[1] - prev[1],
        surface: SURFACES.wood,
        propUid: ctx.r.pp.uid,
        mi: ctx.mi,
      });
    });
  },
  tick(m, ctx) {
    if (!ctx.live) return;
    const st = mysteryState(ctx.state, ctx.mi);
    if (mysterySpent(m, st.pops) || ctx.frame < st.ready) return;
    for (const [cx, cy] of m.cells) {
      const x = cx * TILE + ctx.off[0];
      const y = cy * TILE + ctx.off[1];
      const hi = ctx.runners.findIndex((r) => r.active && touches(r, x, y));
      if (hi < 0) continue;
      const hitter = ctx.runners[hi];
      const pool = m.catchUp ? (leads(hitter, ctx.runners) ? CATCH_UP.lead : CATCH_UP.chase) : m.pool;
      const kind = rollItem(pool, ctx.itemSeed ?? ctx.level.seed, ctx.r.pp.uid, ctx.mi, st.pops);
      // A loop's box hands it over, as a racer's item box does: a climb has no time to hop about after a pop, and its
      // boxes hang in open air. Any other box (or full hands) pops it out of the top, so whoever hit it has to hop up
      // for it, or a rival snatches it; under a low roof it drops out of the bottom instead.
      if (!(m.catchUp && ctx.handItem?.(hi, kind))) {
        const roofed = tileAt(ctx.level, Math.floor((x + TILE / 2) / TILE), Math.floor((y - 1) / TILE)) === T_SOLID;
        ctx.spawnItem?.({ kind, x: x + TILE / 2, y: roofed ? y + TILE + 6 : y - 6, vx: 0, vy: roofed ? 60 : -190, grace: 14 });
      }
      ctx.state.vars.set(key(ctx.mi, 'pops'), st.pops + 1);
      ctx.state.vars.set(key(ctx.mi, 'ready'), ctx.frame + m.refill);
      ctx.state.vars.set(key(ctx.mi, 'popAt'), ctx.frame);
      ctx.state.lastFire = ctx.frame;
      ctx.emit({ type: 'item', what: 'pop', kind, slot: -1, x: x + TILE / 2, y });
      return;
    }
  },
});
