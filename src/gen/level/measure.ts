import { type Level, T_EMPTY } from '../../sim/level';
import { footprintCells } from '../../sim/props';
import { analyzeReach, type ReachCache } from '../../sim/reach';
import { withBridges } from './validate';

/**
 * What a level holds, measured: the numbers a builder's contract declares floors on (builders/contract.ts), that
 * `pnpm level` prints and tests/conformance holds every builder to. One measure for the pipeline, the tool and the
 * tests, so a number in a contract means the same thing everywhere.
 */

/** Tiles from a way to die within which a place to stand isn't safe: about as far as a knock carries you. */
const DEADLY_NEAR = 3;

/** Columns either side of a stand cell within which a drop counts as beside it. */
const BESIDE = 3;

/** A set piece that is the level's own loot box, not a hazard or a helper. */
export const isBox = (key: string) => key === 'loop-box';

/** The suffix on a centrepiece's key (`setpiece:<set>:<recipe>:centre`): the hazard that stood first, that the level was laid round (setpieces/place.ts). */
export const CENTRE_KEY = ':centre';

/**
 * Where a level lets you stand safe (docs/MODES.md → Brawl): a stand cell the field reaches with no way to die
 * within `DEADLY_NEAR` tiles: no drop on its row (with no wall between) that falls into the pit or off the side of the
 * map, and no set piece that hurts within that many tiles. A drop onto the ledge below doesn't count: a knock off it
 * only moves the fight down a tier. `hazard` is the stand cells with a set piece that hurts that near.
 */
export function standSafety(lv: Level, cache?: ReachCache): { stands: number[]; safe: Set<number>; hazard: Set<number>; centre: Set<number> } {
  const { deadly, hazard, centre } = deadlyCells(lv);
  const stands = cache ? cache.analyze(lv, false).cells : [...analyzeReach(lv, false).reachable];
  return {
    stands,
    safe: new Set(stands.filter((k) => !deadly.has(k))),
    hazard: new Set(stands.filter((k) => hazard.has(k))),
    centre: new Set(stands.filter((k) => centre.has(k))),
  };
}

/** Every cell, stand or air, with a way to die within `DEADLY_NEAR` tiles (`standSafety`), of them those near a hazard, and of those the ones near the centrepiece. */
export function deadlyCells(lv: Level): { deadly: Set<number>; hazard: Set<number>; centre: Set<number> } {
  const { w, h, tiles } = lv;
  const at = (x: number, y: number) => (x < 0 || x >= w || y < 0 || y >= h ? T_EMPTY : tiles[y * w + x]);
  // Columns with nothing to land on from row y down: the pit (or off the map at the sides).
  const pitFrom = new Int16Array(w).fill(h);
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0 && at(x, y) === T_EMPTY; y--) pitFrom[x] = y;
  const fallsOut = (x: number, y: number) => x < 0 || x >= w || (at(x, y) === T_EMPTY && pitFrom[x] <= y);
  const hurt = new Set<number>();
  const core = new Set<number>();
  for (const p of lv.setPieces)
    if (p.def.role === 'hazard' && !isBox(p.def.key)) for (const [x, y] of footprintCells(p)) (p.def.key.endsWith(CENTRE_KEY) ? core : hurt).add(y * w + x);
  for (const k of core) hurt.add(k);
  const deadly = new Set<number>();
  const hazard = new Set<number>();
  const centre = new Set<number>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let near = false;
      for (let dy = -DEADLY_NEAR; !near && dy <= DEADLY_NEAR; dy++)
        for (let dx = -DEADLY_NEAR; !near && dx <= DEADLY_NEAR; dx++) if (x + dx >= 0 && x + dx < w && hurt.has((y + dy) * w + x + dx)) near = true;
      if (near) hazard.add(y * w + x);
      if (near && core.size) {
        let by = false;
        for (let dy = -DEADLY_NEAR; !by && dy <= DEADLY_NEAR; dy++)
          for (let dx = -DEADLY_NEAR; !by && dx <= DEADLY_NEAR; dx++) if (x + dx >= 0 && x + dx < w && core.has((y + dy) * w + x + dx)) by = true;
        if (by) centre.add(y * w + x);
      }
      for (const d of [-1, 1])
        for (let i = 0; !near && i <= DEADLY_NEAR; i++) {
          const cx = x + d * i;
          if (i > 0 && at(cx, y) !== T_EMPTY) break;
          if (fallsOut(cx, y + 1) || fallsOut(cx, y)) near = true;
        }
      if (near) deadly.add(y * w + x);
    }
  return { deadly, hazard, centre };
}

/** A level's shape and danger, measured over the stand cells the field reaches with its solution's parts in place (bare, for a level that owes none). */
export interface Measures {
  /** Stand cells the field reaches: places to stand, and to be knocked off. */
  stands: number;
  /** Distinct rows the field stands on. */
  tiers: number;
  /** Share of the stand cells with a drop within `BESIDE` columns on their row (no wall between). */
  edgy: number;
  /** The field reaches a stand cell in the top third of the level. */
  high: boolean;
  /** The tallest run of terrain in either side column, in rows: a wall a knock stops against. */
  wall: number;
  /** Share of terrain cells whose mirror across the middle is terrain too. */
  mirrored: number;
  /** Share of the stand cells with no way to die near them (`standSafety`). */
  safe: number;
  /** Share of them with a set piece that hurts near them. */
  hazard: number;
  /** Centrepieces standing (`CENTRE_KEY`: one, or a mirrored pair), and the share of stand cells near one. */
  centres: number;
  centre: number;
}

export function measureLevel(level: Level, cache?: ReachCache): Measures {
  const lv = level.solution?.length ? withBridges(level, level.solution) : level;
  const { w, h, tiles } = lv;
  const at = (x: number, y: number) => (x < 0 || x >= w || y >= h ? T_EMPTY : tiles[y * w + x]);
  const s = standSafety(lv, cache);
  const n = Math.max(1, s.stands.length);
  let edgy = 0;
  const rows = new Set<number>();
  for (const k of s.stands) {
    const x = k % w;
    const y = Math.floor(k / w);
    rows.add(y);
    for (let d = 1; d <= BESIDE; d++) {
      const drop = (cx: number) => cx < 0 || cx >= w || (at(cx, y) === T_EMPTY && at(cx, y + 1) === T_EMPTY);
      const wall = (cx: number) => cx >= 0 && cx < w && at(cx, y) !== T_EMPTY;
      // A drop only counts if no wall stands between it and you.
      if ((drop(x - d) && ![...Array(d - 1).keys()].some((i) => wall(x - 1 - i))) || (drop(x + d) && ![...Array(d - 1).keys()].some((i) => wall(x + 1 + i)))) {
        edgy++;
        break;
      }
    }
  }
  const run = (x: number) => {
    let best = 0;
    let cur = 0;
    for (let y = 0; y < h; y++) best = Math.max(best, (cur = at(x, y) === T_EMPTY ? 0 : cur + 1));
    return best;
  };
  let solid = 0;
  let both = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (at(x, y) !== T_EMPTY) {
        solid++;
        if (at(w - 1 - x, y) !== T_EMPTY) both++;
      }
  return {
    stands: s.stands.length,
    tiers: rows.size,
    edgy: edgy / n,
    high: s.stands.some((k) => Math.floor(k / w) < h / 3),
    wall: Math.max(run(0), run(w - 1)),
    mirrored: solid ? both / solid : 1,
    safe: s.safe.size / n,
    hazard: s.hazard.size / n,
    centres: level.setPieces.filter((p) => p.def.key.endsWith(CENTRE_KEY)).length,
    centre: s.centre.size / n,
  };
}
