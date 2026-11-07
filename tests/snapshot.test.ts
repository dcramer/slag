import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES, MATCH_LENGTHS, withMode } from '../src/game/rules';
import { sanitizeRules } from '../src/net/actions';
import { Predictor } from '../src/net/predict';
import { fromWire, hashMatch, hashSnap, restoreMatch, snapshotMatch, toWire } from '../src/net/snapshot';
import { giveItem, type ItemKind, ITEMS, spawnItem } from '../src/sim/items';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { SHAPE_FILE, type SnapShape, snapshotShape, unseen } from './lib/snapshot-shape';

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
    'seed level phase phaseFrame frame round bout players placed plan crate run result prevScores winners nextUid charRolls pendingAdvance themeOverride rules nextSalt salt dryRounds forceProfile blood',
  derived: 'events', // render/audio only, drained every frame
};
const RUN_FIELDS = {
  saved: 'frame runners projectiles finishOrder kills endFrame propState seq timeLimit items itemSeed slag screen parcels',
  // Rebuilt by the constructor from level, placed props and slots, or rebuilt every frame.
  derived: 'bleeds rules level placed resolved events features safeZone safeZones solids out world goal grabs struck killY blood', // `blood` is the Match's list and `bleeds` its blood rule, both handed back on restore, `rules` its mode's (game/modes.ts)
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
  return { 'a:kb1': press(held), 'b:kb1': press(held), 'b:pad0': press({ ...held, run: false, right: f % 40 >= 10, left: f % 40 < 10 }) };
}

describe('snapshot coverage', () => {
  const howTo =
    'add it to snapshotMatch/restoreMatch in src/net/snapshot.ts, or list it as derived here if a restore rebuilds it. On main, also bump SNAP_VERSION; in a worktree branch leave it, `pnpm land` bumps it once for the batch';

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

  it('carries nothing the committed wire shape has not seen, nested fields and all', () => {
    const committed = JSON.parse(readFileSync(SHAPE_FILE, 'utf8')) as SnapShape;
    expect(
      unseen(committed, snapshotShape()),
      `the snapshot shape changed (these paths are new to ${SHAPE_FILE}): run \`pnpm snap:shape\` and commit the file. Don't bump SNAP_VERSION in a branch, \`pnpm land\` bumps it once when the file changes`,
    ).toEqual([]);
  }, 20_000);
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

  it('hashes every NaN alike: its bits are up to the engine, and peers in sync must agree', () => {
    const nan = (hi: number, lo: number) => new Float64Array(new Uint32Array([lo, hi]).buffer)[0];
    const snap = (x: number) => ({ ...snapshotMatch(new Match(7)), rules: { ...DEFAULT_RULES, targetScore: x } });
    const quiet = nan(0x7ff80000, 0);
    const other = nan(0xfff80000, 1); // negative, with a payload: what x86 makes of 0/0, plus junk
    expect(Number.isNaN(other)).toBe(true);
    expect(hashSnap(snap(quiet))).toBe(hashSnap(snap(other)));
    expect(hashSnap(snap(quiet))).not.toBe(hashSnap(snap(0)));
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
      if (f === 2) a.start(); // everyone joined and ready
      a.step(inputsAt(a, f));
      a.drainEvents();
    }
    expect([...checked]).toEqual(expect.arrayContaining(['pick', 'place', 'run']));
  }, 60_000);

  it('restores a brawl mid-bout and carries on into the next bout in lockstep', () => {
    const a = new Match(31, undefined, { ...withMode(DEFAULT_RULES, 'brawl'), pickSeconds: 10, placeSeconds: 15 });
    for (const d of ['a:kb1', 'b:kb1']) a.join(d);
    a.startMatch();
    // Idle through pick and place (the timers hand out cards and forfeit spots); in a race b holds self-destruct.
    const inputs = (m: Match): Record<string, InputFrame> =>
      m.phase === 'run' ? { 'b:kb1': press({ alt: true, altPressed: m.run!.frame % 200 === 60 }) } : {};
    for (let f = 0; f < 60 * 60 && !(a.phase === 'run' && a.bout === 2 && a.run!.frame === 90); f++) a.step(inputs(a));
    expect(a.bout).toBe(2);
    const b = new Match(1);
    restoreMatch(b, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(b.bout).toBe(2);
    expect(hashMatch(b)).toBe(hashMatch(a));
    for (let f = 0; f < 60 * 60 && !(a.phase === 'run' && a.bout === 3); f++) {
      a.step(inputs(a));
      b.step(inputs(b));
    }
    expect(b.phase).toBe('run');
    expect(b.bout).toBe(3);
    expect(hashMatch(b)).toBe(hashMatch(a));
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

  it('round-trips a race with a Pocket Block standing, a tax shell in flight and a bat wound up', () => {
    const a = new Match(4242);
    for (const d of ['a:kb1', 'b:kb1', 'b:pad0']) a.join(d);
    a.startMatch();
    for (let f = 0; f < 6000 && a.phase !== 'run'; f++) a.step(inputsAt(a, f));
    for (let f = 0; f < 80; f++) a.step(raceInputs(1));
    const [r0, r1, r2] = a.run!.runners;
    expect([r0, r1, r2].every((r) => r.alive)).toBe(true);
    giveItem(r0, 'block');
    giveItem(r1, 'tax');
    giveItem(r2, 'bat');
    a.step({ 'a:kb1': press({ usePressed: true }), 'b:kb1': press({ usePressed: true }), 'b:pad0': press({ usePressed: true }) });
    expect(a.run!.items.shells).toHaveLength(1);
    expect(r2.items.windup).toBeGreaterThan(0);
    // Wherever runner 0 stood, there's a block in the world to carry.
    if (!a.run!.items.blocks.length) a.run!.items.blocks.push({ tx: 20, ty: 3, born: a.run!.frame, until: a.run!.frame + 240, owner: 0 });
    const snap = JSON.parse(JSON.stringify(snapshotMatch(a))) as ReturnType<typeof snapshotMatch>;
    const b = new Match(1);
    restoreMatch(b, snap);
    expect(hashMatch(b)).toBe(hashMatch(a));
    expect(b.run!.items.blocks).toEqual(a.run!.items.blocks);
    for (let f = 0; f < 120; f++) {
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
