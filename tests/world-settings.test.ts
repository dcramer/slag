import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { ITEM_KINDS, spawnItem } from '../src/sim/items';
import { killY, type Level } from '../src/sim/level';
import { type Ammo, makeProjectile, type Projectile } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/**
 * Per-level world settings reaching the props: gravity scales every ballistic
 * projectile, and nothing assumes the classic 48×27 world.
 */

const open = (w: number, h: number, gravity: number): Level => {
  const base = generateLevel(1, 'farm', { size: 'classic' });
  const tiles = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) tiles[(h - 1) * w + x] = 1;
  const row = h - 2;
  return {
    ...base,
    w,
    h,
    gravity,
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: w - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: w - 5, y: row - 3, w: 5, h: 5 },
    ],
    setPieces: [],
    solution: [],
  };
};

/** Run one shot through the real RunWorld until it ends; returns its flight and everything it spawned. */
function fly(l: Level, ammo: Ammo, x: number, y: number, vx: number, vy: number, frames = 400) {
  const run = new RunWorld(l, [], []);
  const shot: Projectile = makeProjectile({ x, y, vx, vy, owner: 0, ammo }, run.frame, 1);
  run.projectiles.push(shot);
  let top = y;
  let far = x;
  let life = 0;
  const seen = new Set<Ammo>();
  for (let f = 0; f < frames; f++) {
    run.step([]);
    for (const p of run.projectiles) seen.add(p.ammo);
    if (run.projectiles.includes(shot)) {
      top = Math.min(top, shot.y);
      far = Math.max(far, shot.x);
      life++;
    }
    if (run.projectiles.length === 0 && f > RUN_COUNTDOWN) break;
  }
  return { top, far, life, seen };
}

describe('level gravity reaches projectiles', () => {
  const y = 26 * TILE;
  const x = 40 * TILE;
  for (const ammo of ['cannonball', 'rubber', 'cluster', 'goo'] as const) {
    it(`${ammo} flies higher in low gravity and lower in high gravity`, () => {
      const peak = (g: number) => y - fly(open(80, 40, g), ammo, x, y, 0, -220).top;
      const low = peak(0.7);
      const normal = peak(1);
      const high = peak(1.35);
      expect(low).toBeGreaterThan(normal * 1.2);
      expect(high).toBeLessThan(normal * 0.9);
    });
  }

  it('cluster bursts into shrapnel at every gravity, and shrapnel obeys it too', () => {
    const peaks = [0.7, 1, 1.35].map((g) => {
      const { seen } = fly(open(80, 40, g), 'cluster', x, y, 40, -240);
      expect(seen.has('shrapnel'), `gravity ${g}`).toBe(true);
      return y - fly(open(80, 40, g), 'shrapnel', x, y, 0, -200).top;
    });
    expect(peaks[0]).toBeGreaterThan(peaks[1]);
    expect(peaks[1]).toBeGreaterThan(peaks[2]);
  });

  it('rubber keeps bouncing off the floor under every gravity', () => {
    for (const g of [0.7, 1, 1.35]) expect(fly(open(80, 40, g), 'rubber', x, 30 * TILE, 30, 200).life, `gravity ${g}`).toBeGreaterThan(60);
  });

  it('gliders hold their line whatever the gravity: they fly, they do not fall', () => {
    const path = (g: number) => fly(open(80, 40, g), 'glider', 20 * TILE, 20 * TILE, 90, 0, 120).far;
    expect(path(0.7)).toBeCloseTo(path(1), 3);
    expect(path(1.35)).toBeCloseTo(path(1), 3);
  });
});

describe('held items in the level, not in a classic world', () => {
  /** Frames a dropped item takes to fall from row 4, and whether it survived the fall. */
  const fall = (l: Level) => {
    const run = new RunWorld(l, [], [0]);
    spawnItem(run, { kind: ITEM_KINDS[0], x: 16 * TILE, y: 4 * TILE, vx: 0, vy: 0, grace: 0 });
    const drop = run.items.drops[0];
    for (let f = 0; f < 240; f++) {
      run.step([NO_INPUT]);
      if (drop.onGround) return { frames: f, kept: run.items.drops.includes(drop) };
      if (!run.items.drops.includes(drop)) break;
    }
    return { frames: Infinity, kept: run.items.drops.includes(drop) };
  };

  it('a drop on a tall level falls past the classic bottom and lands on the real floor', () => {
    const r = fall(open(32, 60, 1));
    expect(r.kept).toBe(true);
    expect(r.frames).toBeLessThan(Infinity);
  });

  it('drops fall faster under high gravity', () => {
    expect(fall(open(32, 60, 1.35)).frames).toBeLessThan(fall(open(32, 60, 1)).frames);
    expect(fall(open(32, 60, 0.7)).frames).toBeGreaterThan(fall(open(32, 60, 1)).frames);
  });
});

describe('projectiles and parts on variable-size levels', () => {
  it("a shot keeps flying past the classic width on a wide level, and stops at that level's edge", () => {
    const wide = open(96, 30, 1);
    const { far } = fly(wide, 'bolt', 40 * TILE, 10 * TILE, 360, 0);
    expect(far).toBeGreaterThan(48 * TILE + 100);
    expect(far).toBeLessThanOrEqual(96 * TILE + 32);
  });

  it('a shot keeps falling past the classic height on a tall level', () => {
    const tall = open(32, 60, 1);
    const { life } = fly(tall, 'cannonball', 16 * TILE, 4 * TILE, 0, 0);
    // Free fall from row 4 past row 27 takes well over the classic world's frames.
    expect(life).toBeGreaterThan(40);
    expect(new RunWorld(tall, [], []).projectiles).toEqual([]);
  });

  it('the pit kills at the bottom of the level, not the bottom of a classic one', () => {
    const tall = open(32, 60, 1);
    // No floor under this runner: everything from row 40 down is air.
    tall.tiles.fill(0);
    for (let x = 0; x < 8; x++) tall.tiles[41 * tall.w + x] = 1;
    tall.spawn = { tx: 3, ty: 40 };
    tall.protectedRects = [{ x: 0, y: 37, w: 5, h: 5 }];
    const run = new RunWorld(tall, [], [0]);
    run.runners[0].body.x = 20 * TILE;
    run.runners[0].body.y = 30 * TILE;
    for (let f = 0; f < 240 && run.runners[0].alive; f++) {
      if (run.runners[0].alive) expect(run.runners[0].body.y).toBeLessThanOrEqual(killY(tall) + 32);
      run.step([NO_INPUT]);
    }
    expect(run.runners[0].alive).toBe(false);
    expect(run.runners[0].body.y).toBeGreaterThan(27 * TILE);
  });
});
