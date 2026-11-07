import type { Level } from '../../src/sim/level';
import { T_EMPTY } from '../../src/sim/level';
import { footprintCells } from '../../src/sim/props';
import { analyzeReach } from '../../src/sim/reach';

/** Tiles from a way to die within which a place to stand isn't safe: about as far as a knock carries you. */
export const DEADLY_NEAR = 3;

/**
 * Where a brawl arena lets you stand safe (docs/MODES.md → Brawl): a stand cell the field reaches with no way to die
 * within `DEADLY_NEAR` tiles: no drop on its row (with no wall between) that falls into the pit or off the side of the
 * map, and no set piece that hurts within that many tiles. A drop onto the ledge below doesn't count: a knock off it
 * only moves the fight down a tier. `hazard` is the stand cells with a set piece that hurts that near.
 */
export function arenaSafety(lv: Level): { stands: number[]; safe: Set<number>; hazard: Set<number> } {
  const { deadly, hazard } = deadlyCells(lv);
  const stands = [...analyzeReach(lv, false).reachable];
  return { stands, safe: new Set(stands.filter((k) => !deadly.has(k))), hazard: new Set(stands.filter((k) => hazard.has(k))) };
}

/** Every cell, stand or air, with a way to die within `DEADLY_NEAR` tiles (`arenaSafety`), and of them those near a hazard. */
export function deadlyCells(lv: Level): { deadly: Set<number>; hazard: Set<number> } {
  const { w, h, tiles } = lv;
  const at = (x: number, y: number) => (x < 0 || x >= w || y < 0 || y >= h ? T_EMPTY : tiles[y * w + x]);
  // Columns with nothing to land on from row y down: the pit (or off the map at the sides).
  const pitFrom = new Int16Array(w).fill(h);
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0 && at(x, y) === T_EMPTY; y--) pitFrom[x] = y;
  const fallsOut = (x: number, y: number) => x < 0 || x >= w || (at(x, y) === T_EMPTY && pitFrom[x] <= y);
  const hurt = new Set<number>();
  for (const p of lv.setPieces) if (p.def.role === 'hazard' && p.def.key !== 'loop-box') for (const [x, y] of footprintCells(p)) hurt.add(y * w + x);
  const deadly = new Set<number>();
  const hazard = new Set<number>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let near = false;
      for (let dy = -DEADLY_NEAR; !near && dy <= DEADLY_NEAR; dy++)
        for (let dx = -DEADLY_NEAR; !near && dx <= DEADLY_NEAR; dx++) if (x + dx >= 0 && x + dx < w && hurt.has((y + dy) * w + x + dx)) near = true;
      if (near) hazard.add(y * w + x);
      for (const d of [-1, 1])
        for (let i = 0; !near && i <= DEADLY_NEAR; i++) {
          const cx = x + d * i;
          if (i > 0 && at(cx, y) !== T_EMPTY) break;
          if (fallsOut(cx, y + 1) || fallsOut(cx, y)) near = true;
        }
      if (near) deadly.add(y * w + x);
    }
  return { deadly, hazard };
}
