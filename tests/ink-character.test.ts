import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../src/gen/character';
import { drawInkRunner, type RunnerPose } from '../src/render/ink-character';

/** A 2D context that only records where paths go, in the character's own space (transforms are ignored). */
function recorder() {
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => void pts.push([x, y]);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => {
      if (k === 'moveTo' || k === 'lineTo') return add;
      if (k in t) return t[k as string];
      return () => {};
    },
    set: (t, k, v) => {
      t[k as string] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, pts };
}

const POSES: Record<string, RunnerPose> = {
  idle: { facing: 1, vx: 0, vy: 0, grounded: true, t: 1 },
  run: { facing: -1, vx: -215, vy: 0, grounded: true, t: 1.3 },
  rise: { facing: 1, vx: 100, vy: -300, grounded: false, t: 2 },
  fall: { facing: 1, vx: 0, vy: 400, grounded: false, t: 2.2 },
  wall: { facing: -1, vx: 0, vy: 60, grounded: false, t: 3, wall: 1 },
  cheer: { facing: 1, vx: 0, vy: 0, grounded: true, t: 4, celebrate: true },
};

describe('inked runner', () => {
  // Every runner shares one 10x14 hitbox: the drawing may be bigger, but not so big that one character
  // hides another or reads as a different size of player.
  it('draws every seed and pose within a fixed box around the hitbox', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const c = generateCharacter(seed);
      for (const [name, pose] of Object.entries(POSES)) {
        const { ctx, pts } = recorder();
        drawInkRunner({ s: ctx, g: null }, c, 0, 0, pose);
        expect(pts.length, name).toBeGreaterThan(40);
        for (const [x, y] of pts) {
          expect(Math.abs(x), `${seed} ${name}`).toBeLessThanOrEqual(17);
          expect(y, `${seed} ${name}`).toBeGreaterThanOrEqual(-36);
          // Feet stand on the floor: ink below it would sink a standing runner into the ground.
          if (pose.grounded) expect(y, `${seed} ${name}`).toBeLessThanOrEqual(1.1);
        }
      }
    }
  });

  it('draws the same runner the same way every time', () => {
    const c = generateCharacter(77);
    const a = recorder();
    const b = recorder();
    drawInkRunner({ s: a.ctx, g: null }, c, 0, 0, POSES.run);
    drawInkRunner({ s: b.ctx, g: null }, generateCharacter(77), 0, 0, POSES.run);
    expect(a.pts).toEqual(b.pts);
  });
});
