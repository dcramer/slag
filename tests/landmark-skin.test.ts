import { describe, expect, it } from 'vitest';
import { generateTheme } from '../src/gen/theme';
import type { EdgeP } from '../src/render/ink';
import { type Area, inkMaterial, inSkin, skinLoops, skinOf } from '../src/render/ink-terrain';
import type { RC } from '../src/render/kit';
import { drawBackdrop, drawForeground } from '../src/render/props';
import { BACKDROP, moduleArt } from '../src/render/props/common';
import { TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import type { DecoKind, ModuleOf, PropDef } from '../src/sim/props';
import { resolveProp } from '../src/sim/props';

/**
 * A stage concept's landmark is drawn in its own material (Level.landmark.skin) with a backdrop shell
 * behind it (docs/SETPIECES.md §3, §4): the skin covers exactly the landmark's box, the theme's ground keeps
 * its own cap outside it, and the shells paint behind the terrain only.
 */

const W = 30;
const H = 20;
const FLOOR = 14;

/** Ground from FLOOR down, and a 6×4 block standing on it at x 10..15, rows 10..13. */
function level(skin?: 'timber' | 'carved'): Level {
  const tiles = new Uint8Array(W * H);
  for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = 1;
  for (let y = 10; y < FLOOR; y++) for (let x = 10; x < 16; x++) tiles[y * W + x] = 1;
  const theme = generateTheme(3, 'castle');
  return {
    seed: 1,
    w: W,
    h: H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: { ...theme, terrain: { ...theme.terrain, sub: null } },
    style: 'test',
    version: 0,
    setPieces: [],
    ...(skin ? { landmark: { concept: 'test', rect: { x: 10, y: 10, w: 6, h: 4 }, skin } } : {}),
  };
}

/** A canvas context that logs every call and property write. */
function recorder(log: unknown[][]): CanvasRenderingContext2D {
  const ctx: unknown = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args: unknown[]) => {
          log.push([String(key), ...args.filter((a) => typeof a !== 'object')]);
          return ctx;
        },
      set: (_, key, value) => {
        log.push([String(key), typeof value === 'object' ? 'obj' : value]);
        return true;
      },
    },
  );
  return ctx as CanvasRenderingContext2D;
}

const solidOf = (l: Level) => (x: number, y: number) => x >= 0 && x < l.w && y >= 0 && y < l.h && l.tiles[y * l.w + x] === 1;
const whole: Area = { x0: 0, y0: 0, x1: W * TILE, y1: H * TILE };

function painted(l: Level, area: Area) {
  const log: unknown[][] = [];
  inkMaterial(recorder(log), l, l.theme, 7, solidOf(l), area);
  return log;
}

describe('landmark skin', () => {
  it('takes its own look, and none without a skin', () => {
    expect(skinOf(level())).toBeNull();
    const s = skinOf(level('timber'))!;
    expect(s.T.kind).toBe('timber');
    expect(s.T.veins).toBe(false);
    // A built thing wears its own cap, not the theme's moss or grass.
    expect(s.T.cap).toBe('beam');
    expect(inSkin(s, 10, 10)).toBe(true);
    expect(inSkin(s, 15, 13)).toBe(true);
    expect(inSkin(s, 16, 13)).toBe(false);
    expect(inSkin(s, 12, FLOOR)).toBe(false);
  });

  it('paints its material over its own tiles, under a clip, and leaves a plain level alone', () => {
    const plain = painted(level(), whole);
    expect(plain.some(([k]) => k === 'clip')).toBe(false);
    const skinned = painted(level('carved'), whole);
    expect(skinned.some(([k]) => k === 'clip')).toBe(true);
    // A redraw that can't reach the landmark doesn't touch it.
    const far = painted(level('carved'), { x0: 24 * TILE, y0: 0, x1: W * TILE, y1: 6 * TILE });
    expect(far.some(([k]) => k === 'clip')).toBe(false);
  });

  it('splits the contour: the skin caps its own tops, the ground caps the rest but not the floor inside the box', () => {
    const s = skinOf(level('timber'));
    const top = (x: number, y: number): EdgeP => ({ x, y, nx: 0, ny: -1, hidden: false });
    // Over the block's roof, over open ground, and over ground inside the box (a room's floor).
    const roof = top(12.5 * TILE, 10 * TILE);
    const ground = top(4.5 * TILE, FLOOR * TILE);
    const loops = [[roof, ground]];
    const g = skinLoops(s, loops, 'ground')[0];
    const k = skinLoops(s, loops, 'skin')[0];
    expect(g.map((p) => p.hidden)).toEqual([true, false]);
    expect(k.map((p) => p.hidden)).toEqual([false, true]);
    const box = skinOf({ ...level('timber'), landmark: { concept: 'test', rect: { x: 10, y: 8, w: 6, h: 6 }, skin: 'timber' } });
    expect(skinLoops(box, [[top(17.5 * TILE, FLOOR * TILE), top(12.5 * TILE, FLOOR * TILE)]], 'ground')[0].map((p) => p.hidden)).toEqual([false, true]);
    expect(skinLoops(null, loops, 'skin')).toEqual([]);
  });
});

const SHELLS: DecoKind[] = ['facade', 'gantry', 'flywheel', 'headframe', 'hull', 'billboard', 'clockface'];

function rc(frame: number): RC & { log: unknown[][] } {
  const log: unknown[][] = [];
  const ctx = recorder(log);
  return { s: ctx, bg: ctx, g: ctx, lights: [], t: 1, frame, log };
}

function piece(kind: DecoKind, wheel = false) {
  const modules: PropDef['modules'] = [{ type: 'deco', kind, at: [0, 0], w: 12, h: 12, seed: 3 }];
  if (wheel) {
    const rotor: ModuleOf<'rotor'> = {
      type: 'rotor',
      look: 'cog',
      support: 'none',
      mastX: 0,
      hub: [6, 6],
      arm: 4,
      count: 6,
      angle0: 0,
      period: 600,
      swing: 0,
      dir: 1,
      width: 2,
      thick: 0.5,
      material: 'metal',
      seed: 1,
    };
    modules.push(rotor);
  }
  const def: PropDef = {
    key: 'shell',
    name: 'Shell',
    maker: 'test',
    archetype: 'platform',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 200, glowHue: 40, woodHue: 28 },
    motion: { type: 'none' },
    modules,
    footprint: [[0, 0]],
  };
  return resolveProp({ uid: 1, def, owner: -1, tx: 4, ty: 2, rot: 0 });
}

describe('backdrop shells', () => {
  it('deco may paint behind the terrain', () => {
    expect(moduleArt('deco').some((a) => a.layer === BACKDROP)).toBe(true);
  });

  it.each(SHELLS)('%s paints behind the terrain only, and holds still', (kind) => {
    const a = rc(0);
    const b = rc(211);
    drawBackdrop(a, piece(kind), { level: null });
    drawBackdrop(b, piece(kind), { level: null });
    expect(a.log.length).toBeGreaterThan(0);
    expect(b.log).toEqual(a.log);
    const front = rc(0);
    drawForeground(front, piece(kind), { level: null });
    expect(front.log.filter(([k]) => k === 'drawImage' || k === 'fill').length).toBe(0);
  });

  it('a flywheel rim turns with the wheel in front of it', () => {
    const a = rc(0);
    const b = rc(150);
    drawBackdrop(a, piece('flywheel', true), { level: null });
    drawBackdrop(b, piece('flywheel', true), { level: null });
    const turns = (r: { log: unknown[][] }) => r.log.filter(([k]) => k === 'rotate');
    expect(turns(a)).not.toEqual(turns(b));
  });
});
