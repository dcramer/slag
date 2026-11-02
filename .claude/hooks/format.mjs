#!/usr/bin/env node
// PostToolUse hook (Edit|Write): run oxfmt on the edited file so formatting never
// depends on the agent remembering `pnpm format`. Never blocks: always exits 0.
// The repo root is found from the file itself, so it works in git worktrees too.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

// Same scope as `pnpm format:check` (which also covers Markdown/JSON under these dirs).
const FORMATTED = /\.(ts|tsx|mts|cts|js|mjs|cjs|json|md)$/;
const DIRS = ['src', 'tests', 'tools', 'app'];
const ROOT_FILES = ['next.config.ts', 'vitest.config.ts'];

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const file = input?.tool_input?.file_path;
  if (typeof file !== 'string' || !FORMATTED.test(file) || !existsSync(file)) process.exit(0);

  let root = dirname(file);
  while (!existsSync(join(root, '.oxfmtrc.json'))) {
    const up = dirname(root);
    if (up === root) process.exit(0);
    root = up;
  }
  const rel = relative(root, file);
  if (!(ROOT_FILES.includes(rel) || DIRS.some((d) => rel.startsWith(d + sep)))) process.exit(0);

  const bin = join(root, 'node_modules', '.bin', 'oxfmt');
  if (existsSync(bin)) spawnSync(bin, [rel], { cwd: root, stdio: 'ignore', timeout: 15_000 });
} catch {
  // Formatting is best-effort; `pnpm check` is the real gate.
}
process.exit(0);
