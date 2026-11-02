import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `**` is Math.pow in operator form, so it differs across browsers like the
 * functions .oxlintrc.json bans by name, and a property rule can't see it.
 * A line may opt out with a trailing `// det-ok: <why>` comment.
 */
const ROOTS = ['src/sim', 'src/gen', 'src/game', 'src/core/geom.ts', 'src/themes.ts'];

function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((e) => files(join(p, e)));
}

/** Source lines with comments blanked, so prose and doc comments can't match. */
function code(src: string): string[] {
  const raw = src.split('\n');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l, i) => (/\/\/\s*det-ok:/.test(raw[i]) ? '' : l.replace(/\/\/.*$/, '')));
}

describe('determinism ban', () => {
  it('no ** in deterministic code', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const f of files(root)) {
        if (!f.endsWith('.ts')) continue;
        code(readFileSync(f, 'utf8')).forEach((line, i) => {
          if (/\*\*/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(
      hits,
      `** is Math.pow, which differs across browsers and desyncs lockstep. Use sq(x) for squares and dpow(x, y) otherwise, both from src/core/dmath.ts:\n${hits.join('\n')}`,
    ).toEqual([]);
  });
});
