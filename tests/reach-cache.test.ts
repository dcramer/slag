import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { analyzeReach, ReachCache } from '../src/sim/reach';
import { THEME_IDS } from '../src/themes';

const seedAt = (i: number) => (i * 2654435761 + 17) >>> 0;

/** Stamp a few small changes anywhere: blocks, one-ways, or dug-out holes. */
function changed(level: Level, rng: Rng): Level {
  const tiles = level.tiles.slice();
  for (let n = rng.int(1, 4); n > 0; n--) {
    const x0 = rng.int(0, level.w - 4);
    const y0 = rng.int(1, level.h - 3);
    const kind = rng.pick([T_SOLID, T_ONEWAY, T_EMPTY]);
    for (let y = y0; y < y0 + rng.int(1, 2); y++) for (let x = x0; x < x0 + rng.int(1, 4); x++) tiles[y * level.w + x] = kind;
  }
  return { ...level, tiles };
}

function edges(run: (onEdge: (a: number, b: number) => void) => void): number[] {
  const out: number[] = [];
  run((a, b) => out.push(a, b));
  return out;
}

describe('ReachCache', () => {
  it('answers exactly as a fresh analysis does, whatever ran before', { timeout: 60_000 }, () => {
    for (const [i, theme] of THEME_IDS.entries()) {
      const level = generateLevel(seedAt(i), theme);
      const rng = new Rng(i);
      const cache = new ReachCache(level);
      cache.analyze(level, false);
      for (let n = 0; n < 12; n++) {
        const v = changed(level, rng);
        const fresh = edges((onEdge) => analyzeReach(v, false, onEdge));
        const cached = edges((onEdge) => cache.analyze(v, false, { onEdge }));
        expect(cached, `${theme} change ${n}`).toEqual(fresh);
        expect(cache.analyze(v).goalReached).toBe(analyzeReach(v).goalReached);
      }
      expect(edges((onEdge) => cache.analyze(level, false, { onEdge }))).toEqual(edges((onEdge) => analyzeReach(level, false, onEdge)));
    }
  });

  it('keeps answering after moving to new tiles', { timeout: 30_000 }, () => {
    const level = generateLevel(seedAt(3), 'castle');
    const cache = new ReachCache(level);
    const rng = new Rng(9);
    cache.analyze(level, false);
    let now = level;
    for (let n = 0; n < 6; n++) {
      now = changed(now, rng);
      cache.rebase(now.tiles);
      expect(edges((onEdge) => cache.analyze(now, false, { onEdge }))).toEqual(edges((onEdge) => analyzeReach(now, false, onEdge)));
    }
  });

  it('reuses traces: a small change re-traces a fraction of a level', () => {
    const level = generateLevel(seedAt(1), 'farm');
    const cache = new ReachCache(level);
    const bridged = { ...level, tiles: level.tiles.slice() };
    for (const b of level.solution ?? []) for (let i = 0; i < 3; i++) bridged.tiles[b.y * level.w + b.x + i] = T_SOLID;
    const t0 = performance.now();
    cache.analyze(bridged, false);
    const cold = performance.now() - t0;
    const hole = { ...bridged, tiles: bridged.tiles.slice() };
    hole.tiles[Math.floor(level.h / 2) * level.w + Math.floor(level.w / 2)] = T_SOLID;
    cache.rebase(bridged.tiles);
    const t1 = performance.now();
    cache.analyze(hole, false);
    expect(performance.now() - t1).toBeLessThan(cold);
  });
});
