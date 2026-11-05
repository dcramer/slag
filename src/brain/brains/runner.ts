import { Rng } from '../../core/rng';
import { Grudges } from '../grudge';
import type { Personality } from '../personality';
import type { Temperament } from '../temperament';
import type { Brain, BrainView, CardSense, Intent } from '../types';

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
/** Frames between spots weighed for a block: each asks the proof again, so it looks the level over a spot at a time. */
const WEIGH_EVERY = 4;
/** Tiles of detour a tight jump is worth when weighing how hard a block makes the run. */
const TIGHT_TILES = 20;
/**
 * Tight jumps a block may add to the run. Past that it would beat the bot too, and a race nobody finishes scores
 * nobody: it makes the run hard for everyone, not impossible.
 */
const TIGHT_ADDED = 1;

type Place = Extract<Intent, { do: 'place' }>;
/** Cell (y * w + x) → frames spent there, deaths weighted. */
type Trail = Map<number, number>;

/** This round's plan against the table: who it's out to get, and whether it's just making trouble. */
interface Scheme {
  target: number;
  mischief: boolean;
  /** It does it well: the spot that hurts most, still leaving a way through. */
  sharp: boolean;
  /** With nobody to get, it still gets in everyone's way. */
  block: boolean;
}

const NO_SCHEME: Scheme = { target: -1, mischief: false, sharp: false, block: false };

/** Spots in the way still to weigh, and the hardest so far. */
interface Weighing {
  left: Place[];
  best: Place | null;
  score: number;
}

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
  let weighing: Weighing | null = null;
  /** Nobody finished the last race: the level is hard enough, and a race nobody finishes scores nobody. */
  let stuck = false;
  /** Someone has finished this race. */
  let anyone = false;
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
    stuck = !anyone;
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
    if (target >= 0 && rng.chance(traits.spite)) return { target, mischief: false, sharp, block: false };
    const mischief = rng.chance(mood.mischief);
    return { target: -1, mischief, sharp, block: !mischief && rng.chance(traits.block) && !stuck };
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
    // Reaching for the bridge, but someone already has the way through in hand: it's free to be mean after all.
    if ((scheme.block || scheme.target >= 0) && builds(v.crate[card]) && covered(v)) {
      const free = v.crate.flatMap((c, i) => (c.claimed ? [] : [i]));
      card = choose(v, free);
    }
    // Out for someone: go for whatever they're pointing at, before they take it.
    const them = scheme.target >= 0 ? v.rivals.find((r) => r.slot === scheme.target) : undefined;
    if (them && them.hover >= 0 && !v.crate[them.hover].claimed && !(builds(v.crate[card]) && !covered(v))) card = them.hover;
    return { do: 'pick', card };
  };

  /** The card it means to take from `free`. */
  const choose = (v: BrainView, free: number[]): number => {
    const sensible = free.find((i) => (v.level.plan.length > 0 && v.crate[i].bridge) || v.crate[i].clears);
    const hazards = free.filter((i) => v.crate[i].role === 'hazard');
    if (scheme.mischief) return hazards.length ? rng.pick(hazards) : rng.pick(free);
    // Spite waits until someone has the way through in hand: with nobody finishing, nobody scores, its target included.
    const mean = sensible === undefined || covered(v);
    if (scheme.target >= 0 && hazards.length && mean) return rng.pick(hazards);
    if (scheme.block && mean) {
      const blocks = free.filter((i) => blocker(v.crate[i]));
      if (blocks.length) return rng.pick(hazards.length ? hazards : blocks);
    }
    return sensible ?? rng.pick(free);
  };

  const place = (v: BrainView): Intent => {
    if (v.placed || v.claim < 0) return { do: 'wait' };
    const held = v.crate[v.claim];
    if (spot && !v.canPlace(spot.tx, spot.ty, spot.rot)) spot = weighing = null;
    // Looking the level over, a spot at a time: where would this make the run hardest?
    if (!spot && scheme.block && held && blocker(held)) {
      weighing ??= { left: inTheWay(v, traits.weigh, rng), best: null, score: -Infinity };
      if (weighing.left.length) {
        // Bots take turns weighing, so no one frame asks the proof for all of them.
        if ((v.phaseFrame + v.slot) % WEIGH_EVERY === 0) {
          const s = weighing.left.shift()!;
          const a = v.assess(s.tx, s.ty, s.rot);
          const score = a && a.tight <= v.route().tight + TIGHT_ADDED ? a.tight * TIGHT_TILES + a.length : -Infinity;
          if (score > weighing.score) [weighing.best, weighing.score] = [s, score];
        }
        if (weighing.left.length) return { do: 'wait' };
      }
      spot = weighing.best;
    }
    if (v.phaseFrame < pause) return { do: 'wait' };
    const hazard = held?.role === 'hazard';
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
      if (me?.finished || v.runners.some((r) => r.finished)) anyone = true;
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
        weighing = null;
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
          anyone = false;
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

/** A part that stands in the way: a hazard, or a block that isn't the plan's bridge. */
function blocker(c: CardSense): boolean {
  return c.role === 'hazard' || (c.role === 'build' && !c.bridge);
}

/** Up to `n` legal spots for the held part on the way everyone will run, drawn from all of it. */
function inTheWay(v: BrainView, n: number, rng: Rng): Place[] {
  const w = v.level.w;
  const out: Place[] = [];
  for (const c of rng.shuffle(v.route().cells)) {
    if (out.length >= n) break;
    const turn = rng.int(0, 3);
    found: for (const [dx, dy] of AROUND)
      for (let r = 0; r < 4; r++) {
        const s: Place = { do: 'place', tx: (c % w) - dx, ty: Math.floor(c / w) - dy, rot: (turn + r) % 4 };
        if (v.canPlace(s.tx, s.ty, s.rot)) {
          out.push(s);
          break found;
        }
      }
  }
  return out;
}

/** A card that builds the plan's way through or clears one. */
function builds(c: CardSense | undefined): boolean {
  return !!c && (c.bridge || c.clears);
}

/** Someone holds what the way through needs: the plan's bridges, or on a sealed level, the part that clears. */
function covered(v: BrainView): boolean {
  const held = v.crate.filter((c) => c.claimed && builds(c)).length;
  return held >= (v.crate.some((c) => c.clears) ? 1 : v.level.plan.length);
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
