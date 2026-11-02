import { describe, expect, it } from 'vitest';
import type { HSL } from '../src/core/color';
import { generateTheme, type Theme } from '../src/gen/theme';
import { THEME_IDS } from '../src/themes';

const validHsl = (c: HSL) => Number.isFinite(c.h) && c.s >= 0 && c.s <= 100 && c.l >= 0 && c.l <= 100;

function allColors(th: Theme): HSL[] {
  const t = th.terrain;
  return [
    th.skyTop,
    th.skyMid,
    th.skyBottom,
    th.fog,
    th.horizon.color,
    th.celestial.color,
    th.celestial.glow,
    th.cloudColor,
    t.base,
    t.dark,
    t.light,
    t.capColor,
    t.vein,
    t.outline,
    t.platform.color,
    ...(t.sub ? [t.sub.base, t.sub.dark, t.sub.light] : []),
    th.liquid.color,
    th.liquid.glow,
    th.ambientTint,
    th.lamp,
    th.accent,
    ...th.layers.flatMap((L) => [L.color, L.detail, L.glow]),
  ];
}

describe('theme look generation', () => {
  it('is deterministic for a (seed, theme) pair', () => {
    for (const id of THEME_IDS) {
      for (const seed of [1, 42, 0xdeadbeef]) expect(generateTheme(seed, id)).toEqual(generateTheme(seed, id));
    }
  });

  it('every theme produces a valid look with its id set', () => {
    for (const id of THEME_IDS) {
      for (let i = 0; i < 40; i++) {
        const th = generateTheme((i * 2654435761) >>> 0, id);
        expect(th.id).toBe(id);
        expect(th.name.length).toBeGreaterThan(0);
        expect(th.layers.length).toBeGreaterThanOrEqual(2);
        for (const L of th.layers) {
          expect(L.depth).toBeGreaterThanOrEqual(0);
          expect(L.depth).toBeLessThan(1);
          expect(L.haze).toBeGreaterThanOrEqual(0);
          expect(L.haze).toBeLessThanOrEqual(1);
          expect(L.base).toBeGreaterThan(0);
          expect(L.base).toBeLessThan(1);
        }
        // Parallax layers go from far to near.
        for (let k = 1; k < th.layers.length; k++) expect(th.layers[k].depth).toBeGreaterThan(th.layers[k - 1].depth);
        for (const c of allColors(th)) expect(validHsl(c)).toBe(true);
        expect(th.decor.length).toBeGreaterThan(0);
        expect(new Set(th.decor).size).toBe(th.decor.length);
        expect(th.decorDensity).toBeGreaterThan(0);
        expect(th.decorDensity).toBeLessThan(0.5);
        expect(th.ambientLight).toBeGreaterThan(0.2);
        expect(th.ambientLight).toBeLessThanOrEqual(1);
        expect(th.grade.exposure).toBeGreaterThan(0.5);
        expect(th.grade.tint.every((v) => v > 0.5 && v < 1.5)).toBe(true);
        expect(th.celestial.x).toBeGreaterThanOrEqual(0);
        expect(th.celestial.x).toBeLessThanOrEqual(1);
        expect(th.stars).toBeGreaterThanOrEqual(0);
        expect(th.terrain.detail).toBeGreaterThanOrEqual(0);
        expect(th.terrain.detail).toBeLessThanOrEqual(1);
      }
    }
  });

  it('themes look different from each other', () => {
    const terrain = new Set(THEME_IDS.map((id) => generateTheme(7, id).terrain.kind));
    const skylines = new Set(
      THEME_IDS.map((id) =>
        generateTheme(7, id)
          .layers.map((L) => L.kind)
          .join(),
      ),
    );
    expect(terrain.size).toBeGreaterThanOrEqual(6);
    expect(skylines.size).toBe(THEME_IDS.length);
  });

  it('varies within a theme across seeds', () => {
    for (const id of THEME_IDS) {
      const looks = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify([generateTheme(i + 1, id).skyTop, generateTheme(i + 1, id).mood])));
      expect(looks.size).toBeGreaterThan(5);
    }
  });
});
