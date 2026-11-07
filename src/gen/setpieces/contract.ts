import type { Rect } from '../../core/geom';
import { RUN_COUNTDOWN, TILE } from '../../sim/constants';
import { type Level, T_EMPTY } from '../../sim/level';
import {
  type Contrib,
  footprintCells,
  type Hazard,
  type Module,
  type ModuleOf,
  moduleSim,
  motionOffset,
  newPropState,
  type PlacedProp,
  resolveProp,
} from '../../sim/props';
import type { Recipe } from './place';

/**
 * The hazard contract for set pieces (docs/DESIGN.md → Stage concepts, docs/SETPIECES.md §4), declared as
 * data and checked by the engine. At generation time a candidate whose hazards don't warn is refused like
 * any other bad candidate (the placer and the landmark pipeline call `tellFaults`); the rest was already
 * enforced there: `finalize` keeps everything that hurts off the spawn and goal, `keep` (planHolds) keeps
 * the solution clear of every cell with no MIN_OPENING window, `windowFaults` refuses a piece that is lethal
 * somewhere every frame, and `noFreeRide` refuses a mover that carries a bare run. tests/conformance/hazards holds every registered recipe to all of it, plus art that
 * draws what the sim hurts with and the theme-unique flag.
 */

/**
 * How a module that hurts lets you see it coming: `still` (always there, so always visible: spikes, glass),
 * `moves` (you watch it travel: a swinging axe, a cart, a press, a shot in flight), or the frames it warns
 * for before it turns on (a geyser's rumble, a laser's charge), which must be at least MIN_TELL.
 */
export type Tell<M extends Module = Module> = 'still' | 'moves' | ((m: M) => number);

/** Fewest frames a hazard that switches on from nothing warns first: a fifth of a second and a bit. */
export const MIN_TELL = 18;

/**
 * Every module type that hurts, with its tell. A module that produces hazards and isn't listed here fails
 * the conformance suite: say how it telegraphs before a set piece may use it.
 */
export const TELLS: { [T in Module['type']]?: Tell<ModuleOf<T>> } = {
  spikes: 'still',
  coat: 'still',
  shards: 'still',
  // You watch a swinger turn; one on a machine's drive (a combine's reel) pulls away after it revs, and the rev is its warning.
  swinger: (m) => m.drive?.warn ?? Infinity,
  vehicle: 'moves',
  piston: 'moves',
  cannon: 'moves',
  launcher: 'moves',
  sentry: 'moves',
  geyser: (m) => m.warn,
  flame: (m) => m.warn,
  tesla: (m) => m.warn,
  laser: (m) => m.charge,
  magnet: (m) => m.warn,
  dropper: (m) => m.warn,
  snapper: (m) => m.warn,
  flood: (m) => m.warn,
  fuse: (m) => m.count,
  lob: (m) => m.warn,
  cavein: (m) => m.warn,
  cart: (m) => m.warn,
  sign: (m) => m.warn,
  neon: (m) => m.warn,
  wire: (m) => m.warn,
  thaw: (m) => m.warn,
  ladle: (m) => m.warn,
  arm: (m) => m.warn,
};

/** Modules among `mods` whose tell is a warning shorter than MIN_TELL. */
export function tellFaults(mods: readonly Module[]): string[] {
  const out: string[] = [];
  for (const m of mods) {
    const tell = TELLS[m.type] as Tell | undefined;
    if (typeof tell !== 'function') continue;
    // A geyser that only blows (not lethal) warns as a courtesy; only what kills has to.
    if (m.type === 'geyser' && !m.lethal) continue;
    const frames = tell(m);
    if (frames < MIN_TELL) out.push(`${m.type} warns for ${frames} frames (at least ${MIN_TELL})`);
  }
  return out;
}

/** Frames `windowFaults` watches a piece for, from the race start: longer than every hazard's cycle. */
const WINDOW_SPAN = 900;
/** A cell a moving hazard crosses has to stay clear longer than this between passes. */
/**
 * Nothing a set piece holds reaches through terrain: in each column of its footprint (every cell it claims over its
 * cycle), no tile of the level between two of its cells. The placer claims a hazard's cells best-effort and skips
 * tiles it can't, so a fall, a drip's path or a hail of rocks laid over a board or a ledge would be drawn, and hurt,
 * straight through it. Empty when it holds.
 */
export function throughFaults(level: Level, pp: PlacedProp): string[] {
  const cols = new Map<number, Set<number>>();
  for (const [x, y] of footprintCells(pp)) cols.set(x, (cols.get(x) ?? new Set()).add(y));
  const out: string[] = [];
  for (const [x, ys] of cols) {
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    for (let y = lo + 1; y < hi; y++)
      if (!ys.has(y) && level.tiles[y * level.w + x] !== T_EMPTY) {
        out.push(`${pp.def.name}: reaches through terrain at ${x},${y}`);
        break;
      }
  }
  return out;
}

export const SAFE_WINDOW = 60;

/**
 * No piece is lethal every frame: a hazard leaves a window to get past it. A piece whose blades are always
 * out somewhere (the Great Wheel's saw spokes) has to keep moving them: every cell they cross is clear for
 * longer than SAFE_WINDOW between passes. A hazard that never moves (a spike strip, a broken window's
 * glass) is a wall the proof keeps clear of, and a long lull anywhere is window enough. Empty when it holds.
 */
export function windowFaults(level: Level, pp: PlacedProp): string[] {
  if (!pp.def.modules.some((m) => m.type in TELLS)) return [];
  const r = resolveProp(pp);
  const state = newPropState();
  let quiet = 0;
  let any = false;
  let first: string | null = null;
  let still = true;
  /** Per cell a hazard touched: the frame it was last touched and the longest clear stretch so far. */
  const cells = new Map<number, [number, number]>();
  for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + WINDOW_SPAN; f++) {
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    // Where the piece's own motion has carried it (a combine on its rail): its hazards ride along.
    const off = motionOffset(r, f);
    const prev = motionOffset(r, f - 1);
    r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off, prev, state, mi, live: true }, out));
    if (out.hazards.length) any = true;
    else if (++quiet > SAFE_WINDOW) return [];
    if (still) {
      const key = JSON.stringify(out.hazards);
      if (first === null) first = key;
      else if (key !== first) still = false;
    }
    for (const h of out.hazards) {
      const b = hazardBox(h);
      for (let y = Math.floor(b.y / TILE); y <= Math.floor((b.y + b.h) / TILE); y++)
        for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w) / TILE); x++) {
          const k = y * level.w + x;
          const c = cells.get(k);
          if (!c) cells.set(k, [f, f - RUN_COUNTDOWN]);
          else if (c[0] !== f) {
            c[1] = Math.max(c[1], f - c[0] - 1);
            c[0] = f;
          }
        }
    }
  }
  if (!any || still) return [];
  const out: string[] = [];
  for (const [k, [last, open]] of cells)
    if (Math.max(open, RUN_COUNTDOWN + WINDOW_SPAN - 1 - last) <= SAFE_WINDOW)
      out.push(`${pp.def.name}: cell ${k} is never clear for more than ${SAFE_WINDOW} frames`);
  return out;
}

/** The box a hazard covers, in world pixels. */
export function hazardBox(h: Hazard): Rect {
  if (h.kind === 'rect') return h.r;
  if (h.kind === 'circle') return { x: h.x - h.r, y: h.y - h.r, w: 2 * h.r, h: 2 * h.r };
  return { x: Math.min(h.x1, h.x2) - h.r, y: Math.min(h.y1, h.y2) - h.r, w: Math.abs(h.x2 - h.x1) + 2 * h.r, h: Math.abs(h.y2 - h.y1) + 2 * h.r };
}

/**
 * What makes one hazard of a module type play differently from another: what a gun fires, what a swinger
 * swings, whether a column burns or blows, what a flood is. Looks don't count: a tractor and a forklift are
 * one hazard in two skins (docs/SETPIECES.md §0, "one mechanism, many skins").
 */
const VARIANT: { [T in Module['type']]?: (m: ModuleOf<T>) => string } = {
  cannon: (m) => m.ammo,
  launcher: (m) => m.ammo,
  // A blade on a machine that drives at you, revving first, plays nothing like one turning in place.
  swinger: (m) => (m.drive ? `${m.head}:driven` : m.head),
  geyser: (m) => (m.lethal ? 'burns' : 'blows'),
  // A field that drags you in (a whirlpool) plays nothing like one that throws you out (an airlock).
  magnet: (m) => (m.polarity > 0 ? 'pulls' : 'pushes'),
  flood: (m) => m.look,
  // One thing falling on a spot, or a chain of segments sweeping an arc.
  lob: (m) => (m.count > 1 ? 'chain' : 'single'),
  // Boulders falling through a span, or the whole span catching fire.
  cavein: (m) => m.kind,
};

/** What a set piece's hazard is, for "unique to its theme": every module that hurts, by type and variant. Empty if nothing hurts. */
export function hazardSignature(mods: readonly Module[]): string[] {
  const out = new Set<string>();
  for (const m of mods) {
    if (!(m.type in TELLS)) continue;
    const v = (VARIANT[m.type] as ((m: Module) => string) | undefined)?.(m);
    out.add(v ? `${m.type}:${v}` : m.type);
  }
  return [...out].sort();
}

/**
 * Register a set-piece recipe: the recipe as written, typed. Its contract fields live on `Recipe`
 * (./place.ts): `unique` says no other theme has this hazard, and the per-theme count reads it.
 */
export const defineSetPiece = (r: Recipe): Recipe => r;
