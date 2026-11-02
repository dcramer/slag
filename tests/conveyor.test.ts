import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { generateProp } from '../src/gen/props';
import { PHYS, TILE } from '../src/sim/constants';
import { T_SOLID } from '../src/sim/level';
import { type Body, bodyAtCell, type CollisionWorld, type Controls, createBody, DEFAULT_SURFACE, type Solid, type Surface, stepBody } from '../src/sim/physics';
import { conveyorSurface } from '../src/sim/props/modules/body';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/**
 * A conveyor's belt is on whichever face its rotation turned the top to, running the same way round the
 * block: a top carries walkers, a side drags a runner clinging to it (an escalator when it runs up), a
 * bottom flings a head that bonks it sideways. Any other face is plain.
 */

const idle: Controls = { left: false, right: false, down: false, jump: false, jumpPressed: false };
const ctl = (o: Partial<Controls>): Controls => ({ ...idle, ...o });

/** An open room `w` wide with a floor from row `floor` down, walls outside x, and these solids. */
function room(w: number, floor: number, solids: Solid[]): CollisionWorld {
  return { tileAt: (x, y) => (x < 0 || x >= w || y >= floor ? T_SOLID : 0), solids };
}

/** Solid cells (tile coords) all carrying `surface`. */
function cells(list: [number, number][], surface: Surface): Solid[] {
  return list.map(([x, y], i) => ({ x: x * TILE, y: y * TILE, w: TILE, h: TILE, id: 100 + i, dx: 0, dy: 0, surface, propUid: 7, mi: 0 }));
}

const column = (x: number, y0: number, y1: number): [number, number][] => Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i]);

const SPEED = 90;

describe('conveyor faces in the controller', () => {
  it('a top belt carries a walker; a belt on any other face leaves the top plain', () => {
    for (const face of [0, 1, 2, 3]) {
      const world = room(
        20,
        12,
        cells(
          [
            [5, 11],
            [6, 11],
            [7, 11],
            [8, 11],
            [9, 11],
            [10, 11],
            [11, 11],
            [12, 11],
          ].map(([x]) => [x, 10]),
          conveyorSurface(SPEED, face),
        ),
      );
      const b = bodyAtCell(8, 9);
      b.onGround = false;
      for (let f = 0; f < 5; f++) stepBody(b, idle, world);
      const x0 = b.x;
      for (let f = 0; f < 30; f++) stepBody(b, idle, world);
      expect(b.onGround).toBe(true);
      expect(b.x - x0).toBeCloseTo(face === 0 ? (SPEED * 30) / 60 : 0, 0);
    }
  });

  /** Jump at a 6-tall column from the floor beside it, holding into it, for `frames`: the body, and whether it ever stood on the column's top. */
  function climb(surface: Surface, frames: number): { b: Body; topped: boolean } {
    const world = room(12, 12, cells(column(6, 6, 11), surface));
    const b = bodyAtCell(5, 11);
    let topped = false;
    for (let f = 0; f < frames; f++) {
      stepBody(b, ctl({ right: true, jump: f < 20, jumpPressed: f === 0 }), world);
      if (b.onGround && b.y + b.h === 6 * TILE) topped = true;
    }
    return { b, topped };
  }

  it('a belt running up a wall is an escalator: it carries a clinging runner up and onto its top', () => {
    // Left face (3), positive speed: up. The runner clings from the left.
    expect(climb(conveyorSurface(SPEED, 3), 30).b.vy).toBeCloseTo(-SPEED, 5);
    expect(climb(conveyorSurface(SPEED, 3), 120).topped).toBe(true);
    // The same wall with no belt, the belt on another face, or the belt running down can't be climbed by holding into it.
    for (const s of [DEFAULT_SURFACE, conveyorSurface(SPEED, 1), conveyorSurface(-SPEED, 3)]) expect(climb(s, 180).topped).toBe(false);
  });

  it('a belt running down a wall drags a clinging runner down at its own speed', () => {
    // Right face (1), positive speed: down. The runner clings from the right, starting in the air.
    const world = room(12, 12, cells(column(4, 2, 11), conveyorSurface(SPEED, 1)));
    const b = createBody(5 * TILE, 3 * TILE);
    for (let f = 0; f < 40; f++) stepBody(b, ctl({ left: true }), world);
    expect(b.wallDir).toBe(-1);
    expect(b.vy).toBeCloseTo(SPEED, 5);
  });

  it('wall jumps off a belt still work, and one running up adds its lift', () => {
    const world = room(12, 12, cells(column(6, 2, 11), conveyorSurface(SPEED, 3)));
    const b = createBody(6 * TILE - 10, 6 * TILE);
    for (let f = 0; f < 20; f++) stepBody(b, ctl({ right: true }), world);
    expect(b.vy).toBeCloseTo(-SPEED, 5);
    stepBody(b, ctl({ left: true, jump: true, jumpPressed: true }), world);
    expect(b.wallJumps).toBe(1);
    expect(b.vx).toBeLessThan(0);
    // One frame of gravity after the kick.
    expect(b.vy).toBeLessThan(-PHYS.wallJumpVy - SPEED + PHYS.gravity / 60 + 1);
  });

  it('a head that bonks a belt from below is flung along it', () => {
    for (const [surface, want] of [
      [conveyorSurface(SPEED, 2), -SPEED * PHYS.beltShoveMult],
      [conveyorSurface(-SPEED, 2), SPEED * PHYS.beltShoveMult],
      [conveyorSurface(SPEED, 0), 0],
      [DEFAULT_SURFACE, 0],
    ] as const) {
      const world = room(
        14,
        12,
        cells(
          [
            [4, 9],
            [5, 9],
            [6, 9],
            [7, 9],
            [8, 9],
          ],
          surface,
        ),
      );
      const b = bodyAtCell(6, 11);
      let bonked = false;
      for (let f = 0; f < 30 && !bonked; f++) {
        const vy = b.vy;
        stepBody(b, ctl({ jump: true, jumpPressed: f === 0 }), world);
        bonked = f > 0 && vy < 0 && b.vy === 0 && !b.onGround;
      }
      expect(bonked).toBe(true);
      expect(b.vx).toBeCloseTo(want, 5);
    }
  });
});

describe('a placed conveyor', () => {
  // A straight three-cell conveyor: the first platform roll that comes out one, so a new platform shape
  // (or anything else that shifts the platform stream) can't take it away.
  const def = (() => {
    for (let k = 1; ; k++) {
      const d = generateProp(new Rng(k * 977), 'platform', 'belt');
      const m = d.modules[0];
      if (
        d.modules.length === 1 &&
        d.motion.type === 'none' &&
        m.type === 'body' &&
        m.material === 'conveyor' &&
        m.cells.length === 3 &&
        new Set(m.cells.map((c) => c[1])).size === 1
      )
        return d;
    }
  })();
  const belt = def.modules.find((m) => m.type === 'body');
  const base = generateLevel(5, undefined, { size: 'classic', gravity: 1 });

  it('is a conveyor', () => {
    expect(belt?.type === 'body' && belt.material).toBe('conveyor');
  });

  it('puts its belt on the face its rotation turned the top to, running the same way round the block', () => {
    const speed = belt?.type === 'body' ? belt.conveyor : 0;
    for (const rot of [0, 1, 2, 3]) {
      const level = { ...base, tiles: new Uint8Array(base.w * base.h) };
      const run = new RunWorld(level, [{ uid: 1, def, owner: 0, tx: 20, ty: 10, rot }], [0]);
      run.step([NO_INPUT]);
      const mine = run.solids.filter((s) => s.propUid === 1);
      expect(mine.length).toBe(3);
      // A straight run turned upright for odd turns.
      const xs = new Set(mine.map((s) => s.x));
      expect(xs.size).toBe(rot % 2 ? 1 : 3);
      for (const s of mine) {
        expect(s.surface.beltFace).toBe(rot);
        expect(s.surface.conveyor).toBe(speed);
      }
    }
  });

  it('runs the same twice: a rotated belt is deterministic', () => {
    const trace = () => {
      const level = { ...base, tiles: new Uint8Array(base.w * base.h) };
      for (let x = 0; x < level.w; x++) level.tiles[(level.h - 2) * level.w + x] = T_SOLID;
      const run = new RunWorld({ ...level, protectedRects: [] }, [{ uid: 1, def, owner: 0, tx: 8, ty: level.h - 5, rot: 3 }], [0, 1]);
      const out: number[] = [];
      for (let f = 0; f < 240; f++) {
        const hold = { ...NO_INPUT, right: f % 50 < 30, jump: f % 40 < 15, jumpPressed: f % 40 === 0 };
        run.step([hold, { ...NO_INPUT, left: f % 70 < 40 }]);
        for (const r of run.runners) out.push(r.body.x, r.body.y, r.body.vx, r.body.vy);
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});
