/**
 * A vitest reporter for `pnpm stats:compare` (tools/stats-compare.ts): writes every test's state, first error and
 * printed lines to the JSON file named by SLAG_STATS_OUT, so two runs of a stats suite can be lined up measure by
 * measure. It is handed to vitest by absolute path, so the base commit's own tree needs no copy of it.
 */

import { writeFileSync } from 'node:fs';
import type { Reporter, TestModule } from 'vitest/node';

/** One test (or a suite's or file's own setup, as `name: ''`) and what it printed. */
export interface StatsCase {
  file: string;
  name: string;
  state: string;
  error?: string;
  ms?: number;
  lines: string[];
}

const lines = (logs: readonly { content: string }[]) => logs.flatMap((l) => l.content.replace(/\n$/, '').split('\n'));

export default class StatsReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
    const out: StatsCase[] = [];
    for (const mod of modules) {
      const file = mod.relativeModuleId;
      const setup = [...lines(mod.logs()), ...[...mod.children.allSuites()].flatMap((s) => lines(s.logs()))];
      const failed = mod.errors()[0]?.message;
      if (setup.length || failed) out.push({ file, name: '', state: failed ? 'failed' : 'passed', error: failed, lines: setup });
      for (const t of mod.children.allTests()) {
        const r = t.result();
        out.push({ file, name: t.fullName, state: r.state, error: r.errors?.[0]?.message, ms: t.diagnostic()?.duration, lines: lines(t.logs()) });
      }
    }
    const to = process.env.SLAG_STATS_OUT;
    if (to) writeFileSync(to, JSON.stringify(out));
  }
}
