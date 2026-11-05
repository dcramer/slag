import { expect } from 'vitest';
import { overlaps, type Rect, rectCircle } from '../../src/core/geom';
import { generateLevel, isAcceptable } from '../../src/gen/level';
import { SAFE_TILES, SET_PIECE_UID, windowFaults } from '../../src/gen/setpieces';
import { RUN_COUNTDOWN, TILE } from '../../src/sim/constants';
import { isProtected, type Level, tileAt } from '../../src/sim/level';
import { type Contrib, footprintCells, type Hazard, moduleSim, motionOffset, newPropState, type PlacedProp, resolveProp } from '../../src/sim/props';
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
      // Where the piece's own motion has carried it (a combine on its rail): its hazards ride along.
      const off = motionOffset(r, f);
      const prev = motionOffset(r, f - 1);
      r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off, prev, state, mi, live: true }, out));
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

/** No piece is lethal every frame (`windowFaults`, the contract the pipeline enforces while generating). */
export function expectSafeWindows({ level }: ThemedLevel) {
  for (const pp of level.setPieces) {
    const faults = windowFaults(level, pp);
    expect(faults, faults.join('\n')).toEqual([]);
  }
}
