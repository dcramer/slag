import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel, isAcceptable, lastGenInfo } from '../src/gen/level';
import { jumpProfile, setProbeGravity } from '../src/gen/level/probe';
import { analyzeRoutes, MAX_SHARED } from '../src/gen/level/routes';
import { easyGap, hopGap, rollChallenges, TWO_PARTS } from '../src/gen/level/sculptors/common';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { type Level, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { THEME_IDS } from '../src/themes';
import { SLOW, sample } from './lib/tier';

const seedAt = (i: number) => (i * 2654435761 + 4242) >>> 0;
const SEEDS = sample(2, 12);

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
});

describe('levels are mostly open', () => {
  it('every theme, size and gravity keeps a second route, re-measured from the final level', { timeout: 240_000 }, () => {
    let measured = 0;
    let sculptedClosed = 0;
    for (const theme of THEME_IDS) {
      for (let i = 0; i < SEEDS; i++) {
        const l = generateLevel(seedAt(i), theme);
        const info = { ...lastGenInfo };
        expect(info.fallback, `${theme} ${l.seed}`).toBe(false);
        const r = analyzeRoutes(l, l.solution ?? []);
        expect(r.fastest.length, `${theme} ${l.seed} solvable`).toBeGreaterThan(0);
        expect(r.shared, `${theme} ${l.seed} ${l.style}`).toBeLessThanOrEqual(MAX_SHARED);
        expect(r.shared).toBeCloseTo(info.shared, 5);
        if (info.sculpted > MAX_SHARED) sculptedClosed++;
        measured++;
      }
    }
    // A share, so only a full sweep can show it: the rule does work, most sculpts need the lane pass.
    if (SLOW) expect(sculptedClosed / measured).toBeGreaterThan(0.3);
  });

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

  it('easy gaps mix walking hops with running jumps; hops never need a run', () => {
    setProbeGravity(1);
    const rng = new Rng(7);
    const j = jumpProfile(1);
    const gaps = Array.from({ length: 400 }, () => easyGap(rng));
    expect(gaps.every((g) => g >= 2 && g < j.gap)).toBe(true);
    const walking = gaps.filter((g) => g <= j.walkGap).length / gaps.length;
    expect(walking).toBeGreaterThan(0.45);
    expect(walking).toBeLessThan(0.75);
    for (let i = 0; i < 100; i++) expect(hopGap(rng)).toBeLessThanOrEqual(j.walkGap);
  });

  it('decides a challenge once per level, so retries cannot select it away', () => {
    for (const challenge of [0.1, 0.5, 0.95]) {
      const first = rollChallenges(0, { challenge });
      for (let attempt = 1; attempt < 8; attempt++) expect(rollChallenges(attempt, { challenge })).toBe(first);
    }
    expect(rollChallenges(0, { challenge: TWO_PARTS - 0.01 })).toBe(2);
    expect(rollChallenges(0, { challenge: TWO_PARTS + 0.01 })).toBe(1);
  });
});
