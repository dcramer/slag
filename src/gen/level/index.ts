import { barrierOf, drivenOf, footprintCells, hurtsOf, type PlacedProp } from '../../sim/props';
import { BRIDGE_W } from './validate';
import { deriveSeed, Rng } from '../../core/rng';
import { type Level, type LevelProfile, LOOP_BAND } from '../../sim/level';
import { pickThemeId, type ThemeId } from '../../themes';
import {
  centreFits,
  commit,
  finalize,
  type RecipeTry,
  SET_PIECE_RECIPES,
  SET_PIECE_UID,
  SET_PIECES,
  shotsIntoSpawns,
  Site,
  tellFaults,
  windowFaults,
} from '../setpieces';
import { type Concept, conceptName, fits, type Landmark, landmarkFaults, rollConcept } from '../stage';
import { generateTheme, type Theme } from '../theme';
import { ReachCache } from '../../sim/reach';
import { harmReach } from './harm';
import { loopBoxes } from './loop-boxes';
import { loopSurges } from './loop-surges';
import { slagTide } from './tide';
import { footing } from '../../sim/weather';
import { openUp } from './lanes';
import { setProbeGravity } from './probe';
import { type ProfileOverride, rollProfile } from './profile';
import { DIFFICULTY, setLevelDifficulty } from './difficulty';
import { levelPrecision } from './precision';
import { analyzeRoutes, MAX_SHARED } from './routes';
import { builderFor } from './builders';
import { builderFaults, clearWayFaults, CROSSING } from './builders/contract';
import { FALLBACK_SCULPTOR, SCULPTORS } from './sculptors';
import { LAST_RESORT } from './sculptors/common';
import type { Shape } from './types';
import { type Bridge, judge, oneBridgeEnough } from './validate';
import { rideProof, rideSpans } from './ride';
import { rollWeather } from './weather';
import { noFreeRide, planHolds } from './winnable';

export { DIFFICULTIES, DIFFICULTY, setLevelDifficulty, stretchesOf } from './difficulty';
export { describeProfile, GRAVITY, type GravityClass, gravityClass, type ProfileOverride, rollProfile } from './profile';
export { BRIDGE_W, type Bridge, canPlaceBridge, isAcceptable, judge, MAX_BRIDGES, withBridges } from './validate';
export { cacheFor, fieldOf, partsNeeded, planHolds, prove, settled } from './winnable';

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
   * concept's landmark wasn't raised, a required piece of it didn't go in, or a carrier's ride wasn't proven,
   * `precision` = a whole draw whose precision didn't fit the level's difficulty, `contract` = a level that broke a
   * promise of its builder's, `BuilderContract.each`).
   */
  rejects: { unsolvable: number; tooEasy: number; closed: number; landmark: number; precision: number; contract: number };
  /** The stage concept the level was built as (gen/stage); absent for a plain level. */
  concept?: string;
  /** A concept was rolled but the level fell back to plain after MAX_LANDMARK_REJECTS. */
  conceptFallback: boolean;
  /** What the landmark's build returned, anchors included (tests and tools read its ways past from them). */
  landmark?: Landmark;
  /** Why landmark attempts broke the concept's contract (../stage/contract.ts), one line per rejected attempt. */
  landmarkFaults?: string[];
  /** Promises of its builder's the level still breaks (`BuilderContract.each`, ./builders/contract.ts): only past the last resort, and conformance fails on them. */
  contractFaults?: string[];
  /** Tight jumps on the level's more forgiving route (./precision.ts), and the sculpts drawn to fit its difficulty (the tier's `draws` + 1 when none fit and the nearest was redrawn). */
  precision: number;
  draws: number;
  /** The filler set pieces the level asked for (`count`, its landmark's own aside) and each recipe the placer tried (`pnpm level` reports both). */
  placement?: { asked: number; tries: RecipeTry[]; centre?: string };
}

export let lastGenInfo: GenInfo = {
  attempts: 0,
  bridges: [],
  fallback: false,
  shared: 1,
  sculpted: 1,
  rejects: { unsolvable: 0, tooEasy: 0, closed: 0, landmark: 0, precision: 0, contract: 0 },
  conceptFallback: false,
  precision: 0,
  draws: 0,
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
  /**
   * The layout draw `n` builds: its profile (size, route, density, set pieces) and stage concept. Draw 0's are
   * the seed's own; a later draw rolls its own from labels of its own, but keeps the seed's gravity and
   * difficulty: what the level is, as against how it's laid out.
   */
  const layout = (n: number, keep?: LevelProfile): { profile: LevelProfile; concept: Concept | null } => {
    const salt = n ? `:draw${n}` : '';
    const o: ProfileOverride = { ...profileOverride, ...(keep ? { gravity: keep.gravity, difficulty: keep.difficulty, curve: !!keep.curve } : {}) };
    let profile = rollProfile(seed, themeId, o, salt);
    // A builder that is the stage itself (a brawl's arena) raises no landmark: its levels are plain.
    const concept = builderFor(profile).landmark === false ? null : rollConcept(seed, themeId, profile, profileOverride?.concept, salt);
    // A forced concept gets a size and route it fits, unless those were forced too.
    if (concept && !fits(concept, profile) && !profileOverride?.size && !profileOverride?.route && !profileOverride?.builder) {
      const size = concept.sizes.includes(profile.size) ? profile.size : concept.sizes[0];
      const route = concept.routes && !concept.routes.includes(profile.route) ? concept.routes[0] : undefined;
      profile = rollProfile(seed, themeId, { ...o, size, ...(route ? { route } : {}) }, salt);
    }
    return { profile, concept };
  };
  const first = layout(0);
  // Sculptor helpers size gaps/steps from jumps measured at this level's gravity.
  setProbeGravity(first.profile.gravity);
  setLevelDifficulty(first.profile.difficulty);
  const challenge = new Rng(deriveSeed(seed, `challenge:${themeId}`)).next();
  // Picked by difficulty: draws of the whole sculpt until one's precision fits the level's (./precision.ts), or the nearest of its tier's `draws`.
  const { precision: band, draws } = DIFFICULTY[first.profile.difficulty];
  const off = (score: number) => (score < band[0] ? band[0] - score : score > band[1] ? score - band[1] : 0);
  // Draws turned down so far. Each draw is a function of the seed, its number and its layout alone, so a snapshot's profile names one and it rebuilds.
  let turned = 0;
  // A level named by its draw (a snapshot's profile) is that draw, with no search.
  const named = profileOverride?.draw;
  if (named !== undefined) {
    const level = sculptDraw(named, named ? layout(named, first.profile) : first, null) as Level;
    lastGenInfo.draws = 1;
    return level;
  }
  let pick = { n: 0, off: Infinity };
  for (let n = 0; n < draws; n++) {
    const got = sculptDraw(n, n ? layout(n, first.profile) : first, (score) => off(score) === 0);
    if (typeof got !== 'number') {
      lastGenInfo.draws = n + 1;
      return got;
    }
    turned++;
    if (off(got) < pick.off) pick = { n, off: off(got) };
  }
  const picked = sculptDraw(pick.n, pick.n ? layout(pick.n, first.profile) : first, null) as Level;
  lastGenInfo.draws = draws + 1;
  return picked;

  /**
   * One draw of the level: attempts until a sculpt passes every gate. Draw 0 rolls as levels always have; a
   * later one rolls its own layout and terrain from labels of its own. With `keepIf`, a sculpt whose precision
   * it turns down stops there, before set pieces and weather, and its score comes back instead.
   */
  function sculptDraw(n: number, drawn: { profile: LevelProfile; concept: Concept | null }, keepIf: ((score: number) => boolean) | null): Level | number {
    const { concept } = drawn;
    const profile: LevelProfile = { ...drawn.profile, draw: n };
    const rejects = { unsolvable: 0, tooEasy: 0, closed: 0, landmark: 0, precision: turned, contract: 0 };
    const faults: string[] = [];
    // Centre kinds (Shape.centre) none of the set's hazards stood in: the builder lays others for the rest of the draw.
    const unfit: string[] = [];
    const lab = (s: string) => (n ? `draw${n}:${s}` : s);
    for (let attempt = 0; attempt < MAX_ATTEMPTS + LEGACY_ATTEMPTS; attempt++) {
      const rng = new Rng(deriveSeed(seed, lab(`level:${attempt}`)));
      // A loop stays with its builder: only it closes a loop (builders/shaft.ts closeLoop).
      const sculptor = attempt < MAX_ATTEMPTS || profile.loop ? SCULPTORS[themeId] : FALLBACK_SCULPTOR;
      const live = concept && attempt < MAX_ATTEMPTS && rejects.landmark < MAX_LANDMARK_REJECTS ? concept : undefined;
      const reject = () => rejects.landmark++;
      const ctx = { themeId, theme, attempt, profile, challenge, ...(live ? { concept: live } : {}) };
      let shape = sculptor({ rng, ...ctx, ...(unfit.length ? { noCentre: [...unfit] } : {}) });
      // A level laid round a centre is first asked whether one of the set's hazards stands in it (before any
      // proof); a kind none does is laid no more this draw, and this attempt sculpts again round another.
      while (
        shape.centre &&
        !centreFits(
          new Rng(deriveSeed(seed, lab(`centre:${attempt}`))),
          toLevel(seed, shape, theme, profile),
          shape.centre.rooms,
          SET_PIECE_RECIPES[themeId],
          profile.setPieceRoles,
        )
      ) {
        unfit.push(shape.centre.kind);
        shape = sculptor({ rng: new Rng(deriveSeed(seed, lab(`level:${attempt}:${unfit.join('+')}`))), ...ctx, noCentre: [...unfit] });
      }
      // Every kind turned down on this attempt's sculpts: it goes on without one (its builder's contract has the last
      // word), and the next attempt's sculpt may fit any of them again.
      if (!shape.centre && unfit.length) unfit.length = 0;
      const landmark = live ? shape.landmark : undefined;
      if (live && !landmark) {
        reject();
        continue;
      }
      const level = toLevel(seed, shape, theme, profile);
      if (live && landmark) level.landmark = { concept: live.id, rect: landmark.rect, ...(landmark.skin ? { skin: landmark.skin } : {}) };
      const cache = new ReachCache(level);
      const landmarkRng = new Rng(deriveSeed(seed, lab(`landmark:${attempt}`)));
      // A carrier's ride is part of the proof, so it goes in first; the solution it has to keep comes later.
      let carriers: PlacedProp[] | null = null;
      if (live?.carrier && landmark) {
        carriers = placeLandmark(live, landmark, level, cache, landmarkRng, themeId, () => true, false);
        const rides = carriers?.flatMap((pp) => rideProof(level, pp)) ?? [];
        if (!rides.some((r) => rideSpans(level.w, r, live.carrier?.minGap ?? 0))) {
          reject();
          continue;
        }
        level.rides = rides;
      }
      // Passable bare: not a level. Only the very last attempts accept it, to keep generation total.
      // A level that owes no part is meant to be passable bare (a loop climbs bare): the rest must ask for parts.
      const insist = attempt < LAST_RESORT && !profile.bare;
      if (insist && cache.analyze(level).goalReached) {
        rejects.tooEasy++;
        continue;
      }
      const v = judge(level, shape.bridgeHints, shape.crossings, cache);
      // A level that owes no part can't take one either: a loop would stop every lap there.
      if (!v.ok || (profile.bare && v.bridges.length)) {
        rejects.unsolvable++;
        continue;
      }
      // Spawns at both ends: each must reach the other, bare, or one end is a trap the other end can't get to.
      if (profile.ends && profile.bare && !cache.analyze({ ...level, spawn: level.goal, goal: level.spawn }).goalReached) {
        rejects.unsolvable++;
        continue;
      }
      let shared = v.shared;
      let landmarkShared = v.landmark;
      if (!v.open) {
        // Mostly open: give the level the second route it lacks. Lanes stay away from bridges, so the
        // solution still stands; openUp's own analysis re-proves it (an unreachable goal scores 1).
        const routes = openUp(level, shape, v.bridges, new Rng(deriveSeed(seed, lab(`lanes:${attempt}`))), cache);
        if (routes.shared > MAX_SHARED) {
          rejects.closed++;
          continue;
        }
        if (v.bridges.length && insist && cache.analyze(level).goalReached) {
          rejects.tooEasy++;
          continue;
        }
        shared = routes.shared;
        landmarkShared = routes.landmark;
      }
      // The count sets what crates offer, so it has to be the real one, on the final terrain.
      const one = v.bridges.length === 2 ? oneBridgeEnough(level, shape.bridgeHints, cache) : null;
      const bridges = one ? [one] : v.bridges;
      if (one) {
        const routes = analyzeRoutes(level, bridges, cache);
        shared = routes.shared;
        landmarkShared = routes.landmark;
        if (shared > MAX_SHARED) {
          rejects.closed++;
          continue;
        }
      }
      level.solution = bridges;
      const precision = levelPrecision(level, analyzeRoutes(level, bridges, cache), bridges);
      if (keepIf && !keepIf(precision)) return precision;
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
        reject();
        continue;
      }
      // The concept's contract: scale, footing, the protected pockets, two ways through.
      const broken = live && landmark ? landmarkFaults(level, live, landmark.rect, fixed, landmarkShared) : [];
      if (broken.length) {
        faults.push(`${live!.id} attempt ${attempt}: ${broken.join('; ')}`);
        reject();
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
        ...(faults.length ? { landmarkFaults: faults } : {}),
        precision,
        draws: 0,
      };
      const budget = live ? (live.budget ?? fixed.length) : 0;
      // A Rising Slag tower is several levels tall: its hazards come at the same rate per storey.
      const asked = Math.max(0, profile.hazards * (profile.loop ? Math.max(1, Math.round(profile.h / 50)) : 1) - budget);
      const tries: RecipeTry[] = [];
      lastGenInfo.placement = { asked, tries, ...(shape.centre ? { centre: shape.centre.kind } : {}) };
      // A builder that promises a way round every hazard (`clearWay`) has each piece kept to it as it goes in, so the
      // way is left rather than the level drawn again.
      const wayRound = !!builderFor(profile).contract?.each?.clearWay;
      const pieces = SET_PIECES[themeId](new Rng(deriveSeed(seed, lab(`setpieces:${attempt}`))), level, {
        count: asked,
        log: tries,
        danger: profile.danger,
        ...(profile.setPieceRoles ? { roles: profile.setPieceRoles } : {}),
        ...(shape.centre ? { centre: shape.centre } : {}),
        cache,
        keep: wayRound
          ? (ps) => keep([...fixed, ...ps]) && (!walls(level, ps[ps.length - 1]) || !clearWayFaults({ ...level, setPieces: [...fixed, ...ps] }, cache).length)
          : fixed.length
            ? (ps) => keep([...fixed, ...ps])
            : keep,
        ...(live && landmark ? { standing: fixed, avoid: landmark.air, family: live.family } : {}),
      });
      // (The placer already avoids these cells; this is a safety net. Keep uids contiguous, the landmark's first.)
      // A level that asks for boxes gets mystery boxes (or item stands) of its own, after the builder and its set pieces (./loop-boxes.ts).
      const fitted = [...fixed, ...pieces.filter(clearOfBridges)];
      // An arena's boxes hang only over floors the field can get to; a loop's every floor is on the climb.
      const stands = profile.loop ? undefined : new Set(cache.analyze(level, false).cells);
      // An arena's stands keep out of whatever its pieces reach (./harm.ts).
      const harm = profile.stands && stands ? harmReach(level, fitted) : undefined;
      const boxes = profile.boxes
        ? loopBoxes(level, fitted, keep, new Rng(deriveSeed(seed, lab(`loop-boxes:${attempt}`))), profile.boxes, stands, !!profile.stands, harm)
        : [];
      // A loop that asks for Leg Days gets them on its riskiest lips, clear of everything else (./loop-surges.ts).
      const surges = profile.surges ? loopSurges(level, [...fitted, ...boxes], new Rng(deriveSeed(seed, lab(`loop-surges:${attempt}`)))) : [];
      level.setPieces = [...fitted, ...boxes, ...surges].map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
      // A field that starts at both ends keeps coming back to them: no gun's shot may get there.
      for (let shots = profile.ends ? shotsIntoSpawns(level) : null; shots?.size; shots = shotsIntoSpawns(level))
        level.setPieces = level.setPieces.filter((p) => !shots!.has(p.uid)).map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
      while (level.setPieces.length && !planHolds(level, [], bridges, cache)) level.setPieces.pop();
      // What its builder promises of every level (builders/contract.ts): a level that breaks one is drawn again, until
      // the last resort keeps generation total (and records what it kept broken).
      const promised = builderFor(profile).contract?.each;
      // The way round the hazards was held piece by piece as they went in, and nothing after adds a hazard, so it isn't
      // proven twice (tests/conformance does).
      const unkept = promised ? builderFaults(wayRound ? { ...promised, clearWay: undefined } : promised, level, asked, cache) : [];
      if (unkept.length && attempt < LAST_RESORT) {
        rejects.contract++;
        continue;
      }
      if (unkept.length) lastGenInfo.contractFaults = unkept;
      if (level.rides) {
        // A ride is only as good as its carrier.
        level.rides = level.rides.filter((r) => level.setPieces.some((p) => p.uid === r.uid));
        if (!level.rides.length) delete level.rides;
      }
      if (live && landmark) level.theme = { ...theme, name: conceptName(seed, live, theme.name) };
      // A loop's start line (builders/shaft.ts) keeps the cells that get to the spawn, so a lap is proven from each: a
      // search from the cell that stops at the spawn, a few cells along the same floor.
      if (profile.loop && level.spawns) {
        level.spawns = level.spawns.filter((c) => cache.analyze({ ...level, spawn: c, goal: level.spawn }).goalReached);
        if (!level.spawns.length) delete level.spawns;
      }
      return level;
    }
    lastGenAttempts = MAX_ATTEMPTS + LEGACY_ATTEMPTS;
    lastGenInfo = {
      attempts: lastGenAttempts,
      bridges: [],
      fallback: true,
      shared: 1,
      sculpted: 1,
      rejects,
      conceptFallback: !!concept,
      ...(faults.length ? { landmarkFaults: faults } : {}),
      precision: 0,
      draws: 0,
    };
    return toLevel(seed, fallbackShape(profile.w, profile.h), theme, profile);
  }
}

/**
 * A landmark's pieces, every one required: each must pass `finalize`, `windowFaults`, `keep` and, when `free`,
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
    if (tellFaults(piece.modules).length) return null;
    const pp = finalize(s, piece, SET_PIECE_UID + out.length, `setpiece:${themeId}:${c.id}`);
    if (!pp || windowFaults(level, pp).length || !keep([...out, pp]) || (free && !noFreeRide(level, pp, out, cache))) return null;
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
    ...(profile.tide ? { tide: slagTide(profile, s.tiles, s.w, s.h) } : {}),
    ...(s.spawns ? { spawns: s.spawns } : profile.ends ? { spawns: [{ ...s.goal }] } : {}),
    ...(profile.loop && profile.size === 'tall' ? { loop: profile.h - LOOP_BAND } : {}),
  };
}

/**
 * Whether `pp` walls anything a way round the hazards would mind (`clearWayFaults`): cells its hazards hold past
 * `CROSSING`, or its own blocks and no-go cells. One that walls nothing can't close the way the pieces before it left,
 * so it needs no reach.
 */
function walls(level: Level, pp: PlacedProp | undefined): boolean {
  if (!pp) return false;
  const b = barrierOf(level, pp);
  return b.noGo.length > 0 || b.ground.length > 0 || hurtsOf(level, pp, CROSSING).length > 0 || drivenOf(level, pp).length > 0;
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
