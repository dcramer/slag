import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { rollPersonality } from '../src/brain/personality';
import { brawlStrategy } from '../src/brain/strategies/brawl';
import { ItemPlay } from '../src/brain/strategies/items';
import { ITEM_TACTICS, knockedInto, type Moment } from '../src/brain/tactics';
import { RACE_SHOVE } from '../src/sim/collide';
import { BRAIN_VIEW_VERSION, type BrainView, type RunnerSense, type SelfSense } from '../src/brain/types';
import { Motor } from '../src/brain/motor';
import { Match } from '../src/game/match';
import { MODES } from '../src/game/modes';
import { PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { T_ONEWAY, T_SOLID } from '../src/sim/level';
import { botRound } from './lib/bot-race';

/** Bots and held items (src/brain/tactics.ts, strategies/items.ts): when each is worth using, and going for boxes. */

const W = 16;
const H = 16;

/** A room with a floor at row 14 (stand row 13) and whatever else `paint` puts in. */
function tiles(paint: (set: (x: number, y: number, t: number) => void) => void = () => {}): Uint8Array {
  const t = new Uint8Array(W * H);
  const set = (x: number, y: number, k: number) => (t[y * W + x] = k);
  for (let x = 0; x < W; x++) set(x, 14, T_SOLID);
  paint(set);
  return t;
}

const SELF: SelfSense = {
  x: 5.5,
  y: 14,
  tx: 5,
  ty: 13,
  pace: 'still',
  lift: 'level',
  facing: 1,
  grounded: true,
  wall: 0,
  alive: true,
  finished: false,
  togo: 30,
  away: 30,
  up: 0,
  slag: null,
  screen: null,
  rank: 0,
  held: null,
  armed: true,
  hurt: 1,
  shielded: false,
};

const rival = (x: number, up: number, over: Partial<RunnerSense> = {}): RunnerSense => ({
  slot: 1,
  x,
  y: 14 - up,
  up,
  grounded: true,
  alive: true,
  finished: false,
  held: null,
  shielded: false,
  ...over,
});

function view(over: Partial<BrainView> & { tiles?: Uint8Array }): BrainView {
  return {
    version: BRAIN_VIEW_VERSION,
    shove: RACE_SHOVE,
    phase: 'run',
    mode: 'slag',
    phaseFrame: 0,
    slot: 0,
    ready: true,
    score: 0,
    level: { w: W, h: H, tiles: over.tiles ?? tiles(), spawn: { tx: 1, ty: 13 }, plan: [] },
    props: [],
    crate: [],
    claim: -1,
    placed: true,
    objective: { kind: 'climb', lapLine: { tx: 8, ty: 1 }, loop: 0 },
    boxes: [],
    drops: [],
    surges: [],
    detour: () => 0,
    sight: null,
    reach: () => 0,
    self: SELF,
    runners: [],
    rivals: [],
    kills: [],
    live: true,
    canPlace: () => false,
    keepsWay: () => false,
    route: () => ({ cells: [], tight: 0, length: 0 }),
    assess: () => null,
    ...over,
  };
}

const moment = (me: Partial<SelfSense>, v: Partial<BrainView> & { tiles?: Uint8Array } = {}, stalled = false): Moment => {
  const self = { ...SELF, ...me };
  return { v: view({ ...v, self }), me: self, stalled };
};

/** A one-way ledge six rows up, over the bot's column. */
const LEDGE = tiles((set) => {
  for (let x = 3; x <= 7; x++) set(x, 8, T_ONEWAY);
});

describe('item tactics', () => {
  it('lights the jetpack with the slag close and a ledge to land on, and not otherwise', () => {
    expect(ITEM_TACTICS.rocket.when(moment({ slag: 3 }, { tiles: LEDGE }))).toMatchObject({ do: 'use' });
    expect(ITEM_TACTICS.rocket.when(moment({ slag: 20 }, { tiles: LEDGE }))).toBeNull();
    expect(ITEM_TACTICS.rocket.when(moment({ slag: 20 }, { tiles: LEDGE }, true))).toMatchObject({ do: 'use' });
    expect(ITEM_TACTICS.rocket.when(moment({ slag: 3 }))).toBeNull();
    // Rock overhead: the burst would only bang its head.
    const roofed = tiles((set) => {
      for (let x = 3; x <= 7; x++) set(x, 8, T_SOLID);
    });
    expect(ITEM_TACTICS.rocket.when(moment({ slag: 3 }, { tiles: roofed }))).toBeNull();
  });

  it('puts a Pocket Block underfoot at the top of a jump when it has to get up', () => {
    expect(ITEM_TACTICS.block.when(moment({ grounded: false, lift: 'level', slag: 3 }))).toEqual({ do: 'use' });
    expect(ITEM_TACTICS.block.when(moment({ grounded: false, lift: 'rising', slag: 3 }))).toBeNull();
    expect(ITEM_TACTICS.block.when(moment({ grounded: true, slag: 3 }))).toBeNull();
    expect(ITEM_TACTICS.block.when(moment({ grounded: false, lift: 'level', slag: 20 }))).toBeNull();
  });

  it('sends the winged shell only from behind', () => {
    expect(ITEM_TACTICS.tax.when(moment({ rank: 1 }, { runners: [rival(9, 6)] }))).toEqual({ do: 'use' });
    expect(ITEM_TACTICS.tax.when(moment({ rank: 0 }, { runners: [rival(9, -6)] }))).toBeNull();
  });

  it('throws the boomerang at a rival in range, high at one above, never through rock', () => {
    expect(ITEM_TACTICS.boomerang.when(moment({}, { runners: [rival(10.5, 0)] }))).toEqual({ do: 'use', dir: 1 });
    expect(ITEM_TACTICS.boomerang.when(moment({}, { runners: [rival(0.5, 2.5)] }))).toEqual({ do: 'use', dir: -1, up: true });
    const wall = tiles((set) => set(8, 13, T_SOLID));
    expect(ITEM_TACTICS.boomerang.when(moment({}, { tiles: wall, runners: [rival(10.5, 0)] }))).toBeNull();
  });

  it('casts the rod at a rival its line reaches, slanting up at one on a board overhead, never through rock', () => {
    expect(ITEM_TACTICS.rod.when(moment({}, { runners: [rival(12.5, 0)] }))).toEqual({ do: 'use', dir: 1 });
    expect(ITEM_TACTICS.rod.when(moment({}, { runners: [rival(15.5, 0)] }))).toBeNull();
    const wall = tiles((set) => set(8, 13, T_SOLID));
    expect(ITEM_TACTICS.rod.when(moment({}, { tiles: wall, runners: [rival(12.5, 0)] }))).toBeNull();
    // A board four rows up from column 8: the line goes up through it.
    const board = tiles((set) => {
      for (let x = 8; x < W; x++) set(x, 10, T_ONEWAY);
    });
    expect(ITEM_TACTICS.rod.when(moment({}, { tiles: board, runners: [rival(9.5, 4)] }))).toEqual({ do: 'use', dir: 1, up: true });
  });

  it('lobs the clock to come down beside a rival standing a few tiles off, not at one at its feet or in the air', () => {
    const lob = ITEM_TACTICS.clock.when(moment({ x: 2.5, tx: 2 }, { runners: [rival(7.5, 0)] }));
    expect(lob).toMatchObject({ do: 'use', dir: 1 });
    expect(ITEM_TACTICS.clock.when(moment({ x: 2.5, tx: 2 }, { runners: [rival(3.5, 0)] }))).toBeNull();
    expect(ITEM_TACTICS.clock.when(moment({ x: 2.5, tx: 2 }, { runners: [rival(7.5, 0, { grounded: false })] }))).toBeNull();
  });

  it('swings at a rival beside it, the bat only from the ground; never lets go of Bubble Wrap', () => {
    expect(ITEM_TACTICS.sword.when(moment({}, { runners: [rival(4.5, 0)] }))).toEqual({ do: 'use', dir: -1 });
    expect(ITEM_TACTICS.sword.when(moment({}, { runners: [rival(9.5, 0)] }))).toBeNull();
    expect(ITEM_TACTICS.bat.when(moment({ grounded: false }, { runners: [rival(6.5, 0)] }))).toBeNull();
    expect(ITEM_TACTICS.bat.when(moment({}, { runners: [rival(6.5, 0)] }))).toEqual({ do: 'use', dir: 1 });
    expect(ITEM_TACTICS.shield.when(moment({ slag: 1, rank: 2 }, { runners: [rival(6, 0)] }))).toBeNull();
  });
});

describe('the climb’s own items', () => {
  it('pours the Slippery Slope from a floor while a rival climbs the ledges under it', () => {
    expect(ITEM_TACTICS.slick.when(moment({}, { runners: [rival(9, -5)] }))).toEqual({ do: 'use' });
    expect(ITEM_TACTICS.slick.when(moment({}, { runners: [rival(9, 4)] }))).toBeNull();
    expect(ITEM_TACTICS.slick.when(moment({ grounded: false }, { runners: [rival(9, -5)] }))).toBeNull();
  });

  it('stamps the Trickle-Down while a rival below stands on something in its reach', () => {
    expect(ITEM_TACTICS.jolt.when(moment({}, { runners: [rival(2, -6)] }))).toEqual({ do: 'use' });
    expect(ITEM_TACTICS.jolt.when(moment({}, { runners: [rival(2, -6, { grounded: false })] }))).toBeNull();
    expect(ITEM_TACTICS.jolt.when(moment({}, { runners: [rival(2, -20)] }))).toBeNull();
  });

  it('hooks a Social Climber on a ledge higher than a jump goes, and not on one a jump reaches', () => {
    expect(ITEM_TACTICS.grapple.when(moment({}, { tiles: LEDGE }))).toEqual({ do: 'use' });
    const low = tiles((set) => {
      for (let x = 3; x <= 7; x++) set(x, 11, T_ONEWAY);
    });
    expect(ITEM_TACTICS.grapple.when(moment({}, { tiles: low }))).toBeNull();
    expect(ITEM_TACTICS.grapple.when(moment({}))).toBeNull();
  });
});

describe('knocking someone into something (a brawl)', () => {
  /** The floor ends at column 10, over the pit; a wall stands at column 0. */
  const LEDGE_END = tiles((set) => {
    for (let x = 10; x < W; x++) set(x, 14, 0);
    for (let y = 8; y < 14; y++) set(0, y, T_SOLID);
  });

  it('sees a hit that throws a rival off the end of the floor, and not one into the wall', () => {
    const v = view({ tiles: LEDGE_END });
    const r = rival(8.5, 0);
    expect(knockedInto(v, SELF, r, 1, 'sword')).toBe(true);
    expect(knockedInto(v, SELF, r, -1, 'sword')).toBe(false);
    // Bare-handed, only a shove at the very edge counts.
    expect(knockedInto(v, SELF, rival(9.5, 0), 1, null)).toBe(true);
    expect(knockedInto(v, SELF, rival(4.5, 0), 1, null)).toBe(false);
  });

  it('sees a rod yank pull a rival off a ledge across a gap, toward the caster', () => {
    // A ledge at columns 0..5, the pit at 6..9, the bot's floor from 10.
    const gap = tiles((set) => {
      for (let x = 6; x <= 9; x++) set(x, 14, 0);
    });
    const me = { ...SELF, x: 12.5, tx: 12 };
    expect(knockedInto(view({ tiles: gap }), me, rival(4.5, 0), -1, 'rod')).toBe(true);
    expect(knockedInto(view({ tiles: gap }), me, rival(4.5, 0), 1, 'rod')).toBe(false);
  });

  it('sees a hit that throws a rival into a part that hurts, but not into a mystery box', () => {
    const props = [{ owner: 1, ground: [], noGo: [13 * W + 2] }];
    const box = { tx: 2, ty: 13, ready: true, hands: false, stand: false, kind: null };
    expect(knockedInto(view({ tiles: LEDGE_END, props }), SELF, rival(3, 0), -1, 'sword')).toBe(true);
    expect(knockedInto(view({ tiles: LEDGE_END, props, boxes: [box] }), SELF, rival(3, 0), -1, 'sword')).toBe(false);
  });

  it('sees the slag under a ledge as a place to throw someone', () => {
    const shelf = tiles((set) => {
      for (let x = 0; x < W; x++) set(x, 14, x < 6 ? T_SOLID : 0);
      for (let x = 0; x < W; x++) set(x, 15, T_SOLID);
    });
    const me = { ...SELF, x: 2.5, tx: 2 };
    // The floor a row down is safe, until the slag covers it.
    expect(knockedInto(view({ tiles: shelf }), me, rival(4.5, 0), 1, 'sword')).toBe(false);
    expect(knockedInto(view({ tiles: shelf }), { ...me, slag: 0.5 }, rival(4.5, 0), 1, 'sword')).toBe(true);
  });
});

describe('pressing a brawl (strategies/brawl.ts)', () => {
  /** Walls up both sides, so a knock throws nobody anywhere; a shelf at row 9 over columns 2 to 5, the high ground. */
  const ARENA = tiles((set) => {
    for (let y = 6; y < 14; y++) {
      set(0, y, T_SOLID);
      set(W - 1, y, T_SOLID);
    }
    for (let x = 2; x <= 5; x++) set(x, 9, T_SOLID);
  });
  const fight = { kind: 'fight' as const, cell: { tx: 13, ty: 13 }, ends: [{ tx: 1, ty: 13 }] };
  const brawler = (level: 'easy' | 'normal' | 'hard', seed = 1) => brawlStrategy.make(new Rng(seed), { ...rollPersonality(seed, level), knack: 1 });

  /** Frames until a brawler holding a sword, with a rival in reach on open floor, swings. */
  function swingsAfter(level: 'easy' | 'normal' | 'hard'): number {
    const me: SelfSense = { ...SELF, held: { kind: 'sword', uses: 3 } };
    const r = rival(7, 0);
    const v = view({ tiles: ARENA, objective: fight, runners: [r], self: me });
    expect(knockedInto(v, me, r, 1, 'sword') || knockedInto(v, me, r, -1, 'sword')).toBe(false);
    const s = brawler(level);
    for (let f = 1; f <= 10 * 60; f++) if (s.think(v, me).do === 'use') return f;
    return Infinity;
  }

  it('swings at a rival in reach within half a second when neither way throws them into anything; a pushier bot sooner', () => {
    // Waiting only pays when a better hit can come: here none can, and standing there in reach is a pause.
    expect(swingsAfter('normal')).toBeLessThanOrEqual(30);
    expect(swingsAfter('hard')).toBeLessThan(swingsAfter('easy'));
  });

  it('bare-handed and up against a rival in its own cell, never sends itself to the cell it stands in', () => {
    const s = brawler('normal');
    // Both in cell 5: a goTo their cell is one it's in already, and the motor would stand it still beside them.
    const me: SelfSense = { ...SELF, x: 5.2 };
    const r = rival(5.95, 0);
    const v = view({ tiles: ARENA, objective: fight, runners: [r], self: me });
    for (let f = 0; f < 30; f++) expect(s.think(v, me)).not.toMatchObject({ do: 'goTo', tx: 5, ty: 13 });
  });

  it('lines up a run-up into a rival a few tiles off a ledge where the mode body-checks, and not where it only jostles', () => {
    // The floor ends at column 10; a check from three tiles throws the rival off it, a walk's shove wouldn't.
    const ledge = tiles((set) => {
      for (let x = 10; x < W; x++) set(x, 14, 0);
      for (let y = 8; y < 14; y++) set(0, y, T_SOLID);
    });
    const me: SelfSense = { ...SELF, x: 3.5, tx: 3 };
    const r = rival(6.5, 0);
    const go = (shove: BrainView['shove']) => {
      const s = brawler('normal');
      const v = { ...view({ tiles: ledge, objective: fight, runners: [r], self: me }), shove };
      return s.think(v, me);
    };
    expect(go(MODES.brawl.run.shove!)).toEqual({ do: 'charge', dir: 1, tx: 6, ty: 13 });
    expect(go(RACE_SHOVE).do).not.toBe('charge');
  });

  it('stays in the fight while the slag only boils, and climbs once it pours in under it', () => {
    const s = brawler('normal');
    const r = rival(13.5, 0);
    // The view rounds its feet and the slag apart: a slag that hasn't moved reads a quarter row nearer now and then.
    for (let f = 0; f < 90; f++) {
      const me: SelfSense = { ...SELF, slag: f % 2 ? 2.75 : 3 };
      const go = s.think(view({ tiles: ARENA, objective: fight, runners: [r], self: me }), me);
      expect(go.do === 'goTo' && go.ty < SELF.ty, `frame ${f}: ${JSON.stringify(go)}`).toBe(false);
    }
    let up = false;
    for (let f = 0; f < 30 && !up; f++) {
      const me: SelfSense = { ...SELF, slag: 1 };
      const go = s.think(view({ tiles: ARENA, objective: fight, runners: [r], self: me }), me);
      up = go.do === 'goTo' && go.ty < SELF.ty - 1;
    }
    expect(up).toBe(true);
  });
});

describe('going for boxes', () => {
  const traits = { ...rollPersonality(1, 'hard'), knack: 1 };
  /** A box at (9, 10) under a rock roof, so what it pops drops out of its bottom. */
  const room = tiles((set) => set(9, 9, T_SOLID));
  const boxed = (me: Partial<SelfSense>) =>
    view({ tiles: room, boxes: [{ tx: 9, ty: 10, ready: true, hands: false, stand: false, kind: null }], self: { ...SELF, rank: 1, ...me } });

  it('walks under a full box near its way and hops into it; with no knack it carries on', () => {
    const play = new ItemPlay(new Rng(1), traits);
    let intent = null;
    for (let f = 0; f < 20 && !intent; f++) intent = play.think(boxed({}), { ...SELF, rank: 1 }, false);
    expect(intent).toEqual({ do: 'goTo', tx: 9, ty: 13 });
    expect(play.think(boxed({ tx: 9, x: 9.5 }), { ...SELF, rank: 1, tx: 9, x: 9.5 }, false)).toEqual({ do: 'hop', tx: 9 });
    const none = new ItemPlay(new Rng(1), { ...traits, knack: 0 });
    for (let f = 0; f < 20; f++) expect(none.think(boxed({}), { ...SELF, rank: 1 }, false)).toBeNull();
  });

  it('leaves a box it could never reach the pop of (unless it hands it over), and any box once the slag is close', () => {
    const open = view({ boxes: [{ tx: 9, ty: 10, ready: true, hands: false, stand: false, kind: null }], detour: (_, ty) => (ty === 9 ? Infinity : 0) });
    const play = new ItemPlay(new Rng(1), traits);
    for (let f = 0; f < 20; f++) expect(play.think(open, { ...SELF, rank: 1 }, false)).toBeNull();
    // A loop's box hands it over, so where its pop would land doesn't matter.
    const handing = view({ boxes: [{ tx: 9, ty: 10, ready: true, hands: true, stand: false, kind: null }], detour: (_, ty) => (ty === 9 ? Infinity : 0) });
    const keen = new ItemPlay(new Rng(1), traits);
    let intent = null;
    for (let f = 0; f < 20 && !intent; f++) intent = keen.think(handing, { ...SELF, rank: 1 }, false);
    expect(intent).toEqual({ do: 'goTo', tx: 9, ty: 13 });
    const close = new ItemPlay(new Rng(1), traits);
    for (let f = 0; f < 20; f++) expect(close.think(boxed({ slag: 4 }), { ...SELF, rank: 1, slag: 4 }, false)).toBeNull();
  });

  it('walks into a stand rather than hopping, and goes for the one with something that knocks on it over a nearer one', () => {
    const stand = (tx: number, kind: 'sword' | 'tremor') => ({ tx, ty: 13, ready: true, hands: true, stand: true, kind });
    // Not leading a climb (the leader is dealt nothing): rank 1.
    const me = { ...SELF, rank: 1 };
    const pick = (boxes: ReturnType<typeof stand>[]) => {
      const play = new ItemPlay(new Rng(1), traits);
      let intent = null;
      for (let f = 0; f < 20 && !intent; f++) intent = play.think(view({ boxes, self: me }), me, false);
      return { play, intent };
    };
    // Two tiles off with a brick on it, five off with a noodle: the noodle.
    expect(pick([stand(7, 'tremor'), stand(10, 'sword')]).intent).toEqual({ do: 'goTo', tx: 10, ty: 13 });
    // Standing in it, it keeps walking in (nothing to hop for) until it's taken.
    const { play } = pick([stand(7, 'sword')]);
    const there = { ...me, tx: 7, x: 7.5 };
    expect(play.think(view({ boxes: [stand(7, 'sword')], self: there }), there, false)).toEqual({ do: 'goTo', tx: 7, ty: 13 });
    expect(play.think(view({ boxes: [{ ...stand(7, 'sword'), ready: false, kind: null }], self: there }), there, false)).toBeNull();
  });

  it('steps over for a Leg Day on its way, whatever it holds, and lets it go once it is taken', () => {
    const me = { ...SELF, held: { kind: 'shield' as const, uses: 1 } };
    const surges = (ready: boolean) => [{ tx: 9, ty: 13, ready }];
    const play = new ItemPlay(new Rng(1), traits);
    let intent = null;
    for (let f = 0; f < 20 && !intent; f++) intent = play.think(view({ surges: surges(true), self: me }), me, false);
    expect(intent).toEqual({ do: 'goTo', tx: 9, ty: 13 });
    expect(play.think(view({ surges: surges(false), self: me }), me, false)).toBeNull();
  });

  it('hops at once on arriving at a walk, rather than turning back and forth under the box', () => {
    const m = new Match(1);
    const p = m.join('kb')!;
    m.startMatch();
    m.startRun();
    const run = m.run!;
    while (run.frame < RUN_COUNTDOWN) m.step({});
    const r = run.runners[0];
    const home = { ...r.body };
    const tx = Math.floor((r.body.x + r.body.w / 2) / TILE);
    // Arriving under its column at a walk, the way an errand's goTo leaves it: at any speed short of one it's off the
    // ground within a few frames (pressing back at a walk only turned it round, every frame).
    for (const share of [0.2, 0.4, 0.6, 1]) {
      r.body = { ...home, vx: PHYS.walkSpeed * share };
      const motor = new Motor(traits, 1);
      let left = -1;
      for (let f = 0; f < 20 && left < 0; f++) {
        m.step({ kb: motor.drive(m, p, { do: 'hop', tx }) });
        if (!r.body.onGround) left = f;
      }
      expect(left, `at ${share} of a walk`).toBeGreaterThanOrEqual(0);
      while (!r.body.onGround) m.step({});
    }
  });
});

describe('bots use what they hold', () => {
  it('in a Rising Slag round, with items in hand', () => {
    const r = botRound(3, { deal: 5 * 60, limit: 40 * 60 });
    expect(Object.values(r.uses).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('in a Rising Slag round, what a Hand-Me-Down hands them', () => {
    const r = botRound(3, { limit: 40 * 60 });
    expect(r.handed).toBeGreaterThan(0);
    expect(r.handedUsed).toBeGreaterThan(0);
  });

  it('in a race, with items in hand', () => {
    const r = botRound(2, { mode: 'race', players: 3, deal: 3 * 60, limit: 40 * 60 });
    expect(Object.values(r.uses).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
