import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { type Contrib, type Module, moduleSim, newPropState, type PlacedProp, type PropDef, resolveProp, solidId, vehiclePose } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/** Open test arena: a floor at row FLOOR, nothing else. */
const FLOOR = LEVEL_H - 4;
function arena(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
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

function piece(mod: Module): PlacedProp {
  const def: PropDef = {
    key: 'test',
    name: 'test',
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

const rotor = (o: Partial<Extract<Module, { type: 'rotor' }>>): Module => ({
  type: 'rotor',
  look: 'windmill',
  support: 'none',
  mastX: 0,
  hub: [24.5, 10.5],
  arm: 3.5,
  count: 4,
  angle0: 0.3,
  period: 420,
  swing: 0,
  dir: 1,
  width: 2,
  thick: 0.5,
  material: 'wood',
  seed: 1,
  ...o,
});

const vehicle = (o: Partial<Extract<Module, { type: 'vehicle' }>> = {}): Module => ({
  type: 'vehicle',
  look: 'tractor',
  at: [16, FLOOR],
  cols: [2.25, 1.4, 1.3],
  colW: 1,
  span: 12,
  speed: 3,
  pause: 40,
  hurt: 'lead',
  flip: false,
  seed: 1,
  ...o,
});

/**
 * Put runner 0 on top of solid `part` of the piece and let it ride with no
 * input. Every frame its feet must sit exactly on that solid and its offset
 * along the platform must not drift.
 */
function ride(level: Level, pp: PlacedProp, part: number, frames: number, startAt = RUN_COUNTDOWN + 5) {
  level.setPieces = [pp];
  const run = new RunWorld(level, [], [0]);
  while (run.frame < startAt) run.step([NO_INPUT]);
  const id = solidId(pp.uid, 0, part);
  const s0 = run.solids.find((s) => s.id === id)!;
  const b = run.runners[0].body;
  b.x = s0.x + s0.w / 2 - b.w / 2;
  b.y = s0.y - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  b.groundRef = id;
  const rel = b.x - s0.x;
  let maxGap = 0;
  let maxDrift = 0;
  let airborne = 0;
  for (let f = 0; f < frames; f++) {
    run.step([NO_INPUT]);
    expect(run.runners[0].alive, `died at ${f}: ${run.runners[0].cause}`).toBe(true);
    const s = run.solids.find((x) => x.id === id)!;
    maxGap = Math.max(maxGap, Math.abs(b.y + b.h - s.y));
    maxDrift = Math.max(maxDrift, Math.abs(b.x - s.x - rel));
    if (!b.onGround || b.groundRef !== id) airborne++;
  }
  return { maxGap, maxDrift, airborne };
}

describe('set-piece riding', () => {
  it('a wheel platform carries its rider all the way round', () => {
    const r = ride(arena(), piece(rotor({})), 0, 420);
    expect(r.airborne).toBe(0);
    expect(r.maxGap).toBeLessThan(0.5);
    expect(r.maxDrift).toBeLessThan(0.5);
  });

  it('a pendulum platform carries its rider through full swings', () => {
    const r = ride(arena(), piece(rotor({ count: 1, swing: 0.8, angle0: Math.PI / 2, arm: 6, hub: [24.5, 4.5], period: 180, width: 3 })), 0, 400);
    expect(r.airborne).toBe(0);
    expect(r.maxGap).toBeLessThan(0.5);
    expect(r.maxDrift).toBeLessThan(0.5);
  });

  it('a vehicle roof carries its rider through drives, stops and reversals', () => {
    const r = ride(arena(), piece(vehicle()), 1, 600);
    expect(r.airborne).toBe(0);
    expect(r.maxGap).toBeLessThan(0.5);
    expect(r.maxDrift).toBeLessThan(0.5);
  });

  it("a vehicle's leading face kills a runner standing in its path", () => {
    for (const startRight of [false, true]) {
      const level = arena();
      level.spawn = { tx: startRight ? 13 : 34, ty: FLOOR - 1 };
      level.setPieces = [piece(vehicle({ at: [startRight ? 14 : 17, FLOOR], span: 14 }))];
      const run = new RunWorld(level, [], [0]);
      for (let f = 0; f < 1200 && run.runners[0].alive; f++) run.step([NO_INPUT]);
      expect(run.runners[0].alive).toBe(false);
      expect(run.runners[0].cause).toBe('hazard');
    }
  });

  it('a vehicle is only lethal on its leading face while moving', () => {
    const level = arena();
    const pp = piece(vehicle({ span: 6, pause: 50 }));
    const r = resolveProp(pp);
    const m = r.mods[0] as Extract<Module, { type: 'vehicle' }>;
    const state = newPropState();
    let parked = 0;
    for (let f = 0; f < 600; f++) {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      moduleSim('vehicle').build!(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi: 0, live: true }, out);
      const pose = vehiclePose(m, f, r.phase);
      if (!pose.moving) {
        parked++;
        expect(out.hazards.length).toBe(0);
      }
      for (const h of out.hazards) {
        expect(h.kind).toBe('rect');
        if (h.kind !== 'rect') continue;
        const body = { x0: Math.min(...out.solids.map((s) => s.x)), x1: Math.max(...out.solids.map((s) => s.x + s.w)) };
        if (pose.dir > 0) expect(h.r.x).toBeCloseTo(body.x1, 5);
        else expect(h.r.x + h.r.w).toBeCloseTo(body.x0, 5);
      }
    }
    expect(parked).toBeGreaterThan(80);
  });
});
