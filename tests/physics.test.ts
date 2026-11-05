import { describe, expect, it } from 'vitest';
import { PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { ICE_SURFACE } from '../src/sim/ground';
import { Rng } from '../src/core/rng';
import { generateTheme } from '../src/gen/theme';
import { type Level, offMap, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import {
  type Body,
  bodyAtCell,
  type CollisionWorld,
  type Controls,
  createBody,
  DEFAULT_SURFACE,
  firstOverlap,
  jumpMetrics,
  type Solid,
  solidGrid,
  type Surface,
  stepBody,
  TILE_ONEWAY_ID,
  wallKind,
} from '../src/sim/physics';

/** Grid world from rows: '#' solid, '=' one-way, anything else empty. Outside x is solid, outside y empty. */
function grid(rows: string[], solids: Solid[] = []): CollisionWorld {
  const h = rows.length;
  const w = rows[0].length;
  return {
    tileAt: (x, y) => {
      if (x < 0 || x >= w) return T_SOLID;
      if (y < 0 || y >= h) return 0;
      const ch = rows[y][x];
      return ch === '#' ? T_SOLID : ch === '=' ? T_ONEWAY : 0;
    },
    solids,
  };
}

/** Rows of `w` empty cells with a solid floor from row `floor` down. */
function open(w: number, h: number, floor: number): string[] {
  return Array.from({ length: h }, (_, y) => (y >= floor ? '#' : '.').repeat(w));
}

function put(rows: string[], x: number, y: number, ch: string): void {
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
}

const idle: Controls = { left: false, right: false, down: false, jump: false, jumpPressed: false };
const ctl = (o: Partial<Controls>): Controls => ({ ...idle, ...o });
const flat = grid(open(40, 12, 10));

function run(b: Body, world: CollisionWorld, frames: number, input: (f: number) => Controls): void {
  for (let f = 0; f < frames; f++) stepBody(b, input(f), world);
}

/**
 * Wall-hopping policy a human can perform: hold toward the wall `dir`; whenever
 * pressing into it past the apex, release jump for a frame and re-press.
 * zigzag holds away on each press (strong kick) and then steers into the
 * opposite wall (shaft climb).
 */
function wallHop(b: Body, world: CollisionWorld, frames: number, dir: -1 | 1, zigzag: boolean): number {
  let d = dir;
  let press = true;
  let held = false;
  let minY = b.y;
  const jumps0 = b.wallJumps;
  for (let f = 0; f < frames; f++) {
    let jump = held;
    let jumpPressed = false;
    if (press) {
      if (zigzag && f > 0) d = d > 0 ? -1 : 1;
      jump = true;
      jumpPressed = true;
      press = false;
      held = true;
    } else if (!b.onGround && b.wallDir === d && b.vy >= 0) {
      jump = false;
      press = true;
    }
    stepBody(b, ctl({ left: d < 0, right: d > 0, jump, jumpPressed }), world);
    minY = Math.min(minY, b.y);
  }
  expect(b.wallJumps - jumps0).toBeGreaterThan(1);
  return minY;
}

describe('player controller: run & jump feel', () => {
  const m = jumpMetrics();

  it('rests on the ground', () => {
    const b = bodyAtCell(5, 9);
    const y0 = b.y;
    run(b, flat, 60, () => idle);
    expect(b.y).toBeCloseTo(y0, 5);
    expect(b.onGround).toBe(true);
  });

  it('walk is slow and precise; run is fast with momentum (skids, overshoots)', () => {
    expect(m.walkSpeed).toBeGreaterThanOrEqual(5.5);
    expect(m.walkSpeed).toBeLessThanOrEqual(7.5);
    expect(m.runSpeed).toBeGreaterThanOrEqual(12.5);
    expect(m.runSpeed).toBeLessThanOrEqual(14.5);
    // Running takes a beat to build and skids when you let go or turn.
    expect(m.accelTime).toBeGreaterThanOrEqual(0.18);
    expect(m.accelTime).toBeLessThanOrEqual(0.35);
    expect(m.stopTime).toBeGreaterThanOrEqual(0.2);
    expect(m.stopTime).toBeLessThanOrEqual(0.4);
    expect(m.turnTime).toBeGreaterThan(m.stopTime);
    // A walking jump is short; a running jump roughly doubles it.
    expect(m.walkJumpDistance).toBeLessThan(5);
    expect(m.jumpDistance).toBeGreaterThan(m.walkJumpDistance * 1.8);
  });

  it('full jump ~3.7 tiles, tap ~1.3 tiles, long running jump', () => {
    expect(m.jumpHeight).toBeGreaterThan(3.4);
    expect(m.jumpHeight).toBeLessThan(4.0);
    expect(m.shortHopHeight).toBeGreaterThan(1.0);
    expect(m.shortHopHeight).toBeLessThan(1.8);
    expect(m.jumpDistance).toBeGreaterThan(6);
    expect(m.jumpDistance).toBeLessThan(9);
  });

  it('jump height grows with how long jump is held', () => {
    const heights = [1, 4, 8, 99].map((hold) => {
      const b = bodyAtCell(5, 9);
      const y0 = b.y;
      let minY = y0;
      run(b, flat, 60, (f) => {
        minY = Math.min(minY, b.y);
        return ctl({ jump: f < hold, jumpPressed: f === 0 });
      });
      expect(b.onGround).toBe(true);
      return (y0 - minY) / TILE;
    });
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
  });

  it('falls faster than it rises and has terminal velocity; fast-fall is faster', () => {
    expect(m.fallSpeed).toBeCloseTo(PHYS.maxFall / TILE, 5);
    expect(m.fastFallSpeed).toBeGreaterThan(m.fallSpeed * 1.2);
    const fallFrames = (down: boolean) => {
      const b = createBody(5 * TILE, 0);
      const w = grid(open(10, 41, 40));
      let f = 0;
      for (; !b.onGround && f < 300; f++) stepBody(b, ctl({ down }), w);
      return f;
    };
    expect(fallFrames(true)).toBeLessThan(fallFrames(false) - 5);
  });

  it('coyote time: can still jump a few frames after running off a ledge', () => {
    const rows = open(30, 12, 10);
    for (let x = 10; x < 30; x++) for (let y = 10; y < 12; y++) put(rows, x, y, '.');
    const w = grid(rows);
    const b = bodyAtCell(8, 9);
    b.vx = PHYS.runSpeed;
    let left = -1;
    for (let f = 0; f < 60 && left < 0; f++) {
      stepBody(b, ctl({ right: true }), w);
      if (!b.onGround) left = f;
    }
    run(b, w, PHYS.coyoteFrames - 2, () => ctl({ right: true }));
    stepBody(b, ctl({ right: true, jump: true, jumpPressed: true }), w);
    expect(b.vy).toBeLessThan(-PHYS.jumpVel * 0.8);
  });

  it('jump buffer: pressing jump just before landing still jumps', () => {
    const b = bodyAtCell(5, 9);
    b.y -= 20;
    b.onGround = false;
    b.vy = 200;
    let jumpedAt = -1;
    run(b, flat, 30, (f) => {
      if (jumpedAt < 0 && b.vy < -PHYS.jumpVel * 0.8) jumpedAt = f;
      return ctl({ jump: true, jumpPressed: f === 0 });
    });
    expect(jumpedAt).toBeGreaterThan(0);
  });

  it('cannot walk through walls', () => {
    const b = bodyAtCell(37, 9);
    run(b, flat, 120, () => ctl({ right: true }));
    expect(b.x + b.w).toBeLessThanOrEqual(40 * TILE + 1e-6);
  });

  it('is deterministic', () => {
    const go = () => {
      const b = bodyAtCell(5, 9);
      run(b, flat, 200, (f) => ctl({ right: f % 50 < 30, left: f % 50 > 40, jump: f % 37 < 12, jumpPressed: f % 37 === 0, down: f % 23 === 0 }));
      return b;
    };
    expect(go()).toEqual(go());
  });
});

describe('player controller: walls', () => {
  /** Wall column at x=20 rising from the floor to row `top`. */
  function wallWorld(top: number, extra?: (rows: string[]) => void): CollisionWorld {
    const rows = open(40, 31, 30);
    for (let y = top; y < 30; y++) put(rows, 20, y, '#');
    extra?.(rows);
    return grid(rows);
  }

  it('past the side edges is open air: no wall to slide or climb, and a runner can lean out and come back', () => {
    const w: CollisionWorld = { ...grid(open(40, 31, 30)), cols: 40 };
    for (const side of [-1, 1] as const) {
      const b = bodyAtCell(side < 0 ? 0 : 39, 29);
      const press = { left: side < 0, right: side > 0 };
      run(b, w, 120, (f) => ctl({ ...press, jump: f % 6 < 3, jumpPressed: f % 6 === 0 }));
      expect(b.wallJumps).toBe(0);
      expect(offMap(b, 40)).toBe(true);
      // A toe over the edge stays on the floor and walks back.
      const lean = bodyAtCell(side < 0 ? 0 : 39, 29);
      lean.x = side < 0 ? -lean.w / 2 : 40 * TILE - lean.w / 2;
      run(lean, w, 2, () => idle);
      expect(lean.onGround).toBe(true);
      run(lean, w, 20, () => ctl({ left: side > 0, right: side < 0 }));
      expect(offMap(lean, 40)).toBe(false);
      expect(lean.x).toBeGreaterThanOrEqual(0);
      expect(lean.x + lean.w).toBeLessThanOrEqual(40 * TILE);
    }
  });

  it('a runner who goes off a side of the level dies of it, and spills nothing', () => {
    const W = 30;
    const H = 16;
    const tiles = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) tiles[(H - 1) * W + x] = T_SOLID;
    const level: Level = {
      seed: 1,
      w: W,
      h: H,
      tiles,
      spawn: { tx: 4, ty: H - 2 },
      goal: { tx: W - 3, ty: H - 2 },
      protectedRects: [],
      theme: generateTheme(1, 'farm'),
      style: 'test',
      version: 0,
      setPieces: [],
    };
    const race = new RunWorld(level, [], [0]);
    const left: InputFrame = { ...NO_INPUT, left: true };
    for (let f = 0; f < RUN_COUNTDOWN + 120 && race.runners[0].alive; f++) race.step([left]);
    expect(race.runners[0].alive).toBe(false);
    expect(race.runners[0].cause).toBe('out');
    expect(race.blood).toHaveLength(0);
  });

  it('wall slide caps fall speed while pressing into the wall', () => {
    const w = wallWorld(0);
    const b = createBody(20 * TILE - PLAYER_W_OF(), 2 * TILE);
    run(b, w, 40, () => ctl({ right: true }));
    expect(b.wallDir).toBe(1);
    expect(b.vy).toBeLessThanOrEqual(PHYS.wallSlideMax + 1e-6);
    const free = createBody(20 * TILE - PLAYER_W_OF(), 2 * TILE);
    run(free, w, 40, () => idle);
    expect(free.vy).toBeGreaterThan(PHYS.wallSlideMax * 2);
  });

  it('wall jump kick depends on held input: into = near-vertical, neutral = moderate, away = strong', () => {
    const w = wallWorld(0);
    const kick = (held: -1 | 0 | 1) => {
      const b = createBody(20 * TILE - PLAYER_W_OF(), 10 * TILE);
      run(b, w, 10, () => ctl({ right: true }));
      expect(b.wallDir).toBe(1);
      stepBody(b, ctl({ left: held < 0, right: held > 0, jump: true, jumpPressed: true }), w);
      expect(b.vy).toBeLessThan(-PHYS.wallJumpVy * 0.8);
      return -b.vx;
    };
    const into = kick(1);
    const neutral = kick(0);
    const away = kick(-1);
    expect(into).toBeGreaterThanOrEqual(0);
    expect(into).toBeLessThan(80);
    expect(neutral).toBeGreaterThan(into + 60);
    expect(away).toBeGreaterThan(neutral + 40);
  });

  it('holding into a single tall wall and mashing jump climbs it (>= 8 tiles)', () => {
    const w = wallWorld(0);
    const b = bodyAtCell(19, 29);
    const y0 = b.y;
    let minY = y0;
    run(b, w, 240, (f) => {
      minY = Math.min(minY, b.y);
      return ctl({ right: true, jump: f % 6 < 3, jumpPressed: f % 6 === 0 });
    });
    expect((y0 - minY) / TILE).toBeGreaterThanOrEqual(8);
    // Same-side cooldown: mashing is not flight. Roughly a hop per cooldown at most.
    expect(b.wallJumps).toBeLessThanOrEqual(Math.ceil(240 / PHYS.wallJumpCooldownFrames));
  });

  it('wall coyote: a wall jump still works a few frames after leaving the wall', () => {
    const w = wallWorld(0);
    const b = createBody(20 * TILE - PLAYER_W_OF(), 10 * TILE);
    run(b, w, 10, () => ctl({ right: true }));
    // Drift away from the wall without jumping.
    let f = 0;
    for (; b.wallDir !== 0 && f < 30; f++) stepBody(b, ctl({ left: true }), w);
    expect(b.wallDir).toBe(0);
    stepBody(b, ctl({ left: true }), w);
    stepBody(b, ctl({ left: true, jump: true, jumpPressed: true }), w);
    expect(b.vy).toBeLessThan(-PHYS.wallJumpVy * 0.8);
    // ...but not long after.
    const late = createBody(20 * TILE - PLAYER_W_OF(), 10 * TILE);
    run(late, w, 10, () => ctl({ right: true }));
    run(late, w, PHYS.wallCoyoteFrames + 8, () => ctl({ left: true }));
    stepBody(late, ctl({ left: true, jump: true, jumpPressed: true }), w);
    expect(late.vy).toBeGreaterThan(0);
  });

  it('climbs a single tall wall by wall-jumping and steering back', () => {
    const top = 18; // 12 tiles: far above a full jump
    expect(30 - top).toBeGreaterThan(jumpMetrics().jumpHeight * 2);
    // The wall is the left face of a plateau.
    const w = wallWorld(top, (rows) => {
      for (let y = top; y < 30; y++) for (let x = 21; x < 40; x++) put(rows, x, y, '#');
    });
    const b = bodyAtCell(17, 29);
    wallHop(b, w, 360, 1, false);
    // Ended up standing on the plateau.
    expect(b.onGround).toBe(true);
    expect(b.y + b.h).toBeCloseTo(top * TILE, 5);
  });

  it('climbs a two-wall shaft by zig-zagging', () => {
    const rows = open(40, 31, 30);
    for (let y = 0; y < 30; y++) {
      put(rows, 16, y, '#');
      put(rows, 20, y, '#');
    }
    const w = grid(rows);
    const b = bodyAtCell(18, 29);
    const minY = wallHop(b, w, 300, 1, true);
    expect((30 * TILE - (minY + b.h)) / TILE).toBeGreaterThan(15);
  });

  it('ice floors skid from a walk as well as a run', () => {
    const rink = { ...grid(open(120, 12, 10)), surfaceAt: () => ICE_SURFACE };
    /** Tiles slid after walking (or running) right at full speed, then letting go. */
    const slide = (world: CollisionWorld, sprint: boolean) => {
      const b = bodyAtCell(3, 9);
      run(b, world, 150, () => ctl({ right: true, run: sprint }));
      const x0 = b.x;
      run(b, world, 400, () => idle);
      expect(b.vx).toBe(0);
      return (b.x - x0) / TILE;
    };
    expect(slide(grid(open(120, 12, 10)), false)).toBeLessThan(0.5);
    expect(slide(rink, false)).toBeGreaterThan(3);
    expect(slide(rink, false)).toBeLessThan(6);
    expect(slide(rink, true)).toBeGreaterThan(14);
    expect(slide(rink, true)).toBeLessThan(28);
  });

  it('slick (ice) walls: no slide cap and no wall jump', () => {
    const ice: Surface = { friction: 0.12, conveyor: 0, speedMult: 1.15, jumpMult: 1, bounce: 0 };
    expect(wallKind(ice)).toBe('slick');
    const w = grid(open(40, 31, 30), [propWall(ice)]);
    const b = createBody(20 * TILE - PLAYER_W_OF(), 2 * TILE);
    run(b, w, 40, () => ctl({ right: true }));
    expect(b.wallDir).toBe(1);
    expect(b.vy).toBeGreaterThan(PHYS.wallSlideMax * 2);
    stepBody(b, ctl({ right: true, jump: true, jumpPressed: true }), w);
    expect(b.vy).toBeGreaterThan(0);
  });

  it('sticky (goo) walls: slow cling slide and a weaker wall jump', () => {
    const goo: Surface = { friction: 1.4, conveyor: 0, speedMult: 0.5, jumpMult: 0.72, bounce: 0 };
    expect(wallKind(goo)).toBe('sticky');
    expect(wallKind({ ...DEFAULT_SURFACE, wall: 'sticky' })).toBe('sticky');
    const w = grid(open(40, 31, 30), [propWall(goo)]);
    const b = createBody(20 * TILE - PLAYER_W_OF(), 2 * TILE);
    run(b, w, 60, () => ctl({ right: true }));
    expect(b.vy).toBeLessThanOrEqual(PHYS.wallStickySlideMax + 1e-6);
    expect(b.vy).toBeGreaterThan(0);
    stepBody(b, ctl({ right: true, jump: true, jumpPressed: true }), w);
    expect(b.vy).toBeLessThan(0);
    expect(-b.vy).toBeLessThan(PHYS.wallJumpVy * 0.9);
  });
});

describe('player controller: forgiveness', () => {
  it('corner correction nudges a jump around a ceiling corner (≤4 px overlap)', () => {
    const rows = open(20, 12, 10);
    put(rows, 5, 6, '#'); // ceiling 3 rows above the jumper's head: within a full jump
    const w = grid(rows);
    const jumpWith = (overlap: number) => {
      const b = bodyAtCell(4, 9);
      b.x = 5 * TILE - b.w + overlap; // right edge overlaps the ceiling tile's left edge
      let minY = b.y;
      run(b, w, 25, (f) => {
        minY = Math.min(minY, b.y);
        return ctl({ jump: true, jumpPressed: f === 0 });
      });
      return { minY, x: b.x };
    };
    const ok = jumpWith(3);
    expect(ok.minY).toBeLessThan(6 * TILE);
    expect(ok.x + 10).toBeLessThanOrEqual(5 * TILE + 1e-6);
    const bonk = jumpWith(7);
    expect(bonk.minY).toBeGreaterThanOrEqual(7 * TILE - 1e-6);
  });

  it('ledge lip: moving sideways into a ledge ≤3 px above the feet pops onto it', () => {
    const rows = open(30, 12, 10);
    for (let x = 12; x < 30; x++) put(rows, x, 6, '#');
    const w = grid(rows);
    const attempt = (below: number) => {
      const b = createBody(12 * TILE - 10 - 2, 6 * TILE - 14 + below);
      b.vx = PHYS.runSpeed;
      run(b, w, 8, () => ctl({ right: true }));
      return b;
    };
    const ok = attempt(2);
    expect(ok.onGround).toBe(true);
    expect(ok.y + ok.h).toBeCloseTo(6 * TILE, 5);
    expect(ok.x).toBeGreaterThan(12 * TILE);
    const miss = attempt(6);
    expect(miss.x + miss.w).toBeLessThanOrEqual(12 * TILE + 1e-6);
  });
});

describe('player controller: one-way platforms', () => {
  // Floor at row 10, one-way platform across x 2..9 at row 7.
  const rows = open(20, 12, 10);
  for (let x = 2; x < 10; x++) put(rows, x, 7, '=');
  const w = grid(rows);

  it('jumps up through and lands on top', () => {
    const b = bodyAtCell(5, 9);
    run(b, w, 90, (f) => ctl({ jump: true, jumpPressed: f === 0 }));
    expect(b.onGround).toBe(true);
    expect(b.y + b.h).toBeCloseTo(7 * TILE, 5);
    expect(b.groundRef).toBe(TILE_ONEWAY_ID);
  });

  it('is not solid sideways', () => {
    const side = open(20, 12, 10);
    for (let y = 0; y < 10; y++) put(side, 8, y, '=');
    const b = bodyAtCell(5, 9);
    run(b, grid(side), 40, () => ctl({ right: true }));
    expect(b.x).toBeGreaterThan(9 * TILE);
  });

  it('drops through with down + jump, but not with down alone', () => {
    const b = bodyAtCell(5, 6);
    b.groundRef = TILE_ONEWAY_ID;
    run(b, w, 30, () => ctl({ down: true }));
    expect(b.y + b.h).toBeCloseTo(7 * TILE, 5);
    expect(b.onGround).toBe(true);
    run(b, w, 40, (f) => ctl({ down: true, jump: f < 3, jumpPressed: f === 0 }));
    expect(b.onGround).toBe(true);
    expect(b.y + b.h).toBeCloseTo(10 * TILE, 5);
  });

  it('down + jump on solid ground is a normal jump', () => {
    const b = bodyAtCell(15, 9);
    stepBody(b, ctl({ down: true, jump: true, jumpPressed: true }), w);
    expect(b.vy).toBeLessThan(-PHYS.jumpVel * 0.8);
  });
});

describe('player controller: props', () => {
  it('rides a moving platform', () => {
    const plat: Solid = { x: 48, y: 96, w: 48, h: 16, id: 7, dx: 2, dy: 0, surface: DEFAULT_SURFACE, propUid: 1, mi: 0 };
    const w = grid(open(40, 12, 10), [plat]);
    const b = createBody(60, 96 - 14);
    stepBody(b, idle, w);
    expect(b.groundRef).toBe(7);
    const x0 = b.x;
    for (let i = 0; i < 10; i++) {
      plat.x += plat.dx;
      stepBody(b, idle, w);
    }
    expect(b.x - x0).toBeCloseTo(20, 5);
  });

  it('bounces on jelly', () => {
    const jelly: Surface = { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1.05, bounce: 0.82 };
    const pad: Solid = { x: 0, y: 144, w: 200, h: 16, id: 3, dx: 0, dy: 0, surface: jelly, propUid: 1, mi: 0 };
    const b = createBody(50, 40);
    let bounced = false;
    run(b, grid(open(20, 12, 11), [pad]), 40, () => {
      if (b.vy < -100 && b.y > 60) bounced = true;
      return idle;
    });
    expect(bounced).toBe(true);
    expect(b.y + b.h).toBeLessThanOrEqual(144 + 1e-6);
  });
});

function PLAYER_W_OF(): number {
  return createBody(0, 0).w;
}

/** A prop wall at x=20 tiles, full height, carrying `surface`. */
function propWall(surface: Surface): Solid {
  return { x: 20 * TILE, y: 0, w: TILE, h: 30 * TILE, id: 9, dx: 0, dy: 0, surface, propUid: 1, mi: 0 };
}

describe('solid grid', () => {
  /** Overlapping solids, one-ways, movers, one huge and some off the level: whatever a race's parts build. */
  function solids(rng: Rng): Solid[] {
    const out: Solid[] = [];
    for (let i = 0; i < 60; i++) {
      const huge = i === 7;
      out.push({
        x: huge ? -5000 : rng.range(-80, 800),
        y: huge ? 300 : rng.range(-80, 450),
        w: huge ? 20000 : rng.range(2, 70),
        h: rng.range(2, 40),
        id: i,
        dx: rng.chance(0.2) ? rng.range(-2, 2) : 0,
        dy: rng.chance(0.2) ? rng.range(-2, 2) : 0,
        surface: DEFAULT_SURFACE,
        propUid: i,
        mi: 0,
        ...(rng.chance(0.3) && { oneWay: true }),
      });
    }
    return out;
  }

  it('answers every overlap and every step exactly as the plain scan', () => {
    for (const seed of [1, 2, 3]) {
      const rng = new Rng(seed);
      const list = solids(rng);
      const plain = grid(
        Array.from({ length: 27 }, (_, y) => (y === 26 ? '#'.repeat(48) : '.'.repeat(48))),
        list,
      );
      const fast: CollisionWorld = { ...plain, grid: solidGrid(list) };
      for (let i = 0; i < 2000; i++) {
        const r = { x: rng.range(-100, 820), y: rng.range(-100, 470), w: rng.range(0.5, 40), h: rng.range(0.5, 40) };
        const from = rng.chance(0.5) ? rng.range(-100, 470) : Number.POSITIVE_INFINITY;
        expect(firstOverlap(r, fast, true, from)).toBe(firstOverlap(r, plain, true, from));
      }
      for (let i = 0; i < 40; i++) {
        const a = createBody(rng.range(0, 740), rng.range(0, 380));
        const b = { ...a };
        for (let f = 0; f < 90; f++) {
          const c: Controls = {
            left: rng.chance(0.4),
            right: rng.chance(0.4),
            down: rng.chance(0.1),
            jump: rng.chance(0.5),
            jumpPressed: rng.chance(0.2),
            run: rng.chance(0.5),
          };
          stepBody(a, c, plain);
          stepBody(b, c, fast);
        }
        expect(b).toEqual(a);
      }
    }
  });
});
