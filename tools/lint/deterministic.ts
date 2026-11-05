/**
 * The code every peer runs identically: the sim, the generators, the match, and the net code that feeds or hashes
 * it. Lint holds these files to the determinism rules (tools/lint/config.ts) and tests/determinism-ban.test.ts
 * bans `**` in them, which lint can't see.
 */
export const DETERMINISTIC = [
  'src/sim/**/*.ts',
  'src/gen/**/*.ts',
  'src/game/**/*.ts',
  'src/themes.ts',
  'src/core/**/*.ts',
  'src/net/actions.ts',
  'src/net/codec.ts',
  'src/net/snapshot.ts',
];
