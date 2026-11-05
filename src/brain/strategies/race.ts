import { aimOf, Headway } from './headway';
import { ItemPlay } from './items';
import type { StrategyDef } from './types';

/**
 * Race: run the route to the flag, using what it holds when that helps and fetching what's near the way; with no
 * way on, jump for it anyway, and give up when even that gets it nowhere, as a stuck player would.
 */
export const raceStrategy: StrategyDef = {
  make(rng, traits) {
    const way = new Headway();
    const items = new ItemPlay(rng, traits);
    return {
      think(v, me) {
        const side = items.think(v, me, way.stalled());
        if (side) {
          if (items.away) way.calm();
          return side;
        }
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
