import { TILE } from './constants';
import type { Level } from './level';
import { DEFAULT_SURFACE, type Solid, type Surface, wallKind } from './physics';
import type { Wind } from './wind';

/**
 * Weather: one per level, fixed by worldgen (gen/level/weather.ts) and stored
 * on the level, so it crosses the wire with the level's seed. There is no
 * weather state in a race. Everything here is arithmetic on (weather, frame),
 * which is what lets rollback, late joiners and the art all agree without
 * anything being sent.
 *
 *  - wind: gusts on a fixed beat, each one a level-wide column for sim/wind.ts
 *    that also carries projectiles. A warning always runs before the push.
 *  - rain, snow: everything you can stand on gets slick through the ordinary
 *    Surface model: tiles through `tileSurface`, props and platforms through
 *    `wetSolids`. reach.ts and every ghost in worldgen walk on the same footing.
 *  - mist: render only (render/weather.ts). It can't change the sim, so it has
 *    no entry here beyond its name.
 */

export const WEATHER_KINDS = ['clear', 'wind', 'mist', 'rain', 'snow'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** Plain data on the level. `dir`, `period` and `first` only mean something for gusts. */
export interface Weather {
  kind: WeatherKind;
  /** Which way gusts blow: 1 toward +x, -1 toward -x, 0 no gusts. */
  dir: -1 | 0 | 1;
  /** Frames from one gust's warning to the next one's. */
  period: number;
  /** Race frame of the first warning. */
  first: number;
}

export const CLEAR: Weather = { kind: 'clear', dir: 0, period: 0, first: 0 };

interface WeatherSim {
  /** What plain ground feels like underfoot; other surfaces get it through `underfoot`. Walls stay as they were: footing never takes a wall jump away. */
  surface?: Surface;
  /** Blows gusts (needs `dir`). */
  gusts?: boolean;
}

/** Rain: same speed, long skids. Snow: a little slower, and about twice the distance to stop. */
export const WEATHER: Record<WeatherKind, WeatherSim> = {
  clear: {},
  wind: { gusts: true },
  mist: {},
  rain: { surface: { ...DEFAULT_SURFACE, friction: 0.42, wall: 'normal' } },
  snow: { surface: { ...DEFAULT_SURFACE, friction: 0.45, speedMult: 0.94, wall: 'normal' } },
};

/**
 * Gust timing in frames. A cycle is warn → rise → hold → fall → lull. The
 * air between two gusts always outlasts the longest move reach.ts proves
 * (LONGEST_MOVE, held by a test), so any level proved in calm air can be
 * crossed one move at a time between gusts.
 */
export const GUST = {
  /** Air speed at full push (px/s). Past a walk, so standing or strolling into one loses ground; short of a run, so running always holds it. */
  speed: 120,
  /** Frames the warning shows before anything moves. */
  warn: 72,
  rise: 14,
  hold: 90,
  fall: 26,
  /** Range of `Weather.period`. */
  period: [460, 620],
  /** Range of `Weather.first`: after the countdown, with time to leave the start. */
  first: [200, 300],
} as const;

/** Frames into the current cycle, or -1 before the first warning or without gusts. */
function cycle(w: Weather | undefined, f: number): number {
  if (!w || !WEATHER[w.kind].gusts || f < w.first) return -1;
  return (f - w.first) % w.period;
}

/** 0..1 share of full gust speed at race frame `f`. Exactly 0 through every warning. */
export function gustPush(w: Weather | undefined, f: number): number {
  const c = cycle(w, f) - GUST.warn;
  if (c < 0) return 0;
  if (c < GUST.rise) return (c + 1) / GUST.rise;
  if (c < GUST.rise + GUST.hold) return 1;
  const d = c - GUST.rise - GUST.hold;
  return d < GUST.fall ? 1 - (d + 1) / GUST.fall : 0;
}

/** 0..1 ramp through the warning before a gust; 0 otherwise. What the art and sound show first. */
export function gustWarning(w: Weather | undefined, f: number): number {
  const c = cycle(w, f);
  return c >= 0 && c < GUST.warn ? (c + 1) / GUST.warn : 0;
}

/** Signed air speed of the gust at frame `f` (px/s, + right). Projectiles drift with it. */
export function gustAir(level: Level, f: number): number {
  const w = level.weather;
  return w && w.dir !== 0 ? w.dir * GUST.speed * gustPush(w, f) : 0;
}

/** How much of a warning shows, as a share of a full gust: one that's coming already looks like one. */
const WARNED = 0.62;

/**
 * What a viewer gets to see of the wind at frame `f`: 0 in still air, else
 * signed by heading, up to ±1 at full push. Everything that shows wind reads
 * this (dashes, banners, grass, the whistle), so nothing moves in the wind
 * unless a gust is coming or blowing.
 */
export function gustShown(w: Weather | undefined, f: number): number {
  if (!w || w.dir === 0) return 0;
  return w.dir * Math.max(gustWarning(w, f) * WARNED, gustPush(w, f));
}

/** How far past the level a gust's column reaches: its taper (sim/wind.ts) has to fall outside the world. */
const REACH = 8 * TILE;

/** This frame's gust as one level-wide side wind, or null in a lull. */
export function gustWind(level: Level, f: number): Wind | null {
  const w = level.weather;
  if (!w || w.dir === 0) return null;
  const k = gustPush(w, f);
  if (k <= 0) return null;
  return { x: -REACH, y: -REACH * 8, w: level.w * TILE + REACH * 2, h: level.h * TILE + REACH * 9, dx: w.dir, dy: 0, speed: GUST.speed, k };
}

/** The surface under foot on this level's terrain, or undefined on ordinary ground. */
export function footing(level: Level): Surface | undefined {
  return level.weather && WEATHER[level.weather.kind].surface;
}

const SLICK = new WeakMap<Surface, WeakMap<Surface, Surface>>();

/**
 * `base` with footing `f` on it: ice stays slicker than wet stone, a conveyor
 * still runs and jelly still bounces, all with less grip than in the dry. A
 * pure function; the memo only spares a race an allocation per solid per frame.
 */
export function underfoot(base: Surface, f: Surface): Surface {
  if (base === DEFAULT_SURFACE) return f;
  let byBase = SLICK.get(f);
  if (!byBase) SLICK.set(f, (byBase = new WeakMap()));
  let s = byBase.get(base);
  if (!s) byBase.set(base, (s = { ...base, friction: base.friction * f.friction, speedMult: base.speedMult * f.speedMult, wall: wallKind(base) }));
  return s;
}

/** Put the level's footing on everything standing in it this frame: blocks, platforms, set pieces, gliders. Blood sits on top of the weather. */
export function wetSolids(solids: Solid[], level: Level): void {
  const f = footing(level);
  if (f) for (const s of solids) if (!s.film) s.surface = underfoot(s.surface, f);
}
