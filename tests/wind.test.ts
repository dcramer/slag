import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import { DT, LEVEL_H, LEVEL_W, PLAYER_H, PHYS, PLAYER_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { createBody, stepBody } from '../src/sim/physics';
import { type Contrib, fanZone, geyserCycle, type Module, moduleSim, newPropState, type PlacedProp, type PropDef, resolveProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { WIND, type Wind, windAt, windSpeed } from '../src/sim/wind';

/** Open arena: a floor at row FLOOR, nothing else. */
const FLOOR = LEVEL_H - 4;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

function arena(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

function piece(mods: Module[]): PlacedProp {
  const def: PropDef = {
    key: 'test',
    name: 'test',
    maker: 'test',
    archetype: 'fan',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: mods,
    footprint: [[0, 0]],
  };
  return { uid: 100_000, def, owner: -1, tx: 0, ty: 0, rot: 0 };
}

const block = (x: number, y: number): Module => ({ type: 'body', cells: [[x, y]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
const fan = (x: number, y: number, angle: number, length: number, strength: number): Module => ({
  type: 'fan',
  at: [x + 0.5, y + 0.5],
  angle,
  length,
  strength,
});

/** A race in the arena with one runner whose feet stand on top of row `ty + 1` at column tx. */
function race(mods: Module[], tx: number, ty: number, level = arena()): RunWorld {
  level.setPieces = mods.length ? [piece(mods)] : [];
  const run = new RunWorld(level, [], [0]);
  const b = run.runners[0].body;
  b.x = tx * TILE + (TILE - PLAYER_W) / 2;
  b.y = (ty + 1) * TILE - PLAYER_H;
  b.vx = 0;
  b.vy = 0;
  run.frame = RUN_COUNTDOWN; // skip the countdown so inputs count from frame 0
  return run;
}

const input = (o: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...o });

/** The fan's column rect, as the sim builds it. */
const zoneOf = (run: RunWorld, mi: number): Wind => fanZone(run.level, run.resolved[0].mods[mi] as Extract<Module, { type: 'fan' }>);

describe('wind: up-drafts', () => {
  for (const strength of [1300, 2200, 2800]) {
    it(`standing on an up-fan (strength ${strength}) you rise steadily toward its air speed`, () => {
      // Block at (20, FLOOR-1) with a fan blowing up 8 tiles; the runner stands on the block.
      const run = race([block(20, FLOOR - 1), fan(20, FLOOR - 1, UP, 8, strength)], 20, FLOOR - 2);
      const target = windSpeed(strength);
      const vys: number[] = [];
      for (let f = 0; f < 24; f++) {
        run.step([NO_INPUT]);
        vys.push(run.runners[0].body.vy);
      }
      // Lifts on the very first frame, no burst: speed only ever increases (upward) and never overshoots.
      expect(vys[0]).toBeLessThan(0);
      for (let i = 1; i < vys.length; i++) expect(vys[i]).toBeLessThanOrEqual(vys[i - 1] + 1e-9);
      for (const v of vys) expect(v).toBeGreaterThanOrEqual(-target - 1e-6);
      expect(vys[vys.length - 1]).toBeLessThan(-0.85 * target);
    });
  }

  it('jumping onto an up-fan catches you and lifts you straight away', () => {
    const run = race([block(20, FLOOR - 1), fan(20, FLOOR - 1, UP, 8, 1500)], 20, FLOOR - 9);
    run.runners[0].body.vy = 300; // falling in from above
    let turned = -1;
    for (let f = 0; f < 40; f++) {
      run.step([NO_INPUT]);
      if (turned < 0 && run.runners[0].body.vy < 0) turned = f;
    }
    expect(turned).toBeGreaterThanOrEqual(0);
    expect(turned).toBeLessThan(12);
  });

  for (const strength of [1300, 2500]) {
    it(`you float at the column top without bouncing (strength ${strength})`, () => {
      const run = race([block(20, FLOOR - 1), fan(20, FLOOR - 1, UP, 6, strength)], 20, FLOOR - 2);
      const z = zoneOf(run, 1);
      const b = run.runners[0].body;
      // Never shoots out of the column: feet stay inside it (no bounce out and back).
      let minFeet = Infinity;
      for (let f = 0; f < 120; f++) {
        run.step([NO_INPUT]);
        minFeet = Math.min(minFeet, b.y + b.h);
      }
      expect(minFeet).toBeGreaterThan(z.y);
      let lo = Infinity;
      let hi = -Infinity;
      for (let f = 0; f < 120; f++) {
        run.step([NO_INPUT]);
        lo = Math.min(lo, b.y);
        hi = Math.max(hi, b.y);
        expect(Math.abs(b.vy)).toBeLessThan(10);
      }
      expect(hi - lo).toBeLessThan(1);
      // Feet hover right at the end of the column (within a few px of its top edge).
      expect(b.y + b.h - z.y).toBeGreaterThan(0);
      expect(b.y + b.h - z.y).toBeLessThan(WIND.hoverDepth + 3);
    });
  }

  it('you can still jump while standing in an up-draft (coyote time is not drained)', () => {
    for (const delay of [0, 2, 4]) {
      const run = race([block(20, FLOOR - 1), fan(20, FLOOR - 1, UP, 8, 1300)], 20, FLOOR - 2);
      let minVy = 0;
      for (let f = 0; f < 10; f++) {
        run.step([input({ jump: true, jumpPressed: f === delay })]);
        minVy = Math.min(minVy, run.runners[0].body.vy);
      }
      expect(minVy, `jump pressed on frame ${delay}`).toBeLessThan(-0.9 * PHYS.jumpVel);
    }
  });

  it('a jump inside an up-draft adds to the lift: it eases back to the air speed instead of braking hard', () => {
    const run = race([block(20, FLOOR - 1), fan(20, FLOOR - 1, UP, 12, 2200)], 20, FLOOR - 2);
    const b = run.runners[0].body;
    run.step([input({ jump: true, jumpPressed: true })]);
    const target = windSpeed(2200);
    let prev = b.vy;
    for (let f = 0; f < 30; f++) {
      run.step([input({ jump: true })]);
      // Decelerates no harder than normal gravity, and settles at (not below) the air speed.
      expect(b.vy - prev).toBeLessThan(1600 * DT + 1e-6);
      prev = b.vy;
    }
    expect(b.vy).toBeLessThan(-0.9 * target);
    expect(b.vy).toBeGreaterThan(-target - 30);
  });

  it('the rise speed does not depend on gravity (the air cancels it rather than out-pushing it)', () => {
    // Directly through stepBody: an open column, no tiles, with and without gravity's fall multiplier in play.
    const world = { tileAt: () => 0, solids: [] };
    const w: Wind = { x: -100, y: -1000, w: 200, h: 2000, dx: 0, dy: -1, speed: 150, k: 1 };
    for (const vy0 of [450, 0, -100]) {
      const b = createBody(0, 0);
      b.vy = vy0;
      for (let f = 0; f < 90; f++) stepBody(b, { left: false, right: false, jump: false, jumpPressed: false }, world, windAt(b, [w]));
      expect(b.vy).toBeCloseTo(-150, 0);
    }
  });
});

describe('wind: side and down drafts', () => {
  /** A fan on the floor at x=6 blowing right along the floor row. */
  const sideFan = (strength: number) => [block(6, FLOOR - 1), fan(6, FLOOR - 1, 0, 30, strength)];

  it('a side fan pushes a standing runner along at a steady speed', () => {
    const run = race(sideFan(2200), 10, FLOOR - 1);
    const vxs: number[] = [];
    for (let f = 0; f < 60; f++) {
      run.step([NO_INPUT]);
      vxs.push(run.runners[0].body.vx);
    }
    const target = windSpeed(2200);
    for (const v of vxs.slice(10)) expect(v).toBeCloseTo(target, 0);
  });

  it('walking loses to a side fan; running beats a weak one', () => {
    const weak = windSpeed(1300);
    // Walking against a medium fan: still pushed back.
    let run = race(sideFan(2200), 20, FLOOR - 1);
    for (let f = 0; f < 60; f++) run.step([input({ left: true })]);
    expect(run.runners[0].body.vx).toBeGreaterThan(0);
    // Running against a weak fan: you make headway at (run speed − air speed).
    run = race(sideFan(1300), 20, FLOOR - 1);
    const x0 = run.runners[0].body.x;
    for (let f = 0; f < 60; f++) run.step([input({ left: true, run: true })]);
    expect(run.runners[0].body.vx).toBeLessThan(0);
    expect(run.runners[0].body.vx).toBeCloseTo(-(215 - weak), 0);
    expect(run.runners[0].body.x).toBeLessThan(x0 - 40);
    // Running with it: faster than either alone.
    run = race(sideFan(1300), 10, FLOOR - 1);
    for (let f = 0; f < 60; f++) run.step([input({ right: true, run: true })]);
    expect(run.runners[0].body.vx).toBeCloseTo(215 + weak, 0);
  });

  it('you can keep jumping while standing in a side fan', () => {
    const run = race(sideFan(1800), 10, FLOOR - 1);
    let jumps = 0;
    let wasGround = true;
    for (let f = 0; f < 90; f++) {
      const b = run.runners[0].body;
      run.step([input({ jump: true, jumpPressed: b.onGround })]);
      if (wasGround && !b.onGround && b.vy < -400) jumps++;
      wasGround = b.onGround;
    }
    expect(jumps).toBeGreaterThanOrEqual(2);
  });

  it('a down fan pushes you down steadily and stops jumps', () => {
    // Ceiling fan: block hanging at row FLOOR-10 blowing down to the floor.
    const run = race([block(20, FLOOR - 10), fan(20, FLOOR - 10, DOWN, 20, 2200)], 20, FLOOR - 1);
    const b = run.runners[0].body;
    let minY = b.y;
    run.step([input({ jump: true, jumpPressed: true })]);
    for (let f = 0; f < 40; f++) {
      run.step([input({ jump: true })]);
      minY = Math.min(minY, b.y);
    }
    // A full jump rises ~4.5 tiles; in the down-draft it barely gets off the ground.
    expect(b.onGround).toBe(true);
    expect((b.y + 0 - minY) / TILE).toBeLessThan(1.6);
  });
});

describe('wind: steam geysers', () => {
  it('a steam geyser only blows during its eruption, ramped by the sim cycle', () => {
    const level = arena();
    const g: Module = {
      type: 'geyser',
      look: 'steam',
      at: [20.5, FLOOR],
      angle: UP,
      width: 0.9,
      length: 8,
      off: 100,
      warn: 40,
      on: 60,
      lethal: false,
      strength: 2700,
    };
    const pp = piece([g]);
    const r = resolveProp(pp);
    const m = r.mods[0] as Extract<Module, { type: 'geyser' }>;
    const state = newPropState();
    let active = 0;
    for (let f = 0; f < 600; f++) {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      moduleSim('geyser').build!(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi: 0, live: true }, out);
      const c = geyserCycle(m, f, r.phase);
      if (c.seg !== 2) expect(out.winds.length).toBe(0);
      else if (out.winds.length) {
        active++;
        expect(out.winds[0].k).toBeGreaterThan(0);
        expect(out.winds[0].speed).toBeCloseTo(windSpeed(2700), 6);
      }
    }
    expect(active).toBeGreaterThan(100);

    // A runner on the vent stays put until the eruption, then rides it up.
    level.setPieces = [pp];
    const run = new RunWorld(level, [], [0]);
    const b = run.runners[0].body;
    b.x = 20 * TILE + (TILE - PLAYER_W) / 2;
    b.y = FLOOR * TILE - PLAYER_H;
    let rose = -1;
    for (let f = 0; f < 400; f++) {
      const c = geyserCycle(m, f, r.phase);
      run.step([NO_INPUT]);
      if (b.vy < -1 && rose < 0) {
        rose = f;
        expect(c.seg).toBe(2);
      }
      if (c.seg !== 2 && rose < 0) expect(b.vy).toBeGreaterThanOrEqual(0);
    }
    expect(rose).toBeGreaterThanOrEqual(0);
  });
});
