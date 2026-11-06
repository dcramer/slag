import { floorAt, tile } from '../tactics';
import type { BrainView, Cell, RunnerSense, SelfSense } from '../types';
import { aimOf } from './headway';
import { ItemPlay } from './items';
import type { StrategyDef } from './types';

/** Frames it sticks with a rival before looking round for a nearer one. */
const MARK_FRAMES = 90;
/** Rows of slag under its feet that send it up out of the way, and how far it looks for higher ground. */
const SLAG_CLOSE = 9;
const LOOK_ACROSS = 16;
const LOOK_UP = 12;

/** The highest stand cell near it, a few rows over its own, or null. */
function highGround(v: BrainView, me: SelfSense): Cell | null {
  for (let ty = Math.max(1, me.ty - LOOK_UP); ty < me.ty - 1; ty++) {
    let best: Cell | null = null;
    for (let dx = 0; dx <= LOOK_ACROSS && !best; dx++)
      for (const tx of [me.tx - dx, me.tx + dx]) if (tile(v, tx, ty) === 0 && floorAt(v, tx, ty + 1)) best ??= { tx, ty };
    if (best) return best;
  }
  return null;
}

/** Where `r` stands, as a stand cell: the row over the floor its feet are on. */
const standOf = (r: RunnerSense): Cell => ({ tx: Math.floor(r.x), ty: Math.round(r.y) - 1 });

/** The nearest rival still in it, by tiles across and rows. */
function nearest(v: BrainView, me: SelfSense): RunnerSense | null {
  let best: RunnerSense | null = null;
  let bestD = Infinity;
  for (const r of v.runners) {
    if (!r.alive || r.finished) continue;
    const d = Math.abs(r.x - me.x) + Math.abs(r.y - me.y);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/**
 * Brawl: knock everyone else into the level. It grabs what the arena's boxes hand out and uses it when its tactic
 * says (strategies/items.ts, tactics.ts), and otherwise goes for the nearest rival and walks into them, which shoves
 * on the race's own physics; the motor keeps it off the hazards it would walk into itself. It goes after where the
 * rival last stood, since someone in the air is nowhere to go, and with nobody left to go for it heads to the
 * arena's middle. When the slag pours in late in the round it climbs out of its way first.
 */
export const brawlStrategy: StrategyDef = {
  make(rng, traits) {
    const items = new ItemPlay(rng, traits);
    let mark = -1;
    let until = 0;
    let frame = 0;
    let at: Cell | null = null;
    return {
      think(v, me) {
        frame++;
        // The slag closing in: up out of its way first.
        const up = me.slag !== null && me.slag < SLAG_CLOSE ? highGround(v, me) : null;
        if (up) return { do: 'goTo', ...up };
        const side = items.think(v, me, false);
        if (side) return side;
        let r = v.runners.find((q) => q.slot === mark && q.alive && !q.finished) ?? null;
        if (!r || frame > until) {
          r = nearest(v, me);
          mark = r?.slot ?? -1;
          until = frame + MARK_FRAMES;
          at = null;
        }
        if (r?.grounded) at = standOf(r);
        const { tx, ty } = at ?? aimOf(v.objective);
        return { do: 'goTo', tx, ty };
      },
    };
  },
};
