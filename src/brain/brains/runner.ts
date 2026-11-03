import { Rng } from '../../core/rng';
import type { Brain, BrainView, Intent } from '../types';

/** Seconds a race may go without getting closer to the flag before it gives up, as a stuck player would. */
const STUCK_FRAMES = 12 * 60;
/** Spots tried when looking for somewhere to put a part, and how many of the legal ones are checked for sealing the level. */
const SPOT_TRIES = 400;
const SPOT_CHECKS = 16;

/**
 * The plain built-in brain: runs the route to the flag and gives up when it
 * stops getting closer. Its picks and placements are only sensible: a
 * bridge the level's plan needs goes where the plan puts it, anything else
 * goes somewhere legal that doesn't seal the level. Taste and spite are
 * the next phase (docs/TODO.md 27).
 */
export function runnerBrain(seed: number): Brain {
  const rng = new Rng(seed);
  let phase = '';
  let card = -1;
  let spot: Extract<Intent, { do: 'place' }> | null = null;
  let pause = 0;
  let best = Infinity;
  let since = 0;

  const pick = (v: BrainView): Intent => {
    if (v.claim >= 0) return { do: 'wait' };
    if (card < 0 || v.crate[card]?.claimed) {
      const free = v.crate.flatMap((c, i) => (c.claimed ? [] : [i]));
      if (!free.length) return { do: 'wait' };
      const want = free.find((i) => (v.level.plan.length > 0 && v.crate[i].bridge) || v.crate[i].clears);
      card = want ?? rng.pick(free);
    }
    return v.phaseFrame < pause ? { do: 'wait' } : { do: 'pick', card };
  };

  const place = (v: BrainView): Intent => {
    if (v.placed || v.claim < 0) return { do: 'wait' };
    if (!spot) spot = findSpot(v, rng);
    return spot && v.phaseFrame >= pause ? spot : { do: 'wait' };
  };

  const race = (v: BrainView): Intent => {
    const me = v.self;
    if (!v.live || !me || !me.alive || me.finished) return { do: 'wait' };
    if (me.togo < best) {
      best = me.togo;
      since = 0;
    } else if (++since > STUCK_FRAMES) return { do: 'giveUp' };
    return { do: 'goTo', tx: v.level.goal.tx, ty: v.level.goal.ty };
  };

  return {
    think(v) {
      if (v.phase !== phase) {
        phase = v.phase;
        card = -1;
        spot = null;
        best = Infinity;
        since = 0;
        // A beat before choosing, as a person takes in the crate or the level.
        pause = rng.int(20, 60);
      }
      switch (v.phase) {
        case 'lobby':
          return { do: 'ready' };
        case 'pick':
          return pick(v);
        case 'place':
          return place(v);
        case 'run':
          return race(v);
        default:
          return { do: 'wait' };
      }
    },
  };
}

/** Where the held part goes: on the plan if it's a bridge the plan needs, else a legal spot that leaves the level a way through. */
function findSpot(v: BrainView, rng: Rng): Extract<Intent, { do: 'place' }> | null {
  const held = v.crate[v.claim];
  if (held?.bridge) for (const b of v.level.plan) if (v.canPlace(b.tx, b.ty, 0)) return { do: 'place', tx: b.tx, ty: b.ty, rot: 0 };
  const legal: Extract<Intent, { do: 'place' }>[] = [];
  for (let i = 0; i < SPOT_TRIES && legal.length < SPOT_CHECKS; i++) {
    const s = { do: 'place' as const, tx: rng.int(1, v.level.w - 2), ty: rng.int(1, v.level.h - 2), rot: rng.int(0, 3) };
    if (v.canPlace(s.tx, s.ty, s.rot)) legal.push(s);
  }
  return legal.find((s) => v.keepsWay(s.tx, s.ty, s.rot)) ?? legal[0] ?? null;
}
