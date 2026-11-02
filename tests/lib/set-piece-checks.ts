import { expect } from 'vitest';
import { overlaps, type Rect, rectCircle } from '../../src/core/geom';
import { generateLevel, isAcceptable } from '../../src/gen/level';
import { SAFE_TILES, SET_PIECE_UID } from '../../src/gen/setpieces';
import { RUN_COUNTDOWN, TILE } from '../../src/sim/constants';
import { isProtected, type Level, tileAt } from '../../src/sim/level';
import { type Contrib, footprintCells, type Hazard, moduleSim, newPropState, type PlacedProp, resolveProp } from '../../src/sim/props';
import { RunWorld } from '../../src/sim/run';
import { THEME_IDS, type ThemeId } from '../../src/themes';

/**
 * What every placed set piece must satisfy, one level at a time. tests/setpieces.test.ts runs these
 * on a few seeds and tests/stats/set-pieces.test.ts on many.
 */

export interface ThemedLevel {
  theme: ThemeId;
  seed: number;
  level: Level;
}

/** One level per theme and seed. */
export const levelsOfEveryTheme = (seeds: number[]): ThemedLevel[] =>
  THEME_IDS.flatMap((theme) => seeds.map((seed) => ({ theme, seed, level: generateLevel(seed, theme) })));

function zones(level: Level): Rect[] {
  return [level.spawn, level.goal].map((c) => ({
    x: (c.tx - SAFE_TILES) * TILE,
    y: (c.ty - SAFE_TILES) * TILE,
    w: (SAFE_TILES * 2 + 1) * TILE,
    h: (SAFE_TILES * 2 + 1) * TILE,
  }));
}

function hits(h: Hazard, z: Rect): boolean {
  if (h.kind === 'rect') return overlaps(h.r, z);
  if (h.kind === 'circle') return rectCircle(z, h.x, h.y, h.r);
  for (let i = 0; i <= 20; i++) if (rectCircle(z, h.x1 + ((h.x2 - h.x1) * i) / 20, h.y1 + ((h.y2 - h.y1) * i) / 20, h.r)) return true;
  return false;
}

/** A stage concept's own pieces (src/gen/stage): every one required, so the hazard count doesn't cap them. */
export const isLandmarkPiece = (level: Level, p: PlacedProp) => !!level.landmark && p.def.key.endsWith(`:${level.landmark.concept}`);

/** The profile caps a level's filler pieces, and four is the most any level gets. */
export function expectPieceCap({ level }: ThemedLevel) {
  expect(level.setPieces.filter((p) => !isLandmarkPiece(level, p)).length).toBeLessThanOrEqual(Math.min(4, level.profile!.hazards));
}

/** Uids, owner, free unprotected cells, no overlap; the level stays acceptable. */
export function expectPlacementRules({ theme, seed, level }: ThemedLevel) {
  expect(isAcceptable(level), `${theme} ${seed}`).toBe(true);
  const taken = new Set<number>();
  level.setPieces.forEach((p, i) => {
    expect(p.uid).toBe(SET_PIECE_UID + i);
    expect(p.owner).toBe(-1);
    for (const [x, y] of footprintCells(p)) {
      expect(x >= 0 && y >= 0 && x < level.w && y < level.h).toBe(true);
      expect(tileAt(level, x, y), `${theme} ${seed} ${p.def.name} on a tile`).toBe(0);
      expect(isProtected(level, x, y)).toBe(false);
      expect(taken.has(y * level.w + x), 'overlap').toBe(false);
      taken.add(y * level.w + x);
    }
  });
}

/** No hazard, moving solid or projectile ever reaches the spawn or goal zones. */
export function expectClearOfSpawnAndGoal({ theme, seed, level }: ThemedLevel) {
  const zs = zones(level);
  for (const pp of level.setPieces) {
    const r = resolveProp(pp);
    const state = newPropState();
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 900; f += 2) {
      out.solids.length = 0;
      out.hazards.length = 0;
      r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi, live: true }, out));
      for (const h of out.hazards) for (const z of zs) expect(hits(h, z), `${theme} ${seed} ${pp.def.name} hazard @${f}`).toBe(false);
      for (const s of out.solids) if (s.dx || s.dy) for (const z of zs) expect(overlaps(s, z), `${theme} ${seed} ${pp.def.name} solid`).toBe(false);
    }
  }
  // Projectiles, through the real sim.
  if (level.setPieces.some((p) => p.def.modules.some((m) => m.type === 'cannon'))) {
    const run = new RunWorld(level, [], []);
    for (let f = 0; f < 700; f++) {
      run.step([]);
      for (const p of run.projectiles) for (const z of zs) expect(rectCircle(z, p.x, p.y, 4), `${theme} ${seed} projectile`).toBe(false);
    }
  }
}

/** No piece is lethal every frame: a hazard leaves a window to get past it. */
export function expectSafeWindows({ level }: ThemedLevel) {
  for (const pp of level.setPieces) {
    const r = resolveProp(pp);
    const state = newPropState();
    const lethal = new Map<number, number>();
    let frames = 0;
    let first: string | null = null;
    let still = true;
    for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 900; f++, frames++) {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi, live: true }, out));
      const key = JSON.stringify(out.hazards);
      if (first === null) first = key;
      else if (key !== first) still = false;
      const here = new Set<number>();
      for (const h of out.hazards) for (const k of hazardCells(level, h)) here.add(k);
      for (const k of here) lethal.set(k, (lethal.get(k) ?? 0) + 1);
    }
    // A hazard that never moves (a spike strip, a broken window's glass) is a wall of its own: the proof keeps clear of it.
    if (still) continue;
    // Anything else leaves every spot it reaches clear for a while.
    for (const [k, n] of lethal) expect(frames - n, `${pp.def.name} at ${k % level.w},${Math.floor(k / level.w)}`).toBeGreaterThan(60);
  }
}

/** Cells a hazard covers (its bounding box, a beam's boxes along it). */
function hazardCells(level: Level, h: Hazard): number[] {
  const boxes: Rect[] =
    h.kind === 'rect'
      ? [h.r]
      : h.kind === 'circle'
        ? [{ x: h.x - h.r, y: h.y - h.r, w: 2 * h.r, h: 2 * h.r }]
        : Array.from({ length: 21 }, (_, i) => ({
            x: h.x1 + ((h.x2 - h.x1) * i) / 20 - h.r,
            y: h.y1 + ((h.y2 - h.y1) * i) / 20 - h.r,
            w: 2 * h.r,
            h: 2 * h.r,
          }));
  const out: number[] = [];
  for (const b of boxes)
    for (let y = Math.floor(b.y / TILE); y <= Math.floor((b.y + b.h - 1e-6) / TILE); y++)
      for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w - 1e-6) / TILE); x++) out.push(y * level.w + x);
  return out;
}
