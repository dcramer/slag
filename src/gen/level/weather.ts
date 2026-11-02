import { deriveSeed, Rng } from '../../core/rng';
import type { Level } from '../../sim/level';
import { analyzeReach } from '../../sim/reach';
import { CLEAR, GUST, type Weather, type WeatherKind } from '../../sim/weather';
import type { ThemeId } from '../../themes';
import type { Theme } from '../theme';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { canPlaceBridge, partsInAir } from './validate';

/**
 * Picks a level's weather, once its terrain and solution are final. The roll
 * comes after the sculpt and from its own stream, so a level's tiles, part
 * count and bridges are the same whatever the weather turns out to be: the
 * shares of levels needing parts can't move. The gate then keeps the weather
 * off any level it would change, proved with the real controller:
 *
 *  - rain and snow: the recorded solution still works on that footing, the
 *    level is still mostly open, and it didn't get passable bare.
 *  - wind: a gust may not do a part's job. With gusts available whenever the
 *    player likes, the level must need as many parts as it does in calm air.
 *    A tailwind that fails this turns around: routes run left to right, so a
 *    headwind gives nothing away.
 *    It can't make a level unsolvable, because the calm-air proof still
 *    stands: every move in it fits inside a lull (`GUST`, held by
 *    tests/weather.test.ts) and a runner can hold their ground through a gust by running into it:
 *    it beats a walk and loses to a run.
 *  - mist never touches the sim.
 *
 * A level that fails stays clear.
 */

type Weights = readonly (readonly [WeatherKind, number])[];

/** Most levels stay clear. Underground and indoors there's no sky to rain. */
export const WEATHER_WEIGHTS: Record<ThemeId, Weights> = {
  farm: [
    ['clear', 70],
    ['wind', 12],
    ['rain', 10],
    ['mist', 4],
    ['snow', 4],
  ],
  factory: [
    ['clear', 80],
    ['mist', 12],
    ['wind', 8],
  ],
  castle: [
    ['clear', 72],
    ['mist', 10],
    ['snow', 10],
    ['wind', 8],
  ],
  jungle: [
    ['clear', 66],
    ['rain', 20],
    ['mist', 14],
  ],
  volcano: [
    ['clear', 76],
    ['mist', 14],
    ['wind', 10],
  ],
  harbor: [
    ['clear', 62],
    ['wind', 14],
    ['mist', 14],
    ['rain', 10],
  ],
  mine: [
    ['clear', 86],
    ['mist', 14],
  ],
  rooftops: [
    ['clear', 64],
    ['wind', 18],
    ['rain', 12],
    ['snow', 6],
  ],
};

/** The kind this seed rolls on its theme's weights, before the gate has its say. */
export function rollKind(seed: number, themeId: ThemeId): WeatherKind {
  return new Rng(deriveSeed(seed, `weather:${themeId}`)).weighted(WEATHER_WEIGHTS[themeId]);
}

/** Weather of `kind` for this seed, unchecked: what `?weather=` forces, and what the gate is asked about. */
function spec(seed: number, kind: WeatherKind): Weather {
  const rng = new Rng(deriveSeed(seed, 'gusts'));
  const dir = rng.chance(0.5) ? 1 : -1;
  const period = rng.int(GUST.period[0], GUST.period[1]);
  const first = rng.int(GUST.first[0], GUST.first[1]);
  return kind === 'wind' ? { kind, dir, period, first } : { ...CLEAR, kind };
}

/** Does this footing leave the level as `level.solution` says it is? */
export function footingHolds(level: Level, weather: Weather): boolean {
  const wet = { ...level, weather };
  const solution = level.solution ?? [];
  if (solution.length && analyzeReach(wet).goalReached) return false;
  return solution.every((b) => canPlaceBridge(wet, b)) && analyzeRoutes(wet, solution).shared <= MAX_SHARED;
}

/** Does a level with gusts of `air` px/s still need every part it needs in calm air? */
export function gustHolds(level: Level, air: number): boolean {
  const parts = level.solution?.length ?? 0;
  if (parts === 0) return true;
  if (analyzeReach(level, true, undefined, [0, air]).goalReached) return false;
  return parts === 1 || partsInAir(level, air) >= parts;
}

/** A level's weather, deterministic from (seed, theme, terrain). `force` skips the roll and the gate (dev only). */
export function rollWeather(seed: number, theme: Theme, level: Level, force?: WeatherKind): Weather {
  const kind = force ?? rollKind(seed, theme.id);
  const w = spec(seed, kind);
  if (force || kind === 'clear' || kind === 'mist') return w;
  if (kind !== 'wind') return footingHolds(level, w) ? w : CLEAR;
  const heading = [w.dir, w.dir > 0 ? -1 : 1] as const;
  for (const dir of heading) if (gustHolds(level, dir * GUST.speed)) return { ...w, dir };
  return CLEAR;
}
