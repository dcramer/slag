import { describe, expect, it } from 'vitest';
import { carrierReach, MIN_DWELL, rideProof, rideSpans } from '../src/gen/level/ride';
import { setProbeGravity } from '../src/gen/level/probe';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { type Module, type PlacedProp, type PropDef, solidId } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/**
 * The carrier ride proof (gen/level/ride.ts) on a toy ferry: two banks, a
 * chasm wider than any two parts close, and a flat ferry parked flush with
 * each bank in turn. The proof's answer is checked against the real sim.
 */

const FLOOR = LEVEL_H - 6;
const NEAR = 12; // last column of the near bank
const FAR = 37; // first column of the far bank
const FERRY_W = 3;

function banks(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) if (x <= NEAR || x >= FAR) tiles[y * LEVEL_W + x] = 1;
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

function ferry(o: Partial<Extract<Module, { type: 'vehicle' }>> = {}): PlacedProp {
  const mod: Module = {
    type: 'vehicle',
    look: 'minecart',
    // Top flush with the bank floor: its bottom-left is one row under the floor's top.
    at: [NEAR + 1, FLOOR + 1],
    cols: Array.from({ length: FERRY_W }, () => 1),
    colW: 1,
    span: FAR - NEAR - 1 - FERRY_W,
    speed: 4,
    pause: 90,
    hurt: 'none',
    flip: false,
    seed: 1,
    ...o,
  };
  const def: PropDef = {
    key: 'ferry',
    name: 'ferry',
    maker: 'test',
    archetype: 'platform',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: [mod],
    footprint: [[0, 0]],
  };
  return { uid: 100_000, def, owner: -1, tx: 0, ty: 0, rot: 0 };
}

describe('carrier ride proof', () => {
  setProbeGravity(1);

  it('the toy chasm is a carrier gap: wider than any two parts close', () => {
    expect(FAR - NEAR - 1).toBeGreaterThanOrEqual(carrierReach().cols);
    expect(analyzeReach(banks()).goalReached).toBe(false);
  });

  it('proves a ferry parked flush with both banks, both ways, and reach walks it', () => {
    const level = banks();
    const pp = ferry();
    const rides = rideProof(level, pp);
    const w = level.w;
    const across = rides.filter((r) => r.board % w === NEAR && r.alight % w === FAR);
    const back = rides.filter((r) => r.board % w === FAR && r.alight % w === NEAR);
    expect(across.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);
    for (const r of rides) expect(rideSpans(w, r)).toBe(true);
    level.rides = rides;
    expect(analyzeReach(level).goalReached).toBe(true);
    // Something in the rider's path closes the ride.
    const blocked = { ...level, tiles: level.tiles.slice() };
    blocked.tiles[across[0].path[Math.floor(across[0].path.length / 2)]] = 1;
    expect(analyzeReach(blocked).goalReached).toBe(false);
  });

  it('a carrier that hurts, never parks, or parks out of line proves nothing', () => {
    expect(rideProof(banks(), ferry({ hurt: 'lead' }))).toEqual([]);
    expect(rideProof(banks(), ferry({ pause: MIN_DWELL - 10 }))).toEqual([]);
    // Parked half a row low: its top isn't on the grid.
    expect(rideProof(banks(), ferry({ at: [NEAR + 1, FLOOR + 1.5] }))).toEqual([]);
  });

  it('a runner standing still on it in the sim arrives where the proof says', () => {
    const level = banks();
    const pp = ferry();
    const ride = rideProof(level, pp).find((r) => r.board % level.w === NEAR && r.alight % level.w === FAR)!;
    level.setPieces = [pp];
    const run = new RunWorld(level, [], [0]);
    const mid = solidId(pp.uid, 0, 1);
    const at = () => run.solids.find((s) => s.id === mid)!;
    // Wait for the ferry to park at the near bank, then stand still on its middle cell.
    while (run.frame < RUN_COUNTDOWN + 2 || at().x !== (NEAR + 2) * TILE || at().dx !== 0) run.step([NO_INPUT]);
    const b = run.runners[0].body;
    b.x = (NEAR + 2) * TILE + (TILE - b.w) / 2;
    b.y = FLOOR * TILE - b.h;
    b.vx = b.vy = 0;
    b.onGround = true;
    b.groundRef = mid;
    // Until it parks at the far bank.
    let moved = false;
    for (let f = 0; f < 2000 && !(moved && at().dx === 0); f++) {
      run.step([NO_INPUT]);
      moved ||= at().dx !== 0;
    }
    expect(run.runners[0].alive).toBe(true);
    expect(at().x).toBe((FAR - 2) * TILE);
    // Carried to the matching cell, one walk across the deck from where the proof alights.
    expect(Math.floor((b.x + b.w / 2) / TILE)).toBe(FAR - 2);
    expect(Math.floor((b.y + b.h - 1) / TILE)).toBe(FLOOR - 1);
    expect(ride.alight).toBe((FLOOR - 1) * level.w + FAR);
  });
});
