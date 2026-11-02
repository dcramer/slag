import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells, type Vec } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generatePart, isBridgePart } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { type Level, tileAt } from '../src/sim/level';
import {
  barrierOf,
  BOOST,
  buttonSolid,
  canPlace,
  COMPASS,
  FLING,
  flingBack,
  flingSpeed,
  FUSE_BLAST,
  fuseState,
  landedDef,
  makeProjectile,
  type Module,
  type ModuleOf,
  moduleSim,
  type PlacedProp,
  plateArc,
  plateStart,
  type PropDef,
  REGRAB,
  resolveProp,
  spotAt,
  motionOffset,
} from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * The parody backlog's first batch (docs/PARODY-BACKLOG.md): Launch Plate,
 * Four-Square, Boost Strip, Panic Button, Fuse Crate and Y-Fling, each run
 * for real in a RunWorld.
 */

const FLOOR = 20;
const LANE = FLOOR - 1;
/** A wall column at x = WALL, rows 8..FLOOR-1, for parts on walls. */
const WALL = 34;

function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 8; y < FLOOR; y++) tiles[y * LEVEL_W + WALL] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: LANE },
    goal: { tx: LEVEL_W - 3, ty: LANE },
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

let uid = 1;
const place = (d: PropDef, tx: number, ty: number, rot = 0, owner = 7): PlacedProp => ({ uid: uid++, def: d, owner, tx, ty, rot });

function race(props: PlacedProp[], n = 1, level = testLevel()) {
  const run = new RunWorld(
    level,
    props,
    Array.from({ length: n }, (_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  return { run, r: run.runners[0] };
}

function standAt(r: Runner, tx: number, ty = LANE) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = (ty + 1) * TILE - r.body.h;
  r.body.vx = 0;
  r.body.vy = 0;
  r.body.onGround = true;
}

/** Center a runner on world (x, y), in the air. */
function fly(r: Runner, x: number, y: number, vx = 0, vy = 0) {
  r.body.x = x - r.body.w / 2;
  r.body.y = y - r.body.h / 2;
  r.body.vx = vx;
  r.body.vy = vy;
  r.body.onGround = false;
  r.body.groundRef = -1;
}

const steps = (run: RunWorld, n: number, inp: InputFrame = NO_INPUT) => {
  for (let i = 0; i < n; i++) run.step(run.runners.map(() => inp));
};
const RIGHT: InputFrame = { ...NO_INPUT, right: true };
const RUN: InputFrame = { ...NO_INPUT, right: true, run: true };
const JUMP: InputFrame = { ...NO_INPUT, jump: true, jumpPressed: true };
const cellKey = (level: Level, x: number, y: number) => y * level.w + x;

/** Same inputs, same race: frame by frame, everything a snapshot carries. */
function sameTwice(build: () => { run: RunWorld; script: (run: RunWorld, f: number) => void }, frames: number) {
  const go = () => {
    uid = 500;
    const { run, script } = build();
    const out: string[] = [];
    for (let f = 0; f < frames; f++) {
      script(run, f);
      out.push(
        JSON.stringify([
          run.runners.map((r) => [r.body.x, r.body.y, r.body.vx, r.body.vy, r.alive, r.status, r.attach]),
          [...run.propState.values()].map((s) => [...s.vars]),
        ]),
      );
    }
    return out;
  };
  expect(go()).toEqual(go());
}

// --- Launch Plate ------------------------------------------------------------

const ARC: Vec = [300, -560];
const plate = def([{ type: 'spring', at: [0.5, 0.5], angle: -Math.PI / 2, power: 640, exact: true, arc: ARC }], { archetype: 'launchplate' });
const PLATE_X = 12;

/** Walk or run into the plate (or drop onto it), then let go of everything: where do the feet land? */
function launch(entry: 'walk' | 'run' | 'drop' | 'back', rot = 0) {
  const p = place(plate, PLATE_X, LANE, rot);
  const { run, r } = race([p]);
  const inp = entry === 'walk' ? RIGHT : entry === 'run' ? RUN : entry === 'back' ? { ...NO_INPUT, left: true } : NO_INPUT;
  if (entry === 'drop') fly(r, (PLATE_X + 0.5) * TILE + 3, (LANE - 4) * TILE, 0, 200);
  else if (entry === 'back') standAt(r, PLATE_X + 3);
  else {
    standAt(r, PLATE_X - 4);
    r.body.vx = entry === 'run' ? PHYS.runSpeed : 0;
  }
  let fired = -1;
  for (let i = 0; i < 120 && fired < 0; i++) {
    run.step([inp]);
    if (r.springCooldown > 0) fired = run.frame;
  }
  expect(fired, entry).toBeGreaterThan(0);
  let left = false;
  for (let i = 0; i < 240; i++) {
    run.step([NO_INPUT]);
    if (!r.body.onGround) left = true;
    else if (left) break;
  }
  return { run, p, land: [r.body.x + r.body.w / 2, r.body.y + r.body.h] as Vec };
}

describe('launch plate', () => {
  it('lands every runner on the same spot, whatever speed they came in at', () => {
    const lands = (['walk', 'run', 'drop', 'back'] as const).map((e) => launch(e).land);
    for (const l of lands) {
      expect(Math.abs(l[0] - lands[0][0])).toBeLessThan(TILE);
      expect(l[1]).toBe(lands[0][1]);
    }
    // A plain spring adds to what you bring: the same entries scatter.
    expect(lands[0][0] - (PLATE_X + 0.5) * TILE).toBeGreaterThan(5 * TILE);
  });

  it('draws the arc the sim flies: the X is where the runner lands', () => {
    const { run, p, land } = launch('run');
    const m = run.resolved.find((x) => x.pp.uid === p.uid)!.mods[0] as ModuleOf<'spring'>;
    const arc = plateArc(run.world, plateStart(m, [0, 0]), m.arc!);
    expect(arc.land).not.toBeNull();
    expect(arc.land![0]).toBeCloseTo(land[0], 6);
    expect(arc.land![1]).toBeCloseTo(land[1], 6);
  });

  it('turns to pick its throw: mirrored from rot 2, a higher, shorter lob on odd turns', () => {
    const at = (PLATE_X + 0.5) * TILE;
    const flat = launch('walk', 0).land[0] - at;
    const lob = launch('walk', 1).land[0] - at;
    const back = launch('back', 2).land[0] - at;
    expect(flat).toBeGreaterThan(6 * TILE);
    expect(lob).toBeGreaterThan(TILE);
    expect(lob).toBeLessThan(flat);
    expect(back).toBeCloseTo(-flat, 0);
  });

  it('is part of no route the proof makes, and flies the same twice', () => {
    const level = testLevel();
    const p = place(plate, PLATE_X, LANE);
    expect(barrierOf(level, p).noGo).toContain(cellKey(level, PLATE_X, LANE));
    sameTwice(() => {
      const { run, r } = race([place(plate, PLATE_X, LANE)]);
      standAt(r, PLATE_X - 4);
      return { run, script: (w, f) => w.step([f < 30 ? RUN : NO_INPUT]) };
    }, 120);
  });
});

// --- Four-Square -------------------------------------------------------------

/** Every orientation of the seven pieces, as normalized cell sets. */
const PIECES = (() => {
  const base: Cell[][] = [
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ];
  const key = (cs: Cell[]) =>
    normalizeCells(cs)
      .map(([x, y]) => `${x},${y}`)
      .sort()
      .join(' ');
  const out = new Set<string>();
  for (const cs of base) {
    let c = cs;
    for (let r = 0; r < 4; r++) {
      out.add(key(c));
      c = c.map(([x, y]) => [-y, x] as Cell);
    }
  }
  return { has: (cs: Cell[]) => out.has(key(cs)) };
})();

describe('four-square', () => {
  const squares = Array.from({ length: 150 }, (_, i) => generatePart(new Rng(i * 7 + 5), 'platform', 'platform')).filter((p) =>
    p.variants.some((v) => v.modules.some((m) => m.type === 'body' && m.look === 'tetra')),
  );

  it('rolls as a platform: one of the seven four-cell pieces, connected, in one size', () => {
    expect(squares.length).toBeGreaterThan(20);
    const shapes = new Set<string>();
    for (const p of squares) {
      expect(p.variants.map((v) => v.size)).toEqual(['medium']);
      const v = p.variants[0];
      expect(v.role).toBe('build');
      const m = v.modules[0] as ModuleOf<'body'>;
      expect(m.cells).toHaveLength(4);
      expect(PIECES.has(m.cells)).toBe(true);
      expect(typeof m.hue).toBe('number');
      shapes.add(JSON.stringify(m.cells));
    }
    expect(shapes.size).toBeGreaterThanOrEqual(5);
  });

  it('is footing the proof can stand on, but never a stand-in for the bridge', () => {
    const level = testLevel();
    for (const p of squares.slice(0, 6)) {
      const d = p.variants[0];
      expect(isBridgePart(d)).toBe(false);
      const pp = place(d, 14, 10);
      expect(canPlace(level, [], d, 0, 14, 10)).toBe(true);
      expect(barrierOf(level, pp).ground).toHaveLength(4);
      expect(barrierOf(level, pp).noGo).toHaveLength(0);
    }
  });
});

// --- Boost Strip -------------------------------------------------------------

const strip = (n = 2) =>
  def([{ type: 'coat', cells: Array.from({ length: n }, (_, i) => [i, 0] as Cell), angle: -Math.PI / 2, kind: 'boost' }], { mount: 'face' });

describe('boost strip', () => {
  it('kicks you to its speed along the arrow, and holds it with no skid for its frames', () => {
    const { run, r } = race([place(strip(2), 12, FLOOR)]);
    standAt(r, 10);
    let on = -1;
    for (let i = 0; i < 60 && on < 0; i++) {
      run.step([RIGHT]);
      if (r.status.boost > 0) on = i;
    }
    expect(on).toBeGreaterThanOrEqual(0);
    expect(BOOST.speed).toBeGreaterThan(PHYS.runSpeed * 1.5);
    // Let go of everything: the kick holds you at its speed until it runs out, and you leave it skidding.
    let held = 0;
    for (let i = 0; i < 60; i++) {
      run.step([NO_INPUT]);
      if (r.status.boost > 0 || Math.abs(r.body.vx - BOOST.speed) < 8) held++;
      if (r.status.boost > 0 && r.body.onGround) expect(r.body.vx).toBeGreaterThan(BOOST.speed - 8);
    }
    expect(held).toBeGreaterThanOrEqual(BOOST.frames);
    expect(r.body.vx).toBeLessThan(BOOST.speed - 50);
  });

  it('points its arrow a quarter turn on from its face: left on a ceiling, up and down a wall', () => {
    const level = testLevel();
    // A ceiling strip under a slab: bump it and you're sent left.
    const slab = testLevel();
    for (let x = 14; x < 18; x++) slab.tiles[13 * slab.w + x] = 1;
    {
      const d = landedDef(slab, [], strip(2), 2, 15, 13);
      expect(canPlace(slab, [], strip(2), 2, 15, 13)).toBe(true);
      const { run, r } = race([place(d, 15, 13, 2)], 1, slab);
      fly(r, 15.5 * TILE, 14 * TILE + 8, 0, -300);
      for (let i = 0; i < 6 && r.status.boost === 0; i++) run.step([NO_INPUT]);
      expect(r.status.boostVx).toBe(-BOOST.speed);
    }
    // On the wall's left face (rot 3) the arrow points up the wall; on its right face (rot 1), down.
    for (const [rot, tx, sign, push] of [
      [3, WALL, -1, RIGHT],
      [1, WALL, 1, { ...NO_INPUT, left: true }],
    ] as const) {
      const ok = canPlace(level, [], strip(1), rot, tx, LANE - 2);
      expect(ok, `rot ${rot}`).toBe(true);
      const d = landedDef(level, [], strip(1), rot, tx, LANE - 2);
      const { run, r } = race([place(d, tx, LANE - 2, rot)]);
      const side = rot === 3 ? WALL * TILE - 3 - r.body.w / 2 : (WALL + 1) * TILE + 3 + r.body.w / 2;
      fly(r, side, (LANE - 2 + 0.5) * TILE, 0, 0);
      let vy = 0;
      for (let i = 0; i < 4; i++) {
        run.step([push]);
        if (Math.abs(r.body.vy) >= BOOST.speed - 30) vy = r.body.vy;
      }
      expect(Math.sign(vy), `rot ${rot}`).toBe(sign);
    }
  });

  it('mounts like a coat: on a face, trimmed to the cells that mount, never in the air', () => {
    const level = testLevel();
    expect(canPlace(level, [], strip(3), 0, 20, FLOOR)).toBe(true);
    expect(canPlace(level, [], strip(3), 0, 20, 10)).toBe(false);
    // Hanging off the end of the wall's top: only the cell on the wall mounts.
    const d = landedDef(level, [], strip(3), 0, WALL, 8);
    expect(d.footprint).toHaveLength(1);
    expect(barrierOf(level, place(strip(3), 20, FLOOR)).noGo).toContain(cellKey(level, 20, LANE));
  });

  it('boosts the same twice', () => {
    sameTwice(() => {
      const { run, r } = race([place(strip(2), 12, FLOOR)]);
      standAt(r, 9);
      return { run, script: (w, f) => w.step([f < 20 ? RIGHT : f === 40 ? JUMP : NO_INPUT]) };
    }, 100);
  });

  it('stuck on a lift, rides it like any coat, and still kicks whoever stands on it', () => {
    // A three-wide set-piece lift that rises four tiles and back, parked 40 frames at each end.
    const cells: Cell[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const liftDef: PropDef = {
      ...def([{ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 }]),
      motion: { type: 'rail', angle: -Math.PI / 2, range: 4, period: 120, dwell: 40 },
    };
    const lp: PlacedProp = { uid: 100_001, def: liftDef, owner: -1, tx: 14, ty: 16, rot: 0 };
    const level = { ...testLevel(), setPieces: [lp] };
    const f0 = 3000;
    const row = lp.ty + Math.round(motionOffset(resolveProp(lp), f0)[1] / TILE);
    const s = spotAt(level, [], strip(3), 0, 14, row, f0);
    expect(s.ok).toBe(true);
    expect(s.ride?.uid).toBe(lp.uid);
    const coat: PlacedProp = { uid: 1, def: s.def, owner: 7, tx: 14, ty: row, rot: 0, ride: s.ride };
    const { run, r } = race([coat], 1, level);
    run.step([NO_INPUT]); // The solids on hand are this race frame's from here on.
    const ys: number[] = [];
    for (let i = 0; i < 240; i++) {
      // Set down on the strip wherever the lift has it now: it kicks every time.
      const c = run.solids.find((x) => x.propUid === 1)!;
      const l = run.solids.find((x) => x.propUid === lp.uid)!;
      expect(c.y + c.h).toBeCloseTo(l.y, 6);
      if (i % 30 === 0) {
        r.body.x = c.x + 2;
        r.body.y = c.y - r.body.h;
        r.body.vx = 0;
        r.body.vy = 0;
        r.status.boost = 0;
        run.step([NO_INPUT]);
        expect(r.status.boost, `frame ${i}`).toBeGreaterThan(0);
        expect(r.body.vx).toBeGreaterThan(BOOST.speed - 10);
      } else run.step([NO_INPUT]);
      ys.push(c.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(3 * TILE);
  });
});

// --- Panic Button ------------------------------------------------------------

const ON = 300;
/** Button at (0, 1), outline row 0 from x = 3: a ledge over a two-tile drop. */
const panic = def(
  [
    {
      type: 'button',
      at: [0.5, 1.5],
      angle: -Math.PI / 2,
      cells: [
        [3, 0],
        [4, 0],
        [5, 0],
      ],
      on: ON,
      warn: 60,
    },
  ],
  { archetype: 'panic', role: 'build' },
);
const BX = 10;
const BY = LANE - 1;

describe('panic button', () => {
  const solidAt = (run: RunWorld, p: PlacedProp, ci: number) => buttonSolid(run.propState.get(p.uid), 0, run.frame, ci);

  it('makes its outline solid for its time once pressed, and only then', () => {
    const p = place(panic, BX, BY);
    const { run, r } = race([p]);
    standAt(r, BX + 8);
    steps(run, 30);
    expect(run.solids.some((s) => s.propUid === p.uid)).toBe(false);
    standAt(r, BX);
    run.step([NO_INPUT]);
    standAt(r, BX + 12);
    const solid: number[] = [];
    for (let i = 0; i < ON + 20; i++) {
      run.step([NO_INPUT]);
      if (run.solids.filter((s) => s.propUid === p.uid).length === 3) solid.push(i);
    }
    expect(solid[0]).toBe(0);
    expect(solid).toHaveLength(ON);
    expect(solidAt(run, p, 0)).toBe(false);
  });

  it('never fills a cell around a runner: that cell waits until they leave', () => {
    const p = place(panic, BX, BY);
    const { run } = race([p], 2);
    const [a, b] = run.runners;
    standAt(a, BX);
    fly(b, (BX + 4.5) * TILE, (BY + 0.5) * TILE);
    run.step([NO_INPUT, NO_INPUT]);
    standAt(a, BX + 12);
    for (let i = 0; i < 10; i++) {
      fly(b, (BX + 4.5) * TILE, (BY + 0.5) * TILE);
      run.step([NO_INPUT, NO_INPUT]);
    }
    expect(b.alive).toBe(true);
    expect(solidAt(run, p, 0)).toBe(true);
    expect(solidAt(run, p, 1)).toBe(false);
    expect(solidAt(run, p, 2)).toBe(true);
    standAt(b, BX + 14);
    steps(run, 2);
    expect(solidAt(run, p, 1)).toBe(true);
  });

  it('starts its time over when pressed again while on', () => {
    const p = place(panic, BX, BY);
    const { run, r } = race([p]);
    standAt(r, BX);
    run.step([NO_INPUT]);
    standAt(r, BX + 12);
    steps(run, 200);
    standAt(r, BX);
    run.step([NO_INPUT]);
    standAt(r, BX + 12);
    steps(run, ON - 20);
    expect(solidAt(run, p, 0)).toBe(true);
    steps(run, 40);
    expect(solidAt(run, p, 0)).toBe(false);
  });

  it('leaves its outline to the route (the proof counts it gone) and its button off it, and presses the same twice', () => {
    const level = testLevel();
    const p = place(panic, BX, BY);
    const { noGo, ground } = barrierOf(level, p);
    expect(noGo).toContain(cellKey(level, BX, BY + 1));
    for (let x = BX + 3; x < BX + 6; x++) expect(noGo).not.toContain(cellKey(level, x, BY));
    expect(ground).toHaveLength(0);
    sameTwice(() => {
      const { run, r } = race([place(panic, BX, BY)]);
      standAt(r, BX - 3);
      return { run, script: (w, f) => w.step([f < 40 ? RIGHT : f % 90 === 0 ? JUMP : NO_INPUT]) };
    }, 400);
  });
});

// --- Fuse Crate --------------------------------------------------------------

const COUNT = 180;
const REGROW = 360;
const crate = def([{ type: 'fuse', cells: [[0, 0]], trigger: 'land', count: COUNT, radius: 1.5, regrow: REGROW }], { archetype: 'fuse', role: 'hazard' });
const CX = 16;

describe('fuse crate', () => {
  const mode = (run: RunWorld, p: PlacedProp) => fuseState(crate.modules[0] as ModuleOf<'fuse'>, run.propState.get(p.uid), 0, run.frame).mode;

  it('counts down once stood on, then blasts whoever is close and spares who is not', () => {
    const p = place(crate, CX, LANE);
    const { run } = race([p], 3);
    const [on, near, far] = run.runners;
    standAt(on, CX, LANE - 1);
    standAt(near, CX + 1);
    standAt(far, CX + 3);
    run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(mode(run, p)).toBe('lit');
    const lit = run.frame - 1;
    while (mode(run, p) === 'lit') steps(run, 1);
    expect(run.frame - lit).toBe(COUNT);
    expect(run.events.some((e) => e.type === 'explosion')).toBe(true);
    steps(run, FUSE_BLAST);
    expect(on.alive).toBe(false);
    expect(near.alive).toBe(false);
    expect(far.alive).toBe(true);
    expect(on.killer).toBe(7);
    // It clears no terrain.
    expect(tileAt(run.level, CX, FLOOR)).toBe(1);
  });

  it('a shot sets it off at once, and crates set each other off', () => {
    const a = place(crate, CX, LANE);
    const b = place(crate, CX + 2, LANE);
    const { run, r } = race([a, b]);
    standAt(r, CX + 10);
    run.projectiles.push(makeProjectile({ x: (CX - 3) * TILE, y: (LANE + 0.5) * TILE, vx: 300, vy: 0, owner: 3, ammo: 'bolt' }, run.frame, 99));
    let firstBoom = -1;
    for (let i = 0; i < 30 && firstBoom < 0; i++) {
      run.step([NO_INPUT]);
      if (mode(run, a) === 'gone') firstBoom = run.frame;
    }
    expect(firstBoom).toBeGreaterThan(0);
    expect(mode(run, b)).not.toBe('gone');
    steps(run, 3);
    expect(mode(run, b)).toBe('gone');
  });

  it('a flame jet touching it sets it off', () => {
    const jet = def([
      { type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
      { type: 'flame', at: [0.5, 0.5], angle: 0, length: 4, on: 60, off: 30, warn: 10 },
    ]);
    const p = place(crate, CX, LANE);
    const { run, r } = race([place(jet, CX - 3, LANE), p]);
    standAt(r, CX + 10);
    let gone = false;
    for (let i = 0; i < 120 && !gone; i++) {
      run.step([NO_INPUT]);
      gone = mode(run, p) === 'gone';
    }
    expect(gone).toBe(true);
  });

  it('regrows after its time, but never inside a runner', () => {
    const p = place(crate, CX, LANE);
    const { run, r } = race([p], 2);
    const sitter = run.runners[1];
    standAt(r, CX, LANE - 1);
    standAt(sitter, CX + 12);
    run.step([NO_INPUT, NO_INPUT]);
    while (mode(run, p) !== 'gone') steps(run, 1);
    const gone = run.frame;
    // Park the second runner in its cell as it's due back.
    steps(run, REGROW - 5);
    standAt(sitter, CX);
    steps(run, 20);
    expect(mode(run, p)).toBe('gone');
    expect(sitter.alive).toBe(true);
    standAt(sitter, CX + 12);
    steps(run, 2);
    expect(mode(run, p)).toBe('idle');
    expect(run.frame - gone).toBeGreaterThan(REGROW);
  });

  it('is a block the proof never stands on, and blasts the same twice', () => {
    const level = testLevel();
    const p = place(crate, CX, LANE);
    expect(barrierOf(level, p)).toEqual({ ground: [], noGo: [cellKey(level, CX, LANE)] });
    sameTwice(() => {
      const { run, r } = race([place(crate, CX, LANE)]);
      standAt(r, CX - 4);
      return { run, script: (w, f) => w.step([f < 24 ? RIGHT : f === 24 ? JUMP : NO_INPUT]) };
    }, 260);
  });
});

// --- Y-Fling -----------------------------------------------------------------

const POWER = 600;
const CHARGE = 40;
const STRAIN = 150;
const sling = def([{ type: 'keg', at: [1, 1], dirs: [7], step: 40, power: POWER, delay: 0, burn: STRAIN, aim: 'player', charge: CHARGE, regrow: 200 }], {
  archetype: 'fling',
});
const SX = 20;
const SY = 12;
const pull = (o: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...o });

describe('y-fling', () => {
  const inPouch = (n = 1) => {
    const p = place(sling, SX, SY);
    const { run, r } = race([p], n);
    fly(r, (SX + 1) * TILE, (SY + 1) * TILE);
    run.step(run.runners.map(() => NO_INPUT));
    expect(r.attach.grip).not.toBeNull();
    expect(r.attach.grip!.sealed).toBe(false);
    return { run, r, p };
  };
  const fire = (run: RunWorld, r: Runner, hold: InputFrame, frames: number) => {
    steps(run, frames, hold);
    run.step([{ ...hold, jump: true, jumpPressed: true }]);
    expect(r.attach.grip).toBeNull();
    return [r.body.vx, r.body.vy] as Vec;
  };

  it('fires the opposite way to the pull', () => {
    for (const [hold, want] of [
      [pull({ left: true, down: true }), 7],
      [pull({ right: true }), 4],
      [pull({ down: true }), 6],
      [pull({ right: true, up: true }), 3],
    ] as const) {
      const { run, r } = inPouch();
      const [vx, vy] = fire(run, r, hold, CHARGE);
      const n = Math.hypot(vx, vy);
      expect(vx / n).toBeCloseTo(COMPASS[want][0], 5);
      expect(vy / n).toBeCloseTo(COMPASS[want][1], 5);
    }
  });

  it('goes harder the longer you pull, up to its power', () => {
    const speed = (frames: number) => {
      const { run, r } = inPouch();
      return Math.hypot(...fire(run, r, pull({ left: true, down: true }), frames));
    };
    const flick = speed(0);
    const half = speed(CHARGE / 2);
    const full = speed(CHARGE);
    // The pull builds on the frame you fire, too: a flick is one frame of pull.
    expect(flick).toBeCloseTo(flingSpeed(sling.modules[0] as ModuleOf<'keg'>, 1), 3);
    expect(flick).toBeLessThan(POWER * (FLING.flick + 0.05));
    expect(half).toBeGreaterThan(flick);
    expect(full).toBeGreaterThan(half);
    expect(full).toBeCloseTo(POWER, 3);
    expect(speed(CHARGE * 2)).toBeCloseTo(POWER, 3);
    expect(flingSpeed(sling.modules[0] as ModuleOf<'keg'>, CHARGE)).toBe(POWER);
  });

  it('snaps if you hang on too long, drops you, and grows back', () => {
    const { run, r, p } = inPouch();
    steps(run, STRAIN - 3, pull({ left: true }));
    expect(r.attach.grip).not.toBeNull();
    steps(run, 4, pull({ left: true }));
    expect(r.attach.grip).toBeNull();
    expect(Math.abs(r.body.vx)).toBeLessThan(1);
    const back = flingBack(run.propState.get(p.uid), 0);
    expect(back).toBeGreaterThan(run.frame + 150);
    // Snapped, it won't take you back even once you're clear of the cooldown and come in fresh.
    steps(run, REGRAB + 2);
    fly(r, (SX + 6) * TILE, (SY + 1) * TILE);
    steps(run, 2);
    fly(r, (SX + 1) * TILE, (SY + 1) * TILE);
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
    while (run.frame < back) steps(run, 1);
    fly(r, (SX + 6) * TILE, (SY + 1) * TILE);
    steps(run, 2);
    fly(r, (SX + 1) * TILE, (SY + 1) * TILE);
    steps(run, 1);
    expect(r.attach.grip).not.toBeNull();
  });

  it('keeps the grab rules: one runner at a time, a cooldown after, and a shove lets go', () => {
    const { run, r } = inPouch(2);
    const other = run.runners[1];
    fly(other, (SX + 1) * TILE, (SY + 1) * TILE);
    steps(run, 3);
    expect(other.attach.grip).toBeNull();
    fire(run, r, pull({ down: true }), 4);
    // Fired straight up out of the pouch: the cooldown keeps it from catching you on the way back through.
    expect(r.attach.cd).toBeGreaterThan(0);
    const { run: run2, r: r2 } = inPouch();
    steps(run2, 5);
    r2.body.vx = 300;
    steps(run2, 1);
    expect(r2.attach.grip).toBeNull();
  });

  it('is off the proof route, and flings the same twice', () => {
    const level = testLevel();
    expect(barrierOf(level, place(sling, SX, SY)).noGo.length).toBeGreaterThan(0);
    sameTwice(() => {
      const { run, r } = race([place(sling, SX, SY)]);
      fly(r, (SX + 1) * TILE, (SY + 1) * TILE);
      return { run, script: (w, f) => w.step([f < 30 ? pull({ left: true, down: true }) : f === 30 ? JUMP : NO_INPUT]) };
    }, 120);
  });
});
