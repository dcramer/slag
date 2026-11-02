import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { canPlace, detonate, type PlacedProp, type PropDef } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row

/** Flat floor from FLOOR down, plus a wall column at x=30 rising to row 10. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 5 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const coatDef = (kind: 'spikestrip' | 'icecoat' | 'slimecoat', n = 3): PropDef => {
  for (let i = 0; i < 200; i++) {
    const d = generateProp(new Rng(i), kind, 'x');
    if (d.footprint.length === n) return d;
  }
  throw new Error('no def');
};

describe('attachment placement rule', () => {
  const level = testLevel();
  const ice = coatDef('icecoat');
  it('mounts on an exposed top face of terrain', () => {
    expect(ice.mount).toBe('face');
    expect(canPlace(level, [], ice, 0, 10, FLOOR)).toBe(true);
  });
  it('rejects mid-air, buried faces, and protected cells', () => {
    expect(canPlace(level, [], ice, 0, 10, FLOOR - 3)).toBe(false); // nothing to stick to
    expect(canPlace(level, [], ice, 0, 10, FLOOR + 2)).toBe(false); // face is buried in rock
    expect(canPlace(level, [], ice, 0, 1, FLOOR)).toBe(false); // spawn zone
  });
  it('rotation picks the face (wall side)', () => {
    // rot 1 = facing right; footprint becomes a vertical strip on the wall column x=30.
    expect(canPlace(level, [], ice, 1, 30, 12)).toBe(true);
    expect(canPlace(level, [], ice, 3, 30, 12)).toBe(true); // left face
    expect(canPlace(level, [], ice, 1, 31, 12)).toBe(false); // not on the wall
  });
  it('cannot coat the same face twice, but can stack different faces', () => {
    const placed: PlacedProp[] = [{ uid: 1, def: ice, owner: 0, tx: 10, ty: FLOOR, rot: 0 }];
    expect(canPlace(level, placed, ice, 0, 11, FLOOR)).toBe(false);
    expect(canPlace(level, placed, coatDef('spikestrip', 1), 0, 14, FLOOR)).toBe(true);
  });
  it('falls off when a bomb removes its host', () => {
    const lv = testLevel();
    const placed: PlacedProp[] = [{ uid: 1, def: ice, owner: 0, tx: 10, ty: FLOOR, rot: 0 }];
    expect(detonate(lv, placed, 2.5, 11, FLOOR)).toHaveLength(0);
  });
});

describe('attachment behavior', () => {
  it('spike strips kill whoever stands on them', () => {
    const lv = testLevel();
    const run = new RunWorld(lv, [{ uid: 1, def: coatDef('spikestrip', 3), owner: 1, tx: 2, ty: FLOOR, rot: 0 }], [0]);
    for (let f = 0; f < 120 && run.runners[0].alive; f++) run.step([NO_INPUT]);
    expect(run.runners[0].alive).toBe(false);
    expect(run.runners[0].killer).toBe(1);
  });

  it('ice makes you slide further; slime stops you sooner', () => {
    const slide = (def: PropDef | null) => {
      const lv = testLevel();
      lv.spawn = { tx: 10, ty: FLOOR - 1 };
      const placed: PlacedProp[] = def ? [{ uid: 1, def, owner: 1, tx: 8, ty: FLOOR, rot: 0 }] : [];
      const run = new RunWorld(lv, placed, [0]);
      const b = run.runners[0].body;
      // Skip the countdown, then let go at running speed and see how far you slide.
      for (let f = 0; f < 70; f++) run.step([NO_INPUT]);
      b.vx = 150;
      const x0 = b.x;
      for (let f = 0; f < 20; f++) run.step([NO_INPUT]);
      return b.x - x0;
    };
    const plain = slide(null);
    const ice = slide(coatDef('icecoat', 5));
    const slime = slide(coatDef('slimecoat', 5));
    expect(ice).toBeGreaterThan(plain * 2);
    expect(slime).toBeLessThanOrEqual(plain);
  });

  it('slime on a wall makes you cling; ice on a wall stops wall slides', () => {
    const fall = (def: PropDef | null) => {
      const lv = testLevel();
      const placed: PlacedProp[] = def ? [{ uid: 1, def, owner: 1, tx: 30, ty: 11, rot: 3 }] : [];
      const run = new RunWorld(lv, placed, [0]);
      for (let f = 0; f < 61; f++) run.step([NO_INPUT]);
      // Drop the runner next to the wall's left face, pressing into it.
      const b = run.runners[0].body;
      Object.assign(b, bodyAtCell(29, 11));
      b.x = 30 * TILE - b.w - 3.5;
      b.y = 11 * TILE;
      b.onGround = false;
      b.groundRef = -1;
      const y0 = b.y;
      for (let f = 0; f < 30; f++) run.step([{ ...NO_INPUT, right: true }]);
      return b.y - y0;
    };
    const plain = fall(null);
    const slime = fall(coatDef('slimecoat', 3));
    const ice = fall(coatDef('icecoat', 3));
    expect(slime).toBeLessThan(plain * 0.5);
    expect(ice).toBeGreaterThan(plain);
  });
});
