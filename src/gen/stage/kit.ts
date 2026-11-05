import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { DecoKind, Module } from '../../sim/props';
import { type Grid, hintGap } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, hardGapRange, type Knobs, pit, SITE_MARGIN, undercut } from '../level/sculptors/common';
import type { Landmark } from './types';

/**
 * What every theme's landmarks are built from (stage/<theme>.ts): the crossing a landmark owns, sized from
 * `hardGapRange` so the box always has room for the roll; the one-way ledges up a face; a passage through a
 * foot; a backdrop shell; and the anchors the tests read back (`way{i}` / `way{i}s`: a rect that, filled,
 * shuts one way past; `sig{i}`: the structural numbers the seed rolled).
 *
 * The rules for where a crossing goes and how wide a landmark's box is are one engine, `bankKit`, fed each
 * theme's numbers (its bank, how often its landmark asks for two parts), the way `level/sculptors/tall.ts`
 * takes a `TallKit`. A fix to those rules is made here once. A theme whose landmarks stand differently (a
 * castle's moat, a harbor's berth, space's docks) keeps its own sizing in its own file, built from these.
 */

export { SITE_MARGIN };

/** Rows a passage through a structure is tall: a runner's height and a jump's start. */
export const DOOR = 3;

/** The widest one-part crossing at this gravity (hardGap's top end). */
export const oneGap = (gravity?: number): number => hardGapRange(1, gravity)[1];

/** The widest two-part crossing at this gravity. */
export const twoGap = (gravity?: number): number => hardGapRange(2, gravity)[1];

/**
 * The one-part crossing a classic level's box makes room for: a column short of hardGap's widest, so a large
 * landmark fits beside it in a classic level's middle (the build caps its roll at the box).
 */
export const snugGap = (gravity?: number): number => Math.min(oneGap(gravity), jumpProfile(gravity).gap + 3);

/** A theme's numbers for `bankKit`. */
export interface BankSpec {
  /** Flat ground between the crossing and the structure: the bridge's landing and a run-up. */
  bank: number;
  /**
   * Share of levels whose landmark's own crossing takes two parts, where its box has room for a two-part one
   * (wide levels). A level built round a landmark has little room left for the sculptor's own crossings, so
   * the wide ones ask more often to keep the theme near TWO_PARTS (measured with `pnpm level --stats 200`).
   */
  two: number;
  /** The bank counts against the room a crossing needs beside the structure (the mine's boxes: crossing, bank, structure). */
  bankInRoom?: boolean;
}

/**
 * The sizing rules of a landmark that owns its crossing and stands past it on a bank: what a box asks for,
 * whether it fits, and how wide the crossing is. Nothing here rolls except `structCols`, so a sculptor reads
 * the same answer back (`<theme>Owns`).
 */
export function bankKit(spec: BankSpec) {
  const { bank } = spec;
  const fit = spec.bankInRoom ? bank : 0;
  const asksTwo = (k: Knobs) => k.challenge < Math.max(k.twoParts, spec.two);
  /** Columns for the crossing a landmark owns: two-part where asked and there's room, else one-part. Never rolls. */
  const crossFor = (k: Knobs, struct: number): number => {
    if (asksTwo(k) && twoGap() + fit + struct <= k.W - 2 * SITE_MARGIN) return twoGap();
    return k.W > 56 ? oneGap() : snugGap();
  };
  return {
    asksTwo,
    crossFor,
    /** Does a landmark of `struct` columns fit beside a one-part crossing on this level? */
    roomFor: (p: Partial<LevelProfile>, struct: number): boolean => snugGap(p.gravity) + fit + struct <= (p.w ?? 48) - 2 * SITE_MARGIN,
    /** The crossing the build digs: as wide as `parts` take, or as the box allows. */
    crossCols: (parts: number): number => (parts >= 2 ? twoGap() : oneGap()),
    /** Columns of structure for a box: what a classic level's middle leaves (all of it for a grand one), more on a wide one. */
    structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number], grand = false): number {
      const room = k.W - 2 * SITE_MARGIN - crossFor(k, min + bank) - bank;
      return Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : grand ? room : min + rng.int(0, 3));
    },
  };
}

/** Rows a box asks for, never more than a level `H` tall has over its ground (claimSite needs a row of sky). */
export const boxH = (H: number, h: number): number => Math.min(H - 9, h);

/**
 * The crossing in front of a landmark: a `hardGap` pit dug to the bottom at the right end of its `cols`
 * columns, its bridge hinted and its far bank undercut. Columns it doesn't need stay bank. Returns the gap's
 * columns (empty, past the end, when the level asks for no part).
 */
export function bankCrossing(g: Grid, rng: Rng, x0: number, cols: number, G: number, parts: number): [number, number] {
  const b = x0 + cols - 1;
  if (parts <= 0) return [b + 1, b];
  const gw = Math.min(cols, hardGap(rng, parts));
  const a = b - gw + 1;
  pit(g, a, b, G, false);
  hintGap(g, a, b, G);
  undercut(g, b + 1, 2, G);
  return [a, b];
}

/** One-way ledges two wide at columns x, x+1, a comfortable hop apart from the ground row G up to (not past) row `top`. */
export function ledges(g: Grid, x: number, top: number, G: number): number[] {
  const R = easyRise();
  const rows: number[] = [];
  for (let y = G - R; y > top; y -= R) {
    for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
    rows.push(y);
  }
  return rows;
}

/** Solid column x from row G - h to G - 1. */
export function col(g: Grid, x: number, h: number, G: number): void {
  if (h > 0) g.fill(x, G - h, x, G - 1, 1, true);
}

/** A passage `h` rows tall at the ground (row G is the floor) from column a to b. */
export function passage(g: Grid, a: number, b: number, G: number, h = DOOR): void {
  g.clear(Math.min(a, b), G - h, Math.max(a, b), G - 1);
}

/** Steps `n` columns wide in all, `count` of them, each at least one column and at most `most`, the spare spread at random. */
export function stepWidths(rng: Rng, count: number, n: number, most = 3): number[] {
  const out = Array.from({ length: count }, () => 1);
  for (let spare = n - count; spare > 0; spare--) {
    const open = out.map((w, i) => (w < most ? i : -1)).filter((i) => i >= 0);
    if (!open.length) break;
    out[rng.pick(open)]++;
  }
  return out;
}

/** A backdrop shell, drawn by the theme's skin (chosen by the level's concept and the shell's shape). */
export const shell = (rng: Rng, at: Vec, w: number, h: number, kind: DecoKind = 'facade'): Module => ({
  type: 'deco',
  kind,
  at,
  w,
  h,
  seed: rng.int(0, 1 << 20),
});

/** Anchors of a list of rects under `key`: `${key}{i}` its corner, `${key}{i}s` its size. */
export function rects(key: string, rs: readonly TileRect[]): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  rs.forEach((r, i) => {
    out[`${key}${i}`] = [r.x, r.y];
    out[`${key}${i}s`] = [r.w, r.h];
  });
  return out;
}

/** The anchors of the ways through: each a rect that, filled, shuts that way. */
export const ways = (rs: readonly TileRect[]): Record<string, Vec> => rects('way', rs);

/** Rects recorded with `rects` under `key`, back as a list. */
export function rectsOf(l: Pick<Landmark, 'anchors'>, key: string): TileRect[] {
  const out: TileRect[] = [];
  for (let i = 0; l.anchors[`${key}${i}`]; i++) {
    const [x, y] = l.anchors[`${key}${i}`];
    const [w, h] = l.anchors[`${key}${i}s`];
    out.push({ x, y, w, h });
  }
  return out;
}

/** A landmark's ways through, read back from its anchors (tests, tools). */
export const waysOf = (l: Pick<Landmark, 'anchors'>): TileRect[] => rectsOf(l, 'way');

/** Points recorded as `${key}{i}` anchors. */
export const record = (key: string, xs: readonly Vec[]): Record<string, Vec> => Object.fromEntries(xs.map((v, i) => [`${key}${i}`, v]));

/** Points recorded as `${key}{i}` anchors, back as a list. */
export function listOf(l: Pick<Landmark, 'anchors'>, key: string): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; l.anchors[`${key}${i}`]; i++) out.push(l.anchors[`${key}${i}`]);
  return out;
}

/** A list of layout numbers as one signature pair: how many, and a sum weighted by place, so a reorder shows. */
export const listSig = (xs: readonly number[]): Vec => [xs.length, xs.reduce((t, v, i) => t + v * (i + 1), 0)];
