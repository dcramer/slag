import { describe, expect, it } from 'vitest';
import type { Theme } from '../src/gen/theme';
import { type Level, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { jumpMetrics } from '../src/sim/physics';
import { analyzeReach, goalField, isStandable, ReachCache } from '../src/sim/reach';
import { generateLevel } from '../src/gen/level';

/**
 * Handcrafted level from ASCII rows: '#' solid, '=' one-way, 'S' spawn, 'G' goal,
 * anything else empty. Spawn/goal cells must be standable.
 */
function level(rows: string[]): Level {
  const h = rows.length;
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  let spawn = { tx: 0, ty: 0 };
  let goal = { tx: 0, ty: 0 };
  rows.forEach((row, y) => {
    expect(row.length).toBe(w);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      tiles[y * w + x] = ch === '#' ? T_SOLID : ch === '=' ? T_ONEWAY : 0;
      if (ch === 'S') spawn = { tx: x, ty: y };
      if (ch === 'G') goal = { tx: x, ty: y };
    }
  });
  return { seed: 0, w, h, tiles, spawn, goal, protectedRects: [], theme: {} as Theme, style: 'test', setPieces: [], version: 0 };
}

const reached = (rows: string[]) => {
  const l = level(rows);
  expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
  expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
  return analyzeReach(l).goalReached;
};

describe('reach analyzer', () => {
  it('walks and jumps across a small gap', () => {
    expect(
      reached([
        '..........................',
        '..........................',
        '..........................',
        '..S...................G...',
        '##########....############',
        '##########....############',
      ]),
    ).toBe(true);
  });

  it('does not invent reach: a ledge far above any jump with no walls nearby', () => {
    expect(jumpMetrics().jumpHeight).toBeLessThan(7);
    expect(
      reached([
        '..................................',
        '..................................',
        '..............G...................',
        '...........#######................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..S...............................',
        '##################################',
      ]),
    ).toBe(false);
  });

  it('finds a single-wall climb (plateau far higher than a jump)', () => {
    const rows = [
      '..............................',
      '..............................',
      '..................G...........',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..............################',
      '..S...........################',
      '##############################',
    ];
    // 10 tiles: more than two full jumps.
    expect(10).toBeGreaterThan(jumpMetrics().jumpHeight * 2);
    expect(reached(rows)).toBe(true);
  });

  it('finds a two-wall shaft climb', () => {
    expect(
      reached([
        '##############################',
        '..........................G...',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#...#################',
        '.........#S..#################',
        '##############################',
      ]),
    ).toBe(true);
  });

  it('jumps up through one-way platforms and stands on them', () => {
    const rows = [
      '##############################',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '.........G....................',
      '.....==========...............',
      '..............................',
      '..............................',
      '.....==========...............',
      '..............................',
      '.........S....................',
      '##############################',
    ];
    const l = level(rows);
    expect(analyzeReach(l).goalReached).toBe(true);
    // The lower platform is standable and reached too.
    const all = analyzeReach(l, false).reachable;
    expect(all.has(8 * l.w + 7)).toBe(true);
  });

  it('the side edges are not walls: nothing climbs them', () => {
    // Four tiles up is over a jump's height; only a kick off the left edge used to reach it.
    const rows = [
      '##############################',
      '..............................',
      '.........G....................',
      '.....==========...............',
      '..............................',
      '..............................',
      '..............................',
      '.........S....................',
      '##############################',
    ];
    expect(analyzeReach(level(rows)).goalReached).toBe(false);
  });

  it('drops through a one-way floor', () => {
    expect(
      reached([
        '##############################',
        '#............................#',
        '#.....S......................#',
        '#############=================',
        '#............................#',
        '#............................#',
        '#.......G....................#',
        '##############################',
      ]),
    ).toBe(true);
  });

  it('a solid version of the same floor is not passable', () => {
    expect(
      reached([
        '##############################',
        '#............................#',
        '#.....S......................#',
        '##############################',
        '#............................#',
        '#............................#',
        '#.......G....................#',
        '##############################',
      ]),
    ).toBe(false);
  });
});

describe('goal field', () => {
  it('measures through a kept cache exactly what it measures fresh, round after round of parts', () => {
    const lv = generateLevel(3);
    const cache = new ReachCache(lv, undefined, true);
    const tiles = lv.tiles.slice();
    for (let round = 0; round < 4; round++) {
      // A part's worth of rock on the ground somewhere along the level.
      const x = 8 + round * 9;
      for (let y = 0; y < lv.h - 1; y++)
        if (tiles[(y + 1) * lv.w + x] === T_SOLID && tiles[y * lv.w + x] !== T_SOLID) {
          tiles[y * lv.w + x] = tiles[y * lv.w + x + 1] = T_SOLID;
          break;
        }
      const at = { ...lv, tiles: tiles.slice() };
      cache.rebase(at.tiles);
      for (const air of [false, true]) expect(goalField(at, { air, careful: true, cache })).toEqual(goalField(at, { air, careful: true }));
    }
  });
});
