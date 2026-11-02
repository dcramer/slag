import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { cloneSnap, hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LEVEL_H, LEVEL_W, TILE } from '../src/sim/constants';
import { type Level, T_ONEWAY, T_SOLID } from '../src/sim/level';
import { bodyAtCell } from '../src/sim/physics';
import { canPlace, detonate, footprint, footprintCells, landedDef, mountCells, type PlacedProp, type PropDef, resolveProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const FLOOR = 20; // first solid row

/** Flat floor from FLOOR down, plus a wall column at x=30 rising to row 10. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  for (let y = 10; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 3, w: 5, h: 5 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

const coatDef = (kind: 'spikestrip' | 'icecoat' | 'slimecoat', n = 3): PropDef => {
  for (let i = 0; i < 200; i++) {
    const d = generateProp(new Rng(i), kind, 'x');
    if (d.footprint.length === n) return d;
  }
  throw new Error('no def');
};

/** A snap plate `n` cells long. */
const snapDef = (n: number): PropDef => {
  for (let i = 0; i < 200; i++) {
    const d = generateProp(new Rng(i), 'snapper', 'x');
    if (d.footprint.length === n) return d;
  }
  throw new Error('no def');
};

/** A static one-tile block attachments can mount on. */
const oneBlock = (): PropDef => {
  for (let i = 0; i < 500; i++) {
    const d = generateProp(new Rng(i), 'platform', 'x');
    if (d.footprint.length === 1 && d.motion.type === 'none' && d.modules.some((m) => m.type === 'body' && m.material !== 'crumble')) return d;
  }
  throw new Error('no def');
};

describe('attachment placement rule', () => {
  const level = testLevel();
  const ice = coatDef('icecoat');
  it('mounts on an exposed top face of terrain', () => {
    expect(ice.mount).toBe('face');
    expect(canPlace(level, [], ice, 0, 10, FLOOR)).toBe(true);
  });
  it('rejects mid-air, buried faces, and protected cells', () => {
    expect(canPlace(level, [], ice, 0, 10, FLOOR - 3)).toBe(false); // nothing to stick to
    expect(canPlace(level, [], ice, 0, 10, FLOOR + 2)).toBe(false); // face is buried in rock
    expect(canPlace(level, [], ice, 0, 1, FLOOR)).toBe(false); // spawn zone
  });
  it('rotation picks the face (wall side)', () => {
    // rot 1 = facing right; footprint becomes a vertical strip on the wall column x=30.
    expect(canPlace(level, [], ice, 1, 30, 12)).toBe(true);
    expect(canPlace(level, [], ice, 3, 30, 12)).toBe(true); // left face
    expect(canPlace(level, [], ice, 1, 31, 12)).toBe(false); // not on the wall
  });
  it('cannot coat the same face twice, but can stack different faces', () => {
    const placed: PlacedProp[] = [{ uid: 1, def: ice, owner: 0, tx: 10, ty: FLOOR, rot: 0 }];
    expect(canPlace(level, placed, ice, 0, 10, FLOOR)).toBe(false);
    expect(canPlace(level, placed, coatDef('icecoat', 2), 0, 11, FLOOR)).toBe(false);
    expect(canPlace(level, placed, coatDef('spikestrip', 1), 0, 14, FLOOR)).toBe(true);
  });
  it('falls off when a bomb removes its host', () => {
    const lv = testLevel();
    const placed: PlacedProp[] = [{ uid: 1, def: ice, owner: 0, tx: 10, ty: FLOOR, rot: 0 }];
    expect(detonate(lv, placed, 2.5, 11, FLOOR)).toHaveLength(0);
  });
});

describe('attachment behavior', () => {
  it('spike strips kill whoever stands on them', () => {
    const lv = testLevel();
    lv.spawn = { tx: 10, ty: FLOOR - 1 }; // outside the protected pocket: the spawn zone is safe
    const run = new RunWorld(lv, [{ uid: 1, def: coatDef('spikestrip', 3), owner: 1, tx: 9, ty: FLOOR, rot: 0 }], [0]);
    for (let f = 0; f < 120 && run.runners[0].alive; f++) run.step([NO_INPUT]);
    expect(run.runners[0].alive).toBe(false);
    expect(run.runners[0].killer).toBe(1);
  });

  it('ice makes you slide further; slime stops you sooner', () => {
    const slide = (def: PropDef | null) => {
      const lv = testLevel();
      lv.spawn = { tx: 10, ty: FLOOR - 1 };
      const placed: PlacedProp[] = def ? [{ uid: 1, def, owner: 1, tx: 8, ty: FLOOR, rot: 0 }] : [];
      const run = new RunWorld(lv, placed, [0]);
      const b = run.runners[0].body;
      // Skip the countdown, then let go at running speed and see how far you slide.
      for (let f = 0; f < 70; f++) run.step([NO_INPUT]);
      b.vx = 150;
      const x0 = b.x;
      for (let f = 0; f < 20; f++) run.step([NO_INPUT]);
      return b.x - x0;
    };
    const plain = slide(null);
    const ice = slide(coatDef('icecoat', 5));
    const slime = slide(coatDef('slimecoat', 5));
    expect(ice).toBeGreaterThan(plain * 2);
    expect(slime).toBeLessThanOrEqual(plain);
  });

  it('slime on a wall makes you cling; ice on a wall stops wall slides', () => {
    const fall = (def: PropDef | null) => {
      const lv = testLevel();
      const placed: PlacedProp[] = def ? [{ uid: 1, def, owner: 1, tx: 30, ty: 11, rot: 3 }] : [];
      const run = new RunWorld(lv, placed, [0]);
      for (let f = 0; f < 61; f++) run.step([NO_INPUT]);
      // Drop the runner next to the wall's left face, pressing into it.
      const b = run.runners[0].body;
      Object.assign(b, bodyAtCell(29, 11));
      b.x = 30 * TILE - b.w - 3.5;
      b.y = 11 * TILE;
      b.onGround = false;
      b.groundRef = -1;
      const y0 = b.y;
      for (let f = 0; f < 30; f++) run.step([{ ...NO_INPUT, right: true }]);
      return b.y - y0;
    };
    const plain = fall(null);
    const slime = fall(coatDef('slimecoat', 3));
    const ice = fall(coatDef('icecoat', 3));
    expect(slime).toBeLessThan(plain * 0.5);
    expect(ice).toBeGreaterThan(plain);
  });
});

describe('partial mounting', () => {
  const two = coatDef('icecoat', 2);
  const three = coatDef('spikestrip', 3);

  /** testLevel plus a one-tile perch, a ledge, a split ledge and a ceiling band. */
  function ledges(): Level {
    const lv = testLevel();
    const solid = (x: number, y: number) => (lv.tiles[y * lv.w + x] = T_SOLID);
    solid(20, 12);
    for (const x of [10, 11, 12]) solid(x, 14);
    for (const x of [15, 17]) solid(x, 14);
    for (const x of [10, 11, 12]) solid(x, 5);
    return lv;
  }

  /** The world cells a def really covers at a spot. */
  const lands = (lv: Level, placed: PlacedProp[], def: PropDef, rot: number, tx: number, ty: number) =>
    footprintCells({ def: landedDef(lv, placed, def, rot, tx, ty), rot, tx, ty });

  it('a 2-wide strip on a 1-wide platform keeps the one cell, from either side', () => {
    const lv = ledges();
    expect(canPlace(lv, [], two, 0, 20, 12)).toBe(true);
    expect(lands(lv, [], two, 0, 20, 12)).toEqual([[20, 12]]);
    expect(canPlace(lv, [], two, 0, 19, 12)).toBe(true);
    expect(lands(lv, [], two, 0, 19, 12)).toEqual([[20, 12]]);
  });

  it('a 3-wide strip over a gap edge keeps the run on the ledge', () => {
    const lv = ledges();
    expect(lands(lv, [], three, 0, 11, 14)).toEqual([
      [11, 14],
      [12, 14],
    ]);
    expect(lands(lv, [], three, 0, 9, 14)).toEqual([
      [10, 14],
      [11, 14],
    ]);
  });

  it('a strip split by a gap keeps both sides', () => {
    expect(lands(ledges(), [], three, 0, 15, 14)).toEqual([
      [15, 14],
      [17, 14],
    ]);
  });

  it('trims on walls and ceilings, and kept cells stay exactly where the whole strip had them', () => {
    const lv = ledges();
    expect(lands(lv, [], three, 1, 30, 8)).toEqual([[30, 10]]); // right face, top of the wall
    expect(lands(lv, [], three, 3, 30, 8)).toEqual([[30, 10]]); // left face: here the strip's far end is what's gone
    expect(lands(lv, [], three, 2, 9, 5)).toEqual([
      [11, 5],
      [10, 5],
    ]); // ceiling
    expect(lands(lv, [], three, 2, 12, 5)).toEqual([[12, 5]]);
    for (let rot = 0; rot < 4; rot++) {
      for (let ty = 0; ty < lv.h; ty++) {
        for (let tx = 0; tx < lv.w; tx++) {
          const whole = footprintCells({ def: three, rot, tx, ty }).map(String);
          const def = landedDef(lv, [], three, rot, tx, ty);
          const kept = footprintCells({ def, rot, tx, ty });
          for (const c of kept) expect(whole).toContain(String(c));
          const mod = resolveProp({ uid: 1, def, owner: 0, tx, ty, rot }).mods[0];
          expect(mod.type === 'coat' && mod.cells).toEqual(kept);
        }
      }
    }
  });

  it('drops protected cells and refuses when nothing is left', () => {
    const lv = ledges();
    expect(lands(lv, [], three, 0, 3, FLOOR)).toEqual([[5, FLOOR]]);
    expect(canPlace(lv, [], three, 0, 1, FLOOR)).toBe(false);
    expect(landedDef(lv, [], three, 0, 1, FLOOR)).toBe(three);
    expect(canPlace(lv, [], three, 0, 25, 10)).toBe(false);
  });

  it('drops cells off the edge of the level', () => {
    const lv = testLevel();
    lv.protectedRects = [];
    expect(lands(lv, [], three, 0, -1, FLOOR)).toEqual([
      [0, FLOOR],
      [1, FLOOR],
    ]);
    expect(lands(lv, [], three, 0, LEVEL_W - 2, FLOOR)).toEqual([
      [LEVEL_W - 2, FLOOR],
      [LEVEL_W - 1, FLOOR],
    ]);
    expect(canPlace(lv, [], three, 0, -3, FLOOR)).toBe(false);
  });

  it('drops cells with a blocked face: a placed block, a set piece or a one-way', () => {
    const lv = testLevel();
    const blocked: PlacedProp[] = [{ uid: 1, def: oneBlock(), owner: 0, tx: 11, ty: FLOOR - 1, rot: 0 }];
    expect(lands(lv, blocked, three, 0, 10, FLOOR)).toEqual([
      [10, FLOOR],
      [12, FLOOR],
    ]);
    lv.setPieces = [{ uid: 2, def: oneBlock(), owner: -1, tx: 12, ty: FLOOR - 1, rot: 0 }];
    expect(lands(lv, blocked, three, 0, 10, FLOOR)).toEqual([[10, FLOOR]]);
    const oneWay = testLevel();
    oneWay.tiles[(FLOOR - 1) * oneWay.w + 11] = T_ONEWAY;
    expect(lands(oneWay, [], three, 0, 10, FLOOR)).toEqual([
      [10, FLOOR],
      [12, FLOOR],
    ]);
  });

  it('drops cells already coated on that face, and a trimmed strip only claims what it kept', () => {
    const lv = ledges();
    const placed: PlacedProp[] = [{ uid: 1, def: landedDef(lv, [], three, 0, 11, 14), owner: 0, tx: 11, ty: 14, rot: 0 }];
    expect(lands(lv, placed, three, 0, 9, 14)).toEqual([[10, 14]]);
    expect(canPlace(lv, placed, coatDef('icecoat', 2), 0, 11, 14)).toBe(false);
    // The dropped cell (13, 14) never landed: a block can still go in, and be coated.
    const block: PlacedProp = { uid: 2, def: oneBlock(), owner: 0, tx: 13, ty: 14, rot: 0 };
    expect(canPlace(lv, placed, block.def, 0, 13, 14)).toBe(true);
    expect(lands(lv, [...placed, block], coatDef('icecoat', 2), 0, 13, 14)).toEqual([[13, 14]]);
  });

  it('other props still need every cell', () => {
    const lv = ledges();
    let def: PropDef | null = null;
    for (let i = 0; i < 200 && !def; i++) {
      const d = generateProp(new Rng(i), 'platform', 'x');
      if (d.footprint.length === 3 && d.motion.type === 'none') def = d;
    }
    expect(canPlace(lv, [], def!, 0, 20, 8)).toBe(true);
    expect(canPlace(lv, [], def!, 0, 20, 12)).toBe(false);
    expect(landedDef(lv, [], def!, 0, 20, 12)).toBe(def);
  });

  it('every generated attachment has module cells that match its footprint', () => {
    for (const k of ['spikestrip', 'icecoat', 'slimecoat', 'snapper'] as const) {
      for (let i = 0; i < 40; i++) {
        const d = generateProp(new Rng(i), k, 'x');
        for (const m of d.modules) expect('cells' in m && m.cells).toEqual(d.footprint);
      }
    }
  });

  it('leaves the crate def alone, and trimming again changes nothing', () => {
    const lv = ledges();
    const before = JSON.stringify(three);
    const once = landedDef(lv, [], three, 2, 9, 5);
    expect(JSON.stringify(three)).toBe(before);
    expect(once.footprint).toHaveLength(2);
    expect(landedDef(lv, [], once, 2, 9, 5)).toBe(once);
  });

  it('dropped cells stay dropped when the terrain fills in later', () => {
    const lv = ledges();
    const pp: PlacedProp = { uid: 1, def: landedDef(lv, [], two, 0, 20, 12), owner: 0, tx: 20, ty: 12, rot: 0 };
    lv.tiles[12 * lv.w + 21] = T_SOLID;
    lv.version++;
    expect(footprintCells(pp)).toEqual([[20, 12]]);
    const mod = new RunWorld(lv, [pp], [0]).resolved[0].mods[0];
    expect(mod.type === 'coat' && mod.cells).toEqual([[20, 12]]);
  });

  it('a blast under a dropped cell leaves the strip on; under a kept cell it falls', () => {
    const blocked = (): [Level, PlacedProp[]] => {
      const lv = testLevel();
      const block: PlacedProp = { uid: 1, def: oneBlock(), owner: 0, tx: 12, ty: FLOOR - 1, rot: 0 };
      return [lv, [block, { uid: 2, def: landedDef(lv, [block], three, 0, 10, FLOOR), owner: 0, tx: 10, ty: FLOOR, rot: 0 }]];
    };
    const [a, onA] = blocked();
    expect(detonate(a, onA, 0.5, 12, FLOOR).map((p) => p.uid)).toEqual([1, 2]);
    const [b, onB] = blocked();
    expect(detonate(b, onB, 0.5, 11, FLOOR).map((p) => p.uid)).toEqual([1]);
  });
});

describe('trimmed attachments in a race', () => {
  /** The floor turns one-way from x = `from`: no host for a coat, but still walkable, so a runner can stand on a dropped cell. */
  function oneWayFrom(from: number): Level {
    const lv = testLevel();
    for (let x = from; x < LEVEL_W - 6; x++) lv.tiles[FLOOR * lv.w + x] = T_ONEWAY;
    return lv;
  }

  it('spikes kill over kept cells and not over dropped ones', () => {
    const three = coatDef('spikestrip', 3);
    const survives = (spawnX: number, def: (lv: Level) => PropDef) => {
      const lv = oneWayFrom(11);
      lv.spawn = { tx: spawnX, ty: FLOOR - 1 };
      const run = new RunWorld(lv, [{ uid: 1, def: def(lv), owner: 1, tx: 9, ty: FLOOR, rot: 0 }], [0]);
      for (let f = 0; f < 120 && run.runners[0].alive; f++) run.step([NO_INPUT]);
      return run.runners[0].alive;
    };
    const trimmed = (lv: Level) => landedDef(lv, [], three, 0, 9, FLOOR);
    expect(survives(10, trimmed)).toBe(false);
    expect(survives(11, trimmed)).toBe(true);
    expect(survives(11, () => three)).toBe(false); // the whole strip would have got you
  });

  it('a coat changes the surface over kept cells and not over dropped ones', () => {
    const ice = coatDef('icecoat', 5);
    const slide = (spawnX: number, def: ((lv: Level) => PropDef) | null) => {
      const lv = oneWayFrom(9);
      lv.spawn = { tx: spawnX, ty: FLOOR - 1 };
      const run = new RunWorld(lv, def ? [{ uid: 1, def: def(lv), owner: 1, tx: 6, ty: FLOOR, rot: 0 }] : [], [0]);
      const b = run.runners[0].body;
      for (let f = 0; f < 70; f++) run.step([NO_INPUT]);
      b.vx = 150;
      const x0 = b.x;
      for (let f = 0; f < 20; f++) run.step([NO_INPUT]);
      return b.x - x0;
    };
    const trimmed = (lv: Level) => landedDef(lv, [], ice, 0, 6, FLOOR);
    expect(slide(9, trimmed)).toBe(slide(9, null)); // dropped: plain floor
    expect(slide(9, () => ice)).toBeGreaterThan(slide(9, null)); // the whole coat would have been slick
    expect(slide(6, trimmed)).toBeGreaterThan(slide(6, null) * 1.5); // kept: still ice
  });

  it('a snap plate split by trimming has no sensor over the gap', () => {
    const plate = snapDef(3);
    const arms = (spawnX: number, def: (lv: Level) => PropDef) => {
      const lv = testLevel();
      lv.tiles[FLOOR * lv.w + 16] = T_ONEWAY;
      lv.spawn = { tx: spawnX, ty: FLOOR - 1 };
      const run = new RunWorld(lv, [{ uid: 1, def: def(lv), owner: 1, tx: 15, ty: FLOOR, rot: 0 }], [0]);
      let armed = false;
      for (let f = 0; f < 90 && !armed; f++) {
        run.step([NO_INPUT]);
        armed = run.drainEvents().some((e) => e.type === 'prop' && e.kind === 'snap-arm');
      }
      return armed;
    };
    const trimmed = (lv: Level) => landedDef(lv, [], plate, 0, 15, FLOOR);
    expect(trimmed(testLevel()).footprint).toHaveLength(3); // the one-way is what splits it
    expect(arms(16, trimmed)).toBe(false);
    expect(arms(15, trimmed)).toBe(true);
    expect(arms(17, trimmed)).toBe(true);
    expect(arms(16, () => plate)).toBe(true);
  });
});

describe('placing a trimmed attachment', () => {
  const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

  /** A one-player match in the place phase, holding `def`, reached through real inputs. */
  function holding(def: PropDef, level?: Level): Match {
    const m = new Match(4242);
    if (level) m.level = level;
    m.join('kb1');
    m.startMatch();
    m.crate[0].def = def;
    const r = m.crate[0].rect;
    const at = { x: r.x + 4, y: r.y + 4 };
    for (let f = 0; f < 200 && m.phase === 'pick'; f++) m.step({ kb1: press({ pointer: at, confirmPressed: m.phaseFrame === 11 }) });
    expect(m.phase).toBe('place');
    for (let f = 0; f < 12; f++) m.step({ kb1: press({ pointer: at }) });
    return m;
  }

  /** The cursor spot whose ghost origin is (tx, ty). */
  function aim(def: PropDef, rot: number, tx: number, ty: number) {
    const cells = footprint(def, rot);
    const w = Math.max(...cells.map((c) => c[0])) + 1;
    const h = Math.max(...cells.map((c) => c[1])) + 1;
    return { x: (tx + (w - 1) / 2) * TILE + 8, y: (ty + (h - 1) / 2) * TILE + 8 };
  }

  function place(m: Match, def: PropDef, rot: number, tx: number, ty: number) {
    for (let i = 0; i < rot; i++) m.step({ kb1: press({ altPressed: true }) });
    m.step({ kb1: press({ pointer: aim(def, rot, tx, ty), confirmPressed: true }) });
  }

  /** A real level's spot where the far end of the strip drops, so only the kept box holds the rest in line. */
  function farEndDrops(m: Match, def: PropDef) {
    const end = def.footprint[def.footprint.length - 1];
    for (let ty = 2; ty < m.level.h - 2; ty++)
      for (let tx = 6; tx < m.level.w - 6; tx++)
        for (const rot of [2, 3]) {
          const kept = mountCells(m.level, m.placed, def, rot, tx, ty);
          if (kept.length > 0 && !kept.some((c) => c[0] === end[0])) return { rot, tx, ty };
        }
    throw new Error('no spot');
  }

  it('the ghost is what lands, and the cursor centers the whole strip as cells drop', () => {
    const three = coatDef('spikestrip', 3);
    const lv = testLevel();
    for (let x = 12; x < LEVEL_W - 6; x++) lv.tiles[FLOOR * lv.w + x] = 0;
    const m = holding(three, lv);
    const p = m.players[0];
    const seen: [number, number, boolean][] = [];
    for (let tx = 10; tx < 13; tx++) {
      p.cursor = aim(three, 0, tx, FLOOR);
      const g = m.ghostOrigin(p)!;
      seen.push([g.tx, g.def.footprint.length, m.canPlaceFor(p)]);
    }
    expect(seen).toEqual([
      [10, 2, true],
      [11, 1, true],
      [12, 3, false], // nothing mounts: the refused ghost stays whole
    ]);
  });

  it('placing through the match stores the ghost, not the crate def', () => {
    const three = coatDef('spikestrip', 3);
    const lv = testLevel();
    lv.tiles[(FLOOR - 1) * lv.w + 11] = T_SOLID;
    const m = holding(three, lv);
    const p = m.players[0];
    p.cursor = aim(three, 0, 10, FLOOR);
    const ghost = m.ghostOrigin(p)!;
    place(m, three, 0, 10, FLOOR);
    expect(p.placed).toBe(true);
    expect(m.placed[0].def).toEqual(ghost.def);
    expect(footprintCells(m.placed[0])).toEqual([
      [10, FLOOR],
      [12, FLOOR],
    ]);
    expect(m.crate[0].def.footprint).toHaveLength(3);
  });

  it('survives a snapshot round trip and keeps stepping identically', () => {
    const three = coatDef('spikestrip', 3);
    const m = holding(three);
    const spot = farEndDrops(m, three);
    place(m, three, spot.rot, spot.tx, spot.ty);
    expect(m.placed).toHaveLength(1);
    expect(m.placed[0].def.footprint.length).toBeLessThan(3);
    const back = new Match(4242);
    restoreMatch(back, cloneSnap(snapshotMatch(m)));
    expect(back.placed).toEqual(m.placed);
    expect(footprintCells(back.placed[0])).toEqual(footprintCells(m.placed[0]));
    expect(resolveProp(back.placed[0]).mods).toEqual(resolveProp(m.placed[0]).mods);
    expect(hashMatch(back)).toBe(hashMatch(m));
    for (let f = 0; f < 240; f++) {
      m.step({ kb1: press({ right: true }) });
      back.step({ kb1: press({ right: true }) });
    }
    expect(m.phase).toBe('run');
    expect(hashMatch(back)).toBe(hashMatch(m));
  });

  it('two identical runs trim identically', () => {
    const three = coatDef('spikestrip', 3);
    const play = () => {
      const m = holding(three);
      const spot = farEndDrops(m, three);
      place(m, three, spot.rot, spot.tx, spot.ty);
      for (let f = 0; f < 240; f++) m.step({ kb1: press({ right: true, run: true }) });
      return m;
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a.placed)).toBe(JSON.stringify(b.placed));
    expect(hashMatch(a)).toBe(hashMatch(b));
  });
});
