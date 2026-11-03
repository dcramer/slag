import { describe, expect, it } from 'vitest';
import { BotSeats } from '../src/brain/bots';
import { botDevice, isBotDevice } from '../src/brain/device';
import { Match } from '../src/game/match';
import { applyAction, newNetState } from '../src/net/actions';
import { RunWorld } from '../src/sim/run';
import { movesFrom } from '../src/sim/reach';
import { RUN_COUNTDOWN } from '../src/sim/constants';
import { NO_INPUT } from '../src/sim/types';
import { botRace } from './lib/bot-race';

describe('bots', () => {
  // Seeds a bot finishes today; the share over many levels is tests/stats/bot-finish.test.ts.
  it.each([1, 3, 12])('runs seed %i to the flag with the plan built', (seed) => {
    const r = botRace(seed);
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

  it('replays the same race from the same seed', () => {
    expect(botRace(5)).toEqual(botRace(5));
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
});
