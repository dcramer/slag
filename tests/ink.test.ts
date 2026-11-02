import { describe, expect, it } from 'vitest';
import { artMode, type EdgeP, looseLoop, traceCorners } from '../src/render/ink';

/** Build a grid from rows of `#` (solid) and `.` (air). Out of bounds is solid, as at the world's edge. */
function grid(rows: string[]) {
  const h = rows.length;
  const w = rows[0].length;
  const solid = (x: number, y: number) => rows[Math.max(0, Math.min(h - 1, y))][Math.max(0, Math.min(w - 1, x))] === '#';
  return { w, h, solid };
}

const loops = (g: ReturnType<typeof grid>): EdgeP[][] =>
  traceCorners(g.solid, g.w, g.h).map((c) => looseLoop(c, { tile: 16, ox: 0, oy: 0, w: g.w, h: g.h, seed: 7, loose: 1 }));

describe('ink contours', () => {
  it('closes a loop around every solid region, including one touching the world edge', () => {
    const g = grid(['........', '..##....', '..##....', '........', '########']);
    // The floating block, and the floor that runs off both sides of the world.
    expect(traceCorners(g.solid, g.w, g.h)).toHaveLength(2);
  });

  it('traces a hole as its own loop', () => {
    const g = grid(['.......', '.#####.', '.#...#.', '.#####.', '.......']);
    expect(traceCorners(g.solid, g.w, g.h)).toHaveLength(2);
  });

  it('keeps two tiles touching only at a corner as separate shapes', () => {
    const g = grid(['.....', '.#...', '..#..', '.....']);
    expect(traceCorners(g.solid, g.w, g.h)).toHaveLength(2);
  });

  it('keeps floors within a pixel of the tile line, because that is where feet land', () => {
    const g = grid(['........', '........', '.######.', '.######.', '........']);
    const floor = loops(g)
      .flat()
      .filter((p) => p.ny < -0.99);
    expect(floor.length).toBeGreaterThan(5);
    for (const p of floor) expect(Math.abs(p.y - 2 * 16)).toBeLessThan(1);
  });

  // A bomb re-traces the whole level. If a mark's place depended on walk order or on where its edge
  // started, the blast would redraw the entire map.
  it('leaves the outline away from a crater exactly where it was', () => {
    const before = grid([
      '..............................',
      '..............................',
      '##############################',
      '##############################',
    ]);
    const after = grid([
      '..............................',
      '..............................',
      '####################..########',
      '####################..########',
    ]);
    const key = (p: EdgeP) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const was = new Set(loops(before).flat().map(key));
    const far = loops(after)
      .flat()
      .filter((p) => p.x < 17 * 16);
    expect(far.length).toBeGreaterThan(20);
    for (const p of far) expect(was.has(key(p))).toBe(true);
  });
});

describe('artMode', () => {
  it('only accepts the spike treatments', () => {
    expect(artMode('?art=a')).toBe('a');
    expect(artMode('?art=c')).toBe('c');
    expect(artMode('?art=z')).toBeNull();
    expect(artMode('')).toBeNull();
  });
});
