import { describe, expect, it } from 'vitest';
import { overlaps } from '../src/core/geom';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { goalRect, type Level } from '../src/sim/level';
import { bodyAtCell, jumpMetrics } from '../src/sim/physics';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row
const GOAL_X = 40;

function flatLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: GOAL_X, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

function started(level: Level): RunWorld {
  const run = new RunWorld(level, [], [0]);
  while (run.frame < RUN_COUNTDOWN) run.step([NO_INPUT]);
  return run;
}

describe('goal trigger', () => {
  it('reaches above a full-height jump from the flag floor', () => {
    const g = goalRect(flatLevel());
    const apexFeet = FLOOR * TILE - jumpMetrics().jumpHeight * TILE;
    expect(g.y).toBeLessThan(apexFeet);
    expect(g.y + g.h).toBe(FLOOR * TILE);
    expect(g.w).toBeGreaterThan(TILE);
  });

  it('jumping clear over the flag at max height still finishes', () => {
    const level = flatLevel();
    const run = started(level);
    // A running jump launched so its apex lands right over the flag.
    const b = (run.runners[0].body = bodyAtCell(GOAL_X - 5, FLOOR - 1));
    b.vx = PHYS.runSpeed;
    // The old flag box (cell + 1 tile up): the jump never touches it before finishing.
    const flagBox = { x: GOAL_X * TILE - 2, y: (FLOOR - 2) * TILE, w: TILE + 4, h: 2 * TILE };
    let touchedFlag = false;
    for (let f = 0; f < 120 && !run.runners[0].finished; f++) {
      run.step([{ ...NO_INPUT, right: true, run: true, jump: true, jumpPressed: f === 0 }]);
      if (overlaps(b, flagBox)) touchedFlag = true;
    }
    expect(run.runners[0].finished).toBe(true);
    expect(touchedFlag).toBe(false);
    // Finished near the apex of a full jump (~3.7 tiles), well clear of the old 2-tile flag box.
    expect((FLOOR * TILE - (b.y + b.h)) / TILE).toBeGreaterThan(jumpMetrics().jumpHeight - 0.5);
    expect(run.finishOrder).toEqual([0]);
  });
});

describe('finished runners', () => {
  it('lose control but fall and land with normal physics', () => {
    const level = flatLevel();
    const run = started(level);
    // Drop in from high above the flag, inside the trigger column.
    const b = (run.runners[0].body = bodyAtCell(GOAL_X, FLOOR - 4));
    b.onGround = false;
    b.groundRef = -1;
    const mash: InputFrame = { ...NO_INPUT, right: true, run: true, jump: true, jumpPressed: true };
    run.step([mash]);
    expect(run.runners[0].finished).toBe(true);
    expect(run.active.length).toBe(0);
    const x0 = b.x;
    for (let f = 0; f < 120; f++) run.step([{ ...mash, jumpPressed: f % 2 === 0, left: f % 3 === 0 }]);
    expect(b.onGround).toBe(true);
    expect(b.y + b.h).toBeCloseTo(FLOOR * TILE, 6);
    expect(Math.abs(b.x - x0)).toBeLessThan(1); // input ignored: no running, no jumping
    expect(run.runners[0].alive).toBe(true);
    expect(run.finishOrder).toEqual([0]);
  });

  it('keep their momentum when they finish mid-jump', () => {
    const level = flatLevel();
    const run = started(level);
    const b = (run.runners[0].body = bodyAtCell(GOAL_X - 5, FLOOR - 1));
    b.vx = PHYS.runSpeed;
    let f = 0;
    for (; f < 120 && !run.runners[0].finished; f++) run.step([{ ...NO_INPUT, right: true, run: true, jump: true, jumpPressed: f === 0 }]);
    const xFinish = b.x;
    for (let i = 0; i < 120; i++) run.step([NO_INPUT]);
    expect(b.onGround).toBe(true);
    expect(b.x).toBeGreaterThan(xFinish + TILE); // carried on by momentum, then landed
    expect(run.runners[0].finished).toBe(true);
  });
});
