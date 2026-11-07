import type { Rng } from '../../core/rng';
import { isProtected, type Level, LOOP_BAND, T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import { footprintCells, type PlacedProp, type PropDef } from '../../sim/props';
import type { ItemDeal } from '../../sim/items/types';

/**
 * Mystery boxes a level is built with when its mode asks (game/modes.ts `boxes`: a Rising Slag loop, a brawl's
 * arena), as SpeedRunners' tracks have their item boxes: placed by the level, not by players, so every round has
 * items. Each hangs over a floor where someone standing under it can knock it from below, a few apart, and round a
 * loop off the seam's band. They deal by rank from the mode's table (`ItemDeal`, sim/props/modules/mystery.ts): catch-up
 * items to whoever is behind, a defensive one to the leader.
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

/** A loop's box as a level piece: one solid crate cell at (tx, ty) that refills forever and deals by rank from `deal`. */
function boxAt(tx: number, ty: number, seed: number, deal: ItemDeal): PropDef {
  return {
    key: 'loop-box',
    name: 'Loot Box',
    maker: 'the level',
    archetype: 'mystery',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [{ type: 'mystery', cells: [[tx, ty]], pool: [...deal.chase], uses: 0, refill: REFILL, look: 'crate', seed, deal }],
    footprint: [[tx, ty]],
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
): PlacedProp[] {
  const loop = level.loop;
  const taken = new Set(pieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * level.w + x)));
  const spots: [number, number][] = [];
  const [y0, y1] = loop ? [LOOP_BAND, loop + LOOP_BAND] : [2, level.h];
  for (let y = y0; y + 3 < y1; y++) for (let x = 3; x < level.w - 3; x++) if (hangs(level, x, y, taken, stands)) spots.push([x, y]);
  rng.shuffle(spots);
  // An arena's boxes hang nearest the tier the field starts on first, so the first items are a short way off.
  if (stands) {
    const tier = (y: number) => Math.round(Math.abs(y + 2 - level.spawn.ty) / 4);
    spots.sort((a, b) => tier(a[1]) - tier(b[1]));
  }
  const want = loop ? Math.max(2, Math.round(loop / ROWS_PER_BOX)) : Math.max(2, Math.round(level.w / COLS_PER_BOX));
  // Round a loop apart in rows, so they spread up it; in an arena apart in columns, so they spread across it.
  const apart = (b: PlacedProp, x: number, y: number) =>
    loop ? Math.abs(b.def.footprint[0][1] - y) >= MIN_APART : Math.abs(b.def.footprint[0][0] - x) >= MIN_APART;
  const out: PlacedProp[] = [];
  const at = (x: number, y: number): PlacedProp => ({ uid: 0, def: boxAt(x, y, rng.int(0, 1 << 20), deal), owner: -1, tx: 0, ty: 0, rot: 0 });
  if (stands) {
    // An arena's ends are mirrored, and so are its boxes: a pair, one each side, then one in the middle, so neither
    // end is nearer its first item. With no spot in the middle, another pair. `add(x, y, true)` hangs one alone.
    const { w } = level;
    const mirrorOf = (x: number) => w - 1 - x;
    const isMiddle = (x: number) => Math.abs(x - mirrorOf(x)) <= 2;
    const add = (x: number, y: number, middle: boolean, apart = MIN_APART) => {
      const xs = middle ? [x] : [x, mirrorOf(x)];
      if (!xs.every((bx) => out.every((o) => Math.abs(o.def.footprint[0][0] - bx) >= apart))) return;
      if (!middle && (x * 2 >= w - MIN_APART || !hangs(level, mirrorOf(x), y, taken, stands))) return;
      const boxes = xs.map((bx) => at(bx, y));
      if (keep([...pieces, ...out, ...boxes])) out.push(...boxes);
    };
    for (const [x, y] of spots) if (out.length < want - 1 && !isMiddle(x)) add(x, y, false);
    for (const [x, y] of spots) if (out.length < want && isMiddle(x)) add(x, y, true);
    for (const [x, y] of spots) if (out.length < want && !isMiddle(x)) add(x, y, false);
    // The set pieces went in first and aren't mirrored, so a spot's mirror may be taken, and a set piece may stand in
    // the middle: then the spot nearest the middle, unpaired, and if need be a little closer to the others, so an arena
    // never deals from fewer than `want`.
    const byMiddle = [...spots].sort((a, b) => Math.abs(2 * a[0] - (w - 1)) - Math.abs(2 * b[0] - (w - 1)));
    for (const apart of [MIN_APART, CLOSE_APART]) for (const [x, y] of byMiddle) if (out.length < want) add(x, y, true, apart);
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
