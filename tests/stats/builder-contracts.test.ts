import { describe, expect, it } from 'vitest';
import { BUILDERS } from '../../src/gen/level/builders';
import { CONTRACTED, eachFaults, everySet, summary, sweepFaults } from '../lib/builder-contract';

/**
 * Every builder's contract (`BuilderDef.contract`) over a dozen seeds of every set: each level's promises, and the
 * shares over each set's levels and all of them. The rotation is tests/conformance/builders.test.ts.
 */
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe('every builder keeps its contract over many levels', () => {
  for (const id of CONTRACTED)
    describe(id, () => {
      const contract = BUILDERS[id].contract!;
      const bySet = everySet(id, () => SEEDS);
      console.log(summary(id, bySet));
      it('every level keeps its promises', () => expect(bySet.flat().flatMap((b) => eachFaults(contract, b))).toEqual([]));
      it('each set’s levels, and all of them, keep the shares', () => expect(sweepFaults(contract, bySet)).toEqual([]));
    });
});
