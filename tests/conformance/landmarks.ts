import { describe, it } from 'vitest';
import { generateLevel, lastGenInfo, planHolds, withBridges } from '../../src/gen/level';
import { GRAVITY, type ProfileOverride, rollProfile } from '../../src/gen/level/profile';
import { analyzeRoutes, MAX_SHARED } from '../../src/gen/level/routes';
import { noFreeRide } from '../../src/gen/level/winnable';
import { SET_PIECE_RECIPES } from '../../src/gen/setpieces';
import { generateTheme } from '../../src/gen/theme';
import {
  type Concept,
  CONCEPTS,
  conceptName,
  contractOf,
  fits,
  footingFaults,
  LANDMARK_RULES,
  layoutDiff,
  layoutOf,
  measureScale,
  ownPieces,
  protectedFaults,
} from '../../src/gen/stage';
import { isProtected, type Level, type SizeClass } from '../../src/sim/level';
import { footprintCells } from '../../src/sim/props';
import { analyzeReach } from '../../src/sim/reach';
import { FLOATS, type ThemeId } from '../../src/themes';
import { artFaults, hazardFaults, once, rule } from './lib';

/**
 * The landmark contract (src/gen/stage/contract.ts) for every registered stage concept. Each concept is
 * generated at three seeds on the size its layout is compared at (classic where it has one), at its other
 * sizes, and under low and high gravity, wherever it says it fits. Split over two files by theme so the
 * suite runs in parallel; `landmarkSuite` is the whole of it.
 */

const SEEDS = [1, 2, 3];
const RANK = { small: 0, large: 1, grand: 2 } as const;

interface Case {
  seed: number;
  size: SizeClass;
  gravity: keyof typeof GRAVITY;
  level: Level | null;
}

/** The levels a concept is checked on: null where it fit and still didn't stand up. */
function casesOf(theme: ThemeId, c: Concept): Case[] {
  const vsize: SizeClass = c.sizes.includes('classic') ? 'classic' : c.sizes[0];
  const combos: Omit<Case, 'level'>[] = [
    ...SEEDS.map((seed) => ({ seed, size: vsize, gravity: 'normal' as const })),
    ...c.sizes.filter((s) => s !== vsize).map((size) => ({ seed: SEEDS[0], size, gravity: 'normal' as const })),
    { seed: SEEDS[0], size: vsize, gravity: 'low' },
    { seed: SEEDS[0], size: vsize, gravity: 'high' },
  ];
  const out: Case[] = [];
  for (const k of combos) {
    const o: ProfileOverride = { size: k.size, gravity: GRAVITY[k.gravity] };
    let p = rollProfile(k.seed, theme, o);
    if (c.routes && !c.routes.includes(p.route)) p = rollProfile(k.seed, theme, { ...o, route: c.routes[0] });
    if (!fits(c, p)) continue;
    const level = generateLevel(k.seed, theme, { ...o, route: p.route, concept: c.id });
    out.push({ ...k, level: lastGenInfo.concept === c.id ? level : null });
  }
  return out;
}

const at = (c: Case) => `seed ${c.seed} ${c.size} ${c.gravity}`;

/** Every rule of the landmark contract for one concept. */
function conceptSuite(theme: ThemeId, c: Concept) {
  const key = (r: string) => `landmark/${theme}/${c.id}/${r}`;
  const k = contractOf(c);
  const cases = once(() => casesOf(theme, c));
  const raised = () => cases().filter((x): x is Case & { level: Level } => !!x.level);
  const each = (check: (l: Level, c: Case) => string[]) => () => raised().flatMap((x) => check(x.level, x).map((f) => `${at(x)}: ${f}`));

  describe(`${theme}/${c.id}`, () => {
    rule(key('contract'), 'declares its contract', () => {
      const out: string[] = [];
      if (CONCEPTS[theme].filter((o) => o.id === c.id).length > 1) out.push('its id is taken twice in its theme');
      if (!(c.weight > 0)) out.push('weight must be above 0');
      if (!c.sizes.length) out.push('no sizes');
      if (k.ways < LANDMARK_RULES.ways) out.push(`declares ${k.ways} ways through; at least ${LANDMARK_RULES.ways}`);
      if (k.footing === 'floating' && !FLOATS.has(theme)) out.push(`floats, but ${theme}'s ground doesn't (FLOATS, src/themes.ts)`);
      if (!k.varies.length) out.push('declares nothing in `varies`: say what its seed changes');
      if (!c.names?.length) out.push('no name templates (`names`)');
      for (const n of c.names ?? []) if (!n.includes('{place}')) out.push(`name "${n}" has no {place}`);
      const recipes = new Set(SET_PIECE_RECIPES[theme].map((r) => r.name));
      for (const f of c.family) if (!recipes.has(f)) out.push(`family "${f}" is no ${theme} set-piece recipe`);
      return out;
    });

    rule(key('stands'), 'stands up wherever it says it fits', () => {
      const all = cases();
      if (!all.length) return ['fits none of its own sizes'];
      const down = all.filter((x) => !x.level);
      // A rare plain fallback is allowed (tests/stats keeps the share under 5%); most of these must stand.
      return down.length * 3 > all.length ? down.map((x) => `${at(x)}: fell back to plain`) : [];
    });

    rule(
      key('scale'),
      `measures ${k.scale} or more`,
      each((l) => {
        const s = measureScale(l, l.landmark!.rect);
        return RANK[s.scale] < RANK[k.scale] ? [`measures ${s.scale} (span ${s.span.toFixed(2)}, area ${s.area.toFixed(2)})`] : [];
      }),
    );

    rule(
      key('footing'),
      `stands ${k.footing}`,
      each((l) => footingFaults(l, l.landmark!.rect, ownPieces(l), k.footing)),
    );

    rule(
      key('ways'),
      `has ${k.ways} ways through`,
      each((l) => {
        const share = analyzeRoutes(l, l.solution ?? []).landmark ?? 1;
        return share > MAX_SHARED ? [`${Math.round(share * 100)}% of the way past it has no second way`] : [];
      }),
    );

    rule(
      key('proof'),
      c.carrier ? 'carries a proven ride' : 'keeps a static proof',
      each((l) => {
        if (c.carrier) return l.rides?.length ? [] : ['no proven ride'];
        const out: string[] = [];
        if (l.rides) out.push('has rides but is no carrier');
        if (!analyzeReach(withBridges({ ...l, setPieces: [] }, l.solution ?? [])).goalReached) out.push('its solution needs a set piece');
        if (!planHolds(l, [], l.solution ?? [])) out.push('its pieces break the solution');
        return out;
      }),
    );

    rule(
      key('free-ride'),
      'gives a bare run no free ride',
      each((l) => {
        const own = ownPieces(l);
        return own
          .filter(
            (pp) =>
              !noFreeRide(
                l,
                pp,
                l.setPieces.filter((q) => q !== pp),
              ),
          )
          .map((pp) => `${pp.def.name} carries a bare run to the flag`);
      }),
    );

    rule(
      key('protected'),
      'stays out of the spawn and goal pockets',
      each((l) => [
        ...protectedFaults(l, l.landmark!.rect),
        ...ownPieces(l).flatMap((pp) => (footprintCells(pp).some(([x, y]) => isProtected(l, x, y)) ? [`${pp.def.name} takes a protected cell`] : [])),
      ]),
    );

    rule(
      key('art'),
      'has art for every module',
      each((l) => ownPieces(l).flatMap(artFaults)),
    );

    rule(
      key('hazards'),
      'warns before it hurts, and draws what hurts',
      each((l) => ownPieces(l).flatMap((pp) => hazardFaults(l, pp))),
    );

    rule(
      key('name'),
      'names its level',
      each((l) => {
        const want = conceptName(l.seed, c, generateTheme(l.seed, theme).name);
        return c.names?.length && l.theme.name === want ? [] : [`level named "${l.theme.name}", not after its landmark`];
      }),
    );

    rule(key('varies'), `varies with its seed (${LANDMARK_RULES.varies}+ structural parameters)`, () => {
      const base = raised().filter((x) => x.gravity === 'normal' && x.size === (c.sizes.includes('classic') ? 'classic' : c.sizes[0]));
      if (base.length < 2) return [`only ${base.length} level stood up to compare`];
      const out: string[] = [];
      const lay = base.map((x) => layoutOf(x.level));
      for (let i = 0; i < lay.length; i++)
        for (let j = i + 1; j < lay.length; j++) {
          const d = layoutDiff(lay[i], lay[j]);
          if (d.length < LANDMARK_RULES.varies)
            out.push(`seeds ${base[i].seed} and ${base[j].seed} ${d.length ? `differ only in ${d.join(', ')}` : 'build the same landmark'}`);
        }
      return out;
    });
  });
}

/** The landmark contract for every concept of these themes. */
export function landmarkSuite(themes: readonly ThemeId[]): void {
  for (const theme of themes) {
    if (!CONCEPTS[theme].length) it.todo(`${theme}: no landmarks registered yet (tests/conformance/themes counts them)`);
    for (const c of CONCEPTS[theme]) conceptSuite(theme, c);
  }
}
