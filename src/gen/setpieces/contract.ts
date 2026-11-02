import type { Module, ModuleOf } from '../../sim/props';
import type { Recipe } from './place';

/**
 * The hazard contract for set pieces (docs/DESIGN.md → Stage concepts, docs/SETPIECES.md §4), declared as
 * data and checked by the engine. At generation time a candidate whose hazards don't warn is refused like
 * any other bad candidate (the placer and the landmark pipeline call `tellFaults`); the rest was already
 * enforced there: `finalize` keeps everything that hurts off the spawn and goal, `keep` (planHolds) keeps
 * the solution clear of every cell with no MIN_OPENING window, and `noFreeRide` refuses a mover that
 * carries a bare run. tests/conformance/hazards holds every registered recipe to all of it, plus art that
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
  swinger: 'moves',
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

/**
 * What makes one hazard of a module type play differently from another: what a gun fires, what a swinger
 * swings, whether a column burns or blows, what a flood is. Looks don't count: a tractor and a forklift are
 * one hazard in two skins (docs/SETPIECES.md §0, "one mechanism, many skins").
 */
const VARIANT: { [T in Module['type']]?: (m: ModuleOf<T>) => string } = {
  cannon: (m) => m.ammo,
  launcher: (m) => m.ammo,
  swinger: (m) => m.head,
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
