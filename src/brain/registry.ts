import { runnerBrain } from './brains/runner';
import type { BrainDef } from './types';

/** Every built-in brain. Add one here; seats pick from it by id. */
export const BRAINS = {
  runner: { label: 'Runner', make: runnerBrain },
} satisfies Record<string, BrainDef>;

export type BrainId = keyof typeof BRAINS;
