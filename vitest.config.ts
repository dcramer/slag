import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Suites are split by what they check. `pnpm test` is behavior and invariants at fixed small seed
 * counts. `pnpm test:stats` (`tests/stats`) measures distributions and balance over many seeds, which
 * takes minutes, so it isn't part of `pnpm check`. `tests/store` needs Docker and runs only through
 * `pnpm test:store`.
 */
export default defineConfig(({ mode }) => {
  const exclude = [...configDefaults.exclude, '.claude/**', 'shots/**'];
  if (mode === 'store') return { test: { exclude, include: ['tests/store/**/*.test.ts'] } };
  if (mode === 'stats') return { test: { exclude, include: ['tests/stats/**/*.test.ts'], testTimeout: 180_000 } };
  exclude.push('tests/store/**', 'tests/stats/**');
  return { test: { exclude, testTimeout: 30_000 } };
});
