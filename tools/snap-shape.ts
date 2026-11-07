/**
 * Regenerate the committed snapshot wire shape (src/net/snapshot-shape.json) from real snapshots, so a branch
 * that changes what crosses the wire says so in a file `pnpm land` watches (tests/lib/snapshot-shape.ts).
 *
 *   pnpm snap:shape           write the file and print what changed
 *   pnpm snap:shape --check   print what changed and exit 1 if anything did; write nothing
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { SHAPE_FILE, type SnapShape, shapeDiff, shapeText, snapshotShape } from '../tests/lib/snapshot-shape';

const args = process.argv.slice(2);
for (const a of args) if (a !== '--check') throw new Error(`Unknown option ${a}. Options: --check.`);
const check = args.includes('--check');

let was: SnapShape = {};
try {
  was = JSON.parse(readFileSync(SHAPE_FILE, 'utf8')) as SnapShape;
} catch {
  // No file yet: every path is new.
}
const t = performance.now();
const now = snapshotShape();
const diff = shapeDiff(was, now);
console.log(`snap:shape: ${Object.keys(now).length} paths in ${(performance.now() - t).toFixed(0)} ms`);
for (const line of diff) console.log(`  ${line}`);
if (!diff.length) console.log('snap:shape: unchanged');
else if (check) process.exit(1);
else {
  writeFileSync(SHAPE_FILE, shapeText(now));
  console.log(`snap:shape: wrote ${SHAPE_FILE}. Commit it; leave SNAP_VERSION alone in a branch, \`pnpm land\` bumps it.`);
}
