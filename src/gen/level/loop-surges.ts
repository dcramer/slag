import type { Rng } from '../../core/rng';
import { isProtected, type Level, LOOP_BAND, T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import { footprintCells, type PlacedProp, type PropDef, SURGE } from '../../sim/props';

/**
 * Leg Days a loop is built with when its mode asks (game/modes.ts `surges`): pickups that spring every jump higher for
 * a few seconds (sim/props/modules/surge.ts), on the lips of the shaft's risky lines, so taking the hard line pays. A
 * lip is a ledge's last cell, and how risky its line is is how far a slip off it falls: past the chimney's foot beside
 * a wall-jump chimney, past the row a well left out, a rise or so anywhere else. Every lap is the same shaft, so every
 * lap has them; each is back a few seconds after it's taken.
 */

/** Rows of shaft per Leg Day: about two a 48-row lap. */
const ROWS_PER_SURGE = 24;
/** Rows apart two must be, round the loop, so they spread up it. */
const MIN_APART = 12;
/** Rows a drop is followed down before it counts as a fall all the way. */
const DEEPEST = 40;

/** What a Leg Day is as a level piece: one cell, keyed `loop-surge`. */
function surgeAt(tx: number, ty: number): PropDef {
  return {
    key: 'loop-surge',
    name: 'Leg Day',
    maker: 'the level',
    archetype: 'mystery',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [{ type: 'surge', cells: [[tx, ty]], refill: SURGE.refill, frames: SURGE.frames }],
    footprint: [[tx, ty]],
  };
}

export const isSurge = (key: string) => key === 'loop-surge';

/** The tile at (x, y), round a loop the row a lap up or down; off the sides rock. */
function tileOf(level: Level, x: number, y: number): number {
  if (x < 0 || x >= level.w) return T_SOLID;
  const L = level.loop ?? 0;
  const yy = L && y >= level.h ? y - L : L && y < 0 ? y + L : y;
  if (yy < 0 || yy >= level.h) return T_EMPTY;
  return level.tiles[yy * level.w + x];
}

const isFloor = (t: number) => t === T_SOLID || t === T_ONEWAY;

/**
 * How far a slip off stand cell (x, y) falls, in rows, off whichever side drops further: 0 if it isn't a lip (both
 * sides walk on, or are walled). A stand cell is open with a floor under it.
 */
export function lipDrop(level: Level, x: number, y: number): number {
  if (tileOf(level, x, y) !== T_EMPTY || !isFloor(tileOf(level, x, y + 1))) return 0;
  let best = 0;
  for (const d of [-1, 1]) {
    const c = x + d;
    if (tileOf(level, c, y) !== T_EMPTY || isFloor(tileOf(level, c, y + 1))) continue;
    let k = 1;
    while (k < DEEPEST && !isFloor(tileOf(level, c, y + k + 1))) k++;
    best = Math.max(best, k);
  }
  return best;
}

/** Rows between two rows round the loop. */
function apart(level: Level, a: number, b: number): number {
  const d = Math.abs(a - b);
  const L = level.loop ?? 0;
  return L ? Math.min(d, L - (d % L)) : d;
}

/**
 * A loop's Leg Days, clear of every piece in `pieces`: up its shaft off the seam's band, on the lips that drop
 * furthest first (ties shuffled by `rng`), MIN_APART rows apart, about one every ROWS_PER_SURGE rows.
 */
export function loopSurges(level: Level, pieces: readonly PlacedProp[], rng: Rng): PlacedProp[] {
  const loop = level.loop;
  if (!loop) return [];
  const taken = new Set(pieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * level.w + x)));
  const spots: { x: number; y: number; drop: number }[] = [];
  for (let y = LOOP_BAND; y < loop + LOOP_BAND; y++)
    for (let x = 1; x < level.w - 1; x++) {
      if (taken.has(y * level.w + x) || isProtected(level, x, y)) continue;
      const drop = lipDrop(level, x, y);
      if (drop > 0) spots.push({ x, y, drop });
    }
  rng.shuffle(spots);
  spots.sort((a, b) => b.drop - a.drop);
  const want = Math.max(2, Math.round(loop / ROWS_PER_SURGE));
  const out: { x: number; y: number }[] = [];
  for (const s of spots) {
    if (out.length >= want) break;
    if (out.every((o) => apart(level, o.y, s.y) >= MIN_APART)) out.push(s);
  }
  return out.map((s) => ({ uid: 0, def: surgeAt(s.x, s.y), owner: -1, tx: 0, ty: 0, rot: 0 }));
}
