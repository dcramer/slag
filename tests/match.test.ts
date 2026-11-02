import { afterEach, describe, expect, it, vi } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES, loadRules, MATCH_LENGTHS, type MatchRules, nearestLength, RULE_CHOICES, type TimerRule } from '../src/game/rules';
import { RUN_COUNTDOWN } from '../src/sim/constants';
import { canPlace, footprint } from '../src/sim/props';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { sample } from './lib/tier';

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Drive a match with a simple scripted bot: picks the first free card, places anywhere legal, holds right + jumps. */
function playMatch(seed: number, devices: string[], maxFrames = 60 * 60 * sample(2, 6)) {
  const m = new Match(seed);
  // The dumb bot may never finish or find a spot: races and placement must end.
  m.rules = { ...m.rules, raceSeconds: 20, placeSeconds: 5 };
  const tick = (fn: (d: string) => InputFrame) => m.step(Object.fromEntries(devices.map((d) => [d, fn(d)])));
  tick(() => press({ confirmPressed: true })); // join
  tick(() => press({ confirmPressed: true })); // ready
  let f = 0;
  const searched = new Set<number>();
  while (m.phase !== 'victory' && f++ < maxFrames) {
    if (m.phase === 'pick' && m.phaseFrame > 12) {
      for (const p of m.players) {
        if (p.claim >= 0) continue;
        const free = m.crate.find((c) => c.claimedBy < 0)!;
        p.cursor = { x: free.rect.x + 5, y: free.rect.y + 5 };
      }
      tick(() => press({ confirmPressed: true }));
    } else if (m.phase === 'place' && m.phaseFrame > 12) {
      if (m.phaseFrame === 13) searched.clear();
      // Teleport each cursor to the first legal spot (any rotation) to keep the test fast; search once per player.
      for (const p of m.players) {
        if (p.placed || searched.has(p.slot)) continue;
        searched.add(p.slot);
        const def = m.crate[p.claim].def;
        outer: for (let rot = 0; rot < 4; rot++) {
          for (let ty = 2; ty < m.level.h - 2; ty++) {
            for (let tx = 2; tx < m.level.w - 2; tx++) {
              if (canPlace(m.level, m.placed, def, rot, tx, ty)) {
                const cells = footprint(def, rot);
                const w = Math.max(...cells.map((c) => c[0])) + 1;
                const h = Math.max(...cells.map((c) => c[1])) + 1;
                p.rot = rot;
                p.cursor = { x: (tx + (w - 1) / 2) * 16 + 8, y: (ty + (h - 1) / 2) * 16 + 8 };
                break outer;
              }
            }
          }
        }
      }
      tick(() => press({ confirmPressed: true }));
    } else if (m.phase === 'run') {
      tick(() => press({ right: true, jump: m.frame % 40 < 20, jumpPressed: m.frame % 40 === 0 }));
    } else if (m.phase === 'score' && m.phaseFrame > 95) {
      tick(() => press({ confirmPressed: true }));
    } else tick(() => NO_INPUT);
    m.drainEvents();
  }
  return m;
}

describe('match flow', () => {
  it('cycles pick → place → run → score headlessly', () => {
    const m = playMatch(1234, ['kb1', 'kb2', 'pad0']);
    expect(m.round).toBeGreaterThan(2);
    expect(m.placed.length).toBeGreaterThan(0);
  }, 60_000);

  it('reaches victory when someone keeps winning', () => {
    const m = new Match(77);
    m.step({ kb1: press({ confirmPressed: true }) });
    m.step({ kb1: press({ confirmPressed: true }) });
    expect(m.phase).toBe('pick');
    m.players[0].score = 49;
    // Force a finish by teleporting the runner onto the flag once the race starts.
    let f = 0;
    while (m.phase !== 'victory' && f++ < 60 * 60) {
      if (m.phase === 'pick') m.players[0].cursor = { x: m.crate[0].rect.x + 4, y: m.crate[0].rect.y + 4 };
      if (m.phase === 'place') {
        const p = m.players[0];
        outer: for (let ty = 2; ty < m.level.h - 2; ty++)
          for (let tx = 6; tx < m.level.w - 6; tx++) {
            p.cursor = { x: tx * 16 + 8, y: ty * 16 + 8 };
            if (m.canPlaceFor(p)) break outer;
          }
      }
      if (m.phase === 'run' && m.run && m.run.frame > 61) {
        const b = m.run.runners[0].body;
        b.x = m.level.goal.tx * 16 + 3;
        b.y = m.level.goal.ty * 16 + 2;
      }
      m.step({ kb1: press({ confirmPressed: m.phaseFrame % 20 === 15 }) });
      m.drainEvents();
    }
    expect(m.phase).toBe('victory');
    expect(m.winners).toEqual([0]);
  }, 60_000);

  it('is deterministic for the same seed and inputs', () => {
    const a = playMatch(42, ['kb1', 'kb2']);
    const b = playMatch(42, ['kb1', 'kb2']);
    expect(a.round).toBe(b.round);
    expect(a.players.map((p) => p.score)).toEqual(b.players.map((p) => p.score));
    expect(a.frame).toBe(b.frame);
  }, 60_000);
});

/** A started match, sitting in round 1's pick. Races time out fast so idle runners end the round. */
function started(players: number, rules: Partial<MatchRules>) {
  const m = new Match(5);
  m.rules = { ...m.rules, raceSeconds: 1, ...rules };
  for (let i = 0; i < players; i++) m.join(`p${i}`);
  m.startMatch();
  return m;
}

/** Skip pick and place, drop `finishers` on the flag, and play through the score screen. */
function playRound(m: Match, finishers: number[] = []) {
  m.startRun();
  while (m.phase === 'run') {
    const run = m.run!;
    for (const r of run.runners) {
      if (r.finished || run.frame <= RUN_COUNTDOWN || !finishers.includes(r.slot)) continue;
      r.body.x = m.level.goal.tx * 16 + 3;
      r.body.y = m.level.goal.ty * 16 + 2;
    }
    m.step({});
  }
  while (m.phase === 'score') m.step({});
  m.drainEvents();
}

describe('match end', () => {
  it('ends at the round limit and the top score wins', () => {
    const m = started(3, { maxRounds: 3 });
    playRound(m, [1]);
    playRound(m);
    expect(m.phase).toBe('pick');
    expect(m.round).toBe(3);
    playRound(m);
    expect(m.phase).toBe('victory');
    expect(m.round).toBe(3);
    expect(m.players.map((p) => p.score)).toEqual([0, 14, 0]);
    expect(m.winners).toEqual([1]);
  });

  it('lets the target score win before the limit', () => {
    const m = started(2, { targetScore: 14, maxRounds: 10 });
    playRound(m, [0]);
    expect(m.phase).toBe('victory');
    expect(m.round).toBe(1);
    expect(m.winners).toEqual([0]);
  });

  it('makes ties at the limit joint winners', () => {
    const m = started(3, { maxRounds: 2 });
    playRound(m, [0]);
    playRound(m, [2]);
    expect(m.phase).toBe('victory');
    expect(m.players.map((p) => p.score)).toEqual([14, 0, 14]);
    expect(m.winners).toEqual([0, 2]);
  });

  it('names no winner when nobody scored, and a rematch still starts clean', () => {
    const m = started(2, { maxRounds: 2 });
    playRound(m);
    playRound(m);
    expect(m.phase).toBe('victory');
    expect(m.players.map((p) => p.score)).toEqual([0, 0]);
    expect(m.winners).toEqual([]);
    while (m.phase === 'victory') m.step({ p0: press({ confirmPressed: true }) });
    expect(m.phase).toBe('lobby');
    m.step({ p0: press({ confirmPressed: true }), p1: press({ confirmPressed: true }) });
    expect(m.phase).toBe('pick');
    expect(m.round).toBe(1);
    expect(m.winners).toEqual([]);
  });

  it('is deterministic through the limit', () => {
    const play = () => {
      const m = started(3, { maxRounds: 2 });
      playRound(m, [1]);
      playRound(m, [1, 2]);
      return { frame: m.frame, round: m.round, scores: m.players.map((p) => p.score), winners: m.winners };
    };
    expect(play()).toEqual(play());
  });
});

describe('match lengths', () => {
  it.each(MATCH_LENGTHS)('$label ends on its target score', ({ targetScore, maxRounds }) => {
    const m = started(2, { targetScore, maxRounds });
    m.players[0].score = targetScore - 14;
    playRound(m, [0]);
    expect(m.phase).toBe('victory');
    expect(m.round).toBe(1);
    expect(m.winners).toEqual([0]);
  });

  it.each(MATCH_LENGTHS)('$label ends on its round limit', ({ targetScore, maxRounds }) => {
    const m = started(2, { targetScore, maxRounds });
    m.players[1].score = 3;
    for (let r = 1; r < maxRounds; r++) {
      playRound(m);
      expect(m.phase).toBe('pick');
    }
    playRound(m);
    expect(m.phase).toBe('victory');
    expect(m.round).toBe(maxRounds);
    expect(m.winners).toEqual([1]);
  });
});

describe('match rules', () => {
  afterEach(() => vi.unstubAllGlobals());
  const load = (saved: unknown) => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) });
    return loadRules();
  };
  const timers = { pickSeconds: 10, placeSeconds: 0, raceSeconds: 30 };

  it('stay plain data, defaulting to Normal with every timer default on offer', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_RULES))).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES).toMatchObject({ targetScore: 50, maxRounds: 15 });
    for (const k of Object.keys(RULE_CHOICES) as TimerRule[]) expect(RULE_CHOICES[k]).toContain(DEFAULT_RULES[k]);
  });

  it.each([
    [20, 'Short'],
    [30, 'Short'],
    [50, 'Normal'],
    [80, 'Long'],
    [120, 'Long'],
  ])('maps an old %i point save to %s and keeps its timers', (targetScore, label) => {
    const { targetScore: score, maxRounds } = MATCH_LENGTHS.find((l) => l.label === label)!;
    expect(load({ targetScore, ...timers })).toEqual({ targetScore: score, maxRounds, ...timers });
  });

  it('ignores an old round limit, which was usually just the default of 40', () => {
    expect(load({ targetScore: 50, maxRounds: 40, ...timers })).toMatchObject({ targetScore: 50, maxRounds: 15 });
  });

  it.each(MATCH_LENGTHS)('round-trips a saved $label', ({ targetScore, maxRounds }) => {
    expect(load({ targetScore, maxRounds, ...timers })).toEqual({ targetScore, maxRounds, ...timers });
  });

  it('falls back to Normal on ties and junk', () => {
    expect(nearestLength(40).label).toBe('Normal');
    expect(nearestLength(65).label).toBe('Normal');
    expect(load({ ...timers })).toMatchObject({ targetScore: 50, maxRounds: 15, ...timers });
    expect(load({ targetScore: 'lots' })).toMatchObject({ targetScore: 50, maxRounds: 15 });
  });
});

describe('big lobbies', () => {
  it('supports 8 players: join cap, 10-card crate on screen, everyone spawns', () => {
    const m = new Match(9);
    const devs = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];
    for (const d of devs) m.join(d);
    expect(m.players.length).toBe(8);
    m.startMatch();
    expect(m.crate.length).toBe(10);
    for (const c of m.crate) {
      expect(c.rect.x).toBeGreaterThanOrEqual(0);
      expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(768);
      expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(432);
    }
    m.startRun();
    expect(m.run!.runners.length).toBe(8);
    for (let i = 0; i < 70; i++) m.step({});
    expect(m.run!.runners.every((r) => r.alive)).toBe(true);
  });
});
