import { DT, PHYS, PLAYER_H, TILE } from '../sim/constants';
import { blastThrow, CLOCK, climbTarget, JOLT, ROD, SLICK, yankVx } from '../sim/items';
import { CHECK } from '../sim/collide';
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
/** Rows under its floor a Slippery Slope slicks, past the row it stands on: a rival there is worth pouring on. */
const SPILL_ROWS = [2, SLICK.depth] as const;
/** Rows under its feet a Trickle-Down pours (less a little, for whoever it reaches in the air), and the nearest worth it. */
const JOLT_ROWS = [1, JOLT.depth / TILE - 1] as const;
/** Rows up a Social Climber has to reach to be worth a go: past a jump's own reach. */
const CLIMB_WORTH = 4;

/** A rod's reach in tiles: its line, less a little, past which the lure comes back empty. */
const CAST_RANGE = ROD.range / TILE - 0.5;
/** Tiles the lure flies along before the sketch gives up, and the step it samples at. */
const LINE_STEP = 0.25;
/** A runner's middle, tiles over its feet, and its half-width and height in tiles. */
const MID = PLAYER_H / 2 / TILE;
const HALF_W = 5 / TILE;
const BODY_H = PLAYER_H / TILE;
/** Tiles a clock lands within of a rival for its blast to reach them after it rings, and at least this far off, or it's only dropped at its feet. */
const LOB_NEAR = 2;
const LOB_CLEAR = 1.5;

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

/** Under pressure to get up or on: the slag or the bottom of the screen is close, or it's stuck. */
const pressed = ({ me, stalled }: Moment) => stalled || doomRows(me) < SLAG_NEAR;

/** A swing at whoever is close enough to hit, facing them. */
const swing = (grounded: boolean): ItemTactic => ({
  when({ v, me }) {
    if (grounded && !me.grounded) return null;
    const r = nearest(v, me, (_, dx, dy) => dx <= SWING_REACH && Math.abs(dy) <= 1.25);
    return r && { do: 'use', dir: toward(me, r) };
  },
});

/**
 * Whether a rod cast toward `dir` (slanting up with `up`) snags `r` before it meets rock: the lure's line from the rod's
 * tip, sampled every quarter tile out to the rod's reach, against the rival's box. One-way boards don't stop it.
 */
function lineReaches(v: BrainView, me: SelfSense, r: RunnerSense, dir: -1 | 1, up: boolean): boolean {
  let x = me.x + dir * (6 / TILE);
  let y = me.y - BODY_H + 5 / TILE;
  const sx = dir * (up ? ROD.slantX : 1) * LINE_STEP;
  const sy = -(up ? ROD.slantY : 0) * LINE_STEP;
  for (let d = 0; d <= CAST_RANGE; d += LINE_STEP) {
    if (tile(v, Math.floor(x), Math.floor(y)) === T_SOLID) return false;
    if (Math.abs(x - r.x) <= HALF_W + 0.125 && y >= r.y - BODY_H - 0.125 && y <= r.y + 0.125) return true;
    x += sx;
    y += sy;
  }
  return false;
}

/** No rock on the straight line between two points (tiles): what shields a body from a blast. */
function clearBetween(v: BrainView, ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
  for (let i = 1; i < n; i++) if (tile(v, Math.floor(ax + ((bx - ax) * i) / n), Math.floor(ay + ((by - ay) * i) / n)) === T_SOLID) return false;
  return true;
}

/**
 * Where a clock lobbed toward `dir` (the high lob with `up`) comes down, in tiles: its arc from the hand under the
 * clock's gravity, followed until it meets rock or comes down on a floor, a second at most. A sketch, as `fly` is:
 * it bounces off nothing, and the thrower's own run adds nothing.
 */
function lobLands(v: BrainView, me: SelfSense, dir: -1 | 1, up: boolean): { x: number; y: number } | null {
  let x = me.x;
  let y = me.y - 10 / TILE;
  const vx = (dir * (up ? CLOCK.highVx : CLOCK.vx)) / TILE;
  let vy = -(up ? CLOCK.highVy : CLOCK.vy) / TILE;
  for (let f = 0; f < 60; f++) {
    vy = Math.min(CLOCK.maxFall / TILE, vy + (CLOCK.gravity / TILE) * DT);
    const nx = x + vx * DT;
    const ny = y + vy * DT;
    if (tile(v, Math.floor(nx), Math.floor(ny)) === T_SOLID && tile(v, Math.floor(nx), Math.floor(y)) === T_SOLID) return { x, y };
    // Coming down onto a floor's top (rock or a board): it lands there.
    const row = Math.floor(ny + CLOCK.half / TILE);
    if (vy > 0 && Math.floor(y + CLOCK.half / TILE) < row && floorAt(v, Math.floor(nx), row)) return { x: nx, y: row - CLOCK.half / TILE };
    if (ny >= v.level.h) return null;
    x = nx;
    y = ny;
  }
  return { x, y };
}

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
  // Catch of the Day: cast at a rival the line reaches, straight across or slanting up to one a row up a tile across,
  // the one a yank would pull off into something first.
  rod: {
    when({ v, me }) {
      let best: { r: RunnerSense; up: boolean; kills: boolean } | null = null;
      for (const r of rivals(v)) {
        const dir = toward(me, r);
        if (Math.abs(r.x - me.x) > CAST_RANGE) continue;
        for (const up of [false, true]) {
          if (!lineReaches(v, me, r, dir, up)) continue;
          const hurt = r.hurt ?? 1;
          const kills = knockKills(v, r.x, r.y, yankVx((r.x - me.x) * TILE) * hurt, ROD.lift * hurt, slagRow(me));
          if (!best || (kills && !best.kills) || (kills === best.kills && Math.abs(r.x - me.x) < Math.abs(best.r.x - me.x))) best = { r, up, kills };
          break;
        }
      }
      return best && { do: 'use', dir: toward(me, best.r), ...(best.up && { up: true }) };
    },
  },
  // Rude Awakening: lobbed (high, for a ledge overhead) to come down beside a rival standing on something, no rock
  // between where it lands and them, the one its blast would throw into something first.
  clock: {
    when({ v, me }) {
      let best: { dir: -1 | 1; up: boolean; kills: boolean; d: number } | null = null;
      for (const dir of [-1, 1] as const)
        for (const up of [false, true]) {
          const at = lobLands(v, me, dir, up);
          if (!at || Math.hypot(at.x - me.x, at.y - (me.y - MID)) <= LOB_CLEAR) continue;
          for (const r of rivals(v)) {
            if (!r.grounded) continue;
            const d = Math.hypot(r.x - at.x, r.y - MID - at.y);
            if (d > LOB_NEAR || !clearBetween(v, at.x, at.y, r.x, r.y - MID)) continue;
            const t = blastThrow(at.x * TILE, at.y * TILE, r.x * TILE, (r.y - MID) * TILE);
            const kills = t !== null && knockKills(v, r.x, r.y, t.vx * (r.hurt ?? 1), t.vy * (r.hurt ?? 1), slagRow(me));
            if (!best || (kills && !best.kills) || (kills === best.kills && d < best.d)) best = { dir, up, kills, d };
          }
        }
      return best && { do: 'use', dir: best.dir, ...(best.up && { up: true }) };
    },
  },
  // Slippery Slope: poured from a floor onto the ledges under it while a rival is climbing them. The leader's way to
  // keep it, and anyone's against whoever is below.
  slick: {
    when({ v, me }) {
      if (!me.grounded) return null;
      return rivals(v).some((r) => -rise(me, r) >= SPILL_ROWS[0] && -rise(me, r) <= SPILL_ROWS[1]) ? { do: 'use' } : null;
    },
  },
  // Trickle-Down: stamped while a rival stands on something below, in reach of the shudder.
  jolt: {
    when({ v, me }) {
      return rivals(v).some((r) => r.grounded && -rise(me, r) >= JOLT_ROWS[0] && -rise(me, r) <= JOLT_ROWS[1]) ? { do: 'use' } : null;
    },
  },
  // Social Climber: hooked from a floor on the highest ledge it reaches, when that's higher than a jump goes.
  grapple: {
    when({ v, me }) {
      if (!me.grounded) return null;
      const t = climbTarget((x, y) => tile(v, x, y), me.x * TILE, me.y * TILE, HALF_W * 2 * TILE, BODY_H * TILE, me.facing);
      return t && me.ty - t.ty >= CLIMB_WORTH ? { do: 'use' } : null;
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
  // The blast from a tile off, out from the clock: a bot lobs it short of its rival, so it throws them on away.
  clock: { vx: CLOCK.vxOut * (1 - (1 - CLOCK.edge) / 3), vy: CLOCK.vyOut * (1 - (1 - CLOCK.edge) / 3) },
  // The yank from six tiles off: back toward whoever cast it, so a hit "toward" someone flies them the other way.
  rod: { vx: yankVx(6 * TILE), vy: ROD.lift },
};

/**
 * A shove off whatever edge it ends at, as the mode's bodies shove (`BrainView.shove`): a walker moves a bystander at
 * its `share` of a walk, kept over the drop where the mode carries it, straight down where it doesn't.
 */
const shoveOf = (v: BrainView) => ({ vx: v.shove.carry ? PHYS.walkSpeed * v.shove.share : 0, vy: 0 });

/**
 * Px/s a run-up of a few tiles meets a standing rival at, about: most of a run. What a body check (sim/collide.ts
 * `CHECK`) throws them at follows from it.
 */
const CHARGE_SPEED = 200;

/** Frames a knocked body is followed through the air before it counts as having come down safe. */
const FLIGHT = 90;

/** Cells (y * w + x) the parts and set pieces keep a route out of, one mask per view's parts: what a knock throws someone into. */
const noGoMasks = new WeakMap<readonly PropSense[], Uint8Array>();
function noGoMask(v: BrainView): Uint8Array {
  let m = noGoMasks.get(v.props);
  if (!m) {
    m = new Uint8Array(v.level.w * v.level.h);
    for (const p of v.props) for (const c of p.noGo) m[c] = 1;
    noGoMasks.set(v.props, m);
  }
  return m;
}

/** Whether a part or a set piece hurts at cell (x, y) of `mask`; a mystery box is one too, and only pops an item when it's hit. */
const harms = (v: BrainView, mask: Uint8Array, x: number, y: number) => mask[y * v.level.w + x] === 1 && !v.boxes.some((b) => b.tx === x && b.ty === y);

/** Whether stand cell (tx, ty) is in a part's or a set piece's way: what hurts, pushes or moves there. */
export function hurtsAt(v: BrainView, tx: number, ty: number): boolean {
  const { w, h } = v.level;
  if (tx < 0 || tx >= w) return false;
  const mask = noGoMask(v);
  return (ty >= 0 && ty < h && harms(v, mask, tx, ty)) || (ty >= 1 && ty <= h && harms(v, mask, tx, ty - 1));
}

/** Rows down from its feet to whatever ends a climb under it: the slag or the screen's bottom edge, whichever is nearer; Infinity with neither. */
export const doomRows = (me: SelfSense): number => Math.min(me.slag ?? Infinity, me.screen ?? Infinity);

/** The row a fall ends in as `me` sees it: the slag's, or the screen's bottom edge (`doomRows`); Infinity with neither. */
export const slagRow = (me: SelfSense): number => me.y + doomRows(me);

/** How a knocked body's flight ends: into something that kills, down on a floor, or neither within `FLIGHT` frames. */
type Landing = 'dies' | 'safe' | 'open';

/**
 * A body with its feet at (x, y) tiles, thrown at (vx, vy) px/s (up positive) with nobody at its controls, the way a
 * dazed one flies, followed until it meets something that kills (a part or a set piece that hurts, a side of the
 * map, the pit or the slag at row `slag`) or comes down on a floor. A sketch of the body's flight, not the sim's: its
 * middle column, the dazed body's gravity and air drag, and a wall it meets stopping it dead. `slide`: it comes down
 * still going and skids on along the floor (a body check's victim does) until it stops or goes off the end. `pass`
 * hears each cell the body's column passes through, and the rock cell of a wall it hits.
 */
function fly(v: BrainView, x: number, y: number, vx: number, vy: number, slag: number, pass?: (cx: number, cy: number) => void, slide = false): Landing {
  const { w, h } = v.level;
  const mask = noGoMask(v);
  let px = x * TILE;
  let py = y * TILE;
  let sx = vx;
  let sy = -vy;
  let ground = false;
  for (let f = 0; f < FLIGHT; f++) {
    const decel = ground ? (Math.abs(sx) > PHYS.walkSpeed ? PHYS.runDecel : PHYS.groundDecel) : PHYS.airDecel;
    sx = sx > 0 ? Math.max(0, sx - decel * DT) : Math.min(0, sx + decel * DT);
    if (ground && sx === 0) return 'safe';
    sy = ground ? 0 : Math.min(PHYS.maxFall, sy + PHYS.gravity * (sy > 0 ? PHYS.fallGravityMult : 1) * DT);
    let nx = px + sx * DT;
    let ny = py + sy * DT;
    let cx = Math.floor(nx / TILE);
    if (cx < 0 || cx >= w) return 'dies';
    const top = Math.floor((ny - PLAYER_H) / TILE);
    const bottom = Math.floor((ny - 1) / TILE);
    // A wall across stops it dead, and it drops from there; a ceiling stops its rise.
    if (cx !== Math.floor(px / TILE) && (tile(v, cx, top) === T_SOLID || tile(v, cx, bottom) === T_SOLID)) {
      pass?.(cx, tile(v, cx, bottom) === T_SOLID ? bottom : top);
      sx = 0;
      nx = px;
      cx = Math.floor(px / TILE);
    }
    if (sy < 0 && tile(v, cx, top) === T_SOLID) {
      sy = 0;
      ny = py;
    }
    if (ny >= h * TILE || ny / TILE > slag) return 'dies';
    for (let ty = Math.max(0, top); ty <= Math.min(h - 1, bottom); ty++) {
      if (harms(v, mask, cx, ty)) return 'dies';
      pass?.(cx, ty);
    }
    // Coming down onto a floor: it's down, and safe, or skids on. Skidding off the end, it falls from there.
    const row = Math.floor(ny / TILE);
    if (ground) ground = floorAt(v, cx, row);
    else if (sy > 0 && py <= row * TILE && floorAt(v, cx, row)) {
      if (!slide) return 'safe';
      ground = true;
      ny = row * TILE;
    }
    px = nx;
    py = ny;
  }
  return 'open';
}

/** Whether a body thrown as `fly` throws it meets something that kills before it comes down on a floor (or, sliding, stops on one). */
export function knockKills(v: BrainView, x: number, y: number, vx: number, vy: number, slag: number, slide = false): boolean {
  return fly(v, x, y, vx, vy, slag, undefined, slide) === 'dies';
}

/** Tiles round where a field starts that a knock lane keeps clear of: a part there would catch everyone at GO. */
export const ENDS_CLEAR = 5;

/**
 * Where a part does a brawl's work, best first: the cells (y * w + x) that a body knocked off any stand cell flies
 * through and still comes down safe, by how many knocks pass there, the rock a knock throws it against among them.
 * A hazard there turns a knock someone walks away from into a kill. Only air the knock flies through, never a stand
 * cell where everyone walks, and nothing near where the field starts (`ends`). Made once per level and parts.
 */
export function knockLanes(v: BrainView, ends: readonly { tx: number; ty: number }[]): number[] {
  const { w, h } = v.level;
  const hits = new Map<number, number>();
  const near = (tx: number, ty: number) => ends.some((e) => Math.abs(e.tx - tx) <= ENDS_CLEAR && Math.abs(e.ty - ty) <= ENDS_CLEAR);
  const knock = KNOCKS.sword!;
  for (let ty = 1; ty < h - 1; ty++)
    for (let tx = 0; tx < w; tx++) {
      if (tile(v, tx, ty) === T_SOLID || !floorAt(v, tx, ty + 1)) continue;
      for (const d of [-1, 1] as const) {
        const seen = new Set<number>();
        const land = fly(v, tx + 0.5, ty + 1, d * knock.vx, knock.vy, Infinity, (cx, cy) => {
          if (cx === tx || near(cx, cy) || (tile(v, cx, cy) !== T_SOLID && floorAt(v, cx, cy + 1))) return;
          seen.add(cy * w + cx);
        });
        if (land === 'dies') continue;
        for (const c of seen) hits.set(c, (hits.get(c) ?? 0) + 1);
      }
    }
  return [...hits].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([c]) => c);
}

/**
 * Whether a body check toward `dir` (a run-up into `r`, where the mode has them: `BrainView.shove`) throws them into
 * something that kills, as `me` reads the level: they leave at `CHECK.carry` times the closing speed, with a hop, and
 * skid on where they land (a check throws someone six or seven tiles along a flat floor), farther as they're hurt.
 */
export function checkedInto(v: BrainView, me: SelfSense, r: RunnerSense, dir: -1 | 1): boolean {
  if (!Number.isFinite(v.shove.check) || CHARGE_SPEED < v.shove.check) return false;
  const hurt = r.hurt ?? 1;
  return knockKills(v, r.x, r.y, dir * Math.max(CHECK.kick, CHECK.carry * CHARGE_SPEED) * hurt, CHECK.hop * hurt, slagRow(me), true);
}

/**
 * Whether a hit from `kind` (or a shove, with none) toward `dir` throws `r` into something that kills, as `me` reads the
 * level, as hard as their build-up says (`RunnerSense.hurt`): a hurt rival lines up from more places, so is hit sooner.
 */
export function knockedInto(v: BrainView, me: SelfSense, r: RunnerSense, dir: -1 | 1, kind: ItemKind | null): boolean {
  const k = kind && KNOCKS[kind];
  const hurt = r.hurt ?? 1;
  if (k) return knockKills(v, r.x, r.y, dir * k.vx * hurt, k.vy * hurt, slagRow(me));
  // A shove only matters at an edge or a hazard a step or two away.
  const shove = shoveOf(v);
  const mask = noGoMask(v);
  const ty = Math.round(r.y) - 1;
  for (let i = 1; i <= 2; i++) {
    const x = Math.floor(r.x) + dir * i;
    if (x < 0 || x >= v.level.w) return true;
    if (tile(v, x, ty) === T_SOLID) return false;
    if (ty >= 0 && harms(v, mask, x, ty)) return true;
    if (!floorAt(v, x, ty + 1)) return knockKills(v, x + 0.5, r.y, dir * shove.vx, shove.vy, slagRow(me));
  }
  return false;
}
