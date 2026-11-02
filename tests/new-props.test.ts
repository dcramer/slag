import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { ARCHETYPE_WEIGHTS, generateProp, LAUNCHER_AIM_WEIGHTS } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { DT, LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  barrelAim,
  blastCells,
  blastHits,
  canPlace,
  CLUSTER_FAN,
  DIR8,
  DROP_FALL,
  DROP_IDLE,
  DROP_RISE,
  DROP_WARN,
  dropperPose,
  FREEZE_FRAMES,
  makeProjectile,
  type Module,
  moduleSim,
  PHASE_WARN,
  phaseSolid,
  type PlacedProp,
  type PropDef,
  type ProjWorld,
  SEEK_C,
  SEEK_S,
  SNAP_UP,
  snapperPhase,
  stepProjectile,
  steer,
  TRACK_CONE,
} from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20;

/** Flat floor from FLOOR down, a wall column at x=30 (rows 10..FLOOR), a ceiling slab over x 12..16 at row 13. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = 1;
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
    setPieces: [],
  };
}

function def(modules: Module[], extra: Partial<PropDef> = {}): PropDef {
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
    ...extra,
  };
}

const c = (x = 0, y = 0): [number, number] => [x + 0.5, y + 0.5];
let uid = 1;
const place = (d: PropDef, tx: number, ty: number, rot = 0, owner = 7): PlacedProp => ({ uid: uid++, def: d, owner, tx, ty, rot });

/** A race already past its countdown with one runner. */
function race(level: Level, props: PlacedProp[]): { run: RunWorld; r: Runner } {
  const run = new RunWorld(level, props, [0]);
  run.frame = RUN_COUNTDOWN;
  return { run, r: run.runners[0] };
}

/** Put the runner's feet on cell (tx, ty)'s floor, centered. */
function standAt(r: Runner, tx: number, ty: number) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = (ty + 1) * TILE - r.body.h;
  r.body.vx = 0;
  r.body.vy = 0;
}

const steps = (run: RunWorld, n: number, inp: InputFrame = NO_INPUT) => {
  for (let i = 0; i < n; i++) run.step([inp]);
};

describe('warp pads', () => {
  const portal = def([{ type: 'portal', a: c(0, 0), b: c(6, 0) }]);
  it('move you to the other pad with velocity intact, and do not bounce you back', () => {
    const level = testLevel();
    const { run, r } = race(level, [place(portal, 10, FLOOR - 1)]);
    standAt(r, 8, FLOOR - 1);
    r.body.vx = 150;
    let jumped = -1;
    for (let i = 0; i < 20 && jumped < 0; i++) {
      const x0 = r.body.x;
      run.step([{ ...NO_INPUT, right: true }]);
      if (r.body.x - x0 > 3 * TILE) jumped = i;
    }
    expect(jumped).toBeGreaterThanOrEqual(0);
    expect(r.body.x).toBeGreaterThan(16 * TILE - 8);
    expect(r.body.vx).toBeGreaterThan(100);
    // Standing on the exit pad doesn't send you back.
    const x1 = r.body.x;
    steps(run, 30);
    expect(Math.abs(r.body.x - x1)).toBeLessThan(2 * TILE);
  });
  it('does nothing when the exit is blocked', () => {
    const level = testLevel();
    const p = place(portal, 10, FLOOR - 1);
    const { run, r } = race(level, [p]);
    level.tiles[(FLOOR - 1) * LEVEL_W + 16] = 1; // wall over pad B
    standAt(r, 10, FLOOR - 1);
    steps(run, 3);
    expect(r.body.x).toBeLessThan(12 * TILE);
  });
});

describe('bumper', () => {
  it('kicks you straight away from its center at its power', () => {
    const level = testLevel();
    const b = def([{ type: 'bumper', at: c(), radius: 0.5, power: 400 }]);
    const { run, r } = race(level, [place(b, 10, FLOOR - 3)]);
    // Drop a runner onto it from above: it should be fired upward.
    r.body.x = 10 * TILE + (TILE - r.body.w) / 2;
    r.body.y = (FLOOR - 4) * TILE;
    r.body.vy = 100;
    r.body.onGround = false;
    let vy = 0;
    for (let i = 0; i < 20; i++) {
      run.step([NO_INPUT]);
      if (r.body.vy < -300) {
        vy = r.body.vy;
        break;
      }
    }
    expect(vy).toBeLessThan(-350);
    expect(Math.abs(r.body.vx)).toBeLessThan(80);
  });
});

describe('gravity well', () => {
  const well = (polarity: 1 | -1, off = 0) => def([{ type: 'magnet', at: c(), radius: 3, strength: 1400, polarity, on: 60, off, warn: 30 }]);
  const vxAfter = (d: PropDef) => {
    const level = testLevel();
    const { run, r } = race(level, [place(d, 12, FLOOR - 1)]);
    standAt(r, 10, FLOOR - 1);
    steps(run, 5);
    return r.body.vx;
  };
  it('pulls toward its core within range and pushes when reversed', () => {
    expect(vxAfter(well(1))).toBeGreaterThan(5);
    expect(vxAfter(well(-1))).toBeLessThan(-5);
  });
  it('does nothing out of range', () => {
    const level = testLevel();
    const { run, r } = race(level, [place(well(1), 20, FLOOR - 1)]);
    standAt(r, 10, FLOOR - 1);
    steps(run, 5);
    expect(r.body.vx).toBe(0);
  });
});

describe('web', () => {
  it('catches a fall and slows you', () => {
    const level = testLevel();
    const cells: Cell[] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const { run, r } = race(level, [place(def([{ type: 'web', cells, drag: 0.25 }]), 10, FLOOR - 6)]);
    r.body.x = 10 * TILE + 3;
    r.body.y = (FLOOR - 8) * TILE;
    r.body.vy = 300;
    steps(run, 16);
    expect(r.body.vy).toBeLessThanOrEqual(30 + 1600 * 1.75 * DT + 1);
    expect(r.status.slowed).toBeGreaterThan(0);
  });
});

describe('launch barrel', () => {
  const barrel = (dirs: number[], auto = 200) => def([{ type: 'barrel', at: c(), dirs, step: 30, power: 450, auto }]);
  it('grabs you, holds you, and fires you the way it points when you jump', () => {
    const level = testLevel();
    const b = barrel([6]);
    const { run, r } = race(level, [place(b, 10, FLOOR - 1)]);
    standAt(r, 10, FLOOR - 1);
    steps(run, 12);
    expect(r.status.hold).toBeGreaterThanOrEqual(0);
    const y = r.body.y;
    steps(run, 10);
    expect(r.body.y).toBe(y); // held still
    run.step([{ ...NO_INPUT, jump: true, jumpPressed: true }]);
    expect(r.status.hold).toBe(-1);
    expect(r.body.vy).toBeCloseTo(-450);
    steps(run, 10);
    expect(r.body.y).toBeLessThan(y - 2 * TILE);
  });
  it('fires by itself after `auto` frames, only once settled', () => {
    const level = testLevel();
    const b = barrel([4, 6], 20);
    const p = place(b, 10, FLOOR - 1);
    const { run, r } = race(level, [p]);
    standAt(r, 10, FLOOR - 1);
    for (let i = 0; i < 200 && r.status.hold < 0; i++) run.step([NO_INPUT]);
    for (let i = 0; i < 100 && r.status.hold >= 0; i++) run.step([NO_INPUT]);
    expect(r.status.hold).toBe(-1);
    const aim = barrelAim(run.resolved[0].mods[0] as Extract<Module, { type: 'barrel' }>, run.frame - 1, run.resolved[0].phase);
    expect(aim.turn).toBe(1);
    const [dx, dy] = DIR8[aim.dir];
    expect(r.body.vx * dx + r.body.vy * dy).toBeGreaterThan(400);
  });
  it('rotates its directions with the prop', () => {
    const r = moduleSim('barrel').resolve({ type: 'barrel', at: c(), dirs: [6, 7], step: 30, power: 400, auto: 100 } as Module, {
      P: (p) => p,
      C: (x) => x.slice(),
      da: Math.PI / 2,
      T: TILE,
    }) as Extract<Module, { type: 'barrel' }>;
    expect(r.dirs).toEqual([0, 1]);
  });
});

describe('blink blocks', () => {
  const blink = def([{ type: 'phase', cells: [[0, 0]], on: 60, off: 40, offset: 0 }]);
  it('are solid exactly on their timer', () => {
    const level = testLevel();
    const { run } = race(level, [place(blink, 10, FLOOR - 4)]);
    const solidFrames: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      run.step([NO_INPUT]);
      solidFrames.push(run.solids.some((s) => s.propUid === run.resolved[0].pp.uid));
    }
    const on = solidFrames.filter(Boolean).length;
    expect(on).toBeGreaterThan(110);
    expect(on).toBeLessThan(130);
  });
  it('never reappear inside a runner', () => {
    const level = testLevel();
    const p = place(blink, 10, FLOOR - 1);
    const { run, r } = race(level, [p]);
    const m = run.resolved[0].mods[0] as Extract<Module, { type: 'phase' }>;
    // Wait until it's gone, then stand in its cell through the return.
    while (phaseSolid(m, run.frame, run.resolved[0].phase, run.propState.get(p.uid), 0, 0)) run.step([NO_INPUT]);
    standAt(r, 10, FLOOR - 1);
    steps(run, 100);
    expect(r.alive).toBe(true);
    expect(phaseSolid(m, run.frame, run.resolved[0].phase, run.propState.get(p.uid), 0, 0)).toBe(false);
    r.body.x += 3 * TILE;
    steps(run, 2);
    // Free again: it comes back if its timer says so (warn window is fair to see).
    expect(PHASE_WARN).toBeGreaterThan(10);
  });
});

describe('dropstone', () => {
  const drop = def([{ type: 'dropper', cells: [[0, 0]], angle: Math.PI / 2, reach: 8, warn: 18, rest: 40 }]);
  it('waits, spots a runner in its lane, telegraphs, slams, and crushes', () => {
    const level = testLevel();
    const p = place(drop, 10, FLOOR - 7);
    const { run, r } = race(level, [p]);
    standAt(r, 20, FLOOR - 1);
    steps(run, 30);
    expect(dropperPose(run.propState.get(p.uid), 0, run.frame).state).toBe(DROP_IDLE);
    standAt(r, 10, FLOOR - 1);
    run.step([NO_INPUT]);
    expect(dropperPose(run.propState.get(p.uid), 0, run.frame).state).toBe(DROP_WARN);
    steps(run, 17);
    expect(r.alive).toBe(true); // the telegraph is a fair warning
    steps(run, 40);
    expect(r.alive).toBe(false);
    expect(r.killer).toBe(7);
  });
  it('lands on the floor, then rises back home', () => {
    const level = testLevel();
    const p = place(drop, 10, FLOOR - 7);
    const { run, r } = race(level, [p]);
    standAt(r, 10, FLOOR - 1);
    run.step([NO_INPUT]);
    standAt(r, 25, FLOOR - 1);
    let landed = 0;
    for (let i = 0; i < 120; i++) {
      run.step([NO_INPUT]);
      landed = Math.max(landed, dropperPose(run.propState.get(p.uid), 0, run.frame).d);
    }
    expect(landed).toBe(6 * TILE); // rows FLOOR-6 .. FLOOR-1 are free
    let st = DROP_FALL;
    for (let i = 0; i < 400 && st !== DROP_IDLE; i++) {
      run.step([NO_INPUT]);
      st = dropperPose(run.propState.get(p.uid), 0, run.frame).state;
      if (st === DROP_RISE) expect(dropperPose(run.propState.get(p.uid), 0, run.frame).d).toBeLessThan(landed);
    }
    expect(dropperPose(run.propState.get(p.uid), 0, run.frame).d).toBe(0);
  });
});

describe('snap trap', () => {
  const snap = def([{ type: 'snapper', cells: [[0, 0]], angle: -Math.PI / 2, warn: 16, up: 30, cool: 50 }], { mount: 'face' });
  it('mounts like an attachment', () => {
    const level = testLevel();
    expect(canPlace(level, [], snap, 0, 10, FLOOR)).toBe(true);
    expect(canPlace(level, [], snap, 0, 10, FLOOR - 3)).toBe(false);
  });
  it('arms when you step on it, then kills only while up; running across is safe', () => {
    const level = testLevel();
    const p = place(snap, 10, FLOOR);
    const { run, r } = race(level, [p]);
    standAt(r, 10, FLOOR - 1);
    run.step([NO_INPUT]);
    const st = () => snapperPhase(run.resolved[0].mods[0] as Extract<Module, { type: 'snapper' }>, run.propState.get(p.uid), 0, run.frame);
    expect(st().seg).not.toBe(0);
    steps(run, 10);
    expect(r.alive).toBe(true);
    steps(run, 10);
    expect(r.alive).toBe(false);

    // A runner sprinting over doesn't get caught.
    const { run: run2, r: r2 } = race(testLevel(), [place(snap, 10, FLOOR)]);
    standAt(r2, 6, FLOOR - 1);
    r2.body.vx = 215;
    for (let i = 0; i < 40; i++) run2.step([{ ...NO_INPUT, right: true, run: true }]);
    expect(r2.alive).toBe(true);
    expect(r2.body.x).toBeGreaterThan(14 * TILE);
    expect(SNAP_UP).toBe(2);
  });
});

/** A bare projectile world with one runner standing at (tx, FLOOR-1). */
function projWorld(level: Level, tx = 20): { w: ProjWorld; spawned: unknown[]; killed: number[]; run: RunWorld } {
  const run = new RunWorld(level, [], [0]);
  standAt(run.runners[0], tx, FLOOR - 1);
  const spawned: unknown[] = [];
  const killed: number[] = [];
  const w: ProjWorld = {
    level,
    frame: 0,
    solids: [],
    runners: run.runners.map((r) => ({ slot: r.slot, body: r.body, status: r.status, input: NO_INPUT, active: true })),
    spawn: (p) => spawned.push(p),
    emit: () => {},
    kill: (i) => killed.push(i),
  };
  return { w, spawned, killed, run };
}

describe('projectiles', () => {
  it('seekers turn toward runners by at most their turn rate', () => {
    const level = testLevel();
    const { w } = projWorld(level, 20);
    const p = makeProjectile({ x: 10 * TILE, y: 5 * TILE, vx: 120, vy: 0, owner: 1, ammo: 'seeker' }, 0, 0);
    let last = 0; // heading as (vx, vy) unit vector
    for (let f = 1; f < 60; f++) {
      w.frame = f;
      const before = [p.vx, p.vy];
      stepProjectile(p, w);
      const dot = (before[0] * p.vx + before[1] * p.vy) / (120 * 120);
      expect(dot).toBeGreaterThanOrEqual(SEEK_C - 1e-9);
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(120, 6);
      last = p.vy;
    }
    expect(last).toBeGreaterThan(10); // it turned down toward the runner below
  });
  it('steer() snaps onto the target when within one step', () => {
    const v = { vx: 100, vy: 0 };
    steer(v, 100, 1, SEEK_C, SEEK_S, 100);
    expect(v.vy).toBeCloseTo(1, 1);
  });
  it('boomerangs come back', () => {
    const level = testLevel();
    const { w } = projWorld(level, 40);
    const p = makeProjectile({ x: 10 * TILE, y: 5 * TILE, vx: 250, vy: 0, owner: 1, ammo: 'boomerang' }, 0, 0);
    let maxX = p.x;
    for (let f = 1; f < 100; f++) {
      w.frame = f;
      stepProjectile(p, w);
      maxX = Math.max(maxX, p.x);
    }
    expect(maxX).toBeGreaterThan(10 * TILE + 50);
    expect(p.vx).toBeLessThan(-100);
    expect(p.x).toBeLessThan(maxX - 40);
  });
  it('rubber balls bounce off the floor and shove instead of kill', () => {
    const level = testLevel();
    const { w, killed, run } = projWorld(level, 40);
    const p = makeProjectile({ x: 10 * TILE, y: (FLOOR - 2) * TILE, vx: 60, vy: 200, owner: 1, ammo: 'rubber' }, 0, 0);
    let bounced = false;
    for (let f = 1; f < 40; f++) {
      w.frame = f;
      expect(stepProjectile(p, w)).toBe(true);
      if (p.vy < -100) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(p.n).toBeLessThan(5);
    const r = run.runners[0];
    const q = makeProjectile({ x: r.body.x - 3, y: r.body.y + 7, vx: 200, vy: 0, owner: 1, ammo: 'rubber' }, 0, 1);
    w.frame = 1;
    expect(stepProjectile(q, w)).toBe(false);
    expect(killed).toHaveLength(0);
    expect(r.body.vx).toBeGreaterThan(150);
    expect(r.body.vy).toBeLessThan(0);
  });
  it('cluster shells split into the same fan of shrapnel every time', () => {
    const split = () => {
      const { w, spawned } = projWorld(testLevel(), 40);
      const p = makeProjectile({ x: 10 * TILE, y: 10 * TILE, vx: 120, vy: -200, owner: 3, ammo: 'cluster' }, 0, 0);
      for (let f = 1; f < 80 && stepProjectile(p, w); f++) w.frame = f;
      return spawned;
    };
    const a = split();
    expect(a).toHaveLength(CLUSTER_FAN.length);
    expect(a).toEqual(split());
    expect(a.every((s) => (s as { ammo: string; owner: number }).ammo === 'shrapnel' && (s as { owner: number }).owner === 3)).toBe(true);
  });
  it('goo sticks to the floor as a slime patch; frost freezes a runner', () => {
    const level = testLevel();
    const { run, r } = race(level, []);
    standAt(r, 30 - 6, FLOOR - 1);
    run.projectiles.push(makeProjectile({ x: 10 * TILE, y: (FLOOR - 1) * TILE, vx: 0, vy: 200, owner: 1, ammo: 'goo' }, run.frame, 99));
    steps(run, 10);
    const patch = run.projectiles.find((p) => p.ammo === 'goo');
    expect(patch?.stuck).toBe(3);
    expect(run.solids.some((s) => s.surface.wall === 'sticky' && s.y < FLOOR * TILE && s.y > (FLOOR - 1) * TILE)).toBe(true);
    run.projectiles.push(makeProjectile({ x: r.body.x - 8, y: r.body.y + 7, vx: 260, vy: 0, owner: 1, ammo: 'frost' }, run.frame, 100));
    steps(run, 3);
    expect(r.alive).toBe(true);
    expect(r.status.frozen).toBeGreaterThan(FREEZE_FRAMES - 5);
    const x0 = r.body.x;
    steps(run, 10, { ...NO_INPUT, right: true });
    expect(Math.abs(r.body.x - x0)).toBeLessThan(2); // no control while frozen
  });
  it('ricochets reflect off walls', () => {
    const level = testLevel();
    const { w } = projWorld(level, 40);
    const p = makeProjectile({ x: 27 * TILE, y: 15 * TILE, vx: 300, vy: 0, owner: 1, ammo: 'ricochet' }, 0, 0);
    for (let f = 1; f < 30; f++) {
      w.frame = f;
      stepProjectile(p, w);
    }
    expect(p.vx).toBeCloseTo(-300);
    expect(p.n).toBe(2);
  });
  it('gliders carry a rider and sink under them', () => {
    const level = testLevel();
    const { run, r } = race(level, []);
    const g = makeProjectile({ x: 10 * TILE, y: 12 * TILE, vx: 80, vy: 0, owner: 1, ammo: 'glider' }, run.frame, 50);
    run.projectiles.push(g);
    r.body.x = g.x - r.body.w / 2;
    r.body.y = g.y - 2.5 - r.body.h - 2;
    r.body.onGround = false;
    steps(run, 6);
    expect(r.body.onGround).toBe(true);
    const x0 = r.body.x;
    const y0 = r.body.y;
    steps(run, 60);
    expect(r.body.onGround).toBe(true);
    expect(r.body.x - x0).toBeGreaterThan(60); // carried along
    expect(r.body.y - y0).toBeGreaterThan(20); // and sinking
    expect(r.alive).toBe(true);
  });
});

describe('demolition', () => {
  it('line blasts bore in the rotation direction; crosses and rings have their shapes', () => {
    const line = blastCells({ shape: 'line', target: 'terrain', radius: 5, width: 1 }, 10, 10, 1);
    expect(line).toEqual([0, 1, 2, 3, 4].map((k) => [10, 10 + k]));
    const cross = blastCells({ shape: 'cross', target: 'all', radius: 2, width: 1 }, 10, 10);
    expect(cross).toHaveLength(9);
    const ring = blastCells({ shape: 'ring', target: 'all', radius: 3, width: 1.3 }, 10, 10);
    expect(ring.some(([x, y]) => x === 10 && y === 10)).toBe(false);
    expect(ring.some(([x, y]) => x === 13 && y === 10)).toBe(true);
  });
  it('EMPs remove props but not terrain; drills remove terrain but not props', () => {
    const level = testLevel();
    const block = place(generateProp(new Rng(1), 'platform', 'p'), 10, FLOOR - 4);
    const emp = blastHits(level, [block], { shape: 'disk', target: 'props', radius: 4, width: 1 }, 10, FLOOR - 2);
    expect(emp.props).toContain(block);
    expect(emp.tiles).toHaveLength(0);
    const drill = blastHits(level, [block], { shape: 'line', target: 'terrain', radius: 6, width: 1 }, 10, FLOOR - 4, 1);
    expect(drill.props).toHaveLength(0);
    expect(drill.tiles.length).toBeGreaterThan(0);
  });
  it('time bombs wait until the race starts', async () => {
    const { Match } = await import('../src/game/match');
    const m = new Match(5);
    const tb = generateProp(new Rng(2), 'timebomb', 'tb');
    const target = generateProp(new Rng(3), 'platform', 'p');
    let spot: [number, number] | null = null;
    for (let y = 3; y < m.level.h - 3 && !spot; y++) for (let x = 8; x < m.level.w - 8 && !spot; x++) if (canPlace(m.level, [], target, 0, x, y)) spot = [x, y];
    const tp = { uid: 1, def: target, owner: 0, tx: spot![0], ty: spot![1], rot: 0 };
    m.placed.push({ uid: 2, def: tb, owner: 1, tx: spot![0], ty: spot![1], rot: 0 }, tp);
    expect(m.placed).toContain(tp);
    m.startRun();
    expect(m.placed).not.toContain(tp);
    expect(m.placed.some((p) => p.def.archetype === 'timebomb')).toBe(false);
  });
});

describe('launcher aim', () => {
  it('fixed aim clearly dominates, tracking is the rare one', () => {
    const w = Object.fromEntries(LAUNCHER_AIM_WEIGHTS);
    expect(w.fixed).toBeGreaterThan((w.sweep + w.track) * 1.5);
    expect(w.track).toBeLessThan(w.sweep);
    let track = 0;
    let fixed = 0;
    for (let i = 0; i < 600; i++) {
      const m = generateProp(new Rng(i), 'launcher', 'x').modules.find((x) => x.type === 'launcher')!;
      if (m.type !== 'launcher') continue;
      if (m.aim === 'track') track++;
      if (m.aim === 'fixed') fixed++;
    }
    expect(fixed).toBeGreaterThan(track * 3);
  });
  it('trackers watch a ±60° cone and always say so in their name', () => {
    expect(TRACK_CONE).toBeCloseTo(Math.PI / 3);
    for (let i = 0; i < 400; i++) {
      const d = generateProp(new Rng(i), 'launcher', 'x');
      const m = d.modules.find((x) => x.type === 'launcher')!;
      if (m.type === 'launcher' && m.aim === 'track') expect(d.name).toMatch(/^(Vigilant|Paranoid|Watchful|Tracking) /);
    }
  });
  it('a tracker ignores a runner behind it', () => {
    const level = testLevel();
    let d: PropDef | null = null;
    for (let i = 0; i < 500 && !d; i++) {
      const x = generateProp(new Rng(i), 'launcher', 'x');
      const m = x.modules.find((y) => y.type === 'launcher');
      if (m && m.type === 'launcher' && m.aim === 'track' && m.style === 'crossbow') d = x;
    }
    // Faces right (rot 0); runner is to its left.
    const p = place(d!, 20, FLOOR - 1);
    const { run, r } = race(level, [p]);
    standAt(r, 12, FLOOR - 1);
    steps(run, 30);
    const mount = (run.resolved[0].mods[1] as Extract<Module, { type: 'launcher' }>).angle;
    expect(Math.abs(run.propState.get(p.uid)!.aim.get(1)! - mount)).toBeLessThan(0.05);
    // ...but turns toward one in front of it.
    standAt(r, 27, FLOOR - 1);
    steps(run, 5);
    expect(Math.abs(run.propState.get(p.uid)!.aim.get(1)! - mount)).toBeGreaterThan(0.05);
  });
});

describe('new archetypes', () => {
  const NEW = ['portal', 'bumper', 'magnet', 'web', 'barrel', 'blinker', 'dropper', 'snapper', 'wheel', 'hangar'] as const;
  it('are all in the crate weights and generate deterministically', () => {
    const names = ARCHETYPE_WEIGHTS.map(([k]) => k);
    for (const k of NEW) {
      expect(names).toContain(k);
      expect(generateProp(new Rng(9), k, 'a')).toEqual(generateProp(new Rng(9), k, 'a'));
    }
  });
  it('races with every new part and projectile are deterministic', () => {
    const level = generateLevel(7);
    const go = () => {
      const lv = generateLevel(7);
      const placed: PlacedProp[] = [];
      const kinds = [...NEW, 'launcher', 'launcher', 'launcher', 'launcher', 'launcher', 'launcher'] as const;
      kinds.forEach((k, i) => {
        const d = generateProp(new Rng(i * 31 + 5), k, `${i}`);
        for (let n = 0; n < 4000; n++) {
          const tx = 6 + ((i * 7 + n * 13) % (lv.w - 12));
          const ty = 3 + ((i * 5 + n * 7) % (lv.h - 6));
          if (canPlace(lv, placed, d, 0, tx, ty)) {
            placed.push({ uid: 100 + i, def: d, owner: i % 3, tx, ty, rot: 0 });
            return;
          }
        }
      });
      const run = new RunWorld(lv, placed, [0, 1, 2]);
      const inp: InputFrame[] = [{ ...NO_INPUT, right: true, run: true }, { ...NO_INPUT, right: true, jump: true, jumpPressed: true }, NO_INPUT];
      for (let f = 0; f < 900; f++) run.step(inp);
      return JSON.stringify({ r: run.runners, p: run.projectiles, k: run.kills, n: placed.length });
    };
    void level;
    const a = go();
    expect(a).toEqual(go());
    expect(JSON.parse(a).n).toBeGreaterThan(12);
  });
});
