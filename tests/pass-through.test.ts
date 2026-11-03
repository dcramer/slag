import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { TILE_SOLID_ID } from '../src/sim/physics';
import type { Module, Motion, PlacedProp, PropDef } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/**
 * Movers pass through placed parts (the owner, 2026-11-02): a set piece's
 * path or swing may run through a part someone put there. Kinematic solids
 * never touch each other, so the question is the runner caught between: only
 * the world, or a crusher, pins hard enough to kill. Pinned against a part,
 * the mover passes through the runner instead, and a rider carried into a
 * part is knocked off its mover, like hitting a ceiling.
 */

const FLOOR = 20;
const WALL = 30;

function testLevel(setPieces: PlacedProp[]): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + WALL] = 1;
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
const metal = (cells: [number, number][]): Module => ({ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
const row = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [i, 0] as [number, number]);

function part(uid: number, owner: number, cells: [number, number][], motion: Motion, tx: number, ty: number): PlacedProp {
  const def: PropDef = {
    key: `p${uid}`,
    name: 'Part',
    maker: 'x',
    archetype: 'platform',
    role: 'build',
    style: STYLE,
    motion,
    modules: [metal(cells)],
    footprint: cells,
  };
  return { uid, def, owner, tx, ty, rot: 0 };
}

const STILL: Motion = { type: 'none' };
const PIECE = 100_001;
const BLOCK = 7;

/** Run `frames` frames with nobody pressing anything, calling `each` after every one. */
function run(level: Level, placed: PlacedProp[], setup: (w: RunWorld) => void, frames: number, each: (w: RunWorld, f: number) => void = () => {}) {
  const w = new RunWorld(level, placed, [0]);
  setup(w);
  for (let f = 0; f < frames; f++) {
    w.step([NO_INPUT]);
    each(w, f);
  }
  return w;
}

const solid = (w: RunWorld, uid: number) => w.solids.find((s) => s.propUid === uid)!;

describe('movers pass through placed parts', () => {
  /** A three-wide lift at (10, 16) rising 4 tiles and back, and a placed beam across its path at row 12. */
  const lift = part(PIECE, -1, row(3), { type: 'rail', angle: -Math.PI / 2, range: 4, period: 120, dwell: 30 }, 10, 16);
  const beam = part(BLOCK, 3, row(3), STILL, 10, 12);
  const onLift = (w: RunWorld) => {
    const s = solid(w, PIECE);
    const b = w.runners[0].body;
    b.x = s.x + 16;
    b.y = s.y - b.h;
  };

  it('a lift runs through a beam in its path as if it were not there, and the beam stays put', () => {
    const lv = testLevel([lift]);
    const alone: number[] = [];
    run(lv, [], onLift, 300, (w) => alone.push(solid(w, PIECE).y));
    run(lv, [beam], onLift, 300, (w, f) => {
      expect(solid(w, PIECE).y, `frame ${f}`).toBe(alone[f]);
      expect(solid(w, BLOCK)).toMatchObject({ x: 10 * TILE, y: 12 * TILE, dx: 0, dy: 0 });
    });
    expect(Math.min(...alone)).toBeLessThan(13 * TILE);
  });

  it('a runner it carries into the beam is knocked off, falls through it, and lands unhurt', () => {
    let passed = false;
    let rode = false;
    const w = run(testLevel([lift]), [beam], onLift, 300, (w, f) => {
      const r = w.runners[0];
      expect(r.alive, `frame ${f}`).toBe(true);
      // Never inside the beam.
      const b = r.body;
      const s = solid(w, BLOCK);
      expect(b.y >= s.y + s.h - 1e-6 || b.y + b.h <= s.y + 1e-6 || b.x + b.w <= s.x || b.x >= s.x + s.w, `frame ${f}`).toBe(true);
      const ofLift = (id: number | undefined) => w.solids.some((x) => x.id === id && x.propUid === PIECE);
      if (ofLift(b.groundRef)) rode = true;
      if (ofLift(b.pass)) passed = true;
    });
    expect(rode).toBe(true);
    expect(passed).toBe(true);
    const b = w.runners[0].body;
    expect(b.onGround).toBe(true);
    expect(b.groundRef).toBe(TILE_SOLID_ID);
    expect(b.y + b.h).toBe(FLOOR * TILE);
    expect(b.pass).toBeUndefined();
  });

  it('a platform sweeping a runner into a placed block passes through them; into rock it still crushes', () => {
    // A one-tile platform at floor level runs right 6 tiles and back; the runner stands between it and an obstacle.
    const sweep = (x: number) => part(PIECE, -1, row(1), { type: 'rail', angle: 0, range: 6, period: 200 }, x, FLOOR - 1);
    const at = (tx: number) => (w: RunWorld) => {
      const b = w.runners[0].body;
      b.x = tx * TILE + TILE - b.w;
      b.y = FLOOR * TILE - b.h;
    };
    // Against a placed block at x=20: alive throughout, passed through, and still standing where it was.
    let passed = false;
    const x0 = 19 * TILE + TILE - 12;
    const block = part(BLOCK, 3, row(1), STILL, 20, FLOOR - 1);
    const w = run(testLevel([sweep(14)]), [block], at(19), 260, (w, f) => {
      expect(w.runners[0].alive, `frame ${f}`).toBe(true);
      if (w.runners[0].body.pass !== undefined) passed = true;
    });
    expect(passed).toBe(true);
    expect(w.runners[0].body.x).toBeCloseTo(x0 + 12 - w.runners[0].body.w, 6);
    // Against the rock wall at x=30: crushed, as ever.
    const crushed = run(testLevel([sweep(WALL - 6)]), [], at(WALL - 1), 260);
    expect(crushed.runners[0].alive).toBe(false);
    expect(crushed.runners[0].cause).toBe('crush');
  });

  it('is deterministic', () => {
    const once = () => JSON.stringify(run(testLevel([lift]), [beam], onLift, 200).runners[0].body);
    expect(once()).toBe(once());
  });
});
