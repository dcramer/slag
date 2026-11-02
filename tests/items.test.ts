import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { defaultSettings, loadSettings } from '../src/input/bindings';
import { TouchInput, touchLayout } from '../src/input/touch';
import { KILL_Y, LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { DROP_LIFE, giveItem, ITEM_KINDS, ITEMS, type ItemKind, SWORD, spawnItem } from '../src/sim/items';
import type { Level } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { canPlace, type Module, mysteryState, type PlacedProp, type PropDef, rollItem, THROW_GRACE } from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { glyphsFor } from '../src/ui/prompts';

const FLOOR = 20; // first solid row

/** Flat floor from FLOOR down, a wall column at x=30 (rows 10..19), spawn pocket left, goal far right. */
function testLevel(seed = 1): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = 1;
  return {
    seed,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [
      { x: 0, y: FLOOR - 3, w: 5, h: 5 },
      { x: LEVEL_W - 5, y: FLOOR - 3, w: 5, h: 5 },
    ],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** A race past its countdown, runners standing at the given tile columns on the floor. */
function race(cols: number[], placed: PlacedProp[] = [], level = testLevel(), itemSeed?: number): RunWorld {
  const run = new RunWorld(
    level,
    placed,
    cols.map((_, i) => i),
    0,
    itemSeed,
  );
  while (run.frame < RUN_COUNTDOWN) run.step(cols.map(() => NO_INPUT));
  cols.forEach((tx, i) => {
    run.runners[i].body = bodyAtCell(tx, FLOOR - 1);
  });
  return run;
}

function steps(run: RunWorld, n: number, inp: (f: number, i: number) => InputFrame = () => NO_INPUT) {
  for (let k = 0; k < n; k++) run.step(run.runners.map((_, i) => inp(k, i)));
}

/** One frame where only runner `who` presses use. */
const use = (run: RunWorld, who = 0, extra: Partial<InputFrame> = {}) => steps(run, 1, (_f, i) => press(i === who ? { usePressed: true, ...extra } : {}));

const face = (r: Runner, dir: -1 | 1) => (r.body.facing = dir);

function mysteryDef(uses: number, refill = 120, pool: ItemKind[] = [...ITEM_KINDS]): PropDef {
  const def = generateProp(new Rng(4), 'mystery', 'm');
  const m = def.modules[0] as Extract<Module, { type: 'mystery' }>;
  return { ...def, motion: { type: 'none' }, modules: [{ ...m, uses, refill, pool }] };
}

const crateAt = (def: PropDef, tx: number, ty: number, uid = 9): PlacedProp => ({ uid, def, owner: 1, tx, ty, rot: 0 });

/** A lethal shot owned by a rival's prop. */
const bolt = (x: number, y: number, vx: number) => ({ x, y, vx, vy: 0, owner: 5, ammo: 'bolt' as const });

describe('held items: pickup, use, drop', () => {
  it('a runner picks up a loose item by touching it, after its pop grace', () => {
    const run = race([10]);
    const r = run.runners[0];
    spawnItem(run, { kind: 'puck', x: r.body.x + 5, y: r.body.y + 7, vx: 0, vy: 0, grace: 10 });
    steps(run, 5);
    expect(r.items.held).toBeNull();
    steps(run, 10);
    expect(r.items.held).toEqual({ kind: 'puck', uses: ITEMS.puck.uses });
    expect(run.items.drops).toHaveLength(0);
  });

  it('a contested item goes to the nearest runner, and you only carry one', () => {
    const run = race([10, 10]);
    const [a, b] = run.runners;
    b.body.x += 4;
    spawnItem(run, { kind: 'sword', x: b.body.x + 6, y: b.body.y + 7, vx: 0, vy: 0 });
    spawnItem(run, { kind: 'rocket', x: b.body.x + 6, y: b.body.y + 7, vx: 0, vy: 0 });
    steps(run, 1);
    expect(b.items.held?.kind).toBe('sword');
    expect(a.items.held?.kind).toBe('rocket');
    spawnItem(run, { kind: 'smoke', x: a.body.x + 5, y: a.body.y + 7, vx: 0, vy: 0 });
    steps(run, 5);
    expect(a.items.held?.kind).toBe('rocket');
    expect(run.items.drops).toHaveLength(1);
  });

  it('down + use tosses the item forward; you cannot instantly re-grab it', () => {
    const run = race([10]);
    const r = run.runners[0];
    giveItem(r, 'boomerang');
    face(r, 1);
    use(run, 0, { down: true });
    expect(r.items.held).toBeNull();
    expect(run.items.drops).toHaveLength(1);
    expect(run.items.drops[0].vx).toBeGreaterThan(0);
    steps(run, 90);
    expect(run.items.drops).toHaveLength(1);
    expect(run.items.drops[0].x).toBeGreaterThan(r.body.x + r.body.w);
    expect(run.items.drops[0].onGround).toBe(true);
  });

  it('dead and finished runners drop what they hold; loose items fizzle out', () => {
    const run = race([10, 12]);
    const [a, b] = run.runners;
    giveItem(a, 'shield');
    giveItem(b, 'puck');
    a.alive = false;
    a.cause = 'crush';
    b.body = bodyAtCell(run.level.goal.tx, FLOOR - 1);
    steps(run, 2);
    expect(b.finished).toBe(true);
    expect(a.items.held).toBeNull();
    expect(b.items.held).toBeNull();
    expect(run.items.drops.map((d) => d.kind).sort()).toEqual(['puck', 'shield']);
    steps(run, DROP_LIFE + 2);
    expect(run.items.drops).toHaveLength(0);
  });

  it('a runner lost to the pit takes the item with them', () => {
    const level = testLevel();
    for (let y = FLOOR; y < LEVEL_H; y++) level.tiles[y * LEVEL_W + 10] = 0;
    const run = race([10], [], level);
    const r = run.runners[0];
    giveItem(r, 'sword');
    r.body.y = KILL_Y + 1;
    steps(run, 2);
    expect(r.alive).toBe(false);
    expect(r.items.held).toBeNull();
    expect(run.items.drops).toHaveLength(0);
  });

  it('uses run out and the item is gone', () => {
    const run = race([10]);
    const r = run.runners[0];
    giveItem(r, 'smoke');
    for (let i = 0; i < ITEMS.smoke.uses; i++) {
      use(run);
      steps(run, 40);
    }
    expect(r.items.held).toBeNull();
  });

  it('nothing fires before the race is live, and every round starts empty-handed', () => {
    const run = new RunWorld(testLevel(), [], [0]);
    giveItem(run.runners[0], 'puck');
    run.step([press({ usePressed: true })]);
    expect(run.projectiles).toHaveLength(0);
    expect(run.runners[0].items.held?.kind).toBe('puck');
    const next = new RunWorld(testLevel(), [], [0]);
    expect(next.runners[0].items.held).toBeNull();
    expect(next.items.drops).toHaveLength(0);
  });

  it('frozen and dazed runners cannot use items, but can still self-destruct', () => {
    const run = race([10]);
    const r = run.runners[0];
    giveItem(r, 'puck');
    r.status.frozen = 20;
    use(run);
    expect(run.projectiles).toHaveLength(0);
    r.status.frozen = 0;
    r.items.daze = 20;
    use(run);
    expect(run.projectiles).toHaveLength(0);
    steps(run, 1, () => press({ altPressed: true }));
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('pop');
  });
});

describe('held items: each item', () => {
  it('sword bonks a rival flying (not lethal), makes the swinger crawl, and credits a follow-up death', () => {
    const run = race([10, 11]);
    const [a, b] = run.runners;
    giveItem(a, 'sword');
    face(a, 1);
    b.body.x = a.body.x + a.body.w + 4;
    use(run);
    steps(run, SWORD.swing - SWORD.activeHi + 1);
    expect(b.alive).toBe(true);
    expect(b.body.vx).toBeGreaterThan(200);
    expect(b.body.vy).toBeLessThan(0);
    expect(b.items.daze).toBeGreaterThan(0);
    expect(a.items.held?.uses).toBe(ITEMS.sword.uses - 1);
    steps(run, 3, (_f, i) => press({ right: i === 0, run: i === 0 }));
    expect(Math.abs(a.body.vx)).toBeLessThanOrEqual(SWORD.crawl);
    // Knocked into the pit by a rival: the swinger gets the kill.
    b.body.y = 9999;
    steps(run, 1);
    expect(b.alive).toBe(false);
    expect(b.killer).toBe(0);
    expect(run.kills).toContainEqual({ victim: 1, killer: 0 });
  });

  it('two rivals bonking each other in the same frame is symmetric', () => {
    const run = race([10, 11]);
    const [a, b] = run.runners;
    giveItem(a, 'sword');
    giveItem(b, 'sword');
    face(a, 1);
    face(b, -1);
    b.body.x = a.body.x + a.body.w + 2;
    steps(run, 1, () => press({ usePressed: true }));
    steps(run, 6);
    expect(a.items.daze).toBe(b.items.daze);
    expect(Math.abs(a.body.vx)).toBeCloseTo(Math.abs(b.body.vx));
  });

  it('sword swats a shot back and takes ownership of it', () => {
    const run = race([10, 40]);
    const a = run.runners[0];
    giveItem(a, 'sword');
    face(a, 1);
    run.spawnProjectile(bolt(a.body.x + a.body.w + 30, a.body.y + 6, -200));
    use(run);
    steps(run, 8);
    expect(a.alive).toBe(true);
    const p = run.projectiles[0];
    expect(p?.vx).toBeGreaterThan(0);
    expect(p?.owner).toBe(0);
  });

  it('sword leaves rideable gliders and stuck patches alone', () => {
    const run = race([10]);
    const a = run.runners[0];
    giveItem(a, 'sword');
    face(a, 1);
    run.spawnProjectile({ x: a.body.x + 14, y: a.body.y + 4, vx: -60, vy: 0, owner: 5, ammo: 'glider' });
    use(run);
    steps(run, 8);
    expect(run.projectiles[0]?.owner).toBe(5);
    expect(run.projectiles[0]?.vx).toBe(-60);
  });

  it('puck slides along the floor and bonks a rival without killing, credited to the kicker', () => {
    const run = race([10, 16]);
    const [a, b] = run.runners;
    giveItem(a, 'puck');
    face(a, 1);
    use(run);
    expect(run.projectiles.some((p) => p.ammo === 'puck')).toBe(true);
    for (let k = 0; k < 60 && b.items.daze === 0; k++) steps(run, 1);
    expect(b.alive).toBe(true);
    expect(b.items.daze).toBeGreaterThan(0);
    expect(b.body.vx).toBeGreaterThan(100);
    expect(b.items.bonkedBy).toBe(0);
    expect(a.items.held).toBeNull();
    expect(run.projectiles).toHaveLength(0);
  });

  it('puck stays on the floor and ricochets off a wall back at its kicker', () => {
    const run = race([25]);
    const a = run.runners[0];
    giveItem(a, 'puck');
    face(a, 1);
    use(run);
    let bounced = false;
    for (let k = 0; k < 120 && a.items.daze === 0; k++) {
      steps(run, 1);
      const p = run.projectiles[0];
      if (p) {
        expect(p.y).toBeLessThan(FLOOR * TILE);
        bounced ||= p.vx < 0;
      }
    }
    expect(bounced).toBe(true);
    expect(a.alive).toBe(true);
    expect(a.items.daze).toBeGreaterThan(0);
  });

  it('puck comes to rest on a one-way platform instead of falling through', () => {
    const level = testLevel();
    for (let x = 12; x < 22; x++) level.tiles[(FLOOR - 4) * LEVEL_W + x] = 2;
    const run = race([12], [], level);
    const a = run.runners[0];
    a.body.y = (FLOOR - 4) * TILE - a.body.h;
    giveItem(a, 'puck');
    face(a, 1);
    use(run);
    steps(run, 20);
    expect(run.projectiles[0].y).toBeLessThan((FLOOR - 4) * TILE);
  });

  it('boomerang flies out and curves back to the thrower, even after they move', () => {
    const run = race([10]);
    const a = run.runners[0];
    giveItem(a, 'boomerang');
    face(a, 1);
    use(run);
    expect(a.items.held).toBeNull();
    let far = 0;
    for (let k = 0; k < 200 && !a.items.held; k++) {
      steps(run, 1, () => press({ right: true }));
      for (const p of run.projectiles) far = Math.max(far, p.x - a.body.x);
    }
    expect(far).toBeGreaterThan(2 * TILE);
    expect(a.items.held).toEqual({ kind: 'boomerang', uses: 1 });
    expect(run.projectiles).toHaveLength(0);
    expect(a.alive).toBe(true);
  });

  it('boomerang bonks a rival in its path and clatters down for anyone to grab', () => {
    const run = race([10, 13]);
    const [a, b] = run.runners;
    giveItem(a, 'boomerang');
    face(a, 1);
    use(run);
    for (let k = 0; k < 40 && b.items.daze === 0; k++) steps(run, 1);
    expect(b.alive).toBe(true);
    expect(b.items.daze).toBeGreaterThan(0);
    expect(run.items.drops.map((d) => d.kind)).toEqual(['boomerang']);
  });

  it('a launcher boomerang stays lethal, never returns to an item, and drops nothing', () => {
    const run = race([10]);
    const a = run.runners[0];
    run.spawnProjectile({ x: a.body.x + 20, y: a.body.y + 6, vx: -100, vy: 0, owner: 5, ammo: 'boomerang' });
    steps(run, 30);
    expect(a.alive).toBe(false);
    expect(a.killer).toBe(5);
    expect(run.items.drops).toHaveLength(0);
  });

  it('boomerang that hits a wall clatters to the floor as a loose item', () => {
    const run = race([28]);
    const a = run.runners[0];
    giveItem(a, 'boomerang');
    face(a, 1);
    use(run);
    steps(run, 20);
    expect(run.projectiles).toHaveLength(0);
    expect(run.items.drops.map((d) => d.kind)).toEqual(['boomerang']);
  });

  it('a thrown shot cannot hit its thrower while it leaves their hand', () => {
    const run = race([10]);
    const a = run.runners[0];
    giveItem(a, 'smoke');
    a.body.vx = 0;
    use(run);
    steps(run, THROW_GRACE - 2);
    expect(run.projectiles).toHaveLength(1);
  });

  it('shield soaks one lethal hit (then briefly guards), but not a fall or a crush, and it makes jumps lower', () => {
    const peak = (shield: boolean) => {
      const run = race([10]);
      if (shield) giveItem(run.runners[0], 'shield');
      const y0 = run.runners[0].body.y;
      let top = y0;
      for (let k = 0; k < 60; k++) {
        steps(run, 1, () => press({ jump: true, jumpPressed: k === 0 }));
        top = Math.min(top, run.runners[0].body.y);
      }
      return y0 - top;
    };
    expect(peak(true)).toBeLessThan(peak(false) * 0.8);

    const run = race([10]);
    const r = run.runners[0];
    giveItem(r, 'shield');
    run.spawnProjectile(bolt(r.body.x + 20, r.body.y + 6, -200));
    steps(run, 15);
    expect(r.alive).toBe(true);
    expect(r.items.held).toBeNull();
    expect(r.items.guard).toBeGreaterThan(0);
    expect(run.kills).toHaveLength(0);

    const fall = race([10]);
    giveItem(fall.runners[0], 'shield');
    fall.runners[0].body.y = 9999;
    steps(fall, 1);
    expect(fall.runners[0].alive).toBe(false);
  });

  it('shield saves you from a standing hazard long enough to clear it', () => {
    const def = generateProp(new Rng(2), 'spikeblock', 's');
    const run = race([10], [{ uid: 3, def: { ...def, motion: { type: 'none' } }, owner: 1, tx: 10, ty: FLOOR - 1, rot: 0 }]);
    const r = run.runners[0];
    giveItem(r, 'shield');
    steps(run, 1);
    expect(r.alive).toBe(true);
    expect(r.items.held).toBeNull();
    expect(r.body.vy).toBeLessThan(0);
  });

  it('rocket launches far higher than a jump, then dazes you (controls ignored)', () => {
    const run = race([10]);
    const r = run.runners[0];
    giveItem(r, 'rocket');
    const y0 = r.body.y;
    let top = y0;
    use(run);
    let dazedAt = -1;
    let vx0 = 0;
    let grew = false;
    for (let k = 0; k < 50; k++) {
      steps(run, 1, () => press({ right: true, run: true }));
      top = Math.min(top, r.body.y);
      if (r.items.daze > 0) {
        if (dazedAt < 0) [dazedAt, vx0] = [k, r.body.vx];
        grew ||= r.body.vx > vx0 + 1e-9;
        vx0 = r.body.vx;
      }
    }
    expect(y0 - top).toBeGreaterThan(5.5 * TILE);
    expect(dazedAt).toBeGreaterThan(0);
    expect(grew).toBe(false);
    expect(r.items.held).toBeNull();
  });

  it('smoke bomb bursts into a cloud that slows everyone inside', () => {
    const run = race([10, 14]);
    const [a, b] = run.runners;
    giveItem(a, 'smoke');
    face(a, 1);
    use(run);
    for (let k = 0; k < 90 && !run.items.clouds.length; k++) steps(run, 1);
    expect(run.items.clouds).toHaveLength(1);
    b.body = bodyAtCell(Math.floor(run.items.clouds[0].x / TILE), FLOOR - 1);
    let maxVx = 0;
    for (let k = 0; k < 15; k++) {
      steps(run, 1, (_f, i) => press({ right: i === 1, run: true }));
      maxVx = Math.max(maxVx, Math.abs(b.body.vx));
    }
    expect(b.alive).toBe(true);
    expect(maxVx).toBeLessThanOrEqual(75);
  });
});

describe('spawn and goal protection', () => {
  it('sword bonks and knocks stop at the spawn zone', () => {
    const run = race([1, 3]);
    const [a, b] = run.runners;
    giveItem(a, 'sword');
    face(a, 1);
    b.body.x = a.body.x + a.body.w + 4;
    expect(run.isSafe(b)).toBe(true);
    use(run);
    steps(run, 8);
    expect(b.items.daze).toBe(0);
    expect(Math.abs(b.body.vx)).toBeLessThan(1);
  });

  it('thrown shots pop harmlessly on a runner in the spawn zone', () => {
    const run = race([8, 2]);
    const [a, b] = run.runners;
    giveItem(a, 'puck');
    face(a, -1);
    use(run);
    for (let k = 0; k < 60 && run.projectiles.length; k++) steps(run, 1);
    expect(run.projectiles).toHaveLength(0);
    expect(b.alive).toBe(true);
    expect(b.items.daze).toBe(0);
  });

  it('smoke never settles inside a protected zone, and clouds beside it do not slow the safe', () => {
    const run = race([8, 2]);
    const [a, b] = run.runners;
    giveItem(a, 'smoke');
    run.spawnProjectile({ x: 2 * TILE, y: (FLOOR - 1) * TILE + 12, vx: 0, vy: 200, owner: 0, ammo: 'smokebomb' });
    steps(run, 10);
    expect(run.items.clouds).toHaveLength(0);
    run.items.clouds.push({ x: b.body.x, y: b.body.y, r: 40, born: run.frame, until: run.frame + 60 });
    steps(run, 5);
    expect(b.status.slowed).toBe(0);
    expect(a.status.slowed).toBe(0);
  });

  it('finished runners are out of reach: no bonks, no pickups', () => {
    const run = race([20, 44]);
    const [a, b] = run.runners;
    b.body = bodyAtCell(run.level.goal.tx, FLOOR - 1);
    steps(run, 1);
    expect(b.finished).toBe(true);
    giveItem(a, 'sword');
    face(a, 1);
    a.body.x = b.body.x - a.body.w - 4;
    a.body.y = b.body.y;
    spawnItem(run, { kind: 'puck', x: b.body.x + 5, y: b.body.y + 7, vx: 0, vy: 0 });
    use(run);
    steps(run, 8);
    expect(b.items.daze).toBe(0);
    expect(b.items.held).toBeNull();
  });

  it('a crate cannot be placed in a protected zone', () => {
    const def = mysteryDef(0);
    const level = testLevel();
    expect(canPlace(level, [], def, 0, 2, FLOOR - 2)).toBe(false);
    expect(canPlace(level, [], def, 0, LEVEL_W - 3, FLOOR - 2)).toBe(false);
    expect(canPlace(level, [], def, 0, 12, FLOOR - 2)).toBe(true);
  });
});

describe('mystery crate', () => {
  it('hitting it from below pops the seeded item out of the top; limited crates are then spent', () => {
    const def = mysteryDef(1);
    const run = race([10], [crateAt(def, 10, FLOOR - 4)]);
    steps(run, 30, (f) => press({ jump: f < 25, jumpPressed: f === 0 }));
    const st = run.propState.get(9)!;
    expect(mysteryState(st, 0).pops).toBe(1);
    const pool = def.modules[0].type === 'mystery' ? def.modules[0].pool : [];
    const got = run.items.drops[0]?.kind ?? run.runners[0].items.held?.kind;
    expect(got).toBe(rollItem(pool, run.itemSeed, 9, 0, 0));
    run.items.drops.length = 0;
    run.runners[0].items.held = null;
    steps(run, 200, (f) => press({ jump: f % 50 < 25, jumpPressed: f % 50 === 0 }));
    expect(mysteryState(st, 0).pops).toBe(1);
  });

  it('a refilling crate pops again after its refill time, and side bumps count', () => {
    const def = mysteryDef(0, 100);
    const run = race([8], [crateAt(def, 10, FLOOR - 1)]);
    steps(run, 40, () => press({ right: true }));
    const st = run.propState.get(9)!;
    expect(mysteryState(st, 0).pops).toBe(1);
    steps(run, 50, () => press({ right: true }));
    expect(mysteryState(st, 0).pops).toBe(1);
    steps(run, 80, () => press({ right: true }));
    expect(mysteryState(st, 0).pops).toBe(2);
  });

  it('under a low roof it pops out of the bottom, so the item is never buried', () => {
    const level = testLevel();
    level.tiles[(FLOOR - 5) * LEVEL_W + 10] = 1;
    const run = race([10], [crateAt(mysteryDef(1), 10, FLOOR - 4)], level);
    steps(run, 12, (f) => press({ jump: f < 25, jumpPressed: f === 0 }));
    expect(mysteryState(run.propState.get(9), 0).pops).toBe(1);
    expect(run.items.drops[0]?.y).toBeGreaterThan((FLOOR - 3) * TILE);
  });

  it('standing on top never pops it', () => {
    const def = mysteryDef(0, 60);
    const run = race([10], [crateAt(def, 10, FLOOR - 3)]);
    run.runners[0].body = bodyAtCell(10, FLOOR - 4);
    steps(run, 120, (f) => press({ right: f % 40 < 3, left: f % 40 > 20 && f % 40 < 23 }));
    expect(mysteryState(run.propState.get(9), 0).pops).toBe(0);
  });

  it('it is solid: you can stand on it', () => {
    const run = race([10], [crateAt(mysteryDef(0), 10, FLOOR - 1)]);
    const r = run.runners[0];
    r.body = bodyAtCell(10, FLOOR - 3);
    steps(run, 30);
    expect(r.body.onGround).toBe(true);
    expect(r.body.y + r.body.h).toBeCloseTo((FLOOR - 1) * TILE, 0);
  });

  it('rolls are deterministic for a race seed, vary across pops, and differ between rounds', () => {
    const pool = [...ITEM_KINDS];
    const a = Array.from({ length: 30 }, (_, n) => rollItem(pool, 7, 9, 0, n));
    expect(a).toEqual(Array.from({ length: 30 }, (_, n) => rollItem(pool, 7, 9, 0, n)));
    expect(new Set(a).size).toBeGreaterThan(3);
    expect(a).not.toEqual(Array.from({ length: 30 }, (_, n) => rollItem(pool, 8, 9, 0, n)));
  });

  it("a crate that survives a round rolls with that round's seed, not the level seed", () => {
    const popFirst = (itemSeed: number) => {
      const run = race([8], [crateAt(mysteryDef(1), 10, FLOOR - 1)], testLevel(), itemSeed);
      steps(run, 40, () => press({ right: true }));
      return run.items.drops[0]?.kind ?? run.runners[0].items.held?.kind;
    };
    const kinds = new Set(Array.from({ length: 12 }, (_, i) => popFirst(1000 + i)));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('the generator rolls one-cell crates with real pools', () => {
    for (let i = 0; i < 40; i++) {
      const def = generateProp(new Rng(i + 1), 'mystery', `m${i}`);
      const m = def.modules[0] as Extract<Module, { type: 'mystery' }>;
      expect(m.pool.length).toBeGreaterThan(0);
      expect(m.pool.every((k) => ITEM_KINDS.includes(k))).toBe(true);
      expect(def.footprint).toEqual([[0, 0]]);
    }
  });
});

describe('items never break determinism', () => {
  /** Snapshot everything that matters as plain JSON. */
  function snapshot(run: RunWorld): string {
    return JSON.stringify({
      f: run.frame,
      runners: run.runners,
      projectiles: run.projectiles,
      items: run.items,
      kills: run.kills,
      props: [...run.propState.entries()].map(([k, v]) => [k, v.lastFire, [...v.vars.entries()]]),
    });
  }

  function chaos(): string {
    const def = mysteryDef(0, 45);
    const placed = [6, 14, 22, 34, 40].map((tx, i) => ({ uid: 20 + i, def, owner: i % 4, tx, ty: FLOOR - 4, rot: 0 }));
    const run = race([6, 12, 20, 26, 34, 40], placed);
    run.runners.forEach((r, i) => giveItem(r, ITEM_KINDS[i % ITEM_KINDS.length]));
    const rng = new Rng(1234);
    const held = run.runners.map(() => ({ left: false, right: false, jump: false, run: false }));
    for (let f = 0; f < 900; f++) {
      const inputs = run.runners.map((_, i) => {
        const h = held[i];
        if (rng.chance(0.08)) h.left = rng.chance(0.4);
        if (rng.chance(0.08)) h.right = !h.left && rng.chance(0.6);
        if (rng.chance(0.1)) h.run = rng.chance(0.5);
        const jp = rng.chance(0.05);
        if (jp) h.jump = true;
        else if (rng.chance(0.1)) h.jump = false;
        return press({ ...h, jumpPressed: jp, usePressed: rng.chance(0.03), down: rng.chance(0.02) });
      });
      run.step(inputs);
    }
    return snapshot(run);
  }

  it('two identical chaotic runs with crates and every item end in identical state', () => {
    const a = chaos();
    expect(a).toBe(chaos());
    // Sanity: the run actually exercised the system.
    const s = JSON.parse(a);
    expect(s.props.some((p: [number, number, [string, number][]]) => p[2].some(([k, v]) => k === '0:pops' && v > 0))).toBe(true);
  });

  it('item state is plain JSON: a snapshot round-trips', () => {
    const run = race([10, 14]);
    giveItem(run.runners[0], 'sword');
    spawnItem(run, { kind: 'rocket', x: 200, y: 200, vx: 0, vy: 0 });
    run.items.clouds.push({ x: 100, y: 100, r: 40, born: run.frame, until: run.frame + 60 });
    const plain = { items: run.items, runner: run.runners[0].items };
    expect(JSON.parse(JSON.stringify(plain))).toEqual(plain);
  });
});

describe('use input', () => {
  it('every keyboard profile binds use, never on keys that also rotate, jump, confirm or run', () => {
    const s = defaultSettings();
    for (const p of [s.single, s.left, s.right]) {
      expect(p.use.length).toBeGreaterThan(0);
      for (const c of p.use) for (const a of ['alt', 'jump', 'confirm', 'run'] as const) expect(p[a]).not.toContain(c);
    }
  });

  it('settings saved before `use` existed fill it in without stealing a rebound key', () => {
    const saved = defaultSettings() as unknown as { single: Record<string, string[]> };
    delete saved.single.use;
    saved.single.alt = ['KeyE'];
    const store = new Map([['slag.input.v1', JSON.stringify(saved)]]);
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null };
    const s = loadSettings();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(s.single.use).toEqual(['KeyL']);
    expect(s.single.alt).toEqual(['KeyE']);
  });

  it('touch: the USE button appears only while holding an item and latches one press', () => {
    const t = new TouchInput();
    t.layout = touchLayout(844, 390);
    t.setMode('race');
    const { x, y } = t.layout.use;
    t.down(1, x, y);
    expect(t.sample().usePressed).toBe(false);
    expect(t.holding('jump')).toBe(true);
    t.up(1, x, y);
    t.useReady = true;
    t.down(2, x, y);
    expect(t.sample().usePressed).toBe(true);
    expect(t.sample().usePressed).toBe(false);
    t.up(2, x, y);
  });

  it('touch: the USE button sits clear of JUMP, ALT and the menu on small and large screens', () => {
    for (const [w, h] of [
      [667, 375],
      [844, 390],
      [1024, 768],
    ]) {
      const L = touchLayout(w, h);
      for (const c of [L.primary, L.secondary, L.menu]) {
        expect(Math.hypot(c.x - L.use.x, c.y - L.use.y)).toBeGreaterThanOrEqual(c.r + L.use.r);
      }
    }
  });

  it('prompts name a key and a pad button for use', () => {
    const profile = defaultSettings().single;
    expect(glyphsFor('use', { profile, modes: ['keyboard', 'gamepad'] })).toEqual([
      { kind: 'key', label: 'E' },
      { kind: 'pad', button: 'Y' },
    ]);
  });
});
