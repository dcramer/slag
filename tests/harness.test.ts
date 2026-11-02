import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { needsBuild, supervise } from '../tools/lib/server';

const stillRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('supervise', () => {
  const spawnNode = (code: string) => spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = (c: ReturnType<typeof spawnNode>) => new Promise((res) => c.stdout?.once('data', res));

  it('stops a well-behaved child and frees our pipes', async () => {
    const child = spawnNode(`console.log('up'); setInterval(() => {}, 1000);`);
    await ready(child);
    await supervise(child)();
    expect(child.signalCode).toBe('SIGTERM');
    expect(child.stdout?.destroyed).toBe(true);
    expect(child.stderr?.destroyed).toBe(true);
  });

  it('escalates to SIGKILL when a child ignores SIGTERM', async () => {
    const child = spawnNode(`process.on('SIGTERM', () => {}); console.log('up'); setInterval(() => {}, 1000);`);
    await ready(child);
    await supervise(child, 150)();
    await new Promise((res) => (child.exitCode === null && child.signalCode === null ? child.once('exit', res) : res(null)));
    expect(child.signalCode).toBe('SIGKILL');
  });

  // The hang in `pnpm shot`: a wrapper dies on SIGTERM while the server underneath survives holding
  // our pipes, so `close` never fires and those stream handles keep the harness alive forever.
  it('returns when a surviving descendant still holds the pipes', async () => {
    const wrapper = spawnNode(`
      const { spawn } = require('node:child_process');
      const orphan = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit', detached: true });
      console.log(orphan.pid);
      process.on('SIGTERM', () => process.exit(0));
      setInterval(() => {}, 1000);
    `);
    const orphan = Number(await ready(wrapper));
    try {
      expect(stillRunning(orphan)).toBe(true);
      await supervise(wrapper, 2000)();
      expect(stillRunning(orphan)).toBe(true); // Holding the pipes, and yet:
      expect(wrapper.stdout?.destroyed).toBe(true);
      expect(wrapper.stderr?.destroyed).toBe(true);
    } finally {
      process.kill(orphan, 'SIGKILL');
    }
  });

  it('handles a child that already exited', async () => {
    const child = spawnNode(`process.exit(0)`);
    await new Promise((res) => child.once('exit', res));
    await supervise(child)();
    expect(child.stdout?.destroyed).toBe(true);
  });

  it('leaves no process listeners behind', async () => {
    const before = process.listenerCount('exit') + process.listenerCount('SIGTERM');
    const child = spawnNode(`console.log('up'); setInterval(() => {}, 1000);`);
    await ready(child);
    await supervise(child)();
    expect(process.listenerCount('exit') + process.listenerCount('SIGTERM')).toBe(before);
  });
});

describe('needsBuild', () => {
  let root: string;
  const write = (p: string, s: string) => writeFileSync(join(root, p), s);
  /** What a harness build leaves behind: a BUILD_ID, plus the stamp once it's been adopted. */
  const built = (id: string) => {
    write('.next/BUILD_ID', id);
    utimesSync(join(root, '.next/BUILD_ID'), new Date(), new Date(Date.now() + 5000));
    expect(needsBuild(root)).toBe(false);
  };
  const future = (p: string) => utimesSync(join(root, p), new Date(), new Date(Date.now() + 60_000));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'slag-harness-'));
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, '.next'));
    write('src/a.ts', 'one');
    write('src/AGENTS.md', 'docs');
    write('package.json', '{}');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('builds when there is no build', () => {
    expect(needsBuild(root)).toBe(true);
  });

  it('adopts a manual build whose inputs are older, and records what it was built from', () => {
    built('manual');
    expect(JSON.parse(readFileSync(join(root, '.next/harness-stamp.json'), 'utf8')).buildId).toBe('manual');
  });

  it('rebuilds for a manual build older than its inputs', () => {
    write('.next/BUILD_ID', 'manual');
    utimesSync(join(root, '.next/BUILD_ID'), new Date(0), new Date(0));
    expect(needsBuild(root)).toBe(true);
  });

  it('ignores mtime churn from checkouts and rebases', () => {
    built('a');
    future('src/a.ts');
    expect(needsBuild(root)).toBe(false);
  });

  it('ignores docs that sit next to the code', () => {
    built('a');
    write('src/AGENTS.md', 'edited docs');
    expect(needsBuild(root)).toBe(false);
  });

  it('rebuilds on a content change, even one that keeps the old mtime', () => {
    built('a');
    write('src/a.ts', 'two');
    utimesSync(join(root, 'src/a.ts'), new Date(0), new Date(0));
    expect(needsBuild(root)).toBe(true);
  });

  it('rebuilds when a source file is added or removed', () => {
    built('a');
    write('src/b.ts', 'new');
    expect(needsBuild(root)).toBe(true);
    rmSync(join(root, 'src/b.ts'));
    expect(needsBuild(root)).toBe(false);
  });

  it('rebuilds when a build input outside src changes', () => {
    built('a');
    write('package.json', '{"dependencies":{}}');
    expect(needsBuild(root)).toBe(true);
  });
});
