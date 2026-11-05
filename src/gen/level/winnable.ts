import { dcos, dsin } from '../../core/dmath';
import type { Rect } from '../../core/geom';
import { RUN_COUNTDOWN, TILE } from '../../sim/constants';
import { type Level, spawnZone, T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import type { Solid } from '../../sim/physics';
import {
  AMMO,
  AMMO_SIM,
  barrierOf,
  buildProjectile,
  buildSolids,
  cannonMuzzle,
  type Contrib,
  detonateCharges,
  makeProjectile,
  type ModuleOf,
  motionOffset,
  newPropState,
  type PlacedProp,
  type PropCtx,
  type ProjWorld,
  type Resolved,
  resolveProp,
  stepProjectile,
  traceRays,
} from '../../sim/props';
import { ReachCache, T_NOGO } from '../../sim/reach';
import { cycleFrames } from '../../sim/props';
import { type Bridge, canPlaceBridge, MAX_BRIDGES, searchBridges, withBridges } from './validate';

/**
 * What a level needs to be finished. A `plan` is at most MAX_BRIDGES bridges,
 * each a legal place for the crate's bridge card, with which the real
 * controller (sim/reach.ts) gets from spawn to the flag through the terrain
 * and the plain blocks players built, keeping clear of every other part (the
 * barriers in sim/props/barrier.ts). Every fresh level starts with one, its
 * recorded solution, proven this way when it's generated, and the crate always
 * offers as many bridge cards as the plan has bridges, so finishing a fresh
 * level never needs a part nobody was given.
 *
 * Parts may seal a level (the owner, 2026-11-02): nothing is refused for it.
 * Each round's start re-proves the plan; when none is found the level is
 * sealed and the crate deals a demolition card that clears parts instead
 * (generateCrate). Bombs, time bombs included, are settled before the proof.
 *
 * Proving is cheap: the last plan is re-checked first, and a ReachCache only
 * re-traces what changed.
 */

/** Reach caches by level identity; their answers never depend on what ran before, so sharing them is safe. */
const caches = new Map<string, ReachCache>();
const MAX_CACHES = 4;

/**
 * The shared ReachCache for `field`'s level, rebased onto its tiles. Anything
 * asking many questions of one level in play (bots weighing spots) should go
 * through it: a cold cache re-traces every cell, a warm one only what changed.
 */
export function cacheFor(field: Level): ReachCache {
  const key = `${field.seed}:${field.theme.id}:${field.w}x${field.h}:${field.gravity ?? 1}`;
  let c = caches.get(key);
  if (c) caches.delete(key);
  else c = new ReachCache(field);
  caches.set(key, c);
  if (caches.size > MAX_CACHES) caches.delete(caches.keys().next().value!);
  c.rebase(field.tiles);
  return c;
}

/**
 * The level as the proof sees it: plain blocks (placed and set pieces) are
 * terrain, every other barrier is T_NOGO. The spawn pocket can't hurt anyone
 * (RunWorld's safe zone), so nothing there is a barrier. Its set pieces are
 * every part standing, so a bridge can't take a cell one of them holds.
 */
export function fieldOf(level: Level, placed: readonly PlacedProp[]): Level {
  const tiles = level.tiles.slice();
  const parts = [...level.setPieces, ...placed];
  const barriers = parts.map((pp) => barrierOf(level, pp));
  for (const b of barriers) for (const k of b.ground) if (tiles[k] === T_EMPTY) tiles[k] = T_SOLID;
  const safe = spawnZone(level);
  for (const b of barriers) for (const k of b.noGo) if (tiles[k] !== T_SOLID && !inZone(level.w, k, safe)) tiles[k] = T_NOGO;
  return { ...level, tiles, setPieces: parts };
}

function inZone(w: number, k: number, r: Rect | null): boolean {
  if (!r) return false;
  const x = (k % w) * TILE;
  const y = Math.floor(k / w) * TILE;
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** `level` and `placed` as the race will start: pending time bombs gone off (on a copy). */
export function settled(level: Level, placed: readonly PlacedProp[]): { level: Level; placed: PlacedProp[] } {
  const copy: Level = { ...level, tiles: level.tiles.slice(), setPieces: level.setPieces.slice() };
  return { level: copy, placed: detonateCharges(copy, [...placed]) };
}

/**
 * A plan for `level` with `placed` standing in it, or null if none is found:
 * the parts have sealed it. `prior`, the last plan, is tried first; what's
 * left of it still counts, so a bridge someone built from the plan shortens
 * it, and bridges the level no longer needs are dropped, down to [] when the
 * flag is reachable as it stands. Pass the settled state (see `settled`).
 * `search` false never looks for a new plan (searchBridges runs dozens of
 * analyses): null then means only that the last plan no longer holds.
 */
export function prove(level: Level, placed: readonly PlacedProp[], prior: readonly Bridge[], search = true): Bridge[] | null {
  const field = fieldOf(level, placed);
  const cache = cacheFor(field);
  const works = (bs: readonly Bridge[]) => cache.analyze(bs.length ? withBridges(field, bs) : field).goalReached;
  const rest = prior.filter((b) => canPlaceBridge(field, b)).map((b) => ({ ...b }));
  if (rest.length <= MAX_BRIDGES && works(rest)) {
    if (!rest.length) return rest;
    if (works([])) return [];
    if (rest.length === 2) for (const b of rest) if (works([b])) return [b];
    return rest;
  }
  if (works([])) return [];
  return search ? searchBridges(field, prior, cache) : null;
}

/**
 * Does `plan` finish `level` with `placed` standing, as the proof sees it?
 * Worldgen asks this of the recorded solution as set pieces go in, since a
 * match starts from it. Pass the level's own `cache` if it has one.
 */
export function planHolds(level: Level, placed: readonly PlacedProp[], plan: readonly Bridge[], cache?: ReachCache): boolean {
  const field = fieldOf(level, placed);
  return plan.every((b) => canPlaceBridge(field, b)) && (cache ?? cacheFor(field)).analyze(withBridges(field, plan)).goalReached;
}

/** Bridges still needed with `placed` standing (what the crate must offer); MAX_BRIDGES when no plan is found. */
export function partsNeeded(level: Level, placed: readonly PlacedProp[], prior: readonly Bridge[] = level.solution ?? []): number {
  const s = settled(level, placed);
  return prove(s.level, s.placed, prior)?.length ?? MAX_BRIDGES;
}

/** Phases of a piece's cycle `noFreeRide` parks it at. */
export const RIDE_PHASES = 8;

/**
 * Does `pp` leave the level needing its parts? reach.ts doesn't ride what
 * moves, so a rotor's platform, a vehicle's roof, a lift's cab or a glider
 * could carry a bare run over the crossing a part should close, and nothing
 * else would notice (docs/SETPIECES.md, `noFreeRide`). Each of RIDE_PHASES
 * snapshots of everything of the piece you could stand on is written into the
 * level, as the proof sees it with `standing` and the piece in place, as
 * static ground, one at a time; if any lets the ghost reach the flag with no
 * parts, the piece is refused. That doesn't model riding while it moves, but
 * it catches what matters: the cab parked at the top, the platform hanging
 * over the gap.
 *
 * `level.rides` stay in place, so a carrier's own proven crossing is already
 * in the baseline and needs no exemption. A level the ghost finishes bare
 * without the piece has nothing for it to give away: any piece passes. Each
 * piece is checked against what stands when it goes in, alone; two movers
 * that open a way only together aren't looked for.
 */
export function noFreeRide(level: Level, pp: PlacedProp, standing: readonly PlacedProp[] = [], cache?: ReachCache): boolean {
  const shots = snapshots(level, pp);
  if (!shots.length) return true;
  const field = fieldOf(level, [...standing, pp]);
  const c = cache ?? cacheFor(field);
  if (c.analyze(field).goalReached) return true;
  const { w, h } = level;
  const seen = new Set<string>();
  for (const shot of shots) {
    const tiles = field.tiles.slice();
    const wrote: number[] = [];
    for (const s of shot) {
      const x0 = Math.max(0, Math.floor(s.x / TILE + 1e-6));
      const x1 = Math.min(w - 1, Math.ceil((s.x + s.w) / TILE - 1e-6) - 1);
      const y0 = Math.max(0, Math.floor(s.y / TILE + 1e-6));
      const y1 = Math.min(h - 1, Math.ceil((s.y + s.h) / TILE - 1e-6) - 1);
      const t = s.oneWay ? T_ONEWAY : T_SOLID;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const k = y * w + x;
          if (tiles[k] === T_SOLID || tiles[k] === t) continue;
          tiles[k] = t;
          wrote.push(k * 2 + (t === T_SOLID ? 1 : 0));
        }
    }
    if (!wrote.length) continue;
    const key = wrote.sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    if (c.analyze({ ...field, tiles }).goalReached) return false;
  }
  return true;
}

/**
 * What of `pp` you could stand on at RIDE_PHASES moments of its cycle: every
 * solid its modules build (films aside), and the planks its platform shots
 * (gliders) become along one flight. Empty when it has nothing to stand on.
 */
function snapshots(level: Level, pp: PlacedProp): Solid[][] {
  const r = resolveProp(pp);
  const shots: Solid[][] = [];
  const state = newPropState();
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [] };
  const P = cycleFrames(r.mods, r.motion);
  for (let i = 0; i < RIDE_PHASES; i++) {
    const f = RUN_COUNTDOWN + Math.floor((i * P) / RIDE_PHASES);
    out.solids.length = out.hazards.length = out.springs.length = out.winds.length = out.triggers!.length = 0;
    const ctx = (rp: Resolved, mi: number): PropCtx => ({
      level,
      frame: f,
      r: rp,
      off: motionOffset(rp, f),
      prev: motionOffset(rp, f - 1),
      state,
      mi,
      live: true,
    });
    buildSolids([r], ctx, out);
    traceRays([r], ctx, out);
    const solids = out.solids.filter((s) => !s.film).map((s) => ({ ...s }));
    if (solids.length) shots.push(solids);
  }
  for (const m of r.mods) if (m.type === 'cannon' && AMMO_SIM[m.ammo]?.platform) shots.push(...flight(level, pp, m));
  return shots;
}

/** One platform shot's planks at RIDE_PHASES points of its flight, flown by the sim's own projectile step with nobody aboard. */
function flight(level: Level, pp: PlacedProp, m: ModuleOf<'cannon'>): Solid[][] {
  const [x, y] = cannonMuzzle(m);
  const p = makeProjectile({ x, y, vx: dcos(m.angle) * m.speed, vy: dsin(m.angle) * m.speed, owner: pp.owner, ammo: m.ammo, source: pp.uid }, RUN_COUNTDOWN, 0);
  const none = () => {};
  const w: ProjWorld = { level, frame: RUN_COUNTDOWN, solids: [], gravity: level.gravity ?? 1, runners: [], spawn: none, emit: none, kill: none };
  const every = Math.max(1, Math.ceil((AMMO[m.ammo].life ?? 480) / RIDE_PHASES));
  const out: Solid[][] = [];
  for (let age = 1; ; age++) {
    w.frame = RUN_COUNTDOWN + age;
    if (!stepProjectile(p, w)) return out;
    if (age % every) continue;
    const c: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    buildProjectile(p, w.frame, c);
    if (c.solids.length) out.push(c.solids);
  }
}
