import { describe, expect, it } from 'vitest';
import { type Cell, normalizeCells } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { Match } from '../src/game/match';
import { THEME_IDS } from '../src/themes';
import { DT, PHYS, PLAYER_H, PLAYER_W, POP_HOLD, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { giveItem } from '../src/sim/items';
import type { Level } from '../src/sim/level';
import {
  blastSpec,
  canPlace,
  COMPASS,
  detonate,
  footprintCells,
  hangRow,
  KEG,
  kegAim,
  makeProjectile,
  type Module,
  moduleSim,
  type ModuleOf,
  newPropState,
  type PlacedProp,
  type PropDef,
  REGRAB,
  resolveProp,
  ROPE,
} from '../src/sim/props';
import { type Runner, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const W = 48;
const H = 27;
const FLOOR = 22;
const CEIL = 6;

/** Open room: floor from FLOOR down, a ceiling slab along row CEIL over x 8..39. */
function room(): Level {
  const tiles = new Uint8Array(W * H);
  for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = 1;
  for (let x = 8; x < 40; x++) tiles[CEIL * W + x] = 1;
  return {
    seed: 1,
    w: W,
    h: H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 5 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

function def(modules: Module[], extra: Partial<PropDef> = {}): PropDef {
  const cells = new Map<string, Cell>();
  for (const m of modules) for (const c of moduleSim(m.type).anchors(m)) cells.set(`${c[0]},${c[1]}`, c);
  return {
    key: 't',
    name: 't',
    maker: '',
    archetype: 'platform',
    role: 'utility',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
    motion: { type: 'none' },
    modules,
    footprint: normalizeCells([...cells.values()]),
    ...extra,
  };
}

let uid = 1;
const place = (d: PropDef, tx: number, ty: number, rot = 0, owner = 7): PlacedProp => ({ uid: uid++, def: d, owner, tx, ty, rot });

const ropeDef = (length = 8, strain = 600) => def([{ type: 'rope', at: [0.5, 0], length, strain, regrow: 120 }], { mount: 'hang' });
const kegDef = (dirs: number[] = [6], o: Partial<ModuleOf<'keg'>> = {}) =>
  def([{ type: 'keg', at: [1, 1], dirs, step: 40, power: 500, delay: 10, burn: 150, ...o }]);

/** A rope hanging into the room at column `tx`. */
const hang = (tx = 20, len = 8, strain = 600) => place(ropeDef(len, strain), tx, CEIL + 1);

function race(level: Level, props: PlacedProp[], n = 1) {
  const run = new RunWorld(
    level,
    props,
    Array.from({ length: n }, (_, i) => i),
  );
  run.frame = RUN_COUNTDOWN;
  return { run, r: run.runners[0] };
}

/** Put a runner's center at world (x, y), in the air, moving at (vx, vy). */
function fly(r: Runner, x: number, y: number, vx = 0, vy = 0) {
  r.body.x = x - r.body.w / 2;
  r.body.y = y - r.body.h / 2;
  r.body.vx = vx;
  r.body.vy = vy;
  r.body.onGround = false;
  r.body.groundRef = -1;
}

const midX = (tx: number) => (tx + 0.5) * TILE;
const midY = (ty: number) => (ty + 0.5) * TILE;
const center = (r: Runner) => r.body.x + r.body.w / 2;
const JUMP: InputFrame = { ...NO_INPUT, jump: true, jumpPressed: true };
const steps = (run: RunWorld, n: number, inp: InputFrame = NO_INPUT) => {
  for (let i = 0; i < n; i++) run.step(run.runners.map(() => inp));
};

/** Fly into a rope at column 20 and let the grab settle. */
function grabbed(vx = 0, props: PlacedProp[] = [hang()], n = 1) {
  const { run, r } = race(room(), props, n);
  fly(r, midX(20), midY(12), vx, 0);
  steps(run, 1);
  expect(r.attach.grip).not.toBeNull();
  return { run, r };
}

describe('hanging placement', () => {
  it('needs a ceiling right above it or open sky all the way up, and ignores rotation', () => {
    const level = room();
    const d = ropeDef(4);
    expect(canPlace(level, [], d, 0, 20, CEIL + 1)).toBe(true);
    expect(canPlace(level, [], d, 0, 20, CEIL + 2)).toBe(false);
    expect(canPlace(level, [], d, 0, 42, 9)).toBe(true);
    for (let rot = 0; rot < 4; rot++) {
      expect(canPlace(level, [], d, rot, 20, CEIL + 1)).toBe(true);
      expect(footprintCells({ def: d, rot, tx: 20, ty: CEIL + 1 })).toEqual(footprintCells({ def: d, rot: 0, tx: 20, ty: CEIL + 1 }));
    }
  });

  it('hangs from static placed blocks, and the ghost drops onto the nearest ceiling', () => {
    const level = room();
    const d = ropeDef(4);
    const block = place(def([{ type: 'body', cells: [[0, 0]], material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 }]), 24, 12);
    expect(canPlace(level, [block], d, 0, 24, 13)).toBe(true);
    expect(hangRow(level, [], d, 20, CEIL + 3)).toBe(CEIL + 1);
    expect(hangRow(level, [], d, 42, 9)).toBe(9);
  });

  it('never reaches into a protected zone', () => {
    const level = room();
    level.tiles[(FLOOR - 6) * W + 2] = 1;
    expect(canPlace(level, [], ropeDef(4), 0, 2, FLOOR - 5)).toBe(false);
  });

  it('falls with its ceiling, whatever destroys it', () => {
    const level = room();
    const p = hang(20, 4);
    const drill = blastSpec({ radius: 1, shape: 'line', target: 'terrain' });
    expect(detonate(level, [p], drill, 20, CEIL, 0)).toEqual([]);
    const emp = blastSpec({ radius: 1, target: 'props' });
    const q = hang(25, 4);
    expect(detonate(room(), [q], emp, 25, CEIL + 2, 0)).toEqual([]);
  });

  it('a rope lowered from open sky survives a blast nearby and can still be hit itself', () => {
    const level = room();
    const p = place(ropeDef(4), 42, 9);
    expect(detonate(level, [p], blastSpec({ radius: 1, shape: 'line', target: 'terrain' }), 20, CEIL, 0)).toEqual([p]);
    expect(detonate(level, [p], blastSpec({ radius: 1, target: 'props' }), 42, 11, 0)).toEqual([]);
  });

  it('always has somewhere to go, on every theme and at every length', () => {
    for (const theme of THEME_IDS) {
      for (const seed of [11, 12]) {
        const lv = generateLevel(seed, theme);
        for (const n of [3, 7]) {
          const d = ropeDef(n);
          let found = false;
          for (let ty = 0; ty < lv.h && !found; ty++) for (let tx = 0; tx < lv.w && !found; tx++) found = canPlace(lv, [], d, 0, tx, ty);
          expect(found, `${theme} ${seed} length ${n}`).toBe(true);
        }
      }
    }
  });
});

describe('rope', () => {
  it('grabs a runner in the air, but not one standing on the ground', () => {
    const { run, r } = race(room(), [place(ropeDef(16), 20, CEIL + 1)]);
    r.body.x = midX(20) - PLAYER_W / 2;
    r.body.y = FLOOR * TILE - PLAYER_H;
    r.body.onGround = true;
    r.body.groundRef = -2;
    steps(run, 5);
    expect(r.attach.grip).toBeNull();
    steps(run, 1, JUMP);
    steps(run, 2, { ...NO_INPUT, jump: true });
    expect(r.attach.grip).not.toBeNull();
  });

  it('does not grab during the countdown', () => {
    const { run, r } = race(room(), [hang()]);
    run.frame = 0;
    fly(r, midX(20), midY(12));
    steps(run, 3);
    expect(r.attach.grip).toBeNull();
  });

  it('turns a running jump into a swing past the hook', () => {
    const { run, r } = grabbed(215);
    let far = 0;
    for (let i = 0; i < 40; i++) {
      steps(run, 1);
      far = Math.max(far, center(r) - midX(20));
    }
    expect(far).toBeGreaterThan(3 * TILE);
  });

  it('swings back and forth by itself, losing a little height each way', () => {
    const { run, r } = grabbed(215);
    const peaks: number[] = [];
    let last = r.body.vx;
    for (let i = 0; i < 360 && peaks.length < 3; i++) {
      steps(run, 1);
      if (last * r.body.vx < 0) peaks.push(Math.abs(center(r) - midX(20)));
      last = r.body.vx;
    }
    expect(peaks.length).toBe(3);
    expect(peaks[2]).toBeLessThan(peaks[0]);
    expect(peaks[2]).toBeGreaterThan(peaks[0] * 0.5);
  });

  it('keeps the grip on the circle around the hook', () => {
    const { run, r } = grabbed(215);
    const g = r.attach.grip!;
    for (let i = 0; i < 120; i++) {
      steps(run, 1, i % 40 < 20 ? { ...NO_INPUT, left: true } : { ...NO_INPUT, right: true });
      expect(Math.sqrt(g.x * g.x + g.y * g.y)).toBeCloseTo(g.len, 6);
      expect(g.y).toBeGreaterThan(0);
    }
  });

  it('left and right pump a dead hang into a real swing', () => {
    const { run, r } = grabbed(0);
    let top = 0;
    for (let i = 0; i < 180; i++) {
      const g = r.attach.grip!;
      // Push along whichever way it's already moving.
      steps(run, 1, g.s >= 0 ? { ...NO_INPUT, right: true } : { ...NO_INPUT, left: true });
      top = Math.max(top, Math.abs(r.body.vx));
    }
    expect(top).toBeGreaterThan(215);
    const { run: idle, r: still } = grabbed(0);
    steps(idle, 180);
    expect(Math.abs(still.body.vx)).toBeLessThan(5);
  });

  it("jump lets go on the swing's tangent, faster than anyone can run", () => {
    const { run, r } = grabbed(215);
    for (let i = 0; i < 150; i++) steps(run, 1, r.attach.grip!.s >= 0 ? { ...NO_INPUT, right: true } : { ...NO_INPUT, left: true });
    while (r.attach.grip!.s < 0 || Math.abs(r.attach.grip!.x) > 6)
      steps(run, 1, r.attach.grip!.s >= 0 ? { ...NO_INPUT, right: true } : { ...NO_INPUT, left: true });
    expect(r.body.vx).toBeGreaterThan(PHYS.runSpeed);
    steps(run, 1, JUMP);
    expect(r.attach.grip).toBeNull();
    const vx = r.body.vx;
    expect(vx).toBeGreaterThan(PHYS.runSpeed);
    // Letting go lifts you a little, and from there the swing's speed carries on through the normal controller.
    expect(r.body.vy).toBeLessThan(0);
    const x0 = center(r);
    const steer = { ...NO_INPUT, right: true };
    steps(run, 30, steer);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vx).toBeGreaterThan(PHYS.walkSpeed);
    expect(center(r) - x0).toBeGreaterThan(30 * DT * PHYS.runSpeed);
  });

  it('ignores a jump pressed right after the grab', () => {
    const { run, r } = grabbed(0);
    steps(run, ROPE.grace - 2, JUMP);
    expect(r.attach.grip).not.toBeNull();
  });

  it('will not re-grab the same rope for a moment, but another one at once', () => {
    const a = hang(20);
    const b = hang(24);
    const { run, r } = grabbed(0, [a, b]);
    steps(run, ROPE.grace);
    steps(run, 1, JUMP);
    expect(r.attach.grip).toBeNull();
    fly(r, midX(20), midY(12));
    steps(run, REGRAB - 4);
    fly(r, midX(20), midY(12));
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
    fly(r, midX(24), midY(12));
    steps(run, 1);
    expect(r.attach.grip?.uid).toBe(b.uid);
    steps(run, ROPE.grace);
    steps(run, 1, JUMP);
    expect(r.attach.grip).toBeNull();
    for (let i = 0; i < REGRAB + 2; i++) {
      fly(r, midX(16), midY(12));
      steps(run, 1);
    }
    fly(r, midX(24), midY(12));
    steps(run, 1);
    expect(r.attach.grip?.uid).toBe(b.uid);
  });

  it('snaps under you if you hang on too long, then grows back', () => {
    const p = hang(20, 8, 90);
    const { run, r } = grabbed(120, [p]);
    steps(run, 88);
    expect(r.attach.grip).not.toBeNull();
    steps(run, 3);
    expect(r.attach.grip).toBeNull();
    expect(run.isBroken(p.uid)).toBe(true);
    expect(r.alive).toBe(true);
    expect(run.drainEvents().some((e) => e.type === 'prop' && e.kind === 'rope-snap')).toBe(true);
    fly(r, midX(20), midY(12));
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
    steps(run, 130);
    fly(r, midX(20), midY(12));
    steps(run, 1);
    expect(r.attach.grip).not.toBeNull();
  });

  it("hangs you below a sky rope's hook even if you touch it from above, and you still swing", () => {
    const level = room();
    const p = place(ropeDef(5), 42, 9);
    const { run, r } = race(level, [p]);
    fly(r, midX(42), 9 * TILE - 2, 215, 60);
    steps(run, 2);
    const g = r.attach.grip!;
    expect(g.y).toBeGreaterThan(0);
    expect(g.hooked).toBe(false);
    const x0 = center(r);
    steps(run, 12);
    expect(center(r) - x0).toBeGreaterThan(4);
    expect(Number.isFinite(r.body.x + r.body.y + r.body.vx + r.body.vy)).toBe(true);
  });

  it('bounces off terrain instead of passing through it', () => {
    const level = room();
    for (let y = CEIL + 1; y < FLOOR; y++) level.tiles[y * W + 24] = 1;
    const { run, r } = race(level, [hang()]);
    fly(r, midX(20), midY(12), 320);
    for (let i = 0; i < 90; i++) {
      steps(run, 1);
      expect(r.body.x + r.body.w).toBeLessThanOrEqual(24 * TILE);
    }
    expect(r.attach.grip).not.toBeNull();
  });

  it('holds one runner at a time, and a tie goes to the nearer one whatever the slot', () => {
    const { run } = race(room(), [hang()], 3);
    const [a, b, c] = run.runners;
    fly(a, midX(20) + 4, midY(12));
    fly(b, midX(20), midY(10));
    fly(c, midX(20), midY(14));
    steps(run, 1);
    expect(b.attach.grip).not.toBeNull();
    expect(a.attach.grip).toBeNull();
    expect(c.attach.grip).toBeNull();
    fly(c, midX(20), midY(14));
    steps(run, 1);
    expect(c.attach.grip).toBeNull();
  });
});

describe('keg', () => {
  const inKeg = (d: PropDef = kegDef(), rot = 0) => {
    const p = place(d, 20, 12, rot);
    const { run, r } = race(room(), [p]);
    fly(r, 20.5 * TILE, 12.5 * TILE);
    steps(run, 1);
    expect(r.attach.grip).not.toBeNull();
    return { run, r, p };
  };
  const held = (r: Runner) => r.attach.grip!;

  it('pulls you to its center and holds you there, on foot or in the air', () => {
    const { run, r } = inKeg();
    steps(run, 20);
    expect(center(r)).toBeCloseTo(21 * TILE, 3);
    expect(r.body.y + r.body.h / 2).toBeCloseTo(13 * TILE, 3);
    expect(r.body.vx).toBe(0);
    expect(r.body.vy).toBe(0);
    expect(r.body.onGround).toBe(false);
    expect(held(r).sealed).toBe(true);
  });

  it('fires along its aim a short delay after jump', () => {
    for (const [dir, rot, want] of [
      [6, 0, 6],
      [0, 0, 0],
      [7, 0, 7],
      [6, 1, 0],
      [6, 2, 2],
    ]) {
      const d = kegDef([dir], { delay: 12 });
      const { run, r } = inKeg(d, rot);
      steps(run, 12);
      expect(held(r).fuse).toBe(-1);
      steps(run, 1, JUMP);
      steps(run, 10);
      expect(r.attach.grip).not.toBeNull();
      steps(run, 3);
      expect(r.attach.grip).toBeNull();
      const n = Math.sqrt(r.body.vx ** 2 + r.body.vy ** 2);
      expect(n).toBeGreaterThan(400);
      expect(r.body.vx / n).toBeCloseTo(COMPASS[want][0], 1);
    }
  });

  it('an upward shot beats a full jump', () => {
    const { run, r } = inKeg(kegDef([6], { power: 560, delay: 4 }));
    steps(run, 14);
    const y0 = r.body.y;
    steps(run, 1, JUMP);
    let top = y0;
    for (let i = 0; i < 40; i++) {
      steps(run, 1);
      top = Math.min(top, r.body.y);
    }
    expect(y0 - top).toBeGreaterThan(4 * TILE);
  });

  it('catches you again if a straight-up shot drops you back in', () => {
    const { run, r } = inKeg(kegDef([6], { power: 420, delay: 4 }));
    steps(run, 14);
    steps(run, 1, JUMP);
    steps(run, 6);
    expect(r.attach.grip).toBeNull();
    steps(run, 90);
    expect(r.attach.grip).not.toBeNull();
  });

  it('a jump pressed while being stuffed in still counts', () => {
    const { run, r } = inKeg(kegDef([6], { delay: 4 }));
    steps(run, 1, JUMP);
    expect(held(r).fuse).toBeGreaterThanOrEqual(0);
    while (r.attach.grip) steps(run, 1);
    expect(r.body.vy).toBeLessThan(-400);
  });

  it('locks a tipsy keg to the stop you pressed on', () => {
    const d = kegDef([6, 7, 0], { step: 12, delay: 20 });
    const { run, r, p } = inKeg(d);
    steps(run, 12);
    const m = run.resolved[0].mods[0] as ModuleOf<'keg'>;
    const aim = kegAim(m, run.frame, run.resolved[0].phase).dir;
    steps(run, 1, JUMP);
    expect(held(r).aim).toBe(aim);
    while (r.attach.grip) steps(run, 1);
    const n = Math.sqrt(r.body.vx ** 2 + r.body.vy ** 2);
    expect(r.body.vx / n).toBeCloseTo(COMPASS[aim][0], 1);
    expect(run.propState.get(p.uid)!.lastFire).toBeGreaterThan(0);
  });

  it('backfires out of the rear if you sit in it too long, and leaves you sooty', () => {
    const { run, r } = inKeg(kegDef([6], { burn: 60 }));
    steps(run, 58);
    expect(r.attach.grip).not.toBeNull();
    steps(run, 3);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vy).toBeGreaterThan(200);
    expect(r.attach.soot - run.frame).toBeGreaterThan(KEG.soot - 10);
    expect(r.alive).toBe(true);
  });

  it('a fuse lit in time beats the backfire', () => {
    const { run, r } = inKeg(kegDef([6], { burn: 40, delay: 30 }));
    steps(run, 20);
    steps(run, 1, JUMP);
    steps(run, 34);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vy).toBeLessThan(-100);
    expect(r.attach.soot).toBe(0);
  });

  it('does not swallow you again until you have left it', () => {
    const level = room();
    // A ceiling right on top of the keg: the shot goes nowhere and you stay in its zone.
    for (let x = 18; x < 25; x++) level.tiles[11 * W + x] = 1;
    const { run, r } = race(level, [place(kegDef([6], { delay: 2 }), 20, 12)]);
    fly(r, 20.5 * TILE, 12.5 * TILE);
    steps(run, 12);
    steps(run, 1, JUMP);
    steps(run, 3);
    expect(r.attach.grip).toBeNull();
    steps(run, REGRAB + 30);
    expect(r.attach.grip).toBeNull();
  });
});

describe('when a hold goes wrong', () => {
  it('lets go keeping its momentum when the rope disappears mid-swing', () => {
    const p = hang();
    const { run, r } = grabbed(215, [p]);
    steps(run, 12);
    const vx = r.body.vx;
    run.resolved = run.resolved.filter((x) => x.pp.uid !== p.uid);
    run.propState.delete(p.uid);
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
    expect(Math.abs(r.body.vx - vx)).toBeLessThan(10);
    for (let i = 0; i < 200 && !r.body.onGround; i++) steps(run, 1);
    expect(r.body.onGround).toBe(true);
    expect(r.alive).toBe(true);
  });

  it('lets go when the ceiling is drilled out mid-swing', () => {
    const p = hang();
    const level = room();
    const { run, r } = race(level, [p]);
    fly(r, midX(20), midY(12), 215);
    steps(run, 12);
    expect(r.attach.grip).not.toBeNull();
    detonate(level, [p], blastSpec({ radius: 1, shape: 'line', target: 'terrain' }), 20, CEIL, 0);
    steps(run, 2);
    expect(r.attach.grip).toBeNull();
  });

  it('spits you out when a keg is destroyed with you inside', () => {
    const p = place(kegDef(), 20, 12);
    const { run, r } = race(room(), [p]);
    fly(r, 20.5 * TILE, 12.5 * TILE);
    steps(run, 8);
    run.resolved = [];
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
    steps(run, 10);
    expect(r.body.vy).toBeGreaterThan(0);
  });

  it('lets go if the prop breaks', () => {
    const p = hang();
    const { run, r } = grabbed(100, [p]);
    run.propState.get(p.uid)!.brokenUntil = run.frame + 50;
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
  });

  it('lets go when a solid moves into the runner, and the usual crush rules take over', () => {
    const level = room();
    const { run, r } = race(level, [hang()]);
    fly(r, midX(20), midY(12));
    steps(run, 2);
    expect(r.attach.grip).not.toBeNull();
    const c = center(r);
    level.tiles[Math.floor((r.body.y + 4) / TILE) * W + Math.floor(c / TILE)] = 1;
    steps(run, 1);
    expect(r.attach.grip).toBeNull();
  });

  /** Drop a saw onto a runner mid-race: nothing in a race does this yet, but it's the hit a held runner must survive being checked for. */
  function sawAt(run: RunWorld, r: Runner) {
    const saw = place(
      def([{ type: 'swinger', head: 'saw', hub: [0.5, 0.5], arm: 0, angle0: 0, period: 60, swing: 0, dir: 1, radius: 1, count: 1, link: 'none' }]),
      Math.floor(center(r) / TILE),
      Math.floor((r.body.y + r.body.h / 2) / TILE),
    );
    run.resolved.push(resolveProp(saw));
    run.propState.set(saw.uid, newPropState());
  }

  it('a hazard kills a held runner like anyone else, and credits its owner', () => {
    const { run, r } = grabbed(100);
    steps(run, 3);
    sawAt(run, r);
    steps(run, 2);
    expect(r.alive).toBe(false);
    expect(r.attach.grip).toBeNull();
    expect(run.kills).toEqual([{ victim: 0, killer: 7 }]);
    const { run: run2, r: r2 } = race(room(), [place(kegDef(), 20, 12)]);
    fly(r2, 20.5 * TILE, 12.5 * TILE);
    steps(run2, 5);
    expect(r2.attach.grip).not.toBeNull();
    sawAt(run2, r2);
    steps(run2, 2);
    expect(r2.alive).toBe(false);
    expect(r2.attach.grip).toBeNull();
  });

  it('a shield pops you off the rope and you live', () => {
    const { run, r } = grabbed(0);
    giveItem(r, 'shield');
    steps(run, 2);
    sawAt(run, r);
    steps(run, 3);
    expect(r.alive).toBe(true);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vy).toBeLessThan(0);
  });

  it('a knock from a shot takes you off the rope and sends you the way the shot went', () => {
    const { run, r } = grabbed(0);
    steps(run, 2);
    run.projectiles.push(makeProjectile({ x: center(r) - 20, y: r.body.y + 6, vx: 300, vy: 0, owner: 1, ammo: 'rubber' }, run.frame, 1));
    for (let i = 0; i < 12 && r.attach.grip; i++) steps(run, 1);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vx).toBeGreaterThan(0);
  });

  it('frozen runners stay on and keep swinging, but cannot pump or let go', () => {
    const { run, r } = grabbed(215);
    r.status.frozen = 30;
    steps(run, 25, JUMP);
    expect(r.attach.grip).not.toBeNull();
    expect(Math.abs(r.attach.grip!.s)).toBeGreaterThan(0);
  });

  it('a dazed runner in a keg cannot fire', () => {
    const { run, r } = race(room(), [place(kegDef(), 20, 12)]);
    fly(r, 20.5 * TILE, 12.5 * TILE);
    steps(run, 2);
    r.items.daze = 30;
    steps(run, 20, JUMP);
    expect(r.attach.grip?.fuse).toBe(-1);
  });

  it('self-destruct still works while held', () => {
    const { run, r } = grabbed(0);
    steps(run, 1, { ...NO_INPUT, altPressed: true, alt: true });
    steps(run, POP_HOLD - 1, { ...NO_INPUT, alt: true });
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('pop');
    expect(r.attach.grip).toBeNull();
  });

  it('the race timer ends a hold', () => {
    const { run, r } = grabbed(0);
    (run as { timeLimit: number }).timeLimit = 1;
    steps(run, 3);
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('timeout');
    expect(r.attach.grip).toBeNull();
    expect(run.endFrame).toBeGreaterThan(0);
  });

  it('swinging into the flag finishes you, keeps your speed, and ends your control', () => {
    const level = room();
    level.goal = { tx: 23, ty: 12 };
    const { run, r } = race(level, [hang()]);
    fly(r, midX(20), midY(12), 320);
    for (let i = 0; i < 60 && !r.finished; i++) steps(run, 1);
    expect(r.finished).toBe(true);
    expect(r.attach.grip).toBeNull();
    expect(Math.abs(r.body.vx)).toBeGreaterThan(50);
    expect(run.finishOrder).toEqual([0]);
  });

  it('the spawn zone stops new grabs', () => {
    const level = room();
    level.protectedRects = [{ x: 18, y: 10, w: 6, h: 6 }];
    level.spawn = { tx: 20, ty: 12 };
    const { run, r } = race(level, [hang()]);
    fly(r, midX(20), midY(12));
    steps(run, 3);
    expect(run.isSafe(r)).toBe(true);
    expect(r.attach.grip).toBeNull();
  });

  it('the shared hitbox never changes', () => {
    const { run, r } = grabbed(215);
    for (let i = 0; i < 60; i++) {
      steps(run, 1);
      expect([r.body.w, r.body.h]).toEqual([PLAYER_W, PLAYER_H]);
    }
  });

  it('a new race starts everyone free', () => {
    const m = new Match(1);
    m.join('a');
    m.startMatch();
    m.startRun();
    m.run!.runners[0].attach.grip = {
      uid: 1,
      mi: 0,
      t: 0,
      x: 0,
      y: 0,
      len: 0,
      s: 0,
      hooked: false,
      fuse: -1,
      aim: 0,
      settle: 0,
      sealed: false,
      to: -1,
      vx: 0,
      vy: 0,
    };
    m.startRun();
    expect(m.run!.runners[0].attach.grip).toBeNull();
  });
});

describe('held items', () => {
  it('work on a rope', () => {
    const { run, r } = grabbed(0);
    giveItem(r, 'puck');
    steps(run, ROPE.grace);
    steps(run, 1, { ...NO_INPUT, usePressed: true });
    expect(r.items.held).toBeNull();
    expect(run.projectiles.length).toBe(1);
    expect(r.attach.grip).not.toBeNull();
  });

  it('a rocket tears you off the rope', () => {
    const { run, r } = grabbed(0);
    giveItem(r, 'rocket');
    steps(run, 1, { ...NO_INPUT, usePressed: true });
    steps(run, 2);
    expect(r.attach.grip).toBeNull();
    expect(r.body.vy).toBeLessThan(-300);
  });

  it('stay in your pocket inside a keg', () => {
    const { run, r } = race(room(), [place(kegDef(), 20, 12)]);
    fly(r, 20.5 * TILE, 12.5 * TILE);
    giveItem(r, 'puck');
    steps(run, 3);
    steps(run, 1, { ...NO_INPUT, usePressed: true });
    expect(r.items.held?.kind).toBe('puck');
    expect(run.projectiles.length).toBe(0);
  });
});

describe('grabs and the rest of the sim', () => {
  it('gravity scales the swing', () => {
    const period = (gravity: number) => {
      const level = { ...room(), gravity } as Level;
      const { run, r } = race(level, [hang()]);
      fly(r, midX(20), midY(12), 150);
      steps(run, 1);
      let n = 0;
      while (r.body.vx > 0 && n < 600) {
        steps(run, 1);
        n++;
      }
      return n;
    };
    expect(period(0.5)).toBeGreaterThan(period(1) * 1.2);
    expect(period(1.5)).toBeLessThan(period(1));
  });

  it('held runners do not shove or get shoved', () => {
    const { run } = race(room(), [hang()], 2);
    const [a, b] = run.runners;
    fly(a, midX(20), midY(12));
    fly(b, midX(20) + 6, midY(12));
    steps(run, 3);
    expect(a.attach.grip).not.toBeNull();
    const g = a.attach.grip!;
    expect(center(a) - midX(20)).toBeCloseTo(g.x, 6);
  });

  it('chained grabs replay identically, and held state survives a plain-data round trip', () => {
    const go = (restoreAt: number) => {
      const level = room();
      const ps = [place(ropeDef(8, 500), 20, CEIL + 1), place(kegDef([6, 7, 0]), 26, 12), place(ropeDef(8, 500), 31, CEIL + 1)];
      ps.forEach((p, i) => (p.uid = 500 + i));
      const { run } = race(level, ps, 2);
      fly(run.runners[0], midX(20), midY(12), 215);
      fly(run.runners[1], midX(31), midY(12), -215);
      const frames: string[] = [];
      for (let i = 0; i < 400; i++) {
        const inp: InputFrame[] = run.runners.map((_, k) => ({
          ...NO_INPUT,
          right: i % 37 < 20,
          left: i % 37 >= 20,
          jump: (i + k * 13) % 53 === 0,
          jumpPressed: (i + k * 13) % 53 === 0,
        }));
        run.step(inp);
        if (i === restoreAt) for (const r of run.runners) r.attach = JSON.parse(JSON.stringify(r.attach));
        frames.push(JSON.stringify(run.runners.map((r) => [r.body.x, r.body.y, r.body.vx, r.body.vy, r.attach, r.alive])));
      }
      return frames;
    };
    const base = go(-1);
    expect(go(-1)).toEqual(base);
    expect(go(30)).toEqual(base);
    expect(base.some((f) => f.includes('"grip":{'))).toBe(true);
  });

  it('every rolled rope and keg places and races on real levels', () => {
    const level = generateLevel(7);
    for (const k of ['rope', 'keg'] as const) {
      for (let i = 0; i < 12; i++) {
        const d = generateProp(new Rng(i * 17 + 1), k, 'x');
        let p: PlacedProp | null = null;
        for (let ty = 2; ty < level.h - 2 && !p; ty++)
          for (let tx = 6; tx < level.w - 6 && !p; tx++) if (canPlace(level, [], d, 0, tx, ty)) p = place(d, tx, ty);
        expect(p, `${k} ${i}`).not.toBeNull();
        const run = new RunWorld(level, [p!], [0, 1]);
        for (let f = 0; f < 240; f++) run.step([{ ...NO_INPUT, right: true, run: true, jump: true, jumpPressed: f % 30 === 0 }, NO_INPUT]);
      }
    }
  });
});
