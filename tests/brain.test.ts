import { describe, expect, it } from 'vitest';
import { BotSeats } from '../src/brain/bots';
import { rollPersonality } from '../src/brain/personality';
import { botDevice, isBotDevice } from '../src/brain/device';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { isBridgePart } from '../src/gen/props';
import { applyAction, newNetState } from '../src/net/actions';
import { RunWorld } from '../src/sim/run';
import { brakeFrom, movesFrom } from '../src/sim/reach';
import { RUN_COUNTDOWN } from '../src/sim/constants';
import { NO_INPUT } from '../src/sim/types';
import { botRace } from './lib/bot-race';

/** A hard level with a tight jump on a Hard bot's way (THINK), and one where a fumble there is a fall (CHOKE). */
const THINK_SEED = 3;
const CHOKE_SEED = 8;

describe('bots', () => {
  // Seeds a bot with steady hands finishes today; the share over many levels is tests/stats/bot-finish.test.ts.
  it.each([1, 3, 12])('runs seed %i to the flag with the plan built', (seed) => {
    const r = botRace(seed, { steady: true });
    expect(r, `seed ${seed}: died of ${r.cause} at race frame ${r.frames}`).toMatchObject({ finished: true });
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
