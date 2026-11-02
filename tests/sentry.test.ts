import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generatePart } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { barrierOf, MIN_OPENING, type Module, type ModuleOf, moduleSim, type PlacedProp, type PropDef, sentryFiring, sentryMode } from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

const FLOOR = 20;
const LANE = FLOOR - 1;
const AT = 10;

function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: LANE },
    goal: { tx: LEVEL_W - 3, ty: LANE },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const GUN: ModuleOf<'sentry'> = {
  type: 'sentry',
  at: [0.5, 0.5],
  angle: 0,
  cone: 1.2,
  sweepPeriod: 240,
  range: 8,
  turn: 0.035,
  spin: 30,
  burst: 4,
  gap: 5,
  cool: 90,
  speed: 420,
  ammo: 'slug',
};

function def(modules: Module[]): PropDef {
  const cells = new Map<string, Cell>();
  for (const m of modules) for (const c of moduleSim(m.type).anchors(m)) cells.set(`${c[0]},${c[1]}`, c);
  return {
    key: 'test',
    name: 'test',
    maker: '',
    archetype: 'sentry',
    role: 'hazard',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
    motion: { type: 'none' },
    modules,
    footprint: normalizeCells([...cells.values()]),
  };
}

const body = (): Module => ({ type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
const sentry = (m: Partial<ModuleOf<'sentry'>> = {}) => def([body(), { ...GUN, ...m }]);
const block = def([body()]);
let uid = 1;
const place = (d: PropDef, tx: number, ty: number, owner = 7, rot = 0): PlacedProp => ({ uid: uid++, def: d, owner, tx, ty, rot });

function race(props: PlacedProp[], level = testLevel()) {
  const run = new RunWorld(level, props, [0]);
  run.frame = RUN_COUNTDOWN;
  return { run, r: run.runners[0] };
}

function standAt(r: Runner, tx: number, ty = LANE) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = (ty + 1) * TILE - r.body.h;
  r.body.vx = 0;
  r.body.vy = 0;
}

const step = (run: RunWorld) => run.step([NO_INPUT]);
const modeOf = (run: RunWorld, p: PlacedProp) => sentryMode(run.propState.get(p.uid)!, 1);
const aimOf = (run: RunWorld, p: PlacedProp) => run.propState.get(p.uid)!.aim.get(1) ?? 0;

/** Frames on which it fired, over `n` frames. */
function shots(run: RunWorld, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const before = run.events.length;
    step(run);
    if (run.events.slice(before).some((e) => e.type === 'fire')) out.push(run.frame - 1);
  }
  return out;
}

describe('sentry', () => {
  it('sweeps its cone and holds fire with nobody in range', () => {
    const p = place(sentry(), AT, LANE);
    const { run, r } = race([p]);
    standAt(r, AT + 12); // 12 tiles: past its range of 8
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      step(run);
      expect(modeOf(run, p).mode).toBe('wait');
      seen.add(Math.round(aimOf(run, p) * 10));
      expect(Math.abs(aimOf(run, p))).toBeLessThanOrEqual(GUN.cone + 1e-9);
    }
    expect(run.projectiles).toHaveLength(0);
    expect(run.events.some((e) => e.type === 'fire')).toBe(false);
    expect(seen.size).toBeGreaterThan(10);
  });

  it('turns no faster than its turn rate', () => {
    const p = place(sentry(), AT, LANE);
    const { run, r } = race([p]);
    // Start it facing the far edge of its cone, then show it someone straight ahead.
    run.propState.get(p.uid)!.aim.set(1, -GUN.cone);
    standAt(r, AT + 6);
    let prev = aimOf(run, p);
    let on = -1;
    for (let i = 0; i < 60; i++) {
      step(run);
      const a = aimOf(run, p);
      expect(Math.abs(a - prev)).toBeLessThanOrEqual(GUN.turn + 1e-9);
      if (on < 0 && Math.abs(a) < 0.05) on = i + 1;
      prev = a;
    }
    expect(on).toBeGreaterThanOrEqual(Math.floor((GUN.cone - 0.05) / GUN.turn));
  });

  it('beeps, then waits out its spin-up before the first round', () => {
    const p = place(sentry(), AT, LANE);
    const { run, r } = race([p]);
    standAt(r, AT + 6);
    step(run);
    expect(modeOf(run, p).mode).toBe('lock');
    const locked = modeOf(run, p).since;
    expect(run.events.some((e) => e.type === 'prop' && e.kind === 'sentry-lock')).toBe(true);
    const fired = shots(run, 60);
    expect(fired[0] - locked).toBe(GUN.spin);
  });

  it('holds fire at a runner it cannot see', () => {
    const p = place(sentry(), AT, LANE);
    const { run, r } = race([p, place(block, AT + 3, LANE), place(block, AT + 3, LANE - 1)]);
    standAt(r, AT + 6);
    expect(shots(run, 200)).toEqual([]);
    expect(modeOf(run, p).mode).toBe('wait');
    expect(r.alive).toBe(true);
  });

  it('kills a runner in its sights and credits its owner', () => {
    const p = place(sentry(), AT, LANE, 3);
    const { run, r } = race([p]);
    standAt(r, AT + 6);
    for (let i = 0; i < 120 && r.alive; i++) step(run);
    expect(r.alive).toBe(false);
    expect(r.killer).toBe(3);
  });

  it('its rounds stop at a wall', () => {
    const p = place(sentry(), AT, LANE);
    const level = testLevel();
    const { run, r } = race([p], level);
    standAt(r, AT + 7);
    for (let i = 0; i < 100 && run.projectiles.length === 0; i++) step(run);
    expect(run.projectiles).toHaveLength(1);
    // Mid-burst a wall goes up between them: the burst carries on, and every round ends on it.
    const wall = AT + 3;
    for (let y = LANE - 3; y <= LANE; y++) level.tiles[y * level.w + wall] = 1;
    for (let i = 0; i < 60; i++) {
      step(run);
      for (const s of run.projectiles) expect(s.x).toBeLessThan(wall * TILE + 2);
    }
    expect(run.events.filter((e) => e.type === 'fire')).toHaveLength(GUN.burst);
    expect(r.alive).toBe(true);
  });

  it('cools down after a burst, longer than the opening a route needs', () => {
    const p = place(sentry(), AT, LANE);
    // The runner stands in a safe zone, so the rounds pop on it and it stays a target burst after burst.
    const level = { ...testLevel(), spawn: { tx: AT + 6, ty: LANE }, protectedRects: [{ x: AT + 5, y: LANE - 2, w: 3, h: 3 }] };
    const { run, r } = race([p], level);
    standAt(r, AT + 6);
    const fired: number[] = [];
    for (let i = 0; i < 400; i++) {
      const before = run.events.length;
      step(run);
      if (run.events.slice(before).some((e) => e.type === 'fire')) fired.push(run.frame - 1);
      if (fired.length === GUN.burst && run.frame - 1 === fired[GUN.burst - 1]) expect(modeOf(run, p).mode).toBe('cool');
    }
    expect(r.alive).toBe(true);
    const gaps = fired.slice(1).map((f, i) => f - fired[i]);
    const lulls = gaps.filter((g) => g > GUN.gap);
    expect(lulls.length).toBeGreaterThan(1);
    for (const g of lulls) expect(g).toBe(GUN.cool + GUN.spin);
    for (const g of lulls) expect(g).toBeGreaterThan(MIN_OPENING);
  });

  it('is deterministic', () => {
    const go = () => {
      // Facing left from a ledge across the runners' way: they run at it and get shot at.
      const p: PlacedProp = { uid: 40, def: sentry(), owner: 5, tx: 26, ty: LANE - 2, rot: 2 };
      const run = new RunWorld(testLevel(), [p], [0, 1]);
      const inputs = [
        { ...NO_INPUT, right: true },
        { ...NO_INPUT, right: true, run: true, jump: true, jumpPressed: true },
      ];
      for (let f = 0; f < RUN_COUNTDOWN + 300; f++) run.step(inputs);
      const st = run.propState.get(p.uid)!;
      expect(run.events.filter((e) => e.type === 'fire').length).toBeGreaterThan(0);
      return JSON.stringify({ r: run.runners, p: run.projectiles, k: run.kills, aim: [...st.aim], vars: [...st.vars] });
    };
    expect(go()).toEqual(go());
  });
});

describe('generated sentries', () => {
  it('always leave a lull between bursts, scale only their range, and stay out of the barrier', () => {
    for (let i = 0; i < 20; i++) {
      const part = generatePart(new Rng(i), 'sentry', 's');
      const mods = part.variants.map((v) => v.modules.find((m) => m.type === 'sentry') as ModuleOf<'sentry'>);
      expect(new Set(mods.map((m) => m.range)).size).toBe(3);
      for (const m of mods) {
        expect(m.cool + m.spin - (sentryFiring(m) - m.spin)).toBeGreaterThan(MIN_OPENING);
        expect(m.turn * 60).toBeLessThan(Math.PI); // slower than half a turn a second: a close runner outruns it
      }
      // Its rounds are projectiles, which a route dodges by timing: only its own block is in the barrier.
      const pp = place(part.variants[1], AT, LANE);
      const b = barrierOf(testLevel(), pp);
      expect(b.noGo).toEqual([]);
      expect(b.ground).toEqual([LANE * LEVEL_W + AT]);
    }
  });
});
