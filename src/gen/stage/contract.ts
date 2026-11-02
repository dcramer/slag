import { LEVEL_H, LEVEL_W, TILE } from '../../sim/constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, type TileRect } from '../../sim/level';
import { type PlacedProp, resolveProp } from '../../sim/props';
import { SHELLS, TURNING_SHELLS } from '../../sim/props/modules/deco';
import { MAX_SHARED } from '../level/routes';
import type { Concept } from './types';

/**
 * The landmark contract (docs/DESIGN.md → Stage concepts, docs/DECISIONS.md): what every stage concept
 * promises, declared as data on the concept and checked by the engine twice. At generation time
 * (`landmarkFaults`, called by the pipeline in gen/level/index.ts) a landmark that breaks it rejects the
 * attempt like any other landmark reject; in tests/conformance every registered concept is generated at a
 * few seeds, sizes and gravities and held to all of it, so a new concept is covered with no new test.
 */

/** How big a landmark is against the view: `large` is a third of it along its biggest side, `grand` owns it. */
export type Scale = 'large' | 'grand';

/**
 * What holds the structure up. `grounded`: every column of it stands on terrain, or on a backdrop shell that
 * does. `hanging`: every column hangs from terrain above it. `floating`: neither, and only where the ground
 * itself floats (`FLOATS`, src/themes.ts).
 */
export type Footing = 'grounded' | 'hanging' | 'floating';

/** The contract fields of a `Concept`, every one filled. */
export interface LandmarkContract {
  scale: Scale;
  footing: Footing;
  /** Distinct ways through or past it (at least 2: blocking one with a part is play). */
  ways: number;
  /** What its seed changes (storeys, widths, door side...): read by people; the engine measures `layoutOf`. */
  varies: readonly string[];
}

/** Thresholds behind the contract, in one place. */
export const LANDMARK_RULES = {
  /** `large`: this share of the view along its biggest side, and `largeArea` of its area. */
  largeSpan: 1 / 3,
  largeArea: 1 / 9,
  /** `grand`: a third of the view's area, or most of one side of it with a third of the other. */
  grandArea: 1 / 3,
  grandSpan: 0.85,
  /** Fewest ways through. */
  ways: 2,
  /** Structural parameters (`layoutOf`) that must differ between two seeds of the same level size. */
  varies: 2,
} as const;

const DEFAULTS: LandmarkContract = { scale: 'large', footing: 'grounded', ways: LANDMARK_RULES.ways, varies: [] };

/**
 * Register a stage concept: the same concept with its contract's defaults filled in (large, grounded, two
 * ways through). A concept written as a plain `Concept` literal still works; the engine reads it through
 * `contractOf`, which applies the same defaults.
 */
export function defineConcept<C extends Concept>(c: C): C & LandmarkContract {
  return { ...DEFAULTS, ...c } as C & LandmarkContract;
}

/** A concept's contract, defaults filled. */
export function contractOf(c: Concept): LandmarkContract {
  return { scale: c.scale ?? DEFAULTS.scale, footing: c.footing ?? DEFAULTS.footing, ways: c.ways ?? DEFAULTS.ways, varies: c.varies ?? DEFAULTS.varies };
}

/** A landmark's size against the view (the level, clipped to one screen of it). */
export function measureScale(level: Pick<Level, 'w' | 'h'>, r: TileRect): { span: number; area: number; scale: Scale | 'small' } {
  const wf = r.w / Math.min(level.w, LEVEL_W);
  const hf = r.h / Math.min(level.h, LEVEL_H);
  const span = Math.max(wf, hf);
  const area = Math.min(1, wf) * Math.min(1, hf);
  const R = LANDMARK_RULES;
  const grand = area >= R.grandArea || (span >= R.grandSpan && Math.min(wf, hf) >= R.largeSpan);
  return { span, area, scale: grand ? 'grand' : span >= R.largeSpan && area >= R.largeArea ? 'large' : 'small' };
}

const SCALE_RANK: Record<Scale | 'small', number> = { small: 0, large: 1, grand: 2 };

/** The landmark's own pieces among a level's set pieces (their keys end in the concept's id). */
export const ownPieces = (level: Level): PlacedProp[] => level.setPieces.filter((p) => level.landmark && p.def.key.endsWith(`:${level.landmark.concept}`));

/** Tile boxes of backdrop shells among `pieces`. */
function shellBoxes(pieces: readonly PlacedProp[]): (TileRect & { turns: boolean })[] {
  const out: (TileRect & { turns: boolean })[] = [];
  for (const pp of pieces)
    for (const m of resolveProp(pp).mods)
      if (m.type === 'deco' && SHELLS.has(m.kind))
        out.push({
          x: Math.round(m.at[0] / TILE),
          y: Math.round(m.at[1] / TILE),
          w: Math.round(m.w / TILE),
          h: Math.round(m.h / TILE),
          turns: TURNING_SHELLS.has(m.kind),
        });
  return out;
}

/** Cells of static blocks among `pieces`: ground, as far as a column standing on them is concerned. */
function blockCells(level: Level, pieces: readonly PlacedProp[]): Set<number> {
  const out = new Set<number>();
  for (const pp of pieces) {
    if (pp.def.motion.type !== 'none') continue;
    for (const m of resolveProp(pp).mods) if (m.type === 'body' && !m.breakFrames) for (const [x, y] of m.cells) out.add(y * level.w + x);
  }
  return out;
}

/**
 * Nothing a landmark builds floats (docs/SETPIECES.md §4, Grounding). Grounded: every column of its box
 * that holds structure reaches the terrain under it, through solid tiles or, where a doorway, a room or a
 * pit opens under its lowest tile, through one of its backdrop shells that covers the column and stands on
 * the ground. Hanging: the same upward, to terrain above. Static blocks among its pieces count as ground;
 * hanging things (chandeliers, a wheel on its hub) are props, not structure.
 */
export function footingFaults(level: Level, rect: TileRect, pieces: readonly PlacedProp[], footing: Footing): string[] {
  if (footing === 'floating') return [];
  const out: string[] = [];
  const boxes = shellBoxes(pieces);
  const support = blockCells(level, pieces);
  const solid = (x: number, y: number) => level.tiles[y * level.w + x] === T_SOLID;
  const ground = (x: number, y: number) => solid(x, y) || support.has(y * level.w + x);
  const below = (x: number, y: number) => {
    while (y < level.h && !ground(x, y)) y++;
    return y;
  };
  const above = (x: number, y: number) => {
    while (y >= 0 && !ground(x, y)) y--;
    return y;
  };
  const y1 = Math.min(level.h, rect.y + rect.h);
  for (let x = Math.max(0, rect.x); x < Math.min(level.w, rect.x + rect.w); x++) {
    if (footing === 'grounded') {
      let low = -1;
      for (let y = Math.max(0, rect.y); y < y1; y++) if (solid(x, y)) low = y;
      if (low < 0) continue;
      const g = below(x, low + 1);
      if (g === low + 1 || g >= level.h) continue;
      if (!boxes.some((b) => x >= b.x && x < b.x + b.w && b.y <= low + 1 && b.y + b.h >= g))
        out.push(`column ${x} hangs over open air from row ${low + 1} to ${g}`);
    } else {
      let top = -1;
      for (let y = y1 - 1; y >= Math.max(0, rect.y); y--) if (solid(x, y)) top = y;
      if (top < 0) continue;
      const g = above(x, top - 1);
      if (g === top - 1) continue;
      if (g < 0 || !boxes.some((b) => x >= b.x && x < b.x + b.w && b.y <= g + 1 && b.y + b.h >= top))
        out.push(`column ${x} stands on nothing above row ${top}`);
    }
  }
  for (const b of boxes) {
    if (b.turns) {
      // A turning rim stands on a stand its art draws down to the ground under its feet: there has to be ground there.
      for (const x of [b.x + Math.floor(b.w / 4), b.x + b.w - 1 - Math.floor(b.w / 4)])
        if (below(x, b.y + b.h - 1) >= level.h) out.push(`no ground under its turning shell's stand at column ${x}`);
      continue;
    }
    if (footing !== 'grounded') continue;
    for (let x = b.x; x < b.x + b.w; x++) {
      const g = below(x, b.y + b.h - 1);
      if (b.y + b.h < Math.min(g, level.h)) out.push(`its backdrop stops short of the ground in column ${x}`);
    }
  }
  return out;
}

/** Structure (tiles) inside the spawn or goal pockets, which nothing may build on. */
export function protectedFaults(level: Level, rect: TileRect): string[] {
  for (let y = Math.max(0, rect.y); y < Math.min(level.h, rect.y + rect.h); y++)
    for (let x = Math.max(0, rect.x); x < Math.min(level.w, rect.x + rect.w); x++)
      if (isProtected(level, x, y) && level.tiles[y * level.w + x] !== T_EMPTY) return [`its box takes protected cell ${x},${y}`];
  return [];
}

/**
 * The cheap half of the contract, checked on every landmark the pipeline raises, after its pieces are in:
 * declared scale, footing, out of the protected pockets, and its ways through (`shared`: the level's
 * `Routes.landmark`, the share of the way past it with no second way; at most MAX_SHARED is two ways).
 * Empty when it holds. The static proof, `noFreeRide` and the carrier's ride are checked where they always
 * were, in the pipeline itself.
 */
export function landmarkFaults(level: Level, c: Concept, rect: TileRect, pieces: readonly PlacedProp[], shared: number | undefined): string[] {
  const k = contractOf(c);
  const out: string[] = [];
  const s = measureScale(level, rect);
  if (SCALE_RANK[s.scale] < SCALE_RANK[k.scale]) out.push(`declared ${k.scale} but measures ${s.scale} (span ${s.span.toFixed(2)}, area ${s.area.toFixed(2)})`);
  out.push(...footingFaults(level, rect, pieces, k.footing).slice(0, 1));
  out.push(...protectedFaults(level, rect));
  if (k.ways >= 2 && shared !== undefined && shared > MAX_SHARED)
    out.push(`one way through: ${(shared * 100).toFixed(0)}% of the way past it has no alternative`);
  return out;
}

/**
 * The structural parameters of a raised landmark, for "its layout varies with its seed": its box, the tile
 * pattern inside it, where its openings are, and its pieces (what they are and where they stand, relative
 * to the box). Two seeds of the same level size must differ in at least LANDMARK_RULES.varies of them.
 */
export function layoutOf(level: Level): Record<string, string> {
  const r = level.landmark!.rect;
  const rows: string[] = [];
  for (let y = Math.max(0, r.y); y < Math.min(level.h, r.y + r.h); y++) {
    let row = '';
    for (let x = Math.max(0, r.x); x < Math.min(level.w, r.x + r.w); x++) row += level.tiles[y * level.w + x];
    rows.push(row);
  }
  const pieces = ownPieces(level);
  return {
    width: String(r.w),
    height: String(r.h),
    tiles: rows.join('/'),
    pieces: pieces.map((p) => p.def.modules.map((m) => m.type).join('+')).join(' '),
    footprints: pieces.map((p) => p.def.footprint.length).join(' '),
    placement: pieces.map((p) => `${p.tx - r.x},${p.ty - r.y}`).join(' '),
  };
}

/** Names of the structural parameters that differ between two layouts. */
export function layoutDiff(a: Record<string, string>, b: Record<string, string>): string[] {
  return Object.keys(a).filter((k) => a[k] !== b[k]);
}
