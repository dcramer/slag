import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import { bodyAtCell, type CollisionWorld, type Solid, stepBody, DEFAULT_SURFACE } from '../src/sim/physics';
import { NO_INPUT } from '../src/sim/types';

describe('platform carry', () => {
  it('a rider stays on a platform moving diagonally up (rotor/loop paths)', () => {
    const plat: Solid = { x: 5 * TILE - 8, y: 10 * TILE, w: 3 * TILE, h: 8, id: 1, dx: 0, dy: 0, surface: DEFAULT_SURFACE, propUid: 1, mi: 0 };
    const world: CollisionWorld = { tileAt: (x) => (x < 0 || x >= 40 ? 1 : 0), solids: [plat] };
    const b = bodyAtCell(5, 9);
    // Settle onto the platform.
    for (let i = 0; i < 5; i++) stepBody(b, NO_INPUT, world);
    expect(b.groundRef).toBe(1);
    // Move up-right along a circle for a while.
    for (let f = 0; f < 120; f++) {
      const a = f * 0.05;
      const nx = 5 * TILE - 8 + Math.cos(a) * 20 - 20;
      const ny = 10 * TILE - Math.sin(a) * 20;
      plat.dx = nx - plat.x;
      plat.dy = ny - plat.y;
      plat.x = nx;
      plat.y = ny;
      expect(stepBody(b, NO_INPUT, world)).toBe(true);
      expect(b.groundRef, `frame ${f}`).toBe(1);
      expect(Math.abs(b.y + b.h - plat.y)).toBeLessThan(0.6);
    }
  });
});
