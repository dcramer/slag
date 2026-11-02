import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  barrierOf,
  COAT_SURFACES,
  detonate,
  footprint,
  type Module,
  type Motion,
  motionOffset,
  type PlacedProp,
  type PropDef,
  resolveProp,
  spotAt,
} from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row
const LIFT = 100_001; // a set piece's uid

/** Flat floor from FLOOR down, plus a wall column at x=30 rising to row 10. */
function testLevel(setPieces: PlacedProp[] = []): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 5 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces,
  };
}

const STYLE = { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 } as const;

function piece(uid: number, modules: Module[], motion: Motion, footprint: [number, number][], tx: number, ty: number): PlacedProp {
  const def: PropDef = { key: `p${uid}`, name: 'Piece', maker: 'the level', archetype: 'platform', role: 'build', style: STYLE, motion, modules, footprint };
  return { uid, def, owner: -1, tx, ty, rot: 0 };
}

const metal = (cells: [number, number][]): Module => ({ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });

/** A three-wide lift at (10, 16) that rises `range` tiles and back, parked `dwell` frames at each end. */
function lift(range = 4, dwell = 40, angle = -Math.PI / 2, tx = 10, ty = 16): PlacedProp {
  const cells: [number, number][] = [
    [0, 0],
    [1, 0],
    [2, 0],
  ];
  return piece(LIFT, [metal(cells)], { type: 'rail', angle, range, period: 120, dwell }, cells, tx, ty);
}

/** A coat of `kind` cut down to its first `n` cells (the crate's smallest strip is longer than one). */
const byKind = (kind: 'icecoat' | 'slimecoat' | 'spikestrip', n: number): PropDef => {
  for (let i = 0; i < 300; i++) {
    const d = generateProp(new Rng(i), kind, 'x');
    if (d.footprint.length < n) continue;
    const keep = new Set(d.footprint.slice(0, n).map(([x, y]) => `${x},${y}`));
    return {
      ...d,
      footprint: d.footprint.slice(0, n),
      modules: d.modules.map((m) => ('cells' in m ? { ...m, cells: m.cells.filter(([x, y]) => keep.has(`${x},${y}`)) } : m)),
    };
  }
  throw new Error('no def');
};

const oneBlock = (): PropDef => {
  for (let i = 0; i < 500; i++) {
    const d = generateProp(new Rng(i), 'platform', 'x');
    if (d.footprint.length === 1 && d.motion.type === 'none' && d.modules.length === 1 && d.modules[0].type === 'body' && d.modules[0].material === 'stone')
      return d;
  }
  throw new Error('no def');
};

/** The lift's row (whole tiles) at frame f: where its top is nearest. */
function liftRow(lp: PlacedProp, f: number): number {
  return lp.ty + Math.round(motionOffset(resolveProp(lp), f)[1] / TILE);
}

/** A part placed at frame f the way the match places it, or a failed expectation. */
function stick(level: Level, placed: PlacedProp[], uid: number, def: PropDef, tx: number, ty: number, f: number): PlacedProp {
  const s = spotAt(level, placed, def, 0, tx, ty, f);
  expect(s.ok, `${def.archetype} at ${tx},${ty}`).toBe(true);
  expect(s.ride, `${def.archetype} at ${tx},${ty} rides`).toBeDefined();
  return { uid, def: s.def, owner: 0, tx, ty, rot: 0, ride: s.ride };
}

const PLACE_F = 3000; // a place-phase frame: the match frame, unrelated to the race's

/** Solid of a part (first one) in a race's frame. */
const solidOf = (run: RunWorld, uid: number) => run.solids.find((s) => s.propUid === uid)!;

function standOn(run: RunWorld, uid: number) {
  const s = solidOf(run, uid);
  const b = run.runners[0].body;
  b.x = s.x + 2;
  b.y = s.y - b.h;
  b.vx = 0;
  b.vy = 0;
}

describe('parts ride what they are stuck to', () => {
  it('a slime coat on a lift rides it, and a runner on it is carried on slime footing', () => {
    const lp = lift();
    const level = testLevel([lp]);
    const coat = stick(level, [], 1, byKind('slimecoat', 3), 10, liftRow(lp, PLACE_F), PLACE_F);
    expect(coat.ride!.uid).toBe(LIFT);
    const run = new RunWorld(level, [coat], [0]);
    standOn(run, 1);
    const ys: number[] = [];
    for (let f = 0; f < 240; f++) {
      run.step([NO_INPUT]);
      const c = solidOf(run, 1);
      const l = solidOf(run, LIFT);
      // Stuck on: the coat sits on the lift's top every frame, and carries its rider with it.
      expect(c.y + c.h).toBeCloseTo(l.y, 6);
      expect(c.x).toBeCloseTo(l.x, 6);
      expect(c.surface).toBe(COAT_SURFACES.slime);
      const b = run.runners[0].body;
      expect(b.groundRef, `frame ${f}`).toBe(c.id);
      ys.push(b.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(3 * TILE);
    // Slime footing while carried: walking is slower than on the bare lift.
    const walk = (placed: PlacedProp[], uid: number) => {
      const r = new RunWorld(level, placed, [0]);
      for (let f = 0; f < 60; f++) r.step([NO_INPUT]);
      standOn(r, uid);
      const x0 = r.runners[0].body.x;
      for (let f = 0; f < 20; f++) r.step([{ ...NO_INPUT, right: true }]);
      return r.runners[0].body.x - x0;
    };
    expect(walk([coat], 1)).toBeLessThan(walk([], LIFT) * 0.7);
  });

  it('a block stuck to a moving platform is carried, and a runner stands on it and rides', () => {
    const lp = lift();
    const level = testLevel([lp]);
    const block = stick(level, [], 1, oneBlock(), 11, liftRow(lp, PLACE_F) - 1, PLACE_F);
    const run = new RunWorld(level, [block], [0]);
    standOn(run, 1);
    const ys: number[] = [];
    for (let f = 0; f < 240; f++) {
      run.step([NO_INPUT]);
      const s = solidOf(run, 1);
      expect(s.y + TILE).toBeCloseTo(solidOf(run, LIFT).y, 6);
      expect(run.runners[0].alive).toBe(true);
      expect(run.runners[0].body.groundRef, `frame ${f}`).toBe(s.id);
      ys.push(s.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4 * TILE, 6);
  });

  it('chains: a coat on a block stuck to a lift rides the lift', () => {
    const lp = lift();
    const level = testLevel([lp]);
    const block = stick(level, [], 1, oneBlock(), 11, liftRow(lp, PLACE_F) - 1, PLACE_F);
    const later = PLACE_F + 37; // the lift has moved on: the coat still finds the block where it is now
    const blockRow = Math.round((block.ty * TILE + motionOffset(resolveProp(block), later)[1]) / TILE);
    const coat = stick(level, [block], 2, byKind('icecoat', 1), 11, blockRow, later);
    expect(coat.ride!.uid).toBe(1);
    expect(coat.ride!.parent.ride!.uid).toBe(LIFT);
    const run = new RunWorld(level, [block, coat], [0]);
    for (let f = 0; f < 200; f++) {
      run.step([NO_INPUT]);
      const c = solidOf(run, 2);
      expect(c.y + c.h).toBeCloseTo(solidOf(run, 1).y, 6);
      expect(c.x).toBeCloseTo(solidOf(run, 1).x, 6);
    }
  });

  it('a wheel platform carries what is stuck to it round, level, and keeps its face', () => {
    const rotor: Module = {
      type: 'rotor',
      look: 'cog',
      support: 'none',
      mastX: 0,
      hub: [3.5, 3.5],
      arm: 2.5,
      count: 2,
      angle0: 0,
      period: 240,
      swing: 0,
      dir: 1,
      width: 2,
      thick: 0.5,
      material: 'metal',
      seed: 1,
    };
    const wheel = piece(LIFT, [rotor], { type: 'none' }, [[3, 3]], 12, 8);
    const level = testLevel([wheel]);
    // Drop slime wherever a platform passes on this frame.
    const f = PLACE_F;
    let placed: PlacedProp | null = null;
    for (let ty = 2; ty < FLOOR && !placed; ty++)
      for (let tx = 8; tx < 24 && !placed; tx++) {
        const s = spotAt(level, [], byKind('slimecoat', 1), 0, tx, ty, f);
        if (s.ok && s.ride) placed = { uid: 1, def: s.def, owner: 0, tx, ty, rot: 0, ride: s.ride };
      }
    expect(placed).not.toBeNull();
    const run = new RunWorld(level, [placed!], [0]);
    const xs: number[] = [];
    for (let k = 0; k < 240; k++) {
      run.step([NO_INPUT]);
      const c = solidOf(run, 1);
      const plat = run.solids.find((s) => s.propUid === LIFT && s.id % 64 === placed!.ride!.part)!;
      expect(c.y + c.h).toBeCloseTo(plat.y, 6); // still on top: the face never turns
      expect(c.x).toBeGreaterThanOrEqual(plat.x - 1e-6);
      expect(c.x + c.w).toBeLessThanOrEqual(plat.x + plat.w + 1e-6);
      xs.push(c.x);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4 * TILE);
  });

  it('a part whose ride would meet terrain is refused', () => {
    // A lift sliding right up against the wall at x = 30.
    const lp = lift(3, 20, 0, 24, 15);
    const level = testLevel([lp]);
    const f = 0;
    const row = liftRow(lp, f);
    const col = lp.tx + Math.round(motionOffset(resolveProp(lp), f)[0] / TILE);
    // On its right side it would be shoved into the wall; on top it rides clear.
    const side = spotAt(level, [], oneBlock(), 0, col + 3, row, f);
    expect(side.ride).toBeDefined();
    expect(side.ok).toBe(false);
    const top = spotAt(level, [], oneBlock(), 0, col + 1, row - 1, f);
    expect(top.ride).toBeDefined();
    expect(top.ok).toBe(true);
    // Spikes under a lift that parks on the floor would be driven into it.
    const low = lift(4, 40, -Math.PI / 2, 10, FLOOR - 1);
    const lv2 = testLevel([low]);
    let up = PLACE_F;
    while (liftRow(low, up) > FLOOR - 3) up++;
    const under = spotAt(lv2, [], byKind('spikestrip', 1), 2, 11, liftRow(low, up), up);
    expect(under.ride).toBeDefined();
    expect(under.ok).toBe(false);
  });

  it('nothing rides what holds still', () => {
    const still = piece(LIFT, [metal([[0, 0]])], { type: 'none' }, [[0, 0]], 10, 16);
    const level = testLevel([still]);
    const s = spotAt(level, [], oneBlock(), 0, 10, 15, PLACE_F);
    expect(s.ride).toBeUndefined();
    expect(s.ok).toBe(true);
  });

  it('a blast that takes a mover takes everything riding it, chains included', () => {
    const setup = () => {
      const lp = lift();
      const level = testLevel([lp]);
      const block = stick(level, [], 1, oneBlock(), 11, liftRow(lp, PLACE_F) - 1, PLACE_F);
      const blockRow = Math.round((block.ty * TILE + motionOffset(resolveProp(block), PLACE_F)[1]) / TILE);
      const coat = stick(level, [block], 2, byKind('icecoat', 1), 11, blockRow, PLACE_F);
      const bystander: PlacedProp = { uid: 3, def: oneBlock(), owner: 0, tx: 40, ty: FLOOR - 1, rot: 0 };
      return { level, placed: [block, coat, bystander] };
    };
    // An EMP on the lift's own cells: the lift goes, and its riders with it.
    const a = setup();
    const left = detonate(a.level, a.placed, { shape: 'disk', target: 'props', radius: 1, width: 1 }, 11, 16, 0, PLACE_F);
    expect(a.level.setPieces).toHaveLength(0);
    expect(left.map((p) => p.uid)).toEqual([3]);
    // A blast on the block, where it rides on that frame: the block and its coat go, the lift stays.
    const b = setup();
    const at = Math.round((16 * TILE + motionOffset(resolveProp(b.placed[0]), PLACE_F + 5)[1]) / TILE) - 1;
    const kept = detonate(b.level, b.placed, { shape: 'disk', target: 'props', radius: 0.5, width: 1 }, 11, at, 0, PLACE_F + 5);
    expect(b.level.setPieces).toHaveLength(1);
    expect(kept.map((p) => p.uid)).toEqual([3]);
  });

  it("the barrier counts a rider's whole sweep, never its placed cells alone", () => {
    // No dwell: the lift never stops, so the cell above where the block went in is always partly under it.
    const lp = lift(2, 0);
    const level = testLevel([lp]);
    const f = 0;
    const row = liftRow(lp, f) - 1;
    const block = stick(level, [], 1, oneBlock(), 11, row, f);
    const b = barrierOf(level, block);
    expect(b.ground).toEqual([]); // a rider is never footing the proof can count on
    // Its cells over the cycle, from the race's own frames.
    const r = resolveProp(block);
    const swept = new Set<number>();
    for (let k = 0; k < 120; k++) {
      const y = Math.floor((row * TILE + motionOffset(r, 60 + k)[1]) / TILE);
      swept.add(y * level.w + 11);
    }
    expect(b.noGo.length).toBeGreaterThan(0);
    for (const k of b.noGo) expect(swept.has(k) || swept.has(k - level.w)).toBe(true);
    // A cell it covers the whole time without ever being placed there.
    expect(b.noGo.some((k) => k !== row * level.w + 11)).toBe(true);
  });

  it('two races with riders are identical, and a snapshot round-trips them', () => {
    const lp = lift();
    const level = testLevel([lp]);
    const block = stick(level, [], 1, oneBlock(), 11, liftRow(lp, PLACE_F) - 1, PLACE_F);
    const blockRow = Math.round((block.ty * TILE + motionOffset(resolveProp(block), PLACE_F)[1]) / TILE);
    const coat = stick(level, [block], 2, byKind('slimecoat', 1), 11, blockRow, PLACE_F);
    const race = () => {
      const run = new RunWorld(level, [block, coat], [0]);
      standOn(run, 2);
      const inp: InputFrame[] = [NO_INPUT];
      for (let f = 0; f < 300; f++) run.step(f % 50 < 10 ? [{ ...NO_INPUT, jump: true }] : inp);
      return JSON.stringify([run.runners[0].body, run.solids]);
    };
    expect(race()).toBe(race());

    // Through a match snapshot, on a generated level: a player's lift this time, so the parent is in `placed` too.
    const m = new Match(77);
    m.join('kb1');
    const free = (x: number, y: number) => m.level.tiles[y * m.level.w + x] === 0;
    let spot: [number, number] | null = null;
    for (let y = 8; y < m.level.h - 2 && !spot; y++)
      for (let x = 8; x < m.level.w - 8 && !spot; x++) {
        let ok = true;
        for (let dy = -7; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 3 && ok; dx++) ok = free(x + dx, y + dy);
        if (ok) spot = [x, y];
      }
    expect(spot).not.toBeNull();
    const own = { ...lift(4, 40, -Math.PI / 2, spot![0], spot![1]), uid: 50, owner: 0 };
    const b2 = stick(m.level, [own], 51, oneBlock(), spot![0] + 1, liftRow(own, PLACE_F) - 1, PLACE_F);
    const row2 = Math.round((b2.ty * TILE + motionOffset(resolveProp(b2), PLACE_F)[1]) / TILE);
    const c2 = stick(m.level, [own, b2], 52, byKind('slimecoat', 1), spot![0] + 1, row2, PLACE_F);
    m.placed = [own, b2, c2];
    m.startRun();
    for (let f = 0; f < 90; f++) m.step({});
    const snap = JSON.parse(JSON.stringify(snapshotMatch(m)));
    const copy = new Match(77);
    restoreMatch(copy, snap);
    expect(copy.placed[2].ride!.parent.ride!.uid).toBe(50);
    expect(hashMatch(copy)).toBe(hashMatch(m));
    for (let f = 0; f < 120; f++) {
      m.step({});
      copy.step({});
    }
    expect(hashMatch(copy)).toBe(hashMatch(m));
    expect(copy.run!.solids.find((s) => s.propUid === 52)).toEqual(m.run!.solids.find((s) => s.propUid === 52));
  });
});

describe('placing onto a mover through the match', () => {
  const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

  it('the ghost rides, and the placed part keeps the ride', () => {
    const lp = lift(4, 400);
    const level = testLevel([lp]);
    const def = oneBlock();
    const m = new Match(4242);
    m.join('kb1');
    m.startMatch();
    m.level = level;
    m.crate[0].def = def;
    const r = m.crate[0].rect;
    const at = { x: r.x + 4, y: r.y + 4 };
    for (let f = 0; f < 200 && m.phase === 'pick'; f++) m.step({ kb1: press({ pointer: at, confirmPressed: m.phaseFrame === 11 }) });
    expect(m.phase).toBe('place');
    for (let f = 0; f < 12; f++) m.step({ kb1: press({ pointer: at }) });
    const cells = footprint(def, 0);
    expect(cells).toHaveLength(1);
    const aim = { x: 11 * TILE + 8, y: (liftRow(lp, m.frame) - 1) * TILE + 8 };
    m.step({ kb1: press({ pointer: aim }) });
    const g = m.ghostOrigin(m.players[0])!;
    expect(g.ride?.uid).toBe(LIFT);
    expect(g.ok).toBe(true);
    m.step({ kb1: press({ pointer: aim, confirmPressed: true }) });
    const placed = m.placed.find((p) => p.def === def);
    expect(placed?.ride?.uid).toBe(LIFT);
  });
});
