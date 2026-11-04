import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generatePart } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { geyserCycle, type ModuleOf, type PlacedProp, type PropDef, resolveProp } from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/** The fire hydrant (gen/props.ts `hydrant`): a plug you stand on whose outlet rattles, then jets water that shoves. */

const FLOOR = 20;
const LANE = FLOOR - 1;
const HX = 20;

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
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 5 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/** The medium card of the first seed's hydrant that matches `twin` (both side caps off or one). */
function hydrant(twin: boolean): PropDef {
  for (let s = 1; ; s++) {
    const part = generatePart(new Rng(s), 'hydrant', 'hydrant');
    const d = part.variants.find((v) => v.size === 'medium')!;
    if (d.modules.filter((m) => m.type === 'geyser').length === (twin ? 2 : 1)) return d;
  }
}

let uid = 1;
function race(d: PropDef, rot = 0, n = 2) {
  const pp: PlacedProp = { uid: uid++, def: d, owner: 7, tx: HX, ty: LANE, rot };
  const run = new RunWorld(
    testLevel(),
    [pp],
    Array.from({ length: n }, (_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  return { run, pp };
}

function standAt(r: Runner, tx: number, ty = LANE) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = (ty + 1) * TILE - r.body.h;
  r.body.vx = 0;
  r.body.vy = 0;
  r.body.onGround = true;
}

/** The segment the jet is in at the run's frame: 0 dormant, 1 rattling, 2 blasting. */
function seg(run: RunWorld, pp: PlacedProp): number {
  const jet = pp.def.modules.find((m) => m.type === 'geyser') as ModuleOf<'geyser'>;
  return geyserCycle(jet, run.frame, resolveProp(pp).phase).seg;
}

/** Step until the jet reaches `want`, at most a cycle and a half. */
function until(run: RunWorld, pp: PlacedProp, want: number, each?: () => void) {
  for (let i = 0; i < 600 && seg(run, pp) !== want; i++) {
    each?.();
    run.step(run.runners.map(() => NO_INPUT));
  }
  expect(seg(run, pp)).toBe(want);
}

describe('fire hydrant', () => {
  it('is one tile you can stand on, and rolls as a utility part', () => {
    const d = hydrant(false);
    expect(d.footprint).toEqual([[0, 0]]);
    expect(d.role).toBe('utility');
    const { run } = race(d);
    const r = run.runners[0];
    r.body.x = HX * TILE + (TILE - r.body.w) / 2;
    r.body.y = (LANE - 3) * TILE;
    for (let i = 0; i < 60; i++) run.step(run.runners.map(() => NO_INPUT));
    expect(r.body.onGround).toBe(true);
    expect(r.body.y + r.body.h).toBeCloseTo(LANE * TILE, 0);
  });

  it('shoves whoever stands in front of its outlet while it blasts, and nobody while it waits or behind it', () => {
    const { run, pp } = race(hydrant(false));
    const [front, behind] = run.runners;
    const place = () => {
      standAt(front, HX + 2);
      standAt(behind, HX - 2);
    };
    until(run, pp, 0, place);
    // Dormant and rattling: still air.
    until(run, pp, 2, () => {
      place();
      run.step(run.runners.map(() => NO_INPUT));
      expect(Math.abs(front.body.vx)).toBeLessThan(1);
    });
    place();
    for (let i = 0; i < 20; i++) run.step(run.runners.map(() => NO_INPUT));
    expect(front.body.vx).toBeGreaterThan(60);
    expect(front.body.x).toBeGreaterThan((HX + 2.5) * TILE);
    expect(Math.abs(behind.body.vx)).toBeLessThan(1);
  });

  it('with both caps off, shoves both ways', () => {
    const { run, pp } = race(hydrant(true));
    const [right, left] = run.runners;
    until(run, pp, 2, () => {
      standAt(right, HX + 2);
      standAt(left, HX - 2);
    });
    for (let i = 0; i < 20; i++) run.step(run.runners.map(() => NO_INPUT));
    expect(right.body.vx).toBeGreaterThan(60);
    expect(left.body.vx).toBeLessThan(-60);
  });

  it('turned to jet up, lifts whoever stands on it', () => {
    // Rotation 3 turns the outlet from facing right to facing up.
    const { run, pp } = race(hydrant(false), 3, 1);
    const r = run.runners[0];
    until(run, pp, 2, () => standAt(r, HX, LANE - 1));
    const top = r.body.y;
    for (let i = 0; i < 20; i++) run.step([NO_INPUT]);
    expect(r.body.y).toBeLessThan(top - TILE);
  });

  it('blasts the same twice', () => {
    const go = () => {
      uid = 900;
      const { run } = race(hydrant(true));
      standAt(run.runners[0], HX + 2);
      standAt(run.runners[1], HX - 3);
      const out: number[] = [];
      for (let f = 0; f < 400; f++) {
        run.step(run.runners.map(() => NO_INPUT));
        for (const r of run.runners) out.push(r.body.x, r.body.y, r.body.vx, r.body.vy);
      }
      return out;
    };
    expect(go()).toEqual(go());
  });
});
