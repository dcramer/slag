import { isStandable } from '../src/sim/reach';
import { describe, expect, it } from 'vitest';
import { deriveSeed, Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { Predictor } from '../src/net/predict';
import { bloodColor } from '../src/render/blood';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { BLOOD_CAP, type BloodCell, canBleed, FACE_UP, groundOf, OOZE_FRAMES, spillBlood } from '../src/sim/blood';
import { LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { isProtected, type Level, T_ONEWAY, T_SOLID, tileAt } from '../src/sim/level';
import { bodyAtCell, DEFAULT_SURFACE } from '../src/sim/physics';
import { castRay, COAT_PX, COAT_SURFACES, type PlacedProp, type ProjWorld, type PropDef, solidAt } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row
const SPOT = 15; // a clear column on the floor, away from both protected zones

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Flat floor from FLOOR down with a pit in columns 30..41, a wall hanging at column 24 and protected pockets at both ends. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < 30; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 8; y < FLOOR - 4; y++) tiles[y * LEVEL_W + 24] = 1;
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = LEVEL_W - 6; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [
      { x: 0, y: FLOOR - 3, w: 6, h: 5 },
      { x: LEVEL_W - 6, y: FLOOR - 3, w: 6, h: 5 },
    ],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/** A generated prop, by archetype, that passes `ok`. */
function propDef(kind: Parameters<typeof generateProp>[1], ok: (d: PropDef) => boolean): PropDef {
  for (let i = 0; i < 800; i++) {
    const d = generateProp(new Rng(i), kind, 'x');
    if (ok(d)) return d;
  }
  throw new Error(`no ${kind}`);
}

const hasBody = (d: PropDef, ...kinds: string[]) => d.modules.some((m) => m.type === 'body' && kinds.includes(m.material));
const stillBlock = (d: PropDef) => d.footprint.length === 1 && d.motion.type === 'none';
const plainBlock = () => propDef('platform', (d) => stillBlock(d) && hasBody(d, 'stone', 'metal', 'wood'));

type Killable = { kill(r: RunWorld['runners'][number], killer: number, cause: string): void };
const kill = (run: RunWorld, r: RunWorld['runners'][number]) => (run as unknown as Killable).kill(r, -1, 'hazard');

/** Stand runner `i` on the floor of column `tx` (or in cell row `ty`) and kill it the way a hazard does. */
function killAt(run: RunWorld, i: number, tx: number, ty = FLOOR - 1) {
  run.runners[i].body = bodyAtCell(tx, ty);
  kill(run, run.runners[i]);
}

const race = (blood: BloodCell[] = [], placed: PlacedProp[] = [], level = testLevel(), slots = [0, 1]) => new RunWorld(level, placed, slots, 0, 7, blood);
const stepRace = (run: RunWorld, frames: number, input: InputFrame = NO_INPUT) => {
  for (let i = 0; i < frames; i++) run.step(run.runners.map(() => input));
};
const floorCols = (blood: BloodCell[]) => blood.filter((c) => c.face === FACE_UP).map((c) => c.tx);
const iceStrips = (run: RunWorld) => run.solids.filter((s) => s.surface === COAT_SURFACES.ice);

/** A match on `level` in round 1's race, with `n` runners. */
function matchIn(n: number, level = testLevel()): Match {
  const m = new Match(4242);
  for (let i = 0; i < n; i++) m.join(`d${i}`);
  m.startMatch();
  m.level = level;
  m.startRun();
  return m;
}

describe('a death', () => {
  it('leaves a puddle under that runner, a short way along the floor either side', () => {
    const blood: BloodCell[] = [];
    const run = race(blood);
    run.frame = RUN_COUNTDOWN + 5;
    killAt(run, 1, SPOT);
    expect(blood.length).toBeGreaterThanOrEqual(3);
    expect(blood.length).toBeLessThanOrEqual(5);
    expect(blood.every((c) => c.slot === 1 && c.ty === FLOOR && c.face === FACE_UP)).toBe(true);
    const cols = floorCols(blood).sort((a, b) => a - b);
    expect(cols).toContain(SPOT);
    cols.forEach((c, i) => i && expect(c).toBe(cols[i - 1] + 1));
  });

  it('is in that player’s body color', () => {
    const m = matchIn(3);
    killAt(m.run!, 2, SPOT);
    expect(m.blood.length).toBeGreaterThan(0);
    const body = m.players[2].character.body;
    for (const c of m.blood) expect(bloodColor(m, c.slot).h).toBe(body.h);
    expect(bloodColor(m, 2)).not.toEqual(bloodColor(m, 0));
  });

  it('oozes out over a short moment instead of appearing at once', () => {
    const blood: BloodCell[] = [];
    const run = race(blood);
    run.frame = RUN_COUNTDOWN;
    killAt(run, 0, SPOT);
    stepRace(run, 1);
    expect(iceStrips(run)).toHaveLength(1);
    stepRace(run, OOZE_FRAMES * 3);
    expect(iceStrips(run)).toHaveLength(blood.length);
  });

  it('reaches a floor just below the feet, but not from high in the air', () => {
    const low: BloodCell[] = [];
    const high: BloodCell[] = [];
    killAt(race(low), 0, SPOT, FLOOR - 3);
    killAt(race(high), 0, SPOT, FLOOR - 7);
    expect(low.length).toBeGreaterThan(0);
    expect(high).toEqual([]);
  });

  it('leaves nothing in the pit or off the level', () => {
    const level = testLevel();
    const blood: BloodCell[] = [];
    const run = race(blood, [], level, [0]);
    const r = run.runners[0];
    r.body = bodyAtCell(35, 5);
    r.body.y = level.h * TILE + 4;
    run.frame = RUN_COUNTDOWN + 1;
    stepRace(run, 1);
    expect(r.cause).toBe('fall');
    expect(blood).toEqual([]);

    for (const tx of [-3, LEVEL_W + 3]) killAt(race(blood), 0, tx);
    killAt(race(blood), 0, SPOT, -8);
    expect(blood).toEqual([]);
  });

  it('never lands in a protected zone, so nobody starts a round on it', () => {
    const blood: BloodCell[] = [];
    const level = testLevel();
    for (const tx of [1, 3, 5, 6, 7, LEVEL_W - 2, LEVEL_W - 5]) killAt(race(blood, [], level), 0, tx);
    expect(blood.length).toBeGreaterThan(0);
    expect(blood.every((c) => c.tx >= 6 && c.tx < LEVEL_W - 6)).toBe(true);
  });

  it('smears a wall when no floor is near, and that wall keeps its wall jump', () => {
    const blood: BloodCell[] = [];
    const run = race(blood);
    run.frame = RUN_COUNTDOWN;
    const r = run.runners[0];
    r.body = bodyAtCell(23, 11);
    r.body.x = 24 * TILE - r.body.w - 1;
    kill(run, r);
    expect(blood.length).toBeGreaterThan(0);
    expect(blood.every((c) => c.tx === 24 && c.face === 2)).toBe(true);
    stepRace(run, OOZE_FRAMES * 3);
    expect(iceStrips(run)).toEqual([]);
  });

  it('drips through a one-way platform and stays out of one-tile gaps', () => {
    const level = testLevel();
    level.tiles[(FLOOR - 2) * LEVEL_W + SPOT] = T_ONEWAY;
    for (let x = SPOT + 4; x < SPOT + 8; x++) level.tiles[(FLOOR - 2) * LEVEL_W + x] = 1; // a ceiling one open tile over the floor
    const g = groundOf(level, []);
    expect(canBleed(g, SPOT, FLOOR - 2, FACE_UP)).toBe(false);
    expect(canBleed(g, SPOT + 5, FLOOR, FACE_UP)).toBe(false);
    const blood: BloodCell[] = [];
    // Standing on the platform: the floor below it is one tile under one open cell, which is a one-tile gap too.
    killAt(race(blood, [], level), 0, SPOT, FLOOR - 3);
    expect(blood).toEqual([]);
    level.tiles[(FLOOR - 2) * LEVEL_W + SPOT] = 0;
    level.tiles[(FLOOR - 3) * LEVEL_W + SPOT] = T_ONEWAY;
    killAt(race(blood, [], level), 0, SPOT, FLOOR - 4);
    expect(floorCols(blood)).toContain(SPOT);
  });

  it('lands on plain still blocks, and not on what already is a surface', () => {
    const level = testLevel();
    const placed: PlacedProp[] = [
      { uid: 1, def: plainBlock(), owner: 0, tx: SPOT, ty: FLOOR - 5, rot: 0 },
      {
        uid: 2,
        def: propDef('platform', (d) => stillBlock(d) && hasBody(d, 'ice', 'goo', 'jelly', 'conveyor')),
        owner: 0,
        tx: SPOT + 4,
        ty: FLOOR - 5,
        rot: 0,
      },
      { uid: 3, def: propDef('platform', (d) => d.motion.type !== 'none'), owner: 0, tx: SPOT - 5, ty: FLOOR - 5, rot: 0 },
    ];
    const g = groundOf(level, placed);
    expect(canBleed(g, SPOT, FLOOR - 5, FACE_UP)).toBe(true);
    expect(canBleed(g, SPOT + 4, FLOOR - 5, FACE_UP)).toBe(false);
    expect(canBleed(g, SPOT - 5, FLOOR - 5, FACE_UP)).toBe(false);
  });
});

describe('footing', () => {
  it('is the ice coat, for every runner, the victim in a later round included', () => {
    const blood: BloodCell[] = [];
    const run = race(blood, [], testLevel(), [0, 1, 2]);
    run.frame = RUN_COUNTDOWN;
    killAt(run, 2, SPOT);
    stepRace(run, OOZE_FRAMES * 3);
    const later = race(blood, [], run.level, [2]);
    later.frame = RUN_COUNTDOWN;
    for (const [w, r] of [
      [run, run.runners[1]],
      [later, later.runners[0]],
    ] as const) {
      r.body = bodyAtCell(SPOT, FLOOR - 1);
      r.body.y -= 8;
      stepRace(w, 30);
      expect(r.body.onGround).toBe(true);
      expect(r.body.surface).toBe(COAT_SURFACES.ice);
      expect(r.body.y + r.body.h).toBe(FLOOR * TILE - COAT_PX);
    }
  });

  it('keeps a runner sliding where a clean floor stops them, and takes them from bare ground without a stumble', () => {
    const slide = (bloody: boolean) => {
      const blood: BloodCell[] = bloody ? Array.from({ length: 18 }, (_, i) => ({ tx: 12 + i, ty: FLOOR, face: FACE_UP, slot: 1, age: 0, at: 0 })) : [];
      const run = race(blood, [], testLevel(), [0]);
      run.frame = RUN_COUNTDOWN;
      const b = run.runners[0].body;
      Object.assign(b, bodyAtCell(7, FLOOR - 1));
      for (let f = 0; f < 40; f++) run.step([press({ right: true, run: true })]);
      const vx = b.vx;
      for (let f = 0; f < 14; f++) run.step([NO_INPUT]);
      return { vx, left: b.vx, surface: b.surface };
    };
    const clean = slide(false);
    const wet = slide(true);
    expect(clean.vx).toBeGreaterThan(PHYS.walkSpeed);
    expect(wet.vx).toBeGreaterThan(PHYS.walkSpeed);
    expect(wet.surface).toBe(COAT_SURFACES.ice);
    expect(wet.left).toBeGreaterThan(wet.vx * 0.85);
    expect(wet.left).toBeGreaterThan(clean.left * 1.5);
  });

  it('gives way to a goo patch on top of it while the patch lasts', () => {
    const blood: BloodCell[] = [{ tx: SPOT, ty: FLOOR, face: FACE_UP, slot: 0, age: 1, at: 0 }];
    const run = race(blood, [], testLevel(), [0]);
    run.projectiles.push({ ammo: 'goo', stuck: FACE_UP, hx: SPOT, hy: FLOOR, until: 1000, id: 1 } as unknown as RunWorld['projectiles'][number]);
    run.frame = RUN_COUNTDOWN;
    const r = run.runners[0];
    r.body = bodyAtCell(SPOT, FLOOR - 1);
    r.body.y -= 4;
    stepRace(run, 10);
    expect(r.body.surface).toBe(COAT_SURFACES.slime);
  });

  it('is only footing: rays and shots go through to the floor under it', () => {
    const blood: BloodCell[] = [{ tx: SPOT, ty: FLOOR, face: FACE_UP, slot: 0, age: 1, at: 0 }];
    const run = race(blood);
    stepRace(run, 1);
    const x = (SPOT + 0.5) * TILE;
    const y = (FLOOR - 5) * TILE;
    expect(iceStrips(run)).toHaveLength(1);
    expect(castRay(run.level, run.solids, x, y, 0, 1, 100, 0, -1)).toBe(FLOOR * TILE - y);
    const w = { level: run.level, solids: run.solids } as unknown as ProjWorld;
    expect(solidAt(w, x, FLOOR * TILE - 1, 10)).toBe(false);
  });

  it('adds nothing to a clean race', () => {
    const run = race();
    run.frame = RUN_COUNTDOWN;
    stepRace(run, 40);
    expect(run.runners[0].body.surface).toEqual(DEFAULT_SURFACE);
    expect(run.solids).toEqual([]);
  });
});

describe('across rounds', () => {
  /** Run the current race out: a solo runner sent to the pit ends it, on no floor. */
  function finishRace(m: Match) {
    for (const r of m.run!.active) r.body = { ...r.body, x: 35 * TILE, y: m.level.h * TILE + 4 };
    m.run!.frame = Math.max(m.run!.frame, RUN_COUNTDOWN);
    for (let f = 0; f < 200 && m.phase === 'run'; f++) m.step({});
    expect(m.phase).toBe('score');
  }
  const nextRace = (m: Match) => {
    (m as unknown as { startRound(): void }).startRound();
    m.startRun();
  };

  it('is there through rounds R, R+1 and R+2 and clears when R+2 ends', () => {
    const m = matchIn(1);
    const made = m.round;
    killAt(m.run!, 0, SPOT);
    const cols = floorCols(m.blood);
    expect(cols.length).toBeGreaterThan(0);
    for (const c of m.blood) c.at = Math.min(c.at, m.run!.frame); // the race ended early; its ooze is done

    for (; m.round < made + 2;) {
      finishRace(m);
      expect(floorCols(m.blood)).toEqual(cols);
      expect(m.blood.every((c) => c.at === 0)).toBe(true);
      nextRace(m);
      // On the first frame of the next race it's already underfoot: nobody waits for last round's ooze.
      m.step({});
      expect(iceStrips(m.run!)).toHaveLength(cols.length);
    }
    expect(m.round).toBe(made + 2);
    finishRace(m);
    expect(m.blood).toEqual([]);
  });

  it('is renewed by a new death on the same floor, in the new color', () => {
    const m = matchIn(2);
    killAt(m.run!, 0, SPOT);
    for (const c of m.blood) c.age = 2;
    killAt(m.run!, 1, SPOT);
    const center = m.blood.find((c) => c.tx === SPOT)!;
    expect(center.slot).toBe(1);
    expect(center.age).toBe(0);
    expect(new Set(m.blood.map((c) => c.tx)).size).toBe(m.blood.length);
  });

  it('is gone with a new match or a new level', () => {
    const m = matchIn(1);
    killAt(m.run!, 0, SPOT);
    m.startMatch();
    expect(m.blood).toEqual([]);
    m.level = testLevel();
    m.startRun();
    killAt(m.run!, 0, SPOT);
    m.newLevel(9);
    expect(m.blood).toEqual([]);
  });

  it('holds its cap, oldest first, however long 8 players keep dying', () => {
    const level = testLevel();
    for (let y = 2; y < 10; y += 3) for (let x = 7; x < 24; x++) level.tiles[y * LEVEL_W + x] = 1;
    const g = groundOf(level, []);
    const blood: BloodCell[] = [];
    for (let i = 0; i < 600; i++) {
      const row = [1, 4, 7, FLOOR - 1][i % 4];
      spillBlood(blood, g, bodyAtCell(7 + ((i * 3) % 17), row), i % 8, i, new Rng(deriveSeed(2, i)));
    }
    expect(blood.length).toBe(BLOOD_CAP);
    expect(new Set(blood.map((c) => `${c.tx},${c.ty},${c.face}`)).size).toBe(BLOOD_CAP);
    expect(blood.at(-1)!.slot).toBe(599 % 8);
  });
});

describe('losing its surface', () => {
  const cells = (blood: BloodCell[]) => blood.map((c) => `${c.tx},${c.ty}`);

  /** Blood on the floor at SPOT, and a match in the place phase with `def` in hand, aimed at cell (tx, ty). */
  function placing(def: PropDef, tx: number, ty: number) {
    const m = matchIn(1);
    killAt(m.run!, 0, SPOT);
    const p = m.players[0];
    m.crate = [{ def, claimedBy: 0, rect: { x: 0, y: 0, w: 1, h: 1 } }];
    p.claim = 0;
    p.placed = false;
    p.cursor = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    m.run = null;
    m.phase = 'place';
    m.phaseFrame = 20;
    return { m, confirm: () => m.step({ d0: press({ confirmPressed: true }) }) };
  }

  it('goes with the terrain a bomb takes, and only where the blast reached', () => {
    const { m, confirm } = placing(
      propDef('bomb', (d) => d.modules.some((x) => x.type === 'bomb' && x.radius < 2)),
      SPOT,
      FLOOR,
    );
    const before = m.blood.length;
    expect(before).toBeGreaterThan(0);
    confirm();
    expect(m.players[0].placed).toBe(true);
    expect(m.level.tiles[FLOOR * LEVEL_W + SPOT]).toBe(0);
    expect(cells(m.blood)).not.toContain(`${SPOT},${FLOOR}`);
    for (const c of m.blood) expect(m.level.tiles[c.ty * LEVEL_W + c.tx]).toBe(1);
  });

  it('is washed off by a blast that spares the terrain', () => {
    const { m, confirm } = placing(
      propDef('emp', () => true),
      SPOT,
      FLOOR - 1,
    );
    confirm();
    expect(m.players[0].placed).toBe(true);
    expect(m.level.tiles[FLOOR * LEVEL_W + SPOT]).toBe(1);
    expect(cells(m.blood)).not.toContain(`${SPOT},${FLOOR}`);
  });

  it('goes when a time bomb goes off at the start of the race', () => {
    const charge = propDef('timebomb', (d) => d.modules.some((x) => x.type === 'bomb' && x.target !== 'props'));
    const { m } = placing(charge, SPOT, FLOOR);
    m.placed.push({ uid: 900, def: charge, owner: 0, tx: SPOT, ty: FLOOR - 1, rot: 0 });
    m.startRun();
    expect(m.placed).toEqual([]);
    expect(cells(m.blood)).not.toContain(`${SPOT},${FLOOR}`);
  });

  it('is covered by a block placed on it, and the rest of the puddle stays', () => {
    const { m, confirm } = placing(plainBlock(), SPOT, FLOOR - 1);
    const n = m.blood.length;
    confirm();
    expect(m.placed).toHaveLength(1);
    expect(m.blood).toHaveLength(n - 1);
    expect(cells(m.blood)).not.toContain(`${SPOT},${FLOOR}`);
  });

  it('gives way to a coat laid over it', () => {
    const { m, confirm } = placing(
      propDef('icecoat', (d) => d.footprint.length === 3),
      SPOT,
      FLOOR,
    );
    confirm();
    expect(m.placed).toHaveLength(1);
    expect(cells(m.blood)).not.toContain(`${SPOT},${FLOOR}`);
  });

  it('goes with the placed block it was on', () => {
    const m = matchIn(1);
    m.placed.push({ uid: 50, def: plainBlock(), owner: 0, tx: SPOT, ty: FLOOR - 4, rot: 0 });
    m.startRun();
    killAt(m.run!, 0, SPOT, FLOOR - 5);
    expect(cells(m.blood)).toContain(`${SPOT},${FLOOR - 4}`);
    m.placed = [];
    m.startRun();
    expect(m.blood).toEqual([]);
  });
});

describe('in a networked match', () => {
  const walk = (f: number) => ({ d0: press({ right: true }), d1: press({ left: true, jumpPressed: f % 40 === 0 }), d2: press({ right: true, run: true }) });

  /** A race with one scripted death on the floor. */
  function played() {
    const m = matchIn(3);
    for (let f = 0; f < 80; f++) m.step(walk(f));
    killAt(m.run!, 1, SPOT);
    for (let f = 80; f < 200; f++) m.step(walk(f));
    return m;
  }

  it('comes out the same from two identical matches', () => {
    const a = played();
    const b = played();
    expect(a.blood.length).toBeGreaterThan(0);
    expect(a.blood).toEqual(b.blood);
    expect(hashMatch(a)).toBe(hashMatch(b));
  });

  it('round-trips a snapshot mid-ooze and runs on identically', () => {
    // A generated level, not the test floor: restoring refuses terrain this build doesn't generate.
    const a = new Match(4242);
    for (let i = 0; i < 3; i++) a.join(`d${i}`);
    a.startMatch();
    a.startRun();
    for (let f = 0; f < RUN_COUNTDOWN + 5; f++) a.step({});
    const l = a.level;
    const floors: [number, number][] = [];
    for (let ty = 2; ty < l.h - 1; ty++) {
      for (let tx = 4; tx < l.w - 4; tx++) if (isStandable(l, tx, ty) && tileAt(l, tx, ty + 1) === T_SOLID && !isProtected(l, tx, ty)) floors.push([tx, ty]);
    }
    expect(floors.length).toBeGreaterThan(1);
    killAt(a.run!, 1, ...floors[0]);
    expect(a.blood.length).toBeGreaterThan(0);
    a.step({});
    const b = new Match(1);
    restoreMatch(b, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(b.blood).toEqual(a.blood);
    expect(b.run!.blood).toBe(b.blood);
    expect(hashMatch(b)).toBe(hashMatch(a));
    for (let f = 0; f < 90; f++) {
      a.step(walk(f));
      b.step(walk(f));
    }
    expect(iceStrips(b.run!)).toHaveLength(iceStrips(a.run!).length);
    expect(hashMatch(b)).toBe(hashMatch(a));
    // A later death on the restored race lands in the match's own list.
    killAt(b.run!, 2, ...floors[floors.length - 1]);
    expect(b.blood.some((c) => c.slot === 2)).toBe(true);
  });

  it('keeps the race and the match on one list through a resync onto the same race', () => {
    const a = new Match(4242);
    a.join('d0');
    a.startMatch();
    a.startRun();
    a.blood.push({ tx: SPOT, ty: FLOOR, face: FACE_UP, slot: 0, age: 0, at: 0 });
    const run = a.run;
    restoreMatch(a, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(a.run).toBe(run);
    expect(a.run!.blood).toBe(a.blood);
  });

  it('changes the state hash, so a peer whose blood drifts gets caught', () => {
    const a = matchIn(2);
    const clean = hashMatch(a);
    a.blood.push({ tx: SPOT, ty: FLOOR, face: FACE_UP, slot: 0, age: 0, at: 0 });
    expect(hashMatch(a)).not.toBe(clean);
  });

  it('prediction bleeds on its own copy and leaves the confirmed match alone', () => {
    const m = matchIn(3);
    killAt(m.run!, 0, SPOT);
    const before = hashMatch(m);
    const count = m.blood.length;
    const copy = new Predictor().copy(m);
    killAt(copy.run!, 1, SPOT + 4);
    for (let f = 0; f < 30; f++) copy.step({});
    expect(copy.blood.length).toBeGreaterThan(count);
    expect(m.blood).toHaveLength(count);
    expect(hashMatch(m)).toBe(before);
  });
});
