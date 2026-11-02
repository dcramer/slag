import { describe, expect, it } from 'vitest';
import { normalizeCells } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateProp } from '../src/gen/props';
import { generateTheme } from '../src/gen/theme';
import { launcherPivot } from '../src/render/props/modules/launcher';
import { LEVEL_H, LEVEL_W, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import {
  AMMO,
  type Ammo,
  barrierOf,
  canPlace,
  footprintCells,
  LAUNCHER_FRAMES,
  launcherBody,
  launcherFrame,
  type LauncherStyle,
  type ModuleOf,
  type PlacedProp,
  type PropDef,
  resolveProp,
} from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

/**
 * The launchers that take two tiles (src/sim/props/launcher-frames.ts): what the sim fires from, stands on
 * and reserves has to be what the art shows, at every rotation (docs/ART.md, fair play).
 */

const FLOOR = 22;
const AMMO_OF: Record<string, Ammo> = { hangar: 'glider', cannon: 'cannonball', ballista: 'bolt', thrower: 'shuriken', totem: 'fireball', gumball: 'rubber' };
const FRAMED = Object.keys(LAUNCHER_FRAMES) as LauncherStyle[];

function openLevel(): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
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

/** A fixed launcher of `style` that fires on its first frame, on its own frame's block. */
function launcherDef(style: LauncherStyle): PropDef {
  const ammo = AMMO_OF[style];
  const modules: PropDef['modules'] = [
    launcherBody(style, 'metal'),
    {
      type: 'launcher',
      style,
      ammo,
      at: launcherFrame(style).at,
      angle: AMMO[ammo].gravity > 200 ? -0.5 : 0,
      aim: 'fixed',
      sweep: 0,
      sweepPeriod: 200,
      interval: 60,
      burst: 1,
      spread: 1,
      spreadAngle: 0,
      speed: 200,
    },
  ];
  return {
    key: style,
    name: style,
    maker: '',
    archetype: 'launcher',
    role: 'hazard',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
    motion: { type: 'none' },
    modules,
    footprint: normalizeCells(launcherFrame(style).cells.slice()),
  };
}

const placed = (def: PropDef, rot: number): PlacedProp => ({ uid: 1, def, owner: 3, tx: 20, ty: 12, rot });
const launcherOf = (pp: PlacedProp) => resolveProp(pp).mods.find((m): m is ModuleOf<'launcher'> => m.type === 'launcher')!;

describe('two-tile launchers', () => {
  it('the generator builds every style in its frame', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const d = generateProp(new Rng(i), 'launcher', 'x');
      const m = d.modules.find((x): x is ModuleOf<'launcher'> => x.type === 'launcher')!;
      seen.add(m.style);
      expect(d.footprint).toEqual(normalizeCells(launcherFrame(m.style).cells.slice()));
      expect(m.at).toEqual(launcherFrame(m.style).at);
    }
    expect(generateProp(new Rng(3), 'hangar', 'h').footprint).toHaveLength(2);
    for (const s of FRAMED.filter((s) => s !== 'hangar')) expect(seen.has(s)).toBe(true);
  });

  it('fire from where the art turns the barrel, at every rotation', () => {
    for (const style of FRAMED)
      for (let rot = 0; rot < 4; rot++) {
        const pp = placed(launcherDef(style), rot);
        const r = resolveProp(pp);
        const m = launcherOf(pp);
        const [ax, ay] = launcherPivot(r, m);
        expect(ax, `${style} rot ${rot}`).toBeCloseTo(m.at[0], 6);
        expect(ay, `${style} rot ${rot}`).toBeCloseTo(m.at[1], 6);
        // The muzzle is inside the part's own cells.
        const cells = footprintCells(pp);
        expect(cells.some(([x, y]) => Math.floor(m.at[0] / TILE) === x && Math.floor(m.at[1] / TILE) === y)).toBe(true);
        // And the shot really leaves from there, along the way it faces.
        const run = new RunWorld(openLevel(), [pp], [0]);
        run.frame = RUN_COUNTDOWN;
        run.drainEvents();
        let fire: { x: number; y: number; angle: number } | undefined;
        for (let f = 0; f < 80 && !fire; f++) {
          run.step([NO_INPUT]);
          fire = run.drainEvents().find((e) => e.type === 'fire') as typeof fire;
        }
        expect(fire, `${style} rot ${rot} fired`).toBeDefined();
        expect(fire!.x).toBeCloseTo(m.at[0] + Math.cos(m.angle) * 10, 6);
        expect(fire!.y).toBeCloseTo(m.at[1] + Math.sin(m.angle) * 10, 6);
      }
  });

  it('stand inside their cells as the art draws them, and a half turn mirrors them', () => {
    for (const style of FRAMED)
      for (let rot = 0; rot < 4; rot++) {
        const pp = placed(launcherDef(style), rot);
        const cells = footprintCells(pp);
        const x0 = Math.min(...cells.map((c) => c[0])) * TILE;
        const y0 = Math.min(...cells.map((c) => c[1])) * TILE;
        const x1 = (Math.max(...cells.map((c) => c[0])) + 1) * TILE;
        const y1 = (Math.max(...cells.map((c) => c[1])) + 1) * TILE;
        const run = new RunWorld(openLevel(), [pp], [0]);
        run.step([NO_INPUT]);
        const mine = run.solids.filter((s) => s.propUid === pp.uid);
        expect(mine.length).toBeGreaterThan(0);
        for (const s of mine) {
          expect(s.x).toBeGreaterThanOrEqual(x0 - 1e-6);
          expect(s.y).toBeGreaterThanOrEqual(y0 - 1e-6);
          expect(s.x + s.w).toBeLessThanOrEqual(x1 + 1e-6);
          expect(s.y + s.h).toBeLessThanOrEqual(y1 + 1e-6);
        }
        // Its feet stay on the floor: a half turn mirrors it left to right, never stands it on its head.
        if (rot === 2) {
          const up = new RunWorld(openLevel(), [placed(launcherDef(style), 0)], [0]);
          up.step([NO_INPUT]);
          const bottom = (ss: typeof mine) => Math.max(...ss.map((s) => s.y + s.h));
          const top = (ss: typeof mine) => Math.min(...ss.map((s) => s.y));
          const ups = up.solids.filter((s) => s.propUid === pp.uid);
          expect(bottom(mine)).toBeCloseTo(bottom(ups), 6);
          expect(top(mine)).toBeCloseTo(top(ups), 6);
        }
      }
  });

  it('a lobber turned half round still lobs, the other way', () => {
    const pp = placed(launcherDef('cannon'), 2);
    const m = launcherOf(pp);
    expect(Math.cos(m.angle)).toBeLessThan(0);
    expect(Math.sin(m.angle)).toBeLessThan(0);
  });

  it('need their whole footprint to place, and hold it against the winnability proof', () => {
    const level = openLevel();
    for (const style of FRAMED)
      for (let rot = 0; rot < 4; rot++) {
        const def = launcherDef(style);
        const pp = placed(def, rot);
        const cells = footprintCells(pp);
        expect(cells).toHaveLength(2);
        expect(canPlace(level, [], def, rot, pp.tx, pp.ty)).toBe(true);
        // Any one of its cells taken and it doesn't go in.
        for (const [x, y] of cells) {
          const blocked = { ...level, tiles: level.tiles.slice() };
          blocked.tiles[y * level.w + x] = 1;
          expect(canPlace(blocked, [], def, rot, pp.tx, pp.ty), `${style} rot ${rot} at ${x},${y}`).toBe(false);
        }
        // Every cell it takes is either ground the proof stands on or ground it keeps clear of.
        const b = barrierOf(level, pp);
        for (const [x, y] of cells) expect(b.ground.includes(y * level.w + x) || b.noGo.includes(y * level.w + x), `${style} rot ${rot}`).toBe(true);
      }
  });
});
