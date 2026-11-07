import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { climbed, MODES } from '../src/game/modes';
import { DEFAULT_RULES } from '../src/game/rules';
import { generateCrate } from '../src/gen/props';
import { leaderOf as leaderIndex } from '../src/sim/standing';
import { POINTS, scoreSurvival, SURVIVE_PLACES } from '../src/game/scoring';
import { generateLevel, planHolds } from '../src/gen/level';
import { GATE_AT, GATE_HOLD } from '../src/gen/level/loop-gates';
import { LOOP_ROWS, LOOP_W, rollProfile } from '../src/gen/level/profile';
import { LOOP_HEAD_START } from '../src/gen/level/tide';
import { rollKind } from '../src/gen/level/weather';
import { generateTheme } from '../src/gen/theme';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { FPS, LEVEL_H, LEVEL_W, POP_HOLD, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { isProtected, lapShift, type Level, LOOP_BAND, LOOP_SPAWN, T_SOLID } from '../src/sim/level';
import { barrierOf, footprintCells, MIN_OPENING, type ModuleOf, moduleSim, newPropState, phaseCycle, type PlacedProp, resolveProp } from '../src/sim/props';
import { bodyAtCell } from '../src/sim/physics';
import { feetUp, RunWorld } from '../src/sim/run';
import { BotSeats } from '../src/brain/bots';
import { firstOut, gateShut, leashRows, stepTide, type Tide } from '../src/sim/tide';
import { analyzeReach } from '../src/sim/reach';
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

describe("a loop's regroup gates", () => {
  const lv = generateLevel(2, 'mine', MODES.slag.profile);
  const gates = lv.setPieces.filter((p) => p.def.key === 'loop-gate');
  const phase = (pp: PlacedProp) => pp.def.modules[0] as ModuleOf<'phase'>;

  it('shut across the shaft from wall to wall, every lap, on the cycle the slag reads', () => {
    expect(gates.length).toBe(GATE_AT.length);
    expect(lv.tide!.gates!.map((g) => g.row)).toEqual(gates.map((p) => phase(p).cells[0][1]));
    for (const [i, pp] of gates.entries()) {
      const g = lv.tide!.gates![i];
      // Every cell of its row between the walls is the gate's or rock: shut, nothing gets up past it.
      const cells = new Set(pp.def.modules.flatMap((m) => (m as ModuleOf<'phase'>).cells.map(([x]) => x)));
      for (let x = 1; x < lv.w - 1; x++) expect(cells.has(x) || lv.tiles[g.row * lv.w + x] === T_SOLID, `x ${x}`).toBe(true);
      // Open at the start, then on the race clock: its blink blocks and the slag agree on every frame.
      const r = resolveProp(pp);
      expect(gateShut(g, 0)).toBe(false);
      let shut = 0;
      for (let f = 0; f < 2 * (g.shut + g.open); f++) {
        for (const m of pp.def.modules) expect(phaseCycle(m as ModuleOf<'phase'>, f, r.phase).seg === 0).toBe(gateShut(g, f));
        if (gateShut(g, f)) shut++;
      }
      expect(shut).toBe(2 * g.shut);
    }
  });

  it('holds the slag while the leader waits under one that is shut, and not once it opens', () => {
    const g = lv.tide!.gates![0];
    const go = RUN_COUNTDOWN + 10 * FPS;
    const shut = Array.from({ length: g.shut + g.open }, (_, i) => go + i).find((f) => gateShut(g, f))!;
    const open = Array.from({ length: g.shut + g.open }, (_, i) => go + i).find((f) => !gateShut(g, f))!;
    // Feet on a ledge two rows under the gate's cells, a lap up as well as in the first.
    for (const lap of [0, 1]) {
      const feet = (g.row + 3 - lap * lv.loop!) * TILE;
      const line = feet + 5 * TILE;
      expect(stepTide(lv, line, shut, feet)).toBe(line);
      expect(stepTide(lv, line, open, feet)).toBeLessThan(line);
    }
  });

  it('the proof climbs through it as open air only while it opens long enough to', () => {
    // Open more than MIN_OPENING frames a cycle: no barrier, and the lap is still proven bare.
    for (const pp of gates) expect(barrierOf(lv, pp)).toEqual({ ground: [], noGo: [] });
    expect(planHolds(lv, [], [])).toBe(true);
    // Shut, it seals the shaft: written in as rock, no lap is proven.
    const sealed = lv.tiles.slice();
    for (const pp of gates) for (const [x, y] of footprintCells(pp)) sealed[y * lv.w + x] = T_SOLID;
    expect(analyzeReach({ ...lv, tiles: sealed }).goalReached).toBe(false);
    // A gate that opened for less than MIN_OPENING frames would be a barrier, and the proof wouldn't climb through it.
    const brief: PlacedProp = {
      ...gates[0],
      def: { ...gates[0].def, modules: gates[0].def.modules.map((m) => ({ ...(m as ModuleOf<'phase'>), off: MIN_OPENING - 5 })) },
    };
    expect(barrierOf(lv, brief).noGo.length).toBeGreaterThan(0);
    expect(planHolds({ ...lv, setPieces: lv.setPieces.map((p) => (p === gates[0] ? brief : p)) }, [], [])).toBe(false);
  });

  it('bots wait under a shut gate and climb through it once it opens', { timeout: 60_000 }, () => {
    const m = new Match(2, 'mine', SLAG);
    const bots = new BotSeats();
    for (let i = 0; i < 4; i++) m.join(bots.add(m));
    m.startMatch();
    m.startRun();
    const run = m.run!;
    const L = m.level.loop!;
    const gs = m.level.tide!.gates!;
    // Rows a runner's feet stand under a gate's cells, folded by the lap.
    const under = (r: (typeof run.runners)[number], row: number) => (((feetUp(m.level, r) / TILE - (row + 1)) % L) + L) % L;
    let waited = 0;
    let through = 0;
    const was = new Map<number, number[]>();
    while (run.endFrame < 0 && run.frame < RUN_COUNTDOWN + 25 * FPS) {
      for (const r of run.runners.filter((x) => x.alive)) {
        const now = gs.map((g) => under(r, g.row));
        gs.forEach((g, i) => {
          if (gateShut(g, run.frame) && now[i] <= GATE_HOLD && r.body.onGround) waited++;
          // Up through the gate's row: it was open.
          const before = was.get(r.slot)?.[i];
          if (before !== undefined && before <= GATE_HOLD && now[i] > L - 4) {
            expect(gateShut(g, run.frame), `slot ${r.slot} frame ${run.frame}`).toBe(false);
            through++;
          }
        });
        was.set(r.slot, now);
      }
      m.step(bots.frames(m));
    }
    expect(waited).toBeGreaterThan(FPS);
    expect(through).toBeGreaterThanOrEqual(4);
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

describe("a brawl's weather", () => {
  it('never mists the arena: a mist roll comes out clear', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1)
      .filter((s) => rollKind(s, 'jungle') === 'mist')
      .slice(0, 3);
    expect(seeds.length).toBeGreaterThan(0);
    for (const s of seeds) expect(generateLevel(s, 'jungle', MODES.brawl.profile).weather?.kind ?? 'clear').toBe('clear');
  });
});
