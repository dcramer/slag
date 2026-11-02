import { expect } from 'vitest';
import { BRIDGE_W, canPlaceBridge, generateLevel, lastGenInfo, MAX_BRIDGES, withBridges } from '../../src/gen/level';
import { analyzeRoutes, MAX_SHARED } from '../../src/gen/level/routes';
import { isProtected, type Level, type SizeClass, T_EMPTY, T_ONEWAY, T_SOLID } from '../../src/sim/level';
import { analyzeReach, isStandable } from '../../src/sim/reach';
import type { ThemeId } from '../../src/themes';
import { isLandmarkPiece } from './set-piece-checks';

/**
 * What every generated level must satisfy, one seed at a time. The behavior suites call these on a
 * few seeds so a broken generator fails `pnpm check`; tests/stats calls them on many seeds, where a
 * rare failing seed has a chance of showing up.
 */

/** Independent policy check: solvable bare, or with the reported ≤2 bridges re-verified here. */
export function checkPolicy(l: Level, bridges: { x: number; y: number }[]): boolean {
  if (bridges.length === 0) return analyzeReach(l).goalReached;
  if (bridges.length > MAX_BRIDGES) return false;
  for (const b of bridges) {
    if (!canPlaceBridge(l, b)) return false;
    for (let i = 0; i < BRIDGE_W; i++) if (isProtected(l, b.x + i, b.y)) return false;
  }
  return analyzeReach(withBridges(l, bridges)).goalReached;
}

/** A level from the seed alone, theme and profile included: no fallback, and solvable by the real controller. */
export function expectSolvableLevel(seed: number): Level {
  const l = generateLevel(seed);
  const { bridges, fallback } = lastGenInfo;
  expect(fallback, `seed ${seed} fallback`).toBe(false);
  expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
  expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
  expect(bridges.length).toBeLessThanOrEqual(MAX_BRIDGES);
  expect(bridges.every((b) => canPlaceBridge(l, b))).toBe(true);
  expect(analyzeReach(bridges.length ? withBridges(l, bridges) : l).goalReached).toBe(true);
  return l;
}

/** A level of a given theme: deterministic, valid, themed, solvable by policy. Returns its bridges for the shares. */
export function expectThemedLevel(theme: ThemeId, seed: number): { level: Level; bridges: { x: number; y: number }[] } {
  const l = generateLevel(seed, theme);
  const info = { ...lastGenInfo };
  const again = generateLevel(seed, theme);
  expect(Array.from(again.tiles), `${theme} seed ${seed} determinism`).toEqual(Array.from(l.tiles));
  expect(again.spawn).toEqual(l.spawn);
  expect(again.goal).toEqual(l.goal);
  expect(lastGenInfo.bridges).toEqual(info.bridges);

  expect(info.fallback, `${theme} seed ${seed} fallback`).toBe(false);
  expect(l.style.startsWith(`${theme}:`), l.style).toBe(true);
  expect(l.tiles.length).toBe(l.w * l.h);
  expect(l.profile && l.w === l.profile.w && l.h === l.profile.h).toBe(true);
  expect(l.tiles.every((t) => t === T_EMPTY || t === T_SOLID || t === T_ONEWAY)).toBe(true);
  // Spawn left, goal right, both standable and protected.
  expect(l.spawn.tx).toBeLessThan(5);
  expect(l.goal.tx).toBeGreaterThan(l.w - 6);
  expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
  expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
  expect(isProtected(l, l.spawn.tx, l.spawn.ty)).toBe(true);
  expect(isProtected(l, l.goal.tx, l.goal.ty)).toBe(true);
  expect(checkPolicy(l, info.bridges), `${theme} seed ${seed} policy`).toBe(true);
  return { level: l, bridges: info.bridges };
}

/** A level keeps a second route, re-measured from the final level. Returns how open the raw sculpt was. */
export function expectOpenLevel(theme: ThemeId, seed: number): { sculpted: number } {
  const l = generateLevel(seed, theme);
  const info = { ...lastGenInfo };
  expect(info.fallback, `${theme} ${l.seed}`).toBe(false);
  const r = analyzeRoutes(l, l.solution ?? []);
  expect(r.fastest.length, `${theme} ${l.seed} solvable`).toBeGreaterThan(0);
  expect(r.shared, `${theme} ${l.seed} ${l.style}`).toBeLessThanOrEqual(MAX_SHARED);
  expect(r.shared).toBeCloseTo(info.shared, 5);
  return { sculpted: info.sculpted };
}

/** A level forced to a size class: the right shape, valid, and solvable by the real controller. */
export function expectSizedLevel(theme: ThemeId, size: SizeClass, seed: number): Level {
  const l = generateLevel(seed, theme, { size });
  const info = { ...lastGenInfo };
  expect(info.fallback, `${theme} ${size} ${seed}`).toBe(false);
  expect(l.profile!.size).toBe(size);
  expect(l.tiles.length).toBe(l.w * l.h);
  if (size === 'tall') expect(l.h).toBeGreaterThan(l.w);
  else expect(l.w).toBeGreaterThan(l.h * 2);
  expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
  expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
  expect(info.bridges.length).toBeLessThanOrEqual(MAX_BRIDGES);
  expect(analyzeReach(info.bridges.length ? withBridges(l, info.bridges) : l).goalReached, `${theme} ${size} ${seed}`).toBe(true);
  expect(l.setPieces.filter((p) => !isLandmarkPiece(l, p)).length).toBeLessThanOrEqual(l.profile!.hazards);
  for (const p of l.setPieces) for (const [x, y] of p.def.footprint) expect(x + p.tx < l.w && y + p.ty < l.h).toBe(true);
  return l;
}
