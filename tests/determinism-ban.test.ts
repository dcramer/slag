import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Online play is lockstep: every browser must compute bit-identical sim
 * state. `Math.sin/cos/atan2/exp/pow/hypot/…` (and `**`, which is Math.pow)
 * are not guaranteed to agree across JS engines, and `Math.random` is not
 * seeded. Deterministic code must use src/core/dmath.ts and src/core/rng.ts.
 *
 * A line may opt out with a trailing `// det-ok: <why>` comment, or a
 * `// det-ok-next-line: <why>` comment above it (e.g. a non-sim helper that
 * lives in one of these folders).
 */
const ROOTS = [
  'src/sim',
  'src/game',
  'src/core',
  'src/gen/props.ts',
  'src/gen/setpieces',
  'src/gen/character.ts',
  'src/gen/theme',
  'src/gen/names.ts',
  'src/themes.ts',
];
/**
 * Not yet swapped: worldgen is being rewritten in parallel. Move these into
 * ROOTS once they use dmath (see docs/NETCODE.md → "Cross-browser determinism").
 */
export const PENDING = ['src/gen/level'];
const SKIP = new Set(['src/core/dmath.ts', 'src/core/color.ts']);

const BANNED = /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt|random)\b|\*\*(?!\/)/;

function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((e) => files(join(p, e)));
}

/** Drop comments (block, JSDoc and line) so prose can mention the banned names. */
function code(src: string): string[] {
  const raw = src.split('\n');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l, i) => (/\/\/\s*det-ok:/.test(raw[i]) || /\/\/\s*det-ok-next-line:/.test(raw[i - 1] ?? '') ? '' : l.replace(/\/\/.*$/, '')));
}

describe('determinism ban', () => {
  it('no engine-dependent math or unseeded randomness in deterministic code', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const f of files(root)) {
        if (!f.endsWith('.ts') || SKIP.has(f)) continue;
        code(readFileSync(f, 'utf8')).forEach((line, i) => {
          if (BANNED.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(hits, `use src/core/dmath.ts instead:\n${hits.join('\n')}`).toEqual([]);
  });
});
