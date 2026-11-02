import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { POCKET } from '../src/gen/level/kit';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { applyAction } from '../src/net/actions';
import { NetSession } from '../src/net/session';
import { cloneSnap, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { TILE } from '../src/sim/constants';
import { floorY, type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import { footprintCells } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

/**
 * The spawn ring and the flag are drawn at floorY of level.spawn and level.goal, and runners stand
 * on level.tiles. Nothing but this test ties those together, and "the cell has a floor" isn't
 * enough: a level whose markers came from one generation and whose tiles came from another
 * mostly passes that, with the ring buried in a rooftop and the flag hanging in the air.
 */

const seedAt = (i: number) => (i * 7919 + 13) >>> 0;
const TICK = 1000 / 60;

/** The pocket's floor: solid across its whole width, with four clear rows above it. */
function expectPocket(l: Level, cell: { tx: number; ty: number }, x0: number, what: string) {
  for (let x = x0; x < x0 + POCKET; x++) {
    expect(tileAt(l, x, cell.ty + 1), `${what} floor at column ${x}`).toBe(T_SOLID);
    for (let y = cell.ty - 3; y <= cell.ty; y++) expect(tileAt(l, x, y), `${what} air at ${x},${y}`).toBe(T_EMPTY);
  }
}

/** Ring and flag sit exactly on the terrain, and runners really stand on it at the ring. */
function expectMarkersOnTerrain(l: Level, what: string) {
  expect(l.tiles.length, `${what} tile count`).toBe(l.w * l.h);
  expectPocket(l, l.spawn, 0, `${what} spawn`);
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

function expectSameLevel(a: Level, b: Level, what: string) {
  expect(b.spawn, `${what} spawn`).toEqual(a.spawn);
  expect(b.goal, `${what} goal`).toEqual(a.goal);
  expect(b.protectedRects, `${what} protected rects`).toEqual(a.protectedRects);
  expect(b.gravity, `${what} gravity`).toBe(a.gravity);
  expect([...b.tiles], `${what} tiles`).toEqual([...a.tiles]);
  expect(
    b.setPieces.map((p) => p.uid),
    `${what} set pieces`,
  ).toEqual(a.setPieces.map((p) => p.uid));
}

/** A real mid-race match, as a resume save holds it. */
function racing(seed: number): Match {
  const m = new Match(seed);
  m.join('kb1');
  m.startMatch();
  m.startRun();
  for (let f = 0; f < 30; f++) m.step({});
  return m;
}

/**
 * This match as a build with another generator would have it: same seed, same size, nothing else
 * to give it away, but terrain two rows lower than this build generates for that seed.
 */
function asAnotherBuild(m: Match): Match {
  const { w, tiles } = m.level;
  const moved = new Uint8Array(tiles.length);
  moved.set(tiles.subarray(0, tiles.length - 2 * w), 2 * w);
  m.level = { ...m.level, tiles: moved };
  return m;
}

describe('spawn ring and flag sit on the terrain', () => {
  it('every theme, size and gravity', { timeout: 180_000 }, () => {
    let i = 0;
    for (const theme of THEME_IDS)
      for (const size of ['classic', 'wide', 'tall'] as const)
        for (const gravity of [0.7, 1, 1.35]) expectMarkersOnTerrain(generateLevel(seedAt(i++), theme, { size, gravity }), `${theme} ${size} ${gravity}`);
  });

  it('stock levels, rolled from the seed alone', { timeout: 120_000 }, () => {
    for (let i = 0; i < 80; i++) expectMarkersOnTerrain(new Match(seedAt(i)).level, `seed ${seedAt(i)}`);
  });
});

describe('a restored match is the level that was saved', () => {
  it('a guest joining a stock host, a new level, and a race in progress', { timeout: 120_000 }, () => {
    for (let i = 0; i < 12; i++) {
      const seed = seedAt(i);
      const host = new Match(seed);
      const join = (what: string) => {
        const guest = new Match(seed);
        restoreMatch(guest, cloneSnap(snapshotMatch(host)));
        expectSameLevel(host.level, guest.level, what);
        expectMarkersOnTerrain(guest.level, what);
        return guest;
      };
      join('fresh lobby');
      host.join('kb1');
      host.step({ kb1: { ...NO_INPUT, downPressed: true } });
      expect(host.seed).not.toBe(seed);
      join('after New Level');
      host.startMatch();
      host.startRun();
      for (let f = 0; f < 30; f++) host.step({});
      const guest = join('mid-race');
      expect(guest.run!.runners[0].body.y).toBe(host.run!.runners[0].body.y);
    }
  });

  it('keeps bomb craters, the only way tiles may differ', () => {
    const host = new Match(seedAt(1));
    const l = host.level;
    const k = l.tiles.findIndex((t, i) => t === T_SOLID && !l.protectedRects.some((r) => i % l.w >= r.x && i % l.w < r.x + r.w));
    l.tiles[k] = T_EMPTY;
    const guest = new Match(seedAt(1));
    restoreMatch(guest, cloneSnap(snapshotMatch(host)));
    expectSameLevel(host.level, guest.level, 'cratered');
  });

  it('rebuilds the level on screen even when the rules have moved on since it was generated', { timeout: 60_000 }, () => {
    let differed = 0;
    for (let i = 0; i < 16; i++) {
      const seed = seedAt(i);
      const host = new Match(seed);
      host.setRules({ ...DEFAULT_RULES, gravity: 'high' });
      applyAction(host, { parked: {}, kicked: {} }, { t: 'rules', rules: { ...host.rules, pickSeconds: 20 } });
      const guest = new Match(seed); // no saved rule of its own
      if (guest.level.gravity !== host.level.gravity) differed++;
      restoreMatch(guest, cloneSnap(snapshotMatch(host)));
      expectSameLevel(host.level, guest.level, `seed ${seed}`);
    }
    expect(differed).toBeGreaterThan(0);
  });

  it('a level forced to other knobs comes back with them', { timeout: 30_000 }, () => {
    const host = new Match(seedAt(2));
    host.forceProfile = { size: 'wide', density: 0.9, hazards: 1 };
    host.newLevel(host.seed);
    const guest = new Match(seedAt(2));
    restoreMatch(guest, cloneSnap(snapshotMatch(host)));
    expectSameLevel(host.level, guest.level, 'forced');
    expect(guest.level.profile).toEqual(host.level.profile);
  });
});

describe('a snapshot of terrain this build does not generate', () => {
  it('is refused, for every theme, and leaves the match as it was', { timeout: 120_000 }, () => {
    const seen = new Set<string>();
    for (let i = 0; seen.size < THEME_IDS.length && i < 80; i++) {
      const seed = seedAt(i);
      const m = new Match(seed);
      if (seen.has(m.level.theme.id)) continue;
      seen.add(m.level.theme.id);
      const before = m.level;
      expect(() => restoreMatch(m, cloneSnap(snapshotMatch(asAnotherBuild(racing(seed)))))).toThrow(/doesn't generate/);
      expect(m.level).toBe(before);
      expect(m.phase).toBe('lobby');
      expect(m.run).toBeNull();
    }
    expect(seen.size).toBe(THEME_IDS.length);
  });

  it('is refused for a dug pocket too: bombs cannot reach protected cells', () => {
    const seed = seedAt(3);
    const host = new Match(seed);
    const { tx, ty } = host.level.spawn;
    host.level.tiles[(ty + 1) * host.level.w + tx] = T_EMPTY;
    expect(() => restoreMatch(new Match(seed), cloneSnap(snapshotMatch(host)))).toThrow(/doesn't generate/);
  });

  it('a reload resuming a stale save starts the room fresh instead', { timeout: 30_000 }, () => {
    const seed = seedAt(4);
    const snap = cloneSnap(snapshotMatch(asAnotherBuild(racing(seed))));
    const match = new Match(seed);
    const fresh = match.level;
    const hub = new LoopbackHub();
    const logs: string[] = [];
    const net = new NetSession({
      transport: hub.transport('a'),
      match,
      now: () => hub.now,
      log: (m) => logs.push(m),
      resume: () => ({ snap, ns: { parked: {}, kicked: {} } }),
    });
    for (let i = 0; i < 10; i++) {
      hub.advance(TICK);
      net.tick({});
    }
    expect(logs.join('\n')).toMatch(/resume failed/);
    expect(match.level).toBe(fresh);
    expect(match.phase).toBe('lobby');
    expectMarkersOnTerrain(match.level, 'after refusing the save');
  });

  it('a guest of a host on another build keeps waiting rather than mixing two levels', { timeout: 30_000 }, () => {
    const seed = seedAt(5);
    const match = new Match(seed);
    const fresh = match.level;
    const hub = new LoopbackHub();
    const logs: string[] = [];
    const host = new NetSession({ transport: hub.transport('a'), match: asAnotherBuild(new Match(seed)), now: () => hub.now, log: () => {} });
    const guest = new NetSession({ transport: hub.transport('b'), match, now: () => hub.now, log: (m) => logs.push(m) });
    for (let i = 0; i < 240; i++) {
      hub.advance(TICK);
      host.tick({});
      guest.tick({});
    }
    expect(logs.join('\n')).toMatch(/snapshot refused/);
    expect(match.level).toBe(fresh);
    expect(guest.synced).toBe(false);
  });
});

it('floorY is the top of the tile under a stand cell', () => {
  expect(floorY({ ty: 14 })).toBe(15 * TILE);
});
