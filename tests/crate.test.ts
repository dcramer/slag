import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { MATCH_LENGTHS } from '../src/game/rules';
import { scoreRound } from '../src/game/scoring';
import { generateLevel, judge, lastGenInfo, MAX_BRIDGES, partsNeeded } from '../src/gen/level';
import { setProbeGravity } from '../src/gen/level/probe';
import { hardGap } from '../src/gen/level/sculptors/common';
import { ARCHETYPE_WEIGHTS, generateBridge, generateCrate, generateProp, isBridgePart } from '../src/gen/props';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { canPlace, type PlacedProp } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';
import { sample } from './lib/tier';

const seedAt = (i: number) => (i * 2654435761 + 91) >>> 0;

/** A level whose recorded solution takes `n` parts. */
function levelNeeding(n: number): { seed: number; level: Level } {
  for (let i = 0; i < 300; i++) {
    const seed = seedAt(i);
    const level = generateLevel(seed, 'farm', { size: 'classic' });
    if (level.solution?.length === n) return { seed, level };
  }
  throw new Error(`no level needing ${n} parts`);
}

describe('bridge parts', () => {
  it('generates only parts the guarantee can count on', () => {
    for (let i = 0; i < 60; i++) expect(isBridgePart(generateBridge(new Rng(i), 'x'))).toBe(true);
  });

  it('does not count moving, crumbling, springy or tiny parts', () => {
    const kinds = ARCHETYPE_WEIGHTS.map(([k]) => k).filter((k) => k !== 'platform');
    for (const k of kinds) for (let i = 0; i < 8; i++) expect(isBridgePart(generateProp(new Rng(i), k, 'x')), k).toBe(false);
  });

  it('stands where a level says one goes, and the real controller then reaches the goal', { timeout: 60_000 }, () => {
    for (const theme of THEME_IDS) {
      for (let i = 0; i < sample(1, 6); i++) {
        const level = generateLevel(seedAt(i), theme);
        const placed: PlacedProp[] = [];
        for (const b of level.solution ?? []) {
          const def = generateBridge(new Rng(placed.length), 'b');
          expect(canPlace(level, placed, def, 0, b.x, b.y), `${theme} ${level.seed} ${b.x},${b.y}`).toBe(true);
          placed.push({ uid: placed.length + 1, def, owner: 0, tx: b.x, ty: b.y, rot: 0 });
        }
        expect(partsNeeded(level, placed), `${theme} ${level.seed}`).toBe(0);
      }
    }
  });
});

describe('the crate guarantee', () => {
  it('offers what the level needs, capped so a hazard keeps its place', () => {
    for (const count of [3, 4, 5, 6, 8, 10]) {
      for (let need = 0; need <= MAX_BRIDGES + 1; need++) {
        for (let round = 1; round <= 12; round++) {
          const crate = generateCrate(seedAt(round), round, count, need);
          expect(crate.length).toBe(count);
          expect(crate.filter(isBridgePart).length).toBeGreaterThanOrEqual(Math.min(need, count - 1));
          expect(crate.some((d) => d.role === 'hazard')).toBe(true);
          expect(crate.some((d) => d.role === 'build')).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(generateCrate(7, 3, 5, 2)).toEqual(generateCrate(7, 3, 5, 2));
  });
});

describe('what a level still needs', () => {
  const bridge = (level: Level, i: number): PlacedProp => {
    const b = level.solution![i];
    return { uid: i + 1, def: generateBridge(new Rng(i), 'b'), owner: 0, tx: b.x, ty: b.y, rot: 0 };
  };

  it('counts down as parts go in', { timeout: 30_000 }, () => {
    const { level } = levelNeeding(2);
    expect(partsNeeded(level, [])).toBe(2);
    expect(partsNeeded(level, [bridge(level, 0), bridge(level, 1)])).toBe(0);
    // Either part alone leaves the level one short (it isn't a two-bridge level by accident).
    expect(partsNeeded(level, [bridge(level, 0)])).toBeLessThanOrEqual(1);
  });

  it("ignores parts that aren't ground: a moving platform proves nothing", () => {
    const { level } = levelNeeding(1);
    const b = level.solution![0];
    const def = { ...generateBridge(new Rng(1), 'b'), motion: { type: 'rail', angle: 0, range: 3, period: 200 } as const };
    expect(partsNeeded(level, [{ uid: 1, def, owner: 0, tx: b.x, ty: b.y, rot: 0 }])).toBeGreaterThan(0);
  });
});

/** Play rounds for real: claim a bridge part, stand it on the solution, give up the race. */
function playRound(m: Match, spot: { x: number; y: number }) {
  const device = 'kb1';
  const p = m.players[0];
  const press = (i: Partial<InputFrame>) => m.step({ [device]: { ...NO_INPUT, ...i } });
  for (let f = 0; f < 30 && m.phase !== 'pick'; f++) press({});
  const card = m.crate.find((c) => isBridgePart(c.def))!;
  p.cursor = { x: card.rect.x + 4, y: card.rect.y + 4 };
  for (let f = 0; f < 60 && m.phase === 'pick'; f++) press({ confirmPressed: f === 15 });
  expect(m.phase).toBe('place');
  p.cursor = { x: (spot.x + 1.5) * TILE, y: (spot.y + 0.5) * TILE };
  for (let f = 0; f < 60 && m.phase === 'place'; f++) press({ confirmPressed: f === 15 });
  for (let f = 0; f < 400 && m.phase === 'run'; f++) press({ altPressed: f === 100 });
  for (let f = 0; f < 900 && m.phase === 'score'; f++) press({ confirmPressed: f % 30 === 29 });
}

describe('a solo match on a two-part level', () => {
  it('gets the parts it needs across rounds and then needs none', { timeout: 60_000 }, () => {
    const { seed, level } = levelNeeding(2);
    const m = new Match(seed, 'farm');
    m.forceProfile = { size: 'classic' };
    m.newLevel(seed, 'farm');
    expect(m.level.solution).toEqual(level.solution);
    m.join('kb1');
    m.startMatch();
    expect(m.crate.length).toBe(3);
    expect(m.crate.filter((c) => isBridgePart(c.def)).length).toBe(2);
    playRound(m, level.solution![0]);
    expect(m.placed.length).toBe(1);
    expect(m.phase).toBe('pick');
    expect(m.crate.filter((c) => isBridgePart(c.def)).length).toBeGreaterThanOrEqual(1);
    playRound(m, level.solution![1]);
    expect(m.placed.length).toBe(2);
    expect(partsNeeded(m.level, m.placed)).toBe(0);
  });

  it('can still win inside every match length', () => {
    for (const length of MATCH_LENGTHS) {
      for (let need = 1; need <= MAX_BRIDGES; need++) {
        let score = 0;
        let round = 1;
        // The last part goes in on round `need`, so that's the first round with a finish.
        for (round = need; score < length.targetScore; round++) {
          score += scoreRound([0], [0], []).awards.reduce((sum, a) => sum + a.points, 0);
          if (round > 100) break;
        }
        expect(round - 1, `${length.label} needing ${need}`).toBeLessThanOrEqual(length.maxRounds);
      }
    }
  });
});

describe('hard gaps', () => {
  const base = generateLevel(1);
  function gapLevel(gap: number, gravity: number): Level {
    const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
    const row = 18;
    const leftEnd = Math.floor((LEVEL_W - gap) / 2) - 1;
    const far = leftEnd + gap + 1;
    for (let x = 0; x < LEVEL_W; x++)
      if (x <= leftEnd || x >= far) for (let y = row + 1; y < LEVEL_H; y++) if (x > far + 1 || y <= row + 2) tiles[y * LEVEL_W + x] = 1;
    return {
      ...base,
      w: LEVEL_W,
      h: LEVEL_H,
      gravity,
      tiles,
      spawn: { tx: 2, ty: row },
      goal: { tx: LEVEL_W - 3, ty: row },
      protectedRects: [
        { x: 0, y: row - 3, w: 5, h: 5 },
        { x: LEVEL_W - 5, y: row - 3, w: 5, h: 5 },
      ],
      setPieces: [],
      solution: [],
    };
  }

  for (const gravity of [0.7, 1, 1.35]) {
    it(`need exactly what they ask for at gravity ${gravity}, measured by the controller`, { timeout: 60_000 }, () => {
      setProbeGravity(gravity);
      const rng = new Rng(3);
      for (const parts of [1, 2]) {
        for (const w of new Set(Array.from({ length: 40 }, () => hardGap(rng, parts)))) {
          const l = gapLevel(w, gravity);
          expect(analyzeReach(l).goalReached, `width ${w} bare`).toBe(false);
          const x0 = Math.floor((LEVEL_W - w) / 2);
          const v = judge(l, [{ x: x0, y: 19 }], [[x0, x0 + w - 1]]);
          expect(v.ok, `width ${w}`).toBe(true);
          expect(v.bridges.length, `width ${w}`).toBe(parts);
        }
      }
      setProbeGravity(1);
    });
  }
});

describe('every level asks for parts', () => {
  it('needs at least one part and proves its solution, on every level', { timeout: 120_000 }, () => {
    for (const theme of THEME_IDS) {
      for (let i = 0; i < sample(2, 10); i++) {
        const l = generateLevel(seedAt(i + 50), theme);
        const needs = lastGenInfo.bridges.length;
        expect(needs).toBeLessThanOrEqual(MAX_BRIDGES);
        if (needs === 0) continue; // The rare level no sculpt could make hard: the share is checked in worldgen.
        expect(analyzeReach(l).goalReached, `${theme} ${l.seed} bare`).toBe(false);
      }
    }
  });
});
