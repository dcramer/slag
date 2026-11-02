import { jumpMetrics } from '../src/sim/physics';
import { describe, expect, it } from 'vitest';
import { BRIDGE_W, generateLevel, judge } from '../src/gen/level';
import { jumpProfile } from '../src/gen/level/probe';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { type Level, T_SOLID } from '../src/sim/level';
import { analyzeReach } from '../src/sim/reach';
import { THEME_IDS } from '../src/themes';
import { checkPolicy, expectThemedLevel } from './lib/level-checks';

const SEEDS = 2;
const seedAt = (i: number) => (i * 2654435761 + 12345) >>> 0;

describe('worldgen per theme', () => {
  for (const theme of THEME_IDS) {
    it(`${theme}: deterministic, valid, policy-solvable, themed`, { timeout: 60_000 }, () => {
      for (let i = 0; i < SEEDS; i++) expectThemedLevel(theme, seedAt(i));
    });
  }
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
