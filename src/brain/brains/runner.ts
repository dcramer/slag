import { Rng } from '../../core/rng';
import { Grudges } from '../grudge';
import type { Personality } from '../personality';
import type { Temperament } from '../temperament';
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
 * over before carrying the part to its spot. A bot's pace (its personality)
 * scales them: a Hard bot is quick. Before a spiteful placement it eyes its
 * target's cursor a while (`glare`, at any pace), so the target sees it coming.
 */
const TEMPO = {
  read: [80, 150],
  looks: [1, 2],
  /** Per card pointed at, from setting off toward it. */
  look: [45, 80],
  survey: [60, 130],
  glare: [70, 110],
} as const satisfies Record<string, readonly [number, number]>;

/** Spots tried when looking for somewhere to put a part, and how many of the legal ones are checked for sealing the level. */
const SPOT_TRIES = 400;
const SPOT_CHECKS = 16;
/** Cells of a trail tried for a trap, and how many legal spots among them are checked for sealing the level. */
const TRAP_CELLS = 24;
const TRAP_CHECKS = 6;
/** Origins tried around a trail cell, so a part wider than a cell still covers it. */
const AROUND = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;
/** A death counts this many frames of standing there: where someone died is where a trap goes. */
const DEATH_WEIGHT = 240;

type Place = Extract<Intent, { do: 'place' }>;
/** Cell (y * w + x) → frames spent there, deaths weighted. */
type Trail = Map<number, number>;

/** This round's plan against the table: who it's out to get, and whether it's just making trouble. */
interface Scheme {
  target: number;
  mischief: boolean;
  /** It does it well: the spot that hurts most, still leaving a way through. */
  sharp: boolean;
}

const NO_SCHEME: Scheme = { target: -1, mischief: false, sharp: false };

/**
 * The built-in brain: runs the route to the flag; with no way on, it jumps
 * for it anyway, and gives up when even that gets it nowhere. A bridge the
 * level's plan needs goes where the plan puts it, anything else somewhere
 * legal that doesn't seal the level, unless it has it in for someone
 * (grudge.ts, by its temperament): then it may snatch the card its target
 * is pointing at or take a hazard, eye the target's cursor, and put the
 * hazard where the target ran or died last race. Its spite trait decides
 * how often it acts on a grudge and how well. It remembers only what it saw
 * happen since its seat came to this machine.
 */
export function runnerBrain(seed: number, traits: Personality, mood: Temperament): Brain {
  const rng = new Rng(seed);
  const slow = ([lo, hi]: readonly [number, number]) => Math.round(rng.int(lo, hi) * traits.pace);
  const grudges = new Grudges(mood);
  let phase = '';
  let card = -1;
  let spot: Place | null = null;
  let pause = 0;
  /** Cards still to point at before taking `card`, and the phase frame it moves on from the current one. */
  let looks: number[] = [];
  let lookUntil = 0;
  let best = Infinity;
  /** The closest it has been the rough way while no route covered it: getting closer that way is progress too. */
  let near = Infinity;
  let since = 0;
  let scheme = NO_SCHEME;
  /** Place: the phase frame it stops eyeing its target. */
  let glareUntil = 0;
  /** Where each seat ran in the last race, its own included. */
  let trails: Record<number, Trail> = {};
  const alive: Record<number, boolean> = {};
  /** The last race's parts and kills, as it last saw them, for the slights they hold. */
  let raced: BrainView | null = null;

  const tread = (slot: number, cell: number, frames: number) => {
    const t = (trails[slot] ??= new Map());
    t.set(cell, (t.get(cell) ?? 0) + frames);
  };

  /** The race is over: cool off, then take what it did to heart. */
  const reckon = (v: BrainView) => {
    grudges.cool();
    for (const k of v.kills) if (k.victim === v.slot && k.killer !== v.slot && k.killer >= 0) grudges.feel(k.killer, 'kill');
    const mine = trails[v.slot];
    if (mine) for (const pr of v.props) if (pr.owner >= 0 && pr.owner !== v.slot && pr.noGo.some((c) => mine.has(c))) grudges.feel(pr.owner, 'route');
  };

  /** A new round: who leads, and what it means to do about everything. */
  const plot = (v: BrainView): Scheme => {
    const top = Math.max(v.score, ...v.rivals.map((r) => r.score));
    for (const r of v.rivals) if (r.score === top && top > v.score) grudges.feel(r.slot, 'lead');
    const target = grudges.target(v.rivals.map((r) => r.slot));
    const sharp = rng.chance(traits.spite);
    if (target >= 0 && rng.chance(traits.spite)) return { target, mischief: false, sharp };
    return { target: -1, mischief: rng.chance(mood.mischief), sharp };
  };

  const pick = (v: BrainView): Intent => {
    if (v.claim >= 0) return { do: 'wait' };
    if (card >= 0 && v.crate[card]?.claimed) {
      const by = v.crate[card].by;
      if (by !== v.slot && !looks.length && v.phaseFrame >= pause) grudges.feel(by, 'snatch');
      card = -1;
    }
    if (card < 0) {
      const free = v.crate.flatMap((c, i) => (c.claimed ? [] : [i]));
      if (!free.length) return { do: 'wait' };
      card = choose(v, free);
      const others = rng.shuffle(free.filter((i) => i !== card));
      looks = others.slice(0, rng.int(...TEMPO.looks));
    }
    if (v.phaseFrame < pause) return { do: 'wait' };
    while (looks.length && v.phaseFrame >= lookUntil) {
      if (lookUntil) looks.shift();
      lookUntil = v.phaseFrame + slow(TEMPO.look);
      if (!looks.length) break;
    }
    if (looks.length) return { do: 'hover', card: looks[0] };
    // Out for someone: go for whatever they're pointing at, before they take it.
    const them = scheme.target >= 0 ? v.rivals.find((r) => r.slot === scheme.target) : undefined;
    if (them && them.hover >= 0 && !v.crate[them.hover].claimed && !lastOne(v, card)) card = them.hover;
    return { do: 'pick', card };
  };

  /** The card it means to take from `free`. */
  const choose = (v: BrainView, free: number[]): number => {
    const sensible = free.find((i) => (v.level.plan.length > 0 && v.crate[i].bridge) || v.crate[i].clears);
    const hazards = free.filter((i) => v.crate[i].role === 'hazard');
    if (scheme.mischief) return hazards.length ? rng.pick(hazards) : rng.pick(free);
    // Spite never takes the last way through: with nobody finishing, nobody scores, its target included.
    if (scheme.target >= 0 && hazards.length && (sensible === undefined || !lastOne(v, sensible))) return rng.pick(hazards);
    return sensible ?? rng.pick(free);
  };

  const place = (v: BrainView): Intent => {
    if (v.placed || v.claim < 0) return { do: 'wait' };
    if (v.phaseFrame < pause) return { do: 'wait' };
    const hazard = v.crate[v.claim]?.role === 'hazard';
    const them = scheme.target >= 0 && hazard ? v.rivals.find((r) => r.slot === scheme.target) : undefined;
    if (them?.cursor && v.phaseFrame < glareUntil) return { do: 'aim', ...them.cursor };
    // Someone may have put a part where it meant to go: look again whenever that spot stops being free.
    if (!spot || !v.canPlace(spot.tx, spot.ty, spot.rot)) {
      const trail = them ? trails[them.slot] : scheme.mischief && hazard ? everyone() : undefined;
      spot = (trail && trap(v, trail, passed, scheme.sharp, rng)) || findSpot(v, rng);
    }
    return spot ?? { do: 'wait' };
  };

  /** How many seats ran through `cell` last race: a cell everyone needed is one nobody gets round. */
  const passed = (cell: number) => Object.values(trails).filter((t) => t.has(cell)).length;

  /** Every seat's trail at once: a gremlin's hazard goes wherever anybody ran. */
  const everyone = (): Trail => {
    const all: Trail = new Map();
    for (const t of Object.values(trails)) for (const [c, n] of t) all.set(c, (all.get(c) ?? 0) + n);
    return all;
  };

  const race = (v: BrainView): Intent => {
    const me = v.self;
    if (v.live) {
      const w = v.level.w;
      const cell = (x: number, y: number) => (Math.ceil(y) - 1) * w + Math.floor(x);
      for (const r of v.runners) {
        if (r.alive && !r.finished) tread(r.slot, cell(r.x, r.y), 1);
        else if (!r.alive && alive[r.slot]) tread(r.slot, cell(r.x, r.y), DEATH_WEIGHT);
        alive[r.slot] = r.alive;
      }
      if (me) {
        if (me.alive && !me.finished) tread(v.slot, cell(me.x, me.y), 1);
        else if (!me.alive && alive[v.slot]) tread(v.slot, cell(me.x, me.y), DEATH_WEIGHT);
        alive[v.slot] = me.alive;
      }
    }
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
        // The race is over (the score screen still shows it): take it to heart once, as it last stood.
        if (raced && v.phase !== 'run' && v.phase !== 'score') {
          reckon(raced);
          raced = null;
        }
        phase = v.phase;
        card = -1;
        spot = null;
        best = Infinity;
        near = Infinity;
        since = 0;
        // A beat before choosing, as a person takes in the crate or the level.
        pause = v.phase === 'pick' ? slow(TEMPO.read) : v.phase === 'place' ? slow(TEMPO.survey) : 0;
        looks = [];
        lookUntil = 0;
        if (v.phase === 'pick') scheme = plot(v);
        // A tell is a tell at any pace: a quick bot glares as long as a slow one.
        if (v.phase === 'place') glareUntil = pause + rng.int(...TEMPO.glare);
        if (v.phase === 'run') {
          trails = {};
          for (const k of Object.keys(alive)) delete alive[+k];
        }
        if (v.phase === 'lobby') scheme = NO_SCHEME;
      }
      switch (v.phase) {
        case 'lobby':
          return { do: 'ready' };
        case 'pick':
          return pick(v);
        case 'place':
          return place(v);
        case 'run':
          raced = v;
          return race(v);
        case 'score':
          raced = v;
          return { do: 'wait' };
        default:
          return { do: 'wait' };
      }
    },
  };
}

/** `i` is the only free card left that builds a way or clears one: taking anything else would leave nobody to. */
function lastOne(v: BrainView, i: number): boolean {
  const c = v.crate[i];
  if (!c || !(c.bridge || c.clears) || (!v.level.plan.length && !c.clears)) return false;
  return v.crate.filter((x) => !x.claimed && (x.bridge || x.clears)).length <= 1;
}

/**
 * A spot on `trail` for the held part. Sharp, it tries where the trail spent
 * longest (a death most of all) and where its own trail didn't go, and keeps
 * a way through; clumsy, it takes the first legal spot on cells drawn at random.
 */
function trap(v: BrainView, trail: Trail, passed: (cell: number) => number, sharp: boolean, rng: Rng): Place | null {
  const w = v.level.w;
  const weigh = (c: number, n: number) => Math.min(n, 60) * (1 + passed(c)) + (n >= DEATH_WEIGHT ? DEATH_WEIGHT : 0);
  const cells = sharp ? [...trail].sort((a, b) => weigh(b[0], b[1]) - weigh(a[0], a[1]) || a[0] - b[0]) : rng.shuffle([...trail]);
  let checks = 0;
  for (const [c] of cells.slice(0, TRAP_CELLS)) {
    const turn = rng.int(0, 3);
    for (const [dx, dy] of AROUND)
      for (let r = 0; r < 4; r++) {
        const s: Place = { do: 'place', tx: (c % w) - dx, ty: Math.floor(c / w) - dy, rot: (turn + r) % 4 };
        if (!v.canPlace(s.tx, s.ty, s.rot)) continue;
        if (!sharp) return s;
        if (v.keepsWay(s.tx, s.ty, s.rot)) return s;
        if (++checks >= TRAP_CHECKS) return null;
      }
  }
  return null;
}

/** Where the held part goes: on the plan if it's a bridge the plan needs, else a legal spot that leaves the level a way through. */
function findSpot(v: BrainView, rng: Rng): Place | null {
  const held = v.crate[v.claim];
  if (held?.bridge) for (const b of v.level.plan) if (v.canPlace(b.tx, b.ty, 0)) return { do: 'place', tx: b.tx, ty: b.ty, rot: 0 };
  const legal: Place[] = [];
  for (let i = 0; i < SPOT_TRIES && legal.length < SPOT_CHECKS; i++) {
    const s = { do: 'place' as const, tx: rng.int(1, v.level.w - 2), ty: rng.int(1, v.level.h - 2), rot: rng.int(0, 3) };
    if (v.canPlace(s.tx, s.ty, s.rot)) legal.push(s);
  }
  return legal.find((s) => v.keepsWay(s.tx, s.ty, s.rot)) ?? legal[0] ?? null;
}
