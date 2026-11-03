import { describe, expect, it } from 'vitest';
import type { Cell } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { ARCHETYPE_WEIGHTS, generateBridge, generatePart, type PropDef } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { LEVEL_H, LEVEL_W } from '../src/sim/constants';
import { isProtected, type Level, T_SOLID, tileAt } from '../src/sim/level';
import {
  canPlace,
  footprintCells,
  type Motion,
  motionOffset,
  motionPeriod,
  occupiedCells,
  type PlacedProp,
  placeFaults,
  previewProps,
  resolveProp,
  rideSpan,
  spotAt,
  sweptCells,
} from '../src/sim/props';
import { THEME_IDS } from '../src/themes';

const FLOOR = 20;

/** Open air over a floor from row FLOOR, a pillar at x=30 from row 12, and a protected pocket at the left. */
function testLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = T_SOLID;
  for (let y = 12; y < FLOOR; y++) tiles[y * LEVEL_W + 30] = T_SOLID;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [{ x: 0, y: FLOOR - 4, w: 5, h: 4 }],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
  };
}

/** A plain block of `cells`, moving by `motion`. */
function block(cells: Cell[], motion: Motion = { type: 'none' }): PropDef {
  const base = generateBridge(new Rng(1), 'b');
  const m = base.modules[0];
  if (m.type !== 'body') throw new Error('bridge is a body');
  return { ...base, key: `b${cells.length}`, motion, modules: [{ ...m, cells }], footprint: cells };
}

const ONE = block([[0, 0]]);
/** A one-tile platform running 4 tiles right and back. */
const RAIL = block([[0, 0]], { type: 'rail', angle: 0, range: 4, period: 120 });

describe('a moving part', () => {
  it('is refused where its rail runs into rock or a protected pocket, and goes where the run is clear', () => {
    const lv = testLevel();
    // Home cell free, but the rail reaches x=30, the pillar.
    expect(canPlace(lv, [], ONE, 0, 27, 14)).toBe(true);
    expect(canPlace(lv, [], RAIL, 0, 27, 14)).toBe(false);
    expect(placeFaults(lv, [], RAIL, 0, 27, 14).cells).toContainEqual([30, 14]);
    // The run from 22 to 26 is open air.
    expect(canPlace(lv, [], RAIL, 0, 22, 14)).toBe(true);
    // Into the spawn pocket from the right: refused, pointing at the pocket.
    const left = block([[0, 0]], { type: 'rail', angle: Math.PI, range: 3, period: 120 });
    expect(canPlace(lv, [], left, 0, 6, FLOOR - 2)).toBe(false);
    expect(placeFaults(lv, [], left, 0, 6, FLOOR - 2).cells.every(([x, y]) => isProtected(lv, x, y))).toBe(true);
  });

  it('passes through other parts: only where it is now refuses, and that moves with it', () => {
    const lv = testLevel();
    const mover: PlacedProp = { uid: 1, def: RAIL, owner: 0, tx: 10, ty: 10, rot: 0 };
    const r = resolveProp(mover);
    for (const f of [0, 20, 45, 70]) {
      const at = 10 + Math.round(motionOffset(r, f)[0] / 16);
      for (let x = 10; x <= 14; x++) {
        // Where it is on frame f (the one or two cells it straddles) refuses; the rest of its rail doesn't.
        const here = Math.abs(10 * 16 + motionOffset(r, f)[0] - x * 16) < 16 - 0.5;
        expect(canPlace(lv, [mover], ONE, 0, x, 10, f), `frame ${f}, x=${x}`).toBe(!here);
        if (here) expect(placeFaults(lv, [mover], ONE, 0, x, 10, f).by).toEqual([mover]);
      }
      expect(canPlace(lv, [mover], ONE, 0, at, 10, f)).toBe(false);
    }
    // A new mover's rail may cross it as well.
    expect(canPlace(lv, [mover], block([[0, 0]], { type: 'rail', angle: -Math.PI / 2, range: 4, period: 90 }), 0, 12, 13, 0)).toBe(
      canPlace(lv, [mover], ONE, 0, 12, 13, 0),
    );
  });

  it('a rider rides through still parts, and a still part may go in its path', () => {
    const lv = testLevel();
    const lift = block([[0, 0]], { type: 'rail', angle: -Math.PI / 2, range: 4, period: 120 });
    const carrier: PlacedProp = { uid: 1, def: lift, owner: 0, tx: 12, ty: 15, rot: 0 };
    // Beside wherever the lift is on frame 0.
    const ty = Math.round(15 + motionOffset(resolveProp(carrier), 0)[1] / 16);
    // A block at the foot of its path, well clear of where it is now.
    const still: PlacedProp = { uid: 3, def: ONE, owner: 0, tx: 13, ty: 15, rot: 0 };
    expect(ty).toBeLessThan(14);
    const s = spotAt(lv, [carrier, still], ONE, 0, 13, ty, 0);
    expect(s.ride?.uid).toBe(1);
    expect(s.ok).toBe(true);
    const rider: PlacedProp = { uid: 2, def: s.def, owner: 0, tx: 13, ty, rot: 0, ...(s.ride && { ride: s.ride }) };
    // Its path, rows 11 to 15, is open to still parts except where it is now.
    const at = occupiedCells(lv, [carrier, rider], 0);
    for (let y = 11; y <= 15; y++) expect(canPlace(lv, [carrier, rider], ONE, 0, 13, y, 0), `row ${y}`).toBe(at.get(y * lv.w + 13) !== rider);
    expect([11, 12, 13, 14, 15].filter((y) => at.get(y * lv.w + 13) === rider).length).toBeLessThanOrEqual(2);
  });

  it('a lift with stops sweeps its whole cycle, every park included', () => {
    const stops: Motion = { type: 'rail', angle: -Math.PI / 2, range: 6 * 16, period: 200, dwell: 40, stops: [3 * 16] };
    // Two legs up, two down, a dwell at each end of each.
    expect(motionPeriod(stops)).toBe(200 + 2 * 40 * 2);
    const lift = block([[0, 0]], { ...stops, range: 6 });
    const pp: PlacedProp = { uid: 5, def: { ...lift, motion: { ...stops, range: 6, stops: [3] } }, owner: 0, tx: 12, ty: 15, rot: 0 };
    expect(rideSpan(resolveProp(pp))).toBe(360);
    const rows = new Set(sweptCells(pp).map(([, y]) => y));
    for (let y = 9; y <= 15; y++) expect(rows.has(y), `row ${y}`).toBe(true);
  });
});

describe('set pieces', () => {
  it('refuse a part only where their solids are now: paths, swings and headroom take nothing', { timeout: 30_000 }, () => {
    let open = 0;
    for (const theme of THEME_IDS) {
      const lv = generateLevel((3 * 2654435761 + 17) >>> 0, theme);
      for (const f of [0, 97]) {
        const solids = previewProps(lv, lv.setPieces.map(resolveProp), f).solids.filter((s) => !s.film);
        for (const sp of lv.setPieces)
          for (const [x, y] of footprintCells(sp)) {
            if (tileAt(lv, x, y) || isProtected(lv, x, y)) continue;
            const inSolid = solids.some((s) => s.x < (x + 1) * 16 - 0.5 && s.x + s.w > x * 16 + 0.5 && s.y < (y + 1) * 16 - 0.5 && s.y + s.h > y * 16 + 0.5);
            expect(canPlace(lv, [], ONE, 0, x, y, f), `${theme} ${sp.def.name} ${x},${y} frame ${f}`).toBe(!inSolid);
            if (!inSolid) open++;
          }
      }
    }
    expect(open).toBeGreaterThan(50);
  });
});

describe('a refused ghost shows why', () => {
  it('marks exactly the cells canPlace refuses, and nothing on a spot that takes the part', () => {
    const lv = testLevel();
    const wide = block([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    // Straddling the pillar: the middle cell is rock.
    expect(placeFaults(lv, [], wide, 0, 29, 14).cells).toEqual([[30, 14]]);
    expect(placeFaults(lv, [], wide, 1, 29, 14).cells).toEqual([]);
    expect(placeFaults(lv, [], wide, 0, 46, 5).cells).toEqual([[48, 5]]);
  });
});

describe('every moving part can still be placed', () => {
  it('somewhere on a level of every theme', { timeout: 60_000 }, () => {
    const movers: PropDef[] = [];
    for (const [arch] of ARCHETYPE_WEIGHTS)
      for (let s = 0; s < 20; s++) {
        const part = generatePart(new Rng(s * 31 + 7), arch, arch);
        const big = part.variants[part.variants.length - 1];
        if (big.motion.type !== 'none' && !movers.some((m) => m.archetype === arch && m.motion.type === big.motion.type)) movers.push(big);
      }
    expect(movers.length).toBeGreaterThan(2);
    for (const theme of THEME_IDS) {
      const lv = generateLevel((7 * 2654435761 + 3) >>> 0, theme);
      for (const def of movers) {
        let found = false;
        for (let y = 1; y < lv.h && !found; y++) for (let x = 0; x < lv.w && !found; x++) found = canPlace(lv, [], def, 0, x, y);
        expect(found, `${theme} ${def.archetype} ${def.motion.type}`).toBe(true);
      }
    }
  });

  it('and where it goes, its path keeps out of rock and protected pockets', () => {
    const lv = generateLevel((7 * 2654435761 + 3) >>> 0, 'mine');
    const def = block([[0, 0]], { type: 'loop', radius: 2.5, period: 200, dir: 1 });
    let checked = 0;
    for (let y = 0; y < lv.h; y += 3)
      for (let x = 0; x < lv.w; x += 3) {
        if (!canPlace(lv, [], def, 0, x, y)) continue;
        checked++;
        for (const [cx, cy] of sweptCells({ uid: 0, def, owner: 0, tx: x, ty: y, rot: 0 })) {
          expect(tileAt(lv, cx, cy), `${x},${y} → ${cx},${cy}`).not.toBe(T_SOLID);
          expect(isProtected(lv, cx, cy)).toBe(false);
        }
      }
    expect(checked).toBeGreaterThan(0);
  });
});
