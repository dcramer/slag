import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { climbed, MODES } from '../src/game/modes';
import { DEFAULT_RULES } from '../src/game/rules';
import { POINTS, scoreSurvival } from '../src/game/scoring';
import { buildsTowers, rollProfile, TIDE_TOWER_H } from '../src/gen/level/profile';
import { generateTheme } from '../src/gen/theme';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { FPS, LEVEL_H, LEVEL_W, POP_HOLD, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { RunWorld } from '../src/sim/run';
import { type Tide, tideLine } from '../src/sim/tide';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { pickThemeId, THEME_IDS } from '../src/themes';

const FLOOR = 20; // first solid row
const SLAG = { ...DEFAULT_RULES, mode: 'slag' as const };
/** A quick tide for hand-built levels: moves half a second after GO, 4 tiles/s, steady. */
const QUICK: Tide = { wait: 0.5, speed: 4, gain: 0 };

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
  it('climb in every theme: a tower too tall to top where the theme builds them, a classic climb where it never does', () => {
    for (const theme of THEME_IDS) {
      for (const seed of [1, 2, 3]) {
        const p = rollProfile(seed, theme, { tide: true });
        expect(['climb', 'zigzag'], `${theme} ${seed}`).toContain(p.route);
        expect(p.tide).toBe(true);
        expect(p.size === 'tall' || (p.size === 'classic' && p.route === 'climb'), `${theme} ${seed}: ${p.size}`).toBe(true);
        if (p.size === 'tall') expect(p.h).toBe(TIDE_TOWER_H);
      }
      expect(rollProfile(1, theme, { tide: true }).size).toBe(buildsTowers(theme) ? 'tall' : 'classic');
    }
    expect(THEME_IDS.filter((t) => !buildsTowers(t))).toEqual(['farm', 'harbor', 'space']);
  });

  it('plays a tower theme when the seed would roll one that builds none', () => {
    let seed = 1;
    while (pickThemeId(seed) !== 'farm') seed++;
    const level = new Match(seed, undefined, SLAG).level;
    expect(buildsTowers(level.theme.id)).toBe(true);
    expect(level.profile!.size).toBe('tall');
  });

  it('a match in the mode builds a tower that carries the slag, which tops it inside a minute', () => {
    const m = new Match(31, 'mine', SLAG);
    expect(m.level.tide).toBeDefined();
    expect(m.level.profile?.tide).toBe(true);
    expect(m.level.h).toBe(TIDE_TOWER_H);
    expect(m.level.goal.ty).toBeLessThan(m.level.spawn.ty);
    expect(tideLine(m.level, RUN_COUNTDOWN + 60 * FPS)!).toBeLessThan(0);
    // One part asked, at the top: the climb from the spawn needs none.
    expect(m.level.solution!.length).toBe(1);
    expect(m.level.solution![0].y).toBeLessThan(m.level.h / 4);
    // It pools in the lowest open row, in sight from GO, never over the spawn.
    expect(m.level.tide!.from).toBeGreaterThan(m.level.spawn.ty);
    expect(m.level.tiles.slice(m.level.tide!.from! * m.level.w).every((t) => t === 1)).toBe(true);
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
    expect(tideLine(level, RUN_COUNTDOWN + 29)).toBe(LEVEL_H * TILE);
    while (r.alive && run.frame < 600) {
      expect(run.isSafe(r)).toBe(true);
      run.step([NO_INPUT]);
    }
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('hazard');
    // It took the runner the frame its surface passed their feet, not before.
    expect(tideLine(level, r.deathFrame)!).toBeLessThan(FLOOR * TILE);
    expect(tideLine(level, r.deathFrame - 2)!).toBeGreaterThan(FLOOR * TILE - 3);
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

  it('plays a solo round to the score screen, scored by how high the slag had to come', () => {
    const m = new Match(31, 'mine', SLAG);
    m.join('kb1');
    m.startMatch();
    m.startRun();
    for (let f = 0; f < 60 * 120 && m.phase === 'run'; f++) m.step({});
    expect(m.phase).toBe('score');
    const r = m.run!.runners[0];
    expect(r.alive).toBe(false);
    const share = climbed(m.level, r.deathFrame);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    expect(m.result!.awards.every((a) => a.reason === 'survive')).toBe(true);
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

describe('survival scoring', () => {
  const fate = (slot: number, deathFrame: number) => ({ slot, alive: deathFrame < 0, deathFrame });

  it('pays the last one standing', () => {
    const r = scoreSurvival([fate(0, 300), fate(1, -1), fate(2, 500)], []);
    expect(r.awards).toEqual([{ slot: 1, points: POINTS.survive, reason: 'survive' }]);
    expect(r.finishers).toEqual([1]);
  });

  it('shares a last frame, but a slag that takes everyone at once pays nobody', () => {
    expect(scoreSurvival([fate(0, 300), fate(1, 700), fate(2, 700)], []).finishers).toEqual([1, 2]);
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
