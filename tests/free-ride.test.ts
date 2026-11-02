import { describe, expect, it } from 'vitest';
import { noFreeRide } from '../src/gen/level/winnable';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { type Level, T_SOLID } from '../src/sim/level';
import type { Module, PlacedProp, PropDef } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/** A floor at row FLOOR with a pit no bare jump clears, spawn left of it, flag right. */
const FLOOR = LEVEL_H - 4;
const GAP = [18, 30] as const;
function pit(gap = true): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) if (!gap || x < GAP[0] || x >= GAP[1]) tiles[y * LEVEL_W + x] = T_SOLID;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/** A four-platform windmill turning about `hub` (tiles). */
function rotor(hub: [number, number]): PlacedProp {
  const m: Module = {
    type: 'rotor',
    look: 'windmill',
    support: 'none',
    mastX: 0,
    hub,
    arm: 3.5,
    count: 4,
    angle0: 0.3,
    period: 420,
    swing: 0,
    dir: 1,
    width: 2,
    thick: 0.5,
    material: 'wood',
    seed: 1,
  };
  const def: PropDef = {
    key: 'test',
    name: 'test',
    maker: 'test',
    archetype: 'platform',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [m],
    footprint: [[0, 0]],
  };
  return { uid: 100_000, def, owner: -1, tx: 0, ty: 0, rot: 0 };
}

describe('noFreeRide', () => {
  it('refuses a rotor parked over the crossing a part should close', () => {
    const level = pit();
    expect(analyzeReach(level).goalReached).toBe(false);
    expect(noFreeRide(level, rotor([24, FLOOR - 3]))).toBe(false);
  });

  it('passes the same rotor far from the crossing', () => {
    expect(noFreeRide(pit(), rotor([9, FLOOR - 9]))).toBe(true);
  });

  it('passes anything on a level the ghost already finishes bare', () => {
    expect(noFreeRide(pit(false), rotor([24, FLOOR - 3]))).toBe(true);
  });
});
