import type { Cell, Objective, SelfSense } from '../types';

/**
 * A race that stops getting closer to its objective (by its route, or the rough way where no route leads):
 * after STUCK_FRAMES (LOST_FRAMES standing where no route leads at all) it takes a leap of faith toward
 * it for LEAP_FRAMES, and if that gets it nowhere, it's spent LAST_FRAMES later, as a stuck player would be.
 */
const STUCK_FRAMES = 6 * 60;
const LOST_FRAMES = 4 * 60;
const LEAP_FRAMES = 120;
const LAST_FRAMES = 120;

/** Where a strategy is with getting on: going by the route, leaping for it, or out of ideas. */
export type Stage = 'go' | 'leap' | 'spent';

/** The cell `togo` and `away` measure to. */
export const aimOf = (o: Objective): Cell => (o.kind === 'climb' ? o.lapLine : o.cell);

/** How a race is getting on, frame by frame: what every mode's strategy reads to know it's stuck. */
export class Headway {
  /** The closest it has been by route. */
  best = Infinity;
  /** The closest it has been the rough way while no route covered it: getting closer that way is progress too. */
  private near = Infinity;
  /** Frames since it last got closer. */
  private since = 0;

  /** The whole route is ahead again (a lap carried on): count from here. */
  restart(togo: number): void {
    this.best = togo;
    this.since = 0;
  }

  /** It's where it means to be, or has given up a leap that went nowhere: no longer stuck. */
  calm(): void {
    this.since = 0;
  }

  /** This frame's look at how close it is. */
  note(me: SelfSense): void {
    if (me.togo < this.best) {
      this.best = me.togo;
      this.since = 0;
    } else if (!Number.isFinite(me.togo) && me.grounded && me.away < this.near) {
      this.near = me.away;
      this.since = 0;
    } else this.since++;
  }

  /** Frames of no progress it puts up with before leaping. */
  private patience(me: SelfSense): number {
    return me.grounded && !Number.isFinite(me.togo) ? LOST_FRAMES : STUCK_FRAMES;
  }

  /** A leap went nowhere: past the leap it's out of ideas. */
  leapt(me: SelfSense): boolean {
    return this.since > this.patience(me) + LEAP_FRAMES;
  }

  /** Stuck for a while, it leaps; stuck through the leap too, it's spent. */
  stage(me: SelfSense): Stage {
    const wait = this.patience(me);
    if (this.since > wait + LEAP_FRAMES + LAST_FRAMES) return 'spent';
    if (this.since > wait && this.since <= wait + LEAP_FRAMES) return 'leap';
    return 'go';
  }

  /** It hasn't got closer for a while (not yet leaping): worth trying something else. */
  stalled(): boolean {
    return this.since > STALL_FRAMES;
  }
}

/** Frames of no progress after which a bot counts as stalled: time to reach for its item. */
const STALL_FRAMES = 90;
