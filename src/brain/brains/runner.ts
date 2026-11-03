import { Rng } from '../../core/rng';
import type { Brain, BrainView, Intent } from '../types';

/**
 * A race that stops getting closer to the flag (by its route, or the rough way where no route leads):
 * after STUCK_FRAMES (LOST_FRAMES standing where no route leads at all) it takes a leap of faith toward
 * the flag for LEAP_FRAMES, and if that gets it nowhere, gives up LAST_FRAMES later, as a stuck player would.
 */
const STUCK_FRAMES = 6 * 60;
const LOST_FRAMES = 4 * 60;
const LEAP_FRAMES = 120;
const LAST_FRAMES = 120;
/**
 * How long it takes over each choice, in frames [min, max]: a person reads the
 * crate and points at a card or two before taking one, then looks the level
 * over before carrying the part to its spot. A harder setting will shorten
 * these (docs/TODO.md 27, phase 2).
 */
const TEMPO = {
  read: [80, 150],
  looks: [1, 2],
  /** Per card pointed at, from setting off toward it. */
  look: [45, 80],
  survey: [60, 130],
} as const satisfies Record<string, readonly [number, number]>;

/** Spots tried when looking for somewhere to put a part, and how many of the legal ones are checked for sealing the level. */
const SPOT_TRIES = 400;
const SPOT_CHECKS = 16;

/**
 * The plain built-in brain: runs the route to the flag; with no way on, it
 * jumps for it anyway, and gives up when even that gets it nowhere. Its picks and placements are only sensible: a
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
  /** Cards still to point at before taking `card`, and the phase frame it moves on from the current one. */
  let looks: number[] = [];
  let lookUntil = 0;
  let best = Infinity;
  /** The closest it has been the rough way while no route covered it: getting closer that way is progress too. */
  let near = Infinity;
  let since = 0;

  const pick = (v: BrainView): Intent => {
    if (v.claim >= 0) return { do: 'wait' };
    if (card < 0 || v.crate[card]?.claimed) {
      const free = v.crate.flatMap((c, i) => (c.claimed ? [] : [i]));
      if (!free.length) return { do: 'wait' };
      const want = free.find((i) => (v.level.plan.length > 0 && v.crate[i].bridge) || v.crate[i].clears);
      card = want ?? rng.pick(free);
      const others = rng.shuffle(free.filter((i) => i !== card));
      looks = others.slice(0, rng.int(...TEMPO.looks));
    }
    if (v.phaseFrame < pause) return { do: 'wait' };
    while (looks.length && v.phaseFrame >= lookUntil) {
      if (lookUntil) looks.shift();
      lookUntil = v.phaseFrame + rng.int(...TEMPO.look);
      if (!looks.length) break;
    }
    return looks.length ? { do: 'hover', card: looks[0] } : { do: 'pick', card };
  };

  const place = (v: BrainView): Intent => {
    if (v.placed || v.claim < 0) return { do: 'wait' };
    // Someone may have put a part where it meant to go: look again whenever that spot stops being free.
    if (!spot || !v.canPlace(spot.tx, spot.ty, spot.rot)) spot = findSpot(v, rng);
    return spot && v.phaseFrame >= pause ? spot : { do: 'wait' };
  };

  const race = (v: BrainView): Intent => {
    const me = v.self;
    if (!v.live || !me || !me.alive || me.finished) return { do: 'wait' };
    if (me.togo < best) {
      best = me.togo;
      since = 0;
    } else if (!Number.isFinite(me.togo) && me.grounded && me.away < near) {
      near = me.away;
      since = 0;
    } else since++;
    const wait = me.grounded && !Number.isFinite(me.togo) ? LOST_FRAMES : STUCK_FRAMES;
    const { tx, ty } = v.level.goal;
    if (since > wait + LEAP_FRAMES + LAST_FRAMES) return { do: 'giveUp' };
    if (since > wait && since <= wait + LEAP_FRAMES) return { do: 'leap', tx, ty };
    return { do: 'goTo', tx, ty };
  };

  return {
    think(v) {
      if (v.phase !== phase) {
        phase = v.phase;
        card = -1;
        spot = null;
        best = Infinity;
        near = Infinity;
        since = 0;
        // A beat before choosing, as a person takes in the crate or the level.
        pause = v.phase === 'pick' ? rng.int(...TEMPO.read) : v.phase === 'place' ? rng.int(...TEMPO.survey) : 0;
        looks = [];
        lookUntil = 0;
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
