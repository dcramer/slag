import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { climbed, MODES } from '../src/game/modes';
import { DEFAULT_RULES } from '../src/game/rules';
import { generateCrate } from '../src/gen/props';
import { leaderIndex } from '../src/sim/items/tax';
import { POINTS, scoreSurvival, SURVIVE_PLACES } from '../src/game/scoring';
import { generateLevel } from '../src/gen/level';
import { LOOP_ROWS, LOOP_W, rollProfile } from '../src/gen/level/profile';
import { LOOP_HEAD_START } from '../src/gen/level/tide';
import { generateTheme } from '../src/gen/theme';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { FPS, LEVEL_H, LEVEL_W, POP_HOLD, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { lapShift, type Level, LOOP_BAND, LOOP_SPAWN } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { RunWorld } from '../src/sim/run';
import { leashRows, stepTide, type Tide } from '../src/sim/tide';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

const FLOOR = 20; // first solid row
const SLAG = { ...DEFAULT_RULES, mode: 'slag' as const };
/** A quick tide for hand-built levels: moves half a second after GO, 4 tiles/s, steady, on no leash. */
const QUICK: Tide = { wait: 0.5, speed: 4, gain: 0, leash: [], squeeze: { after: 999, rate: 0, min: 0 }, rush: 10 };
/** A tide on a 5-row leash that never moves by itself: what it does is all the leash's. */
const LEASHED: Tide = { wait: 0, speed: 0, gain: 0, leash: [{ from: 0, rows: 5 }], squeeze: { after: 2, rate: 1, min: 2 }, rush: 6 };

function flatLevel(tide?: Tide): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: 40, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 4, w: 5, h: 4 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
    ...(tide ? { tide } : {}),
  };
}

const pop = (f: number): InputFrame => ({ ...NO_INPUT, alt: true, altPressed: f === 0 });

describe('Rising Slag levels', () => {
  it('loops in every set: a walled shaft, built bare, its bands the same rows', () => {
    for (const theme of THEME_IDS) {
      const p = rollProfile(1, theme, { tide: true });
      expect(['climb', 'zigzag'], theme).toContain(p.route);
      expect([p.size, p.h], theme).toEqual(['tall', LOOP_ROWS + LOOP_BAND]);
      expect(p.w).toBeGreaterThanOrEqual(LOOP_W[0]);
      const lv = generateLevel(1, theme, { tide: true });
      expect(lv.loop, theme).toBe(LOOP_ROWS);
      expect(lv.theme.id).toBe(theme);
      expect(lv.solution ?? [], theme).toEqual([]);
      for (let r = 0; r < LOOP_BAND; r++)
        expect(lv.tiles.slice(r * lv.w, (r + 1) * lv.w), `${theme} row ${r}`).toEqual(lv.tiles.slice((r + lv.loop!) * lv.w, (r + lv.loop! + 1) * lv.w));
    }
    // Every set builds the mode's level, so the Level card marks none as work in progress.
    expect(THEME_IDS.every((t) => MODES.slag.builds(t))).toBe(true);
  });

  it('a match in the mode builds a walled shaft that loops, climbs bare, and carries the slag', () => {
    const m = new Match(31, 'mine', SLAG);
    const lv = m.level;
    expect(lv.tide).toBeDefined();
    expect(lv.loop).toBe(LOOP_ROWS);
    // Its top band is its bottom one: the same rows a lap apart.
    for (let r = 0; r < LOOP_BAND; r++)
      expect(lv.tiles.slice(r * lv.w, (r + 1) * lv.w)).toEqual(lv.tiles.slice((r + lv.loop!) * lv.w, (r + lv.loop! + 1) * lv.w));
    // Terrain walls up both sides, all the way.
    for (let y = 0; y < lv.h; y++) expect([lv.tiles[y * lv.w], lv.tiles[y * lv.w + lv.w - 1]]).toEqual([1, 1]);
    // The goal is the spawn a lap up, and a lap takes no part.
    expect(lv.goal).toEqual({ tx: lv.spawn.tx, ty: lv.spawn.ty - lv.loop! });
    expect(lv.solution ?? []).toEqual([]);
    // The slag starts a storey under the spawn's floor, on a leash that shortens lap by lap.
    expect(lv.tide!.from).toBe(lv.spawn.ty + 1 + LOOP_HEAD_START);
    const rows = lv.tide!.leash.map((l) => l.rows);
    expect(rows[0]).toBeGreaterThan(rows[2]);
    expect(lv.tide!.leash[1].from).toBe(LOOP_ROWS);
    // Back to a race, the lobby's level is rebuilt without it.
    m.setRules(DEFAULT_RULES);
    expect(m.level.tide).toBeUndefined();
  });
});

describe('the slag', () => {
  it('waits, then rises until it burns a runner standing in the spawn zone', () => {
    const level = flatLevel(QUICK);
    const run = new RunWorld(level, [], [0]);
    const r = run.runners[0];
    const lines: number[] = [];
    while (r.alive && run.frame < 600) {
      expect(run.isSafe(r)).toBe(true);
      run.step([NO_INPUT]);
      lines.push(run.slag!);
    }
    expect(lines[RUN_COUNTDOWN + 28]).toBe(LEVEL_H * TILE);
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('hazard');
    // It took the runner the frame its surface passed their feet, not before.
    expect(lines[r.deathFrame]).toBeLessThan(FLOOR * TILE);
    expect(lines[r.deathFrame - 2]).toBeGreaterThan(FLOOR * TILE - 3);
  });

  it('stays on its leash: rushes up to a leader too far ahead, never sinks, and tightens late', () => {
    const level = flatLevel(LEASHED);
    const feet = FLOOR * TILE;
    const go = RUN_COUNTDOWN + 1;
    // 20 rows behind a 5-row leash: it closes at its rush, no faster.
    expect(stepTide(level, feet + 20 * TILE, go, feet)).toBeCloseTo(feet + 20 * TILE - (6 * TILE) / FPS);
    // Inside the leash it holds (this tide has no floor pace), and a leader who falls back doesn't pull it down.
    expect(stepTide(level, feet + 3 * TILE, go, feet)).toBe(feet + 3 * TILE);
    expect(stepTide(level, feet + 3 * TILE, go, feet + 10 * TILE)).toBe(feet + 3 * TILE);
    // Sudden death: two seconds in the leash starts losing a row a second, down to two.
    expect(leashRows(LEASHED, 0, RUN_COUNTDOWN + FPS)).toBe(5);
    expect(leashRows(LEASHED, 0, RUN_COUNTDOWN + 4 * FPS)).toBe(3);
    expect(leashRows(LEASHED, 0, RUN_COUNTDOWN + 60 * FPS)).toBe(2);
  });

  it('credits the bonk that knocked someone in', () => {
    const level = flatLevel(QUICK);
    const run = new RunWorld(level, [], [0, 1]);
    run.runners[0].items.bonkedBy = 1;
    run.runners[0].items.bonkCredit = 10_000;
    while (run.runners[0].alive && run.frame < 600) run.step([NO_INPUT, NO_INPUT]);
    expect(run.kills).toContainEqual({ victim: 0, killer: 1 });
  });
});

describe('Rising Slag races', () => {
  it('carries a runner round the loop: up through the lap line, and down through the bottom', () => {
    const lv = new Match(31, 'mine', SLAG).level;
    const run = new RunWorld(lv, [], [0], 0, 1, [], true, MODES.slag.run);
    const r = run.runners[0];
    // Standing on the spawn's copy a lap up is standing on the spawn, a lap on.
    r.body = bodyAtCell(lv.goal.tx, lv.goal.ty);
    run.step([NO_INPUT]);
    expect(r.lap).toBe(1);
    expect(Math.abs(r.body.y + r.body.h - (lv.spawn.ty + 1) * TILE)).toBeLessThan(TILE);
    // Under the bottom band you're in the lap below, a loop up the level; the spawn's own floor is neither line.
    expect(lapShift(lv, (lv.loop! + LOOP_BAND) * TILE)).toBe(-1);
    expect(lapShift(lv, (lv.spawn.ty + 1) * TILE)).toBe(0);
    expect(lapShift(lv, (LOOP_SPAWN + 1) * TILE)).toBe(1);
  });

  it('has no flag to finish at', () => {
    const run = new RunWorld(flatLevel(), [], [0], 0, 1, [], true, MODES.slag.run);
    run.runners[0].body = bodyAtCell(40, FLOOR - 1);
    for (let f = 0; f < RUN_COUNTDOWN + 10; f++) run.step([NO_INPUT]);
    expect(run.runners[0].finished).toBe(false);
    expect(run.finishOrder).toEqual([]);
  });

  it('ends when one runner is left standing', () => {
    const run = new RunWorld(flatLevel(), [], [0, 1, 2], 0, 1, [], true, MODES.slag.run);
    while (run.frame < RUN_COUNTDOWN) run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
    for (let f = 0; f <= POP_HOLD && run.endFrame < 0; f++) run.step([pop(f), pop(f), NO_INPUT]);
    expect(run.endFrame).toBeGreaterThan(0);
    expect(run.runners.map((r) => r.alive)).toEqual([false, false, true]);
  });

  it('plays a solo round to the score screen, scored by how far the slag had to climb', () => {
    const m = new Match(31, 'mine', SLAG);
    m.join('kb1');
    m.startMatch();
    m.startRun();
    for (let f = 0; f < 60 * 120 && m.phase === 'run'; f++) m.step({});
    expect(m.phase).toBe('score');
    const r = m.run!.runners[0];
    expect(r.alive).toBe(false);
    // Standing still on the spawn's floor climbs nothing and scores nothing.
    expect(climbed(m.run!, r.slot)).toBe(0);
    expect(m.result!.awards).toEqual([]);
    // A lap and a half up is half the way to the hard laps.
    r.lap = 1;
    r.body.y -= (m.level.loop! / 2) * TILE;
    expect(climbed(m.run!, r.slot)).toBeCloseTo(0.5, 1);
  });

  it('restores a race mid-slag and steps on in lockstep', () => {
    const a = new Match(31, 'mine', SLAG);
    a.join('kb1');
    a.join('kb2');
    a.startMatch();
    a.startRun();
    for (let f = 0; f < RUN_COUNTDOWN + 400; f++) a.step({});
    const b = new Match(1);
    restoreMatch(b, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(b.run!.rules).toEqual(MODES.slag.run);
    expect(b.level.tide).toEqual(a.level.tide);
    for (let f = 0; f < 600; f++) {
      a.step({});
      b.step({});
    }
    expect(hashMatch(b)).toBe(hashMatch(a));
  });
});

describe('Rising Slag parts and items', () => {
  it("deals no bridge it doesn't need, and always a hazard", () => {
    for (let round = 1; round <= 6; round++) {
      const crate = generateCrate(31, round, 5, 0, 0, false, false, 'many', MODES.slag.crate);
      expect(crate).toHaveLength(5);
      expect(crate.some((c) => c.role === 'hazard')).toBe(true);
    }
  });

  it('sends the winged shell after whoever has climbed highest, laps and all', () => {
    const lv = new Match(31, 'mine', SLAG).level;
    const run = new RunWorld(lv, [], [0, 1], 0, 1, [], true, MODES.slag.run);
    // Slot 0 stands high in the shaft on its first lap; slot 1 is low in it, but a lap on.
    run.runners[0].body = bodyAtCell(10, 12);
    run.runners[1].body = bodyAtCell(10, 40);
    run.runners[1].lap = 1;
    expect(leaderIndex(run)).toBe(1);
  });
});

describe('survival scoring', () => {
  const fate = (slot: number, deathFrame: number) => ({ slot, alive: deathFrame < 0, deathFrame });

  it('pays by how long each outlasted the slag, never the first one out', () => {
    const r = scoreSurvival([fate(0, 300), fate(1, -1), fate(2, 500), fate(3, 200), fate(4, 100)], []);
    expect(r.awards).toEqual([
      { slot: 1, points: SURVIVE_PLACES[0], reason: 'survive' },
      { slot: 2, points: SURVIVE_PLACES[1], reason: 'survive' },
      { slot: 0, points: SURVIVE_PLACES[2], reason: 'survive' },
    ]);
    expect(r.finishers).toEqual([1]);
    // A duel pays only its winner; three pay two.
    expect(scoreSurvival([fate(0, 300), fate(1, -1)], []).awards).toEqual([{ slot: 1, points: POINTS.survive, reason: 'survive' }]);
    expect(scoreSurvival([fate(0, 300), fate(1, -1), fate(2, 100)], []).awards.map((a) => a.slot)).toEqual([1, 0]);
  });

  it('shares a frame, but a slag that takes everyone at once pays nobody', () => {
    expect(scoreSurvival([fate(0, 300), fate(1, 700), fate(2, 700)], []).finishers).toEqual([1, 2]);
    // Two caught together on the last frame share first; the next place goes to the one caught after.
    expect(scoreSurvival([fate(0, 300), fate(1, 700), fate(2, 700), fate(3, 100)], []).awards.map((a) => [a.slot, a.points])).toEqual([
      [1, SURVIVE_PLACES[0]],
      [2, SURVIVE_PLACES[0]],
      [0, SURVIVE_PLACES[2]],
    ]);
    const all = scoreSurvival([fate(0, 700), fate(1, 700)], [{ victim: 0, killer: 1 }]);
    expect(all.verdict).toBe('too-hard');
    expect(all.awards).toEqual([]);
  });

  it('pays every credited kill, standing or not', () => {
    const r = scoreSurvival([fate(0, 300), fate(1, 400), fate(2, -1)], [{ victim: 0, killer: 1 }]);
    expect(r.awards).toContainEqual({ slot: 1, points: POINTS.trap, reason: 'trap' });
  });

  it('scores a lone runner by how far the slag climbed to catch them', () => {
    expect(scoreSurvival([fate(0, 900)], [], {}, () => 0.5).awards).toEqual([{ slot: 0, points: POINTS.survive / 2, reason: 'survive' }]);
    expect(scoreSurvival([fate(0, 900)], [], {}, () => 1.2).finishers).toEqual([0]);
    expect(scoreSurvival([fate(0, 90)], [], {}, () => 0).verdict).toBe('too-hard');
  });
});
