import { describe, expect, it } from 'vitest';
import { parseSeed } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { skinClip } from '../src/render/ink-terrain';
import { TILE } from '../src/sim/constants';
import { T_SOLID, tileAt } from '../src/sim/level';

/**
 * A landmark skin is painted through a clip of its tiles (render/ink-terrain.ts `skinClip`). One overlapping
 * rect per tile made a harbor lighthouse's rock (`hz10`, solid down to the sea floor) a clip Chrome's GPU
 * rasterizer never finished, and the page stopped producing frames. The clip is a few rects a row, and still
 * covers every tile of the skin.
 */
describe('a landmark skin clip', () => {
  it('is a few rects a row over a landmark solid to the sea floor, and covers every one of its tiles', () => {
    for (const [seed, concept] of [
      ['hz10', 'lighthouse'],
      ['hz6', 'galleon'],
      ['hz1', 'tidal-pier'],
    ] as const) {
      const l = generateLevel(parseSeed(seed), 'harbor', { concept });
      const r = l.landmark!.rect;
      const solid = (x: number, y: number) => tileAt(l, x, y) === T_SOLID;
      const rects = skinClip(solid, r.x, r.x + r.w - 1, r.y, r.y + r.h - 1);
      let tiles = 0;
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          if (!solid(x, y)) continue;
          tiles++;
          const cx = (x + 0.5) * TILE;
          const cy = (y + 0.5) * TILE;
          expect(
            rects.some((q) => cx > q.x && cx < q.x + q.w && cy > q.y && cy < q.y + q.h),
            `${seed} tile ${x},${y}`,
          ).toBe(true);
        }
      expect(tiles, seed).toBeGreaterThan(150);
      expect(rects.length, seed).toBeLessThanOrEqual(r.h * 8);
      expect(rects.length * 4, seed).toBeLessThan(tiles);
    }
  });
});
