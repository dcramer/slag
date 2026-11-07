import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { climbed, MODES } from '../src/game/modes';
import { DEFAULT_RULES } from '../src/game/rules';
import { generateCrate } from '../src/gen/props';
import { throughFaults } from '../src/gen/setpieces';
import { leaderOf as leaderIndex } from '../src/sim/standing';
import { POINTS, scoreKnockouts, scoreSurvival, SURVIVE_PLACES, UNDERDOG_ROUNDS } from '../src/game/scoring';
import { creditKill } from '../src/sim/items';
import { generateLevel } from '../src/gen/level';
import { LOOP_ROWS, LOOP_W, rollProfile } from '../src/gen/level/profile';
import { LOOP_HEAD_START } from '../src/gen/level/tide';
import { rollKind } from '../src/gen/level/weather';
import { generateTheme } from '../src/gen/theme';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { FPS, LEVEL_H, LEVEL_W, POP_HOLD, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { isProtected, lapShift, type Level, LOOP_BAND, LOOP_SPAWN, T_ONEWAY } from '../src/sim/level';
import { moduleSim, newPropState } from '../src/sim/props';
import { bodyAtCell } from '../src/sim/physics';
import { feetUp, RunWorld } from '../src/sim/run';
import { BotSeats } from '../src/brain/bots';
import { Predictor } from '../src/net/predict';
import { screenEdges } from '../src/sim/screen';
import { firstOut, leashRows, stepTide, type Tide } from '../src/sim/tide';
import { analyzeReach } from '../src/sim/reach';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { standSafety } from '../src/gen/level/measure';
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
      const p = rollProfile(1, theme, MODES.slag.profile);
      expect(['climb', 'zigzag'], theme).toContain(p.route);
      expect([p.size, p.h], theme).toEqual(['tall', LOOP_ROWS + LOOP_BAND]);
      expect(p.w).toBeGreaterThanOrEqual(LOOP_W[0]);
      const lv = generateLevel(1, theme, MODES.slag.profile);
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
    // A start line across the spawn storey's floor, each cell open over a floor and in the safe zone.
    const starts = [lv.spawn, ...(lv.spawns ?? [])];
    expect(starts.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...starts.map((c) => c.tx)) - Math.min(...starts.map((c) => c.tx))).toBeGreaterThan(lv.w / 2);
    for (const c of starts) {
      expect(c.ty).toBe(lv.spawn.ty);
      expect([lv.tiles[c.ty * lv.w + c.tx], lv.tiles[(c.ty - 1) * lv.w + c.tx]]).toEqual([0, 0]);
      expect(lv.tiles[(c.ty + 1) * lv.w + c.tx]).not.toBe(0);
      expect(isProtected(lv, c.tx, c.ty)).toBe(true);
    }
    // Mystery boxes of its own, a few up the shaft, never on the seam's band, each dealing by rank.
    const boxes = lv.setPieces.filter((p) => p.def.key === 'loop-box');
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (const b of boxes) {
      const [x, y] = b.def.footprint[0];
      expect(isProtected(lv, x, y)).toBe(false);
      expect(b.def.modules[0]).toMatchObject({ type: 'mystery', deal: MODES.slag.profile.boxes });
    }
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

  it('starts the leash long while a field untangles, and squeezes from the first one out', () => {
    const tide: Tide = { ...LEASHED, squeeze: { after: 30, rate: 1, min: 2, out: 1 }, open: { rows: 10, seconds: 5 } };
    // At GO it's the opening's rows longer, fading to the lap's leash.
    expect(leashRows(tide, 0, RUN_COUNTDOWN)).toBe(15);
    expect(leashRows(tide, 0, RUN_COUNTDOWN + 2.5 * FPS)).toBe(10);
    expect(leashRows(tide, 0, RUN_COUNTDOWN + 5 * FPS)).toBe(5);
    // Nobody out: no squeeze before `after`. Someone out at 6 s: it starts a second later, a row a second.
    expect(leashRows(tide, 0, RUN_COUNTDOWN + 10 * FPS)).toBe(5);
    const out = RUN_COUNTDOWN + 6 * FPS;
    expect(leashRows(tide, 0, RUN_COUNTDOWN + 7 * FPS, out)).toBe(5);
    expect(leashRows(tide, 0, RUN_COUNTDOWN + 9 * FPS, out)).toBe(3);
    // The run counts the first one out from its runners.
    expect(firstOut([{ alive: true, deathFrame: -1 }])).toBe(-1);
    expect(
      firstOut([
        { alive: false, deathFrame: 400 },
        { alive: false, deathFrame: 300 },
        { alive: true, deathFrame: -1 },
      ]),
    ).toBe(300);
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

describe("a loop's mystery boxes", () => {
  it('deal catch-up to whoever is behind and defence to the leader', () => {
    const box = {
      type: 'mystery' as const,
      cells: [[10, 10]] as [number, number][],
      pool: ['smoke' as const],
      uses: 0,
      refill: 1,
      look: 'crate' as const,
      seed: 1,
      deal: MODES.slag.profile.boxes!,
    };
    /** The item the box pops when knocked from below by a runner whose feet stand at `up` (climbed px), beside one at `other`. */
    const knock = (uid: number, up: number, other: number) => {
      const got: string[] = [];
      const ctx = {
        live: true,
        state: newPropState(),
        frame: 100,
        mi: 0,
        off: [0, 0],
        prev: [0, 0],
        level: flatLevel(),
        itemSeed: 7,
        r: { pp: { uid }, phase: 0 },
        runners: [
          { x: 10 * TILE + 2, y: 11 * TILE, w: 12, h: 22, active: true },
          { x: 300, y: 100, w: 12, h: 22, active: true },
        ],
        // Higher up leads (sim/standing.ts): the lower feet.
        leader: () => (up < other ? 0 : 1),
        spawnItem: (s: { kind: string }) => got.push(s.kind),
        emit: () => {},
      };
      moduleSim('mystery').tick!(box, ctx as never);
      return got[0];
    };
    for (let uid = 1; uid <= 8; uid++) {
      expect(box.deal.chase).toContain(knock(uid, 500, 100));
      expect(box.deal.lead).toContain(knock(uid, 100, 500));
    }
  });
});

describe("the leader's screen", () => {
  const screen = MODES.slag.run.screen!;
  /**
   * A tall level: a ledge on the left at row 30 (the spawn's), and a floor across at row 60, further under the ledge
   * than the screen reaches. Runner 0 on the ledge, runner 1 on the floor below, right of the ledge.
   */
  const race = (low = true) => {
    const w0 = 40;
    const h = 80;
    const tiles = new Uint8Array(w0 * h);
    for (let x = 0; x < 16; x++) tiles[30 * w0 + x] = 1;
    for (let y = 60; y < h; y++) for (let x = 0; x < w0; x++) tiles[y * w0 + x] = 1;
    const level: Level = { ...flatLevel(), w: w0, h, tiles, spawn: { tx: 4, ty: 29 }, goal: { tx: 36, ty: 59 }, protectedRects: [] };
    const w = new RunWorld(level, [], [0, 1], 0, 1, [], false, MODES.slag.run);
    const b = w.runners[1].body;
    b.x = 30 * TILE;
    b.y = low ? 60 * TILE - b.h : 29 * TILE;
    return w;
  };
  /** Steps `w` to frame `to` with nobody pressing anything, `place` moving runners where a test wants them first. */
  const run = (w: RunWorld, to: number, place: (w: RunWorld) => void = () => {}) => {
    while (w.frame < to) {
      place(w);
      w.step([NO_INPUT, NO_INPUT]);
    }
  };

  it('only a field has one: alone, nothing falls behind', () => {
    expect(race().screen).not.toBeNull();
    expect(new RunWorld(flatLevel(), [], [0], 0, 1, [], false, MODES.slag.run).screen).toBeNull();
    expect(new RunWorld(flatLevel(), [], [0, 1], 0, 1, [], false, MODES.race.run).screen).toBeNull();
  });

  it('puts out a runner under its bottom edge after the grace, and not one inside it', () => {
    const w = race();
    const { bottom } = screenEdges(screen, w.screen!);
    // Runner 1 stands on the floor, wholly under the edge; runner 0 on the ledge, inside.
    expect(w.runners[1].body.y).toBeGreaterThan(bottom);
    // Nobody is out before GO, and from GO only once the grace has run.
    run(w, RUN_COUNTDOWN + screen.grace - 1);
    expect(w.runners[1].alive, 'still in its grace').toBe(true);
    run(w, RUN_COUNTDOWN + screen.grace + 1);
    expect(w.runners[1].alive).toBe(false);
    expect(w.runners[1].cause).toBe('screen');
    run(w, RUN_COUNTDOWN + 5 * FPS);
    expect(w.runners[0].alive).toBe(true);
    // Back over the edge before the grace runs out, it's forgiven and the count starts over.
    const v = race();
    run(v, RUN_COUNTDOWN + screen.grace - 5);
    v.runners[1].body.y = bottom - 2 * TILE;
    v.step([NO_INPUT, NO_INPUT]);
    expect(v.screen!.under[1]).toBe(0);
    expect(v.runners[1].alive).toBe(true);
  });

  it('follows the leader up no faster than it rises, and its top holds them', () => {
    const w = race(false);
    run(w, RUN_COUNTDOWN);
    const y0 = w.screen!.y;
    // The leader flung up faster than any climb: the window rises at most `rise` rows a second after them.
    run(w, RUN_COUNTDOWN + FPS, (x) => {
      x.runners[0].body.vy = -300;
    });
    expect(y0 - w.screen!.y).toBeLessThanOrEqual(screen.rise * TILE + 1e-6);
    expect(y0 - w.screen!.y).toBeGreaterThan(screen.rise * TILE * 0.9);
    // The top is solid: it holds them under it.
    const { top } = screenEdges(screen, w.screen!);
    for (const r of w.runners) expect(feetUp(w.level, r) - r.body.h).toBeGreaterThanOrEqual(top - 1e-6);
    expect(w.solids.some((s) => s.propUid === -1 && Math.abs(s.y + s.h - top) < 1e-6)).toBe(true);
  });

  it("a guest's predicted copy steps a screen of its own, never the confirmed one", () => {
    const m = new Match(3, 'mine', SLAG);
    const bots = new BotSeats();
    for (let i = 0; i < 2; i++) m.join(bots.add(m));
    m.startMatch();
    m.startRun();
    while (m.run!.frame < RUN_COUNTDOWN + 2 * FPS) m.step(bots.frames(m));
    const was = { y: m.run!.screen!.y, under: [...m.run!.screen!.under] };
    const shown = new Predictor().copy(m);
    for (let f = 0; f < FPS; f++) shown.step(bots.frames(shown));
    expect(shown.run!.screen!.y).not.toBe(was.y);
    expect(m.run!.screen).toEqual(was);
  });

  it('plays the same twice: bots on a seed die on the same frames, the screen in the same place', { timeout: 60_000 }, () => {
    const play = () => {
      const m = new Match(3, 'mine', SLAG);
      const bots = new BotSeats();
      for (let i = 0; i < 4; i++) m.join(bots.add(m));
      m.startMatch();
      m.startRun();
      const run = m.run!;
      const ys: number[] = [];
      while (run.endFrame < 0 && run.frame < RUN_COUNTDOWN + 40 * FPS) {
        m.step(bots.frames(m));
        if (run.frame % 30 === 0) ys.push(run.screen!.y);
      }
      return { ys, deaths: run.runners.map((r) => [r.deathFrame, r.cause]), hash: hashMatch(m) };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.ys.length).toBeGreaterThan(10);
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

describe('knockout scoring', () => {
  const fate = (slot: number, deathFrame: number) => ({ slot, alive: deathFrame < 0, deathFrame });
  const total = (r: ReturnType<typeof scoreKnockouts>, slot: number) => r.awards.filter((a) => a.slot === slot).reduce((s, a) => s + a.points, 0);

  it('pays the fighter who knocked out two and fell over the one who hid to the end', () => {
    // 1 knocks out 0 and 3, then falls on their own; 2 never touched anyone and is last standing.
    const r = scoreKnockouts(
      [fate(0, 200), fate(1, 500), fate(2, -1), fate(3, 300)],
      [
        { victim: 0, killer: 1 },
        { victim: 3, killer: 1 },
      ],
    );
    expect(total(r, 1)).toBe(2 * POINTS.knockout);
    expect(total(r, 2)).toBe(POINTS.lastStanding);
    expect(total(r, 1)).toBeGreaterThan(total(r, 2));
    expect(r.finishers).toEqual([2]);
    expect(r.awards.filter((a) => a.slot === 1).map((a) => a.reason)).toEqual(['knockout', 'knockout']);
  });

  it('pays nobody for a fall of their own or one nobody knocked', () => {
    const r = scoreKnockouts([fate(0, 200), fate(1, 300), fate(2, -1)], [{ victim: 0, killer: 0 }]);
    expect(total(r, 0)).toBe(0);
    expect(total(r, 1)).toBe(0);
    expect(r.awards).toEqual([{ slot: 2, points: POINTS.lastStanding, reason: 'survive' }]);
  });

  it('a draw with no knockouts pays nobody; a draw keeps its knockouts but has no winner', () => {
    const none = scoreKnockouts([fate(0, 700), fate(1, 700), fate(2, 700)], []);
    expect(none.verdict).toBe('too-hard');
    expect(none.awards).toEqual([]);
    const fought = scoreKnockouts([fate(0, 300), fate(1, 700), fate(2, 700)], [{ victim: 0, killer: 2 }]);
    expect(fought.verdict).toBe('normal');
    expect(fought.finishers).toEqual([]);
    expect(fought.awards).toEqual([{ slot: 2, points: POINTS.knockout, reason: 'knockout' }]);
  });

  it('gives the last one out the win, even caught after the round ended', () => {
    expect(scoreKnockouts([fate(0, 300), fate(1, 900)], []).finishers).toEqual([1]);
  });

  it('keeps the comeback: a trailing scorer who had gone a while without points gets the underdog bonus', () => {
    const standings = { 0: { score: 40, scoreless: 0 }, 1: { score: 5, scoreless: UNDERDOG_ROUNDS }, 2: { score: 5, scoreless: UNDERDOG_ROUNDS } };
    const r = scoreKnockouts([fate(0, 300), fate(1, 400), fate(2, -1)], [{ victim: 0, killer: 1 }], standings);
    expect(total(r, 1)).toBe(POINTS.knockout + POINTS.survivor);
    expect(total(r, 2)).toBe(POINTS.lastStanding + POINTS.survivor);
    expect(total(r, 0)).toBe(0);
  });

  it('credits the knock, not the part it threw them into', () => {
    const run = new RunWorld(flatLevel(QUICK), [], [0, 1, 2]);
    const r = run.runners[0];
    // A part of their own, or of someone else, while a rival's bonk still counts: the rival's knockout.
    r.items.bonkedBy = 1;
    r.items.bonkCredit = 10;
    expect(creditKill(r, 0, 'hazard')).toBe(1);
    expect(creditKill(r, 2, 'hazard')).toBe(1);
    expect(creditKill(r, -1, 'out')).toBe(1);
    // Once the bonk's credit runs out, whoever owns what killed them.
    r.items.bonkCredit = 0;
    expect(creditKill(r, 2, 'hazard')).toBe(2);
    expect(creditKill(r, -1, 'fall')).toBe(-1);
  });
});

describe("a brawl's weather", () => {
  it('never mists the arena: a mist roll comes out clear', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1)
      .filter((s) => rollKind(s, 'jungle') === 'mist')
      .slice(0, 3);
    expect(seeds.length).toBeGreaterThan(0);
    for (const s of seeds) expect(generateLevel(s, 'jungle', MODES.brawl.profile).weather?.kind ?? 'clear').toBe('clear');
  });
});

describe("a brawl's arena", () => {
  // A seed per theme in turn: the arena builder's contract over every set is tests/conformance/builders.test.ts, its sweep tests/stats/builder-contracts.test.ts.
  const cases = [1, 2, 3].map((seed) => ({ seed, theme: THEME_IDS[(seed * 4) % THEME_IDS.length] }));

  for (const { seed, theme } of cases)
    it(`seed ${seed} ${theme}: two mirrored ends that reach each other bare, boxes the field gets to, a ledge over the middle`, () => {
      const lv = generateLevel(seed, theme, MODES.brawl.profile);
      const { w, h } = lv;
      expect(lv.style).toContain(':arena-');
      expect(lv.landmark).toBeUndefined();
      // The two ends: the same row, mirrored columns, each in its own safe zone.
      expect(lv.spawns).toEqual([lv.goal]);
      expect(lv.goal.ty).toBe(lv.spawn.ty);
      expect(lv.spawn.tx + lv.goal.tx).toBe(w - 1);
      for (const c of [lv.spawn, lv.goal]) expect(isProtected(lv, c.tx, c.ty)).toBe(true);
      // Each end reaches the other with no part.
      const there = analyzeReach(lv, false);
      expect(there.goalReached).toBe(true);
      expect(analyzeReach({ ...lv, spawn: lv.goal, goal: lv.spawn }).goalReached).toBe(true);
      // A ledge to stand on above the middle of the screen, and somewhere to be knocked off the side.
      expect([...there.reachable].some((k) => Math.floor(k / w) < h / 2)).toBe(true);
      const open = (x: number) => Array.from({ length: h }, (_, y) => lv.tiles[y * w + x]).filter((t) => t === 0).length;
      expect(Math.min(open(0), open(w - 1))).toBeGreaterThan(h / 2);
      // At least three boxes, a mirrored pair among them, each over a floor the field reaches, with room on top.
      const boxes = lv.setPieces.filter((p) => p.def.key === 'loop-box').map((p) => p.def.footprint[0]);
      expect(boxes.length).toBeGreaterThanOrEqual(3);
      expect(boxes.some(([x, y]) => boxes.some(([mx, my]) => mx !== x && mx === w - 1 - x && my === y))).toBe(true);
      for (const [x, y] of boxes) {
        expect(there.reachable.has((y + 2) * w + x), `box ${x},${y}`).toBe(true);
        expect([lv.tiles[(y - 1) * w + x], lv.tiles[(y - 2) * w + x]]).toEqual([0, 0]);
      }
      // Nothing in the top rows but what the set's look hangs as a whole (a canopy): no board up there nobody reaches,
      // and every board has two rows of air over it.
      for (let x = 0; x < w; x++) expect([lv.tiles[x], lv.tiles[w + x]]).not.toContain(T_ONEWAY);
      for (let y = 2; y < h; y++)
        for (let x = 0; x < w; x++)
          if (lv.tiles[y * w + x] === T_ONEWAY) expect([lv.tiles[(y - 1) * w + x], lv.tiles[(y - 2) * w + x]], `board ${x},${y}`).toEqual([0, 0]);
      // No set piece reaches through the arena's ledges or boards.
      expect(lv.setPieces.flatMap((p) => throughFaults(lv, p))).toEqual([]);
      // Room for nearly all the set pieces it asks for, every one something that kills or knocks, and next to no
      // place to stand without a way to die near it (the sweep: tests/stats/builder-contracts.test.ts).
      const pieces = lv.setPieces.filter((p) => p.def.key !== 'loop-box');
      expect(pieces.length).toBeGreaterThanOrEqual(MODES.brawl.profile.hazards! - 2);
      for (const p of pieces) expect(MODES.brawl.profile.setPieceRoles).toContain(p.def.role);
      const { stands, safe } = standSafety(lv);
      expect(safe.size / stands.length).toBeLessThan(0.3);
    });
});
