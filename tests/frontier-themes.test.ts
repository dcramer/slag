import { describe, expect, it } from 'vitest';
import { GRAVITY, generateLevel, isAcceptable, rollProfile } from '../src/gen/level';
import { jumpProfile, probeGravity, setProbeGravity } from '../src/gen/level/probe';
import { SPACE_GRAVITY } from '../src/gen/level/profile';
import { chain, spaceHop } from '../src/gen/level/sculptors/space';
import { Rng } from '../src/core/rng';
import type { Theme } from '../src/gen/theme';
import { Match } from '../src/game/match';
import { TILE } from '../src/sim/constants';
import { GROUND_ICE, groundSurfaceAt, ICE_SURFACE } from '../src/sim/ground';
import { isProtected, type Level, T_SOLID } from '../src/sim/level';
import { bodyAtCell, type CollisionWorld, type Controls, DEFAULT_SURFACE, jumpMetrics, stepBody } from '../src/sim/physics';
import { COAT_SURFACES } from '../src/sim/props/modules/coat';
import { analyzeReach, ReachCache } from '../src/sim/reach';
import { RunWorld } from '../src/sim/run';
import { pickThemeId, THEME_IDS } from '../src/themes';

/**
 * Glacier and space: the two themes that change how you move. Glacier lays
 * the shared ice surface into its own beds (sim/ground.ts); space flies at
 * its own gravity. Both must reach the runner through the same paths every
 * other surface and gravity do, and leave every other theme exactly as it was.
 */

const seedAt = (i: number) => (i * 2654435761 + 4242) >>> 0;

/** A floor 160 tiles long on row 20, all ice from tile 8 on when `ice` is set: room to build a skid and lose it. */
function rink(ice: boolean): Level {
  const w = 160;
  const h = 27;
  const tiles = new Uint8Array(w * h);
  const ground = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) for (let y = 20; y < h; y++) tiles[y * w + x] = T_SOLID;
  if (ice) for (let x = 8; x < w; x++) ground[20 * w + x] = GROUND_ICE;
  return {
    seed: 1,
    w,
    h,
    tiles,
    ground,
    spawn: { tx: 2, ty: 19 },
    goal: { tx: 45, ty: 19 },
    protectedRects: [],
    theme: {} as Theme,
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const press = (o: Partial<Controls>): Controls => ({ left: false, right: false, down: false, jump: false, jumpPressed: false, run: false, ...o });

/** Run right from a standstill on tile 10 for `n` frames, let go, and report top speed and where it stopped. */
function skid(level: Level, n: number): { top: number; slide: number } {
  const world: CollisionWorld = {
    tileAt: (x, y) => (x < 0 || x >= level.w ? 1 : y < 0 || y >= level.h ? 0 : level.tiles[y * level.w + x]),
    solids: [],
    surfaceAt: groundSurfaceAt(level),
  };
  const b = bodyAtCell(10, 19);
  let top = 0;
  for (let f = 0; f < n; f++) {
    stepBody(b, press({ right: true, run: true }), world);
    top = Math.max(top, b.vx);
  }
  const at = b.x;
  for (let f = 0; f < 600 && b.vx > 0; f++) stepBody(b, press({}), world);
  return { top, slide: (b.x - at) / TILE };
}

/** A floor on row 20 and a cliff 8 rows tall at columns 20–23, the goal on top: only a wall climb up its face gets there. */
function cliff(iceFace: boolean): Level {
  const l = rink(false);
  const { w } = l;
  for (let y = 12; y < 20; y++) for (let x = 20; x < 24; x++) l.tiles[y * w + x] = T_SOLID;
  l.ground!.fill(0);
  if (iceFace) for (let y = 12; y < 20; y++) l.ground![y * w + 20] = GROUND_ICE;
  l.goal = { tx: 22, ty: 11 };
  return l;
}

describe('glacier ice', () => {
  it('reach sees it: an ice face can’t be wall-climbed, and a cache keeps up when the ground changes', () => {
    const rock = cliff(false);
    const ice = cliff(true);
    expect(analyzeReach(rock).goalReached).toBe(true);
    expect(analyzeReach(ice).goalReached).toBe(false);
    const cache = new ReachCache(rock);
    expect(cache.analyze(rock).goalReached).toBe(true);
    expect(cache.analyze(ice).goalReached).toBe(false);
    // An equal copy of the ground, as a regenerated level brings, keeps the cache's answers.
    expect(cache.analyze({ ...ice, ground: ice.ground!.slice() }).goalReached).toBe(false);
    expect(cache.analyze(rock).goalReached).toBe(true);
  });

  it('is the ice coat surface, floors and walls alike', () => {
    expect(ICE_SURFACE).toEqual(COAT_SURFACES.ice);
    const s = groundSurfaceAt(rink(true))!;
    expect(s(12, 20)).toBe(ICE_SURFACE);
    expect(s(4, 20)).toEqual(DEFAULT_SURFACE);
    expect(groundSurfaceAt({ ...rink(true), ground: undefined })).toBeUndefined();
  });

  it('skids: slow to start, faster at the top, a long slide to stop', () => {
    const rock = skid(rink(false), 90);
    const ice = skid(rink(true), 90);
    const iceLong = skid(rink(true), 200);
    // Grip: a runner on rock is at full speed long before one on ice.
    expect(ice.top).toBeLessThan(rock.top);
    // But ice's top speed is higher once you've built it up.
    expect(iceLong.top).toBeGreaterThan(rock.top * 1.05);
    expect(iceLong.slide).toBeGreaterThan(rock.slide * 3);
  });

  it('every glacier level lays ice on its own beds, never in a pocket, and stays solvable on it', { timeout: 120_000 }, () => {
    let iced = 0;
    for (let i = 0; i < 8; i++) {
      const l = generateLevel(seedAt(i), 'glacier');
      if (!l.ground) continue;
      iced++;
      expect(l.ground.length).toBe(l.w * l.h);
      for (let k = 0; k < l.ground.length; k++) {
        if (!l.ground[k]) continue;
        expect(l.tiles[k], 'ice only on rock').toBe(T_SOLID);
        expect(isProtected(l, k % l.w, Math.floor(k / l.w)), 'no ice in the pockets').toBe(false);
      }
      expect(isAcceptable(l)).toBe(true);
    }
    expect(iced).toBeGreaterThanOrEqual(6);
  });

  it('reaches the runner and the solver through the same footing', () => {
    const l = generateLevel(seedAt(1), 'glacier', { size: 'classic' });
    const run = new RunWorld(l, [], [0]);
    const k = l.ground!.findIndex((g) => g === GROUND_ICE);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(run.world.surfaceAt!(k % l.w, Math.floor(k / l.w))).toBe(ICE_SURFACE);
  });

  it('no other theme has ground of its own', () => {
    for (const t of THEME_IDS) if (t !== 'glacier') expect(generateLevel(seedAt(2), t, { size: 'classic' }).ground, t).toBeUndefined();
  });
});

describe('space gravity', () => {
  it('is space’s own on Auto, floatier than Low', () => {
    for (let i = 0; i < 20; i++) expect(rollProfile(seedAt(i), 'space').gravity).toBe(SPACE_GRAVITY);
    expect(SPACE_GRAVITY).toBeLessThan(GRAVITY.low);
    expect(jumpMetrics(SPACE_GRAVITY).jumpHeight).toBeGreaterThan(jumpMetrics(GRAVITY.low).jumpHeight * 1.15);
    // Still a precision jump: about a second in the air at most.
    expect(jumpMetrics(SPACE_GRAVITY).jumpAirFrames).toBeLessThanOrEqual(66);
  });

  it('reaches runners and projectiles through the level', () => {
    const l = generateLevel(seedAt(3), 'space', { size: 'classic' });
    expect(l.gravity).toBe(SPACE_GRAVITY);
    expect(new RunWorld(l, [], [0]).world.gravity).toBe(SPACE_GRAVITY);
    expect(analyzeReach(l).goalReached || (l.solution?.length ?? 0) > 0).toBe(true);
  });

  it('gives way to a host’s gravity rule', () => {
    expect(rollProfile(seedAt(4), 'space', { gravity: GRAVITY.high }).gravity).toBe(GRAVITY.high);
    const m = new Match(4242);
    m.setRules({ ...m.rules, gravity: 'normal' });
    expect(m.level.gravity).toBe(GRAVITY.normal);
  });

  it('spaces its bodies by the walking reach at the level’s gravity', () => {
    const was = probeGravity();
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const easyAt = new Map<number, number>();
    for (const g of [SPACE_GRAVITY, GRAVITY.low, GRAVITY.normal, GRAVITY.high]) {
      setProbeGravity(g);
      const j = jumpProfile(g);
      for (const density of [0, 1]) {
        const hop = spaceHop(density);
        // The long end of a walking hop: never more than one, never a seam.
        expect(hop.hi, `${g}`).toBe(Math.max(2, j.walkGap));
        expect(hop.lo, `${g}`).toBeGreaterThanOrEqual(Math.min(hop.hi, Math.max(2, j.walkGap / 2)));
      }
      const easy: number[] = [];
      for (let seed = 1; seed <= 4; seed++) {
        for (const [W, parts] of [
          [48, 1],
          [86, 2],
        ]) {
          const c = chain(new Rng(seed), W, spaceHop(0.5), parts, [3, 7]);
          c.gaps.forEach((gap, i) => {
            if (c.hard[i]) expect(gap, `${g} hard`).toBeGreaterThan(j.gap);
            else easy.push(gap);
          });
          expect(c.hard.filter(Boolean).length).toBe(parts);
        }
      }
      expect(Math.max(...easy), `${g}`).toBeLessThanOrEqual(Math.max(2, j.walkGap));
      easyAt.set(g, mean(easy));
    }
    setProbeGravity(was);
    // Lower gravity, wider voids.
    expect(easyAt.get(SPACE_GRAVITY)!).toBeGreaterThan(easyAt.get(GRAVITY.low)!);
    expect(easyAt.get(GRAVITY.low)!).toBeGreaterThan(easyAt.get(GRAVITY.normal)!);
    expect(easyAt.get(GRAVITY.normal)!).toBeGreaterThan(easyAt.get(GRAVITY.high)!);
  });

  it('floats sparser at its own gravity than under a host’s Normal', () => {
    const solid = (l: Level) => l.tiles.reduce((a, t) => a + (t ? 1 : 0), 0);
    let own = 0;
    let normal = 0;
    for (let i = 0; i < 3; i++) {
      own += solid(generateLevel(seedAt(i), 'space', { size: 'classic' }));
      normal += solid(generateLevel(seedAt(i), 'space', { size: 'classic', gravity: GRAVITY.normal }));
    }
    expect(own).toBeLessThan(normal * 0.9);
  });

  it('floats: no ground under the level, nothing in the bottom rows', () => {
    for (let i = 0; i < 4; i++) {
      const l = generateLevel(seedAt(i), 'space', { size: 'classic' });
      for (let x = 0; x < l.w; x++) expect(l.tiles[(l.h - 1) * l.w + x], `seed ${i} col ${x}`).toBe(0);
    }
  });
});

describe('theme picks', () => {
  it('deal the new themes a share without crowding the old ones', () => {
    const n = 4000;
    const count = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const t = pickThemeId(seedAt(i));
      count.set(t, (count.get(t) ?? 0) + 1);
    }
    for (const t of ['glacier', 'space']) {
      expect(count.get(t)! / n, t).toBeGreaterThan(0.05);
      expect(count.get(t)! / n, t).toBeLessThan(0.11);
    }
    for (const t of THEME_IDS.slice(0, 8)) expect(count.get(t)! / n, t).toBeGreaterThan(0.09);
  });
});
