import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN } from '../src/sim/constants';
import { CRATE_ITEMS, giveItem, HOOK, type ItemKind, UPPER } from '../src/sim/items';
import type { Level } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { MODES } from '../src/game/modes';
import { generateCrate, RACE_CRATE } from '../src/gen/props';
import { RACE_RUN, type Runner, RunWorld, type RunRules } from '../src/sim/run';
import type { Tide } from '../src/sim/tide';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** The climb's two items (src/sim/items/upward.ts): the Queue Jumper and the Upper Hand. */

const FLOOR = 20;
const SHELF = 12;
/** Slag that never moves: the level is a climb, and nothing else about it matters here. */
const STILL: Tide = { wait: 999, speed: 0, gain: 0, leash: [], squeeze: { after: 999, rate: 0, min: 0 }, rush: 0 };

/** A floor from FLOOR down, a solid shelf across columns 10..20 at SHELF, the flag far right. */
function level(climb: boolean): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let x = 10; x <= 20; x++) tiles[SHELF * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 3 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
    ...(climb ? { tide: STILL } : {}),
  };
}

/** A race past its countdown, runner i standing in cell `at[i]`. */
function race(at: [number, number][], climb = false): RunWorld {
  // A climb ranks by height (sim/standing.ts), as Rising Slag's rules say.
  const rules: RunRules = { ...RACE_RUN, ahead: climb ? 'height' : 'route' };
  const run = new RunWorld(
    level(climb),
    [],
    at.map((_, i) => i),
    0,
    undefined,
    [],
    true,
    rules,
  );
  while (run.frame < RUN_COUNTDOWN) run.step(at.map(() => NO_INPUT));
  at.forEach(([tx, ty], i) => (run.runners[i].body = bodyAtCell(tx, ty)));
  run.step(at.map(() => NO_INPUT));
  return run;
}

const steps = (run: RunWorld, n: number) => {
  for (let k = 0; k < n; k++) run.step(run.runners.map(() => NO_INPUT));
};
const use = (run: RunWorld, who: number) => run.step(run.runners.map((_, i): InputFrame => (i === who ? { ...NO_INPUT, usePressed: true } : NO_INPUT)));
const at = (r: Runner) => ({ x: Math.round(r.body.x), y: Math.round(r.body.y) });

describe('Queue Jumper', () => {
  it('trades places with whoever is just ahead, not the leader, once the line gets there', () => {
    const run = race([
      [8, FLOOR - 1],
      [24, FLOOR - 1],
      [34, FLOOR - 1],
    ]);
    const [a, b, c] = run.runners;
    const [wasA, wasB, wasC] = [at(a), at(b), at(c)];
    giveItem(a, 'hook');
    use(run, 0);
    expect(a.items.held).toBeNull();
    expect(run.items.hooks[0].target).toBe(1);
    steps(run, HOOK.reel - 2);
    expect(at(b)).toEqual(wasB);
    steps(run, 2);
    expect(run.items.hooks).toHaveLength(0);
    expect(at(a)).toEqual(wasB);
    expect(at(b)).toEqual(wasA);
    expect(at(c)).toEqual(wasC);
    expect(b.items.bonkedBy).toBe(0);
  });

  it('does nothing from the front, and keeps the item', () => {
    const run = race([
      [30, FLOOR - 1],
      [8, FLOOR - 1],
    ]);
    giveItem(run.runners[0], 'hook');
    use(run, 0);
    expect(run.items.hooks).toHaveLength(0);
    expect(run.runners[0].items.held?.kind).toBe('hook');
  });

  it('on a climb, ahead is up', () => {
    const run = race(
      [
        [8, FLOOR - 1],
        [15, SHELF - 1],
        [40, FLOOR - 1],
      ],
      true,
    );
    const [a, b] = run.runners;
    const wasB = at(b);
    giveItem(a, 'hook');
    use(run, 0);
    expect(run.items.hooks[0].target).toBe(1);
    steps(run, HOOK.reel);
    expect(at(a)).toEqual(wasB);
  });
});

describe('Upper Hand', () => {
  it('flies up through a floor and punches the runner above back down, credited to the thrower', () => {
    const run = race(
      [
        [15, FLOOR - 1],
        [16, SHELF - 1],
        [16, FLOOR - 1],
        [30, FLOOR - 1],
      ],
      true,
    );
    const [a, above, beside, far] = run.runners;
    giveItem(a, 'upper');
    use(run, 0);
    expect(run.items.fists).toHaveLength(1);
    expect(a.items.held?.uses).toBe(1);
    steps(run, 40);
    expect(run.items.fists).toHaveLength(0);
    expect(above.items.daze).toBeGreaterThan(0);
    expect(above.items.bonkedBy).toBe(0);
    expect(beside.items.daze + far.items.daze + a.items.daze).toBe(0);
  });

  it('leans toward a mark a little across, and bursts on its own with nobody above', () => {
    const run = race(
      [
        [13, FLOOR - 1],
        [16, SHELF - 1],
      ],
      true,
    );
    giveItem(run.runners[0], 'upper');
    use(run, 0);
    steps(run, 40);
    expect(run.runners[1].items.daze).toBeGreaterThan(0);

    const lone = race(
      [
        [30, FLOOR - 1],
        [8, FLOOR - 1],
      ],
      true,
    );
    giveItem(lone.runners[0], 'upper');
    use(lone, 0);
    steps(lone, Math.ceil((UPPER.rise / UPPER.speed) * 60) + 2);
    expect(lone.items.fists).toHaveLength(0);
    expect(lone.runners[1].items.daze).toBe(0);
  });
});

describe('where the climb items come from', () => {
  it('only a loop box deals them, and only to whoever is behind', () => {
    const CATCH_UP = MODES.slag.profile.boxes!;
    for (const k of ['hook', 'upper'] as const) {
      expect(CRATE_ITEMS).not.toContain(k);
      expect(CATCH_UP.chase).toContain(k);
      expect(CATCH_UP.lead).not.toContain(k);
    }
  });

  it('two identical climbs with both in every hand end in identical state', () => {
    function chaos(): string {
      const run = race(
        [
          [6, FLOOR - 1],
          [12, SHELF - 1],
          [16, FLOOR - 1],
          [19, SHELF - 1],
          [26, FLOOR - 1],
        ],
        true,
      );
      const kinds: ItemKind[] = ['hook', 'upper'];
      const rng = new Rng(9);
      for (let f = 0; f < 480; f++) {
        if (f % 60 === 0) run.runners.forEach((r, i) => r.alive && !r.items.held && giveItem(r, kinds[(i + f) % 2]));
        run.step(
          run.runners.map(() => ({ ...NO_INPUT, right: rng.chance(0.5), jump: rng.chance(0.3), jumpPressed: rng.chance(0.05), usePressed: rng.chance(0.05) })),
        );
      }
      return JSON.stringify({ runners: run.runners, items: run.items, f: run.frame });
    }
    const a = chaos();
    expect(a).toBe(chaos());
    expect((JSON.parse(a) as { runners: Runner[] }).runners.some((r) => r.items.bonkedBy >= 0)).toBe(true);
  });
});

describe('a mode names what its crates deal', () => {
  it("a crate's loot boxes deal the mode's items, and the rest are as dealt", () => {
    const items: ItemKind[] = ['hook'];
    let boxes = 0;
    for (let round = 0; round < 40 && !boxes; round++) {
      const plain = generateCrate(5, round, 6);
      const own = generateCrate(5, round, 6, 1, 0, false, false, undefined, { ...RACE_CRATE, items });
      expect(own.map((c) => c.name)).toEqual(plain.map((c) => c.name));
      for (const c of own)
        for (const m of c.modules)
          if (m.type === 'mystery') {
            boxes++;
            expect(m.pool).toEqual(items);
          }
    }
    expect(boxes).toBeGreaterThan(0);
  });
});

describe('Sucker Punch', () => {
  it('reaches a rival three tiles off, past the noodle, and throws them sideways', () => {
    const punch = (kind: ItemKind) => {
      const run = race([
        [10, FLOOR - 1],
        [13, FLOOR - 1],
      ]);
      const [a, b] = run.runners;
      a.body.facing = 1;
      giveItem(a, kind);
      use(run, 0);
      steps(run, 14);
      return b;
    };
    const far = punch('glove');
    expect(far.items.daze).toBeGreaterThan(0);
    expect(far.items.bonkedBy).toBe(0);
    expect(far.body.vx).toBeGreaterThan(400);
    expect(punch('sword').items.daze).toBe(0);
  });
});
