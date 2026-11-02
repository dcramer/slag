import { describe, expect, it } from 'vitest';
import type { Cell } from '../src/core/geom';
import { runsOf, type Tones } from '../src/render/ink-build';
import { beltsOf, CLEAT_LIT, type Cut, drawBelts } from '../src/render/ink-surface';
import { METALS } from '../src/render/kit';
import { TILE } from '../src/sim/constants';

/**
 * A conveyor's cleats are the only thing that says how fast and which way it carries you, so they must
 * move exactly as the sim's belt does: `speed / 60` px per sim frame, the way the top run carries a
 * runner, and never outside the cells that are solid.
 */

function cut(cells: Cell[], dir: number): Cut {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  const T: Tones = { shade: '#000', base: '#000', light: '#000', ink: '#000', hatch: '#000' };
  return {
    cells,
    has,
    runs: runsOf(cells, has),
    seed: 1,
    T,
    st: { metal: 'steel', trim: 'none', hue: 30, glowHue: 0, woodHue: 30 },
    pal: METALS.steel,
    loops: [],
    dir,
  };
}

/** The lit cleats drawn on one frame, each as its four corners. */
function litCleats(cells: Cell[], frame: number, speed: number): { x: number; y: number }[][] {
  const quads: { x: number; y: number }[][] = [];
  let path: { x: number; y: number }[][] = [];
  let style = '';
  const ctx = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'beginPath') return () => (path = []);
        if (key === 'moveTo') return (x: number, y: number) => path.push([{ x, y }]);
        if (key === 'lineTo') return (x: number, y: number) => path[path.length - 1]?.push({ x, y });
        if (key === 'fill') return () => style === CLEAT_LIT && quads.push(...path);
        return () => {};
      },
      set: (_, key, value) => {
        if (key === 'fillStyle') style = value;
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  const b = cut(cells, speed < 0 ? -1 : 1);
  drawBelts(ctx, beltsOf(b), [], 0, 0, frame, speed, b.pal, b.st.hue);
  return quads;
}

const row: Cell[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
];

describe('conveyor belt marks', () => {
  for (const speed of [80, -115]) {
    it(`move with the sim's belt at ${speed} px/s`, () => {
      const pitch = beltsOf(cut(row, Math.sign(speed)))[0].pitch;
      // Where the top run's cleats sit along the belt, as a phase of the pitch.
      const phase = (f: number) => {
        const top = litCleats(row, f, speed).filter((q) => q.every((p) => p.y < 3));
        expect(top.length).toBeGreaterThan(4);
        // The middle one is on the straight run, wherever the lap has carried the rest.
        const xs = top.map((q) => q.reduce((s, p) => s + p.x, 0) / q.length).sort((a, b) => a - b);
        const mid = xs[xs.length >> 1];
        return ((mid % pitch) + pitch) % pitch;
      };
      for (const f of [0, 7, 40]) {
        const moved = (((phase(f + 1) - phase(f)) % pitch) + pitch) % pitch;
        expect(moved).toBeCloseTo((((speed / 60) % pitch) + pitch) % pitch, 5);
      }
    });
  }

  it('stay inside the cells at every size', () => {
    for (const n of [1, 2, 5]) {
      const cells = row.slice(0, Math.min(n, 4)).concat(n === 5 ? [[4, 0]] : []) as Cell[];
      for (const f of [0, 13, 29])
        for (const q of litCleats(cells, f, 90))
          for (const p of q) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(n * TILE);
            expect(p.y).toBeGreaterThanOrEqual(0.3);
            expect(p.y).toBeLessThanOrEqual(TILE);
          }
    }
  });
});
