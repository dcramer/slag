import { describe, expect, it } from 'vitest';
import { POINTS, scoreRound } from '../src/game/scoring';

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
    const r = scoreRound([0, 1, 2], [2], [{ victim: 0, killer: 2 }, { victim: 1, killer: 1 }]);
    expect(total(r, 2)).toBe(POINTS.finish + POINTS.first + POINTS.trap);
    expect(total(r, 1)).toBe(0); // self-kill earns nothing
    expect(total(r, 0)).toBe(0);
  });
  it('solo play just rewards finishing', () => {
    const r = scoreRound([0], [0], []);
    expect(r.verdict).toBe('normal');
    expect(total(r, 0)).toBe(POINTS.finish);
  });
});
