/**
 * Update the committed snapshot wire shape (src/net/snapshot-shape.json) from real snapshots, so a branch that
 * changes what crosses the wire says so in a file `pnpm land` watches (tests/lib/snapshot-shape.ts).
 *
 *   pnpm snap:shape           add what the live snapshots carry that the file hasn't seen, and print it
 *   pnpm snap:shape --check   print it and exit 1 if there is any; write nothing
 *   pnpm snap:shape --prune   rewrite the file as the live shape exactly, dropping paths no sample reaches
 *                             (after removing a field: the file otherwise only grows)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { mergeShapes, readShape, SHAPE_FILE, shapeText, snapshotShape, unseen } from '../tests/lib/snapshot-shape';
import { argReader } from './lib/server';

const args = argReader(process.argv.slice(2));
const check = args.flag('check');
const prune = args.flag('prune');

let text = '';
try {
  text = readFileSync(SHAPE_FILE, 'utf8');
} catch {
  // No file yet: every path is new.
}
const was = readShape(text);
const t = performance.now();
const cpu = process.cpuUsage();
const now = snapshotShape();
const used = process.cpuUsage(cpu);
const added = unseen(was, now);
const dropped = prune ? Object.keys(was).filter((p) => !(p in now)) : [];
console.log(
  `snap:shape: ${Object.keys(now).length} paths in ${(performance.now() - t).toFixed(0)} ms (${((used.user + used.system) / 1000).toFixed(0)} ms of CPU)`,
);
for (const line of added) console.log(`  + ${line}`);
for (const p of dropped) console.log(`  - ${p}: ${was[p]}`);
const next = shapeText(prune ? now : mergeShapes(was, now));
if (check) {
  if (added.length) process.exitCode = 1;
  else console.log('snap:shape: nothing new');
} else if (next === text) console.log('snap:shape: nothing new');
else {
  writeFileSync(SHAPE_FILE, next);
  console.log(`snap:shape: wrote ${SHAPE_FILE}. Commit it; leave SNAP_VERSION alone in a branch, \`pnpm land\` bumps it.`);
}
