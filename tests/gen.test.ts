import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../src/gen/character';
import { generateCrate, generateProp, polyomino, type PropKind } from '../src/gen/props';
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
      const kinds = a.map((d) => d.kind);
      expect(kinds.some((k) => ['block', 'mover', 'spring', 'crumble'].includes(k))).toBe(true);
      expect(kinds.some((k) => ['spikes', 'saw', 'turret'].includes(k))).toBe(true);
    }
  });

  it('every kind generates with a name and a rotatable footprint', () => {
    const kinds: PropKind[] = ['block', 'spikes', 'crumble', 'mover', 'saw', 'spring', 'turret', 'fan', 'bomb'];
    for (const k of kinds) {
      const d = generateProp(new Rng(1), k, 'x');
      expect(d.kind).toBe(k);
      expect(d.name.length).toBeGreaterThan(2);
      for (let rot = 0; rot < 4; rot++) expect(footprint(d, rot).length).toBeGreaterThan(0);
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
