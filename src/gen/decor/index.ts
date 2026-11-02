import { deriveSeed, Rng } from '../../core/rng';
import { TILE } from '../../sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, tileAt, type TileRect } from '../../sim/level';
import { THEME_IDS, type ThemeId } from '../../themes';

/**
 * Terrain decor: the small scenery that dresses a level (a fence, a lantern, a neon sign). Each kind is a
 * rule here, declared as data: which themes it dresses, whether it grows on top of the ground or hangs
 * under a ceiling, its pick weight and how much room it needs. Placement is decided here, in gen, from the
 * level's seed; src/render/decor.ts only draws a spot (`DECOR`, one art entry per kind, which tsc demands).
 *
 * Adding a decor piece: an entry in `RULES` (its kind becomes a `DecorKind`), art in src/render/decor.ts.
 * The theme's look draws from every kind registered for it (`decorFor`), and tests/conformance/decor holds
 * it to the contract: grounded or hanging as declared, small, off the spawn and goal, off a landmark that
 * wears its own skin, purely cosmetic, varied by seed, and theme-specific.
 */

/** Room a decor piece may need: it stays small, so it never reads as a hazard or somewhere to stand. */
export const DECOR_MAX_CLEAR = 3;
/** Widest run of tiles one piece spans (a fence). */
export const DECOR_MAX_SPAN = 4;

export interface DecorRule {
  /** `top`: grows on the ground, in the air above a solid tile. `under`: hangs from a ceiling, in the air below one. */
  place: 'top' | 'under';
  /** Themes it dresses. A kind in more than one is shared; each theme still needs pieces of its own. */
  themes: readonly ThemeId[];
  /** Relative pick weight within a theme's decor. */
  weight: number;
  /** Empty tiles it needs above (top) or below (under). */
  clear: number;
  /** Tiles of ground it runs along, at least and at most (a fence); default one. */
  span?: readonly [number, number];
}

/** Register a decor kind: the rule as written, typed. */
export const defineDecor = (r: DecorRule): DecorRule => r;

const RULES = {
  // ---- shared -------------------------------------------------------------
  crystal: defineDecor({ place: 'top', themes: ['volcano', 'mine', 'space'], weight: 1, clear: 1 }),
  mushroom: defineDecor({ place: 'top', themes: ['jungle', 'mine'], weight: 1, clear: 1 }),
  flower: defineDecor({ place: 'top', themes: ['farm', 'jungle'], weight: 1.2, clear: 1 }),
  lantern: defineDecor({ place: 'under', themes: ['harbor', 'mine', 'glacier'], weight: 1, clear: 1 }),
  vine: defineDecor({ place: 'under', themes: ['castle', 'jungle'], weight: 1.6, clear: 1 }),
  bones: defineDecor({ place: 'top', themes: ['castle', 'volcano', 'mine', 'glacier', 'space'], weight: 0.6, clear: 1 }),
  torch: defineDecor({ place: 'top', themes: ['castle'], weight: 1, clear: 2 }),
  pipe: defineDecor({ place: 'top', themes: ['factory', 'rooftops'], weight: 1, clear: 2 }),
  // ---- farm ---------------------------------------------------------------
  fence: defineDecor({ place: 'top', themes: ['farm'], weight: 1.4, clear: 1, span: [2, 4] }),
  haybale: defineDecor({ place: 'top', themes: ['farm'], weight: 1, clear: 1 }),
  wheat: defineDecor({ place: 'top', themes: ['farm'], weight: 1.6, clear: 1 }),
  pumpkin: defineDecor({ place: 'top', themes: ['farm'], weight: 0.8, clear: 1 }),
  sunflower: defineDecor({ place: 'top', themes: ['farm'], weight: 0.9, clear: 2 }),
  scarecrow: defineDecor({ place: 'top', themes: ['farm'], weight: 0.5, clear: 2 }),
  trough: defineDecor({ place: 'top', themes: ['farm'], weight: 0.7, clear: 1 }),
  churn: defineDecor({ place: 'top', themes: ['farm'], weight: 0.7, clear: 1 }),
  sacks: defineDecor({ place: 'top', themes: ['farm'], weight: 0.8, clear: 1 }),
  barrow: defineDecor({ place: 'top', themes: ['farm'], weight: 0.6, clear: 1 }),
  vane: defineDecor({ place: 'top', themes: ['farm'], weight: 0.4, clear: 3 }),
  stile: defineDecor({ place: 'top', themes: ['farm'], weight: 0.6, clear: 2 }),
  coop: defineDecor({ place: 'top', themes: ['farm'], weight: 0.5, clear: 2 }),
  hive: defineDecor({ place: 'top', themes: ['farm'], weight: 0.6, clear: 1 }),
  tyre: defineDecor({ place: 'top', themes: ['farm'], weight: 0.6, clear: 1 }),
  well: defineDecor({ place: 'top', themes: ['farm'], weight: 0.4, clear: 2 }),
  plough: defineDecor({ place: 'top', themes: ['farm'], weight: 0.5, clear: 1 }),
  // ---- factory ------------------------------------------------------------
  vent: defineDecor({ place: 'top', themes: ['factory', 'rooftops'], weight: 1, clear: 2 }),
  barrel: defineDecor({ place: 'top', themes: ['factory', 'harbor'], weight: 1.2, clear: 1 }),
  crate: defineDecor({ place: 'top', themes: ['factory', 'harbor'], weight: 1, clear: 1 }),
  beacon: defineDecor({ place: 'top', themes: ['factory', 'space'], weight: 0.7, clear: 1 }),
  chain: defineDecor({ place: 'under', themes: ['factory', 'castle'], weight: 1, clear: 2 }),
  cable: defineDecor({ place: 'under', themes: ['factory', 'rooftops', 'space'], weight: 0.8, clear: 2 }),
  cagelamp: defineDecor({ place: 'under', themes: ['factory'], weight: 0.9, clear: 1 }),
  // ---- castle -------------------------------------------------------------
  banner: defineDecor({ place: 'under', themes: ['castle'], weight: 1.2, clear: 2 }),
  skull: defineDecor({ place: 'top', themes: ['castle', 'volcano'], weight: 0.5, clear: 1 }),
  // ---- jungle -------------------------------------------------------------
  fern: defineDecor({ place: 'top', themes: ['jungle'], weight: 1.6, clear: 1 }),
  bigleaf: defineDecor({ place: 'top', themes: ['jungle'], weight: 1, clear: 2 }),
  roots: defineDecor({ place: 'under', themes: ['jungle'], weight: 1, clear: 1 }),
  // ---- volcano ------------------------------------------------------------
  fumarole: defineDecor({ place: 'top', themes: ['volcano'], weight: 1, clear: 2 }),
  obsidian: defineDecor({ place: 'top', themes: ['volcano'], weight: 1, clear: 1 }),
  basaltcols: defineDecor({ place: 'top', themes: ['volcano'], weight: 1, clear: 1 }),
  pillow: defineDecor({ place: 'top', themes: ['volcano'], weight: 1, clear: 1 }),
  sulphur: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.9, clear: 2 }),
  stump: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.8, clear: 2 }),
  bonepile: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.8, clear: 1 }),
  emberrock: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.9, clear: 1 }),
  cauldron: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.6, clear: 2 }),
  skullrock: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.6, clear: 2 }),
  ashdrift: defineDecor({ place: 'top', themes: ['volcano'], weight: 1, clear: 1 }),
  idol: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.5, clear: 1 }),
  bridgepost: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.5, clear: 2 }),
  spattercone: defineDecor({ place: 'top', themes: ['volcano'], weight: 0.7, clear: 2 }),
  // ---- harbor -------------------------------------------------------------
  rope: defineDecor({ place: 'top', themes: ['harbor'], weight: 1, clear: 1 }),
  bollard: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.8, clear: 1 }),
  lamppost: defineDecor({ place: 'top', themes: ['harbor'], weight: 1, clear: 3 }),
  gull: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.6, clear: 1 }),
  net: defineDecor({ place: 'under', themes: ['harbor'], weight: 0.7, clear: 2 }),
  lobsterpot: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.9, clear: 1 }),
  anchor: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.6, clear: 1 }),
  helm: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.5, clear: 1 }),
  buoy: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.8, clear: 1 }),
  fishbox: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.9, clear: 1 }),
  piling: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.8, clear: 1 }),
  rowboat: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.6, clear: 1 }),
  lifering: defineDecor({ place: 'top', themes: ['harbor'], weight: 0.7, clear: 1 }),
  // ---- mine ---------------------------------------------------------------
  support: defineDecor({ place: 'top', themes: ['mine'], weight: 1, clear: 2 }),
  minecart: defineDecor({ place: 'top', themes: ['mine'], weight: 0.8, clear: 1 }),
  pickaxe: defineDecor({ place: 'top', themes: ['mine'], weight: 0.6, clear: 1 }),
  orepile: defineDecor({ place: 'top', themes: ['mine'], weight: 1, clear: 1 }),
  dynamite: defineDecor({ place: 'top', themes: ['mine'], weight: 0.6, clear: 1 }),
  canary: defineDecor({ place: 'under', themes: ['mine'], weight: 0.5, clear: 3 }),
  bucket: defineDecor({ place: 'under', themes: ['mine'], weight: 0.7, clear: 3 }),
  buffer: defineDecor({ place: 'top', themes: ['mine'], weight: 0.5, clear: 1 }),
  postlamp: defineDecor({ place: 'top', themes: ['mine'], weight: 0.7, clear: 2 }),
  stalagmite: defineDecor({ place: 'top', themes: ['mine'], weight: 1.1, clear: 1 }),
  stalactite: defineDecor({ place: 'under', themes: ['mine'], weight: 1.4, clear: 1 }),
  rails: defineDecor({ place: 'top', themes: ['mine'], weight: 0.7, clear: 1, span: [2, 3] }),
  // ---- rooftops -----------------------------------------------------------
  antenna: defineDecor({ place: 'top', themes: ['rooftops', 'space'], weight: 1, clear: 3 }),
  acunit: defineDecor({ place: 'top', themes: ['rooftops'], weight: 1, clear: 1 }),
  neon: defineDecor({ place: 'top', themes: ['rooftops'], weight: 0.9, clear: 2 }),
  dish: defineDecor({ place: 'top', themes: ['rooftops', 'space'], weight: 0.7, clear: 2 }),
  // ---- glacier ------------------------------------------------------------
  cairn: defineDecor({ place: 'top', themes: ['glacier'], weight: 1, clear: 2 }),
  pennant: defineDecor({ place: 'top', themes: ['glacier', 'space'], weight: 0.7, clear: 3 }),
  icicles: defineDecor({ place: 'under', themes: ['glacier'], weight: 1.2, clear: 1 }),
  // ---- space --------------------------------------------------------------
  lander: defineDecor({ place: 'top', themes: ['space'], weight: 0.8, clear: 2 }),
} satisfies Record<string, DecorRule>;

export type DecorKind = keyof typeof RULES;

/** Every decor kind's rule. */
export const DECOR_RULES: Readonly<Record<DecorKind, DecorRule>> = RULES;
export const DECOR_KINDS = Object.keys(RULES) as DecorKind[];

/** The decor registered for a theme, in registry order. */
export function decorFor(theme: ThemeId): DecorKind[] {
  return DECOR_KINDS.filter((k) => RULES[k].themes.includes(theme));
}

/** Kinds registered for this theme and no other. */
export function ownDecor(theme: ThemeId): DecorKind[] {
  return decorFor(theme).filter((k) => RULES[k].themes.length === 1);
}

/**
 * The kinds a theme look shows: `always` (its signature pieces), then `n` in all from the rest of what's
 * registered for the theme (or `from`, a narrower pool for one variant of the look), shuffled by the seed.
 * Adding a kind to a theme widens its pool without shifting any other roll of the look.
 */
export function pickDecor(rng: Rng, theme: ThemeId, always: readonly DecorKind[], n: number, from?: readonly DecorKind[]): DecorKind[] {
  const pool = (from ?? decorFor(theme)).filter((k) => !always.includes(k));
  const opt = rng.shuffle(pool.slice());
  return [...always, ...opt.slice(0, Math.max(0, n - always.length))];
}

/** One placed decor piece. Pixel position is where it stands (top) or hangs from (under). */
export interface DecorSpot {
  kind: DecorKind;
  x: number;
  y: number;
  /** The solid tile it grows on or hangs from: it goes when that tile does. */
  tx: number;
  ty: number;
  seed: number;
  size: number;
  /** Tiles spanned (fences). */
  span: number;
  flip: boolean;
}

/** What decides a level's decor: its terrain and its look's list. */
export interface DecorLook {
  decor: readonly DecorKind[];
  decorDensity: number;
}

/**
 * Where the level's decor goes: a pure function of the level and its look. Every solid tile with open air
 * above may grow a `top` piece (`decorDensity`), every one with air below a hanging piece, if the piece's
 * room is clear. Nothing grows by the spawn or the flag, inside `skip` (a host's hole for the real level),
 * or on a landmark that wears its own skin: it's dressed by its own art.
 */
export function placeDecor(level: Level, look: DecorLook, skip?: TileRect): DecorSpot[] {
  const rng = new Rng(deriveSeed(level.seed, 'decor'));
  const out: DecorSpot[] = [];
  const solid = (x: number, y: number) => tileAt(level, x, y) !== T_EMPTY && tileAt(level, x, y) !== T_ONEWAY;
  const air = (x: number, y: number) => tileAt(level, x, y) === T_EMPTY && x >= 0 && x < level.w;
  const near = (tx: number, ty: number, p: { tx: number; ty: number }) => Math.abs(tx - p.tx) <= 1 && ty >= p.ty && ty <= p.ty + 2;
  const tops = look.decor.filter((k) => RULES[k].place === 'top');
  const unders = look.decor.filter((k) => RULES[k].place === 'under');
  const pick = (list: readonly DecorKind[]) => {
    let total = 0;
    for (const k of list) total += RULES[k].weight;
    let r = rng.next() * total;
    for (const k of list) {
      r -= RULES[k].weight;
      if (r < 0) return k;
    }
    return list[list.length - 1];
  };
  const lm = level.landmark?.skin ? level.landmark.rect : null;
  const inRect = (r: TileRect | null | undefined, x: number, y: number) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const taken = new Set<number>();
  for (let ty = 1; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      if (!solid(tx, ty) || inRect(skip, tx, ty) || inRect(lm, tx, ty) || inRect(lm, tx, ty - 1)) continue;
      const top = air(tx, ty - 1);
      const under = ty < level.h - 1 && air(tx, ty + 1);
      const roll = rng.next();
      const spot = near(tx, ty - 1, level.spawn) || near(tx, ty - 1, level.goal);
      if (top && tops.length && roll < look.decorDensity && !spot && !taken.has(ty * level.w + tx)) {
        const kind = pick(tops);
        const rule: DecorRule = RULES[kind];
        let ok = true;
        for (let k = 1; k <= rule.clear; k++) if (!air(tx, ty - k)) ok = false;
        const [lo, hi] = rule.span ?? [1, 1];
        let span = 1;
        if (ok) while (span < hi && solid(tx + span, ty) && air(tx + span, ty - 1) && !taken.has(ty * level.w + tx + span)) span++;
        if (ok && span >= lo) {
          for (let k = 0; k < span; k++) taken.add(ty * level.w + tx + k);
          out.push({
            kind,
            x: hi > 1 ? tx * TILE + 1 : tx * TILE + rng.range(4, 12),
            y: ty * TILE,
            tx,
            ty,
            seed: rng.int(0, 1e9),
            size: rng.range(0.85, 1.25),
            span,
            flip: rng.chance(0.5),
          });
        }
      }
      if (under && unders.length && rng.chance(look.decorDensity * 0.9)) {
        const kind = pick(unders);
        let ok = true;
        for (let k = 1; k <= RULES[kind].clear; k++) if (!air(tx, ty + k)) ok = false;
        if (ok)
          out.push({
            kind,
            x: tx * TILE + rng.range(3, 13),
            y: (ty + 1) * TILE,
            tx,
            ty,
            seed: rng.int(0, 1e9),
            size: rng.range(0.85, 1.3),
            span: 1,
            flip: rng.chance(0.5),
          });
      }
    }
  }
  return out;
}

/**
 * The contract each placed piece keeps, checked by tests/conformance on real levels: it grows on (or hangs
 * from) a solid tile, its room is open air, it stays small, and it's off the spawn and the flag.
 */
export function decorFaults(level: Level, spots: readonly DecorSpot[]): string[] {
  const out: string[] = [];
  const at = (x: number, y: number) => tileAt(level, x, y);
  for (const d of spots) {
    const r = RULES[d.kind];
    const where = `${d.kind} at ${d.tx},${d.ty}`;
    if (at(d.tx, d.ty) !== 1) out.push(`${where}: not on a solid tile`);
    const dir = r.place === 'top' ? -1 : 1;
    for (let k = 1; k <= r.clear; k++)
      for (let i = 0; i < d.span; i++) if (at(d.tx + i, d.ty + dir * k) !== T_EMPTY) out.push(`${where}: its room isn't open air`);
    if (r.clear > DECOR_MAX_CLEAR || d.span > DECOR_MAX_SPAN) out.push(`${where}: too big for decor`);
    for (const p of [level.spawn, level.goal])
      if (r.place === 'top' && Math.abs(d.tx - p.tx) <= 1 && d.ty - 1 >= p.ty && d.ty - 1 <= p.ty + 2) out.push(`${where}: by the spawn or the flag`);
  }
  return out;
}

/** Every theme with the kinds registered for it (for the per-theme count). */
export const decorByTheme = (): Record<ThemeId, DecorKind[]> => Object.fromEntries(THEME_IDS.map((t) => [t, decorFor(t)])) as Record<ThemeId, DecorKind[]>;
