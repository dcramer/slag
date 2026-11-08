import { MODES } from '../../src/game/modes';
import { generateLevel, lastGenInfo, type ProfileOverride } from '../../src/gen/level';
import { BUILDERS, type BuilderId } from '../../src/gen/level/builders';
import { builderFaults, fillerOf, fillOf } from '../../src/gen/level/builders/contract';
import { type Measures, measureLevel } from '../../src/gen/level/measure';
import type { BuilderContract } from '../../src/gen/level/sets/types';
import { throughFaults } from '../../src/gen/setpieces';
import { type Level, spawnZones } from '../../src/sim/level';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { spawnIntrusions } from './set-piece-checks';

/**
 * Every builder's contract (`BuilderDef.contract`, src/gen/level/sets/types.ts) over every set's levels: the one
 * helper behind tests/conformance/builders.test.ts (a seed per set, the per-level promises) and
 * tests/stats/builder-contracts.test.ts (a dozen seeds per set, every promise). A builder gets these checks by
 * declaring them.
 */

/** The profiles a builder takes, forced from the seed: a course, a climb, a descent, a race tower, a Rising Slag shaft, a brawl's arena. */
export const BUILDER_PROFILES: Record<BuilderId, ProfileOverride[]> = {
  course: [
    { size: 'classic', route: 'ltr' },
    { size: 'wide', route: 'ltr' },
  ],
  climb: [{ size: 'classic', route: 'climb' }],
  descent: [{ size: 'wide', route: 'descent' }],
  tower: [{ size: 'tall', route: 'zigzag' }],
  shaft: [MODES.slag.profile],
  arena: [MODES.brawl.profile],
};

/** Builders that declare a contract. */
export const CONTRACTED = (Object.keys(BUILDERS) as BuilderId[]).filter((id) => BUILDERS[id].contract);

export interface Built {
  theme: ThemeId;
  seed: number;
  level: Level;
  asked: number;
  fallback: boolean;
  m: Measures;
}

/** One builder's levels in one set, from its first profile. */
export function buildIn(id: BuilderId, theme: ThemeId, seeds: readonly number[]): Built[] {
  return seeds.map((seed) => {
    const level = generateLevel(seed, theme, BUILDER_PROFILES[id][0]);
    const asked = lastGenInfo.placement?.asked ?? 0;
    return { theme, seed, level, asked, fallback: lastGenInfo.fallback, m: measureLevel(level) };
  });
}

/** Where one level breaks its builder's per-level promises, or the rules every builder's levels keep (no fallback, no set piece through terrain). */
export function eachFaults(c: BuilderContract, b: Built): string[] {
  const at = `${b.theme} seed ${b.seed}`;
  const out = b.fallback ? ['fell back to the legacy sculptor or the flat floor'] : [];
  out.push(...b.level.setPieces.flatMap((p) => throughFaults(b.level, p)));
  if (c.each) out.push(...builderFaults(c.each, b.level, b.asked, undefined, b.m));
  if (c.each?.clearSpawns)
    out.push(
      ...spawnIntrusions(
        b.level,
        spawnZones(b.level).map((z) => z.zone),
      ).map((f) => `clearSpawns: ${f}`),
    );
  return out.map((f) => `${at}: ${f}`);
}

const mean = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Floats compared against a declared share: 5 of 6 is 5/6 either way. */
const EPS = 1e-9;

/** Where a set's levels, or all of them, break the builder's promises over many levels (`set`, `all`). */
export function sweepFaults(c: BuilderContract, bySet: readonly Built[][]): string[] {
  const out: string[] = [];
  const { set, all } = c;
  if (set) {
    const stands = bySet.map((xs) => mean(xs, (b) => b.m.stands));
    bySet.forEach((xs, i) => {
      const theme = xs[0].theme;
      const fill = mean(xs, (b) => fillOf(b.level, b.asked));
      if (set.fill !== undefined && fill < set.fill - EPS) out.push(`${theme}: set.fill ${pct(fill)} of the ask stands, under ${pct(set.fill)}`);
      const kinds = new Set(xs.flatMap((b) => fillerOf(b.level).map((f) => f.recipe))).size;
      if (set.kinds !== undefined && kinds < set.kinds) out.push(`${theme}: set.kinds ${kinds} recipes, under ${set.kinds}`);
      const falls = mean(xs, (b) => b.m.falls);
      if (set.falls !== undefined && !(falls > set.falls))
        out.push(`${theme}: set.falls ${pct(falls)} of stand cells by a fall that kills, not over ${pct(set.falls)}`);
      if (set.stands !== undefined && stands[i] <= set.stands * Math.max(...stands))
        out.push(
          `${theme}: set.stands ${Math.round(stands[i])} stand cells, not over ${pct(set.stands)} of the busiest set's ${Math.round(Math.max(...stands))}`,
        );
    });
  }
  if (all) {
    const xs = bySet.flat();
    const over = (name: string, v: number, floor: number | undefined) =>
      floor !== undefined && !(v > floor) && out.push(`all.${name} ${pct(v)}, not over ${pct(floor)}`);
    if (all.safe !== undefined && !(mean(xs, (b) => b.m.safe) < all.safe)) out.push(`all.safe ${pct(mean(xs, (b) => b.m.safe))}, not under ${pct(all.safe)}`);
    over(
      'falls',
      mean(xs, (b) => b.m.falls),
      all.falls,
    );
    over(
      'high',
      mean(xs, (b) => +b.m.high),
      all.high,
    );
    over(
      'mirrored',
      mean(xs, (b) => b.m.mirrored),
      all.mirrored,
    );
    over(
      'centre',
      mean(xs, (b) => b.m.centre),
      all.centre,
    );
    if (all.shapes) {
      const shapes: Record<string, number> = {};
      for (const b of xs) shapes[shapeOf(b.level)] = (shapes[shapeOf(b.level)] ?? 0) + 1;
      const got = Object.keys(shapes).sort();
      const want = [...all.shapes.names].sort();
      if (got.join() !== want.join()) out.push(`all.shapes: ${got.join(', ')}, not ${want.join(', ')}`);
      for (const [k, n] of Object.entries(shapes))
        if (!(n / xs.length > all.shapes.share)) out.push(`all.shapes: ${k} in ${pct(n / xs.length)}, not over ${pct(all.shapes.share)}`);
    }
  }
  return out;
}

/** A level's shape: its style's last segment (`farm:arena-bowl` → `arena-bowl`). */
const shapeOf = (level: Level) => level.style.split(':').at(-1)!;

/** One line of what a builder's levels measured, for the sweep's log. */
export function summary(id: BuilderId, bySet: readonly Built[][]): string {
  const xs = bySet.flat();
  const sets = bySet.map((s) => `${s[0].theme} ${mean(s, (b) => fillerOf(b.level).length).toFixed(2)}/${mean(s, (b) => b.asked).toFixed(0)}`).join(', ');
  return `${id}, ${xs.length} levels: ${pct(mean(xs, (b) => b.m.safe))} of stand cells safe, ${pct(mean(xs, (b) => b.m.hazard))} by a hazard (${pct(mean(xs, (b) => b.m.centre))} by the centrepiece), ${pct(mean(xs, (b) => b.m.falls))} by a fall that kills (${bySet.map((s) => `${s[0].theme} ${pct(mean(s, (b) => b.m.falls))}`).join(', ')}), ${pct(mean(xs, (b) => +b.m.high))} reach the top third, ${pct(mean(xs, (b) => b.m.mirrored))} mirrored, side walls ${Math.max(...xs.map((b) => b.m.wall))} rows at most; set pieces stood by set: ${sets}`;
}

/** Every set's levels from `id` at `seeds`, one array per set. */
export const everySet = (id: BuilderId, seeds: (theme: ThemeId, i: number) => number[]) => THEME_IDS.map((t, i) => buildIn(id, t, seeds(t, i)));
