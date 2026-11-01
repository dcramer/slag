import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../src/gen/character';
import { ARCHETYPE_WEIGHTS, generateCrate, generateProp, polyomino } from '../src/gen/props';
import { Rng } from '../src/core/rng';
import { footprint } from '../src/sim/props';

const connected = (cells: readonly (readonly [number, number])[]) => {
  const key = (c: readonly [number, number]) => `${c[0]},${c[1]}`;
  const set = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const q = [cells[0]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (set.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); q.push(n); }
    }
  }
  return seen.size === set.size;
};

describe('props', () => {
  it('polyominoes are connected, normalized, and the requested size', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) {
      const n = rng.int(1, 6);
      const cells = polyomino(rng, n, rng.next());
      expect(cells.length).toBe(n);
      expect(Math.min(...cells.map((c) => c[0]))).toBe(0);
      expect(Math.min(...cells.map((c) => c[1]))).toBe(0);
      expect(connected(cells)).toBe(true);
    }
  });

  it('crates are deterministic and always contain a builder and a hazard', () => {
    for (let r = 1; r < 30; r++) {
      const a = generateCrate(99, r, 5);
      expect(a).toEqual(generateCrate(99, r, 5));
      const kinds = a.map((d) => d.archetype);
      expect(kinds.some((k) => ['platform', 'crumble', 'spring'].includes(k))).toBe(true);
      expect(kinds.some((k) => ['spikeblock', 'saw', 'flail', 'launcher', 'flamer', 'laser', 'tesla', 'crusher'].includes(k))).toBe(true);
    }
  });

  it('every archetype generates varied, well-formed props', () => {
    for (const [k] of ARCHETYPE_WEIGHTS) {
      const names = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const d = generateProp(new Rng(i * 31 + k.length), k, 'x');
        names.add(d.name);
        expect(d.archetype).toBe(k);
        expect(d.modules.length).toBeGreaterThan(0);
        expect(d.footprint.length).toBeGreaterThan(0);
        expect(Math.min(...d.footprint.map((c) => c[0]))).toBe(0);
        expect(Math.min(...d.footprint.map((c) => c[1]))).toBe(0);
        for (let rot = 0; rot < 4; rot++) {
          const fp = footprint(d, rot);
          expect(fp.length).toBe(d.footprint.length);
          expect(Math.min(...fp.map((c) => c[0]))).toBe(0);
          expect(Math.min(...fp.map((c) => c[1]))).toBe(0);
        }
      }
      expect(names.size).toBeGreaterThan(8);
    }
  });
});

describe('characters', () => {
  it('are deterministic and varied', () => {
    expect(generateCharacter(3)).toEqual(generateCharacter(3));
    const names = new Set(Array.from({ length: 50 }, (_, i) => generateCharacter(i).name));
    expect(names.size).toBeGreaterThan(40);
  });
});
