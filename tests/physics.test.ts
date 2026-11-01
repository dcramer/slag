import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/sim/constants';
import { bodyAtCell, stepBody, type CollisionWorld } from '../src/sim/physics';

// Flat floor at row 10 and below.
const world: CollisionWorld = { tileAt: (x, y) => (x < 0 || x >= 40 ? 1 : y >= 10 ? 1 : 0), solids: [] };
const idle = { left: false, right: false, jump: false, jumpPressed: false };

describe('player controller', () => {
  it('rests on the ground', () => {
    const b = bodyAtCell(5, 9);
    const y0 = b.y;
    for (let i = 0; i < 60; i++) stepBody(b, idle, world);
    expect(b.y).toBeCloseTo(y0, 5);
    expect(b.onGround).toBe(true);
  });

  it('full jump reaches roughly the designed height and lands', () => {
    const b = bodyAtCell(5, 9);
    const y0 = b.y;
    let minY = y0;
    for (let i = 0; i < 90; i++) {
      stepBody(b, { ...idle, jump: true, jumpPressed: i === 0 }, world);
      minY = Math.min(minY, b.y);
    }
    const h = y0 - minY;
    const ideal = PHYS.jumpVel ** 2 / (2 * PHYS.gravity);
    expect(h).toBeGreaterThan(ideal * 0.9);
    expect(h).toBeLessThan(ideal * 1.1);
    expect(h / TILE).toBeGreaterThan(3.5);
    expect(b.onGround).toBe(true);
  });

  it('short hop is lower than a full jump', () => {
    const b = bodyAtCell(5, 9);
    const y0 = b.y;
    let minY = y0;
    for (let i = 0; i < 60; i++) {
      stepBody(b, { ...idle, jump: i < 4, jumpPressed: i === 0 }, world);
      minY = Math.min(minY, b.y);
    }
    expect(y0 - minY).toBeLessThan(PHYS.jumpVel ** 2 / (2 * PHYS.gravity) * 0.6);
  });

  it('cannot walk through walls', () => {
    const b = bodyAtCell(37, 9);
    for (let i = 0; i < 120; i++) stepBody(b, { ...idle, right: true }, world);
    expect(b.x + b.w).toBeLessThanOrEqual(40 * TILE + 1e-6);
  });
});
