import { jumpMetrics } from '../src/sim/physics';
import { describe, expect, it } from 'vitest';
import { BRIDGE_W, canPlaceBridge, generateLevel, judge, lastGenInfo, MAX_BRIDGES, withBridges } from '../src/gen/level';
import { jumpProfile } from '../src/gen/level/probe';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { isProtected, type Level, T_EMPTY, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { analyzeReach, isStandable } from '../src/sim/reach';
import { THEME_IDS } from '../src/themes';

const SEEDS = 30;
const seedAt = (i: number) => (i * 2654435761 + 12345) >>> 0;

/** Independent policy check: solvable bare, or with the reported ≤2 bridges re-verified here. */
function checkPolicy(l: Level, bridges: { x: number; y: number }[]): boolean {
  if (bridges.length === 0) return analyzeReach(l).goalReached;
  if (bridges.length > MAX_BRIDGES) return false;
  for (const b of bridges) {
    if (!canPlaceBridge(l, b)) return false;
    for (let i = 0; i < BRIDGE_W; i++) if (isProtected(l, b.x + i, b.y)) return false;
  }
  return analyzeReach(withBridges(l, bridges)).goalReached;
}

describe('worldgen per theme', () => {
  let bridged = 0;
  let total = 0;
  for (const theme of THEME_IDS) {
    it(`${theme}: deterministic, valid, policy-solvable, themed`, { timeout: 60_000 }, () => {
      let themeBridged = 0;
      for (let i = 0; i < SEEDS; i++) {
        const seed = seedAt(i);
        const l = generateLevel(seed, theme);
        const info = { ...lastGenInfo };
        const again = generateLevel(seed, theme);
        expect(Array.from(again.tiles), `${theme} seed ${seed} determinism`).toEqual(Array.from(l.tiles));
        expect(again.spawn).toEqual(l.spawn);
        expect(again.goal).toEqual(l.goal);
        expect(lastGenInfo.bridges).toEqual(info.bridges);

        expect(info.fallback, `${theme} seed ${seed} fallback`).toBe(false);
        expect(l.style.startsWith(`${theme}:`), l.style).toBe(true);
        expect(l.tiles.length).toBe(LEVEL_W * LEVEL_H);
        expect(l.tiles.every((t) => t === T_EMPTY || t === T_SOLID || t === T_ONEWAY)).toBe(true);
        // Spawn left, goal right, both standable and protected.
        expect(l.spawn.tx).toBeLessThan(5);
        expect(l.goal.tx).toBeGreaterThan(LEVEL_W - 6);
        expect(isStandable(l, l.spawn.tx, l.spawn.ty)).toBe(true);
        expect(isStandable(l, l.goal.tx, l.goal.ty)).toBe(true);
        expect(isProtected(l, l.spawn.tx, l.spawn.ty)).toBe(true);
        expect(isProtected(l, l.goal.tx, l.goal.ty)).toBe(true);
        expect(checkPolicy(l, info.bridges), `${theme} seed ${seed} policy`).toBe(true);
        if (info.bridges.length) themeBridged++;
      }
      // Most levels need props (playtest target ~70-85%), but every theme keeps some prop-free ones.
      expect(themeBridged).toBeGreaterThan(SEEDS * 0.5);
      expect(themeBridged).toBeLessThan(SEEDS);
      bridged += themeBridged;
      total += SEEDS;
    });
  }
  it('overall share of levels needing bridges is in a sane band', () => {
    expect(total).toBe(SEEDS * THEME_IDS.length);
    const share = bridged / total;
    expect(share).toBeGreaterThan(0.65);
    expect(share).toBeLessThan(0.92);
  });

  it('themes have several sub-styles each', { timeout: 60_000 }, () => {
    for (const theme of THEME_IDS) {
      const styles = new Set<string>();
      for (let i = 0; i < 24; i++) styles.add(generateLevel(seedAt(i + 100), theme).style);
      expect(styles.size, theme).toBeGreaterThanOrEqual(2);
    }
  });
});

/**
 * A synthetic level: ledges at both ends with `gap` empty columns between
 * them; the far bank is undercut (as sculptors do) so it can't be wall-climbed.
 */
function gapLevel(gap: number): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const row = 18;
  const leftEnd = Math.floor((LEVEL_W - gap) / 2) - 1;
  const far = leftEnd + gap + 1;
  for (let x = 0; x < LEVEL_W; x++)
    if (x <= leftEnd || x >= far) for (let y = row + 1; y < LEVEL_H; y++) if (x > far + 1 || y <= row + 2) tiles[y * LEVEL_W + x] = T_SOLID;
  return {
    seed: 0,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: LEVEL_W - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: LEVEL_W - 5, y: row - 3, w: 5, h: 5 },
    ],
    theme: generateLevel(1).theme,
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

describe('solvability policy', () => {
  const j = jumpProfile();
  it('measures a sane jump profile from the controller', () => {
    expect(j.gap).toBeGreaterThanOrEqual(2);
    expect(j.rise).toBeGreaterThanOrEqual(2);
    expect(j.gapAt(-4)).toBeGreaterThanOrEqual(j.gap);
  });
  it('accepts a jumpable gap with no bridges', () => {
    const v = judge(gapLevel(j.gap));
    expect(v).toMatchObject({ ok: true, bridges: [] });
  });
  it('finds one bridge for a gap just too wide to jump', () => {
    const l = gapLevel(j.gap + 2);
    expect(analyzeReach(l).goalReached).toBe(false);
    const v = judge(l);
    expect(v.ok).toBe(true);
    expect(v.bridges.length).toBe(1);
    expect(checkPolicy(l, v.bridges)).toBe(true);
  });
  it('finds two bridges for a gap that needs both', () => {
    // A 3-wide bridge is too short for a run-up, so hops off a bridge are short walking
    // jumps; two-bridge chains only exist for some widths. Somewhere just past the
    // single-bridge limit the solver must find a verified two-bridge solution.
    const walkGap = Math.floor(jumpMetrics().walkJumpDistance) - 1;
    const from = j.gap + BRIDGE_W + walkGap;
    let found = false;
    for (let g = from; g <= from + 6 && !found; g++) {
      const l = gapLevel(g);
      const v = judge(l);
      if (v.ok && v.bridges.length === 2) {
        expect(checkPolicy(l, v.bridges)).toBe(true);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it('rejects a level no two bridges can save', () => {
    const v = judge(gapLevel(LEVEL_W - 12));
    expect(v.ok).toBe(false);
  });
});
