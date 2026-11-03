import { describe, expect, it } from 'vitest';
import type { Cell } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { fieldOf, generateLevel, planHolds, prove, settled } from '../src/gen/level';
import { clearsParts, generateBridge, generateProp } from '../src/gen/props';
import type { Theme } from '../src/gen/theme';
import { TILE } from '../src/sim/constants';
import { type Level, T_SOLID } from '../src/sim/level';
import { barrierOf, blastSpec, canPlace, detonate, landedDef, type PlacedProp, type PropDef } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { type GameEvent, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

/** '#' solid, 'S' spawn, 'G' goal, anything else empty. */
function level(rows: string[]): Level {
  const h = rows.length;
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  let spawn = { tx: 0, ty: 0 };
  let goal = { tx: 0, ty: 0 };
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      tiles[y * w + x] = row[x] === '#' ? T_SOLID : 0;
      if (row[x] === 'S') spawn = { tx: x, ty: y };
      if (row[x] === 'G') goal = { tx: x, ty: y };
    }
  });
  return { seed: 7, w, h, tiles, spawn, goal, protectedRects: [], theme: { id: 'farm' } as Theme, style: 'test', setPieces: [], version: 0, solution: [] };
}

/** A corridor five tiles high: nothing in it but the way to the flag. */
const CORRIDOR = [
  '##################################',
  '##################################',
  '#................................#',
  '#................................#',
  '#................................#',
  '#................................#',
  '#S..............................G#',
  '##################################',
];

/** A plain block of `cells` (a wall when they stand in a column). */
function block(cells: Cell[]): PropDef {
  const base = generateBridge(new Rng(1), 'wall');
  const m = base.modules[0];
  if (m.type !== 'body') throw new Error('bridge is a body');
  return { ...base, key: `wall${cells.length}`, modules: [{ ...m, cells }], footprint: cells };
}

const column = (n: number): Cell[] => Array.from({ length: n }, (_, i) => [0, i] as Cell);

/** A one-player match on `lv`, in the place phase holding `def`. */
function placing(lv: Level, def: PropDef): Match {
  const m = new Match(lv.seed, 'farm');
  m.level = lv;
  m.plan = [];
  m.join('kb');
  m.startMatch();
  m.crate[0].def = def;
  m.crate[0].claimedBy = 0;
  m.players[0].claim = 0;
  for (let f = 0; f < 60 && m.phase === 'pick'; f++) m.step({});
  expect(m.phase).toBe('place');
  for (let f = 0; f < 12; f++) m.step({});
  m.drainEvents();
  return m;
}

/** Point at cell (tx, ty) as the ghost's top-left and confirm. */
function confirmAt(m: Match, tx: number, ty: number, def: PropDef): GameEvent[] {
  const p = m.players[0];
  const cells = def.footprint;
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  p.cursor = { x: (tx + (w - 1) / 2 + 0.5) * TILE, y: (ty + (h - 1) / 2 + 0.5) * TILE };
  expect(m.ghostOrigin(p)).toMatchObject({ tx, ty });
  expect(m.canPlaceFor(p)).toBe(true);
  m.step({ kb: { ...NO_INPUT, confirmPressed: true } });
  return m.drainEvents();
}

/** Play out the place phase, a race nobody touches and the score screen, into the next round's pick. */
function nextRound(m: Match) {
  for (const p of m.players) p.placed = true;
  for (let f = 0; f < 60 && m.phase === 'place'; f++) m.step({});
  expect(m.phase).toBe('run');
  // Untimed, and nobody can reach the flag: the idle rule pops the runner and the race ends.
  for (let f = 0; f < 3000 && m.phase === 'run'; f++) m.step({});
  expect(m.phase).toBe('score');
  for (let f = 0; f < 600 && m.phase === 'score'; f++) m.step({});
  expect(m.phase).toBe('pick');
}

describe('a placement that seals the level', () => {
  it('goes in, and the next crate deals a demolition card that clears parts', { timeout: 30_000 }, () => {
    const wall = block(column(5));
    const m = placing(level(CORRIDOR), wall);
    const events = confirmAt(m, 16, 2, wall);
    expect(events.some((e) => e.type === 'refuse')).toBe(false);
    expect(m.players[0].placed).toBe(true);
    expect(m.placed.length).toBe(1);
    const s = settled(m.level, m.placed);
    expect(prove(s.level, s.placed, [])).toBeNull();
    nextRound(m);
    // Nobody finished, so nobody scored, and the way out is in the crate.
    expect(m.result?.awards ?? []).toEqual([]);
    expect(m.players[0].score).toBe(0);
    const way = m.crate.filter((c) => clearsParts(c.def));
    expect(way.length).toBeGreaterThanOrEqual(1);
    expect(way.some((c) => c.clears)).toBe(true);
    // Set off on the wall, it opens the level again.
    const bomb = way[0].def;
    const opened = detonate({ ...m.level, tiles: m.level.tiles.slice(), setPieces: [] }, [...m.placed], blastSpec(bomb.modules[0] as never), 16, 4);
    expect(opened).toEqual([]);
  });

  it('a level with a way through deals no guaranteed demolition', () => {
    const wall = block(column(3));
    const m = placing(level(CORRIDOR), wall);
    // Hung from the ceiling, it leaves two rows to walk under.
    confirmAt(m, 16, 2, wall);
    expect(m.placed.length).toBe(1);
    const s = settled(m.level, m.placed);
    expect(prove(s.level, s.placed, [])).toEqual([]);
  });

  it('a confirm on a ghost that cannot go there buzzes and places nothing', () => {
    const wall = block(column(5));
    const m = placing(level(CORRIDOR), wall);
    const p = m.players[0];
    p.cursor = { x: 16.5 * TILE, y: 0.5 * TILE }; // in the ceiling's rock
    expect(m.canPlaceFor(p)).toBe(false);
    m.step({ kb: { ...NO_INPUT, confirmPressed: true } });
    expect(m.drainEvents().some((e) => e.type === 'refuse')).toBe(true);
    expect(m.placed).toEqual([]);
    expect(p.placed).toBe(false);
  });

  it('counts a time bomb as gone off before it proves anything', () => {
    const rows = [
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#S..............................G#',
      '##################################',
      '..................................',
      '..................................',
    ];
    const timeBomb = (radius: number): PropDef => ({
      ...block([[0, 0]]),
      key: `tb${radius}`,
      archetype: 'timebomb',
      role: 'hazard',
      modules: [{ type: 'bomb', radius, look: 'clock', delay: true }],
    });
    // Spawn and flag keep their floors (protected), whatever goes off.
    const lv = () => ({
      ...level(rows),
      protectedRects: [
        { x: 0, y: 4, w: 4, h: 4 },
        { x: 30, y: 4, w: 4, h: 4 },
      ],
    });
    // As placed it's one cell on the floor; once it goes off the hole needs both bridges a plan may have.
    const pp: PlacedProp = { uid: 1, def: timeBomb(8), owner: 0, tx: 16, ty: 6, rot: 0 };
    expect(prove(lv(), [pp], [])).toEqual([]);
    const s = settled(lv(), [pp]);
    expect(s.placed).toEqual([]);
    expect(prove(s.level, s.placed, [])?.length).toBe(2);
    // A hole wall to wall is more than two bridges can cross: the level is sealed once it goes off.
    const wide = settled(lv(), [{ ...pp, def: timeBomb(13) }]);
    expect(prove(wide.level, wide.placed, [])).toBeNull();
  });

  it('keeps a plan around hazards: a spike strip on the ground is a cell the route keeps clear of', () => {
    const lv = level(CORRIDOR);
    const spikes = generateProp(new Rng(2), 'spikestrip', 's');
    const def = landedDef(lv, [], spikes, 0, 10, 7);
    const pp: PlacedProp = { uid: 1, def, owner: 0, tx: 10, ty: 7, rot: 0 };
    expect(barrierOf(lv, pp).noGo.length).toBeGreaterThan(0);
    const field = fieldOf(lv, [pp]);
    for (const k of barrierOf(lv, pp).noGo) expect(field.tiles[k]).not.toBe(0);
  });
});

describe('every generated level starts winnable', () => {
  it('with its recorded solution and every set piece standing', { timeout: 60_000 }, () => {
    for (const theme of THEME_IDS) {
      for (let i = 0; i < 2; i++) {
        const lv = generateLevel((i * 2654435761 + 5) >>> 0, theme);
        expect(planHolds(lv, [], lv.solution ?? []), `${theme} ${lv.seed}`).toBe(true);
      }
    }
  });
});

/** Every part a player could hold, at a random spot near the route or anywhere, until one goes in. */
function placeRandomly(m: Match, rng: Rng, route: number[]) {
  for (const p of m.players) {
    for (let tries = 0; tries < 300 && !p.placed; tries++) {
      const aim = rng.chance(0.6) && route.length;
      const k = aim ? route[rng.int(0, route.length - 1)] : rng.int(0, m.level.w * m.level.h - 1);
      const tx = (k % m.level.w) + (aim ? rng.int(-2, 2) : 0);
      const ty = Math.floor(k / m.level.w) + (aim ? rng.int(-3, 1) : 0);
      p.rot = rng.int(0, 3);
      p.cursor = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
      if (m.canPlaceFor(p)) m.step({ [p.device]: { ...NO_INPUT, confirmPressed: true } });
    }
  }
}

/** The level as it stands has a plan or is sealed; a plan, built from real bridge cards on the settled level, takes the real controller to the flag. */
function expectPlanFinishes(m: Match, tag: string) {
  const s = settled(m.level, m.placed);
  const plan = prove(s.level, s.placed, m.plan);
  if (!plan) return;
  const card = generateBridge(new Rng(3), 'check');
  const built: PlacedProp[] = [];
  for (const b of plan) {
    expect(canPlace(s.level, [...s.placed, ...built], card, 0, b.x, b.y), `${tag}: bridge at ${b.x},${b.y}`).toBe(true);
    built.push({ uid: 900 + built.length, def: card, owner: 0, tx: b.x, ty: b.y, rot: 0 });
  }
  expect(analyzeReach(fieldOf(s.level, [...s.placed, ...built])).goalReached, tag).toBe(true);
}

describe('a match under random and hostile placements', () => {
  it('always deals what its plan needs, or a way out once sealed, round after round', { timeout: 120_000 }, () => {
    const cases: [string, number][] = [
      ['castle', 1],
      ['rooftops', 4],
      ['mine', 8],
    ];
    for (const [theme, players] of cases) {
      const m = new Match(1234 + players, theme as 'farm');
      const rng = new Rng(99 + players);
      for (let i = 0; i < players; i++) m.join(`d${i}`);
      m.startMatch();
      for (let round = 1; round <= 5; round++) {
        expect(m.phase).toBe('pick');
        const s = settled(m.level, m.placed);
        const sealed = !prove(s.level, s.placed, m.plan);
        if (sealed)
          expect(
            m.crate.some((c) => clearsParts(c.def)),
            `${theme} r${round} sealed crate`,
          ).toBe(true);
        else {
          // The bridge part (the roster's first, gen/props.ts generateRoster): another platform part in the crate doesn't count.
          const bridges = m.crate.filter((c) => c.def.part === 'bridge').length;
          expect(bridges, `${theme} r${round} crate`).toBeGreaterThanOrEqual(Math.min(m.plan.length, m.crate.length - 1));
        }
        m.players.forEach((p, k) => {
          // Some players get a tall wall instead, the most hostile plain part there is.
          if (rng.chance(0.3)) m.crate[k].def = block(column(4 + rng.int(0, 5)));
          m.crate[k].claimedBy = p.slot;
          p.claim = k;
        });
        for (let f = 0; f < 60 && m.phase === 'pick'; f++) m.step({});
        for (let f = 0; f < 12; f++) m.step({});
        placeRandomly(m, rng, [...analyzeReach(fieldOf(m.level, m.placed), false).reachable]);
        for (const p of m.players) p.placed = true;
        for (let f = 0; f < 60 && m.phase === 'place'; f++) m.step({});
        expect(m.phase).toBe('run');
        expectPlanFinishes(m, `${theme} ${players}p round ${round}`);
        m.run!.endFrame = m.run!.frame;
        for (let f = 0; f < 100 && m.phase === 'run'; f++) m.step({});
        for (let f = 0; f < 400 && m.phase === 'score'; f++) m.step({});
        m.drainEvents();
      }
    }
  });
});
