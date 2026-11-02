import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { fromWire, hashMatch, restoreMatch, snapshotMatch, toWire } from '../src/net/snapshot';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Scripted inputs for frame f: join, ready, wander cursors, click, run right and hop. */
function inputsAt(m: Match, f: number): Record<string, InputFrame> {
  const devs = ['a:kb1', 'b:kb1', 'b:pad0'];
  return Object.fromEntries(
    devs.map((d, i) => {
      if (f < 2) return [d, press({ confirmPressed: true })];
      if (m.phase === 'pick' || m.phase === 'place') {
        const x = 100 + ((f * (3 + i)) % 560);
        return [d, press({ pointer: { x, y: 120 + ((f * 7) % 200) }, confirmPressed: f % 29 === i * 5, altPressed: f % 41 === 0 })];
      }
      if (m.phase === 'run') return [d, press({ right: true, jump: (f + i * 7) % 30 < 14, jumpPressed: (f + i * 7) % 30 === 0 })];
      return [d, press({ confirmPressed: f % 50 === 0 })];
    }),
  );
}

describe('match snapshots', () => {
  it('round-trips exotic numbers and maps through JSON', () => {
    const v = { a: -0, b: NaN, c: Infinity, d: new Map([[1, { e: -Infinity }]]), f: new Uint8Array([1, 2, 3, 250]) };
    const back = fromWire(JSON.parse(JSON.stringify(toWire(v)))) as typeof v;
    expect(Object.is(back.a, -0)).toBe(true);
    expect(back.b).toBeNaN();
    expect(back.c).toBe(Infinity);
    expect(back.d.get(1)!.e).toBe(-Infinity);
    expect([...back.f]).toEqual([1, 2, 3, 250]);
  });

  it('snapshot → restore → step N matches stepping the original N frames, in every phase', () => {
    const a = new Match(4242);
    a.rules = { ...a.rules, pickSeconds: 4, placeSeconds: 4, raceSeconds: 8 };
    const checked = new Set<string>();
    for (let f = 0; f < 60 * 60 && checked.size < 4; f++) {
      if (f > 3 && f % 97 === 0 && !checked.has(a.phase)) {
        checked.add(a.phase);
        const snap = JSON.parse(JSON.stringify(snapshotMatch(a)));
        const b = new Match(1);
        restoreMatch(b, snap);
        expect(hashMatch(b)).toBe(hashMatch(a));
        for (let k = 0; k < 120; k++) {
          const fa = f + k;
          const ia = inputsAt(a, fa);
          a.step(ia);
          b.step(inputsAt(b, fa));
        }
        expect(hashMatch(b), `phase ${[...checked].pop()}`).toBe(hashMatch(a));
        f += 119;
        continue;
      }
      a.step(inputsAt(a, f));
      a.drainEvents();
    }
    expect([...checked]).toEqual(expect.arrayContaining(['pick', 'place', 'run']));
  }, 60_000);
});
