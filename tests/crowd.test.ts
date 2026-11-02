import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { type Level, spawnZone, tileAt } from '../src/sim/level';
import { bodyAtCell, firstOverlap } from '../src/sim/physics';
import { makeProjectile, type PlacedProp, type PropDef } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row
const WALL_X = 30; // wall column rising from the floor

/** Flat floor from FLOOR down, a wall column at WALL_X, spawn pocket protected on the left. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + WALL_X] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [
      { x: 0, y: FLOOR - 4, w: 5, h: 5 },
      { x: LEVEL_W - 5, y: FLOOR - 4, w: 5, h: 5 },
    ],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const walk = (dir: -1 | 1): InputFrame => ({ ...NO_INPUT, left: dir < 0, right: dir > 0 });

/** A single upward spike strip on top of floor cell tx (owner 7). */
function spikeAt(tx: number): PlacedProp {
  const base = generateProp(new Rng(1), 'spikeblock', 'x');
  const def: PropDef = { ...base, motion: { type: 'none' }, modules: [{ type: 'spikes', cells: [[0, 0]], angle: -Math.PI / 2 }], footprint: [[0, 0]] };
  return { uid: 1, def, owner: 7, tx, ty: FLOOR, rot: 0 };
}

/** Run past the countdown with no input so bodies settle. */
function settle(run: RunWorld, n: number) {
  while (run.frame < RUN_COUNTDOWN) run.step(Array(n).fill(NO_INPUT));
}

describe('spawn safe zone', () => {
  const level = testLevel();
  it('is the protected rect holding the spawn cell', () => {
    expect(spawnZone(level)).toEqual({ x: 0, y: (FLOOR - 4) * TILE, w: 5 * TILE, h: 5 * TILE });
    expect(spawnZone({ ...level, protectedRects: [] })).toBeNull();
  });

  it('a runner in the zone survives a hazard that kills outside it', () => {
    const inside = new RunWorld(level, [spikeAt(2)], [0]);
    for (let f = 0; f < 120; f++) inside.step([NO_INPUT]);
    expect(inside.isSafe(inside.runners[0])).toBe(true);
    expect(inside.runners[0].alive).toBe(true);

    const outside = new RunWorld(level, [spikeAt(10)], [0]);
    outside.runners[0].body = bodyAtCell(10, FLOOR - 1);
    for (let f = 0; f < 120; f++) outside.step([NO_INPUT]);
    expect(outside.runners[0].alive).toBe(false);
    expect(outside.runners[0].cause).toBe('hazard');
    expect(outside.runners[0].killer).toBe(7);
  });

  it('projectiles reaching a protected runner pop harmlessly; outside they kill', () => {
    const shoot = (tx: number) => {
      const run = new RunWorld(level, [], [0]);
      run.runners[0].body = bodyAtCell(tx, FLOOR - 1);
      settle(run, 1);
      const b = run.runners[0].body;
      run.projectiles.push(makeProjectile({ x: b.x + b.w + 30, y: b.y + b.h / 2, vx: -300, vy: 0, owner: 5, ammo: 'bolt' }, run.frame, 0));
      const events: string[] = [];
      for (let f = 0; f < 30; f++) {
        run.step([NO_INPUT]);
        events.push(...run.drainEvents().map((e) => e.type));
      }
      return { run, events };
    };
    const safe = shoot(2);
    expect(safe.run.runners[0].alive).toBe(true);
    expect(safe.run.projectiles.length).toBe(0); // destroyed, not passed through
    expect(safe.events).toContain('pop');

    const exposed = shoot(12);
    expect(exposed.run.runners[0].alive).toBe(false);
    expect(exposed.run.runners[0].killer).toBe(5);
  });

  it('protection ends once the body leaves the zone', () => {
    const run = new RunWorld(level, [], [0]);
    const zone = run.safeZone!;
    run.runners[0].body = bodyAtCell(4, FLOOR - 1);
    run.runners[0].body.x = zone.x + zone.w - 1; // 1 px of overlap
    expect(run.isSafe(run.runners[0])).toBe(true);
    run.runners[0].body.x = zone.x + zone.w;
    expect(run.isSafe(run.runners[0])).toBe(false);
  });
});

describe('runner nudging', () => {
  const level = testLevel();

  /** Two runners side by side on open floor near x = tile 14, touching. */
  function pair(slots = [0, 1], gap = 0) {
    const run = new RunWorld(level, [], slots);
    run.runners[0].body = bodyAtCell(14, FLOOR - 1);
    run.runners[1].body = bodyAtCell(14, FLOOR - 1, run.runners[0].body.w + gap);
    settle(run, 2);
    return run;
  }

  it('walking into a standing runner shoves them slowly', () => {
    const run = pair();
    const [a, b] = run.runners.map((r) => r.body);
    const bx0 = b.x;
    const frames = 60;
    for (let f = 0; f < frames; f++) run.step([walk(1), NO_INPUT]);
    const shoveSpeed = (b.x - bx0) / (frames / 60);
    expect(shoveSpeed).toBeGreaterThan(PHYS.walkSpeed * 0.05);
    expect(shoveSpeed).toBeLessThan(PHYS.walkSpeed * 0.25);
    // The pusher is held back to the same crawl, not passing through.
    expect(a.x + a.w).toBeLessThanOrEqual(b.x + 0.5);
  });

  it('running into someone shoves a bit harder but still slowly', () => {
    const run = pair();
    const b = run.runners[1].body;
    const bx0 = b.x;
    for (let f = 0; f < 60; f++) run.step([{ ...walk(1), run: true }, NO_INPUT]);
    expect(b.x - bx0).toBeLessThan(PHYS.runSpeed * 0.25);
    expect(b.x - bx0).toBeGreaterThan(0);
  });

  it('two runners pushing into each other nearly stand still', () => {
    const run = pair();
    const [a, b] = run.runners.map((r) => r.body);
    const ax0 = a.x;
    const bx0 = b.x;
    for (let f = 0; f < 120; f++) run.step([walk(1), walk(-1)]);
    expect(Math.abs(a.x - ax0)).toBeLessThan(2);
    expect(Math.abs(b.x - bx0)).toBeLessThan(2);
    // Running vs walking: the stronger one wins, but only by a tiny drift.
    const run2 = pair();
    const b2 = run2.runners[1].body;
    const b2x0 = b2.x;
    for (let f = 0; f < 60; f++) run2.step([{ ...walk(1), run: true }, walk(-1)]);
    expect(b2.x - b2x0).toBeGreaterThan(0);
    expect(b2.x - b2x0).toBeLessThan(PHYS.walkSpeed * 0.2);
  });

  it('runners moving apart or side by side in the same direction are unaffected', () => {
    const run = pair([0, 1], 2);
    const b = run.runners[1].body;
    const bx0 = b.x;
    for (let f = 0; f < 30; f++) run.step([NO_INPUT, walk(1)]);
    const solo = new RunWorld(level, [], [1]);
    solo.runners[0].body = bodyAtCell(14, FLOOR - 1, run.runners[0].body.w + 2);
    settle(solo, 1);
    for (let f = 0; f < 30; f++) solo.step([walk(1)]);
    expect(b.x - bx0).toBeCloseTo(solo.runners[0].body.x - bx0, 9);
  });

  it('is order-independent: swapping runner order gives identical bodies', () => {
    const script = (f: number): [InputFrame, InputFrame] =>
      f % 90 < 40
        ? [walk(1), walk(-1)]
        : f % 90 < 60
          ? [{ ...walk(1), run: true }, NO_INPUT]
          : [{ ...walk(1), jump: true, jumpPressed: f % 90 === 60 }, walk(-1)];
    const a = new RunWorld(level, [], [0, 1]);
    const b = new RunWorld(level, [], [1, 0]);
    const place = (slot: number) => bodyAtCell(14, FLOOR - 1, slot === 0 ? 0 : 9);
    for (const r of a.runners) r.body = place(r.slot);
    for (const r of b.runners) r.body = place(r.slot);
    for (let f = 0; f < 400; f++) {
      const [i0, i1] = script(f);
      a.step([i0, i1]);
      b.step([i1, i0]);
    }
    const bySlot = (run: RunWorld, s: number) => run.runners.find((r) => r.slot === s)!.body;
    expect(bySlot(a, 0)).toEqual(bySlot(b, 0));
    expect(bySlot(a, 1)).toEqual(bySlot(b, 1));
    // Exact center ties are broken by slot, not array order.
    const t1 = new RunWorld(level, [], [0, 1]);
    const t2 = new RunWorld(level, [], [1, 0]);
    for (const run of [t1, t2]) for (const r of run.runners) r.body = bodyAtCell(14, FLOOR - 1);
    for (let f = 0; f < RUN_COUNTDOWN + 30; f++) {
      t1.step([walk(1), walk(-1)]);
      t2.step([walk(-1), walk(1)]);
    }
    expect(bySlot(t1, 0)).toEqual(bySlot(t2, 0));
    expect(bySlot(t1, 1)).toEqual(bySlot(t2, 1));
  });

  it('never pushes anyone into terrain; a pinned runner lets the pusher squeeze in', () => {
    const run = new RunWorld(level, [], [0, 1]);
    // B stands flush against the left face of the wall, A walks into B.
    run.runners[1].body = bodyAtCell(WALL_X - 1, FLOOR - 1);
    run.runners[1].body.x = WALL_X * TILE - run.runners[1].body.w;
    run.runners[0].body = bodyAtCell(WALL_X - 3, FLOOR - 1);
    settle(run, 2);
    const world = { tileAt: (x: number, y: number) => tileAt(level, x, y), solids: [] };
    for (let f = 0; f < 240; f++) {
      run.step([{ ...walk(1), run: f > 100 }, walk(1)]);
      for (const r of run.runners) expect(firstOverlap(r.body, world)).toBeNull();
    }
    expect(run.runners[1].body.x + run.runners[1].body.w).toBeLessThanOrEqual(WALL_X * TILE + 1e-3); // physics tolerance
  });

  it('dead and finished runners do not push', () => {
    const run = pair();
    run.runners[1].alive = false;
    const a = run.runners[0].body;
    const ax0 = a.x;
    for (let f = 0; f < 30; f++) run.step([walk(1), NO_INPUT]);
    expect(a.x - ax0).toBeGreaterThan(PHYS.walkSpeed * 0.3);
  });

  it('bodies pass through each other vertically (no standing on heads)', () => {
    const run = pair([0, 1], -10);
    const top = run.runners[0].body;
    top.y -= 40; // drop A straight onto B
    top.onGround = false;
    top.groundRef = -1;
    for (let f = 0; f < 60; f++) run.step([NO_INPUT, NO_INPUT]);
    expect(top.y + top.h).toBeCloseTo(FLOOR * TILE, 6);
  });
});
