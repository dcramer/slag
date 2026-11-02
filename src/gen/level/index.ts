import { footprintCells, type PlacedProp } from '../../sim/props';
import { BRIDGE_W } from './validate';
import { deriveSeed, Rng } from '../../core/rng';
import type { Level, LevelProfile } from '../../sim/level';
import { pickThemeId, type ThemeId } from '../../themes';
import { SET_PIECE_UID, SET_PIECES } from '../setpieces';
import { generateTheme, type Theme } from '../theme';
import { ReachCache } from '../../sim/reach';
import { openUp } from './lanes';
import { setProbeGravity } from './probe';
import { type ProfileOverride, rollProfile } from './profile';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { FALLBACK_SCULPTOR, SCULPTORS } from './sculptors';
import { LAST_RESORT } from './sculptors/common';
import type { Shape } from './types';
import { type Bridge, judge, oneBridgeEnough } from './validate';
import { rollWeather } from './weather';
import { planHolds } from './winnable';

export type { BridgeHint, SculptCtx, Sculptor, Shape } from './types';
export { describeProfile, GRAVITY, type GravityClass, gravityClass, type ProfileOverride, rollProfile } from './profile';
export { BRIDGE_W, type Bridge, canPlaceBridge, isAcceptable, judge, MAX_BRIDGES, withBridges } from './validate';
export { fieldOf, partsNeeded, planHolds, prove, settled } from './winnable';
export { WEATHER_WEIGHTS } from './weather';

const MAX_ATTEMPTS = 30;
const LEGACY_ATTEMPTS = 20;

/** Diagnostics about the last generateLevel call (for tools/tests). */
export interface GenInfo {
  attempts: number;
  /** A bridge solution (left cells) when the level needs props; [] if solvable bare. */
  bridges: Bridge[];
  fallback: boolean;
  /** Route sharing of the accepted level (./routes.ts), and of its sculpt before any lanes were added. */
  shared: number;
  sculpted: number;
  /** Candidates rejected on the way here, by reason (`closed` = still too narrow after lanes). */
  rejects: { unsolvable: number; tooEasy: number; closed: number };
}

export let lastGenInfo: GenInfo = { attempts: 0, bridges: [], fallback: false, shared: 1, sculpted: 1, rejects: { unsolvable: 0, tooEasy: 0, closed: 0 } };
/** Attempts used by the last generateLevel call (kept for older callers). */
export let lastGenAttempts = 0;

/**
 * Level pipeline: pick theme → roll the variety profile (size, density,
 * route, hazards; ./profile.ts) → generate look → sculpt terrain (retrying
 * until it passes the solvability policy in ./validate.ts and, with lanes
 * from ./lanes.ts if it needs them, the mostly-open rule in ./routes.ts) →
 * place theme set pieces. If the theme sculptor keeps failing, the legacy sculptor gets
 * a few tries before the flat floor; both count as `fallback` in
 * lastGenInfo (tests assert neither happens). Weather comes last (./weather.ts)
 * and can't change the terrain.
 */
export function generateLevel(seed: number, themeOverride?: ThemeId, profileOverride?: ProfileOverride): Level {
  const themeId = themeOverride ?? pickThemeId(seed);
  const theme = generateTheme(seed, themeId);
  const profile = rollProfile(seed, themeId, profileOverride);
  // Sculptor helpers size gaps/steps from jumps measured at this level's gravity.
  setProbeGravity(profile.gravity);
  const challenge = new Rng(deriveSeed(seed, `challenge:${themeId}`)).next();
  const rejects = { unsolvable: 0, tooEasy: 0, closed: 0 };
  for (let attempt = 0; attempt < MAX_ATTEMPTS + LEGACY_ATTEMPTS; attempt++) {
    const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
    const sculptor = attempt < MAX_ATTEMPTS ? SCULPTORS[themeId] : FALLBACK_SCULPTOR;
    const shape = sculptor({ rng, themeId, theme, attempt, profile, challenge });
    const level = toLevel(seed, shape, theme, profile);
    const cache = new ReachCache(level);
    // Passable bare: not a level. Only the very last attempts accept it, to keep generation total.
    const insist = attempt < LAST_RESORT;
    if (insist && cache.analyze(level).goalReached) {
      rejects.tooEasy++;
      continue;
    }
    const v = judge(level, shape.bridgeHints, shape.crossings, cache);
    if (!v.ok) {
      rejects.unsolvable++;
      continue;
    }
    let shared = v.shared;
    if (!v.open) {
      // Mostly open: give the level the second route it lacks. Lanes stay away from bridges, so the
      // solution still stands; openUp's own analysis re-proves it (an unreachable goal scores 1).
      const routes = openUp(level, shape, v.bridges, new Rng(deriveSeed(seed, `lanes:${attempt}`)), cache);
      if (routes.shared > MAX_SHARED) {
        rejects.closed++;
        continue;
      }
      if (v.bridges.length && insist && cache.analyze(level).goalReached) {
        rejects.tooEasy++;
        continue;
      }
      shared = routes.shared;
    }
    // The count sets what crates offer, so it has to be the real one, on the final terrain.
    const one = v.bridges.length === 2 ? oneBridgeEnough(level, shape.bridgeHints, cache) : null;
    const bridges = one ? [one] : v.bridges;
    if (one) {
      shared = analyzeRoutes(level, bridges, cache).shared;
      if (shared > MAX_SHARED) {
        rejects.closed++;
        continue;
      }
    }
    lastGenAttempts = attempt + 1;
    lastGenInfo = { attempts: attempt + 1, bridges, fallback: attempt >= MAX_ATTEMPTS, shared, sculpted: v.shared, rejects };
    level.solution = bridges;
    // Before the set pieces: their placer checks the path with the ghost, which walks on this footing.
    level.weather = rollWeather(seed, theme, level, profileOverride?.weather);
    // Set pieces must never block the known prop solution: a match starts from it, keeping clear of every
    // piece's barrier (./winnable.ts), so a piece goes in only if the solution still holds that way.
    const keep = (pieces: readonly PlacedProp[]) => planHolds(level, pieces, bridges, cache);
    const pieces = SET_PIECES[themeId](new Rng(deriveSeed(seed, `setpieces:${attempt}`)), level, {
      count: profile.hazards,
      danger: profile.danger,
      cache,
      keep,
    });
    const needed = new Set(bridges.flatMap((b) => Array.from({ length: BRIDGE_W }, (_, i) => b.y * level.w + b.x + i)));
    // (The placer already avoids these cells; this is a safety net. Keep uids contiguous.)
    level.setPieces = pieces.filter((p) => !footprintCells(p).some(([x, y]) => needed.has(y * level.w + x))).map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
    while (level.setPieces.length && !planHolds(level, [], bridges, cache)) level.setPieces.pop();
    return level;
  }
  lastGenAttempts = MAX_ATTEMPTS + LEGACY_ATTEMPTS;
  lastGenInfo = { attempts: lastGenAttempts, bridges: [], fallback: true, shared: 1, sculpted: 1, rejects };
  return toLevel(seed, fallbackShape(profile.w, profile.h), theme, profile);
}

function toLevel(seed: number, s: Shape, theme: Theme, profile: LevelProfile): Level {
  if (s.tiles.length !== s.w * s.h) throw new Error(`shape ${s.style}: tiles ${s.tiles.length} != ${s.w}×${s.h}`);
  return {
    seed,
    w: s.w,
    h: s.h,
    gravity: profile.gravity,
    profile,
    tiles: s.tiles,
    spawn: s.spawn,
    goal: s.goal,
    protectedRects: s.protectedRects,
    theme,
    style: s.style,
    version: 0,
    setPieces: [],
  };
}

/** Flat floor, always solvable. Only used if every candidate fails. */
function fallbackShape(w: number, h: number): Shape {
  const tiles = new Uint8Array(w * h);
  const row = h - 6;
  for (let y = row + 1; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = 1;
  return {
    w,
    h,
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: w - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: w - 5, y: row - 3, w: 5, h: 5 },
    ],
    style: 'fallback',
  };
}

export function cloneLevel(l: Level): Level {
  return { ...l, tiles: new Uint8Array(l.tiles), protectedRects: l.protectedRects.map((r) => ({ ...r })), setPieces: l.setPieces.slice() };
}
