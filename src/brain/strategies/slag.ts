import { aimOf, Headway } from './headway';
import type { StrategyDef } from './types';

/** How much further the route gets at once for a bot to take it as a loop's lap line crossed (route tiles, rounded as `togo` is). */
const LAP_RESET = 8;

/**
 * Rising Slag: climb. Round a loop the objective is the lap line, and crossing it puts the whole climb ahead again,
 * which is a new lap, not a loss. With no loop the top is somewhere to hold: stand on it. A stuck bot leaps and
 * tries again; it never gives up into the slag.
 */
export const slagStrategy: StrategyDef = {
  make() {
    const way = new Headway();
    return {
      think(v, me) {
        if (Number.isFinite(me.togo) && Number.isFinite(way.best) && me.togo > way.best + LAP_RESET) way.restart(me.togo);
        way.note(me);
        if (me.togo === 0) {
          way.calm();
          return { do: 'wait' };
        }
        if (way.leapt(me)) way.calm();
        const { tx, ty } = aimOf(v.objective);
        return way.stage(me) === 'leap' ? { do: 'leap', tx, ty } : { do: 'goTo', tx, ty };
      },
    };
  },
};
