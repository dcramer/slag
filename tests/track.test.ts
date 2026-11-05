import { describe, expect, it } from 'vitest';
import type { Vec } from '../src/core/geom';
import { carrierReach, MIN_DWELL, rideProof, rideSpans } from '../src/gen/level/ride';
import { setProbeGravity } from '../src/gen/level/probe';
import { cycleFrames } from '../src/sim/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { isStandable } from '../src/sim/reach';
import type { Level } from '../src/sim/level';
import { firstOverlap, TILE_SOLID_ID } from '../src/sim/physics';
import { type Module, type Motion, motionOffset, type PlacedProp, type PropDef, resolveProp, solidId } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * Whole-prop motion for stage concepts (docs/SETPIECES.md, Track and Lift):
 * a body that follows a polyline at constant speed, and a rail that parks at
 * each end. Checked on the offsets alone, then in the real sim with riders,
 * then against the carrier ride proof.
 */

const FLOOR = LEVEL_H - 6;

/** A flat floor from FLOOR down, open sky above; `chasm` cuts [x0, x1] out of it. */
function level(chasm?: [number, number]): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) if (!chasm || x < chasm[0] || x > chasm[1]) tiles[y * LEVEL_W + x] = 1;
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

/** A flat metal platform `w` cells wide at (tx, ty), moving by `motion`. */
function platform(tx: number, ty: number, w: number, motion: Motion, uid = 100_000, owner = -1): PlacedProp {
  const mod: Module = {
    type: 'body',
    cells: Array.from({ length: w }, (_, i) => [i, 0] as [number, number]),
    material: 'metal',
    conveyor: 0,
    breakFrames: 0,
    respawnFrames: 0,
  };
  const def: PropDef = {
    key: 'lift',
    name: 'lift',
    maker: 'test',
    archetype: 'platform',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion,
    modules: [mod],
    footprint: mod.cells,
  };
  return { uid, def, owner, tx, ty, rot: 0 };
}

/** Motion offset in tiles, with the per-prop phase zeroed so frame 0 is the start of a lap. */
function offsetAt(motion: Motion, f: number, rot = 0): Vec {
  const r = resolveProp({ ...platform(10, 10, 1, motion), rot });
  r.phase = 0;
  const [x, y] = motionOffset(r, f);
  return [x / TILE, y / TILE];
}

const near = (a: Vec, b: Vec) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

/** Stand runner `r` still on cell (tx, ty), riding solid `ref`. */
function standOn(r: Runner, tx: number, ty: number, ref: number) {
  const b = r.body;
  b.x = tx * TILE + (TILE - b.w) / 2;
  b.y = (ty + 1) * TILE - b.h;
  b.vx = b.vy = 0;
  b.onGround = true;
  b.groundRef = ref;
}

function race(lv: Level, placed: PlacedProp[], n = 1): RunWorld {
  const run = new RunWorld(
    lv,
    placed,
    Array.from({ length: n }, (_, i) => i),
  );
  while (run.frame < RUN_COUNTDOWN) run.step(run.runners.map(() => NO_INPUT));
  return run;
}

/** Nobody alive stands inside terrain or a solid. */
function clear(run: RunWorld, lv: Level, f: number) {
  const world = { tileAt: (x: number, y: number) => (x < 0 || y < 0 || x >= lv.w || y >= lv.h ? 0 : lv.tiles[y * lv.w + x]), solids: run.solids };
  for (const r of run.runners) if (r.alive) expect(firstOverlap(r.body, world), `frame ${f}`).toBeNull();
}

describe('track motion', () => {
  // An L: 4 right, then 3 up. 7 tiles out, 14 a lap when it comes back.
  const L: Vec[] = [
    [0, 0],
    [4, 0],
    [4, -3],
  ];
  // A 3×3 square, 12 tiles round.
  const SQ: Vec[] = [
    [0, 0],
    [3, 0],
    [3, 3],
    [0, 3],
  ];

  it('follows the polyline at constant speed, turning corners where they are', () => {
    const P = 280;
    const open: Motion = { type: 'track', pts: L, period: P, closed: false };
    near(offsetAt(open, 0), [0, 0]);
    near(offsetAt(open, P / 7), [2, 0]); // 2 of 14 tiles
    near(offsetAt(open, (P * 2) / 7), [4, 0]); // the corner
    near(offsetAt(open, (P * 3) / 7), [4, -2]);
    near(offsetAt(open, P / 2), [4, -3]); // the far end
    // Every frame covers the same ground, except where it cuts a corner or turns round.
    const speed = (14 * TILE) / P;
    for (let f = 0; f < P; f++) {
      const [ax, ay] = offsetAt(open, f);
      const [bx, by] = offsetAt(open, f + 1);
      const step = Math.hypot(bx - ax, by - ay) * TILE;
      expect(step).toBeLessThanOrEqual(speed + 1e-9);
      if (![P * (2 / 7), P / 2, P * (5 / 7)].some((c) => f < c && f + 1 > c)) expect(step).toBeCloseTo(speed, 9);
    }
    // A lap later it's back where it started.
    near(offsetAt(open, P), [0, 0]);
    near(offsetAt(open, P + P / 7), [2, 0]);
  });

  it('a closed track goes round one way; an open one comes back the way it went', () => {
    const P = 240;
    const closed: Motion = { type: 'track', pts: SQ, period: P, closed: true };
    const open: Motion = { ...closed, closed: false };
    // Halfway: round the loop it's at the opposite corner; out and back it's at the far end.
    near(offsetAt(closed, P / 2), [3, 3]);
    near(offsetAt(open, P / 2), [0, 3]);
    // Seven eighths: the loop comes home up its closing side; the open track is still on its way back.
    near(offsetAt(closed, (P * 7) / 8), [0, 1.5]);
    near(offsetAt(open, (P * 7) / 8), [2.25, 0]);
    // The open track never uses the closing side.
    for (let f = 0; f < P; f++) {
      const [x, y] = offsetAt(open, f);
      if (x < 1e-9) expect(y === 0 || y > 3 - 1e-9).toBe(true);
    }
  });

  it('turns with the prop', () => {
    const m: Motion = { type: 'track', pts: L, period: 280, closed: false };
    // A quarter turn clockwise: right becomes down.
    near(offsetAt(m, 280 / 7, 1), [0, 2]);
  });

  it('degenerate tracks hold still instead of throwing', () => {
    near(offsetAt({ type: 'track', pts: [], period: 100, closed: true }, 37), [0, 0]);
    near(offsetAt({ type: 'track', pts: [[2, 1]], period: 100, closed: false }, 37), [2, 1]);
    near(
      offsetAt(
        {
          type: 'track',
          pts: [
            [1, 1],
            [1, 1],
          ],
          period: 100,
          closed: true,
        },
        37,
      ),
      [1, 1],
    );
  });
});

describe('rail dwell', () => {
  it('parks at each end for its dwell, and a cycle is the period plus both stops', () => {
    const period = 120;
    const dwell = 45;
    const m: Motion = { type: 'rail', angle: -Math.PI / 2, range: 5, period, dwell };
    const T = period + 2 * dwell;
    expect(cycleFrames([], m)).toBe(T);
    let bottom = 0;
    let top = 0;
    for (let f = 0; f < T; f++) {
      const [x, y] = offsetAt(m, f);
      expect(x).toBe(0);
      expect(y).toBeLessThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(-5);
      if (y === 0) bottom++;
      if (y === -5) top++;
      near(offsetAt(m, f + T), [x, y]);
    }
    // The stop, plus the frame it sets off on (still at the end).
    expect(bottom).toBe(dwell + 1);
    expect(top).toBe(dwell + 1);
    // The stops are one stretch each, at the ends, in order.
    for (let f = 0; f < dwell; f++) near(offsetAt(m, f), [0, 0]);
    for (let f = dwell + period / 2; f < 2 * dwell + period / 2; f++) expect(offsetAt(m, f)[1]).toBe(-5);
  });

  it('a rail without dwell moves exactly as before', () => {
    const m: Motion = { type: 'rail', angle: 0, range: 4, period: 200 };
    const r = resolveProp(platform(10, 10, 1, m, 77));
    for (let f = 0; f < 200; f += 7) {
      const d = ((1 - Math.cos((f / 200 + r.phase) * Math.PI * 2)) / 2) * 4 * TILE;
      expect(motionOffset(r, f)[0]).toBeCloseTo(d, 9);
    }
  });
});

describe('riding a track', () => {
  // A 3-cell platform round a 6×4 loop in open air: right, up, left, down.
  const LOOP: Motion = {
    type: 'track',
    pts: [
      [0, 0],
      [6, 0],
      [6, -4],
      [0, -4],
    ],
    period: 400,
    closed: true,
  };
  const TX = 14;
  const TY = FLOOR - 4;

  it('carries a rider standing still all the way round, without pinning them', () => {
    const lv = level();
    const pp = platform(TX, TY, 3, LOOP);
    const run = race(lv, [pp]);
    const mid = solidId(pp.uid, 0, 1);
    const at = () => run.solids.find((s) => s.id === mid)!;
    const r = run.runners[0];
    standOn(r, 0, TY - 1, mid);
    r.body.x = at().x + (TILE - r.body.w) / 2;
    r.body.y = at().y - r.body.h;
    const rel = r.body.x - at().x;
    let lo = Infinity;
    let hi = -Infinity;
    for (let f = 0; f < 400; f++) {
      run.step([NO_INPUT]);
      clear(run, lv, f);
      expect(r.alive).toBe(true);
      expect(r.body.groundRef, `frame ${f}`).toBe(mid);
      expect(r.body.y + r.body.h).toBeCloseTo(at().y, 6);
      expect(r.body.x - at().x).toBeCloseTo(rel, 6);
      lo = Math.min(lo, at().y);
      hi = Math.max(hi, at().y);
    }
    // It really went round: four tiles up and back down.
    expect(hi - lo).toBeCloseTo(4 * TILE, 6);
  });

  it('shoves someone standing in its way along the ground instead of crushing them', () => {
    const lv = level();
    // Floor level, sliding 8 right and back.
    const pp = platform(10, FLOOR - 1, 2, {
      type: 'track',
      pts: [
        [0, 0],
        [8, 0],
      ],
      period: 300,
      closed: false,
    });
    const run = race(lv, [pp]);
    const b = run.runners[0].body;
    standOn(run.runners[0], 15, FLOOR - 1, TILE_SOLID_ID);
    const x0 = b.x;
    for (let f = 0; f < 600; f++) {
      run.step([NO_INPUT]);
      clear(run, lv, f);
    }
    expect(run.runners[0].alive).toBe(true);
    // Pushed along ahead of it (which way depends on where it was in its lap), and left standing.
    expect(Math.abs(b.x - x0)).toBeGreaterThan(3 * TILE);
    expect(b.onGround).toBe(true);
  });

  it('pressing someone into terrain crushes them, as any moving solid does, and the owner gets the credit', () => {
    const lv = level();
    // Comes down three rows onto the floor where the runner stands.
    const pp = platform(
      15,
      FLOOR - 4,
      1,
      {
        type: 'track',
        pts: [
          [0, 0],
          [0, 3],
        ],
        period: 120,
        closed: false,
      },
      100_000,
      3,
    );
    const run = race(lv, [pp]);
    standOn(run.runners[0], 15, FLOOR - 1, TILE_SOLID_ID);
    for (let f = 0; f < 240 && run.runners[0].alive; f++) run.step([NO_INPUT]);
    expect([run.runners[0].alive, run.runners[0].cause, run.runners[0].killer]).toEqual([false, 'crush', 3]);
  });

  it('replays identically: two runs with the same inputs match frame for frame', () => {
    const replay = () => {
      const lv = level();
      const run = race(
        lv,
        [platform(TX, TY, 3, LOOP), platform(30, FLOOR - 1, 3, { type: 'rail', angle: -Math.PI / 2, range: 5, period: 160, dwell: 60 }, 100_001)],
        2,
      );
      const trace: string[] = [];
      for (let f = 0; f < 600; f++) {
        // Walk right and hop now and then: onto the loop, across, onto the lift.
        const hop = f % 50 === 10;
        const inp: InputFrame = { ...NO_INPUT, right: f % 160 < 120, jump: hop || f % 50 === 11, jumpPressed: hop };
        run.step([inp, { ...inp, left: !inp.right, right: false }]);
        trace.push(JSON.stringify([run.runners.map((r) => [r.body.x, r.body.y, r.body.groundRef, r.alive]), run.solids.map((s) => [s.id, s.x, s.y])]));
      }
      return trace;
    };
    const a = replay();
    const b = replay();
    for (let f = 0; f < a.length; f++) expect(b[f], `frame ${f}`).toBe(a[f]);
  });
});

describe('a rail lift with dwell is a carrier', () => {
  setProbeGravity(1);
  const NEAR = 12; // last column of the near bank
  const FAR = 37; // first column of the far bank
  const DECK = 3;

  /** The deck flush with the bank floor, parked against each bank in turn. */
  const ferry = (dwell?: number) =>
    platform(NEAR + 1, FLOOR, DECK, { type: 'rail', angle: 0, range: FAR - NEAR - 1 - DECK, period: 300, ...(dwell ? { dwell } : {}) });
  const banks = () => level([NEAR + 1, FAR - 1]);

  it('is proven both ways across a chasm no two parts close, and reach walks it', () => {
    const lv = banks();
    expect(FAR - NEAR - 1).toBeGreaterThanOrEqual(carrierReach().cols);
    expect(analyzeReach(lv).goalReached).toBe(false);
    const rides = rideProof(lv, ferry(90));
    const across = rides.filter((r) => r.board % lv.w === NEAR && r.alight % lv.w === FAR);
    const back = rides.filter((r) => r.board % lv.w === FAR && r.alight % lv.w === NEAR);
    expect(across.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);
    for (const r of rides) expect(rideSpans(lv.w, r)).toBe(true);
    lv.rides = rides;
    expect(analyzeReach(lv).goalReached).toBe(true);
  });

  it('without a long enough stop it proves nothing', () => {
    expect(rideProof(banks(), ferry())).toEqual([]);
    expect(rideProof(banks(), ferry(MIN_DWELL - 5))).toEqual([]);
  });

  it('a runner standing still on it in the sim is carried to the proven cell', () => {
    const lv = banks();
    const pp = ferry(90);
    const ride = rideProof(lv, pp).find((r) => r.board % lv.w === NEAR && r.alight % lv.w === FAR)!;
    expect(isStandable(lv, NEAR, FLOOR - 1)).toBe(true);
    lv.setPieces = [pp];
    const run = new RunWorld(lv, [], [0]);
    const mid = solidId(pp.uid, 0, 1);
    const at = () => run.solids.find((s) => s.id === mid)!;
    // Wait for it to park at the near bank, then stand still on its middle cell.
    while (run.frame < RUN_COUNTDOWN + 2 || at().x !== (NEAR + 2) * TILE || at().dx !== 0) run.step([NO_INPUT]);
    standOn(run.runners[0], NEAR + 2, FLOOR - 1, mid);
    let moved = false;
    for (let f = 0; f < 2000 && !(moved && at().dx === 0); f++) {
      run.step([NO_INPUT]);
      moved ||= at().dx !== 0;
    }
    const b = run.runners[0].body;
    expect(run.runners[0].alive).toBe(true);
    expect(at().x).toBe((FAR - 2) * TILE);
    // On the deck's middle cell, one walk across the deck from where the proof alights.
    expect(Math.floor((b.x + b.w / 2) / TILE)).toBe(FAR - 2);
    expect(Math.floor((b.y + b.h - 1) / TILE)).toBe(FLOOR - 1);
    expect(ride.alight).toBe((FLOOR - 1) * lv.w + FAR);
  });
});
