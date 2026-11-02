/**
 * Two test tiers over the same files, so a suite never forks into a "real" copy and a "smoke" copy.
 *
 * `pnpm test` (part of `pnpm check`) runs every file at its small sample: each invariant still
 * executes, on a few seeds, which catches a generator that is simply broken. `pnpm test:slow`
 * (see vitest.config.ts) re-runs the heavy files at full size, and that is the tier that can catch
 * a rare failing seed or a drifting distribution. Assertions about a distribution need the full
 * sample to mean anything, so guard those with `SLOW` instead of scaling their thresholds.
 */
export const SLOW = process.env.SLAG_TEST_TIER === 'slow';

/** Sample size for the current tier. */
export const sample = (fast: number, slow: number): number => (SLOW ? slow : fast);
