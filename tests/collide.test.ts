import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells, overlaps } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { MODES } from '../src/game/modes';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { Predictor } from '../src/net/predict';
import { drawnVelocity } from '../src/net/session';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { BUMP, CHECK, COLLIDE, PERCH } from '../src/sim/collide';
import { DT, FPS, LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, SHIELD_FRAMES, TILE } from '../src/sim/constants';
import { giveItem } from '../src/sim/items';
import { type Level, spawnZone, tileAt } from '../src/sim/level';
import { type Body, bodyAtCell, createBody, firstOverlap, type Knocked, stepBody } from '../src/sim/physics';
import { gliderSolidId, makeProjectile, type Module, moduleSim, type PlacedProp, type PropDef } from '../src/sim/props';
import { RACE_RUN, type Runner, type RunRules, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row
const WALL_X = 30; // wall column rising from the floor
const UP = -Math.PI / 2;
const SLIP = COLLIDE.slipFrames;

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

const press = (o: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...o });
const walk = (dir: -1 | 1): InputFrame => press({ left: dir < 0, right: dir > 0 });
const dash = (dir: -1 | 1): InputFrame => press({ left: dir < 0, right: dir > 0, run: true });
const JUMP = press({ jump: true, jumpPressed: true });
const HOLD_JUMP = press({ jump: true });

const noInputs = (run: RunWorld) => run.runners.map(() => NO_INPUT);
const steps = (run: RunWorld, n: number) => {
  for (let f = 0; f < n; f++) run.step(noInputs(run));
};
const feet = (b: Body) => b.y + b.h;
const terrain = (level: Level) => ({ tileAt: (x: number, y: number) => tileAt(level, x, y), cols: level.w, solids: [] });

/** A placed prop made of these modules. */
function prop(modules: Module[], tx: number, ty: number, owner = 7, uid = 1, extra: Partial<PropDef> = {}): PlacedProp {
  const cells = new Map<string, Cell>();
  for (const m of modules) for (const c of moduleSim(m.type).anchors(m)) cells.set(`${c[0]},${c[1]}`, c);
  const base = generateProp(new Rng(1), 'spikeblock', 'x');
  return { uid, owner, tx, ty, rot: 0, def: { ...base, motion: { type: 'none' }, modules, footprint: normalizeCells([...cells.values()]), ...extra } };
}

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

/** `n` runners standing on open floor, in a live race (or a mode's, `rules`), `spacing` px apart from column `tx`. */
function lineup(n: number, opts: { tx?: number; spacing?: number; level?: Level; props?: PlacedProp[]; rules?: RunRules } = {}) {
  const { tx = 14, spacing = 30, level = testLevel(), props = [], rules } = opts;
  const run = new RunWorld(
    level,
    props,
    Array.from({ length: n }, (_, i) => i),
    0,
    level.seed,
    [],
    true,
    rules,
  );
  run.runners.forEach((r, i) => (r.body = bodyAtCell(tx, FLOOR - 1, i * spacing)));
  run.frame = RUN_COUNTDOWN;
  return { run, rs: run.runners, bs: run.runners.map((r) => r.body) };
}

function airborne(b: Body, x: number, y: number) {
  b.x = x;
  b.y = y;
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
  b.groundRef = -1;
}

/** Put `b` in the air `gap` px over `under`'s head. */
const dropOn = (b: Body, under: Body, gap = 20) => airborne(b, under.x, under.y - b.h - gap);

/** A settled stack of `n`, the first runner at the bottom, dead centred and fresh: a head holds nobody for long. */
function stack(n: number, opts: Parameters<typeof lineup>[1] = {}) {
  const s = lineup(n, { spacing: 0, ...opts });
  for (let i = 1; i < n; i++) airborne(s.bs[i], s.bs[0].x, s.bs[0].y - i * 20);
  steps(s.run, 30);
  return s;
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

  it('shields for 5 s from GO and then for nobody: still standing at 4 s, killed by the same hazard by 6 s', () => {
    const run = new RunWorld(level, [spikeAt(2)], [0]);
    const r = run.runners[0];
    while (run.frame < RUN_COUNTDOWN + 4 * FPS) run.step([NO_INPUT]);
    expect(run.isSafe(r)).toBe(true);
    expect(r.alive).toBe(true);
    while (run.frame < RUN_COUNTDOWN + 6 * FPS) run.step([NO_INPUT]);
    expect(run.isSafe(r)).toBe(false);
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('hazard');
    expect(r.deathFrame).toBe(RUN_COUNTDOWN + SHIELD_FRAMES);
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

describe('standing on a runner', () => {
  it('you land on a head and stand there, and it costs the one below nothing', () => {
    const { run, rs, bs } = lineup(2);
    dropOn(bs[1], bs[0]);
    steps(run, 60);
    expect(feet(bs[1])).toBeCloseTo(bs[0].y, 9);
    expect(bs[1].onGround).toBe(true);
    expect(bs[1].vy).toBe(0);
    expect(rs[1].ride).toBe(rs[0].slot);
    expect(rs[0].ride).toBe(-1);
    expect(feet(bs[0])).toBe(FLOOR * TILE);
    steps(run, 600);
    expect(rs.every((r) => r.alive && r.items.daze === 0 && r.status.frozen === 0)).toBe(true);
  });

  it('a jump into a fast-fall bumps the faller: stars, a knock sideways, and no lift', () => {
    const { run, rs, bs } = lineup(2);
    dropOn(bs[1], bs[0], 30);
    bs[1].vy = PHYS.fastFallMax;
    run.step([JUMP, press({ down: true })]);
    for (let f = 0; f < 6 && !rs[1].items.daze; f++) run.step([HOLD_JUMP, press({ down: true })]);
    expect(rs[1].items.daze).toBeGreaterThan(0);
    expect(rs[1].items.bonkedBy).toBe(0);
    expect(rs[1].ride).toBe(-1);
    expect(Math.abs(bs[1].vx)).toBeGreaterThan(BUMP.kick / 2);
    expect(bs[1].vy).toBeGreaterThanOrEqual(-BUMP.hop);
  });

  it('jumping off a head is the same jump as off the floor', () => {
    const rise = (run: RunWorld, b: Body, inputs: (i: InputFrame) => InputFrame[]) => {
      const y0 = b.y;
      let top = y0;
      run.step(inputs(JUMP));
      expect(b.onGround).toBe(false);
      for (let f = 0; f < 80; f++) {
        run.step(inputs(HOLD_JUMP));
        top = Math.min(top, b.y);
      }
      return y0 - top;
    };
    const solo = lineup(1);
    const onFloor = rise(solo.run, solo.bs[0], (i) => [i]);
    const { run, bs } = lineup(2);
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    expect(rise(run, bs[1], (i) => [NO_INPUT, i])).toBeCloseTo(onFloor, 6);
  });

  it('a jump buffered in the air fires on the head', () => {
    const { run, bs } = lineup(2);
    dropOn(bs[1], bs[0], 8);
    bs[1].vy = 120;
    run.step([NO_INPUT, JUMP]);
    expect(bs[1].onGround).toBe(false);
    let top = bs[1].y;
    for (let f = 0; f < 20; f++) {
      run.step([NO_INPUT, HOLD_JUMP]);
      top = Math.min(top, bs[1].y);
    }
    expect(top).toBeLessThan(bs[0].y - bs[1].h - 8);
  });

  it('coyote time works off a head', () => {
    const { run, bs } = lineup(2);
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    let f = 0;
    for (; f < 120 && bs[1].onGround; f++) run.step([NO_INPUT, walk(1)]);
    expect(bs[1].onGround).toBe(false);
    run.step([NO_INPUT, walk(1)]);
    run.step([NO_INPUT, JUMP]);
    expect(bs[1].vy).toBeLessThan(-300);
  });

  it('down + jump drops through a head, like a one-way', () => {
    const { run, bs } = lineup(2);
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    run.step([NO_INPUT, press({ down: true, jump: true, jumpPressed: true })]);
    expect(bs[1].vy).toBeGreaterThanOrEqual(0);
    steps(run, 40);
    expect(feet(bs[1])).toBe(FLOOR * TILE);
  });

  it('a rising runner bumps whoever it meets in the air instead of stopping on their feet, and goes on up', () => {
    const { run, rs, bs } = lineup(2);
    airborne(bs[1], bs[0].x, bs[0].y - 30);
    run.step([JUMP, NO_INPUT]);
    for (let f = 0; f < 5; f++) run.step([HOLD_JUMP, NO_INPUT]);
    expect(bs[0].vy).toBeLessThan(-200);
    expect(rs[1].items.daze).toBeGreaterThan(0);
    expect(rs[1].items.bonkedBy).toBe(0);
    expect(rs[1].ride).toBe(-1);
    // Knocked aside, never lifted: the jumper is the one going up.
    expect(bs[1].vy).toBeGreaterThan(bs[0].vy);
    expect(Math.abs(bs[1].vx)).toBeGreaterThan(BUMP.kick / 2);
  });

  it('a ceiling stops the stack: the bucked rider and the jumper bonk, and nobody is squeezed', () => {
    const level = testLevel();
    for (let x = 10; x < 22; x++) level.tiles[(FLOOR - 3) * LEVEL_W + x] = 1; // Two tiles of headroom, 32 px, for 28 px of bodies.
    const { run, rs, bs } = lineup(2, { level });
    dropOn(bs[1], bs[0], 2);
    steps(run, 30);
    expect(rs[1].ride).toBe(0);
    run.step([JUMP, NO_INPUT]);
    const world = terrain(level);
    let top = bs[0].y;
    for (let f = 0; f < 40; f++) {
      run.step([HOLD_JUMP, NO_INPUT]);
      top = Math.min(top, bs[0].y);
      for (const b of bs) expect(firstOverlap(b, world)).toBeNull();
      expect(overlaps(bs[0], bs[1])).toBe(false);
    }
    expect(top).toBeCloseTo((FLOOR - 2) * TILE + 14, 6); // Rider's head on the ceiling, the jumper's head at the rider's feet.
    expect(rs.every((r) => r.alive)).toBe(true);
  });

  it('a head within a ledge lip of your feet is a step up, not a wall', () => {
    const { run, bs } = lineup(2);
    airborne(bs[1], bs[0].x + bs[0].w + 1, bs[0].y - bs[1].h + 1);
    bs[1].vx = -100;
    bs[1].vy = 50;
    steps(run, 2);
    expect(feet(bs[1])).toBeCloseTo(bs[0].y, 9);
  });
});

describe('a bump from below', () => {
  /** A board (one-way) a shaft's step over the floor (its top three rows up), columns 12..18, someone standing on it at column 15. */
  function board() {
    const level = testLevel();
    for (let x = 12; x <= 18; x++) level.tiles[(FLOOR - 3) * LEVEL_W + x] = 2;
    const s = lineup(2, { tx: 15, spacing: 0, level });
    s.bs[1].x = s.bs[0].x;
    s.bs[1].y = (FLOOR - 3) * TILE - s.bs[1].h;
    steps(s.run, 5);
    return s;
  }

  it('jumping up through a board into someone standing on it bonks them and knocks them off; you carry on up', () => {
    const { run, rs, bs } = board();
    expect(bs[1].onGround).toBe(true);
    run.step([JUMP, NO_INPUT]);
    let bumped = -1;
    for (let f = 0; f < 30 && bumped < 0; f++) {
      run.step([HOLD_JUMP, NO_INPUT]);
      if (rs[1].items.daze > 0) bumped = f;
    }
    expect(bumped).toBeGreaterThanOrEqual(0);
    expect(rs[1].items.bonkedBy).toBe(0);
    expect(Math.abs(bs[1].vx)).toBeGreaterThan(BUMP.kick / 2);
    steps(run, 30);
    // The bumper got up onto the board, and whoever stood there was knocked off it.
    expect(feet(bs[0])).toBeLessThanOrEqual((FLOOR - 3) * TILE + 1e-6);
    expect(Math.abs(bs[1].x - bs[0].x)).toBeGreaterThan(TILE);
  });

  it('only from the level: a rider on a head is still bucked, not bumped', () => {
    const { run, rs, bs } = lineup(2);
    airborne(bs[1], bs[0].x, bs[0].y - 30);
    steps(run, 20);
    expect(rs[1].ride).toBe(0);
    run.step([JUMP, NO_INPUT]);
    steps(run, 3);
    expect(rs[1].items.daze).toBe(0);
  });
});

describe('a head is a perch, not ground', () => {
  type Pair = ReturnType<typeof lineup>;

  /** Runner 1 just landed on runner 0's head, `off` px right of dead centre. */
  const perched = (off = 0): Pair => {
    const s = lineup(2);
    airborne(s.bs[1], s.bs[0].x + off, s.bs[0].y - s.bs[1].h - 2);
    for (let f = 0; f < 10 && s.rs[1].ride < 0; f++) s.run.step(noInputs(s.run));
    expect(s.rs[1].ride).toBe(0);
    return s;
  };

  /** Frames until runner 1 is off the head. */
  const until = (s: Pair, inputs: (f: number) => InputFrame[], max = 200) => {
    let f = 0;
    for (; f < max && s.rs[1].ride === 0; f++) s.run.step(inputs(f));
    return f;
  };

  /** Both back on the floor, apart, unhurt. */
  const spilled = (s: Pair) => {
    steps(s.run, 50);
    for (const b of s.bs) expect(feet(b)).toBe(FLOOR * TILE);
    expect(overlaps(s.bs[0], s.bs[1])).toBe(false);
    expect(s.rs.every((r) => r.alive && r.items.daze === 0 && r.status.frozen === 0)).toBe(true);
  };

  it('nobody carries you: a base walking off leaves you behind, knocked off its back', () => {
    const s = perched();
    const x = s.bs[1].x;
    expect(until(s, () => [walk(1), NO_INPUT])).toBeLessThan(8);
    expect(s.bs[1].x).toBeLessThanOrEqual(x);
    expect(s.bs[1].vx).toBeLessThan(0);
    spilled(s);
    expect(s.bs[1].x).toBeLessThan(x);
  });

  it('off centre, you slide off the side you are on, faster the further out', () => {
    const times = [1, 2, 5].map((off) => {
      const s = perched(off);
      const n = until(s, () => noInputs(s.run));
      expect(s.bs[1].x).toBeGreaterThan(s.bs[0].x + off);
      spilled(s);
      return n;
    });
    expect(times[0]).toBeLessThan(PERCH.hold);
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
    const left = perched(-2);
    expect(until(left, () => noInputs(left.run))).toBe(times[1]);
    expect(left.bs[1].x).toBeLessThan(left.bs[0].x - 2);
  });

  it('dead centre on a base standing still, you last a moment and then tip off', () => {
    const s = perched(0);
    const n = until(s, () => noInputs(s.run));
    expect(n).toBeGreaterThanOrEqual(PERCH.hold - 2);
    expect(n).toBeLessThanOrEqual(PERCH.hold);
    spilled(s);
    expect(s.rs[1].ride).toBe(-1);
  });

  it('a jump bucks the rider up and off: a pop, not a lift, and it lands clear', () => {
    const s = perched(0);
    s.run.step([JUMP, NO_INPUT]);
    expect(s.rs[1].ride).toBe(-1);
    expect(s.bs[1].vy).toBeLessThan(s.bs[0].vy);
    for (let f = 0; f < 60; f++) {
      s.run.step([HOLD_JUMP, NO_INPUT]);
      expect(s.rs[1].ride).toBe(-1);
      expect(overlaps(s.bs[0], s.bs[1])).toBe(false);
    }
    spilled(s);
  });

  it('a hard stop throws the rider forward, and a hard start backward', () => {
    const s = perched(0);
    for (let f = 0; f < 30; f++) s.run.step([walk(1), walk(1)]);
    expect(s.rs[1].ride).toBe(0);
    expect(until(s, () => [NO_INPUT, walk(1)], 20)).toBeLessThan(6);
    expect(s.bs[1].vx).toBeGreaterThan(PHYS.walkSpeed);
    spilled(s);
    expect(s.bs[1].x).toBeGreaterThan(s.bs[0].x + s.bs[0].w);
  });

  it('you can still jump off the moment you are knocked off: the head was ground', () => {
    const s = perched(0);
    until(s, () => [dash(1), NO_INPUT]);
    expect(s.bs[1].onGround).toBe(false);
    s.run.step([dash(1), JUMP]);
    expect(s.bs[1].vy).toBeLessThan(-PHYS.jumpVel + 1);
  });
});

describe('side contact', () => {
  const touching = () => lineup(2, { spacing: 10 });

  it('walking into a bystander shoves them, and nobody overlaps', () => {
    const { run, bs } = touching();
    const bx0 = bs[1].x;
    const frames = SLIP - 5;
    for (let f = 0; f < frames; f++) {
      run.step([walk(1), NO_INPUT]);
      expect(overlaps(bs[0], bs[1])).toBe(false);
    }
    expect((bs[1].x - bx0) / (frames * DT)).toBeGreaterThan(PHYS.walkSpeed * COLLIDE.shove * 0.9);
    expect((bs[1].x - bx0) / (frames * DT)).toBeLessThan(PHYS.walkSpeed * COLLIDE.shove * 1.05);
    expect(bs[0].x + bs[0].w).toBeCloseTo(bs[1].x, 6);
  });

  it('a run-up shoves harder than a walk', () => {
    const walked = touching();
    const ran = touching();
    for (let f = 0; f < 30; f++) {
      walked.run.step([walk(1), NO_INPUT]);
      ran.run.step([dash(1), NO_INPUT]);
    }
    expect(ran.bs[1].x).toBeGreaterThan(walked.bs[1].x + 1);
  });

  it('head-on at the same speed stalls, mirror-exact, whatever the gap', () => {
    for (const spacing of [10, 13, 21.5]) {
      const { run, bs } = lineup(2, { spacing });
      const mid = (bs[0].x + bs[1].x + bs[1].w) / 2;
      for (let f = 0; f < 30; f++) run.step([walk(1), walk(-1)]);
      expect(bs[0].x + bs[0].w).toBeCloseTo(bs[1].x, 6);
      expect((bs[0].x + bs[1].x + bs[1].w) / 2).toBeCloseTo(mid, 6);
    }
  });

  it('a stronger push wins by the difference', () => {
    const { run, bs } = touching();
    const x0 = bs[1].x;
    for (let f = 0; f < 30; f++) run.step([dash(1), walk(-1)]);
    expect(bs[1].x).toBeGreaterThan(x0);
    expect(bs[1].x - x0).toBeLessThan(PHYS.walkSpeed * 0.5);
  });

  it('never tunnels, however fast two runners close', () => {
    const { run, bs } = lineup(2, { spacing: 40 });
    bs[0].vx = 3000;
    bs[1].vx = -3000;
    run.step([dash(1), dash(-1)]);
    expect(bs[0].x + bs[0].w).toBeCloseTo(bs[1].x, 6);
  });

  it('being rear-ended never slows you down', () => {
    const { run, bs } = lineup(2, { spacing: 12 });
    const solo = lineup(1);
    solo.bs[0].x = bs[1].x;
    for (let f = 0; f < 20; f++) {
      run.step([dash(1), walk(1)]);
      solo.run.step([walk(1)]);
      expect(bs[1].x).toBeGreaterThanOrEqual(solo.bs[0].x);
    }
    expect(overlaps(bs[0], bs[1])).toBe(false);
  });

  it('going the same way at the same speed changes nothing', () => {
    const side = touching();
    const lone = lineup(1);
    lone.bs[0].x = side.bs[1].x;
    for (let f = 0; f < 30; f++) {
      side.run.step([walk(1), walk(1)]);
      lone.run.step([walk(1)]);
    }
    expect(side.bs[1].x).toBeCloseTo(lone.bs[0].x, 9);
  });

  it('a chain moves as one, flush', () => {
    const { run, bs } = lineup(4, { spacing: 10 });
    const x3 = bs[3].x;
    for (let f = 0; f < 30; f++) {
      run.step([walk(1), NO_INPUT, NO_INPUT, NO_INPUT]);
      for (let i = 1; i < 4; i++) expect(bs[i].x - bs[i - 1].x).toBeGreaterThan(bs[0].w - 1e-3);
    }
    expect(bs[3].x).toBeGreaterThan(x3 + 5);
    expect(bs[0].x + bs[0].w).toBeCloseTo(bs[1].x, 6);
  });

  it('a shove moves the head out from under its rider, who goes nowhere with it', () => {
    const { run, rs, bs } = lineup(3, { spacing: 10 });
    dropOn(bs[2], bs[1]);
    steps(run, 30);
    expect(rs[2].ride).toBe(1);
    const [x1, x2] = [bs[1].x, bs[2].x];
    for (let f = 0; f < 30 && rs[2].ride === 1; f++) run.step([walk(1), NO_INPUT, NO_INPUT]);
    expect(rs[2].ride).not.toBe(1);
    expect(bs[1].x).toBeGreaterThan(x1 + 2);
    expect(bs[2].x).toBeLessThanOrEqual(x2);
    expect(rs.every((r) => r.alive)).toBe(true);
  });

  it('blocks in the air too, until your feet clear the head', () => {
    const { run, bs } = lineup(2, { spacing: 12 });
    run.step([JUMP, NO_INPUT]);
    for (let f = 0; f < 40; f++) {
      run.step([press({ right: true, jump: true }), NO_INPUT]);
      expect(overlaps(bs[0], bs[1])).toBe(false);
    }
    expect(bs[0].x).toBeGreaterThan(bs[1].x);
  });

  it('never pushes anyone into terrain', () => {
    const level = testLevel();
    const { run, rs, bs } = lineup(2, { level });
    bs[1].x = WALL_X * TILE - bs[1].w;
    bs[0].x = bs[1].x - 30;
    const world = terrain(level);
    for (let f = 0; f < 240; f++) {
      run.step([f > 100 ? dash(1) : walk(1), walk(1)]);
      for (const b of bs) expect(firstOverlap(b, world)).toBeNull();
    }
    expect(bs[1].x + bs[1].w).toBeLessThanOrEqual(WALL_X * TILE + 1e-3);
    expect(rs.every((r) => r.alive)).toBe(true);
  });

  it('a shoved group stops flush at a wall', () => {
    const { run, bs } = lineup(3, { tx: 28, spacing: 10 });
    bs[2].x = WALL_X * TILE - bs[2].w - 2;
    bs[1].x = bs[2].x - bs[1].w;
    bs[0].x = bs[1].x - bs[0].w;
    for (let f = 0; f < 30; f++) run.step([walk(1), NO_INPUT, NO_INPUT]);
    expect(bs[2].x + bs[2].w).toBeCloseTo(WALL_X * TILE, 6);
    expect(bs[1].x + bs[1].w).toBeCloseTo(bs[2].x, 6);
    expect(bs[0].x + bs[0].w).toBeCloseTo(bs[1].x, 6);
  });
});

describe("a brawl's shove (RunRules.shove)", () => {
  const BRAWL = MODES.brawl.run;
  /** The floor ends at this column: open pit to the right of it. */
  const EDGE = 24;
  function ledge(): Level {
    const level = testLevel();
    for (let y = FLOOR; y < LEVEL_H; y++) for (let x = EDGE; x < LEVEL_W; x++) level.tiles[y * LEVEL_W + x] = 0;
    for (let y = 10; y < FLOOR; y++) level.tiles[y * LEVEL_W + WALL_X] = 0;
    return level;
  }
  /** A victim standing `tiles` from the edge, a rival `back` px behind them; true if `inputs` put the victim off the ledge in 2 s. */
  function offLedge(rules: RunRules, tiles: number, back: number, inputs: (f: number, r: Runner) => [InputFrame, InputFrame]) {
    const { run, rs, bs } = lineup(2, { level: ledge(), tx: EDGE - tiles, spacing: 0, rules });
    bs[0].x = bs[1].x - bs[0].w - back;
    for (let f = 0; f < 120 && rs[1].alive; f++) run.step(inputs(f, rs[1]));
    return !rs[1].alive || bs[1].y > (FLOOR + 1) * TILE;
  }

  it('a run-up into someone two tiles from an edge checks them off it, where a race only jostles them', () => {
    // From four tiles back, running into them and on for a moment.
    const runUp = (f: number) => [f < 36 ? dash(1) : NO_INPUT, NO_INPUT] as [InputFrame, InputFrame];
    expect(offLedge(BRAWL, 2, 4 * TILE, runUp)).toBe(true);
    expect(offLedge(RACE_RUN, 2, 4 * TILE, runUp)).toBe(false);
  });

  it('a walk pushes someone who stands there two tiles off an edge inside a second', () => {
    const lean = (f: number) => [f < 60 ? walk(1) : NO_INPUT, NO_INPUT] as [InputFrame, InputFrame];
    expect(offLedge(BRAWL, 2, 0.5, lean)).toBe(true);
    expect(offLedge(RACE_RUN, 2, 0.5, lean)).toBe(false);
  });

  it('pushing back holds your ground against a walk, as in a race', () => {
    expect(offLedge(BRAWL, 2, 0.5, () => [walk(1), walk(-1)])).toBe(false);
  });

  it('shoved off an edge you go out over the drop, not straight down', () => {
    const { run, rs, bs } = lineup(2, { level: ledge(), tx: EDGE - 1, spacing: 0, rules: BRAWL });
    bs[0].x = bs[1].x - bs[0].w - 0.5;
    for (let f = 0; f < 60 && bs[1].onGround; f++) run.step([walk(1), NO_INPUT]);
    expect(rs[1].alive && !bs[1].onGround).toBe(true);
    expect(bs[1].vx).toBeGreaterThan(PHYS.walkSpeed * BRAWL.shove!.share * 0.9);
  });

  it('a check knocks like a bump: stars, credit and a throw ahead of the runner; leaning on after it is only a shove', () => {
    const { run, rs, bs } = lineup(2, { spacing: 4 * TILE, rules: BRAWL });
    let f = 0;
    for (; f < 60 && rs[1].items.daze === 0; f++) run.step([dash(1), NO_INPUT]);
    expect(rs[1].items.daze).toBeGreaterThan(0);
    expect(rs[1].items.bonkedBy).toBe(0);
    expect(bs[1].vx).toBeGreaterThanOrEqual(CHECK.kick);
    expect(bs[1].vx).toBeGreaterThan(bs[0].vx);
    // Running on into them while they see stars knocks them no further.
    const credit = rs[1].items.bonkCredit;
    for (let k = 0; k < 20; k++) run.step([dash(1), NO_INPUT]);
    expect(rs[1].items.bonkCredit).toBeLessThan(credit);
  });

  it('a walk into a bystander, or a run into someone running back at you, is no check', () => {
    const walked = lineup(2, { spacing: 4 * TILE, rules: BRAWL });
    for (let f = 0; f < 60; f++) walked.run.step([walk(1), NO_INPUT]);
    expect(walked.rs[1].items.daze).toBe(0);
    const headOn = lineup(2, { spacing: 6 * TILE, rules: BRAWL });
    for (let f = 0; f < 60; f++) headOn.run.step([dash(1), dash(-1)]);
    expect(headOn.rs.map((r) => r.items.daze)).toEqual([0, 0]);
  });
});

describe("a brawl's knocked bodies and contacts", () => {
  const BRAWL = MODES.brawl.run;
  /** `r` seeing stars from runner `by`'s hit (-1: nobody's), the way `bonk` leaves them. */
  const dazed = (r: Runner, by: number) => {
    r.items.daze = 28;
    r.items.bonkedBy = by;
    r.items.bonkCredit = by >= 0 ? 150 : 0;
  };

  it('a knock into a wall bounces back off it, where a race stops dead there', () => {
    const fly = (rules: RunRules) => {
      const { run, rs, bs } = lineup(1, { tx: WALL_X - 3, rules });
      dazed(rs[0], -1);
      bs[0].vx = 500;
      bs[0].vy = -200;
      bs[0].onGround = false;
      let back = 0;
      for (let f = 0; f < 20; f++) {
        run.step([NO_INPUT]);
        back = Math.min(back, bs[0].vx);
      }
      return { back, x: bs[0].x };
    };
    const brawl = fly(BRAWL);
    const race = fly(RACE_RUN);
    expect(race.back).toBe(0);
    expect(brawl.back).toBeLessThan(-500 * BRAWL.bounce!.bounce * 0.8);
    expect(brawl.x).toBeLessThan(race.x - TILE);
  });

  it('a knock up into a ceiling bounces down off it, and a floor still lands it to skid', () => {
    const level = testLevel();
    for (let x = 10; x < 20; x++) level.tiles[(FLOOR - 3) * LEVEL_W + x] = 1;
    const { run, rs, bs } = lineup(1, { tx: 14, level, rules: BRAWL });
    dazed(rs[0], -1);
    bs[0].vx = 200;
    bs[0].vy = -400;
    bs[0].onGround = false;
    // The first frame it's coming down, it's already coming down fast: it left the ceiling, it didn't drop off it.
    let down = 0;
    for (let f = 0; f < 10 && down <= 0; f++) {
      run.step([NO_INPUT]);
      down = bs[0].vy;
    }
    expect(down).toBeGreaterThan(PHYS.gravity * PHYS.fallGravityMult * DT * 2);
    steps(run, 20);
    expect(bs[0].onGround).toBe(true);
    expect(bs[0].vy).toBe(0);
  });

  it('a knocked body climbs a step a lone runner would stop at, so it does not snag on a corner', () => {
    // A 5 px step: over the controller's lip, under a knocked body's.
    const step = { x: 20 * TILE, y: FLOOR * TILE - 5, w: 4 * TILE, h: 5, id: 99, dx: 0, dy: 0, surface: createBody(0, 0).surface, propUid: -1, mi: -1 };
    const world = { ...terrain(testLevel()), solids: [step] };
    const slide = (knocked: Knocked | null) => {
      const b = bodyAtCell(17, FLOOR - 1);
      for (let f = 0; f < 4; f++) stepBody(b, NO_INPUT, world);
      b.vx = 300;
      for (let f = 0; f < 20; f++) stepBody(b, NO_INPUT, world, null, knocked);
      return b.x;
    };
    expect(slide(BRAWL.bounce!)).toBeGreaterThan(step.x);
    expect(slide(null)).toBeLessThan(step.x);
  });

  it('only a body seeing stars bounces: a runner running into a wall stops at it as ever', () => {
    const { run, bs } = lineup(1, { tx: WALL_X - 2, rules: BRAWL });
    for (let f = 0; f < 30; f++) run.step([dash(1)]);
    expect(bs[0].vx).toBeGreaterThanOrEqual(0);
    expect(bs[0].x + bs[0].w).toBeCloseTo(WALL_X * TILE, 6);
  });

  it('a one-sided shove never slips through: it walks someone off a ledge, where a race slips past them', () => {
    const EDGE = 24;
    const level = testLevel();
    for (let y = FLOOR; y < LEVEL_H; y++) for (let x = EDGE; x < LEVEL_W; x++) level.tiles[y * LEVEL_W + x] = 0;
    for (let y = 10; y < FLOOR; y++) level.tiles[y * LEVEL_W + WALL_X] = 0;
    const lean = (rules: RunRules) => {
      const { run, rs, bs } = lineup(2, { level, tx: EDGE - 4, spacing: 0, rules });
      bs[0].x = bs[1].x - bs[0].w - 0.5;
      let passed = false;
      for (let f = 0; f < 240 && rs[1].alive && bs[1].y < (FLOOR + 1) * TILE; f++) {
        run.step([walk(1), NO_INPUT]);
        if (bs[0].x > bs[1].x) passed = true;
      }
      return { passed, off: !rs[1].alive || bs[1].y >= (FLOOR + 1) * TILE };
    };
    expect(lean(BRAWL)).toEqual({ passed: false, off: true });
    expect(lean(RACE_RUN).passed).toBe(true);
    // Against a wall, twice the slip clock's frames on, and still flush behind them.
    const pinned = lineup(2, { tx: WALL_X - 1, spacing: 0, rules: BRAWL });
    pinned.bs[0].x = pinned.bs[1].x - pinned.bs[0].w - 0.5;
    for (let f = 0; f < BRAWL.shove!.stall! * 2; f++) pinned.run.step([walk(1), NO_INPUT]);
    expect(pinned.bs[0].x + pinned.bs[0].w).toBeLessThanOrEqual(pinned.bs[1].x + 1e-6);
  });

  it('head-on, equal efforts still slip through each other rather than jam for good', () => {
    const { run, bs } = lineup(2, { spacing: 12, rules: BRAWL });
    for (let f = 0; f < BRAWL.shove!.stall! + 30; f++) run.step([walk(1), walk(-1)]);
    expect(bs[0].x).toBeGreaterThan(bs[1].x);
  });

  it('a bump from below hits only someone standing: a faller met in the air is not bonked', () => {
    const { run, rs, bs } = lineup(2, { rules: BRAWL });
    dropOn(bs[1], bs[0], 30);
    bs[1].vy = PHYS.fastFallMax;
    run.step([JUMP, press({ down: true })]);
    for (let f = 0; f < 10; f++) run.step([HOLD_JUMP, press({ down: true })]);
    expect(rs.map((r) => r.items.daze)).toEqual([0, 0]);
    expect(rs[1].items.bonkedBy).toBe(-1);
  });

  it('a bump from below still bonks someone standing on a board', () => {
    const level = testLevel();
    for (let x = 12; x <= 18; x++) level.tiles[(FLOOR - 3) * LEVEL_W + x] = 2;
    const { run, rs, bs } = lineup(2, { tx: 15, spacing: 0, level, rules: BRAWL });
    bs[1].y = (FLOOR - 3) * TILE - bs[1].h;
    steps(run, 5);
    expect(bs[1].onGround).toBe(true);
    run.step([JUMP, NO_INPUT]);
    for (let f = 0; f < 30 && !rs[1].items.daze; f++) run.step([HOLD_JUMP, NO_INPUT]);
    expect(rs[1].items.daze).toBeGreaterThan(0);
    expect(rs[1].items.bonkedBy).toBe(0);
  });

  it('never bumps someone already seeing stars: the knock they have keeps its credit', () => {
    const level = testLevel();
    for (let x = 12; x <= 18; x++) level.tiles[(FLOOR - 3) * LEVEL_W + x] = 2;
    const { run, rs, bs } = lineup(3, { tx: 15, spacing: 0, level, rules: BRAWL });
    bs[1].y = (FLOOR - 3) * TILE - bs[1].h;
    bs[2].x = 40 * TILE;
    steps(run, 5);
    dazed(rs[1], 2);
    run.step([JUMP, NO_INPUT, NO_INPUT]);
    for (let f = 0; f < 12; f++) run.step([HOLD_JUMP, NO_INPUT, NO_INPUT]);
    expect(rs[1].items.bonkedBy).toBe(2);
  });

  it('a body seeing stars never perches: it falls past a head, where a race stands it there', () => {
    const { run, rs, bs } = lineup(2, { rules: BRAWL });
    dropOn(bs[1], bs[0], 20);
    dazed(rs[1], -1);
    for (let f = 0; f < 10; f++) {
      run.step([NO_INPUT, NO_INPUT]);
      expect(rs[1].ride).toBe(-1);
    }
    expect(feet(bs[1])).toBeGreaterThan(bs[0].y + 4);
    const race = lineup(2);
    dropOn(race.bs[1], race.bs[0], 20);
    dazed(race.rs[1], -1);
    steps(race.run, 10);
    expect(race.rs[1].ride).toBe(0);
  });

  it("a knocked body's check on a bystander is its hitter's, and one nobody threw checks nobody", () => {
    const fling = (by: number) => {
      const { run, rs, bs } = lineup(3, { spacing: 4 * TILE, rules: BRAWL });
      bs[0].x = 40 * TILE;
      dazed(rs[1], by);
      bs[1].vx = 500;
      for (let f = 0; f < 30 && !rs[2].items.daze; f++) run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
      return rs[2].items;
    };
    const struck = fling(0);
    expect(struck.daze).toBeGreaterThan(0);
    expect(struck.bonkedBy).toBe(0);
    expect(fling(-1).daze).toBe(0);
  });
});

describe('order independence', () => {
  type Script = (slot: number, f: number) => InputFrame;

  /** Same inputs per slot, with the runners in the array in a different order. */
  function play(order: number[], script: Script, at: (slot: number) => [number, number], frames: number, rules?: RunRules) {
    const run = new RunWorld(testLevel(), [], order, 0, 1, [], true, rules);
    run.frame = RUN_COUNTDOWN;
    for (const r of run.runners) airborne(r.body, ...at(r.slot));
    for (let f = 0; f < frames; f++) run.step(order.map((slot) => script(slot, f)));
    return Object.fromEntries(order.map((slot) => [slot, run.runners.find((r) => r.slot === slot)!]));
  }

  /** Random-looking input, a pure function of (slot, frame). */
  const mash = (seed: number): Script => {
    const rolls = Array.from({ length: 8 }, (_, slot) => {
      const rng = new Rng(seed + slot * 97);
      return Array.from({ length: 80 }, () => [rng.int(0, 3), rng.int(0, 3), rng.int(0, 2)]);
    });
    return (slot, f) => {
      const [d, j, run] = rolls[slot][Math.floor(f / 15) % 80];
      return press({ left: d === 0, right: d >= 2, run: run === 1, jump: j === 0, jumpPressed: j === 0 && f % 15 === 0 });
    };
  };

  const same = (a: Record<number, Runner>, b: Record<number, Runner>) => {
    for (const slot of Object.keys(a).map(Number)) {
      expect(b[slot].body, `slot ${slot}`).toEqual(a[slot].body);
      expect(b[slot].ride).toBe(a[slot].ride);
      expect(b[slot].press).toBe(a[slot].press);
    }
  };

  it('two runners landing on each other come out the same reversed', () => {
    const at = (s: number): [number, number] => [200 + s * 3, 200 - s * 40];
    const script: Script = (s, f) => press({ right: s === 0 && f > 30, left: s === 1 && f > 60, jump: f % 50 < 20, jumpPressed: f % 50 === 0 });
    same(play([0, 1], script, at, 200), play([1, 0], script, at, 200));
  });

  it('a stack comes out the same reversed', () => {
    const at = (s: number): [number, number] => [200 + s, 300 - s * 30];
    const script: Script = (s, f) => press({ right: s === 0 && f > 80 });
    same(play([0, 1, 2, 3, 4], script, at, 200), play([4, 3, 2, 1, 0], script, at, 200));
  });

  it('head-on runs at the same speed come out the same in any order', () => {
    const at = (s: number): [number, number] => [150 + s * 40, FLOOR * TILE - 14];
    const script: Script = (s) => dash(s % 2 === 0 ? 1 : -1);
    same(play([0, 1, 2, 3], script, at, 150), play([3, 1, 0, 2], script, at, 150));
  });

  it('eight runners mashing come out the same in any array order', () => {
    const at = (s: number): [number, number] => [120 + s * 25, 200 + (s % 3) * 20];
    for (const seed of [1, 2, 3]) {
      const script = mash(seed);
      const base = play([0, 1, 2, 3, 4, 5, 6, 7], script, at, 900);
      same(base, play([7, 6, 5, 4, 3, 2, 1, 0], script, at, 900));
      same(base, play([3, 7, 0, 5, 1, 6, 2, 4], script, at, 900));
    }
  });

  it("a brawl's shoves and body checks come out the same in any array order", () => {
    const at = (s: number): [number, number] => [120 + s * 25, 200 + (s % 3) * 20];
    const script = mash(4);
    const base = play([0, 1, 2, 3, 4, 5, 6, 7], script, at, 900, MODES.brawl.run);
    same(base, play([7, 6, 5, 4, 3, 2, 1, 0], script, at, 900, MODES.brawl.run));
    same(base, play([3, 7, 0, 5, 1, 6, 2, 4], script, at, 900, MODES.brawl.run));
    expect(Object.values(base).some((r) => r.items.bonkedBy >= 0 || r.items.daze > 0)).toBe(true);
  });

  it('renumbering the slots changes nothing: which player you are is not a rule', () => {
    const script = mash(9);
    const bodies = (slots: number[]) => {
      const w = new RunWorld(testLevel(), [], slots);
      w.frame = RUN_COUNTDOWN;
      w.runners.forEach((r, i) => airborne(r.body, 120 + i * 25, 200 + (i % 3) * 20));
      for (let f = 0; f < 900; f++) w.step(slots.map((_, i) => script(i, f)));
      return w.runners.map((r) => r.body);
    };
    expect(bodies([7, 2, 5, 0, 3, 6, 1, 4])).toEqual(bodies([0, 1, 2, 3, 4, 5, 6, 7]));
  });

  it('a rider dead-centered over two heads picks the lower slot, whatever the array', () => {
    const ride = (slots: number[]) => {
      const run = new RunWorld(testLevel(), [], slots);
      run.frame = RUN_COUNTDOWN;
      const by = (s: number) => run.runners.find((r) => r.slot === s)!;
      by(0).body = bodyAtCell(14, FLOOR - 1, 5);
      by(1).body = bodyAtCell(14, FLOOR - 1, -5);
      airborne(by(2).body, by(1).body.x + 5, by(0).body.y - 34);
      steps(run, 30);
      return by(2).ride;
    };
    expect(ride([0, 1, 2])).toBe(0);
    expect(ride([2, 1, 0])).toBe(0);
  });
});

describe('stacks', () => {
  it('settle three and eight high, in order', () => {
    for (const n of [3, 8]) {
      const { bs, rs } = stack(n);
      for (let i = 1; i < n; i++) {
        expect(feet(bs[i])).toBeCloseTo(bs[i - 1].y, 9);
        expect(rs[i].ride).toBe(rs[i - 1].slot);
        expect(bs[i].onGround).toBe(true);
      }
    }
  });

  it('the top can jump off, and the bottom walking away spills the rest', () => {
    const { run, rs, bs } = stack(4);
    run.step([NO_INPUT, NO_INPUT, NO_INPUT, JUMP]);
    expect(bs[3].vy).toBeLessThan(-300);
    expect(bs[3].onGround).toBe(false);
    expect(bs[2].onGround).toBe(true);
    for (let f = 0; f < 60; f++) run.step([walk(1), NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(rs.every((r) => r.ride === -1 && r.alive)).toBe(true);
    for (const b of bs.slice(1, 3)) {
      expect(b.x).toBeLessThan(bs[0].x - b.w);
      expect(feet(b)).toBe(FLOOR * TILE);
    }
  });

  it('reach higher than anyone can jump alone', () => {
    const best = (run: RunWorld, b: Body, inputs: (i: InputFrame) => InputFrame[]) => {
      run.step(inputs(JUMP));
      let top = b.y;
      for (let f = 0; f < 60; f++) {
        run.step(inputs(HOLD_JUMP));
        top = Math.min(top, b.y);
      }
      return top;
    };
    const solo = lineup(1);
    const alone = best(solo.run, solo.bs[0], (i) => [i]);
    const { run, bs } = stack(3);
    expect(best(run, bs[2], (i) => [NO_INPUT, NO_INPUT, i])).toBeCloseTo(alone - 28, 6);
  });

  it('a block coming down on a stack treats everyone in it like a lone runner, and contact itself kills nobody', () => {
    const block: Module = { type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 };
    const level = testLevel();
    const mover = prop([block], 20, FLOOR - 9, 7, 1, { motion: { type: 'rail', angle: Math.PI / 2, range: 8, period: 900 } });
    const { run, rs } = stack(3, { level, tx: 20, props: [mover] });
    let reached = 0;
    for (let f = 0; f < 900; f++) {
      run.step(noInputs(run));
      const world = { ...terrain(level), solids: run.solids };
      for (const r of rs) if (r.alive) expect(firstOverlap(r.body, world), `frame ${f}`).toBeNull();
      reached = Math.max(reached, ...run.solids.map((b) => b.y + b.h));
    }
    expect(reached).toBeGreaterThan(FLOOR * TILE - 14);
    for (const r of rs) if (!r.alive) expect([r.cause, r.killer]).toEqual(['crush', 7]);
  });
});

describe('the spawn pile', () => {
  it('runners in the zone pass through each other, so eight start as fast as one', () => {
    const level = testLevel();
    const eight = new RunWorld(level, [], [0, 1, 2, 3, 4, 5, 6, 7]);
    const solo = new RunWorld(level, [], [0]);
    solo.runners[0].body = bodyAtCell(level.spawn.tx, level.spawn.ty, -14);
    eight.runners.forEach((r) => (r.body = bodyAtCell(level.spawn.tx, level.spawn.ty, -14)));
    eight.frame = solo.frame = RUN_COUNTDOWN;
    let out = -1;
    for (let f = 0; f < 200; f++) {
      eight.step(eight.runners.map(() => walk(1)));
      solo.step([walk(1)]);
      if (out < 0 && eight.runners.every((r) => !eight.isSafe(r))) out = f;
    }
    expect(out).toBeGreaterThan(0);
    for (const r of eight.runners) expect(r.body).toEqual(solo.runners[0].body);
  });

  it('someone parked just past the zone blocks nobody coming out of it', () => {
    const level = testLevel();
    const run = new RunWorld(level, [], [0, 1, 2]);
    run.runners[0].body = bodyAtCell(5, FLOOR - 1, 0);
    run.runners[1].body = bodyAtCell(2, FLOOR - 1);
    run.runners[2].body = bodyAtCell(1, FLOOR - 1);
    run.frame = RUN_COUNTDOWN;
    const x0 = run.runners[0].body.x;
    for (let f = 0; f < 120; f++) run.step([NO_INPUT, walk(1), walk(1)]);
    expect(run.runners[1].body.x).toBeGreaterThan(9 * TILE);
    expect(run.runners[2].body.x).toBeGreaterThan(8 * TILE);
    expect(run.runners[0].body.x).toBe(x0);
  });

  it('leaving the zone overlapped: no pop, see-through until apart, then solid', () => {
    const run = new RunWorld(testLevel(), [], [0, 1]);
    run.runners[0].body = bodyAtCell(3, FLOOR - 1);
    run.runners[1].body = bodyAtCell(3, FLOOR - 1, 4);
    run.frame = RUN_COUNTDOWN;
    const [a, b] = run.runners.map((r) => r.body);
    const gap = b.x - a.x;
    while (run.runners.some((r) => run.isSafe(r))) run.step([walk(1), walk(1)]);
    for (let f = 0; f < 20; f++) run.step([walk(1), walk(1)]);
    expect(overlaps(a, b)).toBe(true);
    expect(b.x - a.x).toBeCloseTo(gap, 6);
    // A walks on through B and out the far side, and from then on they're solid.
    for (let f = 0; f < 30; f++) run.step([walk(1), NO_INPUT]);
    expect(a.x).toBeGreaterThanOrEqual(b.x + b.w - 1e-3);
    for (let f = 0; f < 30; f++) run.step([NO_INPUT, walk(1)]);
    expect(b.x + b.w).toBeCloseTo(a.x, 6);
  });

  it('a pair that overlaps from anywhere else (a pipe exit, a bad spawn) stays put, with no pop', () => {
    const { run, bs } = lineup(2, { spacing: 3 });
    const [x0, x1] = [bs[0].x, bs[1].x];
    steps(run, 30);
    expect([bs[0].x, bs[1].x]).toEqual([x0, x1]);
  });
});

describe('body blocking', () => {
  /** Solid rock over columns 12..24 with row FLOOR-1 cut through it: a tunnel one tile high, 16 px for a 14 px runner. */
  function tunnel(): Level {
    const level = testLevel();
    for (let y = 0; y < FLOOR - 1; y++) for (let x = 12; x <= 24; x++) level.tiles[y * LEVEL_W + x] = 1;
    return level;
  }

  /** Frames for runner 1 to walk the length of `level`'s path, with runner 0 standing mid-way doing `blocker`. */
  function crossing(blocker: (f: number) => InputFrame, level = tunnel()) {
    const { run, bs } = lineup(2, { level, tx: 10 });
    bs[0].x = 18 * TILE + 3;
    bs[1].x = 10 * TILE;
    for (let f = 0; f < 1800; f++) {
      run.step([blocker(f), walk(1)]);
      if (bs[1].x > 26 * TILE) return f;
    }
    return Infinity;
  }

  const alone = () => {
    const { run, bs } = lineup(1, { level: tunnel(), tx: 10 });
    let f = 0;
    for (; f < 1800 && bs[0].x <= 26 * TILE; f++) run.step([walk(1)]);
    return f;
  };

  it('a bystander in a one-tile tunnel costs you about a second', () => {
    expect(crossing(() => NO_INPUT)).toBeLessThan(alone() + SLIP + 30);
  });

  it("a blocker pushing back as hard as they can can't hold the tunnel", () => {
    expect(crossing(() => walk(-1))).toBeLessThan(alone() + SLIP + 40);
    expect(crossing(() => dash(-1))).toBeLessThan(alone() + SLIP + 40);
  });

  it("a blocker stepping back and forth can't keep resetting the clock", () => {
    expect(crossing((f) => walk(f % 40 < 30 ? -1 : 1))).toBeLessThan(alone() + 3 * SLIP);
  });

  it('two runners meeting in a tunnel both get through', () => {
    const { run, bs } = lineup(2, { level: tunnel(), tx: 10 });
    bs[0].x = 10 * TILE;
    bs[1].x = 26 * TILE;
    let f = 0;
    for (; f < 600 && (bs[0].x < 26 * TILE || bs[1].x > 10 * TILE); f++) run.step([walk(1), walk(-1)]);
    expect(f).toBeLessThan(600);
  });

  it('three in a row do not stack up the wait', () => {
    const { run, bs } = lineup(4, { level: tunnel(), tx: 10 });
    bs[0].x = 10 * TILE;
    bs[1].x = 16 * TILE;
    bs[2].x = 18 * TILE;
    bs[3].x = 20 * TILE;
    let f = 0;
    for (; f < 1200 && bs[0].x <= 26 * TILE; f++) run.step([walk(1), NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(f).toBeLessThan(1200);
  });

  it('someone pinned at a dead end lets you in beside them', () => {
    const { run, bs } = lineup(2);
    bs[1].x = WALL_X * TILE - bs[1].w;
    bs[0].x = bs[1].x - 12;
    for (let f = 0; f < SLIP + 20; f++) run.step([walk(1), NO_INPUT]);
    expect(bs[0].x + bs[0].w).toBeCloseTo(WALL_X * TILE, 6);
  });

  it('a one-tile bridge can be crossed past someone on it, by pushing or by jumping', () => {
    const bridge = () => {
      const level = testLevel();
      for (let y = FLOOR + 1; y < LEVEL_H; y++) for (let x = 12; x < 26; x++) level.tiles[y * LEVEL_W + x] = 0;
      return level;
    };
    expect(crossing(() => NO_INPUT, bridge())).toBeLessThan(Infinity);
    const { run, bs } = lineup(2, { level: bridge() });
    bs[0].x = 18 * TILE + 3;
    bs[1].x = 15 * TILE;
    let over = false;
    for (let f = 0; f < 80; f++) {
      run.step([NO_INPUT, press({ right: true, run: true, jump: f < 30, jumpPressed: f === 10 })]);
      over ||= bs[1].x > bs[0].x + bs[0].w;
    }
    expect(over).toBe(true);
  });

  it("press winds down when you let off, and being pushed isn't pressing", () => {
    const { run, rs } = touching();
    for (let f = 0; f < 20; f++) run.step([walk(1), NO_INPUT]);
    expect(rs[0].press).toBe(20);
    expect(rs[1].press).toBe(0);
    steps(run, 30);
    expect(rs[0].press).toBe(0);
  });

  const touching = () => lineup(2, { spacing: 10 });
});

describe('who collides', () => {
  it('dead and finished runners are not there', () => {
    for (const out of ['dead', 'finished'] as const) {
      const { run, rs, bs } = lineup(2, { spacing: 10 });
      if (out === 'dead') rs[1].alive = false;
      else rs[1].finished = true;
      const x0 = bs[0].x;
      for (let f = 0; f < 30; f++) run.step([walk(1), NO_INPUT]);
      expect(bs[0].x - x0).toBeGreaterThan(PHYS.walkSpeed * 0.4);
    }
  });

  it('a base that finishes or dies drops its rider', () => {
    for (const out of ['dead', 'finished'] as const) {
      const { run, rs, bs } = lineup(2);
      dropOn(bs[1], bs[0]);
      steps(run, 30);
      expect(rs[1].ride).toBe(0);
      if (out === 'dead') rs[0].alive = false;
      else rs[0].finished = true;
      steps(run, 40);
      expect(rs[1].ride).toBe(-1);
      expect(feet(bs[1])).toBe(FLOOR * TILE);
    }
  });

  it('a runner on a rope touches nobody: you fall right past them', () => {
    const level = testLevel();
    for (let x = 8; x < 40; x++) level.tiles[6 * LEVEL_W + x] = 1;
    const rope = prop([{ type: 'rope', at: [0.5, 0], length: 8, strain: 600, regrow: 120 }], 20, 7, 7, 1, { mount: 'hang' });
    const { run, rs, bs } = lineup(2, { level, props: [rope] });
    airborne(bs[0], 20.5 * TILE - 5, 12 * TILE);
    run.step(noInputs(run));
    expect(rs[0].attach.grip).not.toBeNull();
    steps(run, 3);
    airborne(bs[1], bs[0].x, bs[0].y - 24);
    let met = false;
    for (let f = 0; f < 60; f++) {
      run.step(noInputs(run));
      met ||= overlaps(bs[0], bs[1]);
      expect(rs[1].ride).toBe(-1);
    }
    expect(met).toBe(true);
    expect(rs[0].attach.grip).not.toBeNull();
    expect(feet(bs[1])).toBe(FLOOR * TILE);
  });

  it('frozen and dazed runners stay solid: you can stand on them and shove them', () => {
    const { run, rs, bs } = lineup(3, { spacing: 10 });
    rs[1].status.frozen = 100;
    dropOn(bs[2], bs[1]);
    steps(run, 30);
    expect(rs[2].ride).toBe(1);
    rs[0].items.daze = 15;
    const x0 = bs[1].x;
    for (let f = 0; f < 14; f++) run.step([walk(1), NO_INPUT, NO_INPUT]); // The dazed can't push.
    expect(bs[1].x).toBe(x0);
    rs[0].items.daze = 0;
    for (let f = 0; f < 20; f++) run.step([walk(1), NO_INPUT, NO_INPUT]);
    expect(bs[1].x).toBeGreaterThan(x0);
  });
});

describe('interactions', () => {
  it('a runner shoved onto spikes dies as usual: the spikes get the credit, not the shover', () => {
    const { run, rs, bs } = lineup(2, { spacing: 10, props: [spikeAt(18)] });
    bs[1].x = 18 * TILE - bs[1].w - 4;
    bs[0].x = bs[1].x - bs[0].w;
    for (let f = 0; f < SLIP && rs[1].alive; f++) run.step([dash(1), NO_INPUT]);
    expect(rs[1].alive).toBe(false);
    expect([rs[1].cause, rs[1].killer]).toEqual(['hazard', 7]);
    expect(run.kills).toEqual([{ victim: 1, killer: 7 }]);
    expect(rs[0].alive).toBe(true);
  });

  it('a rider knocked off onto spikes dies, and the base that knocked it is not credited', () => {
    const { run, rs, bs } = lineup(2, { props: [spikeAt(13)] });
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    expect(rs[1].ride).toBe(0);
    for (let f = 0; f < 60 && rs[1].alive; f++) run.step([walk(1), NO_INPUT]);
    expect(rs[1].alive).toBe(false);
    expect([rs[1].cause, rs[1].killer]).toEqual(['hazard', 7]);
    expect(rs[0].alive).toBe(true);
    expect(feet(bs[0])).toBe(FLOOR * TILE);
  });

  it('a spring under the base bucks its rider higher still', () => {
    const spring: Module = { type: 'spring', at: [0.5, 0.5], angle: UP, power: 500 };
    const { run, rs, bs } = lineup(2, { props: [prop([spring], 14, FLOOR - 1)] });
    bs[0].x = 14 * TILE - bs[0].w - 0.5;
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    // A nudge onto the pad, too gentle to knock the rider off on its own.
    for (let f = 0; f < 3 && rs[0].springCooldown === 0; f++) {
      expect(rs[1].ride).toBe(0);
      run.step([walk(1), NO_INPUT]);
    }
    expect(rs[0].springCooldown).toBeGreaterThan(0);
    expect(rs[1].ride).toBe(-1);
    expect(bs[1].vy).toBeLessThan(bs[0].vy);
    steps(run, 8);
    expect(feet(bs[0])).toBeLessThan(FLOOR * TILE - 20);
    expect(feet(bs[1])).toBeLessThan(bs[0].y);
  });

  it('a bumper throws the rider it touches, and the base walks on', () => {
    const bumper: Module = { type: 'bumper', at: [0.5, 0.5], radius: 1, power: 400 };
    const { run, rs, bs } = lineup(2, { props: [prop([bumper], 17, FLOOR - 3)] });
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    let kicked = false;
    for (let f = 0; f < 60 && !kicked; f++) {
      run.step([walk(1), NO_INPUT]);
      kicked = rs[1].ride === -1;
    }
    expect(kicked).toBe(true);
    expect(bs[1].vy).toBeLessThan(0);
    expect(bs[0].onGround).toBe(true);
    expect(feet(bs[0])).toBe(FLOOR * TILE);
    steps(run, 2);
    expect(feet(bs[1])).toBeLessThan(bs[0].y);
  });

  it('a base knocked out from under you leaves you behind', () => {
    const { run, rs, bs } = lineup(2);
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    bs[0].vx = 500;
    bs[0].vy = -100;
    bs[0].onGround = false;
    bs[0].groundRef = -1;
    steps(run, 12);
    expect(rs[1].ride).toBe(-1);
    expect(bs[0].x).toBeGreaterThan(bs[1].x + bs[1].w);
  });

  it('a stack on a glider counts as its whole load', () => {
    const sink = (n: number) => {
      const run = new RunWorld(
        testLevel(),
        [],
        Array.from({ length: n }, (_, i) => i),
      );
      run.frame = RUN_COUNTDOWN;
      const g = makeProjectile({ x: 16 * TILE, y: 10 * TILE, vx: 0, vy: 0, owner: 1, ammo: 'glider' }, run.frame, 50);
      run.projectiles.push(g);
      run.runners.forEach((r, i) => airborne(r.body, g.x - r.body.w / 2, g.y - 40 - i * 30));
      steps(run, 40);
      expect(run.runners[0].body.groundRef).toBe(gliderSolidId(g));
      if (n > 1) expect(run.runners[1].ride).toBe(run.runners[0].slot);
      const y = g.y;
      steps(run, 10);
      return { load: g.n, sunk: g.y - y };
    };
    const one = sink(1);
    const three = sink(3);
    expect(one.load).toBe(1);
    expect(three.load).toBe(3);
    expect(three.sunk).toBeGreaterThan(one.sunk);
  });

  it('wind blows the rider off a base it never touches', () => {
    const fan: Module = { type: 'fan', at: [0.5, 0.5], angle: 0, length: 12, strength: 1300 };
    const { run, rs, bs } = lineup(2, { props: [prop([fan], 17, FLOOR - 2)] });
    while (bs[0].x < 19 * TILE) run.step([walk(1), NO_INPUT]);
    steps(run, 5);
    const x0 = bs[0].x;
    dropOn(bs[1], bs[0], 1);
    let rode = false;
    for (let f = 0; f < 60; f++) {
      run.step(noInputs(run));
      rode ||= rs[1].ride === 0;
    }
    expect(rode).toBe(true);
    expect(bs[0].x).toBe(x0);
    expect(rs[1].ride).toBe(-1);
    expect(bs[1].x).toBeGreaterThan(x0 + bs[0].w);
  });

  it('a shield still pops you off a head', () => {
    const { run, rs, bs } = lineup(2);
    giveItem(rs[1], 'shield');
    dropOn(bs[1], bs[0]);
    steps(run, 30);
    run['kill'](rs[1], 3, 'hazard');
    expect(rs[1].alive).toBe(true);
    expect(bs[1].vy).toBeLessThan(0);
    steps(run, 3);
    expect(rs[1].ride).toBe(-1);
    expect(feet(bs[1])).toBeLessThan(bs[0].y);
  });
});

describe('the lone controller', () => {
  const script = (f: number) =>
    press({ right: f % 200 < 150, left: f % 200 >= 170, run: f % 70 > 30, jump: f % 45 < 20, jumpPressed: f % 45 === 0, down: f % 90 > 80 });

  it('a race with one runner is exactly stepBody', () => {
    const level = testLevel();
    const run = new RunWorld(level, [], [0]);
    const raw = bodyAtCell(level.spawn.tx, level.spawn.ty);
    run.runners[0].body = bodyAtCell(level.spawn.tx, level.spawn.ty);
    run.frame = RUN_COUNTDOWN;
    for (let f = 0; f < 900; f++) {
      run.step([script(f)]);
      stepBody(raw, script(f), { ...terrain(level), gravity: 1 });
      expect(run.runners[0].body).toEqual(raw);
    }
  });

  it('runners who never touch are exactly lone controllers', () => {
    const { run, bs } = lineup(2, { spacing: 60 });
    const lone = lineup(1);
    const inputs = (f: number) => press({ right: f % 40 < 20, left: f % 40 >= 20, jump: f % 30 < 15, jumpPressed: f % 30 === 0 });
    for (let f = 0; f < 300; f++) {
      run.step([inputs(f), inputs(f)]);
      lone.run.step([inputs(f)]);
      expect(bs[0]).toEqual(lone.bs[0]);
    }
  });
});

describe('fuzz', () => {
  it('eight mashing runners never enter terrain, and any new overlap has a reason', () => {
    const level = testLevel();
    for (let x = 8; x < 16; x++) level.tiles[14 * LEVEL_W + x] = 2; // A one-way shelf.
    for (let x = 18; x < 24; x++) level.tiles[(FLOOR - 2) * LEVEL_W + x] = 1; // A low overhang.
    for (let y = 0; y < FLOOR; y++) level.tiles[y * LEVEL_W] = level.tiles[y * LEVEL_W + LEVEL_W - 1] = 1; // Walls, so nobody leaves.
    const world = terrain(level);
    for (const seed of [11, 22, 33]) {
      const rng = new Rng(seed);
      const run = new RunWorld(level, [], [0, 1, 2, 3, 4, 5, 6, 7]);
      run.frame = RUN_COUNTDOWN;
      run.runners.forEach((r, i) => airborne(r.body, 90 + i * 24, FLOOR * TILE - 14 - (i % 3) * 30));
      let held = run.runners.map(() => NO_INPUT);
      for (let f = 0; f < 2400; f++) {
        const fresh = f % 12 === 0;
        if (fresh) {
          held = run.runners.map(() => {
            const d = rng.int(0, 3);
            return press({ left: d === 0, right: d >= 2, run: rng.int(0, 2) === 0, jump: rng.int(0, 2) === 0, down: rng.int(0, 5) === 0 });
          });
        }
        const before = run.runners.map((r) => ({ body: { ...r.body }, press: r.press, bonk: r.items.bonkCredit }));
        run.step(held.map((h) => (h.jump && fresh ? { ...h, jumpPressed: true } : h)));
        run.runners.forEach((r, i) => {
          expect(firstOverlap(r.body, world), `seed ${seed} frame ${f} runner ${i} in terrain`).toBeNull();
          for (let j = i + 1; j < 8; j++) {
            const o = run.runners[j];
            if (r.finished || o.finished || !r.alive || !o.alive) continue;
            if (!overlaps(r.body, o.body) || overlaps(before[i].body, before[j].body)) continue;
            // A bump from below lets the pair pass through each other until they've come apart: it's a fresh bonk, whose
            // credit went up or (bumped again) didn't tick down.
            const rebonked = (now: number, was: number) => now > 0 && now >= was;
            const bumped = rebonked(r.items.bonkCredit, before[i].bonk) || rebonked(o.items.bonkCredit, before[j].bonk);
            const why =
              bumped || before[i].press >= SLIP || before[j].press >= SLIP || r.body.dropFrames > 0 || o.body.dropFrames > 0 || run.isSafe(r) || run.isSafe(o);
            expect(why, `seed ${seed} frame ${f}: ${i} and ${j} overlap for no reason`).toBe(true);
          }
        });
      }
    }
  });
});

describe('online', () => {
  /** Open floor 8 tiles wide with room to stack and jump, or null. */
  function flatSpot(level: Level) {
    const clear = (tx: number, ty: number) => {
      for (let x = tx; x < tx + 8; x++) {
        if (tileAt(level, x, ty + 1) !== 1) return false;
        for (let y = ty - 5; y <= ty; y++) if (tileAt(level, x, y) !== 0) return false;
      }
      return true;
    };
    for (let ty = 6; ty < level.h - 2; ty++) for (let tx = 8; tx < level.w - 16; tx++) if (clear(tx, ty)) return { tx, ty };
    return null;
  }

  /** A seed whose level has that open ground. */
  const FLAT_SEED = (() => {
    let seed = 4242;
    while (!flatSpot(new Match(seed).level)) seed++;
    return seed;
  })();

  /** A real two-player race, through the real Match, on open ground. */
  function match(arena?: Level) {
    const m = new Match(FLAT_SEED);
    m.join('a');
    m.join('b');
    m.startMatch();
    m.placed = [];
    m.level.setPieces = [];
    if (arena) m.level = arena;
    m.startRun();
    const { tx, ty } = arena ? { tx: 14, ty: FLOOR - 1 } : flatSpot(m.level)!;
    const rs = m.run!.runners;
    rs[0].body = bodyAtCell(tx + 2, ty);
    rs[1].body = bodyAtCell(tx + 4, ty);
    while (m.run!.frame < RUN_COUNTDOWN) m.step({});
    return m;
  }

  /** Two runners jostling: A chases B and jumps a lot, B comes back at A or stands its ground. Contact on most frames. */
  const jostle = (m: Match, f: number): Record<string, InputFrame> => {
    const [a, b] = m.run!.runners.map((r) => r.body);
    const toB: -1 | 1 = b.x >= a.x ? 1 : -1;
    return {
      a: press({ ...(f % 200 < 150 ? (toB > 0 ? walk(1) : walk(-1)) : NO_INPUT), run: f % 120 < 40, jump: f % 47 < 20, jumpPressed: f % 47 === 0 }),
      b: press({ ...(f % 90 < 45 ? (toB > 0 ? walk(-1) : walk(1)) : NO_INPUT), jump: (f + 11) % 61 < 25, jumpPressed: (f + 11) % 61 === 0 }),
    };
  };

  it('identical runs hash the same, mid-stack and mid-shove', () => {
    const a = match();
    const b = match();
    for (let f = 0; f < 900; f++) {
      a.step(jostle(a, f));
      b.step(jostle(b, f));
      if (f % 50 === 0) expect(hashMatch(a), `frame ${f}`).toBe(hashMatch(b));
    }
  });

  it('two identical matches agree through every way off a head: a slide, a tip, a buck and a knock', () => {
    /** B lands on A every 100 frames, off centre for the slide; A stands for the tip, jumps for the buck, walks off for the knock. */
    const script = (m: Match, f: number): Record<string, InputFrame> => {
      const [a, b] = m.run!.runners.map((r) => r.body);
      const k = Math.floor(f / 100) % 4;
      const t = f % 100;
      if (t === 0) dropOn(b, a, 4);
      if (t === 0 && k === 0) b.x += 3;
      return { a: k === 2 && t === 20 ? JUMP : k === 2 && t > 20 ? HOLD_JUMP : k === 3 && t > 20 && t < 40 ? walk(1) : NO_INPUT, b: NO_INPUT };
    };
    const a = match(testLevel());
    const b = match(testLevel());
    const offs = new Set<string>();
    for (let f = 0; f < 800; f++) {
      const before = a.run!.runners[1].ride;
      a.step(script(a, f));
      b.step(script(b, f));
      const r = a.run!.runners[1];
      if (before >= 0 && r.ride < 0) offs.add(r.body.vy < -PERCH.hop ? 'buck' : r.body.vy < 0 ? 'thrown' : 'slid');
      expect(hashMatch(b), `frame ${f}`).toBe(hashMatch(a));
    }
    expect([...offs].sort()).toEqual(['buck', 'slid', 'thrown']);
  });

  it('snapshot round trip: restored mid-ride and mid-shove, the race goes on bit-identically', () => {
    const a = match();
    const rs = a.run!.runners;
    dropOn(rs[1].body, rs[0].body);
    rs[1].body.x += 2;
    for (let f = 0; f < 12; f++) a.step({});
    expect(rs[1].ride).toBe(rs[0].slot);
    const snap = JSON.parse(JSON.stringify(snapshotMatch(a)));
    const b = new Match(1);
    restoreMatch(b, snap);
    expect(b.run!.runners[1].ride).toBe(rs[0].slot);
    expect(b.run!.runners[1].perch).toBe(rs[1].perch);
    expect(hashMatch(b)).toBe(hashMatch(a));
    for (let f = 0; f < 400; f++) {
      a.step(jostle(a, f));
      b.step(jostle(b, f));
    }
    expect(hashMatch(b)).toBe(hashMatch(a));
  });

  it('a mispredicted contact stays inside the 24 px teleport budget', () => {
    /**
     * A guest shows the confirmed state plus `lag` frames predicted from the other side's last known buttons.
     * Same measure as the netcode contact scenario: how far a drawn runner moves sideways past what its speed
     * explains. `ease` is the session's presentation easing (`drawnVelocity`), which keeps 85% of an error each frame.
     */
    const replay = (lag: number, ease: boolean) => {
      const live = match(testLevel());
      const confirmed = match(testLevel());
      const predictor = new Predictor();
      const history: Record<string, InputFrame>[] = [];
      let drawn: { x: number; y: number }[] = [];
      let snap = 0;
      let contact = 0;
      for (let f = 0; f < 900; f++) {
        history.push(jostle(live, f));
        live.step(history[f]);
        if (f >= lag) confirmed.step(history[f - lag]);
        const shown = predictor.copy(confirmed);
        const known = history[Math.max(0, f - lag)].b;
        for (let k = Math.max(0, f - lag + 1); k <= f; k++) shown.step({ a: history[k].a, b: { ...known, jumpPressed: false } });
        const runners = shown.run!.runners;
        const v = runners.map((r) => drawnVelocity(r));
        const now = runners.map(({ body: b }, i) => {
          const was = drawn[i];
          if (!was || !ease) return { x: b.x, y: b.y };
          return { x: b.x + (was.x + v[i].x * DT - b.x) * 0.85, y: b.y + (was.y + v[i].y * DT - b.y) * 0.85 };
        });
        if (drawn.length) runners.forEach((_, i) => (snap = Math.max(snap, Math.abs(now[i].x - drawn[i].x) - Math.abs(v[i].x) * DT)));
        drawn = now;
        // A stack, a shove, or a bump from below (the stars it leaves).
        if (confirmed.run!.runners.some((r) => r.ride >= 0 || r.press > 0 || r.items.daze > 0)) contact++;
      }
      expect(contact).toBeGreaterThan(150);
      return snap;
    };
    expect(replay(5, false)).toBeLessThan(24); // The scenario's 40 ms each way, drawn straight.
    for (const lag of [5, 12]) expect(replay(lag, true), `lag ${lag}`).toBeLessThan(24);
  });
});

describe('cost', () => {
  it('eight runners in a heap stay far under a frame', () => {
    const { run, bs } = lineup(8, { spacing: 10 });
    for (let i = 4; i < 8; i++) dropOn(bs[i], bs[i - 4]);
    const inputs = (f: number) =>
      run.runners.map((_, i) => press({ right: (f + i * 7) % 40 < 20, left: (f + i * 7) % 40 >= 20, jump: true, jumpPressed: (f + i * 5) % 37 === 0 }));
    const t0 = performance.now();
    const frames = 2000;
    for (let f = 0; f < frames; f++) run.step(inputs(f));
    expect((performance.now() - t0) / frames).toBeLessThan(4);
  });
});

describe('more than one spawn', () => {
  it('runner i starts at the i-th spawn, round and round, each spawn with a safe zone of its own', () => {
    const level = testLevel();
    level.spawns = [{ tx: LEVEL_W - 3, ty: FLOOR - 1 }];
    const run = new RunWorld(level, [], [0, 1, 2, 3]);
    const at = (i: number) => Math.floor((run.runners[i].body.x + run.runners[i].body.w / 2) / TILE);
    expect([at(0), at(2)].every((x) => Math.abs(x - level.spawn.tx) <= 1)).toBe(true);
    expect([at(1), at(3)].every((x) => Math.abs(x - (LEVEL_W - 3)) <= 1)).toBe(true);
    expect(run.safeZones).toHaveLength(2);
    expect(run.runners.every((r) => run.isSafe(r))).toBe(true);
  });
});
