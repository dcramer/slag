import { DT, PHYS, PLAYER_H, TILE } from '../sim/constants';
import { BAT, GLOVE, PUCK, SWORD } from '../sim/items/roster';
import type { ItemKind } from '../sim/items/types';
import { T_ONEWAY, T_SOLID } from '../sim/level';
import type { BrainView, Intent, PropSense, RunnerSense, SelfSense } from './types';

/**
 * When each held item is worth using, as a player would judge it from the screen: one entry per item, so a new item
 * is one entry here (typecheck asks for it). A tactic reads only the view and says whether to press use now, and
 * which way to face; the strategy decides whether the bot is quick enough to see it (`Personality.knack`).
 */

/** What a bot weighs its item by: what it sees, and how its race is going. */
export interface Moment {
  v: BrainView;
  me: SelfSense;
  /** It hasn't got any closer to its objective for a while. */
  stalled: boolean;
}

export type Use = Extract<Intent, { do: 'use' }>;

export interface ItemTactic {
  /** Press use now (and how), or null to hold on to it. */
  when(m: Moment): Use | null;
}

/** Rows of slag under its feet that count as close: time to get up, whatever it costs. */
const SLAG_NEAR = 6;
/** Rows a jetpack lifts its feet, about, where something to land on must be: past a full jump, short of its apex. */
const ROCKET_RISE = [4, 7] as const;
/** Tiles a thrown or kicked shot is worth aiming across. */
const THROW_RANGE = 9;
const KICK_RANGE = 12;
/** Tiles a swing reaches, about: a body and a bit either way. */
const SWING_REACH = 1.75;
/** Tiles out a smoke bomb is worth lobbing at someone: it lands a few tiles ahead. */
const LOB_RANGE = [2, 7] as const;
/** Tiles a Sucker Punch reaches, about: its glove's reach and a body. */
const PUNCH_REACH = 3.5;
/** Where an Upper Hand reaches: rows up (it rises about 20) and tiles across (it leans about two on the way). */
const PUNCH_RISE = [1.5, 16] as const;
const PUNCH_ACROSS = 2.5;

/** The tile at (x, y): off the sides is rock, above and below (a loop's next lap) is air. */
export function tile(v: BrainView, x: number, y: number): number {
  const { w, h, tiles } = v.level;
  if (x < 0 || x >= w) return T_SOLID;
  if (y < 0 || y >= h) return 0;
  return tiles[y * w + x];
}

export const floorAt = (v: BrainView, x: number, y: number) => {
  const t = tile(v, x, y);
  return t === T_SOLID || t === T_ONEWAY;
};

/** A stand cell: open, over a floor. */
const standable = (v: BrainView, x: number, y: number) => tile(v, x, y) !== T_SOLID && floorAt(v, x, y + 1);

/** Rivals still racing. */
const rivals = (v: BrainView) => v.runners.filter((r) => r.alive && !r.finished);

/** Rows `r` stands above `me` (negative: below). */
const rise = (me: SelfSense, r: RunnerSense) => r.up - me.up;

const toward = (me: SelfSense, r: RunnerSense): -1 | 1 => (r.x < me.x ? -1 : 1);

/** No rock along row `y` between columns `a` and `b`: a shot along it gets there. */
function clearRow(v: BrainView, a: number, b: number, y: number): boolean {
  for (let x = Math.min(a, b); x <= Math.max(a, b); x++) if (tile(v, x, y) === T_SOLID) return false;
  return true;
}

/** The nearest rival matching `fits`, by tiles across. */
function nearest(v: BrainView, me: SelfSense, fits: (r: RunnerSense, dx: number, dy: number) => boolean): RunnerSense | null {
  let best: RunnerSense | null = null;
  for (const r of rivals(v)) {
    const dx = Math.abs(r.x - me.x);
    if (fits(r, dx, rise(me, r)) && (!best || dx < Math.abs(best.x - me.x))) best = r;
  }
  return best;
}

/**
 * Somewhere to land a jetpack's burst: a stand cell 4 to 7 rows up in its own column or the next, with no rock
 * between, the column the burst should lean to (0 straight up), or null.
 */
function lift(v: BrainView, me: SelfSense): -1 | 0 | 1 | null {
  for (const dx of [0, me.facing, me.facing === 1 ? -1 : 1] as const) {
    const x = me.tx + dx;
    for (let k = 1; k <= ROCKET_RISE[1]; k++) {
      const y = me.ty - k;
      if (tile(v, x, y) === T_SOLID || tile(v, me.tx, y) === T_SOLID) break;
      if (k >= ROCKET_RISE[0] && standable(v, x, y)) return dx;
    }
  }
  return null;
}

/** Under pressure to get up or on: the slag is close, or it's stuck. */
const pressed = ({ me, stalled }: Moment) => stalled || (me.slag !== null && me.slag < SLAG_NEAR);

/** A swing at whoever is close enough to hit, facing them. */
const swing = (grounded: boolean): ItemTactic => ({
  when({ v, me }) {
    if (grounded && !me.grounded) return null;
    const r = nearest(v, me, (_, dx, dy) => dx <= SWING_REACH && Math.abs(dy) <= 1.25);
    return r && { do: 'use', dir: toward(me, r) };
  },
});

export const ITEM_TACTICS: Record<ItemKind, ItemTactic> = {
  // The noodle: swing at anyone within reach.
  sword: swing(false),
  // The bat roots it while it winds up, so only from the ground; a full wind-up lets go by itself.
  bat: swing(true),
  // Bubble Wrap: carried, it pops instead of the bot. Never let go of it.
  shield: { when: () => null },
  // The jetpack: when the slag is close or no way on is in reach, and there's something above to land on.
  rocket: {
    when(m) {
      const { v, me } = m;
      if (!me.grounded || !pressed(m)) return null;
      const lean = lift(v, me);
      return lean === null ? null : { do: 'use', ...(lean !== 0 && { dir: lean }) };
    },
  },
  // The Pocket Block: a step under its feet at the top of a jump, when it's stuck under a ledge or the slag is close.
  block: {
    when(m) {
      const { me } = m;
      if (me.grounded || me.wall !== 0 || me.lift !== 'level' || !pressed(m)) return null;
      return { do: 'use' };
    },
  },
  // The winged shell hunts the leader, so it's for whoever is behind.
  tax: { when: ({ v, me }) => (me.rank > 0 && rivals(v).length > 0 ? { do: 'use' } : null) },
  // The Stunnerang: at a rival in range across, level or a little above (thrown high).
  boomerang: {
    when({ v, me }) {
      const r = nearest(v, me, (q, dx, dy) => dx <= THROW_RANGE && dy >= -1 && dy <= dx * 0.45 + 1 && (dy > 1 || clearRow(v, me.tx, Math.floor(q.x), me.ty)));
      return r && { do: 'use', dir: toward(me, r), ...(rise(me, r) > 1 && { up: true }) };
    },
  },
  // The Evicted Shell skims the ground: at a rival on the same floor with nothing between.
  puck: {
    when({ v, me }) {
      if (!me.grounded) return null;
      const r = nearest(v, me, (q, dx, dy) => dx <= KICK_RANGE && Math.abs(dy) <= 0.5 && clearRow(v, me.tx, Math.floor(q.x), me.ty));
      return r && { do: 'use', dir: toward(me, r) };
    },
  },
  // Fog of War: lobbed a few tiles out, onto a rival there.
  smoke: {
    when({ v, me }) {
      const r = nearest(v, me, (_, dx, dy) => dx >= LOB_RANGE[0] && dx <= LOB_RANGE[1] && Math.abs(dy) <= 2);
      return r && { do: 'use', dir: toward(me, r) };
    },
  },
  // The Sucker Punch: a long swing, at a rival level with it and up to its reach across.
  glove: {
    when({ v, me }) {
      const r = nearest(v, me, (_, dx, dy) => dx <= PUNCH_REACH && Math.abs(dy) <= 1.25);
      return r && { do: 'use', dir: toward(me, r) };
    },
  },
  // The Queue Jumper trades places with whoever is just ahead: worth it from anywhere but the front.
  hook: { when: ({ v, me }) => (me.rank > 0 && rivals(v).length > 0 ? { do: 'use' } : null) },
  // The Upper Hand flies straight up: at a rival above, about over its head.
  upper: {
    when({ v, me }) {
      const r = nearest(v, me, (_, dx, dy) => dx <= PUNCH_ACROSS && dy >= PUNCH_RISE[0] && dy <= PUNCH_RISE[1]);
      return r && { do: 'use' };
    },
  },
  // The Tremor Brick bonks every rival standing on something when it comes down.
  tremor: { when: ({ v }) => (rivals(v).some((r) => r.grounded) ? { do: 'use' } : null) },
};

// ---------------------------------------------------------------- brawl: knocking someone into something

/**
 * What a hit from each knocking item throws its victim at, px/s across and up (sim/items/roster.ts, the shots'
 * share of their speed in sim/props/ammo.ts): what a brawl lines its rival up by. The bat's is its full charge, the
 * swing a bot lets go by itself.
 */
export const KNOCKS: Partial<Record<ItemKind, { vx: number; vy: number }>> = {
  sword: { vx: SWORD.knockVx, vy: SWORD.knockVy },
  bat: { vx: SWORD.knockVx * BAT.full, vy: SWORD.knockVy * BAT.lift },
  glove: { vx: SWORD.knockVx * GLOVE.power, vy: SWORD.knockVy * GLOVE.lift },
  puck: { vx: PUCK.speed * 0.9, vy: 220 },
  boomerang: { vx: 300, vy: 220 },
};

/** A shove: a walk's worth off whatever edge it ends at. */
const SHOVE = { vx: PHYS.walkSpeed * 0.6, vy: 0 } as const;

/** Frames a knocked body is followed through the air before it counts as having come down safe. */
const FLIGHT = 90;

/** Cells (y * w + x) the parts and set pieces keep a route out of, one mask per view's parts: what a knock throws someone into. */
const noGoMasks = new WeakMap<readonly PropSense[], Uint8Array>();
function noGoMask(v: BrainView): Uint8Array {
  let m = noGoMasks.get(v.props);
  if (!m) {
    m = new Uint8Array(v.level.w * v.level.h);
    for (const p of v.props) for (const c of p.noGo) m[c] = 1;
    // A mystery box is a set piece too, and only pops an item when it's hit.
    for (const b of v.boxes) m[b.ty * v.level.w + b.tx] = 0;
    noGoMasks.set(v.props, m);
  }
  return m;
}

/** The slag's row as `me` sees it (rows down from its feet), or Infinity with none. */
export const slagRow = (me: SelfSense): number => (me.slag === null ? Infinity : me.y + me.slag);

/**
 * Whether a body with its feet at (x, y) tiles, thrown at (vx, vy) px/s (up positive) with nobody at its controls,
 * the way a dazed one flies, meets something that kills before it comes down on a floor: a part or a set piece that
 * hurts, a side of the map, the pit or the slag at row `slag`. A sketch of the body's flight, not the sim's: its
 * middle column, the dazed body's gravity and air drag, and a wall it meets stopping it dead.
 */
export function knockKills(v: BrainView, x: number, y: number, vx: number, vy: number, slag: number): boolean {
  const { w, h } = v.level;
  const mask = noGoMask(v);
  let px = x * TILE;
  let py = y * TILE;
  let sx = vx;
  let sy = -vy;
  for (let f = 0; f < FLIGHT; f++) {
    sx = sx > 0 ? Math.max(0, sx - PHYS.airDecel * DT) : Math.min(0, sx + PHYS.airDecel * DT);
    sy = Math.min(PHYS.maxFall, sy + PHYS.gravity * (sy > 0 ? PHYS.fallGravityMult : 1) * DT);
    let nx = px + sx * DT;
    let ny = py + sy * DT;
    let cx = Math.floor(nx / TILE);
    if (cx < 0 || cx >= w) return true;
    const top = Math.floor((ny - PLAYER_H) / TILE);
    const bottom = Math.floor((ny - 1) / TILE);
    // A wall across stops it dead, and it drops from there; a ceiling stops its rise.
    if (cx !== Math.floor(px / TILE) && (tile(v, cx, top) === T_SOLID || tile(v, cx, bottom) === T_SOLID)) {
      sx = 0;
      nx = px;
      cx = Math.floor(px / TILE);
    }
    if (sy < 0 && tile(v, cx, top) === T_SOLID) {
      sy = 0;
      ny = py;
    }
    if (ny >= h * TILE || ny / TILE > slag) return true;
    for (let ty = Math.max(0, top); ty <= Math.min(h - 1, bottom); ty++) if (mask[ty * w + cx]) return true;
    // Coming down onto a floor: it's down, and safe.
    const row = Math.floor(ny / TILE);
    if (sy > 0 && py <= row * TILE && floorAt(v, cx, row)) return false;
    px = nx;
    py = ny;
  }
  return false;
}

/** Whether a hit from `kind` (or a shove, with none) toward `dir` throws `r` into something that kills, as `me` reads the level. */
export function knockedInto(v: BrainView, me: SelfSense, r: RunnerSense, dir: -1 | 1, kind: ItemKind | null): boolean {
  const k = (kind && KNOCKS[kind]) || SHOVE;
  if (k !== SHOVE) return knockKills(v, r.x, r.y, dir * k.vx, k.vy, slagRow(me));
  // A shove only matters at an edge or a hazard a step or two away.
  const mask = noGoMask(v);
  const ty = Math.round(r.y) - 1;
  for (let i = 1; i <= 2; i++) {
    const x = Math.floor(r.x) + dir * i;
    if (x < 0 || x >= v.level.w) return true;
    if (tile(v, x, ty) === T_SOLID) return false;
    if (ty >= 0 && mask[ty * v.level.w + x]) return true;
    if (!floorAt(v, x, ty + 1)) return knockKills(v, x + 0.5, r.y, dir * SHOVE.vx, 0, slagRow(me));
  }
  return false;
}
