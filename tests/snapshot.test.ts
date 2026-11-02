import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { fromWire, hashMatch, restoreMatch, snapshotMatch, toWire } from '../src/net/snapshot';
import { RunWorld } from '../src/sim/run';
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

/**
 * Every instance field of Match and RunWorld, and how it crosses the wire. A field
 * missing from a snapshot desyncs only after a join or a migration, which no
 * ordinary test sees, so adding one fails here until it's decided.
 */
const MATCH_FIELDS = {
  saved:
    'seed level phase phaseFrame frame round players placed crate run result prevScores winners nextUid charRolls pendingAdvance themeOverride rules nextSalt salt',
  derived: 'events', // render/audio only, drained every frame
};
const RUN_FIELDS = {
  saved: 'frame runners projectiles finishOrder kills endFrame propState seq timeLimit',
  // Rebuilt by the constructor from level, placed props and slots, or rebuilt every frame.
  derived: 'level placed resolved events safeZone solids out world goal',
};

describe('snapshot coverage', () => {
  const howTo = 'add it to snapshotMatch/restoreMatch in src/net/snapshot.ts and bump SNAP_VERSION, or list it as derived here if a restore rebuilds it';

  it('accounts for every Match field', () => {
    const known = new Set(`${MATCH_FIELDS.saved} ${MATCH_FIELDS.derived}`.split(' '));
    const missing = Object.keys(new Match(1)).filter((k) => !known.has(k));
    expect(missing, `new Match state: ${howTo}`).toEqual([]);
  });

  it('accounts for every RunWorld field', () => {
    const m = new Match(1);
    m.join('a:kb1');
    m.startMatch();
    const run = new RunWorld(m.level, [], [0], 0);
    const known = new Set(`${RUN_FIELDS.saved} ${RUN_FIELDS.derived}`.split(' '));
    const missing = Object.keys(run).filter((k) => !known.has(k));
    expect(missing, `new RunWorld state: ${howTo}`).toEqual([]);
  });
});

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
