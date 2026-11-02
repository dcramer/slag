import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateTheme } from '../src/gen/theme';
import { geysers, type GeyserOpts } from '../src/gen/setpieces/builders';
import { finalize, Site } from '../src/gen/setpieces/place';
import { LEVEL_H, LEVEL_W, PLAYER_H, PLAYER_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { type Contrib, type Module, moduleSim, newPropState, type PlacedProp, type PropDef, resolveProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * Geysers aimed every way (docs/SETPIECES.md, Sideways and downward geysers): the sim pushes along the
 * column's own axis, and the builder finds a wall foot to blow along the ground from, or a ceiling to pour from.
 */

const FLOOR = LEVEL_H - 4;
const DOWN = Math.PI / 2;

/** A floor, a wall at column 6 and 41 standing on it, and a roof slab over columns 18..24, seven rows over the floor. */
function arena(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const set = (x: number, y: number) => (tiles[y * LEVEL_W + x] = 1);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) set(x, y);
  for (let y = FLOOR - 4; y < FLOOR; y++) {
    set(6, y);
    set(41, y);
  }
  for (let x = 18; x <= 24; x++) set(x, FLOOR - 7);
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

function piece(mods: Module[]): PlacedProp {
  const def: PropDef = {
    key: 'test',
    name: 'test',
    maker: 'test',
    archetype: 'fan',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    motion: { type: 'none' },
    modules: mods,
    footprint: [[0, 0]],
  };
  return { uid: 100_000, def, owner: -1, tx: 0, ty: 0, rot: 0 };
}

/** Always erupting, as near as the cycle allows. */
const geyser = (at: [number, number], angle: number, length: number): Module => ({
  type: 'geyser',
  look: 'water',
  at,
  angle,
  width: 0.9,
  length,
  off: 1,
  warn: 1,
  on: 5000,
  lethal: false,
  strength: 2600,
});

/** A race with one runner whose feet stand on top of row `ty + 1` at column tx. */
function race(mods: Module[], tx: number, ty: number): RunWorld {
  const level = arena();
  level.setPieces = mods.length ? [piece(mods)] : [];
  const run = new RunWorld(level, [], [0]);
  const b = run.runners[0].body;
  b.x = tx * TILE + (TILE - PLAYER_W) / 2;
  b.y = (ty + 1) * TILE - PLAYER_H;
  b.vx = 0;
  b.vy = 0;
  run.frame = RUN_COUNTDOWN;
  return run;
}

const input = (o: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...o });

describe('geysers aimed sideways and down', () => {
  it('trace a column along their own axis, starting at the vent', () => {
    const level = arena();
    for (const [at, angle, dx, dy] of [
      [[7, FLOOR - 0.45], 0, 1, 0],
      [[41, FLOOR - 0.45], Math.PI, -1, 0],
      [[21.5, FLOOR - 6], DOWN, 0, 1],
    ] as const) {
      const pp = piece([geyser([at[0], at[1]], angle, 10)]);
      const r = resolveProp(pp);
      const m = r.mods[0] as Extract<Module, { type: 'geyser' }>;
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      moduleSim('geyser').trace!(m, { level, frame: 200, r, off: [0, 0], prev: [0, 0], state: newPropState(), mi: 0, live: true }, out);
      expect(out.winds).toHaveLength(1);
      const w = out.winds[0];
      expect([w.dx, w.dy]).toEqual([dx, dy]);
      const vx = at[0] * TILE;
      const vy = at[1] * TILE;
      // It lies on the open side of the vent and covers the vent's line.
      if (dx > 0) expect(w.x).toBeGreaterThanOrEqual(vx - 0.01);
      if (dx < 0) expect(w.x + w.w).toBeLessThanOrEqual(vx + 0.01);
      if (dy > 0) expect(w.y).toBeGreaterThanOrEqual(vy - 0.01);
      if (dx !== 0) expect(w.y < vy && w.y + w.h > vy).toBe(true);
      else expect(w.x < vx && w.x + w.w > vx).toBe(true);
    }
  });

  it('a sideways geyser along the ground carries a standing runner along its axis, and keeps them on the ground', () => {
    for (const [at, angle, tx, sign] of [
      [[7, FLOOR - 0.45], 0, 9, 1],
      [[41, FLOOR - 0.45], Math.PI, 38, -1],
    ] as const) {
      const run = race([geyser([at[0], at[1]], angle, 12)], tx, FLOOR - 1);
      const b = run.runners[0].body;
      const x0 = b.x;
      const y0 = b.y;
      for (let f = 0; f < 60; f++) run.step([NO_INPUT]);
      expect((b.x - x0) * sign, `aimed ${angle}`).toBeGreaterThan(2 * TILE);
      expect(Math.abs(b.y - y0)).toBeLessThan(0.5);
    }
  });

  it('a downward geyser pushes down: a jump under it peaks lower than the same jump in still air', () => {
    const apex = (mods: Module[]) => {
      const run = race(mods, 21, FLOOR - 1);
      const b = run.runners[0].body;
      let top = b.y;
      for (let f = 0; f < 50; f++) {
        run.step([input({ jump: f < 20, jumpPressed: f === 0 })]);
        top = Math.min(top, b.y);
      }
      return top;
    };
    const still = apex([]);
    const pour = apex([geyser([21.5, FLOOR - 6], DOWN, 30)]);
    expect(pour - still).toBeGreaterThan(TILE);
  });
});

describe('geyser builder aims', () => {
  const opts = (aim: GeyserOpts['aim']): GeyserOpts => ({
    name: 'Test',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 },
    look: 'water',
    aim,
    where: 'ground',
    length: [8, 8],
    width: 0.9,
    off: [100, 100],
    warn: 40,
    on: [60, 60],
    lethal: false,
  });

  it('sideways: out of the foot of a wall, along the ground, away from the wall', () => {
    const level = arena();
    const s = new Site(level);
    let seen = 0;
    for (const p of geysers(new Rng(3), s, opts('side'))) {
      const m = p.modules[0] as Extract<Module, { type: 'geyser' }>;
      const dir = Math.round(Math.cos(m.angle));
      expect(Math.abs(dir)).toBe(1);
      // The tile behind the vent is the wall; the column's lower edge sits on the floor.
      const wall = dir > 0 ? m.at[0] - 1 : m.at[0];
      expect(level.tiles[(FLOOR - 1) * level.w + wall]).toBe(1);
      expect(m.at[1] + m.width / 2).toBeCloseTo(FLOOR, 6);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
    // And the placer accepts it.
    const first = geysers(new Rng(3), s, opts('side')).next().value!;
    expect(finalize(s, first, 1, 'test')).not.toBeNull();
  });

  it('down: from under a ceiling, over ground someone stands on', () => {
    const level = arena();
    const s = new Site(level);
    let seen = 0;
    for (const p of geysers(new Rng(3), s, opts('down'))) {
      const m = p.modules[0] as Extract<Module, { type: 'geyser' }>;
      expect(m.angle).toBeCloseTo(DOWN, 9);
      expect(level.tiles[(m.at[1] - 1) * level.w + Math.floor(m.at[0])]).toBe(1);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
    const first = geysers(new Rng(3), s, opts('down')).next().value!;
    expect(finalize(s, first, 1, 'test')).not.toBeNull();
  });
});
