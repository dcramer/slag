import { footprintCells, type PlacedProp } from '../../sim/props';
import { BRIDGE_W } from './validate';
import { deriveSeed, Rng } from '../../core/rng';
import type { Level, LevelProfile } from '../../sim/level';
import { pickThemeId, type ThemeId } from '../../themes';
import { commit, finalize, SET_PIECE_UID, SET_PIECES, Site } from '../setpieces';
import { type Concept, conceptName, fits, type Landmark, rollConcept } from '../stage';
import { generateTheme, type Theme } from '../theme';
import { ReachCache } from '../../sim/reach';
import { footing } from '../../sim/weather';
import { openUp } from './lanes';
import { setProbeGravity } from './probe';
import { type ProfileOverride, rollProfile } from './profile';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { FALLBACK_SCULPTOR, SCULPTORS } from './sculptors';
import { LAST_RESORT } from './sculptors/common';
import type { Shape } from './types';
import { type Bridge, judge, oneBridgeEnough } from './validate';
import { rideProof, rideSpans } from './ride';
import { rollWeather } from './weather';
import { noFreeRide, planHolds } from './winnable';

export type { BridgeHint, SculptCtx, Sculptor, Shape } from './types';
export { describeProfile, GRAVITY, type GravityClass, gravityClass, type ProfileOverride, rollProfile } from './profile';
export { BRIDGE_W, type Bridge, canPlaceBridge, isAcceptable, judge, MAX_BRIDGES, withBridges } from './validate';
export { fieldOf, partsNeeded, planHolds, prove, settled } from './winnable';
export { WEATHER_WEIGHTS } from './weather';
export { carrierReach, MIN_DWELL, rideProof, rideSpans } from './ride';

const MAX_ATTEMPTS = 30;
const LEGACY_ATTEMPTS = 20;
/** Attempts a stage concept gets to stand up its landmark before the level falls back to plain. */
export const MAX_LANDMARK_REJECTS = 8;

/** Diagnostics about the last generateLevel call (for tools/tests). */
export interface GenInfo {
  attempts: number;
  /** A bridge solution (left cells) when the level needs props; [] if solvable bare. */
  bridges: Bridge[];
  fallback: boolean;
  /** Route sharing of the accepted level (./routes.ts), and of its sculpt before any lanes were added. */
  shared: number;
  sculpted: number;
  /**
   * Candidates rejected on the way here, by reason (`closed` = still too narrow after lanes, `landmark` = the
   * concept's landmark wasn't raised, a required piece of it didn't go in, or a carrier's ride wasn't proven).
   */
  rejects: { unsolvable: number; tooEasy: number; closed: number; landmark: number };
  /** The stage concept the level was built as (gen/stage); absent for a plain level. */
  concept?: string;
  /** A concept was rolled but the level fell back to plain after MAX_LANDMARK_REJECTS. */
  conceptFallback: boolean;
  /** What the landmark's build returned, anchors included (tests and tools read its ways past from them). */
  landmark?: Landmark;
}

export let lastGenInfo: GenInfo = {
  attempts: 0,
  bridges: [],
  fallback: false,
  shared: 1,
  sculpted: 1,
  rejects: { unsolvable: 0, tooEasy: 0, closed: 0, landmark: 0 },
  conceptFallback: false,
};
/** Attempts used by the last generateLevel call (kept for older callers). */
let lastGenAttempts = 0;

/**
 * Level pipeline: pick theme → roll the variety profile (size, density,
 * route, hazards; ./profile.ts) → generate look → sculpt terrain (retrying
 * until it passes the solvability policy in ./validate.ts and, with lanes
 * from ./lanes.ts if it needs them, the mostly-open rule in ./routes.ts) →
 * place theme set pieces. If the theme sculptor keeps failing, the legacy sculptor gets
 * a few tries before the flat floor; both count as `fallback` in
 * lastGenInfo (tests assert neither happens). Weather comes last (./weather.ts)
 * and can't change the terrain.
 *
 * Stage concepts (../stage): the level's concept is rolled once. While it's
 * live, each attempt's sculptor claims a site and raises the landmark's
 * structure as tiles, and the landmark's pieces go in before weather (on the
 * terrain's own footing, so weather never changes the terrain), every one
 * required, before the filler (narrowed to the concept's family). A
 * carrier's pieces go in before the proof instead, and its proven rides
 * (./ride.ts) join every reachability question about the level. A landmark
 * that can't stand up rejects the attempt; MAX_LANDMARK_REJECTS of those and
 * the level goes plain.
 */
export function generateLevel(seed: number, themeOverride?: ThemeId, profileOverride?: ProfileOverride): Level {
  const themeId = themeOverride ?? pickThemeId(seed);
  const theme = generateTheme(seed, themeId);
  let profile = rollProfile(seed, themeId, profileOverride);
  const concept = rollConcept(seed, themeId, profile, profileOverride?.concept);
  // A forced concept gets a size and route it fits, unless those were forced too.
  if (concept && !fits(concept, profile) && !profileOverride?.size && !profileOverride?.route) {
    const size = concept.sizes.includes(profile.size) ? profile.size : concept.sizes[0];
    const route = concept.routes && !concept.routes.includes(profile.route) ? concept.routes[0] : undefined;
    profile = rollProfile(seed, themeId, { ...profileOverride, size, ...(route ? { route } : {}) });
  }
  // Sculptor helpers size gaps/steps from jumps measured at this level's gravity.
  setProbeGravity(profile.gravity);
  const challenge = new Rng(deriveSeed(seed, `challenge:${themeId}`)).next();
  const rejects = { unsolvable: 0, tooEasy: 0, closed: 0, landmark: 0 };
  for (let attempt = 0; attempt < MAX_ATTEMPTS + LEGACY_ATTEMPTS; attempt++) {
    const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
    const sculptor = attempt < MAX_ATTEMPTS ? SCULPTORS[themeId] : FALLBACK_SCULPTOR;
    const live = concept && attempt < MAX_ATTEMPTS && rejects.landmark < MAX_LANDMARK_REJECTS ? concept : undefined;
    const shape = sculptor({ rng, themeId, theme, attempt, profile, challenge, ...(live ? { concept: live } : {}) });
    const landmark = live ? shape.landmark : undefined;
    if (live && !landmark) {
      rejects.landmark++;
      continue;
    }
    const level = toLevel(seed, shape, theme, profile);
    if (live && landmark) level.landmark = { concept: live.id, rect: landmark.rect, ...(landmark.skin ? { skin: landmark.skin } : {}) };
    const cache = new ReachCache(level);
    const landmarkRng = new Rng(deriveSeed(seed, `landmark:${attempt}`));
    // A carrier's ride is part of the proof, so it goes in first; the solution it has to keep comes later.
    let carriers: PlacedProp[] | null = null;
    if (live?.carrier && landmark) {
      carriers = placeLandmark(live, landmark, level, cache, landmarkRng, themeId, () => true, false);
      const rides = carriers?.flatMap((pp) => rideProof(level, pp)) ?? [];
      if (!rides.some((r) => rideSpans(level.w, r, live.carrier?.minGap ?? 0))) {
        rejects.landmark++;
        continue;
      }
      level.rides = rides;
    }
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
    level.solution = bridges;
    // Set pieces must never block the known prop solution: a match starts from it, keeping clear of every
    // piece's barrier (./winnable.ts), so a piece goes in only if the solution still holds that way.
    const keep = (pieces: readonly PlacedProp[]) => planHolds(level, pieces, bridges, cache);
    const needed = new Set(bridges.flatMap((b) => Array.from({ length: BRIDGE_W }, (_, i) => b.y * level.w + b.x + i)));
    const clearOfBridges = (p: PlacedProp) => !footprintCells(p).some(([x, y]) => needed.has(y * level.w + x));
    // The landmark's pieces, all of them: one that won't go in (or a carrier in the solution's way) rejects the attempt.
    // They go in on the terrain's own footing, before the weather: a rejected attempt changes the terrain, and
    // what weather a level gets mustn't (a restored snapshot regenerates the level without it).
    const fixed = landmark ? (carriers ?? placeLandmark(live!, landmark, level, cache, landmarkRng, themeId, keep)) : [];
    // A carrier's free-ride check waits for its rides, so its own crossing is in the baseline.
    const freeRide = (c: PlacedProp, i: number, all: readonly PlacedProp[]) => !noFreeRide(level, c, all.slice(0, i), cache);
    if (!fixed || (carriers && (!carriers.every(clearOfBridges) || !keep(carriers) || carriers.some(freeRide)))) {
      rejects.landmark++;
      continue;
    }
    // Before the filler: its placer checks the path with the ghost, which walks on this footing.
    level.weather = rollWeather(seed, theme, level, profileOverride?.weather);
    // Rain or snow the landmark's pieces can't keep the solution in stays clear, like any the gate turns down.
    if (fixed.length && !profileOverride?.weather && footing(level) && !keep(fixed)) level.weather = rollWeather(seed, theme, level, 'clear');
    // Rain and snow change the footing the routes were measured on (the gate kept them open): record what the level has.
    if (footing(level)) shared = analyzeRoutes(level, bridges, cache).shared;
    lastGenAttempts = attempt + 1;
    lastGenInfo = {
      attempts: attempt + 1,
      bridges,
      fallback: attempt >= MAX_ATTEMPTS,
      shared,
      sculpted: v.shared,
      rejects,
      ...(live && landmark ? { concept: live.id, landmark } : {}),
      conceptFallback: !!concept && !landmark,
    };
    const budget = live ? (live.budget ?? fixed.length) : 0;
    const pieces = SET_PIECES[themeId](new Rng(deriveSeed(seed, `setpieces:${attempt}`)), level, {
      count: Math.max(0, profile.hazards - budget),
      danger: profile.danger,
      cache,
      keep: fixed.length ? (ps) => keep([...fixed, ...ps]) : keep,
      ...(live && landmark ? { standing: fixed, avoid: landmark.air, family: live.family } : {}),
    });
    // (The placer already avoids these cells; this is a safety net. Keep uids contiguous, the landmark's first.)
    level.setPieces = [...fixed, ...pieces.filter(clearOfBridges)].map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
    while (level.setPieces.length && !planHolds(level, [], bridges, cache)) level.setPieces.pop();
    if (level.rides) {
      // A ride is only as good as its carrier.
      level.rides = level.rides.filter((r) => level.setPieces.some((p) => p.uid === r.uid));
      if (!level.rides.length) delete level.rides;
    }
    if (live && landmark) level.theme = { ...theme, name: conceptName(seed, live, theme.name) };
    return level;
  }
  lastGenAttempts = MAX_ATTEMPTS + LEGACY_ATTEMPTS;
  lastGenInfo = { attempts: lastGenAttempts, bridges: [], fallback: true, shared: 1, sculpted: 1, rejects, conceptFallback: !!concept };
  return toLevel(seed, fallbackShape(profile.w, profile.h), theme, profile);
}

/**
 * A landmark's pieces, every one required: each must pass `finalize`, `keep` and, when `free`,
 * `noFreeRide`, or the landmark doesn't stand (null). Their uids come first among the level's set pieces.
 */
function placeLandmark(
  c: Concept,
  l: Landmark,
  level: Level,
  cache: ReachCache,
  rng: Rng,
  themeId: ThemeId,
  keep: (pieces: readonly PlacedProp[]) => boolean,
  free = true,
): PlacedProp[] | null {
  const s = new Site(level, cache);
  const out: PlacedProp[] = [];
  for (const piece of c.pieces(rng, s, l)) {
    const pp = finalize(s, piece, SET_PIECE_UID + out.length, `setpiece:${themeId}:${c.id}`);
    if (!pp || !keep([...out, pp]) || (free && !noFreeRide(level, pp, out, cache))) return null;
    out.push(pp);
    commit(s, pp);
  }
  return out;
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
    ...(s.ground ? { ground: s.ground } : {}),
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
