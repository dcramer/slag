import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { wipe } from '../src/render/kit';
import { levelKey } from '../src/sim/level';
import { THEME_IDS } from '../src/themes';

/**
 * Render state one level leaves behind for the next. Every per-level cache in src/render (the terrain and surroundings
 * bakes, the light occluder, weather's tops) is keyed by `levelKey`, and the backdrop reuses one pool of canvases from
 * theme to theme. `pnpm shot themeswap` checks the pictures in a real browser; this checks the two seams it rests on.
 */
describe('render state across levels', () => {
  it('a level of another theme at the same seed and profile is another level to every cache', () => {
    // One profile forced on all of them, so nothing but the theme tells them apart.
    const force = { size: 'classic', concept: 'plain', route: 'ltr', density: 0.5, hazards: 0, danger: 0, gravity: 1, weather: 'clear' } as const;
    const keys = THEME_IDS.map((t) => levelKey(generateLevel(7, t, force)));
    expect(new Set(keys).size).toBe(THEME_IDS.length);
  });

  it('a crater keeps the key: the bake patches it instead of starting over', () => {
    const level = generateLevel(7, 'farm');
    const key = levelKey(level);
    level.version++;
    expect(levelKey(level)).toBe(key);
  });

  it('wipe clears every pixel of a reused canvas, never in one whole-canvas clear', () => {
    // Chrome can skip a whole-canvas clear with nothing drawn after it, and the canvas keeps its last picture.
    for (const [w, h] of [
      [209, 86],
      [45, 451],
    ]) {
      const rects: number[][] = [];
      const g = { canvas: { width: w, height: h }, setTransform: () => {}, clearRect: (...r: number[]) => rects.push(r) };
      wipe(g as unknown as CanvasRenderingContext2D);
      for (const [, , rw, rh] of rects) expect(rw * rh).toBeLessThan(w * h);
      const covered = new Set<number>();
      for (const [x, y, rw, rh] of rects) for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) covered.add(yy * w + xx);
      expect(covered.size).toBe(w * h);
    }
  });
});
