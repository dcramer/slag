/**
 * `pnpm test:store`: the production store path against real Redis behind SRH.
 * Starts compose.store.yml, runs tests/store, and tears it down. With SRH_URL
 * set (CI service containers) it uses that instead of starting anything.
 *
 *   pnpm test:store                                  store and handler suite
 *   pnpm test:store -- --browser pick,run,leave      then real browsers on the same store
 */
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const browser = argv.includes('--browser') ? argv[argv.indexOf('--browser') + 1] : null;
const external = !!process.env.SRH_URL;
const url = process.env.SRH_URL ?? 'http://127.0.0.1:8079';
const token = process.env.SRH_TOKEN ?? 'slag_local_token';

function run(cmd: string, args: string[], env: Record<string, string> = {}): number {
  return spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;
}

const compose = (...args: string[]) => run('docker', ['compose', '-f', 'compose.store.yml', '-p', 'slag-store', ...args]);

async function waitForSrh() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${url}/`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '["PING"]' });
      if (r.ok) return;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`SRH did not answer at ${url}`);
}

let status = 1;
try {
  if (!external && compose('up', '-d', '--wait', 'redis') !== 0) throw new Error('could not start Redis: is Docker running?');
  if (!external && compose('up', '-d', 'srh') !== 0) throw new Error('could not start SRH');
  await waitForSrh();
  const env = { SRH_URL: url, SRH_TOKEN: token };
  status = run('pnpm', ['exec', 'vitest', 'run', '--mode', 'store'], env);
  if (status === 0 && browser) status = run('pnpm', ['exec', 'tsx', 'tools/online-test.ts', '--only', browser, '--store', 'srh'], env);
} finally {
  if (!external) compose('down', '-v');
}
process.exit(status);
