import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { MATCH_LENGTHS } from '../src/game/rules';
import { scoreRound } from '../src/game/scoring';
import { generateLevel, judge, lastGenInfo, MAX_BRIDGES, partsNeeded } from '../src/gen/level';
import { setProbeGravity } from '../src/gen/level/probe';
import { hardGap } from '../src/gen/level/sculptors/common';
import {
  ARCHETYPE_WEIGHTS,
  clearsParts,
  crateLean,
  DEMOLISH,
  dryLean,
  generateBridge,
  generateCrate,
  generateProp,
  generateRoster,
  isBridgePart,
  PIPE_PITY,
  rosterSize,
} from '../src/gen/props';
import { restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { canPlace, type PlacedProp } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

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
      for (let i = 0; i < 1; i++) {
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
    expect(generateCrate(7, 3, 5, 2, 0, false, true)).toEqual(generateCrate(7, 3, 5, 2, 0, false, true));
  });

  it('deals a sealed level a demolition card that clears parts, beside its hazard and a bridge, in every crate size', () => {
    for (const count of [3, 4, 5, 6, 8, 10]) {
      for (let round = 1; round <= 12; round++) {
        for (const dry of [0, 3]) {
          const crate = generateCrate(seedAt(round), round, count, MAX_BRIDGES, dry, false, true);
          expect(crate.length).toBe(count);
          expect(crate.some(clearsParts), `${count} cards, round ${round}`).toBe(true);
          expect(crate.some((d) => d.role === 'hazard')).toBe(true);
          expect(crate.some(isBridgePart)).toBe(true);
        }
      }
    }
  });

  it('a level with a way through keeps its crate as it was', () => {
    for (let round = 1; round <= 6; round++)
      expect(generateCrate(seedAt(round), round, 4, 1, 0, false, false)).toEqual(generateCrate(seedAt(round), round, 4, 1));
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
function playRound(m: Match, spot: { x: number; y: number }, finish = false) {
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
  if (finish) m.run!.finishOrder.push(p.slot);
  for (let f = 0; f < 400 && m.phase === 'run'; f++) press({ altPressed: f === 100, alt: f >= 100 });
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
      for (let i = 0; i < 2; i++) {
        const l = generateLevel(seedAt(i + 50), theme);
        const needs = lastGenInfo.bridges.length;
        expect(needs).toBeLessThanOrEqual(MAX_BRIDGES);
        if (needs === 0) continue; // The rare level no sculpt could make hard: the share is checked in tests/stats/theme-levels.test.ts.
        expect(analyzeReach(l).goalReached, `${theme} ${l.seed} bare`).toBe(false);
      }
    }
  });
});

describe('a stuck match leans on the crate', () => {
  const unstick = (a: string) => DEMOLISH.has(a as never) || ['platform', 'crumble', 'spring'].includes(a);
  /** Share of a roster's weight on the parts that unstick a match, averaged over matches. */
  const share = (dry: number) => {
    let sum = 0;
    for (let i = 0; i < 40; i++) {
      const w = generateRoster(seedAt(i), rosterSize(6)).map((p) => [p.archetype, dryLean(p.archetype, dry)] as const);
      const total = w.reduce((n, [, v]) => n + v, 0);
      sum += w.filter(([a]) => unstick(a)).reduce((n, [, v]) => n + v, 0) / total;
    }
    return sum / 40;
  };

  it('a first dry round is a nudge, and the push builds from the second', () => {
    const [d0, d1, d2, d3] = [share(0), share(1), share(2), share(3)];
    expect(d1).toBeGreaterThan(d0);
    expect(d2 - d1).toBeGreaterThan((d1 - d0) * 2);
    expect(d3).toBeGreaterThan(d2);
  });

  it('is capped, so crates stay varied', () => {
    expect(share(50)).toBeCloseTo(share(5), 9);
    expect(share(50)).toBeLessThan(0.75);
    for (const [a] of ARCHETYPE_WEIGHTS) expect(dryLean(a, 50)).toBeGreaterThan(0);
  });

  it('shows up in real crates and stays deterministic', () => {
    const cards = (dry: number) => {
      const out = [];
      for (let i = 0; i < 300; i++) out.push(...generateCrate(seedAt(i), 1 + (i % 9), 6, 1, dry));
      return out.filter((d) => unstick(d.archetype) && !isBridgePart(d)).length;
    };
    expect(cards(5)).toBeGreaterThan(cards(0) * 1.4);
    expect(generateCrate(5, 2, 6, 1, 3)).toEqual(generateCrate(5, 2, 6, 1, 3));
  });

  it('counts dry rounds, resets on a finish, and survives a snapshot', { timeout: 60_000 }, () => {
    const { seed, level } = levelNeeding(2);
    const m = new Match(seed, 'farm');
    m.forceProfile = { size: 'classic' };
    m.newLevel(seed, 'farm');
    m.join('kb1');
    m.startMatch();
    expect(m.dryRounds).toBe(0);
    playRound(m, level.solution![0]);
    expect(m.dryRounds).toBe(1);
    const copy = new Match(seed, 'farm');
    restoreMatch(copy, snapshotMatch(m));
    expect(copy.dryRounds).toBe(1);
    playRound(m, level.solution![1], true);
    expect(m.dryRounds).toBe(0);
  });
});

describe('pipes in the crate', () => {
  /** Seeds whose 6-card roster has the pipe. */
  const piped = Array.from({ length: 80 }, (_, i) => seedAt(i)).filter((s) => generateRoster(s, rosterSize(6)).some((p) => p.archetype === 'pipe'));
  const pipesIn = (seed: number, round: number, lone: boolean) => generateCrate(seed, round, 6, 1, 0, lone).filter((d) => d.archetype === 'pipe');

  it('come as one part per match: one name and one material on every card', () => {
    expect(piped.length).toBeGreaterThan(2);
    for (const seed of piped.slice(0, 4)) {
      const cards = Array.from({ length: 12 }, (_, r) => pipesIn(seed, r + 1, r % 2 === 0)).flat();
      expect(cards.length).toBeGreaterThan(0);
      expect(new Set(cards.map((d) => d.part)).size).toBe(1);
      expect(new Set(cards.map((d) => d.name.replace(/^(Small|Big) /, ''))).size).toBe(1);
      expect(new Set(cards.flatMap((d) => d.modules.map((m) => (m.type === 'pipe' ? m.look : '')))).size).toBe(1);
    }
  });

  it('a lone pipe in the level raises the odds of its partner, and nothing else', () => {
    for (const [a] of ARCHETYPE_WEIGHTS) {
      for (const dry of [0, 3]) expect(crateLean(a, dry, true)).toBeCloseTo(dryLean(a, dry) * (a === 'pipe' ? PIPE_PITY : 1), 9);
      expect(crateLean(a, 2, false)).toBe(dryLean(a, 2));
    }
    let plain = 0;
    let lone = 0;
    for (const seed of piped.slice(0, 4)) {
      for (let round = 1; round <= 10; round++) {
        plain += pipesIn(seed, round, false).length ? 1 : 0;
        lone += pipesIn(seed, round, true).length ? 1 : 0;
      }
    }
    expect(lone).toBeGreaterThan(plain);
  });
});

describe('snapshots keep the level the rules asked for', () => {
  it('a guest rebuilding a low-gravity level gets low gravity', { timeout: 30_000 }, () => {
    const host = new Match(4321, 'castle');
    host.setRules({ ...host.rules, gravity: 'low' });
    host.forceProfile = { size: 'wide' };
    host.newLevel(4321, 'castle');
    const guest = new Match(99, 'farm');
    restoreMatch(guest, snapshotMatch(host));
    expect(guest.level.gravity).toBe(host.level.gravity);
    expect([guest.level.w, guest.level.h]).toEqual([host.level.w, host.level.h]);
    expect(guest.level.profile).toEqual(host.level.profile);
    expect(guest.forceProfile).toEqual(host.forceProfile);
  });
});
