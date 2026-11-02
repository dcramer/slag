#!/usr/bin/env node
// SessionStart hook: install dependencies in a fresh checkout or worktree. node_modules is
// not shared between worktrees, and without it every pnpm script fails and the format hook
// silently does nothing. A real install beats symlinking: the pnpm store makes it take about
// a second, and a worktree that changes deps can't corrupt another's. Never blocks: always exits 0.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const { cwd } = JSON.parse(readFileSync(0, 'utf8'));
  if (typeof cwd === 'string' && existsSync(join(cwd, 'pnpm-lock.yaml')) && !existsSync(join(cwd, 'node_modules'))) {
    const { status } = spawnSync('pnpm', ['install', '--frozen-lockfile'], { cwd, stdio: 'ignore', timeout: 110_000 });
    // Plain stdout from a SessionStart hook reaches the agent, so a failure isn't lost.
    if (status !== 0) console.log('pnpm install failed in this checkout; run it by hand before anything else.');
  }
} catch {
  // Best-effort; `pnpm install` by hand always works.
}
process.exit(0);
