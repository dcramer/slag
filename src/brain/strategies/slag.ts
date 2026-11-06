import type { Rng } from '../../core/rng';
import { floorAt, tile } from '../tactics';
import { T_ONEWAY, T_SOLID } from '../../sim/level';
import type { BrainView, Cell, Intent, SelfSense } from '../types';
import { aimOf, Headway } from './headway';
import { ItemPlay } from './items';
import type { StrategyDef } from './types';

/** How much further the route gets at once for a bot to take it as a loop's lap line crossed (route tiles, rounded as `togo` is). */
const LAP_RESET = 8;

/** Rows up, and tiles across, a rival on a board can be for a hop to bump them: a jump's reach, about under them. */
const BUMP_ROWS = [0.9, 3.2] as const;
const BUMP_ACROSS = 0.75;

/**
 * Whoever is behind bumps a rival standing on a board just over its head: a hop up through the board knocks them off
 * (sim/collide.ts `BUMP`). Only through a board, which it can jump up through, with nothing solid in between.
 */
function bump(v: BrainView, me: SelfSense): Intent | null {
  if (me.rank === 0 || !me.grounded) return null;
  for (const r of v.runners) {
    const up = me.y - r.y;
    if (!r.alive || r.finished || !r.grounded || up < BUMP_ROWS[0] || up > BUMP_ROWS[1] || Math.abs(r.x - me.x) > BUMP_ACROSS) continue;
    const tx = Math.floor(r.x);
    const floor = Math.round(r.y);
    if (tile(v, tx, floor) !== T_ONEWAY) continue;
    let clear = true;
    for (let y = floor + 1; y < me.ty; y++) if (tile(v, tx, y) === T_SOLID || tile(v, me.tx, y) === T_SOLID) clear = false;
    if (clear) return { do: 'hop', tx };
  }
  return null;
}

/** Columns off each wall a lane keeps: the shaft's walls and the spawn pocket under the lap line. */
const LANE_EDGE = 3;

/**
 * Where on the lap line to climb for this lap: any open cell over a floor will do, since the lap is crossed anywhere
 * along it, so each bot picks its own and a pack spreads over the shaft rather than queueing up one line.
 */
function laneOf(v: BrainView, rng: Rng, line: Cell): Cell {
  for (let tries = 0; tries < 8; tries++) {
    const tx = rng.int(LANE_EDGE, v.level.w - 1 - LANE_EDGE);
    if (tile(v, tx, line.ty) === 0 && floorAt(v, tx, line.ty + 1)) return { tx, ty: line.ty };
  }
  return line;
}

/**
 * Rising Slag: climb. Round a loop the objective is the lap line, and crossing it puts the whole climb ahead again,
 * which is a new lap, not a loss. With no loop the top is somewhere to hold: stand on it. On the way it knocks the
 * loop's boxes it passes near and uses what they give when that helps. A stuck bot leaps and tries again; it never
 * gives up into the slag. Round a loop it climbs toward a column of the lap line of its own, a new one each lap.
 */
export const slagStrategy: StrategyDef = {
  make(rng, traits) {
    const way = new Headway();
    const items = new ItemPlay(rng, traits);
    let lane: Cell | null = null;
    return {
      think(v, me) {
        const side = items.think(v, me, way.stalled());
        if (side) {
          if (items.away) way.calm();
          return side;
        }
        if (Number.isFinite(me.togo) && Number.isFinite(way.best) && me.togo > way.best + LAP_RESET) {
          way.restart(me.togo);
          lane = null;
        }
        way.note(me);
        if (me.togo === 0) {
          way.calm();
          return { do: 'wait' };
        }
        const hit = rng.chance(traits.knack) ? bump(v, me) : null;
        if (hit) return hit;
        if (way.leapt(me)) way.calm();
        const o = v.objective;
        if (o.kind === 'climb' && o.loop && !lane) lane = laneOf(v, rng, o.lapLine);
        const { tx, ty } = lane ?? aimOf(o);
        return way.stage(me) === 'leap' ? { do: 'leap', tx, ty } : { do: 'goTo', tx, ty };
      },
    };
  },
};
