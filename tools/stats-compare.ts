/**
 * Before/after numbers for the stats suites without copying trees by hand: runs `test:stats` suites on a base commit
 * and on this checkout, in parallel when the machine has the cores, and lines up what each test printed.
 *
 *   pnpm stats:compare brawl level-styles          base = merge-base with origin/main
 *   pnpm stats:compare --base HEAD~3 free-ride     any rev
 *   pnpm stats:compare --fresh brawl               ignore cached results
 *
 * A suite is its file name in tests/stats/ (`brawl` → tests/stats/brawl.test.ts). Each printed line is shown once,
 * with the numbers that moved as `base→head`; a line whose words changed shows both. A test that passes on the base
 * and fails here is flagged NEWLY FAILS with its message, and the tool exits 1.
 *
 * The base is checked out with `git worktree add --detach` into a directory of its own in the OS temp dir (never
 * inside a checkout, where tsc, vitest and lint would pick its files up) and removed afterwards, so it is safe to run
 * from an agent's worktree: the agent runs one plain command and never touches another worktree itself. It shares
 * this checkout's node_modules when the lockfiles match, and otherwise installs offline from the pnpm store.
 * Results for a commit are cached per suite in the main checkout's .cache/stats-compare/, which every worktree of
 * the repo shares, so a second agent comparing against the same base only runs its own side; while another run
 * holds a suite's lock, this one waits for its result instead of running it again.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { argReader } from './lib/server';
import type { StatsCase } from './lib/stats-reporter';

const argv = process.argv.slice(2);
const args = argReader(argv);
const baseArg = args.opt('base');
const fresh = args.flag('fresh');
const suites = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
if (!suites.length) fail('name at least one suite, e.g. `pnpm stats:compare brawl` (files in tests/stats/).');

function fail(msg: string): never {
  console.error(`stats:compare: ${msg}`);
  process.exit(2);
}

function git(cwd: string, ...a: string[]): string | null {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const root = git(process.cwd(), 'rev-parse', '--show-toplevel') ?? fail('not in a git checkout.');
const head = git(root, 'rev-parse', 'HEAD')!;
const base =
  git(root, 'rev-parse', '--verify', '--quiet', `${baseArg ?? (git(root, 'merge-base', 'HEAD', 'origin/main') || 'origin/main')}^{commit}`) ??
  fail(`no commit ${baseArg ?? 'merge-base with origin/main'}.`);
const clean = git(root, 'status', '--porcelain') === '';
const common = resolve(root, git(root, 'rev-parse', '--git-common-dir')!);
const cacheDir = join(dirname(common), '.cache', 'stats-compare');
const short = (sha: string) => sha.slice(0, 9);

const fileOf = (s: string) => (s.includes('/') ? s : `tests/stats/${s.replace(/\.test\.ts$/, '')}.test.ts`);
const files = suites.map(fileOf);
const inBase = (f: string) => spawnSync('git', ['cat-file', '-e', `${base}:${f}`], { cwd: root }).status === 0;
for (const f of files) if (!existsSync(join(root, f)) && !inBase(f)) fail(`no suite ${f} here or in ${short(base)}.`);

// ---------------------------------------------------------------- cache

type Result = { cases: StatsCase[]; at: string };
const cachePath = (sha: string, f: string) => join(cacheDir, sha, `${basename(f, '.test.ts')}.json`);
const lockPath = (sha: string, f: string) => `${cachePath(sha, f)}.lock`;
const readCache = (sha: string, f: string): Result | null => {
  try {
    return JSON.parse(readFileSync(cachePath(sha, f), 'utf8')) as Result;
  } catch {
    return null;
  }
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** Take a suite's lock for a commit, or return the pid of the live run that holds it. A dead holder's lock is taken over. */
function lock(sha: string, f: string): number | null {
  mkdirSync(dirname(lockPath(sha, f)), { recursive: true });
  for (let tries = 0; tries < 2; tries++) {
    try {
      const fd = openSync(lockPath(sha, f), 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      held.push(lockPath(sha, f));
      return null;
    } catch {
      const pid = Number(readFileSync(lockPath(sha, f), 'utf8'));
      if (pid && alive(pid)) return pid;
      rmSync(lockPath(sha, f), { force: true });
    }
  }
  return null;
}
const held: string[] = [];
function unlock(sha: string, f: string) {
  const i = held.indexOf(lockPath(sha, f));
  if (i >= 0) rmSync(held.splice(i, 1)[0], { force: true });
}
/** A timed-out test says more about the machine's load than the commit: don't keep it. */
const keepable = (cases: StatsCase[]) => !cases.some((c) => /timed out/i.test(c.error ?? ''));

// ---------------------------------------------------------------- the base worktree

const worktrees: string[] = [];
/** Worktrees a killed run left behind (their pid is gone): remove them before making another. */
function sweep() {
  const list = git(root, 'worktree', 'list', '--porcelain') ?? '';
  for (const m of list.matchAll(/^worktree (.*slag-stats-[0-9a-f]+-(\d+))$/gm)) if (!alive(Number(m[2]))) git(root, 'worktree', 'remove', '--force', m[1]);
}
function checkout(sha: string): string {
  sweep();
  const dir = join(tmpdir(), `slag-stats-${short(sha)}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  if (git(root, 'worktree', 'add', '--detach', '--quiet', dir, sha) === null) fail(`git worktree add ${dir} failed.`);
  worktrees.push(dir);
  const lockSame = git(root, 'show', `${sha}:pnpm-lock.yaml`) === readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').trim();
  if (lockSame && existsSync(join(root, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  else {
    console.log(`stats:compare: ${short(sha)} has another lockfile; installing its packages`);
    const ok = (...a: string[]) => spawnSync('pnpm', ['install', '--frozen-lockfile', ...a], { cwd: dir, stdio: 'ignore' }).status === 0;
    if (!ok('--offline') && !ok()) fail(`pnpm install in the ${short(sha)} worktree failed.`);
  }
  return dir;
}
function cleanup() {
  for (const dir of worktrees.splice(0)) {
    git(root, 'worktree', 'remove', '--force', dir);
    rmSync(dir, { recursive: true, force: true });
  }
  for (const l of held.splice(0)) rmSync(l, { force: true });
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
  process.on(sig, () => {
    for (const c of children) c.kill(sig);
    cleanup();
    process.exit(130);
  });

// ---------------------------------------------------------------- running

const children: ChildProcess[] = [];
const reporter = join(root, 'tools/lib/stats-reporter.ts');
/** Run suites in `cwd` and resolve with what each test printed, or reject with the run's last words. */
function runSuites(label: string, cwd: string, fs: string[], workers: number): Promise<StatsCase[]> {
  const out = join(cacheDir, `run-${process.pid}-${label}.json`);
  mkdirSync(cacheDir, { recursive: true });
  rmSync(out, { force: true });
  const t = Date.now();
  console.log(`stats:compare: ${label}: running ${fs.map((f) => basename(f, '.test.ts')).join(', ')} (${workers} worker${workers > 1 ? 's' : ''})`);
  return new Promise((done, reject) => {
    const c = spawn('pnpm', ['run', '--silent', 'test:stats', `--reporter=${reporter}`, `--maxWorkers=${workers}`, ...fs], {
      cwd,
      env: { ...process.env, SLAG_STATS_OUT: out },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    children.push(c);
    let err = '';
    c.stderr!.on('data', (d: Buffer) => (err = (err + d.toString()).slice(-4000)));
    c.on('close', () => {
      if (!existsSync(out)) return reject(new Error(`${label} run wrote no results:\n${err.trim() || '(no output)'}`));
      const cases = JSON.parse(readFileSync(out, 'utf8')) as StatsCase[];
      unlinkSync(out);
      console.log(`stats:compare: ${label}: done in ${Math.round((Date.now() - t) / 1000)} s`);
      done(cases);
    });
  });
}

/** Poll a cache entry another run is producing; null if that run dies or gives up first. */
async function await_(sha: string, f: string, pid: number): Promise<Result | null> {
  for (;;) {
    const r = readCache(sha, f);
    if (r) return r;
    if (!existsSync(lockPath(sha, f)) || !alive(pid)) return readCache(sha, f);
    await new Promise((d) => setTimeout(d, 3000));
  }
}

/** Every suite's cases on one side: cached, waited for, or run (and cached when the side is a commit). */
async function side(label: string, sha: string | null, fs: string[], dir: () => string, workers: number): Promise<Map<string, StatsCase[]>> {
  const got = new Map<string, StatsCase[]>();
  const run: string[] = [];
  const waits: [string, number][] = [];
  for (const f of fs) {
    const hit = sha && !fresh ? readCache(sha, f) : null;
    if (hit) {
      console.log(`stats:compare: ${label}: ${basename(f, '.test.ts')} from cache (${hit.at})`);
      got.set(f, hit.cases);
      continue;
    }
    const other = sha ? lock(sha, f) : null;
    if (other) waits.push([f, other]);
    else run.push(f);
  }
  for (const [f, pid] of waits) console.log(`stats:compare: ${label}: waiting for pid ${pid}'s run of ${basename(f, '.test.ts')}`);
  const ran = run.length ? runSuites(label, dir(), run, Math.min(workers, run.length)) : Promise.resolve([]);
  const waited = await Promise.all(waits.map(async ([f, pid]) => [f, await await_(sha!, f, pid)] as const));
  for (const [f, r] of waited) if (r) got.set(f, r.cases);
  const late = waited.filter(([, r]) => !r).map(([f]) => f);
  const cases = [...(await ran), ...(late.length ? await runSuites(label, dir(), late, Math.min(workers, late.length)) : [])];
  for (const f of [...run, ...late]) {
    const mine = cases.filter((c) => c.file === f);
    got.set(f, mine);
    if (sha && keepable(mine)) {
      mkdirSync(dirname(cachePath(sha, f)), { recursive: true });
      writeFileSync(cachePath(sha, f), JSON.stringify({ cases: mine, at: new Date().toISOString().slice(0, 16) }));
    }
    if (sha) unlock(sha, f);
  }
  return got;
}

// ---------------------------------------------------------------- lining up

const NUM = /(-?\d+(?:\.\d+)?)/;
/** What a printed line is about: its words up to the first number (or colon), so the same measure pairs up across runs. */
const keyOf = (l: string) => l.split(NUM)[0].split(':')[0].trim();
/** One line with moved numbers as `base→head` when the words match; null when they don't. */
function merge(a: string, b: string): { text: string; moved: boolean } | null {
  const ta = a.split(NUM);
  const tb = b.split(NUM);
  if (ta.length !== tb.length || ta.some((t, i) => i % 2 === 0 && t !== tb[i])) return null;
  let moved = false;
  const text = ta.map((t, i) => (i % 2 === 0 || t === tb[i] ? t : ((moved = true), `${t}→${tb[i]}`))).join('');
  return { text, moved };
}

function lineUp(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const left = [...a];
  for (const l of b) {
    const i = left.findIndex((x) => keyOf(x) === keyOf(l));
    if (i < 0) {
      out.push(`  head  ${l}`);
      continue;
    }
    const [x] = left.splice(i, 1);
    const m = merge(x, l);
    if (m) out.push(`${m.moved ? '  ~     ' : '        '}${m.text}`);
    else out.push(`  base  ${x}`, `  head  ${l}`);
  }
  for (const x of left) out.push(`  base  ${x}`);
  return out;
}

const mark = (c?: StatsCase) => (!c ? '  -' : c.state === 'passed' ? ' ok' : c.state === 'failed' ? 'FAIL' : c.state);
const firstLine = (s?: string) => (s ?? '').split('\n')[0].slice(0, 240);

// ---------------------------------------------------------------- main

async function main() {
  const baseFiles = files.filter(inBase);
  const here = new Set(files.filter((f) => existsSync(join(root, f))));
  const headSha = clean ? head : null;
  // A side's run gets half the cores the machine has free; a suite is one file, which runs on one worker.
  const free = Math.max(2, cpus().length - Math.round(loadavg()[0]));
  const workers = Math.max(1, Math.floor(free / 2));
  console.log(
    `stats:compare: base ${short(base)}${baseArg ? '' : ' (merge-base with origin/main)'} vs head ${short(head)}${clean ? '' : ' + uncommitted changes'}`,
  );
  let wt: string | null = null;
  const [b, h] = await Promise.all([
    side('base', base, baseFiles, () => (wt ??= checkout(base)), workers),
    side('head', headSha, [...here], () => root, workers),
  ]);
  cleanup();

  let newly = 0;
  let fixed = 0;
  let movedLines = 0;
  for (const f of files) {
    console.log(`\n${f}${baseFiles.includes(f) ? '' : '  (not in base)'}${here.has(f) ? '' : '  (not here)'}`);
    const bc = b.get(f) ?? [];
    const hc = h.get(f) ?? [];
    const names = [...new Set([...hc.map((c) => c.name), ...bc.map((c) => c.name)])];
    for (const name of names) {
      const x = bc.find((c) => c.name === name);
      const y = hc.find((c) => c.name === name);
      const worse = x?.state === 'passed' && y?.state === 'failed';
      const better = x?.state === 'failed' && y?.state === 'passed';
      newly += +worse;
      fixed += +better;
      const flag = worse ? '  NEWLY FAILS' : better ? '  now passes' : '';
      console.log(`${mark(x).padStart(4)} ${mark(y).padStart(4)}  ${name || '(setup)'}${flag}`);
      const lines = lineUp(x?.lines ?? [], y?.lines ?? []);
      movedLines += lines.filter((l) => !l.startsWith('        ')).length;
      for (const l of lines) console.log(`          ${l}`);
      if (y?.state === 'failed') console.log(`          head: ${firstLine(y.error)}`);
      if (x?.state === 'failed' && !worse) console.log(`          base: ${firstLine(x.error)}`);
    }
  }
  console.log(`\nstats:compare: ${movedLines} line${movedLines === 1 ? '' : 's'} moved; ${newly} newly failing, ${fixed} newly passing (columns: base head)`);
  process.exitCode = newly ? 1 : 0;
}

// A killed run's results files are harmless, but don't let them pile up.
for (const f of existsSync(cacheDir) ? readdirSync(cacheDir) : []) {
  const pid = f.match(/^run-(\d+)-/)?.[1];
  if (pid && !alive(Number(pid))) rmSync(join(cacheDir, f), { force: true });
}

main().catch((e: Error) => {
  cleanup();
  fail(e.message);
});
