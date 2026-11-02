import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe } from 'vitest';
import { partGroups } from '../../src/codex/parts';
import { Rng } from '../../src/core/rng';
import { generatePart, type Part, partArchetypes } from '../../src/gen/props';
import { moduleArt } from '../../src/render/props/common';
import type { Archetype } from '../../src/sim/props';
import { once, rule } from './lib';

/**
 * The part contract (RECIPES, src/gen/props.ts) for every archetype with a recipe: the same part from the
 * same seed; sizes that only scale (same modules, same motion, same identity, the name changed only by its
 * size word, never smaller as it grows); art for every module it uses and a codex entry showing each; and
 * no face anywhere in prop art (docs/DECISIONS.md: only runners have faces).
 */

const SEEDS = [1, 2, 3];
const WORD = { small: 'Small ', medium: '', large: 'Big ' } as const;

const parts = once(() => new Map(partArchetypes().map((a) => [a, SEEDS.map((s) => generatePart(new Rng(s * 7919 + 1), a, `p${s}`))])));
const codexTypes = once(() => new Set(partGroups().flatMap((g) => g.entries.flatMap((e) => e.def.modules.map((m) => m.type)))));

function sizeFaults(p: Part): string[] {
  const out: string[] = [];
  const med = p.variants.find((v) => v.size === 'medium') ?? p.variants[0];
  if (/^(Small|Big) /.test(med.name)) out.push(`"${med.name}": size words are rollPart's to add`);
  for (const v of p.variants) {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (
      !same(
        v.modules.map((m) => m.type),
        med.modules.map((m) => m.type),
      )
    )
      out.push(`${v.size} ${v.name}: other modules than the medium`);
    if (v.motion.type !== med.motion.type) out.push(`${v.size} ${v.name}: other motion than the medium`);
    if (!same([v.archetype, v.role, v.maker, v.style, v.mount], [med.archetype, med.role, med.maker, med.style, med.mount]))
      out.push(`${v.size} ${v.name}: another identity`);
    if (v.size && v.name !== WORD[v.size] + med.name) out.push(`${v.size} "${v.name}" isn't "${WORD[v.size]}${med.name}"`);
  }
  const order = ['small', 'medium', 'large'];
  const sorted = [...p.variants].sort((a, b) => order.indexOf(a.size ?? 'medium') - order.indexOf(b.size ?? 'medium'));
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].footprint.length < sorted[i - 1].footprint.length) out.push(`${sorted[i].size} takes fewer cells than ${sorted[i - 1].size}`);
  return out;
}

function archetypeSuite(a: Archetype) {
  const key = (r: string) => `part/*/${a}/${r}`;
  const mine = () => parts().get(a)!;
  describe(a, () => {
    rule(key('determinism'), 'is the same part from the same seed', () =>
      SEEDS.flatMap((s, i) =>
        JSON.stringify(generatePart(new Rng(s * 7919 + 1), a, `p${s}`)) === JSON.stringify(mine()[i]) ? [] : [`seed ${s} rolled two parts`],
      ),
    );
    rule(key('sizes'), 'only scales between sizes', () => mine().flatMap(sizeFaults));
    rule(key('art'), 'has art and a codex entry for every module', () => {
      const types = new Set(mine().flatMap((p) => p.variants.flatMap((v) => v.modules.map((m) => m.type))));
      const out: string[] = [];
      for (const t of types) {
        if (!moduleArt(t).length) out.push(`no art for ${t}`);
        if (!codexTypes().has(t)) out.push(`the codex shows no ${t} (src/codex/parts.ts)`);
      }
      return out;
    });
  });
}

/** Every file under a folder. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('parts', () => {
  for (const a of partArchetypes()) archetypeSuite(a);
  rule('part/*/*/faces', 'no prop art draws a face', () =>
    files(join(__dirname, '../../src/render/props')).flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return /import\s*{[^}]*\b(eyes|mouth)\b[^}]*}\s*from\s*'[^']*ink-figure'/.test(src) ? [`${f} draws a runner's eyes or mouth`] : [];
    }),
  );
});
