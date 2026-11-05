import { describe, expect, it } from 'vitest';
import { DECOR_KINDS, DECOR_MAX_CLEAR, DECOR_MAX_SPAN, DECOR_RULES, decorFaults, decorFor, type DecorKind, ownDecor, placeDecor } from '../../src/gen/decor';
import { generateLevel } from '../../src/gen/level';
import { generateTheme } from '../../src/gen/theme';
import { DECOR } from '../../src/render/decor';
import type { Level, SizeClass } from '../../src/sim/level';
import { analyzeReach } from '../../src/sim/reach';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { once, rule } from './lib';

/**
 * The decor contract (src/gen/decor) for every registered kind and every theme: each kind is small, has
 * art, and dresses at least one theme; placed in real levels it grows on solid ground or hangs from a solid
 * ceiling as declared, with its room open, off the spawn and the flag and off a landmark that wears its own
 * skin; it's purely cosmetic (the level's reach is the same with it placed); it varies with the seed; and
 * every theme shows only decor registered for it, with some of its very own.
 */

const SEEDS = [2, 1];
const SIZES: SizeClass[] = ['classic', 'wide'];

const levelsOf = (theme: ThemeId): Level[] => SEEDS.map((seed, i) => generateLevel(seed, theme, { size: SIZES[i] }));
const levels = once(() => new Map(THEME_IDS.map((t) => [t, levelsOf(t)])));

describe('decor kinds', () => {
  for (const kind of DECOR_KINDS)
    rule(`decor/*/${kind}/contract`, `${kind}: small, drawn, and dresses a theme`, () => {
      const r = DECOR_RULES[kind];
      const out: string[] = [];
      if (!r.themes.length) out.push('dresses no theme');
      if (!(r.weight > 0)) out.push('weight must be above 0');
      if (r.clear < 1 || r.clear > DECOR_MAX_CLEAR) out.push(`needs ${r.clear} tiles of room (1..${DECOR_MAX_CLEAR})`);
      if (r.span && (r.span[0] < 1 || r.span[1] > DECOR_MAX_SPAN || r.span[0] > r.span[1])) out.push(`spans ${r.span.join('..')} (1..${DECOR_MAX_SPAN})`);
      const art = DECOR[kind];
      if (!art?.bake && !art?.live) out.push('no art (src/render/decor.ts: bake or live)');
      return out;
    });
});

function themeSuite(theme: ThemeId) {
  const key = (r: string) => `decor/${theme}/*/${r}`;
  const mine = () => levels().get(theme)!;
  describe(theme, () => {
    rule(key('placed'), 'grows on solid ground or hangs from a ceiling, small, off the spawn, flag and skinned landmarks', () =>
      mine().flatMap((l) => {
        const spots = placeDecor(l, l.theme);
        const out = decorFaults(l, spots).map((f) => `seed ${l.seed}: ${f}`);
        const lm = l.landmark?.skin ? l.landmark.rect : null;
        if (lm)
          for (const d of spots)
            if (d.tx >= lm.x && d.tx < lm.x + lm.w && d.ty >= lm.y - 1 && d.ty < lm.y + lm.h) out.push(`seed ${l.seed}: ${d.kind} on the landmark`);
        if (!spots.length) out.push(`seed ${l.seed}: no decor at all`);
        return out;
      }),
    );

    rule(key('cosmetic'), 'is purely cosmetic: the level reaches the same with it placed', () =>
      mine().flatMap((l) => {
        const tiles = l.tiles.slice();
        const before = [...analyzeReach(l, false).reachable].sort((a, b) => a - b);
        placeDecor(l, l.theme);
        const after = [...analyzeReach(l, false).reachable].sort((a, b) => a - b);
        const same = tiles.every((t, i) => t === l.tiles[i]) && before.length === after.length && before.every((k, i) => k === after[i]);
        return same ? [] : [`seed ${l.seed}: placing decor changed the level`];
      }),
    );

    rule(key('varies'), 'varies with the seed', () => {
      const out: string[] = [];
      const [a, b] = mine().map((l) => placeDecor(l, l.theme));
      if (JSON.stringify(a) === JSON.stringify(b)) out.push('two seeds placed the same decor');
      // The look's pick of kinds varies too, wherever the theme has more kinds than one look shows.
      const looks = [1, 2, 3, 4, 5, 6].map((s) => generateTheme(s, theme).decor.join(','));
      if (decorFor(theme).length > Math.max(...looks.map((d) => d.split(',').length)) && new Set(looks).size < 2) out.push('every seed shows the same kinds');
      return out;
    });

    rule(key('specific'), 'shows only decor registered for it, with some of its own', () => {
      const out: string[] = [];
      for (const s of [1, 2, 3, 4, 5, 6])
        for (const k of generateTheme(s, theme).decor as DecorKind[])
          if (!DECOR_RULES[k].themes.includes(theme)) out.push(`seed ${s} shows ${k}, which isn't ${theme}'s`);
      if (!ownDecor(theme).length) out.push('no decor of its own: every kind is shared');
      return [...new Set(out)];
    });
  });
}

describe('decor by theme', () => {
  for (const theme of THEME_IDS) themeSuite(theme);
  it('decor is chosen in gen and drawn in render', () => {
    expect(Object.keys(DECOR).sort()).toEqual([...DECOR_KINDS].sort());
  });
});
