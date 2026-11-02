import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells } from '../src/core/geom';
import { Match } from '../src/game/match';
import { generateTheme } from '../src/gen/theme';
import { Predictor } from '../src/net/predict';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  castRay,
  dropperPose,
  fanZone,
  type Module,
  type ModuleOf,
  moduleSim,
  phaseCycle,
  pistonHead,
  pistonState,
  type PlacedProp,
  type PropDef,
  rayToWall,
  resolveProp,
  solidGap,
  tileGap,
  traceBeams,
} from '../src/sim/props';
import { DROP_REST } from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';
import { windAt } from '../src/sim/wind';

const FLOOR = 20;
const RIGHT = 0;
const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;

function testLevel(oneWayAt?: Cell): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  if (oneWayAt) tiles[oneWayAt[1] * LEVEL_W + oneWayAt[0]] = 2;
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

function def(modules: Module[]): PropDef {
  const cells = new Map<string, Cell>();
  for (const m of modules) for (const c of moduleSim(m.type).anchors(m)) cells.set(`${c[0]},${c[1]}`, c);
  return {
    key: 'test',
    name: 'test',
    maker: '',
    archetype: 'platform',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
    motion: { type: 'none' },
    modules,
    footprint: normalizeCells([...cells.values()]),
  };
}

const c = (x = 0, y = 0): [number, number] => [x + 0.5, y + 0.5];
const body = (cells: Cell[] = [[0, 0]]): Module => ({ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
const block = def([body()]);
const emitter = (m: Module) => def([body(), m]);
let nextUid = 1;
const place = (d: PropDef, tx: number, ty: number, rot = 0, owner = 7): PlacedProp => ({ uid: nextUid++, def: d, owner, tx, ty, rot });

// Off and warn of 0 keep a timed hazard lit, so a test only has to look at where it reaches.
const flame = emitter({ type: 'flame', at: c(), angle: RIGHT, length: 10, on: 10000, off: 0, warn: 0 });
const laser = emitter({ type: 'laser', at: c(), angle: RIGHT, charge: 0, fire: 10000, off: 0, sweep: 0, sweepPeriod: 200 });

function race(level: Level, props: PlacedProp[], runners = 1, setPieces: PlacedProp[] = []): { run: RunWorld; rs: Runner[] } {
  level.setPieces = setPieces;
  const run = new RunWorld(
    level,
    props,
    Array.from({ length: runners }, (_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  return { run, rs: run.runners };
}

function standAt(r: Runner, tx: number, ty: number) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = (ty + 1) * TILE - r.body.h;
  r.body.vx = 0;
  r.body.vy = 0;
}

const steps = (run: RunWorld, n: number) => {
  for (let i = 0; i < n; i++) run.step(run.runners.map(() => NO_INPUT));
};
const beamOf = (run: RunWorld, p: PlacedProp, mi = 1) => run.beams.find((b) => b.uid === p.uid && b.mi === mi)!;
const hazards = (run: RunWorld) => run['out'].hazards;

/** Flame at x=10 aimed right along row FLOOR-1, with a runner at each `at`. */
function flameLane(props: (lane: number) => PlacedProp[], at: number[], emit = flame) {
  const lane = FLOOR - 1;
  const { run, rs } = race(testLevel(), [place(emit, 10, lane), ...props(lane)], at.length);
  at.forEach((x, i) => standAt(rs[i], x, lane));
  return { run, rs };
}

describe('rays stop at solids', () => {
  for (const [name, d] of [
    ['flame', flame],
    ['laser', laser],
  ] as const) {
    it(`a ${name} burns the runner in front of a block and spares the one behind`, () => {
      const { run, rs } = flameLane((lane) => [place(block, 15, lane)], [13, 17], d);
      steps(run, 3);
      expect(rs[0].alive).toBe(false);
      expect(rs[0].cause).toBe('hazard');
      expect(rs[1].alive).toBe(true);
    });
    it(`a ${name} with nothing in the way reaches both`, () => {
      const { run, rs } = flameLane(() => [], [13, 17], d);
      steps(run, 3);
      expect(rs.map((r) => r.alive)).toEqual([false, false]);
    });
  }

  it('a flame stops exactly on the face, and its hazard reaches the face but no further', () => {
    const { run } = flameLane((lane) => [place(block, 14, lane)], []);
    steps(run, 1);
    const p = run.placed[0];
    expect(beamOf(run, p).len).toBe((14 - 10.5) * TILE);
    expect(beamOf(run, p).hit).toBe(true);
    const seg = hazards(run)[0];
    if (seg.kind !== 'seg') throw new Error('expected a segment');
    expect(seg.x2 + seg.r).toBe(14 * TILE);
  });

  it('a block flush against the nozzle smothers it', () => {
    const { run, rs } = flameLane((lane) => [place(block, 11, lane)], [13]);
    steps(run, 3);
    expect(hazards(run)).toHaveLength(0);
    expect(rs[0].alive).toBe(true);
  });

  it('a lava geyser stops under a block; whoever stands on the block is safe', () => {
    const g: ModuleOf<'geyser'> = {
      type: 'geyser',
      look: 'lava',
      at: [0.5, 8],
      angle: UP,
      width: 0.9,
      length: 8,
      off: 0,
      warn: 0,
      on: 10000,
      lethal: true,
      strength: 0,
    };
    const vent = { ...place(def([g]), 12, FLOOR - 8), owner: -1 };
    const roof = place(block, 12, FLOOR - 4);
    const { run, rs } = race(testLevel(), [roof], 2, [vent]);
    standAt(rs[0], 12, FLOOR - 1);
    standAt(rs[1], 12, FLOOR - 5);
    steps(run, 20);
    expect(rs[0].alive).toBe(false);
    expect(rs[1].alive).toBe(true);
    expect(beamOf(run, vent, 0).len).toBe(3 * TILE);
  });

  it('a steam geyser under a block lifts nobody past it', () => {
    const g: ModuleOf<'geyser'> = {
      type: 'geyser',
      look: 'steam',
      at: [0.5, 8],
      angle: UP,
      width: 0.9,
      length: 8,
      off: 0,
      warn: 0,
      on: 10000,
      lethal: false,
      strength: 2600,
    };
    const vent = { ...place(def([g]), 12, FLOOR - 8), owner: -1 };
    const { run, rs } = race(testLevel(), [place(block, 12, FLOOR - 4)], 1, [vent]);
    standAt(rs[0], 12, FLOOR - 5);
    steps(run, 20);
    expect(rs[0].body.y).toBe((FLOOR - 4) * TILE - rs[0].body.h);
  });
});

describe('what rays ignore', () => {
  it('own body: a part stops nothing it fires', () => {
    const wide = def([
      body([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
      { type: 'laser', at: c(), angle: RIGHT, charge: 0, fire: 10000, off: 0, sweep: 0, sweepPeriod: 200 },
    ]);
    const { run, rs } = flameLane(() => [], [20], wide);
    steps(run, 3);
    expect(rs[0].alive).toBe(false);
  });

  it('one-way tiles', () => {
    const lane = FLOOR - 1;
    const { run, rs } = race(testLevel([13, lane]), [place(flame, 10, lane)]);
    standAt(rs[0], 15, lane);
    steps(run, 3);
    expect(rs[0].alive).toBe(false);
  });

  it('gliders', () => {
    const { run } = flameLane(() => [], []);
    run.spawnProjectile({ x: 14 * TILE, y: (FLOOR - 0.5) * TILE, vx: 0, vy: 0, owner: 0, ammo: 'glider' });
    steps(run, 2);
    expect(run.solids.some((s) => s.oneWay)).toBe(true);
    expect(beamOf(run, run.placed[0]).hit).toBe(false);
  });

  it('runners: a beam goes through everyone in it', () => {
    const { run, rs } = flameLane(() => [], [13, 14, 15]);
    steps(run, 3);
    expect(rs.every((r) => !r.alive)).toBe(true);
  });
});

describe('moving solids block only while solid', () => {
  const blink = def([{ type: 'phase', cells: [[0, 0]], on: 40, off: 40, offset: 0 }]);

  it('a blink block shields while it is on, and the flame comes through while it is off', () => {
    const lane = FLOOR - 1;
    const wall = place(blink, 14, lane);
    const { run, rs } = flameLane(() => [wall], [17]);
    const m = run.resolved.find((r) => r.pp.uid === wall.uid)!;
    const solid = () => phaseCycle(m.mods[0] as ModuleOf<'phase'>, run.frame, m.phase).seg === 0;
    // Line up on the block's first solid frame, so the runner hasn't been caught already.
    while (!solid() && rs[0].alive) {
      rs[0].body.x = 2 * TILE;
      steps(run, 1);
    }
    standAt(rs[0], 17, lane);
    while (solid()) {
      steps(run, 1);
      if (solid()) expect(rs[0].alive).toBe(true);
    }
    steps(run, 3);
    expect(rs[0].alive).toBe(false);
  });

  it('a platform blocks where it is this frame, not where it was', () => {
    const slider: PropDef = { ...block, motion: { type: 'rail', angle: DOWN, range: 6, period: 200 } };
    const lane = FLOOR - 6;
    const p = place(slider, 14, lane - 3);
    const { run: moving } = race(testLevel(), [place(flame, 10, lane), p]);
    const seen = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      steps(moving, 1);
      const solid = moving.solids.find((s) => s.propUid === p.uid)!;
      const inLine = solid.y <= (lane + 0.5) * TILE && solid.y + solid.h > (lane + 0.5) * TILE;
      expect(beamOf(moving, moving.placed[0]).hit).toBe(inLine);
      seen.add(inLine);
    }
    expect(seen.size).toBe(2);
  });

  it('a crumbled block stops shielding', () => {
    const crumble = def([{ type: 'body', cells: [[0, 0]], material: 'crumble', conveyor: 0, breakFrames: 1, respawnFrames: 600 }]);
    const lane = FLOOR - 1;
    const wall = place(crumble, 14, lane);
    const { run, rs } = flameLane(() => [wall], [17]);
    steps(run, 3);
    expect(rs[0].alive).toBe(true);
    run.propState.get(wall.uid)!.brokenUntil = run.frame + 600;
    steps(run, 3);
    expect(rs[0].alive).toBe(false);
  });
});

describe('tesla arcs need a clear line', () => {
  const gate = def([
    body([
      [0, 0],
      [6, 0],
    ]),
    { type: 'tesla', a: c(0, 0), b: c(6, 0), on: 10000, off: 0, warn: 0 },
  ]);

  it('a block between the coils shorts the whole gate', () => {
    const lane = FLOOR - 1;
    const { run, rs } = race(testLevel(), [place(gate, 10, lane), place(block, 13, lane)], 2);
    standAt(rs[0], 12, lane);
    standAt(rs[1], 15, lane);
    steps(run, 3);
    expect(rs.map((r) => r.alive)).toEqual([true, true]);
    expect(hazards(run)).toHaveLength(0);
    expect(beamOf(run, run.placed[0]).hit).toBe(true);
  });

  it('with the line clear it burns the length of the gate', () => {
    const lane = FLOOR - 1;
    const { run, rs } = race(testLevel(), [place(gate, 10, lane)], 2);
    standAt(rs[0], 12, lane);
    standAt(rs[1], 15, lane);
    steps(run, 3);
    expect(rs.map((r) => r.alive)).toEqual([false, false]);
  });
});

describe('fans', () => {
  const fan: ModuleOf<'fan'> = { type: 'fan', at: c(), angle: UP, length: 8, strength: 2200 };
  const up = def([body(), fan]);

  it('a block cuts the column at its face and the air stops there', () => {
    const base = place(up, 20, FLOOR - 1);
    const lid = place(block, 20, FLOOR - 5);
    const { run, rs } = race(testLevel(), [base, lid]);
    standAt(rs[0], 20, FLOOR - 6);
    steps(run, 1);
    expect(beamOf(run, base).len).toBe(3 * TILE);
    expect(beamOf(run, base).hit).toBe(true);
    const z = run['out'].winds[0];
    expect(z.y + 2).toBe((FLOOR - 4) * TILE);
    expect(windAt(rs[0].body, run['out'].winds)).toBeNull();
  });

  it('with no lid it blows its full length, as a bare level would', () => {
    const base = place(up, 20, FLOOR - 1);
    const { run } = race(testLevel(), [base]);
    steps(run, 1);
    const mod = run.resolved[0].mods[1] as ModuleOf<'fan'>;
    expect(run['out'].winds[0]).toEqual(fanZone(run.level, mod));
    expect(beamOf(run, base).len).toBe(8 * TILE);
    expect(beamOf(run, base).hit).toBe(false);
  });

  it('a platform crossing the column only cuts it while it is across', () => {
    const slider: PropDef = { ...block, motion: { type: 'rail', angle: RIGHT, range: 6, period: 200 } };
    const base = place(up, 20, FLOOR - 1);
    const { run } = race(testLevel(), [base, place(slider, 17, FLOOR - 5)]);
    const lens = new Set<number>();
    for (let i = 0; i < 200; i++) {
      steps(run, 1);
      lens.add(beamOf(run, base).len);
    }
    expect([...lens].sort((a, b) => a - b)).toEqual([3 * TILE, 8 * TILE]);
  });
});

describe('trackers need a line of sight', () => {
  const tracker: Module = {
    type: 'launcher',
    style: 'turret',
    ammo: 'bolt',
    at: c(),
    angle: RIGHT,
    aim: 'track',
    sweep: 0,
    sweepPeriod: 200,
    interval: 10000,
    burst: 1,
    spread: 1,
    spreadAngle: 0,
    speed: 300,
  };
  const turret = emitter(tracker);
  const aimAt = (run: RunWorld, p: PlacedProp) => run.propState.get(p.uid)!.aim.get(1) ?? RIGHT;

  it('turns to a runner it can see, and holds its mount when a block hides them', () => {
    const lane = FLOOR - 6;
    const seen = place(turret, 10, lane);
    const { run: open, rs: a } = race(testLevel(), [seen]);
    standAt(a[0], 16, FLOOR - 1);
    steps(open, 30);
    expect(aimAt(open, seen)).toBeGreaterThan(0.3);

    const hid = place(turret, 10, lane);
    const { run: walled, rs: b } = race(testLevel(), [hid, place(block, 12, lane + 1), place(block, 12, lane + 2), place(block, 13, lane + 2)]);
    standAt(b[0], 16, FLOOR - 1);
    steps(walled, 30);
    expect(aimAt(walled, hid)).toBe(RIGHT);
  });

  it('terrain hides a runner too', () => {
    const lane = FLOOR - 1;
    const level = testLevel();
    for (let y = lane - 3; y <= lane; y++) level.tiles[y * LEVEL_W + 14] = 1;
    const p = place(turret, 10, lane - 2);
    const { run, rs } = race(level, [p]);
    standAt(rs[0], 18, lane);
    steps(run, 30);
    expect(aimAt(run, p)).toBe(RIGHT);
  });

  it('its sight line stops on the block in front of it', () => {
    const lane = FLOOR - 6;
    const p = place(turret, 10, lane);
    const { run } = race(testLevel(), [p, place(block, 14, lane)]);
    steps(run, 1);
    expect(beamOf(run, p).len).toBe((14 - 10.5) * TILE);
  });
});

describe('shots', () => {
  const gun: Module = {
    type: 'launcher',
    style: 'crossbow',
    ammo: 'bolt',
    at: c(),
    angle: RIGHT,
    aim: 'fixed',
    sweep: 0,
    sweepPeriod: 200,
    interval: 9000,
    burst: 1,
    spread: 1,
    spreadAngle: 0,
    speed: 600,
  };

  it('a block flush against a muzzle stops the shot, which still clears its own launcher', () => {
    const lane = FLOOR - 1;
    const { run: open, rs: a } = race(testLevel(), [place(emitter(gun), 10, lane)]);
    standAt(a[0], 16, lane);
    const fired = (run: RunWorld) => {
      for (let i = 0; i < 9000 && run.projectiles.length === 0; i++) steps(run, 1);
      expect(run.projectiles).toHaveLength(1);
    };
    fired(open);
    steps(open, 12);
    expect(a[0].alive).toBe(false);

    const { run, rs } = race(testLevel(), [place(emitter(gun), 10, lane), place(block, 11, lane)]);
    standAt(rs[0], 16, lane);
    fired(run);
    steps(run, 12);
    expect(rs[0].alive).toBe(true);
    expect(run.projectiles).toHaveLength(0);
  });

  it('a glider splinters on a placed block', () => {
    const { run } = race(testLevel(), [place(block, 16, FLOOR - 8)]);
    run.spawnProjectile({ x: 12 * TILE, y: (FLOOR - 7.5) * TILE, vx: 120, vy: 0, owner: 0, ammo: 'glider' });
    steps(run, 40);
    expect(run.projectiles).toHaveLength(0);
  });

  it('a glider leaves the launcher that fired it', () => {
    const hangar: Module = { ...gun, ammo: 'glider', speed: 120 } as Module;
    const { run } = race(testLevel(), [place(emitter(hangar), 10, FLOOR - 8)]);
    for (let i = 0; i < 9000 && run.projectiles.length === 0; i++) steps(run, 1);
    steps(run, 30);
    expect(run.projectiles).toHaveLength(1);
  });
});

describe('dropstones', () => {
  const drop = def([{ type: 'dropper', cells: [[0, 0]], angle: DOWN, reach: 12, warn: 6, rest: 40 }]);
  const d = (run: RunWorld, p: PlacedProp) => dropperPose(run.propState.get(p.uid), 0, run.frame);

  it('landing on a block spares whoever shelters under it', () => {
    const stone = place(drop, 20, FLOOR - 9);
    const { run, rs } = race(testLevel(), [stone, place(block, 20, FLOOR - 4)], 2);
    standAt(rs[0], 20, FLOOR - 1); // Under the block.
    standAt(rs[1], 20, FLOOR - 5); // On it: in the lane, and it fires.
    steps(run, 2);
    standAt(rs[1], 30, FLOOR - 1);
    steps(run, 60);
    expect(d(run, stone).d).toBeCloseTo(4 * TILE, 6);
    expect(rs[0].alive).toBe(true);
  });

  it('crushes a runner pinned on the block', () => {
    const stone = place(drop, 20, FLOOR - 9);
    const { run, rs } = race(testLevel(), [stone, place(block, 20, FLOOR - 4)]);
    standAt(rs[0], 20, FLOOR - 5);
    steps(run, 60);
    expect(rs[0].alive).toBe(false);
    expect(rs[0].killer).toBe(7);
  });

  it('cannot see past a block in its lane', () => {
    const stone = place(drop, 20, FLOOR - 9);
    const { run, rs } = race(testLevel(), [stone, place(block, 20, FLOOR - 4)]);
    standAt(rs[0], 20, FLOOR - 1);
    steps(run, 60);
    expect(d(run, stone).d).toBe(0);
    expect(rs[0].alive).toBe(true);
  });

  it('without the block it lands on the floor', () => {
    const stone = place(drop, 20, FLOOR - 9);
    const { run, rs } = race(testLevel(), [stone]);
    standAt(rs[0], 20, FLOOR - 1);
    steps(run, 2);
    standAt(rs[0], 30, FLOOR - 1);
    steps(run, 60);
    expect(d(run, stone).d).toBeCloseTo(8 * TILE, 6);
  });

  it('shows the lane it will land in, the block included', () => {
    const stone = place(drop, 20, FLOOR - 9);
    const { run } = race(testLevel(), [stone, place(block, 20, FLOOR - 4)]);
    steps(run, 1);
    expect(beamOf(run, stone, 0).len).toBe(4 * TILE);
  });

  it('a blink block that returns inside the falling head does not yank it back', () => {
    const blink = def([{ type: 'phase', cells: [[0, 0]], on: 1000, off: 1000, offset: 0 }]);
    const stone = place(drop, 20, FLOOR - 9);
    const wall = place(blink, 20, FLOOR - 7);
    const { run, rs } = race(testLevel(), [stone, wall]);
    // Pretend the head has already passed the block's row when it comes on.
    const st = run.propState.get(stone.uid)!;
    st.vars.set('0:st', 2);
    st.vars.set('0:t', run.frame);
    st.vars.set('0:d', 5 * TILE);
    st.vars.set('0:pd', 5 * TILE);
    standAt(rs[0], 30, FLOOR - 1);
    steps(run, 1);
    expect(d(run, stone).d).toBeGreaterThanOrEqual(5 * TILE);
    steps(run, 40);
    expect(d(run, stone).d).toBeCloseTo(8 * TILE, 6);
    expect(d(run, stone).state).toBe(DROP_REST);
  });
});

describe('crushers', () => {
  const press: ModuleOf<'piston'> = { type: 'piston', at: [0.5, 0.5], angle: DOWN, reach: 6, width: 1, period: 120 };
  const crusher = def([body(), press]);
  /** The frame where this piston's head is fully out. */
  const extended = (run: RunWorld, p: PlacedProp) => {
    const r = run.resolved.find((x) => x.pp.uid === p.uid)!;
    const m = r.mods[1] as ModuleOf<'piston'>;
    for (let i = 0; i < 200 && pistonState(m, run.frame, r.phase).ext < 1; i++) steps(run, 1);
    return m;
  };

  it('stops on a block, and whoever is under the block is safe', () => {
    const top = FLOOR - 9;
    const p = place(crusher, 20, top);
    const { run, rs } = race(testLevel(), [p, place(block, 20, top + 4)]);
    standAt(rs[0], 20, FLOOR - 1);
    extended(run, p);
    steps(run, 1);
    const head = run.solids.find((s) => s.propUid === p.uid && s.mi === 1)!;
    expect(head.y + head.h).toBe((top + 4) * TILE);
    expect(rs[0].alive).toBe(true);
  });

  it('runs its full stroke with the lane clear', () => {
    const top = FLOOR - 9;
    const p = place(crusher, 20, top);
    const { run } = race(testLevel(), [p]);
    const m = extended(run, p);
    steps(run, 1);
    const head = run.solids.find((s) => s.propUid === p.uid && s.mi === 1)!;
    const r = run.resolved[0];
    expect(head.y).toBe(pistonHead(m, pistonState(m, run.frame - 1, r.phase).ext, [0, 0]).y);
  });

  it('stops on terrain', () => {
    const p = place(crusher, 20, FLOOR - 3);
    const { run } = race(testLevel(), [p]);
    extended(run, p);
    steps(run, 1);
    const head = run.solids.find((s) => s.propUid === p.uid && s.mi === 1)!;
    expect(head.y + head.h).toBe(FLOOR * TILE);
    expect(beamOf(run, p).len).toBe(1.5 * TILE);
  });

  it('stays at rest with a block flush against its body', () => {
    const top = FLOOR - 9;
    const p = place(crusher, 20, top);
    const { run, rs } = race(testLevel(), [p, place(block, 20, top + 1)]);
    standAt(rs[0], 20, top + 2);
    extended(run, p);
    expect(beamOf(run, p).len).toBe(0);
    expect(rs[0].alive).toBe(true);
  });

  it('a wide head stops on a block under any part of it', () => {
    const wide: ModuleOf<'piston'> = { ...press, at: [1.5, 0.5], width: 3 };
    const d = def([
      body([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
      wide,
    ]);
    const top = FLOOR - 9;
    const p = place(d, 20, top);
    const { run } = race(testLevel(), [p, place(block, 22, top + 3)]);
    steps(run, 1);
    expect(beamOf(run, p).len).toBe(1.5 * TILE);
  });

  it('squashes a runner it pins on a block', () => {
    const top = FLOOR - 9;
    const p = place(crusher, 20, top);
    const { run, rs } = race(testLevel(), [p, place(block, 20, top + 4)]);
    standAt(rs[0], 20, top + 3);
    extended(run, p);
    expect(rs[0].alive).toBe(false);
    expect(rs[0].killer).toBe(7);
  });

  it('a fast slam crushes a lone runner on the floor instead of popping them onto its head', () => {
    // Its stroke ends 8 px above the floor, too low for a runner, and the head covers 12 px in its last frame:
    // deeper than half the overlap, so pushing out by the shallowest side would lift the runner on top.
    const top = FLOOR - 8;
    const p = place(crusher, 20, top);
    const { run, rs } = race(testLevel(), [p]);
    standAt(rs[0], 20, FLOOR - 1);
    const y0 = rs[0].body.y;
    for (let i = 0; i < 120 && rs[0].alive; i++) {
      steps(run, 1);
      expect(rs[0].body.y).toBeGreaterThanOrEqual(y0);
    }
    expect([rs[0].alive, rs[0].cause, rs[0].killer]).toEqual([false, 'crush', 7]);
  });

  it('a fast slam sideways pins a runner against a wall', () => {
    const lane = FLOOR - 1;
    const p = place(def([body(), { ...press, angle: RIGHT, reach: 8 }]), 20, lane);
    const level = testLevel();
    for (let y = 0; y < FLOOR; y++) level.tiles[y * LEVEL_W + 30] = 1;
    const { run, rs } = race(level, [p]);
    standAt(rs[0], 29, lane);
    rs[0].body.x = 30 * TILE - rs[0].body.w;
    for (let i = 0; i < 120 && rs[0].alive; i++) steps(run, 1);
    expect([rs[0].alive, rs[0].cause, rs[0].killer]).toEqual([false, 'crush', 7]);
  });

  it('a runner beside a slam is left alone', () => {
    const top = FLOOR - 9;
    const p = place(crusher, 20, top);
    const { run, rs } = race(testLevel(), [p]);
    standAt(rs[0], 22, FLOOR - 1);
    const x0 = rs[0].body.x;
    steps(run, 240);
    expect(rs[0].alive).toBe(true);
    expect(rs[0].body.x).toBe(x0);
  });

  it('its head blocks a laser', () => {
    const lane = FLOOR - 4;
    const top = lane - 3;
    const p = place(def([body(), { ...press, reach: 2.3 }]), 20, top);
    const gun = place(laser, 10, lane);
    const { run } = race(testLevel(), [gun, p]);
    extended(run, p);
    steps(run, 1);
    expect(beamOf(run, gun).len).toBe((20 - 10.5) * TILE);
  });
});

describe('order independence and determinism', () => {
  /** A busy layout: every emitter's line crosses solids from props before and after it in the list. */
  function layout(): PlacedProp[] {
    const lane = FLOOR - 1;
    const fan: ModuleOf<'fan'> = { type: 'fan', at: c(), angle: UP, length: 8, strength: 2200 };
    const press: ModuleOf<'piston'> = { type: 'piston', at: [0.5, 0.5], angle: DOWN, reach: 8, width: 1, period: 120 };
    const pressUp: ModuleOf<'piston'> = { ...press, angle: UP };
    const blink = def([{ type: 'phase', cells: [[0, 0]], on: 30, off: 30, offset: 0 }]);
    return [
      { uid: 1, def: flame, owner: 1, tx: 10, ty: lane, rot: 0 },
      { uid: 2, def: block, owner: 1, tx: 15, ty: lane, rot: 0 },
      { uid: 3, def: laser, owner: 1, tx: 22, ty: lane - 2, rot: 0 },
      { uid: 4, def: blink, owner: 1, tx: 28, ty: lane - 2, rot: 0 },
      { uid: 5, def: def([body(), fan]), owner: 1, tx: 30, ty: lane, rot: 0 },
      { uid: 6, def: block, owner: 1, tx: 30, ty: lane - 4, rot: 0 },
      // Two pistons meeting head on, so neither may depend on who went first.
      { uid: 7, def: def([body(), press]), owner: 1, tx: 36, ty: lane - 10, rot: 0 },
      { uid: 8, def: def([body(), pressUp]), owner: 1, tx: 36, ty: lane, rot: 0 },
      { uid: 9, def: def([{ type: 'dropper', cells: [[0, 0]], angle: DOWN, reach: 12, warn: 6, rest: 40 }]), owner: 1, tx: 40, ty: lane - 9, rot: 0 },
      { uid: 10, def: block, owner: 1, tx: 40, ty: lane - 3, rot: 0 },
    ];
  }

  const trace = (props: PlacedProp[]) => {
    const { run, rs } = race(testLevel(), props, 2);
    standAt(rs[0], 12, FLOOR - 1);
    standAt(rs[1], 40, FLOOR - 5);
    const log: unknown[] = [];
    for (let i = 0; i < 300; i++) {
      steps(run, 1);
      const beams = [...run.beams].sort((a, b) => a.uid - b.uid || a.mi - b.mi).map((b) => [b.uid, b.mi, b.len, b.hit]);
      const solids = [...run.solids].sort((a, b) => a.id - b.id).map((s) => [s.id, s.x, s.y]);
      log.push({ beams, solids, alive: rs.map((r) => r.alive) });
    }
    return log;
  };

  it('prop order changes nothing', () => {
    const forward = trace(layout());
    expect(trace(layout().sort((a, b) => b.uid - a.uid))).toEqual(forward);
    const shuffled = layout();
    shuffled.push(...shuffled.splice(0, 4));
    expect(trace(shuffled)).toEqual(forward);
  });

  it('two identical runs match frame for frame', () => {
    expect(trace(layout())).toEqual(trace(layout()));
  });

  it('solids that hold beams come from every prop, before and after the emitter', () => {
    const lane = FLOOR - 1;
    const after = race(testLevel(), [
      { uid: 1, def: flame, owner: 1, tx: 10, ty: lane, rot: 0 },
      { uid: 2, def: block, owner: 1, tx: 15, ty: lane, rot: 0 },
    ]);
    const before = race(testLevel(), [
      { uid: 2, def: block, owner: 1, tx: 15, ty: lane, rot: 0 },
      { uid: 1, def: flame, owner: 1, tx: 10, ty: lane, rot: 0 },
    ]);
    steps(after.run, 1);
    steps(before.run, 1);
    expect(beamOf(before.run, before.run.placed[1]).len).toBe(beamOf(after.run, after.run.placed[0]).len);
  });
});

describe('one result for sim and art', () => {
  it('a race has its beams before the first step, for the first frame drawn', () => {
    const lane = FLOOR - 1;
    const { run } = flameLane(() => [place(block, 15, lane)], []);
    expect(beamOf(run, run.placed[0]).len).toBe((15 - 10.5) * TILE);
  });

  it('reports a beam while it is off, because telegraphs draw it', () => {
    const lane = FLOOR - 1;
    const asleep = emitter({ type: 'laser', at: c(), angle: RIGHT, charge: 50, fire: 50, off: 10000, sweep: 0, sweepPeriod: 200 });
    const { run } = race(testLevel(), [place(asleep, 10, lane), place(block, 15, lane)]);
    steps(run, 1);
    expect(beamOf(run, run.placed[0]).len).toBe((15 - 10.5) * TILE);
    expect(hazards(run)).toHaveLength(0);
  });

  it('a sweeping beam reports the angle it was cast at', () => {
    const lane = FLOOR - 6;
    const sweep = emitter({ type: 'laser', at: c(), angle: RIGHT, charge: 0, fire: 10000, off: 0, sweep: 0.5, sweepPeriod: 200 });
    const { run } = race(testLevel(), [place(sweep, 10, lane)]);
    steps(run, 17);
    const b = beamOf(run, run.placed[0]);
    const seg = hazards(run)[0];
    if (seg.kind !== 'seg') throw new Error('expected a segment');
    expect(Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1)).toBeCloseTo(b.angle!, 9);
  });

  it('the preview outside a race stops where the race will', () => {
    const lane = FLOOR - 1;
    const props = [
      place(flame, 10, lane),
      place(block, 15, lane),
      place(emitter({ type: 'fan', at: c(), angle: UP, length: 8, strength: 2200 }), 20, lane),
      place(block, 20, lane - 4),
    ];
    const level = testLevel();
    const { run } = race(level, props);
    run.frame = 0;
    steps(run, 1);
    const preview = traceBeams(level, props.map(resolveProp), 0);
    expect(preview).toEqual(run.beams);
  });

  it('a predicted copy keeps its own beams', () => {
    const m = new Match(4242);
    m.join('a:kb1');
    m.startMatch();
    m.placed.push(place(flame, 10, 5), place(block, 15, 5));
    m.startRun();
    m.step({});
    const predicted = new Predictor().copy(m);
    const live = m.run!.beams;
    predicted.step({});
    m.step({});
    expect(predicted.run!.beams).toEqual(live);
    expect(predicted.run!.beams).not.toBe(live);
    expect(live.length).toBeGreaterThan(0);
  });
});

describe('casts', () => {
  const level = testLevel();

  it('lands exactly on a tile face, whatever the angle', () => {
    expect(rayToWall(level, 100.5, 100, 0, 1, 1000, 2)).toBe(FLOOR * TILE - 100);
    const s = Math.SQRT1_2;
    const d = rayToWall(level, 100, 100, s, s, 1000, 2);
    expect(100 + s * d).toBeCloseTo(FLOOR * TILE, 9);
  });

  it('gives up past the level and at its sides', () => {
    expect(rayToWall(level, 100, 100, 0, -1, 1200, 2)).toBeLessThan(100 + 5 * TILE);
    expect(rayToWall(level, 40, 100, -1, 0, 1200, 2)).toBe(40);
  });

  it('never returns less than its skip, even starting in a wall', () => {
    expect(rayToWall(level, 100, FLOOR * TILE + 4, 1, 0, 300, 6)).toBe(6);
  });

  it('hits a solid on its near face, and ignores its own prop and anything past maxLen', () => {
    const s = { x: 100, y: 0, w: 16, h: 200, id: 1, dx: 0, dy: 0, surface: undefined as never, propUid: 3, mi: 0 };
    expect(castRay(level, [s], 20, 50, 1, 0, 400, 0, 9)).toBe(80);
    expect(castRay(level, [s], 20, 50, 1, 0, 400, 0, 3)).toBe(400);
    expect(castRay(level, [s], 20, 50, 1, 0, 60, 0, 9)).toBe(60);
    expect(castRay(level, [s], 20, 50, 1, 0, 400, 0, 9, 0)).toBe(400);
  });

  it('sweeps a rect up to a solid, ignoring what it already overlaps', () => {
    const s = { x: 40, y: 100, w: 16, h: 16, id: 1, dx: 0, dy: 0, surface: undefined as never, propUid: 3, mi: 0 };
    expect(solidGap([s], { x: 44, y: 20, w: 16, h: 16 }, 0, 1, 200, 9)).toBe(64);
    expect(solidGap([s], { x: 56, y: 20, w: 16, h: 16 }, 0, 1, 200, 9)).toBe(200);
    expect(solidGap([s], { x: 44, y: 105, w: 16, h: 16 }, 0, 1, 200, 9)).toBe(200);
  });

  it('sweeps a rect up to terrain from any side', () => {
    expect(tileGap(level, { x: 40, y: 200, w: 16, h: 16 }, 0, 1, 500)).toBe(FLOOR * TILE - 216);
    expect(tileGap(level, { x: 40, y: 200, w: 16, h: 16 }, 0, 1, 10)).toBe(10);
    expect(tileGap(level, { x: 40, y: 200, w: 16, h: 16 }, -1, 0, 500)).toBe(40);
  });
});
