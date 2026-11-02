/**
 * Shared by the browser harnesses (tools/shot.ts, tools/online-test.ts):
 * build if sources changed, start a production Next.js server on a free port
 * (`SHOT_DEV=1` uses `next dev`), and launch headless Chromium with software GL.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { type Browser, chromium } from 'playwright';

/** True if any source file is newer than the last production build. */
function needsBuild(): boolean {
  const id = '.next/BUILD_ID';
  if (!existsSync(id)) return true;
  const built = statSync(id).mtimeMs;
  const newer = (dir: string): boolean =>
    readdirSync(dir, { withFileTypes: true }).some((e) => {
      const p = `${dir}/${e.name}`;
      return e.isDirectory() ? newer(p) : statSync(p).mtimeMs > built;
    });
  return ['src', 'app', 'public'].some((d) => existsSync(d) && newer(d)) || ['next.config.ts', 'package.json'].some((f) => statSync(f).mtimeMs > built);
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

export async function startNext(): Promise<{ base: string; close: () => Promise<void> }> {
  const port = Number(process.env.SHOT_PORT ?? (await freePort()));
  const base = `http://127.0.0.1:${port}/`;
  // Production server by default: `next dev` compiles on demand and is far too slow for software-GL screenshots.
  const useDev = process.env.SHOT_DEV === '1';
  if (!useDev && needsBuild()) {
    console.log('building (sources changed since last build)…');
    const r = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
    if (r.status !== 0) throw new Error('next build failed');
  }
  const next = spawn('npx', ['next', useDev ? 'dev' : 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  let nextLog = '';
  next.stdout.on('data', (d) => (nextLog += d));
  next.stderr.on('data', (d) => (nextLog += d));
  // Wait for the server, then warm the routes (first compile is slow).
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${base}r/WARMUP`);
      if (r.ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error(`next did not start:\n${nextLog}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  return { base, close: async () => void next.kill('SIGTERM') };
}

/** Prefer a preinstalled Chromium (cloud containers ship one); otherwise Playwright's (`npx playwright install chromium`). */
export async function launchChromium(): Promise<Browser> {
  const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}
