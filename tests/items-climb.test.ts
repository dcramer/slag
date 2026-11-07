import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateTheme } from '../src/gen/theme';
import { MODES } from '../src/game/modes';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { CRATE_ITEMS, giveItem, type ItemKind, ITEMS, JOLT, SLICK } from '../src/sim/items';
import { SLICK_SURFACE } from '../src/sim/items/climb';
import { type Level, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { SURGE, type PlacedProp } from '../src/sim/props';
import { RACE_RUN, type Runner, RunWorld, type RunRules } from '../src/sim/run';
import type { Tide } from '../src/sim/tide';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** The climb's own items (src/sim/items/climb.ts) and its Leg Days (src/sim/props/modules/surge.ts). */

const FLOOR = 24;
/** A shelf across columns 10..20 at row 3 (stand row 2), and two ledges at row 9: solid over 9..13, boards over 20..24. */
const SHELF = 3;
const LEDGE = 9;
const STILL: Tide = { wait: 999, speed: 0, gain: 0, leash: [], squeeze: { after: 999, rate: 0, min: 0 }, rush: 0 };

function level(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = T_SOLID;
  for (let x = 10; x <= 20; x++) tiles[SHELF * LEVEL_W + x] = T_SOLID;
  for (let x = 9; x <= 13; x++) tiles[LEDGE * LEVEL_W + x] = T_SOLID;
  for (let x = 20; x <= 24; x++) tiles[LEDGE * LEVEL_W + x] = T_ONEWAY;
  // A step at row 15 (stand row 14) under the solid ledge's end, to climb from.
  for (let x = 12; x <= 16; x++) tiles[15 * LEVEL_W + x] = T_SOLID;
  // A wall standing on the floor, for wall jumps.
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 36] = T_SOLID;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 3 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
    tide: STILL,
  };
}

/** A climb past its countdown, runner i standing in cell `at[i]`, with `pieces` standing in it. */
function race(at: [number, number][], pieces: PlacedProp[] = []): RunWorld {
  const rules: RunRules = { ...RACE_RUN, ahead: 'height' };
  const run = new RunWorld(
    { ...level(), setPieces: pieces },
    [],
    at.map((_, i) => i),
    0,
    undefined,
    [],
    true,
    rules,
  );
  while (run.frame < RUN_COUNTDOWN) run.step(at.map(() => NO_INPUT));
  at.forEach(([tx, ty], i) => (run.runners[i].body = bodyAtCell(tx, ty)));
  run.step(at.map(() => NO_INPUT));
  return run;
}

const steps = (run: RunWorld, n: number, inp: InputFrame = NO_INPUT) => {
  for (let k = 0; k < n; k++) run.step(run.runners.map(() => inp));
};
const use = (run: RunWorld, who: number) => run.step(run.runners.map((_, i): InputFrame => (i === who ? { ...NO_INPUT, usePressed: true } : NO_INPUT)));
const feetRow = (r: Runner) => Math.floor((r.body.y + r.body.h - 0.01) / TILE);

describe('Slippery Slope', () => {
  it('slicks the ledges under the user, not its own floor, and dries up', () => {
    const run = race([
      [15, SHELF - 1],
      [11, LEDGE - 1],
      [30, FLOOR - 1],
    ]);
    const [a, b, far] = run.runners;
    giveItem(a, 'slick');
    use(run, 0);
    expect(a.items.held).toBeNull();
    steps(run, 2);
    expect(b.body.surface.friction).toBe(SLICK_SURFACE.friction);
    expect(a.body.surface.friction).toBe(1);
    // The floor is more than SLICK.depth rows under the shelf.
    expect(FLOOR - SHELF).toBeGreaterThan(SLICK.depth + 1);
    expect(far.body.surface.friction).toBe(1);
    steps(run, SLICK.life);
    expect(run.items.slicks).toHaveLength(0);
    expect(b.body.surface.friction).toBe(1);
  });

  it('a walker letting go on a slicked ledge skids on past where a dry one stops', () => {
    const skid = (slick: boolean) => {
      const run = race([
        [15, SHELF - 1],
        [9, LEDGE - 1],
      ]);
      if (slick) {
        giveItem(run.runners[0], 'slick');
        use(run, 0);
      }
      const b = run.runners[1];
      // Coming in at a walk, as off a landing, and letting go.
      steps(run, 2);
      b.body.vx = 106;
      steps(run, 30);
      return { x: b.body.x, onLedge: feetRow(b) === LEDGE - 1 };
    };
    const dry = skid(false);
    const wet = skid(true);
    expect(dry.onLedge).toBe(true);
    expect(wet.x - dry.x > TILE || !wet.onLedge).toBe(true);
  });
});

describe('Trickle-Down', () => {
  it('shakes everyone standing below it off what they stand on, a solid ledge or boards, credited to the user', () => {
    const run = race([
      [15, SHELF - 1],
      [11, LEDGE - 1],
      [22, LEDGE - 1],
      [30, FLOOR - 1],
    ]);
    const [a, solid, boards, deep] = run.runners;
    giveItem(a, 'jolt');
    use(run, 0);
    steps(run, JOLT.delay + Math.ceil(((LEDGE - SHELF) * TILE * 60) / JOLT.speed) + 4);
    for (const r of [solid, boards]) {
      expect(r.items.daze).toBeGreaterThan(0);
      expect(r.items.bonkedBy).toBe(0);
    }
    steps(run, 40);
    expect(feetRow(solid)).toBeGreaterThan(LEDGE - 1);
    expect(feetRow(boards)).toBeGreaterThan(LEDGE - 1);
    // Out of its reach, and the user, untouched.
    expect(FLOOR - SHELF).toBeGreaterThan(JOLT.depth / TILE);
    expect(deep.items.daze + a.items.daze).toBe(0);
    expect(run.items.jolts).toHaveLength(0);
  });

  it('misses whoever is in the air as it passes', () => {
    const run = race([
      [15, SHELF - 1],
      [11, LEDGE - 1],
    ]);
    const [a, b] = run.runners;
    giveItem(a, 'jolt');
    use(run, 0);
    // Jump just before it gets there.
    steps(run, JOLT.delay + Math.ceil(((LEDGE - SHELF) * TILE * 60) / JOLT.speed) - 6);
    b.body.vy = -300;
    b.body.onGround = false;
    steps(run, 10);
    expect(b.items.daze).toBe(0);
  });
});

describe('Social Climber', () => {
  it('reels its climber up onto a ledge overhead, beside it or through boards, and lands them there', () => {
    // Beside the solid ledge: up past its end, then over onto it.
    const run = race([[14, 14]]);
    const a = run.runners[0];
    a.body.facing = -1;
    giveItem(a, 'grapple');
    use(run, 0);
    expect(run.items.climbs).toHaveLength(1);
    expect(a.items.held?.uses).toBe(ITEMS.grapple.uses - 1);
    steps(run, 60);
    expect(run.items.climbs).toHaveLength(0);
    expect(a.body.onGround).toBe(true);
    expect(feetRow(a)).toBe(LEDGE - 1);
  });

  it('with nothing to hook it does nothing and keeps the item; a knock snaps the line', () => {
    const run = race([
      [30, FLOOR - 1],
      [22, FLOOR - 1],
    ]);
    const [a, b] = run.runners;
    giveItem(a, 'grapple');
    use(run, 0);
    expect(run.items.climbs).toHaveLength(0);
    expect(a.items.held?.uses).toBe(ITEMS.grapple.uses);

    b.body = bodyAtCell(14, 14);
    giveItem(b, 'grapple');
    use(run, 1);
    expect(run.items.climbs).toHaveLength(1);
    steps(run, 3);
    b.items.daze = 20;
    steps(run, 1);
    expect(run.items.climbs).toHaveLength(0);
    expect(b.items.reel).toBe(0);
  });
});

describe('Leg Day', () => {
  const surge = (tx: number, ty: number): PlacedProp => ({
    uid: 900,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'loop-surge',
      name: 'Leg Day',
      maker: 'the level',
      archetype: 'mystery',
      role: 'utility',
      style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
      motion: { type: 'none' },
      modules: [{ type: 'surge', cells: [[tx, ty]], refill: SURGE.refill, frames: SURGE.frames }],
      footprint: [[tx, ty]],
    },
  });
  const jumpTop = (run: RunWorld, r: Runner) => {
    const y0 = r.body.y;
    let top = y0;
    run.step(run.runners.map(() => ({ ...NO_INPUT, jump: true, jumpPressed: true })));
    for (let f = 0; f < 50; f++) {
      run.step(run.runners.map(() => ({ ...NO_INPUT, jump: true })));
      top = Math.min(top, r.body.y);
    }
    steps(run, 30);
    return (y0 - top) / TILE;
  };

  it('springs every jump higher a while once taken, and is back after it refills', () => {
    const run = race([[30, FLOOR - 1]], [surge(30, FLOOR - 1)]);
    const r = run.runners[0];
    expect(r.status.surge).toBeGreaterThan(0);
    const took = run.frame;
    const high = jumpTop(run, r);
    // Away from it while it wears off and refills.
    r.body = bodyAtCell(20, FLOOR - 1);
    steps(run, SURGE.frames);
    expect(r.status.surge).toBe(0);
    const plain = jumpTop(run, r);
    expect(high).toBeGreaterThan(plain * 1.5);
    expect(high).toBeGreaterThan(6);
    // Back once it has refilled: standing in it again takes it again.
    steps(run, Math.max(0, took + SURGE.refill - run.frame));
    r.body = bodyAtCell(30, FLOOR - 1);
    steps(run, 2);
    expect(r.status.surge).toBeGreaterThan(0);
  });

  it('springs a wall jump higher too', () => {
    const climb = (boost: boolean) => {
      const run = race([[35, FLOOR - 1]]);
      const r = run.runners[0];
      if (boost) r.status.surge = SURGE.frames;
      run.step([{ ...NO_INPUT, right: true, jump: true, jumpPressed: true }]);
      for (let f = 0; f < 14; f++) run.step([{ ...NO_INPUT, right: true, jump: true }]);
      // Off the wall.
      run.step([{ ...NO_INPUT, right: true, jump: true, jumpPressed: true }]);
      const vy = r.body.vy;
      return { vy, walls: r.body.wallJumps };
    };
    const plain = climb(false);
    const boosted = climb(true);
    expect(plain.walls).toBe(1);
    expect(boosted.walls).toBe(1);
    expect(boosted.vy).toBeLessThan(plain.vy * 1.2);
  });
});

describe('where they come from', () => {
  it('only a climb’s boxes deal them', () => {
    const deal = MODES.slag.profile.boxes!;
    for (const k of ['slick', 'jolt', 'grapple'] as const) {
      expect(CRATE_ITEMS).not.toContain(k);
      expect([...deal.chase, ...deal.lead]).toContain(k);
    }
  });

  it('two identical climbs with them in every hand end in identical state', () => {
    function chaos(): string {
      const run = race([
        [15, SHELF - 1],
        [11, LEDGE - 1],
        [22, LEDGE - 1],
        [14, FLOOR - 1],
        [30, FLOOR - 1],
      ]);
      const kinds: ItemKind[] = ['slick', 'jolt', 'grapple'];
      const rng = new Rng(4);
      for (let f = 0; f < 480; f++) {
        if (f % 50 === 0) run.runners.forEach((r, i) => r.alive && !r.items.held && giveItem(r, kinds[(i + f) % 3]));
        run.step(
          run.runners.map(() => ({
            ...NO_INPUT,
            right: rng.chance(0.5),
            left: rng.chance(0.2),
            jump: rng.chance(0.3),
            jumpPressed: rng.chance(0.05),
            usePressed: rng.chance(0.06),
          })),
        );
      }
      return JSON.stringify({ runners: run.runners, items: run.items, f: run.frame });
    }
    const a = chaos();
    expect(a).toBe(chaos());
    expect((JSON.parse(a) as { runners: Runner[] }).runners.some((r) => r.items.bonkedBy >= 0)).toBe(true);
  });
});
