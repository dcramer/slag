import type { Rng } from '../../core/rng';
import { floorAt, tile } from '../tactics';
import { T_ONEWAY, T_SOLID } from '../../sim/level';
import type { BrainView, Cell, Intent, SelfSense } from '../types';
import { aimOf, Headway } from './headway';
import { ERRANDS, ItemPlay } from './items';
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

/**
 * Tiles of route it goes out of its way for a box or an item: little, since the slag is on the leader's leash and a
 * detour is climb lost. A box on the way it still knocks.
 */
const ERRAND = { ...ERRANDS, detour: 3 };

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

/** Rows under the top of what it sees that it looks through for somewhere to climb to: a few rises' worth. */
const LOOK = 8;
/**
 * Cells it asks the route about, nearest its column on the highest row first: every new cell is a distance field to
 * work out, so few. Past them it takes the highest it saw anyway and lets the motor find the rough way.
 */
const TRIES = 2;
/** Rows its sight must move up before it looks again for somewhere higher: about a rise. */
const RELOOK = 3;

/**
 * Where to climb to when the lap line is out of sight (`BrainView.sight`): the highest stand cell it can see and get to,
 * nearest its column, as a player climbs toward the top edge of the screen and looks again as rows come into view.
 * Null with nothing over it in sight it can get to.
 */
function frontier(v: BrainView, me: SelfSense, col: number): Cell | null {
  const top = Math.max(0, v.sight ?? 0);
  let first: Cell | null = null;
  let tries = TRIES;
  for (let y = top; y < me.ty && y < top + LOOK && tries > 0; y++) {
    let best = -1;
    for (let x = 1; x < v.level.w - 1; x++) if (tile(v, x, y) === 0 && floorAt(v, x, y + 1) && (best < 0 || Math.abs(x - col) < Math.abs(best - col))) best = x;
    if (best < 0) continue;
    first ??= { tx: best, ty: y };
    tries--;
    if (Number.isFinite(v.reach(best, y))) return { tx: best, ty: y };
  }
  return first;
}

/**
 * Rising Slag: climb. Round a loop the objective is the lap line, and crossing it puts the whole climb ahead again,
 * which is a new lap, not a loss. With no loop the top is somewhere to hold: stand on it. On the way it knocks the
 * loop's boxes it passes near and uses what they give when that helps. A stuck bot leaps and tries again; it never
 * gives up into the slag. Round a loop it climbs toward a column of the lap line of its own, a new one each lap. With
 * the leader's screen it sees only what the screen shows: until the lap line comes into view it climbs to the highest
 * place it can see, under its column.
 */
export const slagStrategy: StrategyDef = {
  make(rng, traits) {
    const way = new Headway();
    const items = new ItemPlay(rng, traits, ERRAND);
    let lane: Cell | null = null;
    // Out of sight of the lap line: its column this lap, and where it's climbing to for the sight it last had.
    let col = -1;
    let seen: { sight: number; to: Cell | null } | null = null;
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
          col = -1;
        }
        way.note(me);
        if (me.togo === 0) {
          way.calm();
          return { do: 'wait' };
        }
        // A bump is a move, not an item: whether it goes for one is its taste for getting in the way (`block`).
        const hit = rng.chance(traits.block) ? bump(v, me) : null;
        if (hit) return hit;
        if (way.leapt(me)) way.calm();
        const o = v.objective;
        let aim: Cell | null = null;
        if (o.kind === 'climb' && v.sight !== null && o.lapLine.ty < v.sight) {
          if (col < 0) col = rng.int(LANE_EDGE, v.level.w - 1 - LANE_EDGE);
          if (!seen || v.sight <= seen.sight - RELOOK || v.sight > seen.sight || (seen.to && me.ty <= seen.to.ty))
            seen = { sight: v.sight, to: frontier(v, me, col) };
          // Nothing in sight to get to: up toward the top edge anyway, the rough way, and look again.
          aim = seen.to ?? { tx: col, ty: Math.min(v.level.h - 1, Math.max(0, v.sight)) };
        } else if (o.kind === 'climb' && o.loop && !lane) lane = laneOf(v, rng, o.lapLine);
        const { tx, ty } = aim ?? lane ?? aimOf(o);
        return way.stage(me) === 'leap' ? { do: 'leap', tx, ty } : { do: 'goTo', tx, ty };
      },
    };
  },
};
