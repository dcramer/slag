import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/ui/home-scene';
import { logoSVG } from '../src/ui/screens/logo-art';

/** The main menu's stage at a desktop column, a phone's short strip, and a squat window. */
const SIZES = [
  [628, 618],
  [375, 180],
  [900, 400],
] as const;

describe('menu foundry layout', () => {
  for (const [W, H] of SIZES)
    it(`${W}×${H}: runners stand on the heap, clear of the pool, and the crane stays on the canvas`, () => {
      for (const seed of [1, 2, 3]) {
        const S = buildScene(W, H, seed);
        for (let i = 0; i < S.runX.length; i++) {
          const x = S.runX[i];
          if (i) expect(x).toBeGreaterThan(S.runX[i - 1]);
          expect(x).toBeGreaterThan(0);
          const y = S.foot(x);
          expect(Number.isFinite(y)).toBe(true);
          expect(y).toBeLessThan(H * 0.95);
          expect(y).toBeGreaterThan(H * 0.25);
        }
        expect(S.runX[S.runX.length - 1]).toBeLessThan(S.pool.x - S.pool.rx);
        // The crucible's right side and its wheel stay inside; the pour falls before it lands.
        expect(S.pin.x + 14.5 * S.g).toBeLessThan(W);
        expect(S.lip.x).toBeGreaterThan(0);
        expect(S.impact.y).toBeGreaterThan(S.lip.y + 10 * S.g);
        expect(S.jibY).toBeGreaterThanOrEqual(0);
        expect(S.impact.y).toBeLessThan(H);
      }
    });

  it('rebuilds the same heap for the same visit', () => {
    const a = buildScene(628, 618, 7);
    const b = buildScene(628, 618, 7);
    expect(b.chunks).toEqual(a.chunks);
    expect(b.surface).toEqual(a.surface);
  });
});

describe('logo', () => {
  it('is the same markup every time, server and client alike', () => {
    expect(logoSVG()).toBe(logoSVG());
    expect(logoSVG()).toMatch(/^<svg class="logo-art" viewBox="0 0 342\.3 135"/);
  });
});
