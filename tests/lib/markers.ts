import { expect } from 'vitest';
import { POCKET } from '../../src/gen/level/kit';
import { floorY, type Level, T_EMPTY, T_SOLID, tileAt } from '../../src/sim/level';
import { footprintCells } from '../../src/sim/props';
import { RunWorld } from '../../src/sim/run';
import { NO_INPUT } from '../../src/sim/types';

/**
 * The spawn ring and the flag are drawn at floorY of level.spawn and level.goal, and runners stand
 * on level.tiles. Nothing but these checks tie those together (tests/spawn-goal.test.ts on a few
 * levels, tests/stats/spawn-goal.test.ts on every theme, size and gravity).
 */
export const seedAt = (i: number) => (i * 7919 + 13) >>> 0;

/**
 * The pocket's floor: solid across its whole width, with four clear rows above it. The spawn's
 * back column is a wall instead: past the level's left edge is death, and holding left at GO
 * shouldn't walk you into it.
 */
function expectPocket(l: Level, cell: { tx: number; ty: number }, x0: number, what: string, backWall = false) {
  for (let x = x0; x < x0 + POCKET; x++) {
    expect(tileAt(l, x, cell.ty + 1), `${what} floor at column ${x}`).toBe(T_SOLID);
    const want = backWall && x === 0 ? T_SOLID : T_EMPTY;
    for (let y = cell.ty - 3; y <= cell.ty; y++) expect(tileAt(l, x, y), `${what} ${want ? 'wall' : 'air'} at ${x},${y}`).toBe(want);
  }
}

/** Ring and flag sit exactly on the terrain, and runners really stand on it at the ring. */
export function expectMarkersOnTerrain(l: Level, what: string) {
  expect(l.tiles.length, `${what} tile count`).toBe(l.w * l.h);
  expectPocket(l, l.spawn, 0, `${what} spawn`, true);
  expectPocket(l, l.goal, l.w - POCKET, `${what} goal`);
  for (const p of l.setPieces)
    for (const [x, y] of footprintCells(p))
      for (const c of [l.spawn, l.goal]) expect(x === c.tx && y === c.ty, `${what}: ${p.def.name} on a marker`).toBe(false);
  // A real race, untouched: anything embedded or unsupported would shift the feet off the ring.
  const run = new RunWorld(l, [], [0, 1, 2], 0);
  for (let f = 0; f < 20; f++) run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
  for (const r of run.runners) {
    expect(r.alive, `${what} runner ${r.slot} alive`).toBe(true);
    expect(r.body.y + r.body.h, `${what} runner ${r.slot} feet on the ring`).toBe(floorY(l.spawn));
  }
  // The flag's base is a floor too: a body put at the flag stays there.
  const flag = new RunWorld({ ...l, spawn: l.goal }, [], [0], 0);
  for (let f = 0; f < 20; f++) flag.step([NO_INPUT]);
  expect(flag.runners[0].body.y + flag.runners[0].body.h, `${what} flag base on the floor`).toBe(floorY(l.goal));
}
