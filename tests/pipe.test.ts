import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells } from '../src/core/geom';
import { Match } from '../src/game/match';
import { restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  detonate,
  dirOf,
  linkPipes,
  lonePipe,
  type Module,
  moduleSim,
  mouthPose,
  PIPE,
  pipePairs,
  type PlacedProp,
  type PropDef,
  resolveProp,
} from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20;

/** Flat floor from FLOOR down, nothing else. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
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

/** A two-tile pipe, mouth up at rot 0. */
function pipeDef(len = 2): PropDef {
  const cells: Cell[] = [];
  for (let y = 0; y < len; y++) cells.push([0, y], [1, y]);
  const modules: Module[] = [{ type: 'pipe', cells, at: [1, 0], angle: (3 * Math.PI) / 2, look: 'green' }];
  return {
    key: 'pipe',
    name: 'pipe',
    maker: '',
    archetype: 'pipe',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
    motion: { type: 'none' },
    modules,
    footprint: normalizeCells(moduleSim('pipe').anchors(modules[0])),
  };
}

let uid = 1;
const place = (tx: number, ty: number, rot = 0): PlacedProp => ({ uid: uid++, def: pipeDef(), owner: 0, tx, ty, rot });
const mouth = (pp: PlacedProp) => {
  const m = resolveProp(pp).mods[0];
  if (m.type !== 'pipe') throw new Error('not a pipe');
  return m;
};

function race(level: Level, props: PlacedProp[], runners = 1): { run: RunWorld; r: Runner } {
  linkPipes(props);
  const run = new RunWorld(
    level,
    props,
    Array.from({ length: runners }, (_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  return { run, r: run.runners[0] };
}

/** Put the runner right at a pipe's mouth, as if it had walked or jumped there. */
function atMouth(r: Runner, pp: PlacedProp) {
  const q = mouthPose(mouth(pp), r.body);
  Object.assign(r.body, { x: q.x, y: q.y, vx: 0, vy: 0 });
  r.body.onGround = dirOf(mouth(pp).angle)[1] < 0;
}

/** The input that asks to go into this pipe. */
function inputFor(pp: PlacedProp): InputFrame {
  const [dx, dy] = dirOf(mouth(pp).angle);
  if (dy < 0) return { ...NO_INPUT, down: true };
  if (dy > 0) return { ...NO_INPUT, up: true };
  return dx > 0 ? { ...NO_INPUT, left: true } : { ...NO_INPUT, right: true };
}

const center = (r: Runner) => [r.body.x + r.body.w / 2, r.body.y + r.body.h / 2];
const TRIP = PIPE.in + PIPE.out + 2;

describe('a warp pipe', () => {
  it('alone is a solid block you stand on, and down does nothing', () => {
    const a = place(10, FLOOR - 2);
    const { run, r } = race(testLevel(), [a]);
    atMouth(r, a);
    const x0 = r.body.x;
    for (let i = 0; i < TRIP * 2; i++) run.step([{ ...NO_INPUT, down: true }]);
    expect(r.attach.grip).toBeNull();
    expect(r.body.onGround).toBe(true);
    expect(r.body.y + r.body.h).toBeCloseTo(mouth(a).at[1], 3);
    expect(r.body.x).toBeCloseTo(x0, 3);
  });

  it('links with a second one, and down on the mouth carries you out of the other', () => {
    const a = place(10, FLOOR - 2);
    const b = place(26, FLOOR - 2);
    const { run, r } = race(testLevel(), [a, b]);
    expect(a.link).toBe(b.uid);
    expect(b.link).toBe(a.uid);
    atMouth(r, a);
    run.step([{ ...NO_INPUT, down: true }]);
    expect(r.attach.grip?.uid).toBe(a.uid);
    let out = -1;
    for (let i = 0; i < TRIP && out < 0; i++) {
      run.step([NO_INPUT]);
      if (!r.attach.grip) out = i;
    }
    expect(out).toBeGreaterThan(0);
    // Out of b's mouth, facing up, with a hop.
    const [cx] = center(r);
    expect(Math.abs(cx - mouth(b).at[0])).toBeLessThan(2);
    expect(r.body.y + r.body.h).toBeLessThanOrEqual(mouth(b).at[1] + 0.01);
    expect(r.body.vy).toBeLessThan(0);
  });

  it('works whichever way the mouth faces', () => {
    for (let rot = 0; rot < 4; rot++) {
      // Floor-level for the sideways mouths, up in the air for the one facing down.
      const a = place(10, rot === 2 ? FLOOR - 6 : FLOOR - 2, rot);
      const b = place(26, FLOOR - 2);
      const { run, r } = race(testLevel(), [a, b]);
      atMouth(r, a);
      if (rot % 2) r.body.y = FLOOR * TILE - r.body.h; // on the floor beside it
      run.step([inputFor(a)]);
      expect(r.attach.grip?.uid, `rot ${rot}`).toBe(a.uid);
      for (let i = 0; i < TRIP; i++) run.step([NO_INPUT]);
      expect(Math.abs(center(r)[0] - mouth(b).at[0]), `rot ${rot}`).toBeLessThan(2);
    }
  });

  it('spits you back out of the near mouth when the far one is blocked', () => {
    const level = testLevel();
    const a = place(10, FLOOR - 2);
    const b = place(26, FLOOR - 2);
    const { run, r } = race(level, [a, b]);
    level.tiles[(FLOOR - 3) * LEVEL_W + 26] = 1;
    level.tiles[(FLOOR - 3) * LEVEL_W + 27] = 1;
    atMouth(r, a);
    run.step([{ ...NO_INPUT, down: true }]);
    for (let i = 0; i < TRIP; i++) run.step([NO_INPUT]);
    expect(Math.abs(center(r)[0] - mouth(a).at[0])).toBeLessThan(2);
  });

  it('is the same trip on two identical runs', () => {
    const go = () => {
      uid = 100;
      const a = place(10, FLOOR - 2);
      const b = place(26, FLOOR - 2, 1);
      const { run } = race(testLevel(), [a, b], 2);
      atMouth(run.runners[0], a);
      atMouth(run.runners[1], b);
      run.runners[1].body.y = FLOOR * TILE - run.runners[1].body.h;
      const trace: number[] = [];
      for (let f = 0; f < 120; f++) {
        run.step([f < 30 ? { ...NO_INPUT, down: true } : { ...NO_INPUT, right: true }, inputFor(b)]);
        for (const r of run.runners) trace.push(r.body.x, r.body.y, r.body.vx, r.body.vy, r.attach.grip?.t ?? -1);
      }
      return trace;
    };
    const one = go();
    expect(one).toEqual(go());
    expect(one.some((v, i) => i % 5 === 4 && v > 0)).toBe(true);
  });
});

describe('pipe pairs', () => {
  it('a third pipe waits, and a fourth links to it', () => {
    const [a, b, c] = [place(5, 5), place(9, 5), place(13, 5)];
    linkPipes([a, b, c]);
    expect([a.link, b.link, c.link]).toEqual([b.uid, a.uid, undefined]);
    expect(lonePipe([a, b, c])).toBe(c);
    const d = place(17, 5);
    linkPipes([a, b, c, d]);
    expect([c.link, d.link]).toEqual([d.uid, c.uid]);
    expect(a.link).toBe(b.uid);
    expect(pipePairs([a, b, c, d])).toEqual(
      new Map([
        [a.uid, 1],
        [b.uid, 1],
        [c.uid, 2],
        [d.uid, 2],
      ]),
    );
  });

  it('a bomb unlinks a pair, and the one left pairs with the next lone pipe', () => {
    const level = testLevel();
    const [a, b, c] = [place(5, 10), place(20, 10), place(35, 10)];
    linkPipes([a, b, c]);
    const left = detonate(level, [a, b, c], 1, 5, 10);
    expect(left).toEqual([b, c]);
    linkPipes(left);
    expect([b.link, c.link]).toEqual([c.uid, b.uid]);
  });

  it('a pipe whose partner was blown up stops working, through the match', () => {
    const m = new Match(7);
    const a = place(10, FLOOR - 2);
    const b = place(26, FLOOR - 2);
    linkPipes([a, b]);
    const bomb: PlacedProp = {
      uid: uid++,
      def: { ...pipeDef(), archetype: 'timebomb', role: 'demolish', modules: [{ type: 'bomb', radius: 1, delay: true }], footprint: [[0, 0]] },
      owner: 0,
      tx: 26,
      ty: FLOOR - 2,
      rot: 0,
    };
    m.placed = [a, b, bomb];
    m.startRun();
    expect(m.placed).toEqual([a]);
    expect(a.link).toBeUndefined();
    expect(lonePipe(m.placed)).toBe(a);
  });

  it('links ride in a snapshot', () => {
    const m = new Match(7);
    const [a, b, c] = [place(10, 5), place(20, 5), place(30, 5)];
    m.placed = [a, b, c];
    linkPipes(m.placed);
    const copy = new Match(7);
    restoreMatch(copy, snapshotMatch(m));
    expect(copy.placed.map((p) => p.link)).toEqual([b.uid, a.uid, undefined]);
  });
});
