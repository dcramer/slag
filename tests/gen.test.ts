import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateCharacter, VARY_FIRST, VARY_ROLLS } from '../src/gen/character';
import { ARCHETYPE_WEIGHTS, generateCrate, generateProp, polyomino } from '../src/gen/props';
import { footprint } from '../src/sim/props';

const connected = (cells: readonly (readonly [number, number])[]) => {
  const key = (c: readonly [number, number]) => `${c[0]},${c[1]}`;
  const set = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const q = [cells[0]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const n of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (set.has(key(n)) && !seen.has(key(n))) {
        seen.add(key(n));
        q.push(n);
      }
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
      expect(
        kinds.some((k) =>
          ['spikestrip', 'spikeblock', 'saw', 'flail', 'launcher', 'sentry', 'flamer', 'laser', 'tesla', 'crusher', 'dropper', 'snapper', 'fuse'].includes(k),
        ),
      ).toBe(true);
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

  it('keep the name, colours, kind and swaps every seed had before faces stopped being rolled', () => {
    // Taken from the generator as it was (2026-11-02): saved looks are seeds, so a changed draw would
    // rename and recolour everyone's saved character. The kinds and their paints are the cast of
    // 2026-11-04 (`LOOK_CAST` 11), which re-rolled every seed's kind once more.
    const r = (v: number) => Math.round(v * 1e6) / 1e6;
    const hsl = (c: { h: number; s: number; l: number }) => [r(c.h), r(c.s), r(c.l)];
    const was = [
      [
        1,
        'Drupam',
        225.746619,
        [225.746619, 55.062922, 58.136864],
        [405.746619, 60, 62],
        'dino',
        [110, 55, 46],
        [0.968378, 0.281104, 0.612839, 0.720743, 0.425797, 0.994823],
      ],
      [
        7,
        'Stoolgrook',
        4.213711,
        [4.213711, 56.42504, 59.823569],
        [184.213711, 60, 62],
        'stinger',
        [355, 65, 45],
        [0.521445, 0.405522, 0.466233, 0.239925, 0.553326, 0.729822],
      ],
      [
        42,
        'Grazpla',
        216.397351,
        [216.397351, 65.310683, 58.741505],
        [426.397351, 60, 62],
        'warrior',
        [8, 55, 45],
        [0.174814, 0.526593, 0.273228, 0.624745, 0.865475, 0.472317],
      ],
      [
        1234,
        'Zhoomu',
        26.386192,
        [26.386192, 71.178476, 59.658041],
        [86.386192, 60, 62],
        'raider',
        [185, 45, 45],
        [0.040964, 0.117763, 0.161785, 0.802757, 0.39893, 0.127491],
      ],
      [
        99991,
        'Seemoosnoo',
        72.697179,
        [72.697179, 66.186532, 56.170261],
        [192.697179, 60, 62],
        'horse',
        [25, 50, 40],
        [0.125612, 0.597632, 0.431327, 0.034586, 0.183248, 0.354172],
      ],
      [
        2654435761,
        'Beegeeb',
        196.724187,
        [196.724187, 65.569795, 59.641277],
        [406.724187, 60, 62],
        'jelly',
        [110, 56, 66],
        [0.889288, 0.702442, 0.425494, 0.470508, 0.69716, 0.475418],
      ],
      [
        3141592653,
        'Tunksnaimp',
        95.334505,
        [95.334505, 71.057736, 52.403322],
        [305.334505, 60, 62],
        'king',
        [100, 45, 40],
        [0.437685, 0.131625, 0.505768, 0.169069, 0.824561, 0.675632],
      ],
      [
        4000000000,
        'Stusazsiz',
        249.086456,
        [249.086456, 67.677473, 59.871025],
        [399.086456, 60, 62],
        'horse',
        [25, 50, 40],
        [0.189118, 0.610073, 0.077649, 0.572415, 0.786852, 0.850792],
      ],
    ] as const;
    for (const [seed, ...rest] of was) {
      const c = generateCharacter(seed);
      // The first six rolls are the ones every seed had; the rendered kinds' variety rolls come after them.
      expect([c.name, r(c.hue), hsl(c.body), hsl(c.accent), c.kind, hsl(c.paint), c.vary.slice(0, VARY_FIRST).map(r)], `seed ${seed}`).toEqual(rest);
      expect(c.vary.length).toBe(VARY_ROLLS);
      expect(c.vary.every((v) => v >= 0 && v < 1)).toBe(true);
    }
  });
});
