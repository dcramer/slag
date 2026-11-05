import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { DIFFICULTIES, DIFFICULTY, rollDifficulty } from '../src/gen/level/difficulty';
import { JumpCache, routeJumps, routePrecision, slip } from '../src/gen/level/precision';
import { Rng } from '../src/core/rng';
import { setProbeGravity } from '../src/gen/level/probe';
import { analyzeRoutes } from '../src/gen/level/routes';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { type Level, T_SOLID } from '../src/sim/level';
import type { Controls } from '../src/sim/physics';

const ROW = 20;

/** A flat floor from pocket to pocket with a pit `w` wide in the middle and stones standing in it at `stones` (columns from its left edge). */
function pitLevel(w: number, stones: number[] = []): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const x0 = 20;
  for (let y = ROW + 1; y < LEVEL_H; y++)
    for (let x = 0; x < LEVEL_W; x++) if (x < x0 || x >= x0 + w || stones.includes(x - x0)) tiles[y * LEVEL_W + x] = T_SOLID;
  return {
    seed: 0,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: ROW },
    goal: { tx: LEVEL_W - 3, ty: ROW },
    protectedRects: [],
    theme: generateLevel(1).theme,
    style: 'test',
    version: 0,
    setPieces: [],
    gravity: 1,
  };
}

const tight = (l: Level) => routePrecision(l, analyzeRoutes(l).fastest).tight;

describe('precision', () => {
  it('counts a jump tight when a slip off it falls out of the level, and only then', () => {
    setProbeGravity(1);
    expect(tight(pitLevel(0))).toBe(0);
    // A plain pit a running jump clears with room to spare, landing on a floor you can't run off.
    expect(tight(pitLevel(4))).toBe(0);
    // A stone you can't stop on at a run: running on past it is a fall.
    expect(tight(pitLevel(9, [4]))).toBe(1);
    expect(tight(pitLevel(14, [4, 9]))).toBe(2);
  });

  it('slips the way people miss: letting go early, a beat late or early, never braking', () => {
    const c = (o: Partial<Controls>): Controls => ({ left: false, right: true, jump: false, jumpPressed: false, run: true, ...o });
    const move = [
      c({}),
      c({}),
      c({}),
      c({ jump: true, jumpPressed: true }),
      ...Array.from({ length: 10 }, () => c({ jump: true })),
      c({ right: false }),
      c({ right: false }),
    ];
    expect(slip(move, 'short')!.filter((x) => x.jump).length).toBe(11 - 4);
    expect(slip(move, 'late')!.findIndex((x) => x.jumpPressed)).toBe(3 + 3);
    expect(slip(move, 'early')!.findIndex((x) => x.jumpPressed)).toBe(3 - 2);
    const long = slip(move, 'long')!;
    expect(long.slice(3).every((x) => x.right && x.run)).toBe(true);
    expect(long.length).toBeGreaterThan(move.length);
  });
});

describe('difficulty', () => {
  it('rolls from the seed alone, the same every time', () => {
    for (const seed of [1, 2, 3]) expect(rollDifficulty(seed)).toBe(rollDifficulty(seed));
    expect(new Set(Array.from({ length: 30 }, (_, i) => rollDifficulty(i + 1))).size).toBe(DIFFICULTIES.length);
  });

  it('picks a draw whose precision fits the level’s difficulty, or the nearest after its draws', { timeout: 120_000 }, () => {
    for (const difficulty of DIFFICULTIES) {
      const {
        precision: [lo, hi],
        draws,
      } = DIFFICULTY[difficulty];
      for (const seed of [3, 4]) {
        const l = generateLevel(seed, 'farm', { difficulty });
        expect(l.profile?.difficulty).toBe(difficulty);
        expect(lastGenInfo.fallback).toBe(false);
        const fits = lastGenInfo.precision >= lo && lastGenInfo.precision <= hi;
        expect(fits || lastGenInfo.draws === draws + 1, `${difficulty} ${seed}: precision ${lastGenInfo.precision} after ${lastGenInfo.draws} draws`).toBe(
          true,
        );
        expect(lastGenInfo.draws).toBeLessThanOrEqual(draws + 1);
        // The pick is part of the level: the same seed gives the same one.
        expect(generateLevel(seed, 'farm', { difficulty }).tiles).toEqual(l.tiles);
      }
    }
  });

  it('measures from its cache exactly what it measures fresh, as tiles change a little at a time', () => {
    for (const seed of [2, 5]) {
      const level = generateLevel(seed);
      const bridges = level.solution ?? [];
      const route = analyzeRoutes(level, bridges).fastest;
      const cache = new JumpCache(level);
      const rng = new Rng(seed);
      const tiles = level.tiles.slice();
      for (let i = 0; i < 12; i++) {
        // A block dropped near the route, the way a weighed part lands.
        const c = route[rng.int(0, route.length - 1)];
        const x = (c % level.w) + rng.int(-2, 2);
        const y = Math.floor(c / level.w) + rng.int(-2, 1);
        const at = { ...level, tiles: tiles.slice() };
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            if (x + dx >= 0 && x + dx < level.w && y + dy >= 0 && y + dy < level.h) at.tiles[(y + dy) * level.w + x + dx] = T_SOLID;
        expect(routeJumps(at, route, bridges, cache)).toEqual(routeJumps(at, route, bridges));
      }
    }
  });
});
