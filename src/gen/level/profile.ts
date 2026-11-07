import { deriveSeed, Rng } from '../../core/rng';
import { LEVEL_H, LEVEL_W } from '../../sim/constants';
import { type LevelProfile, LOOP_BAND, type RouteShape, type SizeClass } from '../../sim/level';
import { DIFFICULTY, rollDifficulty } from './difficulty';
import type { WeatherKind } from '../../sim/weather';
import type { ThemeId } from '../../themes';

/**
 * Per-level variety: before sculpting, every level rolls a profile from its
 * seed (and theme) — world size/aspect, terrain density, how many set-piece
 * hazards and how nasty, and the route shape.
 * Sculptors read the knobs; the set-piece placer reads hazards/danger.
 *
 * Size classes:
 *   classic  48×27 (fills the view exactly)
 *   wide     64–96 × 24–30 (horizontal sprawl: fields, docks, long rooftop runs)
 *   tall     32–40 × 40–60 (vertical: towers, shafts, fire escapes, canopies)
 *
 * Theme affinity keeps shape language honest: farms, harbors and space
 * sprawl sideways and never go tall; castles, mines, factories, jungles,
 * rooftops, volcanoes and glaciers climb.
 */

type Weights<T> = readonly (readonly [T, number])[];

const SIZE_WEIGHTS: Record<ThemeId, Weights<SizeClass>> = {
  farm: [
    ['classic', 5],
    ['wide', 5],
  ],
  harbor: [
    ['classic', 5],
    ['wide', 5],
  ],
  castle: [
    ['classic', 4],
    ['wide', 2],
    ['tall', 3],
  ],
  mine: [
    ['classic', 4],
    ['wide', 2],
    ['tall', 3],
  ],
  factory: [
    ['classic', 4],
    ['wide', 2],
    ['tall', 3],
  ],
  jungle: [
    ['classic', 4],
    ['wide', 2],
    ['tall', 3],
  ],
  rooftops: [
    ['classic', 4],
    ['wide', 3],
    ['tall', 3],
  ],
  volcano: [
    ['classic', 4],
    ['wide', 3],
    ['tall', 2],
  ],
  glacier: [
    ['classic', 4],
    ['wide', 4],
    ['tall', 2],
  ],
  // Space sprawls: at its gravity a void no jump clears eats most of a tower's storey, leaving no room for a second way up.
  space: [
    ['classic', 4],
    ['wide', 6],
  ],
};

const ROUTE_WEIGHTS: Record<SizeClass, Weights<RouteShape>> = {
  classic: [
    ['ltr', 6],
    ['climb', 2],
    ['descent', 2],
  ],
  wide: [
    ['ltr', 6],
    ['climb', 2],
    ['descent', 2],
  ],
  tall: [
    ['climb', 4],
    ['zigzag', 4],
    ['descent', 2],
  ],
};

const TALL_SIZES = { w: [32, 40], h: [40, 60] } as const;
/** Rows a Rising Slag shaft climbs in a lap before it repeats (Level.loop), and its width in columns, inclusive. */
export const LOOP_ROWS = 48;
export const LOOP_W = [48, 56] as const;
const WIDE_SIZES = { w: [64, 96], h: [24, 30] } as const;

/** Debug/tools: force some knobs (the rest still roll from the seed). A size the theme can't do falls back to its widest. */
export type ProfileOverride = Partial<
  Pick<
    LevelProfile,
    | 'size'
    | 'route'
    | 'density'
    | 'hazards'
    | 'danger'
    | 'setPieceRoles'
    | 'gravity'
    | 'difficulty'
    | 'draw'
    | 'builder'
    | 'loop'
    | 'bare'
    | 'boxes'
    | 'tide'
    | 'ends'
    | 'noWeather'
    | 'curve'
  >
> & {
  weather?: WeatherKind;
  /** A stage concept id of the theme's (gen/stage), or 'plain'; with no size or route forced, the level takes one the concept fits. */
  concept?: string;
};

/**
 * World gravity classes. Jump take-off speed is fixed, so jump height scales
 * ~1/gravity: low ≈ 6.4 tiles (floaty, long arcs), high ≈ 3.3 (snappy, short).
 * Worldgen measures jumps at the level's gravity (probe.ts), so every class
 * gets levels sized for it.
 */
export const GRAVITY = { low: 0.7, normal: 1, high: 1.35 } as const;
export type GravityClass = keyof typeof GRAVITY;

/**
 * Space's own gravity, used on Auto (a host's Low, Normal or High still
 * wins: they chose it). Floatier than Low: a full jump is about 6.6 tiles
 * high and a held jump about a second in the air, the most that still reads
 * as precise. Measured with reach.ts, the jump profile stays consistent here
 * (a falling jump reaches at least as far as a level one), where at 0.6 and
 * below 0.5 it stops being monotone; and a running jump of about 14 tiles
 * still leaves a classic level room for a crossing no jump clears.
 */
export const SPACE_GRAVITY = 0.55;

/** Themes whose world has its own gravity on Auto. */
export const THEME_GRAVITY: Partial<Record<ThemeId, number>> = { space: SPACE_GRAVITY };

export function gravityClass(g: number): GravityClass {
  return g < 0.85 ? 'low' : g > 1.15 ? 'high' : 'normal';
}

/** `salt` rolls another layout for the same seed (a later draw of the level, ./index.ts). */
export function rollProfile(seed: number, themeId: ThemeId, o: ProfileOverride = {}, salt = ''): LevelProfile {
  const rng = new Rng(deriveSeed(seed, `profile:${themeId}${salt}`));
  const rolled = rng.weighted(SIZE_WEIGHTS[themeId]);
  // A loop is a tall shaft in every set (each set's tower kit builds it).
  const size = o.loop ? 'tall' : o.size && SIZE_WEIGHTS[themeId].some(([s]) => s === o.size) ? o.size : o.size === 'tall' ? 'wide' : rolled;
  let w: number = LEVEL_W;
  let h: number = LEVEL_H;
  if (size === 'wide') {
    w = rng.int(WIDE_SIZES.w[0] / 2, WIDE_SIZES.w[1] / 2) * 2;
    h = rng.int(WIDE_SIZES.h[0], WIDE_SIZES.h[1]);
  } else if (size === 'tall') {
    w = rng.int(TALL_SIZES.w[0] / 2, TALL_SIZES.w[1] / 2) * 2;
    // Taller than wide by a clear margin: 40×40 is a square, not a tower.
    h = rng.int(Math.max(TALL_SIZES.h[0], w + 6), TALL_SIZES.h[1]);
    // A loop (Level.loop): a lap's rows and the band it repeats, a screen wide or more so its walls sit on the
    // screen's edges.
    if (o.loop) {
      w = rng.int(LOOP_W[0] / 2, LOOP_W[1] / 2) * 2;
      h = LOOP_ROWS + LOOP_BAND;
    }
  }
  const rolledRoute = rng.weighted(ROUTE_WEIGHTS[size]);
  // A loop climbs: the slag rises up it. A brawl's slag pours into one screen with no route up it, so a route it asks for stands.
  const routes = o.loop ? ROUTE_WEIGHTS[size].filter(([r]) => CLIMBS.has(r)) : ROUTE_WEIGHTS[size];
  const route = o.route && routes.some(([r]) => r === o.route) ? o.route : o.loop ? climbRoute(routes, rolledRoute) : rolledRoute;
  // Density: three moods (sparse / normal / dense) with jitter, so extremes are common enough to notice.
  const mood = rng.weighted<number>([
    [0.15, 3],
    [0.5, 4],
    [0.85, 3],
  ]);
  const density = clamp01(mood + rng.range(-0.12, 0.12));
  // Hazards: bigger worlds have room for more set pieces.
  const hz = rng.weighted<number>([
    [0, 1.2],
    [1, 3],
    [2, 4],
    [3, 3],
    [4, 1.5],
  ]);
  // Rolled from a stream of its own, so the knobs above roll as they always did; harder levels get more set pieces, and nastier ones.
  const difficulty = o.difficulty ?? rollDifficulty(seed);
  const tier = DIFFICULTY[difficulty];
  const hazards = Math.max(0, Math.min(4, hz + (size !== 'classic' && rng.chance(0.4) ? 1 : 0) + tier.hazards));
  const danger = clamp01(tier.danger[0] + rng.range(0, 1) * (tier.danger[1] - tier.danger[0]));
  return {
    size,
    w,
    h,
    density: round2(o.density ?? density),
    hazards: o.hazards ?? hazards,
    danger: round2(o.danger ?? danger),
    route,
    // Rolled last so the other knobs don't depend on it. Mostly normal, sometimes floaty or heavy.
    gravity:
      o.gravity ??
      THEME_GRAVITY[themeId] ??
      GRAVITY[
        rng.weighted<GravityClass>([
          ['normal', 7],
          ['low', 1.5],
          ['high', 1.5],
        ])
      ],
    difficulty,
    ...(o.builder ? { builder: o.builder } : {}),
    ...(o.loop ? { loop: true } : {}),
    ...(o.bare ? { bare: true } : {}),
    ...(o.boxes ? { boxes: o.boxes } : {}),
    ...(o.tide ? { tide: o.tide } : {}),
    ...(o.ends ? { ends: true } : {}),
    ...(o.noWeather?.length ? { noWeather: [...o.noWeather] } : {}),
    ...(o.setPieceRoles?.length ? { setPieceRoles: [...o.setPieceRoles] } : {}),
    // A loop's laps climb the difficulty curve unless the host fixed one difficulty for every level.
    ...(o.loop && size === 'tall' && (o.curve ?? !o.difficulty) ? { curve: true } : {}),
  };
}

/** Routes that go up: a loop the slag rises through has to climb (game/modes.ts, Rising Slag). */
const CLIMBS: ReadonlySet<RouteShape> = new Set(['climb', 'zigzag']);

/** The rolled route if it climbs; otherwise the climbing route it maps to, so the rest of the roll stays the seed's. */
function climbRoute(routes: Weights<RouteShape>, rolled: RouteShape): RouteShape {
  if (routes.some(([r]) => r === rolled)) return rolled;
  return routes[0][0];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** One-line summary for tools/debug. */
export function describeProfile(p: LevelProfile): string {
  const dens = p.density < 0.33 ? 'sparse' : p.density > 0.66 ? 'dense' : 'normal';
  return `${p.difficulty} · ${p.size} ${p.w}×${p.h} · ${p.route} · ${dens} (${p.density}) · hazards ${p.hazards} danger ${p.danger} · gravity ${gravityClass(p.gravity)} (${p.gravity})`;
}
