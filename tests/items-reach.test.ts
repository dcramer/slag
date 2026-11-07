import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import { MODES } from '../src/game/modes';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, SHIELD_FRAMES, TILE } from '../src/sim/constants';
import { CLOCK, CRATE_ITEMS, giveItem, type ItemKind, ROD } from '../src/sim/items';
import { type Level, T_ONEWAY } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** The brawl's two reaching items (src/sim/items/clock.ts, rod.ts): the Rude Awakening and the Catch of the Day. */

const FLOOR = 20;
/** A board (one-way) across columns 14..19, its top `LEDGE` rows over the floor's. */
const LEDGE = 4;
const TOP = FLOOR - LEDGE;

/** A floor from FLOOR down, cut by a gap at columns 26..28; the board; a wall at column 34 from the floor up 4 rows. */
function level(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) if (x < 26 || x > 28) tiles[y * LEVEL_W + x] = 1;
  for (let x = 14; x <= 19; x++) tiles[TOP * LEVEL_W + x] = T_ONEWAY;
  for (let y = FLOOR - 4; y < FLOOR; y++) tiles[y * LEVEL_W + 34] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 1, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 2, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: (FLOOR - 3) * TILE, w: 3 * TILE, h: 3 * TILE }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/** A brawl past its spawn shield, runner i standing in cell `at[i]` facing `face[i]` (default right). */
function brawl(at: [number, number][], face: (1 | -1)[] = []): RunWorld {
  const run = new RunWorld(
    level(),
    [],
    at.map((_, i) => i),
    0,
    1,
    [],
    false,
    MODES.brawl.run,
  );
  while (run.frame < RUN_COUNTDOWN + SHIELD_FRAMES + 1) run.step(at.map(() => NO_INPUT));
  at.forEach(([tx, ty], i) => {
    run.runners[i].body = bodyAtCell(tx, ty);
    run.runners[i].body.facing = face[i] ?? 1;
  });
  run.step(at.map(() => NO_INPUT));
  return run;
}

const steps = (run: RunWorld, n: number, inp: (i: number) => InputFrame = () => NO_INPUT) => {
  for (let k = 0; k < n; k++) run.step(run.runners.map((_, i) => inp(i)));
};
const use = (run: RunWorld, who: number, up = false) =>
  run.step(run.runners.map((_, i): InputFrame => (i === who ? { ...NO_INPUT, usePressed: true, up } : NO_INPUT)));
const mid = (r: Runner) => r.body.x + r.body.w / 2;

describe('Rude Awakening', () => {
  it('lobbed high, it comes down on a board overhead, rings, then throws a rival there out from it and up, credited to the thrower', () => {
    // The thrower on the floor left of the board; the rival on the board, two tiles in from its left end.
    const run = brawl([
      [11, FLOOR - 1],
      [16, TOP - 1],
    ]);
    const [a, v] = run.runners;
    giveItem(a, 'clock');
    use(run, 0, true);
    expect(a.items.held).toEqual({ kind: 'clock', uses: 1 });
    expect(run.items.clocks).toHaveLength(1);
    // In the air and then ringing, it touches nobody.
    let rang = -1;
    for (let f = 0; f < 120 && run.items.clocks.length; f++) {
      const c = run.items.clocks[0];
      if (c.fuse > 0 && rang < 0) {
        rang = f;
        // It came down on the board.
        expect(c.y).toBeLessThan(TOP * TILE);
        expect(c.y).toBeGreaterThan((TOP - 1) * TILE);
      }
      expect(v.items.daze).toBe(0);
      steps(run, 1);
    }
    expect(rang).toBeGreaterThan(0);
    expect(run.items.clocks).toHaveLength(0);
    // Thrown out from where it landed (left of the rival's middle, or right) and up, seeing stars, the kill credit the thrower's.
    expect(v.items.daze).toBeGreaterThan(0);
    expect(v.items.bonkedBy).toBe(a.slot);
    expect(v.body.vy).toBeLessThan(0);
    expect(v.body.onGround).toBe(false);
    expect(v.alive).toBe(true);
  });

  it('rings at least its tell before it goes off, and throws whoever is in reach outward, the far one less', () => {
    const run = brawl([
      [4, FLOOR - 1],
      [9, FLOOR - 1],
      [12, FLOOR - 1],
    ]);
    const [, near, far] = run.runners;
    const x = mid(near) + 8;
    // Thrown long enough ago that, once down, it rings only its tell.
    run.items.clocks.push({
      id: 50,
      owner: 0,
      x,
      y: FLOOR * TILE - CLOCK.half - 0.01,
      vx: 0,
      vy: 0,
      born: run.frame - CLOCK.fuse,
      fuse: 0,
      ring: 0,
      onGround: false,
    });
    steps(run, CLOCK.ring - 1);
    expect(run.items.clocks).toHaveLength(1);
    expect(near.items.daze + far.items.daze).toBe(0);
    steps(run, 2);
    expect(run.items.clocks).toHaveLength(0);
    // Each thrown away from the clock: the near one left, the far one right and less hard.
    expect(near.body.vx).toBeLessThan(0);
    expect(far.body.vx).toBeGreaterThan(0);
    expect(Math.abs(far.body.vx)).toBeLessThan(Math.abs(near.body.vx));
  });

  it('spares its thrower, and rock between it and a rival shields them', () => {
    const run = brawl([
      [31, FLOOR - 1],
      [36, FLOOR - 1],
    ]);
    const [a, v] = run.runners;
    // Against the wall's left face at column 34, the rival right of it, a tile and a half from the clock; the thrower beside it.
    run.items.clocks.push({
      id: 51,
      owner: a.slot,
      x: 33 * TILE + 8,
      y: FLOOR * TILE - CLOCK.half - 0.01,
      vx: 0,
      vy: 0,
      born: run.frame,
      fuse: 0,
      ring: 0,
      onGround: false,
    });
    steps(run, CLOCK.fuse + 2);
    expect(run.items.clocks).toHaveLength(0);
    expect(a.items.daze).toBe(0);
    expect(a.body.onGround).toBe(true);
    expect(v.items.daze).toBe(0);
  });
});

describe('Catch of the Day', () => {
  it('casts straight across, snags the rival it reaches and yanks them toward the caster; the caster stands rooted while it pays out', () => {
    const run = brawl([
      [5, FLOOR - 1],
      [12, FLOOR - 1],
    ]);
    const [a, v] = run.runners;
    giveItem(a, 'rod');
    const ax = a.body.x;
    use(run, 0);
    expect(run.items.lines).toHaveLength(1);
    expect(a.items.cast).toBeGreaterThan(0);
    // Holding right does nothing while the line goes out.
    for (let f = 0; f < 30 && v.items.daze === 0; f++) steps(run, 1, (i) => (i === 0 ? { ...NO_INPUT, right: true, run: true } : NO_INPUT));
    expect(a.body.x).toBeCloseTo(ax, 5);
    expect(v.items.daze).toBeGreaterThan(0);
    expect(v.items.bonkedBy).toBe(a.slot);
    expect(v.body.vx).toBeLessThan(0);
    expect(a.items.cast).toBe(0);
    const vx = v.body.x;
    steps(run, 60);
    expect(v.body.x).toBeLessThan(vx - 2 * TILE);
    expect(v.body.x).toBeGreaterThan(a.body.x);
    expect(v.alive).toBe(true);
    // The line reels home, and a use is spent.
    expect(run.items.lines).toHaveLength(0);
    expect(a.items.held).toEqual({ kind: 'rod', uses: 1 });
  });

  it('the float rides on whoever it snagged till they come down, then reels home', () => {
    const run = brawl([
      [5, FLOOR - 1],
      [12, FLOOR - 1],
    ]);
    const [a, v] = run.runners;
    giveItem(a, 'rod');
    use(run, 0);
    for (let f = 0; f < 30 && v.items.daze === 0; f++) steps(run, 1);
    const l = run.items.lines[0];
    expect(l.hooked).toBe(1);
    steps(run, 3);
    expect(l.x).toBeCloseTo(mid(v), 5);
    for (let f = 0; f < ROD.hook && l.hooked >= 0; f++) {
      expect(l.x).toBeCloseTo(mid(v), 5);
      steps(run, 1);
    }
    expect(l.hooked).toBe(-1);
    expect(v.body.onGround).toBe(true);
    steps(run, 30);
    expect(run.items.lines).toHaveLength(0);
  });

  it('pulls someone standing across a gap off their ledge into it', () => {
    const run = brawl(
      [
        [32, FLOOR - 1],
        [24, FLOOR - 1],
      ],
      [-1, 1],
    );
    const [a, v] = run.runners;
    giveItem(a, 'rod');
    use(run, 0);
    steps(run, 120);
    expect(v.alive).toBe(false);
    expect(a.alive).toBe(true);
  });

  it('slanting up with up held, reaches someone on a board overhead, through it', () => {
    const run = brawl([
      [11, FLOOR - 1],
      [14, TOP - 1],
    ]);
    const [a, v] = run.runners;
    giveItem(a, 'rod');
    use(run, 0, true);
    for (let f = 0; f < 30 && v.items.daze === 0; f++) steps(run, 1);
    expect(v.items.daze).toBeGreaterThan(0);
    expect(v.body.vx).toBeLessThan(0);
  });

  it('stops at rock and comes back empty, and runs out of line past its reach', () => {
    const walled = brawl([
      [31, FLOOR - 1],
      [36, FLOOR - 1],
    ]);
    giveItem(walled.runners[0], 'rod');
    use(walled, 0);
    steps(walled, 40);
    expect(walled.runners[1].items.daze).toBe(0);
    expect(walled.items.lines).toHaveLength(0);
    expect(walled.runners[0].items.cast).toBe(0);
    const far = brawl([
      [3, FLOOR - 1],
      [3 + ROD.range / TILE + 2, FLOOR - 1],
    ]);
    giveItem(far.runners[0], 'rod');
    use(far, 0);
    steps(far, 60);
    expect(far.runners[1].items.daze).toBe(0);
  });

  it('a bonk on the caster snaps the line', () => {
    const run = brawl([
      [5, FLOOR - 1],
      [16, FLOOR - 1],
      [4, FLOOR - 1],
    ]);
    const [a, , c] = run.runners;
    giveItem(a, 'rod');
    giveItem(c, 'sword');
    use(run, 0);
    use(run, 2);
    for (let f = 0; f < 16 && a.items.daze === 0; f++) steps(run, 1);
    expect(a.items.daze).toBeGreaterThan(0);
    steps(run, 1);
    expect(run.items.lines).toHaveLength(0);
    expect(a.items.cast).toBe(0);
    expect(run.runners[1].items.daze).toBe(0);
  });
});

describe('who deals them', () => {
  it("only a brawl's boxes: a race's and a climb's crates never hold them", () => {
    const reach: ItemKind[] = ['clock', 'rod'];
    for (const k of reach) {
      expect(CRATE_ITEMS).not.toContain(k);
      expect(MODES.brawl.profile.boxes?.lead).toContain(k);
      expect(MODES.slag.profile.boxes?.lead ?? []).not.toContain(k);
      expect(MODES.slag.profile.boxes?.chase ?? []).not.toContain(k);
    }
  });
});
