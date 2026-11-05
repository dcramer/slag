import { aimOf, Headway } from './headway';
import type { StrategyDef } from './types';

/**
 * Race: run the route to the flag; with no way on, jump for it anyway, and give up when even that gets it nowhere,
 * as a stuck player would.
 */
export const raceStrategy: StrategyDef = {
  make() {
    const way = new Headway();
    return {
      think(v, me) {
        way.note(me);
        const { tx, ty } = aimOf(v.objective);
        const stage = way.stage(me);
        if (stage === 'spent') return { do: 'giveUp' };
        if (stage === 'leap') return { do: 'leap', tx, ty };
        return { do: 'goTo', tx, ty };
      },
    };
  },
};
