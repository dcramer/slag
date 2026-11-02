import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells, type Rect } from '../src/core/geom';
import { Match } from '../src/game/match';
import { restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  barrierOf,
  canPlace,
  detonate,
  dirOf,
  linkPipes,
  lonePipe,
  type Module,
  moduleSim,
  mouthPose,
  PIPE,
  pipePairs,
  pipeBands,
  pipeHalfWidth,
  pipeRects,
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

describe('a pipe you just came out of', () => {
  it('needs down let go and pressed again before it takes you back in', () => {
    const a = place(10, FLOOR - 2);
    const b = place(26, FLOOR - 2);
    const { run, r } = race(testLevel(), [a, b]);
    atMouth(r, a);
    const down = { ...NO_INPUT, down: true };
    run.step([down]);
    // Hold down the whole way: out of b with a hop, and back down onto b's mouth.
    for (let i = 0; i < TRIP + 60; i++) run.step([down]);
    expect(r.attach.grip).toBeNull();
    expect(r.body.onGround).toBe(true);
    expect(Math.abs(center(r)[0] - mouth(b).at[0])).toBeLessThan(2);
    run.step([NO_INPUT]);
    run.step([down]);
    expect(r.attach.grip?.uid).toBe(b.uid);
  });
});

/** The smallest rect round some rects. */
function hull(rs: readonly Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

describe('the pipe shape', () => {
  it('is a rolled lip two tiles across over a shaft a quarter tile in from each side', () => {
    const { lip, shaft } = pipeRects(mouth(place(10, FLOOR - 3, 0)));
    expect(hull(lip)).toEqual({ x: 160, y: (FLOOR - 3) * TILE, w: 32, h: PIPE.lip });
    expect(hull(shaft)).toEqual({ x: 164, y: (FLOOR - 3) * TILE + PIPE.lip, w: 24, h: 2 * TILE - PIPE.lip });
    for (let rot = 0; rot < 4; rot++) {
      const r = pipeRects(mouth(place(10, 5, rot)));
      const all = hull([...r.lip, ...r.shaft]);
      expect([all.w, all.h]).toEqual([32, 32]);
      expect(all.x % TILE).toBe(0);
      expect(all.y % TILE).toBe(0);
    }
  });

  it('steps its solids to follow the round corners within about a pixel', () => {
    for (const len of [2, 3, 4].map((n) => n * TILE)) {
      for (const b of pipeBands(len)) {
        for (let v = b.v0; v <= b.v1; v += 0.05) expect(Math.abs(pipeHalfWidth(v, len) - b.hw), `${len} ${v}`).toBeLessThanOrEqual(1.1);
      }
      // Really round: the rim's corner comes in a full roll radius, the shaft's foot its own.
      expect(pipeHalfWidth(0, len)).toBeCloseTo(TILE - PIPE.roll, 6);
      expect(pipeHalfWidth(PIPE.lip / 2, len)).toBe(TILE);
      expect(pipeHalfWidth(len, len)).toBeCloseTo(TILE - PIPE.overhang - PIPE.foot, 6);
    }
  });

  it('still takes its whole footprint for placing and for the winnability proof', () => {
    const level = testLevel();
    const a = place(10, FLOOR - 2);
    const block = {
      ...pipeDef(),
      modules: [{ type: 'body', cells: [[0, 0]], material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 }],
      footprint: [[0, 0]],
    } as PropDef;
    for (const [x, y] of [
      [10, FLOOR - 1],
      [11, FLOOR - 1],
    ])
      expect(canPlace(level, [a], block, 0, x, y)).toBe(false);
    const noGo = barrierOf(level, a).noGo;
    for (const [x, y] of [
      [10, FLOOR - 2],
      [11, FLOOR - 2],
      [10, FLOOR - 1],
      [11, FLOOR - 1],
    ])
      expect(noGo).toContain(y * level.w + x);
  });

  it('is solid to stand on anywhere along the rolled lip, its round ends included', () => {
    const a = place(10, FLOOR - 2);
    const top = mouth(a).at[1];
    const len = 2 * TILE;
    /** How far below the mouth the drawn rim's top is at this distance from its center. */
    const dip = (u: number) => {
      let v = 0;
      while (v < PIPE.lip && pipeHalfWidth(v, len) < Math.abs(u)) v += 0.05;
      return v;
    };
    for (const x of [151, 154, 158, 166, 171, 180, 186, 190]) {
      const { run, r } = race(testLevel(), [a]);
      Object.assign(r.body, { x, y: top - r.body.h - 6, vx: 0, vy: 0 });
      for (let i = 0; i < 40; i++) run.step([NO_INPUT]);
      // The highest point of the drawn rim under the runner is where it stands, within a pixel.
      let best = Infinity;
      for (let px = Math.max(160, x); px <= Math.min(192, x + r.body.w); px += 0.25) best = Math.min(best, dip(px - 176));
      expect(r.body.onGround, `x ${x}`).toBe(true);
      expect(Math.abs(r.body.y + r.body.h - (top + best)), `x ${x}`).toBeLessThanOrEqual(1.1);
      expect(r.body.x, `x ${x}`).toBeCloseTo(x, 6);
    }
  });

  it('lets you jump up round the lip from beside the shaft and onto it', () => {
    const a = place(10, FLOOR - 2);
    const { run, r } = race(testLevel(), [a]);
    Object.assign(r.body, { x: 164 - r.body.w, y: FLOOR * TILE - r.body.h, vx: 0, vy: 0 });
    for (let i = 0; i < 70; i++) run.step([{ ...NO_INPUT, right: i < 18, jump: true, jumpPressed: i === 0 }]);
    expect(r.body.onGround).toBe(true);
    expect(r.body.y + r.body.h).toBeCloseTo(mouth(a).at[1], 3);
  });

  it('never snags a runner coming at the round corner low: the steps climb', () => {
    const a = place(10, FLOOR - 2);
    const top = mouth(a).at[1];
    for (let below = 0; below <= PIPE.overhang; below += 0.5) {
      const { run, r } = race(testLevel(), [a]);
      Object.assign(r.body, { x: 160 - r.body.w - 1, y: top + below - r.body.h, vx: 100, vy: 0 });
      r.body.onGround = false;
      // Coming in at walking pace at the lip's height, held level: the steps lift, none of them stops you.
      let stuck = 0;
      for (let i = 0; i < 14; i++) {
        const x0 = r.body.x;
        r.body.vy = 0;
        run.step([{ ...NO_INPUT, right: true }]);
        if (r.body.x <= x0 && r.body.x + r.body.w <= 160.5) stuck++;
      }
      expect(stuck, `${below} px below the top`).toBe(0);
      expect(r.body.x, `${below} px below the top`).toBeGreaterThan(160);
      expect(r.body.y + r.body.h, `${below} px below the top`).toBeLessThanOrEqual(top + 0.5);
    }
  });

  it('walks over a sideways lip without a jump', () => {
    const a = place(10, FLOOR - 2, 1);
    expect(dirOf(mouth(a).angle)).toEqual([1, 0]);
    const { run, r } = race(testLevel(), [a]);
    const top = hull(pipeRects(mouth(a)).shaft).y;
    Object.assign(r.body, { x: 162, y: top - r.body.h, vx: 0, vy: 0 });
    for (let i = 0; i < 40; i++) run.step([{ ...NO_INPUT, right: true }]);
    expect(r.body.x).toBeGreaterThan(mouth(a).at[0]);
  });

  it('can be stood on at the far end and on the lip, and walked off both', () => {
    const a = place(10, FLOOR - 6, 2);
    const { run, r } = race(testLevel(), [a, place(30, FLOOR - 2)], 2);
    const { lip, shaft } = pipeRects(mouth(a));
    const lipTop = hull(lip).y;
    const shaftTop = hull(shaft).y;
    const r2 = run.runners[1];
    Object.assign(r.body, { x: 176 - r.body.w / 2, y: shaftTop - r.body.h - 4, vx: 0, vy: 0 });
    Object.assign(r2.body, { x: 154, y: shaftTop, vx: 0, vy: 0 });
    for (let i = 0; i < 30; i++) run.step([NO_INPUT, NO_INPUT]);
    expect(r.body.onGround && r.body.y + r.body.h).toBeCloseTo(shaftTop, 3);
    expect(r2.body.onGround && r2.body.y + r2.body.h).toBeCloseTo(lipTop, 3);
    for (let i = 0; i < 40; i++)
      run.step([
        { ...NO_INPUT, right: true },
        { ...NO_INPUT, left: true },
      ]);
    expect(r.body.y).toBeGreaterThan(lipTop);
    expect(r2.body.y + r2.body.h).toBeCloseTo(FLOOR * TILE, 3);
  });
});
