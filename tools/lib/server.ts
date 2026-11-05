/**
 * Shared harness plumbing for the browser tools (shot, perf, brand, online-test): build the production bundle when its
 * inputs changed, boot `next start` (or `next dev` with SHOT_DEV=1) on a free port, launch headless
 * Chromium with software GL, and guarantee the harness exits when it's done.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { join } from 'node:path';
import type { Browser } from 'playwright';

/**
 * Next's real entry point, run under our own node. Never `npx next` or `pnpm exec next`: those are
 * wrappers, a signal to the wrapper need not reach the server, and an orphaned server keeps holding
 * the pipes back to us, which keeps this process alive forever after its PNGs are written.
 */
const NEXT_BIN = 'node_modules/next/dist/bin/next';
const NEXT_ENV = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };

const INPUT_DIRS = ['src', 'app', 'public'];
const INPUT_FILES = ['next.config.ts', 'instrumentation.ts', 'instrumentation-client.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json'];
const BUILD_ID = '.next/BUILD_ID';
/** Which sources produced the current build. Lives in .next so it can't outlive the build. */
const STAMP = '.next/harness-stamp.json';

/** Everything the production bundle is built from, sorted. Docs next to the code don't count. */
function buildInputs(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (!e.name.endsWith('.md')) files.push(p);
    }
  };
  for (const d of INPUT_DIRS) if (existsSync(join(root, d))) walk(d);
  for (const f of INPUT_FILES) if (existsSync(join(root, f))) files.push(f);
  return files.sort();
}

function hashInputs(root: string, files: string[]): string {
  const h = createHash('sha1');
  for (const f of files)
    h.update(f)
      .update('\0')
      .update(readFileSync(join(root, f)))
      .update('\0');
  return h.digest('hex');
}

function readStamp(root: string): { buildId: string; hash: string } | null {
  try {
    return JSON.parse(readFileSync(join(root, STAMP), 'utf8')) as { buildId: string; hash: string };
  } catch {
    return null;
  }
}

function writeStamp(root: string, hash: string) {
  writeFileSync(join(root, STAMP), JSON.stringify({ buildId: readFileSync(join(root, BUILD_ID), 'utf8').trim(), hash }));
}

/**
 * True if the production build doesn't match the sources. Compares content, not mtimes: a checkout,
 * rebase or `touch` rewrites mtimes without changing the bundle, and an old file restored with its
 * old mtime does change it. A build this harness didn't stamp (a manual `pnpm build`) falls back to
 * mtimes once, then is adopted, so `pnpm build && pnpm shot` doesn't build twice.
 */
export function needsBuild(root = '.'): boolean {
  const idFile = join(root, BUILD_ID);
  if (!existsSync(idFile)) return true;
  const files = buildInputs(root);
  const hash = hashInputs(root, files);
  const stamp = readStamp(root);
  if (stamp?.buildId === readFileSync(idFile, 'utf8').trim()) return stamp.hash !== hash;
  const built = statSync(idFile).mtimeMs;
  if (files.some((f) => statSync(join(root, f)).mtimeMs > built)) return true;
  writeStamp(root, hash);
  return false;
}

/** `next build` if needed (or if `force`). Returns build wall time in ms, or 0 when skipped. */
function ensureBuild(force = false): number {
  if (!force && !needsBuild()) return 0;
  console.log('building (sources changed since last build)…');
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [NEXT_BIN, 'build'], { stdio: 'inherit', env: NEXT_ENV });
  if (r.status !== 0) throw new Error('next build failed');
  writeStamp('.', hashInputs('.', buildInputs('.')));
  return performance.now() - t0;
}

export async function freePort(): Promise<number> {
  return new Promise((res) => {
    const srv = netServer();
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address();
      srv.close(() => res(typeof a === 'object' && a ? a.port : 3100));
    });
  });
}

const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * Ties a child to this process: it goes down with us on a crash, process.exit or signal, so no
 * failure path leaves a server behind. Returns `close()`, which stops the child (SIGTERM, then
 * SIGKILL after `graceMs`) and releases our pipe ends. It waits for `exit`, not `close`, and
 * destroys the streams, so a descendant that still holds those pipes can't keep us alive either.
 */
export function supervise(child: ChildProcess, graceMs = 3000): () => Promise<void> {
  const alive = () => child.exitCode === null && child.signalCode === null;
  const onExit = () => {
    if (alive()) child.kill('SIGKILL');
  };
  const onSignal = (sig: NodeJS.Signals) => {
    child.kill('SIGTERM');
    release();
    process.kill(process.pid, sig); // No handler of ours left, so this now does the signal's default.
  };
  const release = () => {
    process.off('exit', onExit);
    for (const sig of FORWARDED_SIGNALS) process.off(sig, onSignal);
  };
  process.once('exit', onExit);
  for (const sig of FORWARDED_SIGNALS) process.on(sig, onSignal);

  return () =>
    new Promise<void>((done) => {
      const finish = () => {
        clearTimeout(timer);
        release();
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
        done();
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish();
      }, graceMs);
      if (!alive()) return finish();
      child.once('exit', finish);
      child.kill('SIGTERM');
    });
}

/**
 * Exits with an error if `pet()` isn't called for `seconds`. page.evaluate has no timeout, so a
 * wedged page would otherwise stall the harness forever. It measures inactivity, not total time,
 * so a long contact sheet can't trip it; override with SHOT_TIMEOUT (seconds).
 */
export function watchdog(seconds = Number(process.env.SHOT_TIMEOUT ?? 180)): () => void {
  let timer: NodeJS.Timeout | undefined;
  const pet = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.error(`no progress for ${seconds} s, giving up (set SHOT_TIMEOUT to allow longer)`);
      process.exit(1);
    }, seconds * 1000);
    timer.unref();
  };
  pet();
  return pet;
}

export interface Server {
  base: string;
  close(): Promise<void>;
}

const STARTUP_MS = 120_000;

/**
 * Production server by default (`next dev` compiles on demand and is far too slow for software GL).
 * Builds first when sources changed. Resolves once /r/WARMUP answers, which also warms the route.
 * `env` is added to the server's environment (online-test picks its signaling store this way).
 */
export async function startServer(opts: { dev?: boolean; port?: number; env?: Record<string, string> } = {}): Promise<Server> {
  const dev = opts.dev ?? process.env.SHOT_DEV === '1';
  const port = opts.port ?? Number(process.env.SHOT_PORT ?? (await freePort()));
  const base = `http://127.0.0.1:${port}/`;
  if (!dev) ensureBuild();
  const next = spawn(process.execPath, [NEXT_BIN, dev ? 'dev' : 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...NEXT_ENV, ...opts.env },
  });
  const close = supervise(next);
  let log = '';
  next.stdout.on('data', (d) => (log += d));
  next.stderr.on('data', (d) => (log += d));
  const deadline = performance.now() + STARTUP_MS;
  for (;;) {
    const exited = next.exitCode !== null || next.signalCode !== null;
    const fail = exited ? `exited (${next.exitCode ?? next.signalCode})` : performance.now() > deadline ? `not ready after ${STARTUP_MS / 1000} s` : null;
    if (fail) {
      await close();
      throw new Error(`next ${dev ? 'dev' : 'start'} ${fail}:\n${log}`);
    }
    try {
      const r = await fetch(`${base}r/WARMUP`, { signal: AbortSignal.timeout(STARTUP_MS) });
      if (r.ok) return { base, close };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Headless Chromium with SwiftShader WebGL. Prefers a preinstalled Chromium (cloud containers ship one). */
export async function launchBrowser(extraArgs: string[] = []): Promise<Browser> {
  const { chromium } = await import('playwright');
  const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  // PW_GPU=1 measures on this machine's real GPU, still headless. Software GL is the default so results don't depend on the machine.
  const gl = process.env.PW_GPU
    ? ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  return chromium.launch({ executablePath, args: [...gl, ...extraArgs] });
}

export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;
export type Engine = (typeof ENGINES)[number];

/**
 * A headless browser of any engine. Chromium is `launchBrowser` (software GL, `chromiumArgs`). Firefox shows real
 * host ICE candidates instead of mDNS names, which don't resolve between headless contexts, the same reason
 * online-test turns them off in Chromium. WebKit needs `pnpm exec playwright install webkit` and its system
 * libraries (`playwright install-deps webkit`).
 */
export async function launchEngine(engine: Engine, chromiumArgs: string[] = []): Promise<Browser> {
  if (engine === 'chromium') return launchBrowser(chromiumArgs);
  const pw = await import('playwright');
  if (engine === 'firefox')
    return pw.firefox.launch({
      firefoxUserPrefs: {
        'media.peerconnection.ice.obfuscate_host_addresses': false,
        'media.navigator.permission.disabled': true,
        'media.peerconnection.ice.loopback': true,
        // A hung page stands in for a crashed one (online-test), so never offer to stop its script.
        'dom.max_script_run_time': 0,
      },
    });
  return pw.webkit.launch();
}

/** `--engines chromium,firefox` → the engines named, in that order; every engine when absent. */
export function engineList(arg: string | undefined, fallback: readonly Engine[] = ENGINES): Engine[] {
  if (!arg) return [...fallback];
  const names = arg.split(',').filter(Boolean);
  for (const n of names) if (!(ENGINES as readonly string[]).includes(n)) throw new Error(`unknown engine ${n}: expected ${ENGINES.join(', ')}`);
  return names as Engine[];
}

/**
 * Tiny `--key value` / `--flag` argv reader. A tool reads its options wherever it needs them, so there's no list to
 * check them against up front; instead a run that ends cleanly with an option nothing read fails and names it. A
 * typo (`--seeds` for `--seed`) or a flag this scenario ignores would otherwise do nothing, silently.
 */
export function argReader(argv: string[]) {
  const asked = new Set<string>();
  process.once('exit', (code) => {
    if (code !== 0) return;
    const unread = argv.filter((a) => a.startsWith('--') && !asked.has(a.slice(2)));
    if (!unread.length) return;
    console.error(
      `unknown or unused option${unread.length > 1 ? 's' : ''} ${unread.join(' ')}: nothing in this run read ${unread.length > 1 ? 'them' : 'it'}. Options it did read: ${[...asked].map((k) => `--${k}`).join(' ') || 'none'}.`,
    );
    process.exitCode = 2;
  });
  return {
    opt: (k: string, d?: string) => {
      asked.add(k);
      const i = argv.indexOf(`--${k}`);
      return i >= 0 ? argv[i + 1] : d;
    },
    flag: (k: string) => {
      asked.add(k);
      return argv.includes(`--${k}`);
    },
  };
}
