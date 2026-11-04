import { describe, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DIFFICULTIES, generateLevel, lastGenInfo } from '../../src/gen/level';
import { noFreeRide } from '../../src/gen/level/winnable';
import { hazardSignature, type Recipe, SET_PIECE_RECIPES, SET_PIECES } from '../../src/gen/setpieces';
import { CONCEPTS, ownPieces } from '../../src/gen/stage';
import type { Level, SizeClass } from '../../src/sim/level';
import type { PlacedProp } from '../../src/sim/props';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { artFaults, hazardFaults, once, rule } from './lib';

/**
 * The set-piece contract (src/gen/setpieces/contract.ts) for every registered recipe of every theme: it
 * can be placed, it warns before it hurts, its art draws what the sim hurts with, it leaves a window or is
 * a wall the proof keeps clear of, it gives a bare run no free ride, and a recipe flagged `unique` is a
 * hazard no other theme has (by mechanism: what hurts and how, not its look), set pieces and landmarks
 * of every other theme included.
 *
 * Each recipe is placed on its own, on plain levels of its theme, until two of it stand.
 */

const TERRAIN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const REROLLS = 12;
const WANT = 2;

interface Placed {
  level: Level;
  pp: PlacedProp;
}

/** A plain level of the theme with its set pieces taken out, to place recipes on one at a time: every difficulty, which shapes the terrain, in turn. */
const terrain = (theme: ThemeId, i: number): Level => {
  const size: SizeClass = i % 3 === 2 ? 'wide' : 'classic';
  const difficulty = DIFFICULTIES[Math.floor(i / 2) % DIFFICULTIES.length];
  return { ...generateLevel(TERRAIN_SEEDS[i], theme, { concept: 'plain', size, difficulty }), setPieces: [] };
};

/** Up to WANT instances of each recipe of a theme, placed alone. */
const placedOf = (theme: ThemeId): Map<string, Placed[]> => {
  const out = new Map<string, Placed[]>(SET_PIECE_RECIPES[theme].map((r) => [r.name, []]));
  const terrains: Level[] = [];
  for (let i = 0; i < TERRAIN_SEEDS.length; i++) {
    const missing = SET_PIECE_RECIPES[theme].filter((r) => out.get(r.name)!.length < WANT);
    if (!missing.length) break;
    terrains.push(terrain(theme, i));
    const level = terrains[i];
    for (const r of missing)
      for (let k = 0; k < REROLLS && out.get(r.name)!.length < WANT; k++) {
        const got = SET_PIECES[theme](new Rng(k * 7919 + i), level, { count: 1, family: [r.name] });
        if (got.length) {
          out.get(r.name)!.push({ level, pp: got[0] });
          break;
        }
      }
  }
  return out;
};

const placed = once(() => new Map(THEME_IDS.map((t) => [t, placedOf(t)])));

/** What hurts in every theme other than `theme`: its recipes' hazards and its landmarks' pieces. */
const elsewhere = once(() => {
  const out = new Map<ThemeId, Map<string, string>>();
  for (const theme of THEME_IDS) {
    const seen = new Map<string, string>();
    for (const [name, list] of placed().get(theme)!)
      for (const { pp } of list) for (const s of hazardSignature(pp.def.modules)) seen.set(s, `${theme}/${name}`);
    for (const c of CONCEPTS[theme]) {
      const l = generateLevel(1, theme, { concept: c.id });
      if (lastGenInfo.concept === c.id)
        for (const pp of ownPieces(l)) for (const s of hazardSignature(pp.def.modules)) seen.set(s, `${theme}/${c.id} (landmark)`);
    }
    out.set(theme, seen);
  }
  return out;
});

function recipeSuite(theme: ThemeId, r: Recipe) {
  const key = (rule: string) => `hazard/${theme}/${r.name}/${rule}`;
  const mine = () => placed().get(theme)!.get(r.name)!;
  const each = (check: (p: Placed) => string[]) => () => mine().flatMap(check);
  describe(`${theme}/${r.name}`, () => {
    rule(key('placeable'), 'can be placed', () => (mine().length ? [] : [`never placed on ${TERRAIN_SEEDS.length} plain ${theme} levels`]));
    rule(
      key('art'),
      'has art for every module',
      each(({ pp }) => artFaults(pp)),
    );
    rule(
      key('hazards'),
      'warns before it hurts, draws what hurts, and leaves a window',
      each(({ level, pp }) => hazardFaults(level, pp)),
    );
    rule(
      key('free-ride'),
      'gives a bare run no free ride',
      each(({ level, pp }) => (noFreeRide(level, pp, []) ? [] : [`${pp.def.name} carries a bare run to the flag`])),
    );
    if (r.unique)
      rule(key('unique'), 'is unique to its theme', () => {
        const sig = new Set(mine().flatMap(({ pp }) => hazardSignature(pp.def.modules)));
        if (!sig.size) return ['flagged unique, but nothing in it hurts'];
        const out: string[] = [];
        for (const [other, seen] of elsewhere()) if (other !== theme) for (const s of sig) if (seen.has(s)) out.push(`${s} also hurts in ${seen.get(s)}`);
        return out;
      });
  });
}

describe('set pieces', () => {
  for (const theme of THEME_IDS) {
    if (!SET_PIECE_RECIPES[theme].length) it.todo(`${theme}: no set pieces registered yet`);
    for (const r of SET_PIECE_RECIPES[theme]) recipeSuite(theme, r);
  }
});
