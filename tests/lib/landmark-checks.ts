import { fieldOf, planHolds, withBridges } from '../../src/gen/level';
import { noFreeRide } from '../../src/gen/level/winnable';
import { type Level, T_EMPTY, T_SOLID, type TileRect } from '../../src/sim/level';
import { analyzeReach } from '../../src/sim/reach';

/**
 * Checks any stage concept's landmark should pass (docs/SETPIECES.md), written against a generated level
 * alone so a conformance suite can run them over every registered concept: it stands (nothing floats), it has
 * more than one way through, its layout varies with the seed, the proof is static, and nothing it carries
 * gives a free ride.
 */

/** Rows of open air a span may stand over and still read as held: a doorway's height. */
export const DOORWAY = 4;

/**
 * Tiles of the landmark that float. Non-empty tiles group into 8-connected pieces; a piece stands if it
 * reaches the bottom row (the sea floor, or ground that runs down to it), or if it rests on standing pieces
 * either side of its middle (or right under it): under those columns, within DOORWAY rows of its lowest tile
 * there, is a standing tile. That's a lintel over a door, a floor on its walls, a boardwalk on its landing
 * stages, a yard on its mast, a balcony round a tower. Rested pieces count as standing for the pieces above
 * them. Returns one "x,y" per piece that never stands, of the pieces mostly inside `rect`.
 */
export function floating(level: Level, rect: TileRect = level.landmark!.rect): string[] {
  const { w, h, tiles } = level;
  const comp = new Int32Array(w * h).fill(-1);
  const pieces: number[][] = [];
  for (let k = 0; k < w * h; k++) {
    if (tiles[k] === T_EMPTY || comp[k] >= 0) continue;
    const id = pieces.length;
    const cells: number[] = [];
    const stack = [k];
    comp[k] = id;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % w;
      const y = (c - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (tiles[n] !== T_EMPTY && comp[n] < 0) {
            comp[n] = id;
            stack.push(n);
          }
        }
    }
    pieces.push(cells);
  }
  const stands = pieces.map((cells) => cells.some((c) => c >= (h - 1) * w));
  const restsAt = (cells: number[], col: number) => {
    const ys = cells.filter((c) => c % w === col).map((c) => (c - col) / w);
    const y0 = Math.max(...ys);
    for (let y = y0 + 1; y <= Math.min(h - 1, y0 + DOORWAY + 1); y++) {
      const c = comp[y * w + col];
      if (c >= 0 && pieces[c] !== cells) return stands[c];
    }
    return false;
  };
  for (let changed = true; changed;) {
    changed = false;
    pieces.forEach((cells, i) => {
      if (stands[i]) return;
      const xs = cells.map((c) => c % w);
      const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
      const held = [...new Set(xs)].filter((x) => restsAt(cells, x));
      if (held.some((x) => x <= mid + 0.5) && held.some((x) => x >= mid - 0.5)) {
        stands[i] = true;
        changed = true;
      }
    });
  }
  const inside = (c: number) => {
    const x = c % w;
    const y = (c - x) / w;
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
  };
  return pieces.flatMap((cells, i) => (!stands[i] && cells.filter(inside).length * 2 > cells.length ? [`${cells[0] % w},${Math.floor(cells[0] / w)}`] : []));
}

/** The proof's view of a level: every set piece a barrier, the solution's bridges in. */
export function proofField(level: Level): Level {
  return withBridges(fieldOf(level, []), level.solution ?? []);
}

/**
 * How many ways through the landmark the proof finds, counted where they part: the most, over the
 * landmark's columns, of separate bands of stand cells in one column such that walling off any one band (from
 * its floor up to whatever roofs it, or the sky) still leaves the flag reachable. Two or more means a part
 * placed in one way leaves another, which is play (docs/DESIGN.md, Stage concepts).
 */
export function waysThrough(level: Level, rect: TileRect = level.landmark!.rect): number {
  const field = proofField(level);
  const { w } = field;
  const reach = analyzeReach(field, false).reachable;
  let best = 0;
  for (let x = rect.x + 1; x < rect.x + rect.w - 1 && best < 2; x++) {
    const rows = [...reach].filter((c) => c % w === x).map((c) => (c - x) / w);
    rows.sort((a, b) => a - b);
    const bands: number[][] = [];
    for (const y of rows) {
      const last = bands[bands.length - 1];
      if (last && y - last[last.length - 1] <= 1) last.push(y);
      else bands.push([y]);
    }
    if (bands.length < 2) continue;
    let open = 0;
    for (const band of bands) {
      const tiles = field.tiles.slice();
      for (let y = band[band.length - 1]; y >= 0 && tiles[y * w + x] === T_EMPTY; y--) tiles[y * w + x] = T_SOLID;
      if (analyzeReach({ ...field, tiles }).goalReached) open++;
    }
    best = Math.max(best, open);
  }
  return best;
}

/** The proof is static: no rides, nothing finishes bare, the solution reaches the flag with every set piece a barrier. */
export function staticProof(level: Level): string[] {
  const out: string[] = [];
  if (level.rides?.length) out.push('rides a carrier');
  if (analyzeReach(level).goalReached) out.push('passable bare');
  if (!analyzeReach(proofField(level)).goalReached) out.push('the proof misses the flag');
  if (!planHolds(level, [], level.solution ?? [])) out.push('the plan does not hold');
  return out;
}

/** Names of the set pieces that would give a bare run a free ride, each checked against all the others. */
export function freeRiders(level: Level): string[] {
  return level.setPieces
    .filter(
      (pp) =>
        !noFreeRide(
          level,
          pp,
          level.setPieces.filter((q) => q !== pp),
        ),
    )
    .map((pp) => pp.def.name);
}

/** A landmark's layout, as numbers anyone can read off its tiles: its box, how much of it is solid or one-way, how many rows carry floors. */
export function signature(level: Level, rect: TileRect = level.landmark!.rect): Record<string, number> {
  let solid = 0;
  let oneway = 0;
  const floors = new Set<number>();
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const t = level.tiles[y * level.w + x];
      if (t === T_SOLID) solid++;
      else if (t !== T_EMPTY) {
        oneway++;
        floors.add(y - (rect.y + rect.h));
      }
    }
  return { w: rect.w, h: rect.h, solid, oneway, floors: floors.size, pieces: level.setPieces.length };
}

/** Keys whose values differ across the samples: what varies with the seed. */
export function varying(samples: readonly Record<string, number>[]): string[] {
  const keys = new Set(samples.flatMap((s) => Object.keys(s)));
  return [...keys].filter((k) => new Set(samples.map((s) => s[k])).size > 1);
}
