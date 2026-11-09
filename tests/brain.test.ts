import { describe, expect, it } from 'vitest';
import { BotSeats } from '../src/brain/bots';
import { rollPersonality } from '../src/brain/personality';
import { botDevice, isBotDevice } from '../src/game/device';
import { Match } from '../src/game/match';
import { Motor } from '../src/brain/motor';
import { Rng } from '../src/core/rng';
import { bodyAtCell } from '../src/sim/physics';
import { T_SOLID } from '../src/sim/level';
import { DEFAULT_RULES } from '../src/game/rules';
import { generateProp, isBridgePart } from '../src/gen/props';
import { applyAction, newNetState } from '../src/net/actions';
import { RunWorld } from '../src/sim/run';
import type { PlacedProp } from '../src/sim/props';
import { brakeFrom, movesFrom } from '../src/sim/reach';
import { RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { NO_INPUT } from '../src/sim/types';
import { botRace, botRound } from './lib/bot-race';

/** A hard level with a tight jump on a Hard bot's way (THINK), and one where a fumble there is a fall (CHOKE). */
const THINK_SEED = 3;
const CHOKE_SEED = 8;

describe('bots', () => {
  // Seeds a bot with steady hands finishes today; the share over many levels is tests/stats/bot-finish.test.ts.
  it.each([1, 3, 12])('runs seed %i to the flag with the plan built', (seed) => {
    const r = botRace(seed, { steady: true });
    expect(r, `seed ${seed}: died of ${r.cause} at race frame ${r.frames}`).toMatchObject({ finished: true });
  });

  // Seeds where four Normal bots used to stand still 432 and 111 frames on end (in a part's way with no move out, and
  // beside a rival in its own cell). How often over many rounds is tests/stats/brawl.test.ts (`pauses`).
  it.each([17, 28])('never stands a second in a brawl, seed %i: it is always at something', (seed) => {
    const r = botRound(seed, { mode: 'brawl', limit: RUN_COUNTDOWN + 25 * 60 });
    expect(r.fight.longest).toBeLessThan(60);
  });

  it('plays a whole round on its own: ready, pick, place, race', () => {
    const m = new Match(4);
    const bots = new BotSeats();
    for (let i = 0; i < 2; i++) m.join(bots.add(m));
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0, raceSeconds: 40 };
    const seen = new Set<string>();
    for (let f = 0; f < 60 * 60 && m.phase !== 'score'; f++) {
      seen.add(m.phase);
      m.step(bots.frames(m));
    }
    expect([...seen]).toEqual(['lobby', 'pick', 'place', 'run']);
    expect(m.phase).toBe('score');
    // Each took a card and placed it, by moving a cursor and clicking like a player: no timer ran out on them.
    expect(m.players.every((p) => p.claim >= 0 && p.placed && !p.afk)).toBe(true);
  });

  it('with no time to spare takes turns thinking, and still plays a round through to the flag', () => {
    const m = new Match(4);
    const bots = new BotSeats();
    for (let i = 0; i < 3; i++) m.join(bots.add(m));
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0, raceSeconds: 60 };
    // Out of time before anyone starts: only the bot whose turn it is to go first thinks each step.
    const broke = { until: 0, now: () => 1 };
    let finished = 0;
    for (let f = 0; f < 90 * 60 && m.phase !== 'score'; f++) {
      m.step(bots.frames(m, undefined, broke));
      finished = Math.max(finished, m.run?.runners.filter((r) => r.finished).length ?? 0);
    }
    expect(m.phase).toBe('score');
    expect(m.players.every((p) => p.claim >= 0 && p.placed && !p.afk)).toBe(true);
    expect(finished).toBeGreaterThan(0);
  });

  it('takes its time over the crate: reads it, points at another card, then takes one', () => {
    const m = new Match(2);
    const bots = new BotSeats();
    m.join(bots.add(m));
    m.rules = { ...m.rules, pickSeconds: 0 };
    m.startMatch();
    const p = m.players[0];
    const pointed = new Set<number>();
    while (p.claim < 0 && m.phaseFrame < 20 * 60) {
      m.step(bots.frames(m));
      pointed.add(m.crateItemAt(p.cursor.x, p.cursor.y));
    }
    expect(p.claim).toBeGreaterThanOrEqual(0);
    expect(m.phaseFrame).toBeGreaterThan(120);
    expect([...pointed].filter((i) => i >= 0 && i !== p.claim).length).toBeGreaterThan(0);
  });

  it('looks for another spot when someone takes the one it meant to use', () => {
    const m = new Match(1);
    expect(m.plan.length).toBe(1);
    const bots = new BotSeats();
    for (let i = 0; i < 2; i++) m.join(bots.add(m));
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0 };
    m.startMatch();
    // Two planks in the crate and one bridge on the plan: both bots aim for the plan's spot.
    const plank = m.crate.find((c) => isBridgePart(c.def))!.def;
    m.crate[0].def = m.crate[1].def = plank;
    for (let f = 0; f < 30 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
    expect(m.phase).toBe('run');
    expect(m.players.every((p) => p.placed && !p.afk)).toBe(true);
    expect(m.placed).toHaveLength(2);
  });

  it('never holds up an untimed place phase: a legal spot the cursor can’t reach is no spot', () => {
    // Brawl seed 30, round 2: a bot's spikes were legal hanging half off the bottom row, aimed below where the cursor
    // stops, and it pressed down against the edge forever.
    const m = new Match(30, undefined, { ...DEFAULT_RULES, mode: 'brawl' });
    const bots = new BotSeats();
    for (let i = 0; i < 4; i++) m.join(bots.add(m));
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0, targetScore: 1e6 };
    m.startMatch();
    for (let round = 0; round < 2; round++) {
      for (let f = 0; f < 60 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
      expect(m.phase, `round ${round + 1}`).toBe('run');
      expect(m.players.every((p) => p.placed && !p.afk)).toBe(true);
      for (let f = 0; f < 70 * 60 && m.phase === 'run'; f++) m.step(bots.frames(m));
    }
  });

  // Hard bots with steady hands on levels each of these once beat: what a good player does instead.
  it.each([
    ['harbor', 1, 'waits on the boardwalk for the tide to go out instead of walking down onto the beach and standing there as it floods'],
    ['harbor', 10, 'waits for a gust to drop before it jumps, instead of being blown off every jump'],
    ['space', 18, 'brakes on a short ledge it lands on at a run, instead of skidding off it to line up'],
    ['rooftops', 8, 'steers in the air instead of letting go while it waits for a hazard'],
    ['farm', 20, 'goes the clear way rather than waiting for a long run that never comes clear'],
  ] as const)('%s %i: %s', (theme, seed, _what) => {
    const r = botRace(seed, { theme, level: 'hard', steady: true });
    expect(r, `died of ${r.cause} at race frame ${r.frames}`).toMatchObject({ finished: true });
    expect(r.frames).toBeLessThan(1200);
  });

  // The same, over the parts three Hard bots placed (as in tests/lib/hard-routes.ts), placed as they did before bots blocked the way.
  it.each([
    ['glacier', 'tall', 11, 'steps in off a ledge’s lip to jump from its middle, instead of hopping in place under the overhang until it gives up'],
    ['harbor', undefined, 8, 'jumps through a part’s side wind traced in that wind, instead of landing short where the tide comes in'],
    ['farm', undefined, 4, 'walks onto a ledge where a run step couldn’t stop short of what’s coming'],
    ['jungle', undefined, 13, 'backs off a dropper and a snapper its landing set off, instead of jumping into the lane as the head slams'],
  ] as const)('%s %s %i: %s', (theme, size, seed, _what) => {
    const r = botRace(seed, { theme, size, level: 'hard', parts: 3, steady: true, hands: (p) => ({ ...p, block: 0 }) });
    expect(r, `died of ${r.cause} at race frame ${r.frames}`).toMatchObject({ finished: true });
    expect(r.frames).toBeLessThan(1200);
  });

  it('with no way on, jumps for it and gives up rather than wander', () => {
    // The plan's bridge isn't built, so no route reaches the flag from spawn.
    const r = botRace(1, { build: false, limit: RUN_COUNTDOWN + 15 * 60 });
    expect(r.finished || r.cause !== null, `still wandering at race frame ${r.frames}`).toBe(true);
  });

  it('stops to think before a tight jump, where steady hands go straight on', () => {
    const opts = { level: 'hard', difficulty: 'hard', steady: true } as const;
    expect(botRace(THINK_SEED, opts).pause).toBeLessThan(20);
    const r = botRace(THINK_SEED, { ...opts, hands: (p) => ({ ...p, think: 1, muse: 60 }) });
    expect(r.pause).toBeGreaterThanOrEqual(30);
    expect(r.finished).toBe(true);
  });

  it('chokes on a tight jump: the fumble a hard level counts drops it', () => {
    const opts = { level: 'hard', difficulty: 'hard' } as const;
    expect(botRace(CHOKE_SEED, { ...opts, steady: true }).finished).toBe(true);
    expect(botRace(CHOKE_SEED, { ...opts, steady: true, hands: (p) => ({ ...p, slip: 1, choke: 1 }) })).toMatchObject({ finished: false, cause: 'fall' });
  });

  it('replays the same race from the same seed', () => {
    expect(botRace(5)).toEqual(botRace(5));
  });

  it('rolls its own personality, steadier and quicker the harder its level', () => {
    const [easy, normal, hard] = (['easy', 'normal', 'hard'] as const).map((l) => rollPersonality(7, l));
    expect(easy.reaction).toBeGreaterThan(normal.reaction);
    expect(normal.reaction).toBeGreaterThanOrEqual(hard.reaction);
    expect(easy.slip).toBeGreaterThan(normal.slip);
    expect(normal.slip).toBeGreaterThan(hard.slip);
    expect(easy.pace).toBeGreaterThan(normal.pace);
    expect(normal.pace).toBeGreaterThan(hard.pace);
    // No level is flawless: even Hard fumbles and stops to think, it just saves a fumble sooner and doubts less.
    for (const p of [easy, normal, hard]) {
      expect(p.slip).toBeGreaterThan(0);
      expect(p.think).toBeGreaterThan(0);
      expect(p.choke).toBeGreaterThan(1);
    }
    expect(easy.save).toBeGreaterThan(hard.save);
    expect(easy.think).toBeGreaterThan(hard.think);
    expect(easy.stray).toBeGreaterThan(hard.stray);
    // Harder is meaner: it acts on a grudge more often, and better.
    expect(easy.spite).toBeLessThan(normal.spite);
    expect(normal.spite).toBeLessThan(hard.spite);
    // And gets in everyone's way more, weighing more spots for the one that hurts.
    expect(easy.block).toBeLessThan(normal.block);
    expect(normal.block).toBeLessThan(hard.block);
    expect(easy.weigh).toBeLessThan(hard.weigh);
    // And presses a brawl harder.
    expect(easy.press).toBeLessThan(normal.press);
    expect(normal.press).toBeLessThan(hard.press);
    // Two bots at one level don't play alike.
    expect(rollPersonality(8, 'normal')).not.toEqual(normal);
    expect(rollPersonality(7, 'normal')).toEqual(normal);
  });

  it('keeps its level on its seat, where every peer sees it', () => {
    const m = new Match(1);
    const ns = newNetState();
    const dev = `peer0001:${botDevice(1)}`;
    applyAction(m, ns, { t: 'join', dev });
    applyAction(m, ns, { t: 'join', dev: 'peer0001:kb1' });
    applyAction(m, ns, { t: 'bot', dev, level: 'hard' });
    applyAction(m, ns, { t: 'bot', dev: 'peer0001:kb1', level: 'easy' });
    expect(m.players.map((p) => p.bot)).toEqual(['hard', undefined]);
    applyAction(m, ns, { t: 'bot', dev, level: 'normal' });
    expect('bot' in m.players[0]).toBe(false);
  });

  it('is a device: a removed bot is gone, not parked to come back', () => {
    const m = new Match(1);
    const ns = newNetState();
    const dev = `peer0001:${botDevice(1)}`;
    expect(isBotDevice(dev) && isBotDevice(botDevice(2)) && !isBotDevice('peer0001:kb1')).toBe(true);
    applyAction(m, ns, { t: 'join', dev });
    expect(m.players.map((p) => p.device)).toEqual([dev]);
    applyAction(m, ns, { t: 'leave', dev });
    expect(m.players).toEqual([]);
    expect(ns.parked).toEqual({});
  });
});

describe('the motor’s own moves', () => {
  /** A one-seat race on `m` over `placed`, past the countdown, with the seat's body standing at stand cell (tx, ty). */
  function standing(m: Match, tx: number, ty: number, placed: PlacedProp[] = []) {
    const p = m.join('kb')!;
    m.startMatch();
    m.placed = placed;
    m.startRun();
    const run = m.run!;
    while (run.frame < RUN_COUNTDOWN) m.step({});
    run.runners[0].body = bodyAtCell(tx, ty);
    return { p, run, r: run.runners[0] };
  }

  it('won’t leap off a side of the map: it goes by the route instead, and stops at the end of it', () => {
    // A ledge running off the side of the map, where a leap toward the edge runs off and out: a brawl arena's right
    // spawn slab run on out to the edge (the arena itself leaves air there).
    const m = new Match(1, undefined, { ...DEFAULT_RULES, mode: 'brawl' });
    const { w, h } = m.level;
    const ty = m.level.goal.ty;
    const tiles = m.level.tiles.slice();
    for (let x = m.level.goal.tx; x < w; x++) {
      tiles[(ty + 1) * w + x] = T_SOLID;
      for (let y = 0; y <= ty; y++) tiles[y * w + x] = 0;
    }
    // What's under test is the edge of the map, not the arena's set pieces.
    m.level = { ...m.level, tiles, setPieces: [] };
    expect(ty).toBeLessThan(h - 1);
    const { p, run, r } = standing(m, w - 3, ty!);
    const motor = new Motor(rollPersonality(1, 'normal'), 1);
    let stood = false;
    for (let f = 0; f < 90 && r.alive; f++) {
      m.step({ kb: motor.drive(m, p, { do: 'leap', tx: w - 1, ty: ty! }) });
      stood ||= r.body.onGround && r.body.vx === 0 && Math.floor((r.body.x + r.body.w / 2) / TILE) === w - 1;
    }
    expect(r.alive, `${r.cause} at race frame ${run.frame}`).toBe(true);
    expect(stood).toBe(true);
  });

  // A placed fan blowing up into open sky holds a runner at the top of its column, where no move the controller has
  // comes down within its length: it steers out for where it's going, as a player drifts out of an updraft, rather
  // than hang there (a brawl bot hung 22 s in one over a stage, its rival waiting under it).
  it('held up in a fan over open sky, it drifts out for its target instead of hanging there', () => {
    const m = new Match(1, undefined, { ...DEFAULT_RULES, mode: 'brawl' });
    const { w, h } = m.level;
    const floor = h - 4;
    const tiles = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) for (let y = floor + 1; y < h; y++) tiles[y * w + x] = T_SOLID;
    m.level = { ...m.level, tiles, setPieces: [], protectedRects: [], spawn: { tx: 2, ty: floor }, goal: { tx: w - 3, ty: floor }, spawns: [] };
    const fan: PlacedProp = {
      uid: 100_000,
      owner: -1,
      tx: 0,
      ty: 0,
      rot: 0,
      def: {
        key: 'test',
        name: 'test',
        maker: 'test',
        archetype: 'fan',
        role: 'utility',
        style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
        motion: { type: 'none' },
        footprint: [[10, floor]],
        modules: [
          { type: 'body', cells: [[10, floor]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
          { type: 'fan', at: [10.5, floor + 0.5], angle: -Math.PI / 2, length: 8, strength: 2800 },
        ],
      },
    };
    const { p, r } = standing(m, 10, floor - 9, [fan]);
    const motor = new Motor(rollPersonality(1, 'normal'), 1);
    let landed = false;
    for (let f = 0; f < 300 && r.alive && !landed; f++) {
      m.step({ kb: motor.drive(m, p, { do: 'goTo', tx: 20, ty: floor }) });
      landed = r.body.onGround && Math.abs(r.body.x / TILE - 10) > 2;
    }
    expect(landed).toBe(true);
  });

  // A brawl stage's slabs float over the drop, their ends wall faces: a knock off one carries a runner out past the
  // end and down the face, where it slides and jumps back up rather than fall out. A rotation of seeds, each a knock
  // off its spawn slab's outer end, down the face and out over the side's drop.
  it.each([2, 7, 11])('knocked off a brawl stage’s end, it climbs back up its wall face (seed %i)', (seed) => {
    const m = new Match(seed, undefined, { ...DEFAULT_RULES, mode: 'brawl' });
    m.level = { ...m.level, setPieces: [] };
    const { spawn, w, tiles } = m.level;
    let edge = spawn.tx;
    while (edge > 0 && tiles[(spawn.ty + 1) * w + edge - 1] !== 0) edge--;
    expect(tiles[(spawn.ty + 1) * w + edge - 1], 'air past the stage’s end').toBe(0);
    const { p, r } = standing(m, edge - 1, spawn.ty + 3);
    r.body.vx = -3;
    r.body.vy = 2;
    const motor = new Motor(rollPersonality(1, 'normal'), 1);
    let back = false;
    for (let f = 0; f < 150 && r.alive && !back; f++) {
      m.step({ kb: motor.drive(m, p, { do: 'goTo', tx: spawn.tx, ty: spawn.ty }) });
      back = r.body.onGround && Math.floor((r.body.x + r.body.w / 2) / TILE) >= edge;
    }
    expect(r.alive, `${r.cause}`).toBe(true);
    expect(back).toBe(true);
  });

  // Across a brawl arena, end to end, with hands that take 18 frames to see what's next and no other lapses: a run
  // across each of these lands a few times on the way, over shafts and up and down the bands.
  // Seed 9's way across waits for a hazard to pass, and quick hands wait it out too: there only what slow hands add
  // counts. The others have nothing to wait for, so every still frame counts.
  it.each([
    [9, false],
    [2, true],
    [5, true],
  ])('in a fight it reads its landings in the air: slow hands cost a run across arena %i no stops, where a race still pays them', (seed, clear) => {
    const across = (reaction: number, haste: boolean) => {
      const m = new Match(seed, undefined, { ...DEFAULT_RULES, mode: 'brawl' });
      const { spawn, goal } = m.level;
      const { p, r } = standing(m, spawn.tx, spawn.ty);
      const motor = new Motor({ ...rollPersonality(1, 'normal'), reaction, slip: 0, think: 0, stray: 0 }, 1);
      let still = 0;
      for (let f = 0; f < 20 * 60 && r.alive; f++) {
        if (Math.floor((r.body.x + r.body.w / 2) / TILE) === goal.tx && Math.floor((r.body.y + r.body.h - 1) / TILE) === goal.ty) return { f, still };
        m.step({ kb: motor.drive(m, p, { do: 'goTo', tx: goal.tx, ty: goal.ty, haste }) });
        if (r.body.onGround && Math.abs(r.body.vx) < 1) still++;
      }
      return { f: -1, still };
    };
    const quick = across(0, true);
    const slow = across(18, true);
    expect(quick.f).toBeGreaterThan(0);
    expect(slow.still - quick.still, `still: slow ${slow.still}, quick ${quick.still}`).toBeLessThan(10);
    if (clear) expect(slow.still).toBeLessThan(10);
    expect(slow.f).toBeLessThanOrEqual(quick.f + 10);
    expect(across(18, false).still).toBeGreaterThan(30);
  });

  // A block's spikes pointing down into the floor it stands on: the strip lies a couple of pixels off a body standing
  // flush against the block's side, inside its margin, where nothing ever reaches it; another spiked block hangs over
  // it, so every jump meets spikes. Every walk from there starts as near as standing, so none has room to spare and
  // none is hit later than standing (a brawl bot stood 12 s like that against a placed spiked jelly, seed 3's second
  // round). It takes a walk with no room to spare and goes, in a fight or a race.
  it.each([true, false])('flush against spikes that never reach it, it walks off rather than stand there (haste %s)', (haste) => {
    const m = new Match(1, undefined, { ...DEFAULT_RULES, mode: haste ? 'brawl' : 'race' });
    const { w, h } = m.level;
    const floor = h - 6;
    const tiles = new Uint8Array(w * h);
    for (let y = floor + 1; y < h; y++) tiles.fill(T_SOLID, y * w, (y + 1) * w);
    m.level = { ...m.level, tiles, setPieces: [], protectedRects: [], spawn: { tx: 2, ty: floor }, goal: { tx: w - 3, ty: floor }, spawns: [] };
    const block = (uid: number, tx: number, ty: number): PlacedProp => ({
      uid,
      owner: -1,
      tx: 0,
      ty: 0,
      rot: 0,
      def: {
        key: 'test',
        name: 'test',
        maker: 'test',
        archetype: 'platform',
        role: 'hazard',
        style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
        motion: { type: 'none' },
        footprint: [[tx, ty]],
        modules: [
          { type: 'body', cells: [[tx, ty]], material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
          { type: 'spikes', cells: [[tx, ty]], angle: Math.PI / 2 },
        ],
      },
    });
    const { p, run, r } = standing(m, 11, floor, [block(100_000, 10, floor), block(100_001, 11, floor - 3)]);
    r.body.x = 11 * TILE;
    const motor = new Motor({ ...rollPersonality(1, 'normal'), margin: 3, reaction: 0, slip: 0, think: 0, stray: 0 }, 1);
    let there = -1;
    for (let f = 0; f < 3 * 60 && r.alive && there < 0; f++) {
      m.step({ kb: motor.drive(m, p, { do: 'goTo', tx: 16, ty: floor, haste }) });
      if (Math.floor((r.body.x + r.body.w / 2) / TILE) === 16) there = f;
    }
    expect(r.alive, `${r.cause} at race frame ${run.frame}`).toBe(true);
    expect(there, 'frames to get there').toBeGreaterThan(0);
    expect(there).toBeLessThan(60);
  });

  it('won’t hop into a flail swinging overhead: it waits for the swing to pass', () => {
    const m = new Match(4);
    // Open ground well clear of the spawn, open above, with a flail's pivot three rows up.
    const { tiles, w, spawn } = m.level;
    const open = (x: number, y: number) => tiles[y * w + x] === 0;
    let at: { tx: number; ty: number } | null = null;
    for (let ty = 6; ty < m.level.h - 1 && !at; ty++)
      for (let tx = 2; tx < w - 4 && !at; tx++)
        if (Math.abs(tx - spawn.tx) > 8 && tiles[(ty + 1) * w + tx] === T_SOLID && [0, 1, 2, 3, 4, 5].every((k) => open(tx, ty - k) && open(tx + 1, ty - k)))
          at = { tx, ty };
    const flail = generateProp(new Rng(1), 'flail', 'x');
    const { p, run, r } = standing(m, at!.tx, at!.ty, [{ uid: 1, def: flail, owner: 0, tx: at!.tx, ty: at!.ty - 3, rot: 0 }]);
    const motor = new Motor(rollPersonality(1, 'normal'), 1);
    let hops = 0;
    for (let f = 0; f < 2 * 60 && r.alive; f++) {
      const inp = motor.drive(m, p, { do: 'hop', tx: at!.tx });
      if (inp.jumpPressed) hops++;
      m.step({ kb: inp });
    }
    expect(r.alive, `${r.cause} at race frame ${run.frame}`).toBe(true);
    expect(hops).toBeGreaterThan(0);
  });

  it('waits a step short of a crusher across the only way, rather than walk up to it and back off, and crosses', () => {
    // Flat ground with a press three rows over it, slamming on a long beat: what's under it is the only way on.
    const m = new Match(4);
    const { w, h } = m.level;
    const floor = 20;
    const tiles = new Uint8Array(w * h);
    for (let y = floor + 1; y < h; y++) tiles.fill(T_SOLID, y * w, (y + 1) * w);
    m.level = { ...m.level, tiles, setPieces: [], spawn: { tx: 4, ty: floor }, goal: { tx: 40, ty: floor } };
    const press = generateProp(new Rng(10), 'crusher', 'x');
    const { p, run, r } = standing(m, 8, floor, [{ uid: 1, def: press, owner: 1, tx: 22, ty: floor - 3, rot: 0 }]);
    const motor = new Motor({ ...rollPersonality(1, 'normal'), reaction: 0, slip: 0, think: 0, stray: 0 }, 1);
    let furthest = 0;
    let back = 0;
    let across = -1;
    for (let f = 0; f < 6 * 60 && r.alive && across < 0; f++) {
      m.step({ kb: motor.drive(m, p, { do: 'goTo', tx: 36, ty: floor, haste: true }) });
      const x = r.body.x / TILE;
      furthest = Math.max(furthest, x);
      back = Math.max(back, furthest - x);
      if (x >= 36) across = f;
    }
    expect(r.alive, `${r.cause} at race frame ${run.frame}`).toBe(true);
    expect(across, 'it got across').toBeGreaterThan(0);
    // Walking up to the press's edge and backing off when it comes down is two tiles and more of retreat.
    expect(back, 'tiles it backed off').toBeLessThan(1.5);
  });
});

describe('movesFrom', () => {
  it('records inputs that take the real race exactly where they said', () => {
    const m = new Match(3);
    const run = new RunWorld(m.level, [], [0]);
    while (run.frame < RUN_COUNTDOWN) run.step([NO_INPUT]);
    const body = run.runners[0].body;
    const moves = movesFrom(m.level, body, run.solids);
    expect(moves.length).toBeGreaterThan(2);
    const mv = moves.reduce((a, b) => (b.controls.length > a.controls.length ? b : a));
    for (let i = 0; i < mv.controls.length; i++) {
      run.step([{ ...NO_INPUT, ...mv.controls[i], down: !!mv.controls[i].down, run: !!mv.controls[i].run }]);
      expect([body.x, body.y], `frame ${i}`).toEqual([mv.path[2 * i], mv.path[2 * i + 1]]);
    }
    expect(Math.floor((body.y + body.h - 1) / 16) * m.level.w + Math.floor((body.x + body.w / 2) / 16)).toBe(mv.to);
  });

  it('runs along the ground: a step to the next cell holds run once a run gets there sooner', () => {
    const m = new Match(3);
    const run = new RunWorld(m.level, [], [0]);
    while (run.frame < RUN_COUNTDOWN) run.step([NO_INPUT]);
    const body = run.runners[0].body;
    const w = m.level.w;
    // Walk toward the flag a few frames, then look at the step to the cell after.
    for (let i = 0; i < 8; i++) run.step([{ ...NO_INPUT, right: true }]);
    const here = Math.floor((body.y + body.h - 1) / 16) * w + Math.floor((body.x + body.w / 2) / 16);
    const step = movesFrom(m.level, body, run.solids).find((mv) => !mv.air && mv.to === here + 1);
    expect(step).toBeDefined();
    expect(step!.controls.every((c) => c.run && c.right)).toBe(true);
  });

  it('brakes to a stop it recorded exactly, standing where it said', () => {
    const m = new Match(3);
    const run = new RunWorld(m.level, [], [0]);
    while (run.frame < RUN_COUNTDOWN) run.step([NO_INPUT]);
    const body = run.runners[0].body;
    for (let i = 0; i < 12; i++) run.step([{ ...NO_INPUT, right: true, run: true }]);
    expect(Math.abs(body.vx)).toBeGreaterThan(150);
    const stop = brakeFrom(m.level, body, run.solids);
    expect(stop).not.toBeNull();
    for (let i = 0; i < stop!.controls.length; i++) {
      run.step([{ ...NO_INPUT, ...stop!.controls[i], down: false, run: !!stop!.controls[i].run }]);
      expect([body.x, body.y], `frame ${i}`).toEqual([stop!.path[2 * i], stop!.path[2 * i + 1]]);
    }
    expect(body.onGround && Math.abs(body.vx) < 0.5).toBe(true);
    expect([body.x, body.vx]).toEqual([stop!.end.x, stop!.end.vx]);
  });
});
