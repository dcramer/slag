import type { Rng } from '../../core/rng';
import { isProtected, type Level, LOOP_BAND, T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import { footprintCells, type PlacedProp, type PropDef } from '../../sim/props';
import { ITEM_KINDS } from '../../sim/items/types';

/**
 * Mystery boxes a Rising Slag loop is built with (game/modes.ts), as SpeedRunners' tracks have their item boxes:
 * placed by the level, not by players, so every round has items and every lap passes them. Each hangs over a
 * floor where a climber standing under it can knock it from below, a few apart up the shaft, off the seam's band
 * and out of perch wells. They deal by rank (`catchUp`, sim/props/modules/mystery.ts): catch-up items to whoever is
 * behind, a defensive one to the leader.
 */

/** Rows of shaft per box: about one every two storeys. */
const ROWS_PER_BOX = 12;
/** Rows apart two boxes must be, so they spread up the loop. */
const MIN_APART = 9;
/** Frames a loop's box takes to fill again: about a lap's worth of climbing behind you. */
const REFILL = 5 * 60;

/** A loop's box as a level piece: one solid crate cell at (tx, ty) that refills forever and deals by rank. */
function boxAt(tx: number, ty: number, seed: number): PropDef {
  return {
    key: 'loop-box',
    name: 'Loot Box',
    maker: 'the level',
    archetype: 'mystery',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [{ type: 'mystery', cells: [[tx, ty]], pool: [...ITEM_KINDS], uses: 0, refill: REFILL, look: 'crate', seed, catchUp: true }],
    footprint: [[tx, ty]],
  };
}

/**
 * Where a box can hang: an empty cell with open air either side and two rows under it, over a stand cell on a floor
 * (solid or one-way), so a climber knocks it from below without it walling a jump off.
 */
function hangs(level: Level, x: number, y: number, taken: ReadonlySet<number>): boolean {
  const { w } = level;
  const at = (cx: number, cy: number) => level.tiles[cy * w + cx];
  if (taken.has(y * w + x) || isProtected(level, x, y) || isProtected(level, x, y + 3)) return false;
  for (let dy = 0; dy <= 3; dy++) if (at(x, y + dy) !== T_EMPTY) return false;
  if (at(x - 1, y) !== T_EMPTY || at(x + 1, y) !== T_EMPTY) return false;
  const floor = at(x, y + 4);
  return floor === T_SOLID || floor === T_ONEWAY;
}

/**
 * A loop's boxes, among the level's set pieces `pieces` (kept clear of their cells), each one kept only if `keep`
 * says the lap still climbs with it in place.
 */
export function loopBoxes(level: Level, pieces: readonly PlacedProp[], keep: (pieces: readonly PlacedProp[]) => boolean, rng: Rng): PlacedProp[] {
  const loop = level.loop;
  if (!loop) return [];
  const taken = new Set(pieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * level.w + x)));
  const spots: [number, number][] = [];
  for (let y = LOOP_BAND; y + 4 < loop + LOOP_BAND; y++) for (let x = 3; x < level.w - 3; x++) if (hangs(level, x, y, taken)) spots.push([x, y]);
  rng.shuffle(spots);
  const want = Math.max(2, Math.round(loop / ROWS_PER_BOX));
  const out: PlacedProp[] = [];
  for (const [x, y] of spots) {
    if (out.length >= want) break;
    if (out.some((b) => Math.abs(b.def.footprint[0][1] - y) < MIN_APART)) continue;
    const box: PlacedProp = { uid: 0, def: boxAt(x, y, rng.int(0, 1 << 20)), owner: -1, tx: 0, ty: 0, rot: 0 };
    if (keep([...pieces, ...out, box])) out.push(box);
  }
  return out;
}
