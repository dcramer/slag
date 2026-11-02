import { describe, expect, it } from 'vitest';
import { POINTS, scoreRound } from '../src/game/scoring';
import { standings } from '../src/render/hud-kit';

const total = (r: ReturnType<typeof scoreRound>, slot: number) => r.awards.filter((a) => a.slot === slot).reduce((s, a) => s + a.points, 0);

describe('scoring', () => {
  it('nobody scores when everyone finishes', () => {
    expect(scoreRound([0, 1], [1, 0], []).verdict).toBe('too-easy');
  });
  it('nobody scores when nobody finishes, even with trap kills', () => {
    const r = scoreRound([0, 1], [], [{ victim: 0, killer: 1 }]);
    expect(r.verdict).toBe('too-hard');
    expect(r.awards).toEqual([]);
  });
  it('finish, first, and trap points', () => {
    const r = scoreRound(
      [0, 1, 2],
      [2],
      [
        { victim: 0, killer: 2 },
        { victim: 1, killer: 1 },
      ],
    );
    expect(total(r, 2)).toBe(POINTS.finish + POINTS.first + POINTS.trap);
    expect(total(r, 1)).toBe(0); // self-kill earns nothing
    expect(total(r, 0)).toBe(0);
  });
  it('only finishers earn kill points, once per kill', () => {
    const r = scoreRound(
      [0, 1, 2, 3],
      [1],
      [
        { victim: 0, killer: 1 },
        { victim: 2, killer: 1 },
        { victim: 1, killer: 3 },
      ],
    );
    expect(total(r, 1)).toBe(POINTS.finish + POINTS.first + POINTS.trap * 2);
    expect(total(r, 3)).toBe(0); // a kill without reaching the flag pays nothing
  });
  it('solo play just rewards finishing', () => {
    const r = scoreRound([0], [0], []);
    expect(r.verdict).toBe('normal');
    expect(total(r, 0)).toBe(POINTS.finish);
  });
});

describe('standings', () => {
  const players = [
    { slot: 0, score: 6 },
    { slot: 1, score: 27 },
    { slot: 2, score: 13 },
    { slot: 3, score: 27 },
    { slot: 5, score: 0 },
  ];
  const slots = (points: (p: (typeof players)[number]) => number) => standings(players, points).map((p) => p.slot);

  it('lists most points first and breaks ties by slot', () => {
    expect(slots((p) => p.score)).toEqual([1, 3, 2, 0, 5]);
  });
  it('gives a stable order however the input is shuffled', () => {
    const [a, b, c, d, e] = players;
    expect(standings([d, a, e, b, c], (p) => p.score).map((p) => p.slot)).toEqual([1, 3, 2, 0, 5]);
  });
  it('falls back to slot order when nobody has points', () => {
    expect(slots(() => 0)).toEqual([0, 1, 2, 3, 5]);
  });
  it('leaves the sim-side player list alone', () => {
    slots((p) => p.score);
    expect(players.map((p) => p.slot)).toEqual([0, 1, 2, 3, 5]);
  });
});
