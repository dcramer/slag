import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DIFFICULTIES, generateLevel, isAcceptable, lastGenInfo, setLevelDifficulty } from '../src/gen/level';
import { jumpProfile, probeGravity, setProbeGravity } from '../src/gen/level/probe';
import { analyzeRoutes, MAX_SHARED } from '../src/gen/level/routes';
import { judge, oneBridgeEnough } from '../src/gen/level/validate';
import { type Crossing, hopGap, jumpCrossing, jumpGap, reachMin, rollChallenges, TWO_PART_TRIES, TWO_PARTS } from '../src/gen/level/sculptors/common';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { type Level, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { analyzeReach, ReachCache } from '../src/sim/reach';

const seedAt = (i: number) => (i * 2654435761 + 4242) >>> 0;

/** A flat floor from pocket to pocket; `build` adds to it. */
function floorLevel(build: (tiles: Uint8Array, row: number) => void = () => {}): Level {
  const w = LEVEL_W;
  const h = LEVEL_H;
  const tiles = new Uint8Array(w * h);
  const row = 20;
  for (let y = row + 1; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = T_SOLID;
  build(tiles, row);
  return {
    seed: 0,
    w,
    h,
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: w - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: w - 5, y: row - 3, w: 5, h: 5 },
    ],
    theme: generateLevel(1).theme,
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

describe('route analysis', () => {
  it('scores a single lane as one route, however wide the sky above it', () => {
    expect(analyzeRoutes(floorLevel()).shared).toBeGreaterThan(0.95);
  });

  it('scores a sealed tunnel as one route', () => {
    const l = floorLevel((t, row) => {
      for (let y = 0; y < row - 2; y++) for (let x = 0; x < LEVEL_W; x++) t[y * LEVEL_W + x] = T_SOLID;
    });
    expect(analyzeRoutes(l).shared).toBeGreaterThan(0.95);
  });

  it('sees a raised catwalk along most of the level as a second route', () => {
    const l = floorLevel((t, row) => {
      // Three rows up: a plain jump from the floor, and outside its lane.
      for (let x = 8; x < LEVEL_W - 8; x++) t[(row - 2) * LEVEL_W + x] = T_ONEWAY;
    });
    expect(analyzeRoutes(l).shared).toBeLessThanOrEqual(MAX_SHARED);
  });

  it('does not count a catwalk nobody can reach', () => {
    const l = floorLevel((t, row) => {
      // Far above any jump, with no way up.
      for (let x = 8; x < LEVEL_W - 8; x++) t[(row - 12) * LEVEL_W + x] = T_ONEWAY;
    });
    expect(analyzeRoutes(l).shared).toBeCloseTo(analyzeRoutes(floorLevel()).shared, 5);
  });

  it('reports an unreachable goal as closed', () => {
    const l = floorLevel((t) => {
      for (let y = 0; y < LEVEL_H; y++) t[y * LEVEL_W + 24] = T_SOLID;
    });
    const r = analyzeRoutes(l);
    expect(r.shared).toBe(1);
    expect(r.fastest).toEqual([]);
  });

  it('does not charge a level for the span a bridge crosses', () => {
    const pit = floorLevel((t, row) => {
      for (let y = row + 1; y < LEVEL_H; y++) for (let x = 20; x <= 28; x++) t[y * LEVEL_W + x] = 0;
      for (let x = 7; x < 19; x++) t[(row - 2) * LEVEL_W + x] = T_ONEWAY;
      for (let x = 30; x < LEVEL_W - 7; x++) t[(row - 2) * LEVEL_W + x] = T_ONEWAY;
    });
    expect(analyzeRoutes(pit, [{ x: 23, y: 21 }]).shared).toBeLessThanOrEqual(MAX_SHARED);
  });

  it("answers from a cache's kept routes only while nothing they read has changed", () => {
    const l = floorLevel();
    const cache = new ReachCache(l);
    const first = analyzeRoutes(l, [], cache);
    expect(analyzeRoutes(l, [], cache)).toBe(first);
    // A catwalk laid in place (as lanes do), a bridge, a pocket moved and the weather: each is a fresh question.
    for (let x = 8; x < LEVEL_W - 8; x++) l.tiles[18 * LEVEL_W + x] = T_ONEWAY;
    expect(analyzeRoutes(l, [], cache)).toEqual(analyzeRoutes(l));
    expect(analyzeRoutes(l, [{ x: 23, y: 21 }], cache)).toEqual(analyzeRoutes(l, [{ x: 23, y: 21 }]));
    const moved = { ...l, protectedRects: [l.protectedRects[0]] };
    expect(analyzeRoutes(moved, [], cache)).toEqual(analyzeRoutes(moved));
    const wet = { ...l, weather: { kind: 'rain' as const, dir: 0 as const, period: 0, first: 0 } };
    expect(analyzeRoutes(wet, [], cache)).toEqual(analyzeRoutes(wet));
  });
});

describe('one bridge for two', () => {
  it("asks judge's search again only while the terrain is the one it searched", () => {
    // A pit two bridges wide in a lone corridor: judge's search settles on two.
    const pit = floorLevel((t, row) => {
      for (let y = row + 1; y < LEVEL_H; y++) for (let x = 16; x <= 31; x++) t[y * LEVEL_W + x] = 0;
    });
    const cache = new ReachCache(pit);
    expect(judge(pit, [], [], cache).bridges).toHaveLength(2);
    expect(oneBridgeEnough(pit, [], cache)).toEqual(oneBridgeEnough(pit));
    // Narrow it to one bridge's reach in place: the kept search is stale, and a fresh look must find the bridge.
    for (let y = 21; y < LEVEL_H; y++) for (let x = 16; x <= 31; x++) if (x < 21 || x > 26) pit.tiles[y * LEVEL_W + x] = T_SOLID;
    cache.rebase(pit.tiles);
    expect(oneBridgeEnough(pit, [], cache)).toEqual(oneBridgeEnough(pit));
    expect(oneBridgeEnough(pit, [], cache)).not.toBeNull();
  });
});

describe('levels are mostly open', () => {
  // Every theme's levels are held to it in tests/conformance/levels (classic, wide and tall) and over many seeds in tests/stats/open-routes.

  it('isAcceptable enforces it on a real level', { timeout: 60_000 }, () => {
    const l = generateLevel(seedAt(1), 'farm');
    expect(isAcceptable(l)).toBe(true);
    const narrowed: Level = {
      ...l,
      solution: [],
      tiles: floorLevel().tiles,
      spawn: { tx: 2, ty: 20 },
      goal: { tx: LEVEL_W - 3, ty: 20 },
      w: LEVEL_W,
      h: LEVEL_H,
      protectedRects: floorLevel().protectedRects,
    };
    expect(isAcceptable(narrowed)).toBe(false);
  });

  it('tall levels stay open at every gravity', { timeout: 120_000 }, () => {
    for (const gravity of [0.7, 1, 1.35]) {
      for (const t of ['castle', 'factory', 'jungle'] as const) {
        const l = generateLevel(seedAt(3), t, { size: 'tall', gravity });
        expect(lastGenInfo.fallback, `${t} ${gravity}`).toBe(false);
        expect(analyzeRoutes(l, l.solution ?? []).shared, `${t} ${gravity}`).toBeLessThanOrEqual(MAX_SHARED);
      }
    }
  });
});

describe('sculptor tuning', () => {
  it('measures a walking jump shorter than a running one', () => {
    for (const g of [0.7, 1, 1.35]) {
      const j = jumpProfile(g);
      expect(j.walkGap).toBeGreaterThanOrEqual(2);
      expect(j.walkGap).toBeLessThan(j.gap);
    }
  });

  it('jumpable gaps ask more of your range the harder the level: fewer walking hops, more of the longest jump', () => {
    setProbeGravity(1);
    const j = jumpProfile(1);
    const shares = DIFFICULTIES.map((d) => {
      setLevelDifficulty(d);
      const rng = new Rng(7);
      const gaps = Array.from({ length: 400 }, () => jumpGap(rng));
      expect(gaps.every((g) => g >= j.walkGap - 1 && g <= j.gap)).toBe(true);
      return { walk: gaps.filter((g) => g <= j.walkGap).length / gaps.length, full: gaps.filter((g) => g === j.gap).length / gaps.length };
    });
    // A gentle level never asks for the longest jump; each harder one walks less and jumps full range more.
    expect(shares[0].full).toBe(0);
    for (let i = 1; i < shares.length; i++) {
      expect(shares[i].walk).toBeLessThan(shares[i - 1].walk);
      expect(shares[i].full).toBeGreaterThan(shares[i - 1].full);
    }
    const rng = new Rng(7);
    for (let i = 0; i < 100; i++) expect(hopGap(rng)).toBeGreaterThanOrEqual(j.walkGap - 1);
    for (let i = 0; i < 100; i++) expect(hopGap(rng)).toBeLessThanOrEqual(j.walkGap);
    setLevelDifficulty('medium');
  });

  for (const gravity of [0.7, 1, 1.35]) {
    it(`the controller clears every jumpable crossing, stones and the longest jumps included, at gravity ${gravity}`, { timeout: 30_000 }, () => {
      setProbeGravity(gravity);
      setLevelDifficulty('hard');
      const rng = new Rng(11);
      const seen = new Map<string, Crossing>();
      for (let i = 0; i < 60; i++) {
        const c = jumpCrossing(rng);
        seen.set(`${c.w}:${c.stones.join(',')}`, c);
      }
      const all = [...seen.values()];
      expect(all.some((c) => c.stones.length > 0)).toBe(true);
      expect(all.some((c) => !c.stones.length && c.w === jumpProfile(gravity).gap)).toBe(true);
      for (const c of all) {
        const l = floorLevel((tiles, row) => {
          const x0 = Math.floor((LEVEL_W - c.w) / 2);
          for (let y = row + 1; y < LEVEL_H; y++) for (let x = x0; x < x0 + c.w; x++) tiles[y * LEVEL_W + x] = c.stones.includes(x - x0) ? T_SOLID : 0;
        });
        expect(analyzeReach({ ...l, gravity }).goalReached, `width ${c.w} stones ${c.stones.join(',')}`).toBe(true);
      }
      setProbeGravity(1);
      setLevelDifficulty('medium');
    });
  }

  it('stretches the narrowest easy gap with the walking reach, leaving normal and high gravity as they were', () => {
    const was = probeGravity();
    const rng = new Rng(9);
    for (const g of [1, 1.35]) {
      setProbeGravity(g);
      expect(reachMin(2)).toBe(2);
      expect(reachMin(1)).toBe(1);
    }
    setProbeGravity(0.7);
    const lo = reachMin(2);
    expect(lo).toBeGreaterThan(2);
    expect(lo).toBeLessThanOrEqual(jumpProfile(0.7).walkGap);
    for (let i = 0; i < 100; i++) {
      expect(jumpGap(rng)).toBeGreaterThanOrEqual(lo);
      expect(hopGap(rng, 2)).toBeGreaterThanOrEqual(lo);
    }
    setProbeGravity(was);
  });

  it('decides a challenge once per level, so retries cannot select it away', () => {
    for (const challenge of [0.1, 0.5, 0.95]) {
      const first = rollChallenges(0, { challenge });
      for (let attempt = 1; attempt < TWO_PART_TRIES; attempt++) expect(rollChallenges(attempt, { challenge })).toBe(first);
    }
    expect(rollChallenges(0, { challenge: TWO_PARTS - 0.01 })).toBe(2);
    expect(rollChallenges(0, { challenge: TWO_PARTS + 0.01 })).toBe(1);
  });
});
