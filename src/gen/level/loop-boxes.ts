import type { Rng } from '../../core/rng';
import { isProtected, type Level, LOOP_BAND, T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import { footprintCells, type PlacedProp, type PropDef } from '../../sim/props';
import type { ItemDeal } from '../../sim/items/types';
import { harmed } from './harm';

/**
 * Mystery boxes a level is built with when its mode asks (game/modes.ts `boxes`: a Rising Slag loop, a brawl's
 * arena), as SpeedRunners' tracks have their item boxes: placed by the level, not by players, so every round has
 * items. Each hangs over a floor where someone standing under it can knock it from below, a few apart, and round a
 * loop off the seam's band. They deal by rank from the mode's table (`ItemDeal`, sim/props/modules/mystery.ts): catch-up
 * items to whoever is behind, a defensive one to the leader. A level whose profile asks for `stands` (a brawl's) gets
 * item stands on the same spots instead, each on the floor under where its box would hang (sim/props/modules/stand.ts):
 * the party brawler's weapon spawners, showing what they hold, taken by walking in, filling again a few seconds on.
 */

/** Rows of shaft per box: about one every two storeys. */
const ROWS_PER_BOX = 12;
/** Columns of an arena per box: about one a screen-third. */
const COLS_PER_BOX = 16;
/** Rows (round a loop) or columns (an arena) apart two boxes must be, so they spread out. */
const MIN_APART = 9;
/** Columns apart an arena's last box may be from the others when its set pieces leave it no room `MIN_APART` off. */
const CLOSE_APART = 5;
/** Frames a loop's box takes to fill again: about a lap's worth of climbing behind you. */
const REFILL = 5 * 60;

/**
 * Frames a stand takes to show a fresh item once one is taken: where everyone's second weapon comes from, the starter
 * being good for one go (game/modes.ts). Four Normal bots on 96 bare arenas: at 5 s, 43 rounds in 15–30 s and 41
 * under 15; at 3 s, 33 and 52 (rounds 17.5 s); at 8 s, 35 and 44, more running past 30 s.
 */
const STAND_REFILL = 5 * 60;

/**
 * A level's box as a level piece: one solid crate cell at (tx, ty) that refills forever and deals by rank from `deal`;
 * or with `stand`, an item stand on the floor two rows under it, holding what `deal` deals. Both are keyed `loop-box`:
 * a builder's `boxes` (and everything that counts them) counts either.
 */
function boxAt(tx: number, ty: number, seed: number, deal: ItemDeal, stand: boolean): PropDef {
  const cell: [number, number] = stand ? [tx, ty + 2] : [tx, ty];
  return {
    key: 'loop-box',
    name: stand ? 'Weapon Stand' : 'Loot Box',
    maker: 'the level',
    archetype: 'mystery',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [
      stand
        ? { type: 'stand', cells: [cell], pool: [...deal.chase], refill: STAND_REFILL, seed }
        : { type: 'mystery', cells: [cell], pool: [...deal.chase], uses: 0, refill: REFILL, look: 'crate', seed, deal },
    ],
    footprint: [cell],
  };
}

/**
 * Where a box can hang: an empty cell with open air either side, over two rows of headroom and a floor (solid or
 * one-way) under them. Three rows up is head height for a hop from the floor, and a full jump lands on its top,
 * where what it pops comes to rest: any higher and nobody could reach the item.
 */
function hangs(level: Level, x: number, y: number, taken: ReadonlySet<number>, stands?: ReadonlySet<number>): boolean {
  const { w } = level;
  const at = (cx: number, cy: number) => level.tiles[cy * w + cx];
  if (taken.has(y * w + x) || isProtected(level, x, y) || isProtected(level, x, y + 2)) return false;
  // In an arena, room on top of the box too: what it pops rests there, and someone has to get up to it.
  if (stands && (!stands.has((y + 2) * w + x) || y < 2 || at(x, y - 1) !== T_EMPTY || at(x, y - 2) !== T_EMPTY)) return false;
  for (let dy = 0; dy <= 2; dy++) if (at(x, y + dy) !== T_EMPTY) return false;
  if (at(x - 1, y) !== T_EMPTY || at(x + 1, y) !== T_EMPTY) return false;
  const floor = at(x, y + 3);
  return floor === T_SOLID || floor === T_ONEWAY;
}

/**
 * Where a stand can go for the spot whose box would hang at row `y`: on the floor two rows under it, a cell the field
 * stands in (`stands`), with a free cell over it where what it holds floats, off the spawns' pockets. It needs none of a
 * box's headroom: nobody hops for it.
 */
function standsAt(level: Level, x: number, y: number, taken: ReadonlySet<number>, stands: ReadonlySet<number>): boolean {
  const { w } = level;
  const sy = y + 2;
  return stands.has(sy * w + x) && !taken.has(sy * w + x) && !isProtected(level, x, sy) && level.tiles[(sy - 1) * w + x] === T_EMPTY;
}

/**
 * A level's own boxes, among its set pieces `pieces` (kept clear of their cells), each one kept only if `keep` says
 * the level still plays with it in place. Round a loop they go up the shaft, off the seam's band, about one every two
 * storeys; anywhere else (an arena) across the level, about one a screen-third.
 */
export function loopBoxes(
  level: Level,
  pieces: readonly PlacedProp[],
  keep: (pieces: readonly PlacedProp[]) => boolean,
  rng: Rng,
  deal: ItemDeal,
  /**
   * An arena's: the stand cells the field reaches (y * w + x). Its boxes hang only over those, with room on top for
   * what they pop, nearest the spawns' tier first, in mirrored pairs. Absent (a loop): over any floor.
   */
  stands?: ReadonlySet<number>,
  /** Item stands on the floor under each spot rather than boxes hanging there (the profile's `stands`). */
  asStands = false,
  /**
   * An arena's: where its set pieces reach (./harm.ts `harmReach`). No box or stand goes where taking from it means
   * standing in a piece, in its hazard's way or in a gun's line; the placer takes another spot.
   */
  harm?: ReadonlySet<number>,
): PlacedProp[] {
  const loop = level.loop;
  const { w } = level;
  const taken = new Set(pieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * w + x)));
  /** The row of the cell the piece itself takes for the spot at row y: the box there, or the stand on the floor under it. */
  const cellY = (y: number) => (asStands ? y + 2 : y);
  const fits = (x: number, y: number) =>
    (asStands && stands ? standsAt(level, x, y, taken, stands) : hangs(level, x, y, taken, stands)) && !(harm && harmed(harm, w, x, cellY(y)));
  const spots: [number, number][] = [];
  const [y0, y1] = loop ? [LOOP_BAND, loop + LOOP_BAND] : [2, level.h];
  for (let y = y0; y + 3 < y1; y++) for (let x = 3; x < w - 3; x++) if (fits(x, y)) spots.push([x, y]);
  rng.shuffle(spots);
  // An arena's boxes hang nearest the tier the field starts on first, so the first items are a short way off.
  if (stands) {
    const tier = (y: number) => Math.round(Math.abs(y + 2 - level.spawn.ty) / 4);
    spots.sort((a, b) => tier(a[1]) - tier(b[1]));
  }
  const want = loop ? Math.max(2, Math.round(loop / ROWS_PER_BOX)) : Math.max(2, Math.round(w / COLS_PER_BOX));
  // Round a loop apart in rows, so they spread up it; in an arena apart in columns, so they spread across it.
  const apart = (b: PlacedProp, x: number, y: number) =>
    loop ? Math.abs(b.def.footprint[0][1] - y) >= MIN_APART : Math.abs(b.def.footprint[0][0] - x) >= MIN_APART;
  const out: PlacedProp[] = [];
  const at = (x: number, y: number): PlacedProp => ({ uid: 0, def: boxAt(x, y, rng.int(0, 1 << 20), deal, asStands), owner: -1, tx: 0, ty: 0, rot: 0 });
  if (stands) {
    // An arena's ends are mirrored, and so are its boxes (`unmirrored`): a pair, one each side, then one on the
    // middle, so neither end is nearer its first item. With no spot on the middle, another pair.
    const add = (x: number, y: number, middle: boolean, room: number) => {
      const xs = middle ? [x] : [x, w - 1 - x];
      if (!xs.every((bx) => out.every((o) => Math.abs(o.def.footprint[0][0] - bx) >= room))) return;
      if (!middle && (x * 2 >= w - room || !fits(w - 1 - x, y))) return;
      const boxes = xs.map((bx) => at(bx, y));
      if (keep([...pieces, ...out, ...boxes])) out.push(...boxes);
    };
    // The set pieces went in first and aren't mirrored, so a spot's mirror may be taken and so may the middle: then
    // a little closer to the others, so an arena deals from `want` wherever its pieces leave room for it.
    for (const room of [MIN_APART, CLOSE_APART]) {
      for (const [x, y] of spots) if (out.length < want - 1 && !onAxis(w, x)) add(x, y, false, room);
      for (const [x, y] of spots) if (out.length < want && onAxis(w, x)) add(x, y, true, room);
      for (const [x, y] of spots) if (out.length < want && !onAxis(w, x)) add(x, y, false, room);
    }
    return out;
  }
  for (const [x, y] of spots) {
    if (out.length >= want) break;
    if (!out.every((b) => apart(b, x, y))) continue;
    const box = at(x, y);
    if (keep([...pieces, ...out, box])) out.push(box);
  }
  return out;
}

/** Is column `x` on the middle of a level `w` wide: the middle column, or either of the two either side of the line. */
const onAxis = (w: number, x: number) => Math.abs(2 * x - (w - 1)) <= 1;

/** Where an arena's boxes break its mirror: each one with no partner across the middle, unless it's on the middle. */
export function unmirrored(w: number, cells: readonly (readonly [number, number])[]): string[] {
  const has = (x: number, y: number) => cells.some(([cx, cy]) => cx === x && cy === y);
  return cells.filter(([x, y]) => !onAxis(w, x) && !has(w - 1 - x, y)).map(([x, y]) => `${x},${y} has no partner at ${w - 1 - x},${y}`);
}
