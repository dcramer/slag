import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { rollPersonality } from '../src/brain/personality';
import { ItemPlay } from '../src/brain/strategies/items';
import { ITEM_TACTICS, knockedInto, type Moment } from '../src/brain/tactics';
import { BRAIN_VIEW_VERSION, type BrainView, type RunnerSense, type SelfSense } from '../src/brain/types';
import { Motor } from '../src/brain/motor';
import { Match } from '../src/game/match';
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
  rank: 0,
  held: null,
  armed: true,
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
  ...over,
});

function view(over: Partial<BrainView> & { tiles?: Uint8Array }): BrainView {
  return {
    version: BRAIN_VIEW_VERSION,
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
    detour: () => 0,
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

  it('swings at a rival beside it, the bat only from the ground; never lets go of Bubble Wrap', () => {
    expect(ITEM_TACTICS.sword.when(moment({}, { runners: [rival(4.5, 0)] }))).toEqual({ do: 'use', dir: -1 });
    expect(ITEM_TACTICS.sword.when(moment({}, { runners: [rival(9.5, 0)] }))).toBeNull();
    expect(ITEM_TACTICS.bat.when(moment({ grounded: false }, { runners: [rival(6.5, 0)] }))).toBeNull();
    expect(ITEM_TACTICS.bat.when(moment({}, { runners: [rival(6.5, 0)] }))).toEqual({ do: 'use', dir: 1 });
    expect(ITEM_TACTICS.shield.when(moment({ slag: 1, rank: 2 }, { runners: [rival(6, 0)] }))).toBeNull();
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

  it('sees a hit that throws a rival into a part that hurts, but not into a mystery box', () => {
    const props = [{ owner: 1, ground: [], noGo: [13 * W + 2] }];
    const box = { tx: 2, ty: 13, ready: true, hands: false };
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

describe('going for boxes', () => {
  const traits = { ...rollPersonality(1, 'hard'), knack: 1 };
  /** A box at (9, 10) under a rock roof, so what it pops drops out of its bottom. */
  const room = tiles((set) => set(9, 9, T_SOLID));
  const boxed = (me: Partial<SelfSense>) => view({ tiles: room, boxes: [{ tx: 9, ty: 10, ready: true, hands: false }], self: { ...SELF, rank: 1, ...me } });

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
    const open = view({ boxes: [{ tx: 9, ty: 10, ready: true, hands: false }], detour: (_, ty) => (ty === 9 ? Infinity : 0) });
    const play = new ItemPlay(new Rng(1), traits);
    for (let f = 0; f < 20; f++) expect(play.think(open, { ...SELF, rank: 1 }, false)).toBeNull();
    // A loop's box hands it over, so where its pop would land doesn't matter.
    const handing = view({ boxes: [{ tx: 9, ty: 10, ready: true, hands: true }], detour: (_, ty) => (ty === 9 ? Infinity : 0) });
    const keen = new ItemPlay(new Rng(1), traits);
    let intent = null;
    for (let f = 0; f < 20 && !intent; f++) intent = keen.think(handing, { ...SELF, rank: 1 }, false);
    expect(intent).toEqual({ do: 'goTo', tx: 9, ty: 13 });
    const close = new ItemPlay(new Rng(1), traits);
    for (let f = 0; f < 20; f++) expect(close.think(boxed({ slag: 4 }), { ...SELF, rank: 1, slag: 4 }, false)).toBeNull();
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

  it('in a race, with items in hand', () => {
    const r = botRound(2, { mode: 'race', players: 3, deal: 3 * 60, limit: 40 * 60 });
    expect(Object.values(r.uses).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
