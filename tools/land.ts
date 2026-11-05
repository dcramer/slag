/**
 * Land worktree branches on main: the orchestrator's whole merge step in one command. A
 * coordinator that merged, gated and pushed each branch by hand spent hours of its own time
 * waiting on the gate, so this gates once per batch and leaves only conflicts to a person.
 *
 *   pnpm land <branch> [<branch>…]   merge each branch, gate once, push to origin main
 *   pnpm land                        sync with origin/main, gate and push your own commits
 *
 * Options: --snap bumps SNAP_VERSION even when no branch touched the snapshot files (a change
 *          in what a saved field means); --build forces `pnpm build`; --no-push stops after the gate.
 *
 * Steps: a clean tree; catch up with origin/main; merge the branches in order (a conflict stops
 * here with the merge in progress); `pnpm install` if the lockfile changed; one SNAP_VERSION bump
 * when the batch changed code in src/net/snapshot.ts or the field lists in tests/snapshot.test.ts;
 * `pnpm check`, plus `pnpm build` when the host changed, plus whatever failed in main's last finished
 * CI run (`pnpm test:stats`, `pnpm build`); push HEAD to origin main.
 *
 * Why the CI part: `pnpm check` leaves out the stats suite, so a batch could break it, push green and
 * leave main red for days while every later batch kept landing. While main is red, each batch also runs
 * what's red, so the batch that fixes it proves it and the others see it fail before they push.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const branches = argv.filter((a) => !a.startsWith('--'));
for (const f of flags) if (!['--snap', '--build', '--no-push'].includes(f)) fail(`Unknown option ${f}. Options: --snap, --build, --no-push.`);

const SNAP_FILE = 'src/net/snapshot.ts';
const SNAP_RE = /export const SNAP_VERSION = (\d+);/;
/** Files whose change can break `next build` without failing `pnpm check`. */
const HOST = /^(app\/|next\.config\.ts$|package\.json$|pnpm-lock\.yaml$|instrumentation(-client)?\.ts$)/;

function fail(msg: string): never {
  console.error(`land: ${msg}`);
  process.exit(1);
}

/** Runs git and returns its trimmed stdout; a non-zero exit returns null so callers decide what failing means. */
function git(...args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function run(cmd: string, ...args: string[]): boolean {
  console.log(`land: ${cmd} ${args.join(' ')}`);
  return spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;
}

/** A step of the CI workflow (.github/workflows/ci.yml) by name, and the local command that runs the same check. `pnpm check` covers the rest. */
const CI_STEPS: Record<string, string[]> = {
  'Test stats': ['pnpm', 'test:stats'],
  Build: ['pnpm', 'build'],
};

/**
 * The failed steps of main's last CI run that finished (a run cancelled by a newer push says nothing), or
 * null when it passed. Without `gh` (not installed, not logged in) it warns and returns null: the gate still runs.
 */
function redOnMain(): { url: string; steps: string[] } | null {
  const gh = (...args: string[]) => {
    const r = spawnSync('gh', args, { encoding: 'utf8' });
    return r.status === 0 ? r.stdout : null;
  };
  const list = gh('run', 'list', '--branch', 'main', '--workflow', 'ci.yml', '-L', '30', '--json', 'databaseId,conclusion,url');
  if (list === null) {
    console.warn("land: couldn't read main's CI status (gh missing or not logged in); gating on pnpm check alone.");
    return null;
  }
  const last = (JSON.parse(list) as { databaseId: number; conclusion: string; url: string }[]).find(
    (r) => r.conclusion === 'success' || r.conclusion === 'failure',
  );
  if (!last || last.conclusion === 'success') return null;
  const view = gh('run', 'view', String(last.databaseId), '--json', 'jobs');
  const jobs = view ? (JSON.parse(view) as { jobs: { name: string; steps: { name: string; conclusion: string }[] }[] }).jobs : [];
  return { url: last.url, steps: jobs.flatMap((j) => j.steps.filter((st) => st.conclusion === 'failure').map((st) => `${j.name}: ${st.name}`)) };
}

const conflicts = () => git('diff', '--name-only', '--diff-filter=U')?.split('\n').filter(Boolean) ?? [];

if (git('status', '--porcelain', '--untracked-files=no')) fail('the working tree has uncommitted changes. Commit them (or land from a clean checkout) first.');
for (const b of branches) if (git('rev-parse', '--verify', '--quiet', `${b}^{commit}`) === null) fail(`no branch or commit named ${b}.`);

if (git('fetch', '-q', 'origin') === null) fail('git fetch origin failed.');
if (git('merge-base', '--is-ancestor', 'HEAD', 'origin/main') !== null) {
  git('merge', '-q', '--ff-only', 'origin/main');
} else if (git('merge-base', '--is-ancestor', 'origin/main', 'HEAD') === null && git('merge', '-q', '--no-edit', 'origin/main') === null) {
  fail(
    `merging origin/main conflicted in: ${conflicts().join(', ')}. Resolve them, \`git commit --no-edit\`, then run \`pnpm land ${branches.join(' ')}\` again.`,
  );
}

const landed: string[] = [];
for (const [i, b] of branches.entries()) {
  if (git('merge-base', '--is-ancestor', b, 'HEAD') !== null) {
    console.log(`land: ${b} is already in HEAD, skipping`);
    continue;
  }
  if (git('merge', '-q', '--no-edit', b) === null) {
    const rest = branches.slice(i + 1);
    fail(
      `merging ${b} conflicted in: ${conflicts().join(', ')}. The merge is left in progress` +
        (landed.length ? ` on top of ${landed.join(', ')} (merged, not pushed)` : '') +
        `. Resolve it, \`git commit --no-edit\`, then run \`pnpm land${rest.length ? ' ' + rest.join(' ') : ''}\` to gate and push.`,
    );
  }
  landed.push(b);
}

const changed = git('diff', '--name-only', 'origin/main', 'HEAD')?.split('\n').filter(Boolean) ?? [];
if (!changed.length) {
  console.log('land: nothing to land, HEAD matches origin/main');
  process.exit(0);
}

if (changed.some((f) => f === 'package.json' || f === 'pnpm-lock.yaml') && !run('pnpm', 'install', '--frozen-lockfile')) fail('pnpm install failed.');

// Branches never bump SNAP_VERSION (two bumps always conflict); the batch that lands them bumps it once.
const snapAt = (rev: string) => git('show', `${rev}:${SNAP_FILE}`)?.match(SNAP_RE)?.[1];
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
/** What decides the wire format: snapshot.ts minus its comments, and the test's saved/derived field lists. A doc edit bumps nothing. */
const wireAt = (rev: string) =>
  code(git('show', `${rev}:${SNAP_FILE}`) ?? '') +
  (git('show', `${rev}:tests/snapshot.test.ts`)?.match(/const (MATCH|RUN)_FIELDS = \{[\s\S]*?\n\};/g) ?? []).map(code).join('');
if ((flags.has('--snap') || wireAt('origin/main') !== wireAt('HEAD')) && snapAt('origin/main') === snapAt('HEAD')) {
  const next = Number(snapAt('HEAD')) + 1;
  writeFileSync(SNAP_FILE, readFileSync(SNAP_FILE, 'utf8').replace(SNAP_RE, `export const SNAP_VERSION = ${next};`));
  const why = landed.length ? `${landed.join(', ')} changed the snapshot` : 'the snapshot changed';
  if (git('commit', '-q', '-m', `Bump SNAP_VERSION to ${next}: ${why}`, '--', SNAP_FILE) === null) fail('committing the SNAP_VERSION bump failed.');
  console.log(`land: SNAP_VERSION → ${next}`);
}

const red = redOnMain();
const extra = new Set<string>();
if (red) {
  console.warn(`land: main's last CI run failed (${red.url}): ${red.steps.join(', ') || 'see the run'}.`);
  for (const step of red.steps) {
    const cmd = CI_STEPS[step.slice(step.indexOf(': ') + 2)];
    if (cmd) extra.add(cmd.join(' '));
    else if (!/: (Typecheck|Lint|Format|Test)/.test(step)) console.warn(`land: no local command for "${step}"; check it in CI after the push.`);
  }
}
if (flags.has('--build') || changed.some((f) => HOST.test(f))) extra.add('pnpm build');

if (!run('pnpm', 'check')) fail('the gate failed. Fix it with a commit here, then run `pnpm land` again.');
for (const cmd of extra) {
  const [bin, ...args] = cmd.split(' ');
  if (!run(bin, ...args))
    fail(`${cmd} failed${red && cmd !== 'pnpm build' ? ', as it does on main' : ''}. Fix it with a commit here, then run \`pnpm land\` again.`);
}

if (flags.has('--no-push')) {
  console.log('land: gated, not pushed (--no-push)');
  process.exit(0);
}
if (!run('git', 'push', '-q', 'origin', 'HEAD:main'))
  fail('the push was rejected: origin/main moved during the gate. Run `pnpm land` again to merge it and re-gate.');
console.log(`land: pushed ${git('rev-parse', '--short', 'HEAD')} to origin/main${landed.length ? ` with ${landed.join(', ')}` : ''}`);
