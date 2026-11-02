import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES, MATCH_LENGTHS } from '../src/game/rules';
import { sanitizeRules } from '../src/net/actions';
import { Predictor } from '../src/net/predict';
import { fromWire, hashMatch, restoreMatch, snapshotMatch, toWire } from '../src/net/snapshot';
import { giveItem, type ItemKind, ITEMS, spawnItem } from '../src/sim/items';
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
    'seed level phase phaseFrame frame round players placed plan crate run result prevScores winners nextUid charRolls pendingAdvance themeOverride rules nextSalt salt dryRounds forceProfile blood',
  derived: 'events', // render/audio only, drained every frame
};
const RUN_FIELDS = {
  saved: 'frame runners projectiles finishOrder kills endFrame propState seq timeLimit items itemSeed',
  // Rebuilt by the constructor from level, placed props and slots, or rebuilt every frame.
  derived: 'bleeds level placed resolved events safeZone solids out world goal grabs struck killY blood', // `blood` is the Match's list and `bleeds` its blood rule, both handed back on restore
};

/** A race two seconds in with every held item out: in hands, used, and loose in the world. */
function raceWithItems(): Match {
  const m = new Match(4242);
  for (const d of ['a:kb1', 'b:kb1', 'b:pad0']) m.join(d);
  m.startMatch();
  for (let f = 0; f < 6000 && m.phase !== 'run'; f++) m.step(inputsAt(m, f));
  expect(m.phase).toBe('run');
  for (let f = 0; f < 240; f++) m.step(raceInputs(f));
  const kinds = Object.keys(ITEMS) as ItemKind[];
  m.run!.runners.forEach((r, i) => giveItem(r, kinds[i % kinds.length]));
  kinds.forEach((kind, i) => spawnItem(m.run!, { kind, x: 200 + i * 24, y: 120, vx: 30, vy: 0 } as Parameters<typeof spawnItem>[1]));
  for (let f = 240; f < 300; f++) m.step(raceInputs(f));
  return m;
}

function raceInputs(f: number): Record<string, InputFrame> {
  const held = { right: true, run: true, jump: f % 30 < 14, jumpPressed: f % 30 === 0, usePressed: f % 47 === 0 };
  return { 'a:kb1': press(held), 'b:kb1': press(held), 'b:pad0': press({ ...held, right: false, left: true }) };
}

describe('snapshot coverage', () => {
  const howTo = 'add it to snapshotMatch/restoreMatch in src/net/snapshot.ts and bump SNAP_VERSION, or list it as derived here if a restore rebuilds it';

  it('accounts for every Match field', () => {
    const known = new Set(`${MATCH_FIELDS.saved} ${MATCH_FIELDS.derived}`.split(' '));
    const missing = Object.keys(new Match(1)).filter((k) => !known.has(k));
    expect(missing, `new Match state: ${howTo}`).toEqual([]);
  });

  it('keeps closures out of RunWorld fields, or prediction writes to the confirmed race', () => {
    const m = new Match(1);
    const run = new RunWorld(m.level, [], [0], 0);
    const closures = Object.entries(run)
      .filter(([k, v]) => k !== 'world' && (typeof v === 'function' || (v && typeof v === 'object' && Object.values(v).some((x) => typeof x === 'function'))))
      .map(([k]) => k);
    expect(closures, 'Make it a method on RunWorld, or rebuild it in src/net/predict.ts: a copied closure still points at the original').toEqual([]);
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

  it("carries a held controller cursor's speed ramp, or it would jump after a resync", () => {
    const a = new Match(4242);
    a.join('a:kb1');
    a.startMatch();
    for (let f = 0; f < 40; f++) a.step({ 'a:kb1': press({ right: true }) });
    expect(a.players[0].cursorHeld).toBeGreaterThan(0);
    const b = new Match(1);
    restoreMatch(b, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(b.players[0].cursorHeld).toBe(a.players[0].cursorHeld);
    for (const m of [a, b]) for (let f = 0; f < 20; f++) m.step({ 'a:kb1': press({ right: true }) });
    expect(b.players[0].cursor).toEqual(a.players[0].cursor);
    expect(hashMatch(b)).toBe(hashMatch(a));
  });

  it('round-trips a race with held items, loose items and smoke, then runs on identically', () => {
    const a = raceWithItems();
    expect(a.run!.items.drops.length).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(snapshotMatch(a))) as ReturnType<typeof snapshotMatch>;
    const b = new Match(1);
    restoreMatch(b, snap);
    expect(hashMatch(b)).toBe(hashMatch(a));
    expect(b.run!.itemSeed).toBe(a.run!.itemSeed);
    expect(b.run!.runners[0].items).toEqual(a.run!.runners[0].items);
    for (let f = 0; f < 240; f++) {
      a.step(raceInputs(f));
      b.step(raceInputs(f));
    }
    expect(hashMatch(b)).toBe(hashMatch(a));
  });

  it('prediction with items in play leaves the confirmed race alone', () => {
    const a = raceWithItems();
    const before = hashMatch(a);
    const copy = new Predictor().copy(a);
    for (let f = 0; f < 24; f++) copy.step(raceInputs(f));
    expect(copy.frame).toBe(a.frame + 24);
    expect(hashMatch(a)).toBe(before);
    for (let f = 0; f < 24; f++) a.step(raceInputs(f));
    expect(JSON.stringify(snapshotMatch(copy).run)).toBe(JSON.stringify(snapshotMatch(a).run));
  });

  it('ignores closures a profiler hangs on the live match', () => {
    const a = new Match(4242);
    const before = hashMatch(a);
    let wrapped = 0;
    const step = a.step.bind(a);
    a.step = (i) => {
      wrapped++;
      step(i);
    };
    expect(hashMatch(a)).toBe(before);
    const copy = new Predictor().copy(a);
    copy.step({});
    expect(wrapped).toBe(0);
    expect(a.frame).toBe(0);
    expect(copy.frame).toBe(1);
  });

  it("carries the host's match length through a rules action", () => {
    const short = MATCH_LENGTHS[0];
    const rules = sanitizeRules({ ...DEFAULT_RULES, targetScore: short.targetScore, maxRounds: short.maxRounds, pickSeconds: 20 });
    expect(rules).toMatchObject({ targetScore: short.targetScore, maxRounds: short.maxRounds, pickSeconds: 20 });
    // A forged pair lands on a real length rather than a match that never ends.
    expect(sanitizeRules({ targetScore: 30, maxRounds: 1e9 }).maxRounds).toBe(short.maxRounds);
  });
});
