import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import { MODES } from '../src/game/modes';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN } from '../src/sim/constants';
import { giveItem } from '../src/sim/items';
import { type Level, T_SOLID } from '../src/sim/level';
import type { ParcelRules } from '../src/sim/parcels';
import { bodyAtCell } from '../src/sim/physics';
import { RACE_RUN, RunWorld, type RunRules } from '../src/sim/run';
import { screenEdges, type ScreenRules } from '../src/sim/screen';
import { type GameEvent, NO_INPUT } from '../src/sim/types';

/** Hand-Me-Downs (src/sim/parcels.ts): a parcel from the top of the screen for whoever is far behind with empty hands. */

const FLOOR = 24;
/** A shelf across columns 10..20 at row 3, the leader's; a ledge over 30..34 at row 9, six rows under it; a step over 4..8 at row 15, twelve under. */
const SHELF = 3;
const LEDGE = 9;
const STEP = 15;
const DEAL: ParcelRules['deal'] = { chase: ['block'], lead: ['shield'], behind: [{ rows: 12, deal: ['grapple'] }] };
const PARCELS: ParcelRules = { rows: 12, wait: 30, rest: 120, after: 0, deal: DEAL };

function level(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = T_SOLID;
  for (let x = 10; x <= 20; x++) tiles[SHELF * LEVEL_W + x] = T_SOLID;
  for (let x = 30; x <= 34; x++) tiles[LEDGE * LEVEL_W + x] = T_SOLID;
  for (let x = 4; x <= 8; x++) tiles[STEP * LEVEL_W + x] = T_SOLID;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/**
 * Past the countdown: the leader (0) on the shelf, a chaser (1) on the ledge 6 rows under, and two (2, 3) on the floor
 * 21 rows under, 3 holding something. Rising Slag's screen over them, the hand-outs on `parcels`.
 */
function race(
  parcels: ParcelRules | null = PARCELS,
  screen: ScreenRules = MODES.slag.run.screen!,
  at: [number, number][] = [
    [15, SHELF - 1],
    [32, LEDGE - 1],
    [6, FLOOR - 1],
    [40, FLOOR - 1],
  ],
): { run: RunWorld; events: GameEvent[] } {
  const rules: RunRules = { ...RACE_RUN, flag: false, ahead: 'height', screen, ...(parcels && { parcels }) };
  const run = new RunWorld(level(), [], [0, 1, 2, 3], 0, undefined, [], false, rules);
  at.forEach(([tx, ty], i) => (run.runners[i].body = bodyAtCell(tx, ty)));
  giveItem(run.runners[3], 'block');
  const events: GameEvent[] = [];
  while (run.frame < RUN_COUNTDOWN) step(run, events);
  return { run, events };
}

function step(run: RunWorld, events: GameEvent[]) {
  run.step(run.runners.map(() => NO_INPUT));
  events.push(...run.events);
  run.events.length = 0;
}

type ItemEvent = Extract<GameEvent, { type: 'item' }>;
const parcelEvents = (events: GameEvent[], what: string) => events.filter((e): e is ItemEvent => e.type === 'item' && e.kind === 'parcel' && e.what === what);

describe('Hand-Me-Downs', () => {
  it('drop a parcel from the top of the screen onto whoever is far behind with empty hands, holding a far-behind item', () => {
    const { run, events } = race();
    const far = run.runners[2];
    for (let k = 0; k < PARCELS.wait - 1; k++) step(run, events);
    expect(run.parcels!.falling).toHaveLength(0);
    step(run, events);
    const [p] = run.parcels!.falling;
    expect(p.target).toBe(2);
    // In from just over the top of the window the camera shows, over the climber's column.
    expect(p.y).toBeLessThan(screenEdges(run.rules.screen!, run.screen!).top);
    expect(Math.abs(p.x - (far.body.x + far.body.w / 2))).toBeLessThan(1);
    expect(parcelEvents(events, 'warn').map((e) => e.slot)).toEqual([2]);
    // It falls through the shelf and lands on the climber's head within about a second.
    let frames = 0;
    while (run.parcels!.falling.length && frames < 120) {
      expect(far.items.held).toBeNull();
      step(run, events);
      frames++;
    }
    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(90);
    expect(far.items.held?.kind).toBe('grapple');
    expect(parcelEvents(events, 'hit').map((e) => e.slot)).toEqual([2]);
  });

  it('pass over the leader, a chaser close behind, and a climber with full hands', () => {
    const { run, events } = race();
    for (let k = 0; k < 4 * 60; k++) step(run, events);
    expect(parcelEvents(events, 'warn').map((e) => e.slot)).toEqual([2]);
    expect(run.runners[0].items.held).toBeNull();
    expect(run.runners[1].items.held).toBeNull();
    expect(run.runners[3].items.held?.kind).toBe('block');
  });

  it("rest after one lands, and don't drop until the climber has been behind long enough", () => {
    const { run, events } = race();
    const far = run.runners[2];
    while (!far.items.held) step(run, events);
    // The frame it landed on, and the frame it rests until.
    const ready = run.frame - 1 + PARCELS.rest;
    far.items.held = null;
    while (run.frame < ready + PARCELS.wait - 1) {
      step(run, events);
      expect(run.parcels!.falling).toHaveLength(0);
    }
    step(run, events);
    expect(run.parcels!.falling.map((p) => p.target)).toEqual([2]);
  });

  it('pass over a climber the screen has lost, and are lost with one who drops off its bottom on the way', () => {
    // A screen 20 rows tall: its bottom edge 12 rows under the leader, so the step is in view and the floor isn't. A
    // long grace, so nobody goes out to it here.
    const short: ScreenRules = { ...MODES.slag.run.screen!, rows: 20, grace: 99_999 };
    const { run, events } = race(PARCELS, short, [
      [15, SHELF - 1],
      [32, LEDGE - 1],
      [6, STEP - 1],
      [40, FLOOR - 1],
    ]);
    // Empty-handed on the floor, 21 rows behind, but under the screen's bottom edge.
    run.runners[3].items.held = null;
    for (let k = 0; k < PARCELS.wait; k++) step(run, events);
    expect(run.screen!.under[3]).toBeGreaterThan(0);
    expect(run.parcels!.falling.map((p) => p.target)).toEqual([2]);
    // Its climber drops off the bottom while it falls: gone, and nothing in their hands.
    run.runners[2].body = bodyAtCell(20, FLOOR - 1);
    for (let k = 0; k < 90; k++) step(run, events);
    expect(parcelEvents(events, 'fizzle').map((e) => e.slot)).toEqual([2]);
    expect(parcelEvents(events, 'hit')).toHaveLength(0);
    expect(run.runners[2].items.held).toBeNull();
    expect(parcelEvents(events, 'warn').map((e) => e.slot)).toEqual([2]);
    expect(run.runners[3].items.held).toBeNull();
  });

  it('are gone with the climber they were for', () => {
    const { run, events } = race();
    for (let k = 0; k < PARCELS.wait; k++) step(run, events);
    expect(run.parcels!.falling).toHaveLength(1);
    run.runners[2].alive = false;
    step(run, events);
    expect(run.parcels!.falling).toHaveLength(0);
    expect(run.items.drops).toHaveLength(0);
  });

  it('only Rising Slag has them, and never alone', () => {
    expect(MODES.slag.run.parcels).toBeDefined();
    expect(MODES.race.run.parcels).toBeUndefined();
    expect(MODES.brawl.run.parcels).toBeUndefined();
    expect(race(null).run.parcels).toBeNull();
    const rules: RunRules = { ...MODES.slag.run };
    expect(new RunWorld(level(), [], [0], 0, undefined, [], false, rules).parcels).toBeNull();
  });
});
