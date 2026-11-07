import { deriveSeed, Rng } from '../core/rng';
import { DT, RUN_COUNTDOWN, TILE } from './constants';
import { dealFor, giveItem, type ItemDeal, type ItemKind, spawnItem } from './items';
import type { Runner, RunWorld } from './run';
import { screenEdges } from './screen';
import { behindOf } from './standing';

/**
 * Hand-Me-Downs (Rising Slag, docs/MODES.md → Rising Slag, 11): a climber far behind the leader with nothing in hand
 * gets a parcel dropped in from the top of the screen, and whatever it holds is theirs when it lands on them. Boxes
 * put one or two items a round in anyone's hands, and catch-up is what's in chasers' hands (owner decision: "Add items,
 * no boxes"). Who is behind is the standing order's call (sim/standing.ts `behindOf`), never a height read here.
 *
 * A parcel falls through everything, as the Upper Hand rises through floors, and follows its climber across, so it
 * always arrives: it isn't a pickup to chase but a hand-off you watch coming.
 */
export interface ParcelRules {
  /** Rows behind the leader (`behindOf`) a climber has to be to be owed one. */
  rows: number;
  /** Frames on end a climber has to be that far behind, hands empty, before one is dropped. */
  wait: number;
  /** Frames after one lands before the same climber is owed another. */
  rest: number;
  /** Frames after GO before the first: the race's opening is a climb, not a hand-out. */
  after: number;
  /** What it holds: drawn as a chaser that far behind draws from a box (`dealFor`), so the far-behind tables. */
  deal: ItemDeal;
}

/** A parcel on its way down to `target`. */
export interface Parcel {
  /** Runner index it's for. */
  target: number;
  kind: ItemKind;
  /** Middle across (world px) and bottom (climbed world y, as sim/run.ts `feetUp` reads feet: laps taken off). */
  x: number;
  y: number;
  /** Falling speed (px/s). */
  vy: number;
  born: number;
}

/** The hand-outs' state, plain data on the RunWorld (a snapshot carries it). */
export interface Parcels {
  /** Frames each runner (by index) has been owed one on end: far enough behind, hands empty, nothing on its way. */
  owed: number[];
  /** Frame each runner may be owed another from. */
  ready: number[];
  falling: Parcel[];
}

/** The parcel's box, half its size (px): what the art draws and what lands on a head. */
export const PARCEL_HALF = 7;
/** How it falls: starting speed, gravity and the fastest (px/s), faster than any runner falls so it always catches up. */
const FALL = { start: 120, gravity: 900, max: 760 };
/** Share of the way across to its climber's middle it moves a frame. */
const FOLLOW = 0.18;
/** Rows over the climber's head it starts from without a leader's screen to come in from the top of. */
const DROP_ROWS = 20;

export function newParcels(runners: number): Parcels {
  return { owed: new Array<number>(runners).fill(0), ready: new Array<number>(runners).fill(0), falling: [] };
}

const active = (r: Runner) => r.alive && !r.finished;
const loopPx = (race: RunWorld) => (race.level.loop ?? 0) * TILE;
/** Top of `r`'s head in climbed coordinates. */
const headUp = (race: RunWorld, r: Runner) => r.body.y - r.lap * loopPx(race);
const mid = (r: Runner) => r.body.x + r.body.w / 2;

/** Where a parcel for `r` comes in: just over the top of the leader's screen, or `DROP_ROWS` over its head. */
function dropFrom(race: RunWorld, r: Runner): number {
  const s = race.rules.screen;
  if (s && race.screen) return screenEdges(s, race.screen).top - PARCEL_HALF;
  return headUp(race, r) - DROP_ROWS * TILE;
}

function emit(race: RunWorld, what: 'warn' | 'hit' | 'fizzle' | 'pickup', kind: string, r: Runner, x: number, y: number) {
  race.events.push({ type: 'item', what, kind, slot: r.slot, x, y: y + r.lap * loopPx(race) });
}

/** A parcel reaches its climber: into their hands, or out loose beside them if they picked something up on the way. */
function land(race: RunWorld, p: Parcel, r: Runner) {
  const y = headUp(race, r);
  if (r.items.held) spawnItem(race, { kind: p.kind, x: mid(r), y: r.body.y - PARCEL_HALF, vx: 0, vy: -120, grace: 10 });
  else {
    giveItem(r, p.kind);
    emit(race, 'pickup', p.kind, r, mid(r), y);
  }
  emit(race, 'hit', 'parcel', r, mid(r), y);
}

/**
 * One frame of the hand-outs, before anyone moves: parcels fall and follow their climbers, landing on a head; then
 * whoever has been owed one long enough gets one dropped. A parcel whose climber went out is gone.
 */
export function stepParcels(race: RunWorld, rules: ParcelRules, st: Parcels, f: number): void {
  if (st.falling.length) {
    const keep: Parcel[] = [];
    for (const p of st.falling) {
      const r = race.runners[p.target];
      if (!r || !active(r)) {
        if (r) emit(race, 'fizzle', 'parcel', r, p.x, p.y);
        continue;
      }
      p.vy = Math.min(p.vy + FALL.gravity * (race.level.gravity ?? 1) * DT, FALL.max);
      p.y += p.vy * DT;
      p.x += (mid(r) - p.x) * FOLLOW;
      if (p.y >= headUp(race, r)) {
        land(race, p, r);
        st.ready[p.target] = f + rules.rest;
        continue;
      }
      keep.push(p);
    }
    st.falling = keep;
  }
  const live = f >= RUN_COUNTDOWN + rules.after;
  race.runners.forEach((r, i) => {
    const owed = live && active(r) && !r.items.held && f >= st.ready[i] && !st.falling.some((p) => p.target === i) && behindOf(race, r) >= rules.rows;
    if (!owed) return void (st.owed[i] = 0);
    if (++st.owed[i] < rules.wait) return;
    st.owed[i] = 0;
    const pool = dealFor(rules.deal, false, behindOf(race, r));
    const kind = new Rng(deriveSeed(deriveSeed(race.itemSeed, 'parcel'), f * race.runners.length + i)).pick(pool);
    const p: Parcel = { target: i, kind, x: mid(r), y: dropFrom(race, r), vy: FALL.start, born: f };
    st.falling.push(p);
    emit(race, 'warn', 'parcel', r, p.x, p.y);
  });
}
