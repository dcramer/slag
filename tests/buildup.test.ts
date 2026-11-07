import { describe, expect, it } from 'vitest';
import { MODES } from '../src/game/modes';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, RUN_COUNTDOWN, SHIELD_FRAMES, TILE } from '../src/sim/constants';
import { giveItem, type ItemKind, knockScale } from '../src/sim/items';
import type { Level } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { RACE_RUN, type RunRules, RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * A brawl's build-up (`RunRules.buildup`, items/common.ts `bonk`): every rival's hit a runner takes throws the next one
 * farther, and a race, which sets none, throws every hit as the first.
 */

const W = 200;
const FLOOR = 20;
const BRAWL = MODES.brawl.run;

/** A long flat floor and nothing else: how far a knock carries someone, with no edge to stop it. */
function floor(): Level {
  const tiles = new Uint8Array(W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = 1;
  return {
    seed: 1,
    w: W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
const USE = press({ usePressed: true });

/** A race past its spawn shield, the hitter at column 40 facing right and its victim `gap` tiles on, `hits` already taken. */
function pair(rules: RunRules, hits: number, gap = 1) {
  const run = new RunWorld(floor(), [], [0, 1], 0, 1, [], false, rules);
  while (run.frame < RUN_COUNTDOWN + SHIELD_FRAMES) run.step([NO_INPUT, NO_INPUT]);
  const [a, v] = run.runners;
  a.body = bodyAtCell(40, FLOOR - 1);
  a.body.facing = 1;
  v.body = bodyAtCell(40 + gap, FLOOR - 1);
  v.items.hits = hits;
  return { run, a, v };
}

/** Tiles a standing victim is carried by one hit from `kind` (a body check from a run-up with none), and what it has taken after. */
function carried(rules: RunRules, hits: number, kind: ItemKind | null): { tiles: number; hits: number } {
  const { run, a, v } = pair(rules, hits, kind ? 1 : 5);
  if (kind) giveItem(a, kind);
  let x0 = v.body.x;
  let hit = -1;
  for (let f = 0; f < 600; f++) {
    run.step([kind ? (f === 0 ? USE : NO_INPUT) : hit < 0 ? press({ right: true, run: true }) : NO_INPUT, NO_INPUT]);
    if (hit < 0 && v.items.daze > 0) {
      hit = f;
      x0 = v.body.x;
    }
    if (hit >= 0 && f - hit > 5 && v.body.onGround && Math.abs(v.body.vx) < 1) break;
  }
  expect(hit, 'the hit lands').toBeGreaterThanOrEqual(0);
  return { tiles: (v.body.x - x0) / TILE, hits: v.items.hits };
}

describe('build-up', () => {
  it('the same hit carries a runner farther with every hit they have taken, and counts one more', () => {
    const fresh = carried(BRAWL, 0, 'sword');
    const once = carried(BRAWL, 1, 'sword');
    const four = carried(BRAWL, 4, 'sword');
    expect(fresh.hits).toBe(1);
    expect(four.hits).toBe(5);
    expect(once.tiles).toBeGreaterThan(fresh.tiles * 1.2);
    expect(four.tiles).toBeGreaterThan(fresh.tiles * 2);
  });

  it('a body check counts as a hit and builds up like an item', () => {
    const fresh = carried(BRAWL, 0, null);
    const four = carried(BRAWL, 4, null);
    expect(fresh.hits).toBe(1);
    expect(four.tiles).toBeGreaterThan(fresh.tiles * 2);
  });

  it('a race counts nothing and throws every hit as the first', () => {
    expect(RACE_RUN.buildup).toBeUndefined();
    const fresh = carried(RACE_RUN, 0, 'sword');
    const later = carried(RACE_RUN, 4, 'sword');
    expect(fresh.hits).toBe(0);
    expect(later.tiles).toBeCloseTo(fresh.tiles, 6);
  });

  it('stops growing at its most', () => {
    const { run, v } = pair(BRAWL, BRAWL.buildup!.max);
    const most = knockScale(run, v);
    v.items.hits += 3;
    expect(knockScale(run, v)).toBe(most);
  });
});
