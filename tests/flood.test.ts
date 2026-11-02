import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import type { Theme } from '../src/gen/theme';
import { capFlood } from '../src/gen/stage/flood';
import { LEVEL_H, LEVEL_W, PLAYER_H, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { type Level, T_SOLID } from '../src/sim/level';
import {
  barrierOf,
  FLOOD_FALL,
  FLOOD_HOLD,
  FLOOD_OFF,
  FLOOD_RISE,
  FLOOD_WARN,
  type FloodLook,
  floodState,
  type ModuleOf,
  moduleSim,
  type PlacedProp,
  resolveProp,
} from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

type Flood = ModuleOf<'flood'>;

/** The basin's floor row: ground from here down. */
const FLOOR = 20;
/** Basin columns. */
const X0 = 16;
const W = 12;

/** Flat floor with two ledges in the basin: one 2 tiles up, one 5. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = T_SOLID;
  tiles[(FLOOR - 2) * LEVEL_W + 20] = T_SOLID;
  tiles[(FLOOR - 5) * LEVEL_W + 24] = T_SOLID;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'volcano'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

function flood(look: FloodLook, o: Partial<Flood> = {}): Flood {
  return { type: 'flood', look, at: [X0, FLOOR], w: W, low: 1, high: 4, off: 120, warn: 60, rise: 90, hold: 200, fall: 90, ...o };
}

function piece(m: Flood, uid = 900): PlacedProp {
  return {
    uid,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'flood',
      name: 'flood',
      maker: 'the level',
      archetype: 'flamer',
      role: 'hazard',
      style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
      motion: { type: 'none' },
      modules: [m],
      footprint: moduleSim('flood').anchors(m),
    },
  };
}

/** A race on `level` with the flood as its set piece and one runner per stand cell (tx, top of the tile it stands on). */
function race(m: Flood, stands: [number, number][], level = testLevel()) {
  const pp = piece(m);
  level.setPieces = [pp];
  const run = new RunWorld(
    level,
    [],
    stands.map((_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  stands.forEach(([tx, ty], i) => standAt(run.runners[i], tx, ty));
  const r = resolveProp(pp);
  return { run, fm: r.mods[0] as Flood, phase: r.phase };
}

function standAt(r: Runner, tx: number, ty: number) {
  r.body.x = tx * TILE + (TILE - r.body.w) / 2;
  r.body.y = ty * TILE - r.body.h;
  r.body.vx = r.body.vy = 0;
}

const total = (m: Flood) => m.off + m.warn + m.rise + m.hold + m.fall;
const idle = (n: number) => Array.from({ length: n }, () => NO_INPUT);

describe('flood cycle', () => {
  it('waits at low through off and warn, rises, holds at high and falls back', () => {
    const m = resolveProp(piece(flood('lava'))).mods[0] as Flood;
    let last = -1;
    let prev = floodState(m, 0, 0);
    const seen = new Set<number>();
    for (let f = 0; f <= total(m); f++) {
      const s = floodState(m, f, 0);
      seen.add(s.seg);
      if (s.seg === FLOOD_OFF || s.seg === FLOOD_WARN) expect(s.height).toBe(m.low);
      if (s.seg === FLOOD_HOLD) expect(s.height).toBe(m.high);
      if (s.seg === FLOOD_RISE && prev.seg === FLOOD_RISE) expect(s.height).toBeGreaterThan(prev.height);
      if (s.seg === FLOOD_FALL && prev.seg === FLOOD_FALL) expect(s.height).toBeLessThan(prev.height);
      expect(s.height).toBeGreaterThanOrEqual(m.low);
      expect(s.height).toBeLessThanOrEqual(m.high);
      // Segments come in order and the cycle wraps to the start.
      if (s.seg !== last) expect(s.seg).toBe(last < 0 ? FLOOD_OFF : (last + 1) % 5);
      last = s.seg;
      prev = s;
    }
    expect(seen.size).toBe(5);
    expect(floodState(m, total(m), 0)).toEqual(floodState(m, 0, 0));
  });

  it('reports its crest as its beam every frame, the number the art draws from', () => {
    const { run, fm, phase } = race(flood('lava'), []);
    for (let i = 0; i < total(fm); i += 7) {
      const f = run.frame;
      run.step([]);
      const beam = run.beams.find((b) => b.uid === 900);
      expect(beam?.len).toBe(floodState(fm, f, phase).height);
    }
  });
});

describe('what a flood kills', () => {
  it('lava kills what it covers, and the rising crest only after the warning', () => {
    // On the floor (under low), on a ledge 2 up (between low and high), on a ledge 5 up (above high).
    const { run, fm, phase } = race(flood('lava'), [
      [18, FLOOR],
      [20, FLOOR - 2],
      [24, FLOOR - 5],
    ]);
    const [floor, mid, top] = run.runners;
    run.step(idle(3));
    expect(floor.alive).toBe(false);
    expect(floor.cause).toBe('hazard');
    for (let i = 0; i < total(fm) * 2 && mid.alive; i++) {
      const f = run.frame;
      run.step(idle(3));
      if (!mid.alive) {
        const s = floodState(fm, f, phase);
        expect([FLOOD_RISE, FLOOD_HOLD]).toContain(s.seg);
        // It died as the crest passed its feet (the hitbox is inset 1.5 px), not a frame before.
        const feet = (FLOOR - 2) * TILE;
        expect(FLOOR * TILE - s.height).toBeLessThan(feet - 1.5);
        expect(FLOOR * TILE - floodState(fm, f - 1, phase).height).toBeGreaterThanOrEqual(feet - 1.5);
      } else expect(floodState(fm, f, phase).seg === FLOOD_RISE || floodState(fm, f, phase).height <= fm.low).toBe(true);
    }
    expect(mid.alive).toBe(false);
    for (let i = 0; i < total(fm); i++) run.step(idle(3));
    expect(top.alive).toBe(true);
  });

  it('toxic sludge kills the same way', () => {
    const { run } = race(flood('toxic', { low: 0.5 }), [[18, FLOOR]]);
    run.step(idle(1));
    expect(run.runners[0].alive).toBe(false);
  });

  it('water is a pit: wade it, and drown once wholly under (a fall)', () => {
    // From dry to 2.5 tiles: over the head of whoever stands on the floor, under the chin of whoever's 2 up.
    const { run, fm, phase } = race(flood('water', { low: 0, high: 2.5 }), [
      [18, FLOOR],
      [20, FLOOR - 2],
    ]);
    const [deep, wading] = run.runners;
    let wet = false;
    for (let i = 0; i < total(fm) * 2; i++) {
      const f = run.frame;
      run.step(idle(2));
      const h = floodState(fm, f, phase).height;
      if (deep.alive && h > 0) wet = true;
      if (deep.alive) expect(h).toBeLessThanOrEqual(PLAYER_H);
      else if (deep.deathFrame === f) expect(h).toBeGreaterThan(PLAYER_H);
    }
    expect(wet).toBe(true);
    expect(deep.alive).toBe(false);
    expect(deep.cause).toBe('fall');
    expect(wading.alive).toBe(true);
  });

  it('is deterministic over two identical runs, and keeps no state of its own', () => {
    const play = () => {
      const { run } = race(flood('lava', { low: 0 }), [
        [18, FLOOR],
        [20, FLOOR - 2],
      ]);
      const trace: number[] = [];
      for (let i = 0; i < 700; i++) {
        run.step([
          { ...NO_INPUT, right: i % 90 < 40 },
          { ...NO_INPUT, jump: i % 70 < 10 },
        ]);
        trace.push(run.beams[0].len, run.runners[0].body.x, run.runners[1].body.y, run.runners[0].alive ? 1 : 0, run.runners[1].alive ? 1 : 0);
      }
      return { trace, state: JSON.stringify([...run.propState.entries()]) };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.trace.some((v, i) => i % 5 === 0 && v > 0)).toBe(true);
  });
});

describe('the barrier', () => {
  const rows = (pp: PlacedProp, level = testLevel()) => {
    const ys = new Set<number>();
    for (const k of barrierOf(level, pp).noGo) {
      const x = k % level.w;
      expect(x).toBeGreaterThanOrEqual(X0);
      expect(x).toBeLessThan(X0 + W);
      ys.add(Math.floor(k / level.w));
    }
    return ys;
  };

  it('marks the rows a flood holds for most of its cycle, even a cycle longer than it samples', () => {
    // Up for most of a 1600-frame cycle: rows up to high are held.
    const long = rows(piece(flood('lava', { low: 1, high: 4, off: 200, warn: 60, rise: 60, hold: 1220, fall: 60 })));
    for (const y of [FLOOR - 1, FLOOR - 2, FLOOR - 3, FLOOR - 4]) expect(long.has(y)).toBe(true);
    expect(long.has(FLOOR - 5)).toBe(false);
  });

  it('leaves the rows it only reaches for a short hold', () => {
    // Down for most of the cycle, so only the row under low is held.
    const brief = rows(piece(flood('water', { low: 1, high: 4, off: 900, warn: 60, rise: 60, hold: 60, fall: 60 })));
    expect(brief.has(FLOOR - 1)).toBe(true);
    for (const y of [FLOOR - 2, FLOOR - 3, FLOOR - 4]) expect(brief.has(y)).toBe(false);
  });
});

describe('capFlood', () => {
  /** The route runs along row 5 over a sealed basin (cols 5..14, rows 7..9). */
  const ROWS = [
    '##########################',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#S......................G#',
    '##########################',
    '#####..........###########',
    '#####..........###########',
    '#####..........###########',
    '##########################',
  ];
  function corridor(): Level {
    const h = ROWS.length;
    const w = ROWS[0].length;
    const tiles = new Uint8Array(w * h);
    let spawn = { tx: 0, ty: 0 };
    let goal = { tx: 0, ty: 0 };
    ROWS.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        tiles[y * w + x] = row[x] === '#' ? T_SOLID : 0;
        if (row[x] === 'S') spawn = { tx: x, ty: y };
        if (row[x] === 'G') goal = { tx: x, ty: y };
      }
    });
    return { seed: 7, w, h, tiles, spawn, goal, protectedRects: [], theme: { id: 'volcano' } as Theme, style: 'test', setPieces: [], version: 0, solution: [] };
  }
  const tide = (high: number): Flood => ({ ...flood('lava'), at: [5, 10], w: 10, low: 1, high, off: 60, warn: 30, rise: 60, hold: 600, fall: 60 });

  it('lowers high water until it is under the proven route', () => {
    // Up to row 2 would drown the corridor; the surface may reach the corridor's floor (4 tiles up) and no further.
    expect(capFlood(corridor(), tide(8))?.high).toBe(4);
  });

  it('leaves a flood that already stays under it alone', () => {
    expect(capFlood(corridor(), tide(3))).toEqual(tide(3));
  });
});
