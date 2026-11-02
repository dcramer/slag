import { configDefaults, defineConfig } from 'vitest/config';

/**
 * `pnpm test` runs every file at its small sample. `pnpm test:slow` (`--mode slow`) runs the heavy
 * generator and statistical files at full size (see tests/lib/tier.ts). Add a file to `SLOW_FILES`
 * when its full sample is too slow for `pnpm check`.
 */
const SLOW_FILES = ['tests/levelgen.test.ts', 'tests/match.test.ts', 'tests/profile.test.ts', 'tests/routes.test.ts', 'tests/setpieces.test.ts', 'tests/worldgen.test.ts'];

export default defineConfig(({ mode }) => {
  const exclude = [...configDefaults.exclude, '.claude/**', 'shots/**'];
  if (mode === 'slow') return { test: { exclude, include: SLOW_FILES, env: { SLAG_TEST_TIER: 'slow' }, testTimeout: 180_000 } };
  return { test: { exclude, testTimeout: 30_000 } };
});
