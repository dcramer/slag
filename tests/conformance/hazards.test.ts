import { describe, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DIFFICULTIES, generateLevel, lastGenInfo } from '../../src/gen/level';
import { noFreeRide } from '../../src/gen/level/winnable';
import { hazardSignature, type Recipe, SET_PIECE_RECIPES, SET_PIECES, throughFaults } from '../../src/gen/setpieces';
import { CONCEPTS, ownPieces } from '../../src/gen/stage';
import { type Level, type SizeClass, T_EMPTY, T_SOLID, tileAt } from '../../src/sim/level';
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
 * Each recipe is placed on its own, on plain levels of its theme, until two of it stand: on two levels, or
 * on one at two rolls. Levels are what this costs (a placement is a fraction of a millisecond, a level tens
 * of them), so levels are only made until every recipe has stood once.
 *
 * `unique` needs what hurts in every other theme, so those rules run last, once every theme's placements are
 * made, and no single test pays for all of them plus every landmark.
 */

const TERRAIN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const REROLLS = 12;
const WANT = 2;

interface Placed {
  level: Level;
  pp: PlacedProp;
}

/**
 * A plain level of the theme with no set pieces, to place recipes on one at a time: every difficulty, which
 * shapes the terrain, in turn. Its first draw, without the search for a draw whose precision fits the
 * difficulty, and none of its own set pieces placed and proven: neither changes the ground a recipe stands
 * on, and together they were most of what a level cost.
 */
const terrain = (theme: ThemeId, i: number): Level => {
  const size: SizeClass = i % 3 === 2 ? 'wide' : 'classic';
  const difficulty = DIFFICULTIES[Math.floor(i / 2) % DIFFICULTIES.length];
  return { ...generateLevel(TERRAIN_SEEDS[i], theme, { concept: 'plain', size, difficulty, draw: 0, hazards: 0 }), setPieces: [] };
};

/** The recipe placed alone on terrain `i`, at the first roll from `from` that stands: the piece and its roll. */
const placeOn = (theme: ThemeId, r: Recipe, level: Level, i: number, from = 0): { pp: PlacedProp; k: number } | null => {
  for (let k = from; k < REROLLS; k++) {
    const got = SET_PIECES[theme](new Rng(k * 7919 + i), level, { count: 1, family: [r.name] });
    if (got.length) return { pp: got[0], k };
  }
  return null;
};

/** Up to WANT instances of each recipe of a theme, placed alone. */
const placedOf = (theme: ThemeId): Map<string, Placed[]> => {
  const recipes = SET_PIECE_RECIPES[theme];
  const out = new Map<string, Placed[]>(recipes.map((r) => [r.name, []]));
  const first = new Map<string, { i: number; k: number }>();
  const terrains: Level[] = [];
  for (let i = 0; i < TERRAIN_SEEDS.length && recipes.some((r) => !out.get(r.name)!.length); i++) {
    const level = terrain(theme, i);
    terrains.push(level);
    for (const r of recipes) {
      if (out.get(r.name)!.length >= WANT) continue;
      const got = placeOn(theme, r, level, i);
      if (!got) continue;
      if (!first.has(r.name)) first.set(r.name, { i, k: got.k });
      out.get(r.name)!.push({ level, pp: got.pp });
    }
  }
  // Short of WANT: a later roll on the terrain it first stood on, if it stands somewhere else there.
  for (const r of recipes) {
    const list = out.get(r.name)!;
    const at = first.get(r.name);
    if (!at) continue;
    const seen = new Set(list.map(({ pp }) => JSON.stringify(pp)));
    for (let k = at.k + 1; list.length < WANT && k < REROLLS; k++) {
      const got = placeOn(theme, r, terrains[at.i], at.i, k);
      if (!got) break;
      k = got.k;
      const key = JSON.stringify(got.pp);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ level: terrains[at.i], pp: got.pp });
      }
    }
  }
  return out;
};

/** Per theme, so a theme's first test pays for its own levels alone, not every theme's at once. */
const placedBy = new Map(THEME_IDS.map((t) => [t, once(() => placedOf(t))]));
const placed = (theme: ThemeId) => placedBy.get(theme)!();

/**
 * A landmark of the theme raised for what hurts in it, one level per concept: its first draw, without the
 * search for a draw whose precision fits the difficulty. A later draw only lays the same concept out again,
 * so draw 0 is as much that landmark as the one the search keeps, and the search was over half the cost.
 */
const landmarkHurts = (theme: ThemeId, seen: Map<string, string>): void => {
  for (const c of CONCEPTS[theme]) {
    const l = generateLevel(1, theme, { concept: c.id, draw: 0 });
    if (lastGenInfo.concept === c.id)
      for (const pp of ownPieces(l)) for (const s of hazardSignature(pp.def.modules)) seen.set(s, `${theme}/${c.id} (landmark)`);
  }
};

/** What hurts in a theme, by mechanism: its recipes' hazards and its landmarks' pieces. Per theme, made once. */
const hurtsBy = new Map(
  THEME_IDS.map((theme) => [
    theme,
    once(() => {
      const seen = new Map<string, string>();
      for (const [name, list] of placed(theme)) for (const { pp } of list) for (const s of hazardSignature(pp.def.modules)) seen.set(s, `${theme}/${name}`);
      landmarkHurts(theme, seen);
      return seen;
    }),
  ]),
);

/** A recipe flagged `unique`: nothing it hurts with hurts in any other theme. */
function uniqueSuite(theme: ThemeId, r: Recipe) {
  describe(`${theme}/${r.name}`, () => {
    rule(`hazard/${theme}/${r.name}/unique`, 'is unique to its theme', () => {
      const sig = new Set(
        placed(theme)
          .get(r.name)!
          .flatMap(({ pp }) => hazardSignature(pp.def.modules)),
      );
      if (!sig.size) return ['flagged unique, but nothing in it hurts'];
      const out: string[] = [];
      for (const other of THEME_IDS) {
        if (other === theme) continue;
        const seen = hurtsBy.get(other)!();
        for (const s of sig) if (seen.has(s)) out.push(`${s} also hurts in ${seen.get(s)}`);
      }
      return out;
    });
  });
}

/** A rotor hung from the ceiling (`support: 'ceiling'`) whose hub has no rock within three rows over it, with no board between. */
function hungFaults(level: Level, pp: PlacedProp): string[] {
  const out: string[] = [];
  for (const m of pp.def.modules) {
    if (m.type !== 'rotor' || m.support !== 'ceiling') continue;
    const x = Math.floor(m.hub[0] + pp.tx);
    const y = Math.floor(m.hub[1] + pp.ty);
    const over = [1, 2, 3].map((k) => tileAt(level, x, y - k)).find((t) => t !== T_EMPTY);
    if (over !== T_SOLID) out.push(`${pp.def.name} hangs at (${x}, ${y}) with no rock within 3 rows over it`);
  }
  return out;
}

function recipeSuite(theme: ThemeId, r: Recipe) {
  const key = (rule: string) => `hazard/${theme}/${r.name}/${rule}`;
  const mine = () => placed(theme).get(r.name)!;
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
      key('through'),
      'reaches through no terrain: no board or ledge inside its footprint',
      each(({ level, pp }) => throughFaults(level, pp)),
    );
    rule(
      key('hung'),
      'hangs what hangs from a ceiling under rock a few rows over it, never off the top of the view',
      each(({ level, pp }) => hungFaults(level, pp)),
    );
    rule(
      key('free-ride'),
      'gives a bare run no free ride',
      each(({ level, pp }) => (noFreeRide(level, pp, []) ? [] : [`${pp.def.name} carries a bare run to the flag`])),
    );
  });
}

describe('set pieces', () => {
  for (const theme of THEME_IDS) {
    if (!SET_PIECE_RECIPES[theme].length) it.todo(`${theme}: no set pieces registered yet`);
    for (const r of SET_PIECE_RECIPES[theme]) recipeSuite(theme, r);
  }
  for (const theme of THEME_IDS) for (const r of SET_PIECE_RECIPES[theme]) if (r.unique) uniqueSuite(theme, r);
});
