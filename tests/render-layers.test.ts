import { describe, expect, it } from 'vitest';
import { drawBackdrop, drawForeground } from '../src/render/props';
import { BACKDROP, moduleArt } from '../src/render/props/common';
import type { Light, RC } from '../src/render/kit';
import type { Module, ModuleOf, PropDef, RotorLook, RotorSupport } from '../src/sim/props';
import { pistonState, resolveProp } from '../src/sim/props';
import { housed } from '../src/render/props/machine';

/**
 * Set-piece scenery paints behind the terrain, so terrain can hide it. That is only fair for
 * parts nobody can touch: everything a player stands on, gets hurt by, or reads a warning
 * from has to stay on the front layers.
 */

/** Which module types may paint behind the terrain. Typed so a new module has to pick a side. */
const MAY_PAINT_BACKDROP: Record<Module['type'], boolean> = {
  body: false,
  bomb: false,
  bumper: false,
  button: false,
  cannon: false,
  coat: false,
  deco: true,
  dropper: false,
  fan: false,
  flame: false,
  flood: true,
  fuse: false,
  geyser: false,
  keg: false,
  laser: false,
  launcher: false,
  magnet: false,
  mystery: false,
  phase: false,
  piston: false,
  pipe: false,
  rope: false,
  rotor: true,
  sentry: false,
  // The dark window behind the glass and its moonlight; the shards themselves draw in front.
  shards: true,
  lob: false,
  cavein: false,
  cart: false,
  snapper: false,
  spikes: false,
  spring: false,
  swinger: false,
  tesla: false,
  vehicle: false,
  web: false,
};

/** A canvas context that logs every draw call and property write, for comparing what two passes paint. */
function recorder(log: unknown[]): CanvasRenderingContext2D {
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

function rc(frame: number): RC & { lights: Light[]; log: unknown[] } {
  const log: unknown[] = [];
  const ctx = recorder(log);
  return { s: ctx, bg: ctx, g: ctx, lights: [], t: 1, frame, log };
}

function setPiece(...modules: Module[]) {
  const def: PropDef = {
    key: 'test',
    name: 'Test',
    maker: 'test',
    archetype: 'platform',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 200, glowHue: 40, woodHue: 28 },
    motion: { type: 'none' },
    modules,
    footprint: [[0, 0]],
  };
  return resolveProp({ uid: 1, def, owner: -1, tx: 10, ty: 8, rot: 0 });
}

function rotor(look: RotorLook, support: RotorSupport): ModuleOf<'rotor'> {
  return {
    type: 'rotor',
    look,
    support,
    mastX: 3.5,
    hub: [0.5, 0.5],
    arm: 3,
    count: 2,
    angle0: 0,
    period: 240,
    swing: 0.5,
    dir: 1,
    width: 2,
    thick: 0.5,
    material: 'metal',
    seed: 1,
  };
}

const deco = (kind: ModuleOf<'deco'>['kind']): ModuleOf<'deco'> => ({ type: 'deco', kind, at: [0, 0], w: 4, h: 6, seed: 1 });

const SUPPORTS: [RotorLook, RotorSupport][] = [
  ['windmill', 'tower'],
  ['cog', 'tower'],
  ['chandelier', 'ceiling'],
  ['log', 'ceiling'],
  ['slab', 'ceiling'],
  ['bucket', 'ceiling'],
  ['crane', 'mast'],
  ['hay', 'mast'],
  ['gondola', 'mast'],
];

describe('set-piece render layers', () => {
  it('only scenery modules register backdrop art', () => {
    for (const [type, allowed] of Object.entries(MAY_PAINT_BACKDROP)) {
      expect(moduleArt(type).length, type).toBeGreaterThan(0);
      expect(
        moduleArt(type).some((a) => a.layer === BACKDROP),
        type,
      ).toBe(allowed);
    }
  });

  it.each(SUPPORTS)('%s on a %s puts its support behind the terrain, and that support holds still', (look, support) => {
    const r = setPiece(rotor(look, support));
    const a = rc(0);
    const b = rc(137);
    drawBackdrop(a, r, { level: null });
    drawBackdrop(b, r, { level: null });
    expect(a.log.length).toBeGreaterThan(0);
    // Sails, links and platforms move with the frame: the moment one lands here it stops matching.
    expect(b.log).toEqual(a.log);
  });

  it('a free-standing wheel has no scenery to hide', () => {
    const a = rc(0);
    drawBackdrop(a, setPiece(rotor('cog', 'none')), { level: null });
    expect(a.log).toEqual([]);
  });

  it('gantries and antenna masts stand behind the terrain; AC housings skin a solid, so they stay in front', () => {
    for (const [kind, behind] of [
      ['press', true],
      ['antenna', true],
      ['ac', false],
    ] as const) {
      const a = rc(0);
      drawBackdrop(a, setPiece(deco(kind)), { level: null });
      expect(a.log.length > 0, kind).toBe(behind);
    }
  });

  it('a crate machine draws its own cell; a set piece keeps its block under its own housing', () => {
    const body: ModuleOf<'body'> = { type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 };
    const jet: ModuleOf<'flame'> = { type: 'flame', at: [0.5, 0.5], angle: -Math.PI / 2, length: 3, on: 60, off: 60, warn: 30 };
    const fan: ModuleOf<'fan'> = { type: 'fan', at: [0.5, 0.5], angle: -Math.PI / 2, length: 4, strength: 2000 };
    expect(housed(setPiece(body, jet))).toBe(true);
    expect(housed(setPiece(body))).toBe(false);
    expect(housed(setPiece(body, deco('ac'), fan))).toBe(false);
  });

  it("lights a crate crusher's lamp while the head is still at rest: the wind-up is the tell", () => {
    const body: ModuleOf<'body'> = { type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 };
    const piston: ModuleOf<'piston'> = { type: 'piston', at: [0.5, 0.5], angle: Math.PI / 2, reach: 3, width: 1, period: 160 };
    const r = setPiece(body, piston);
    const warned = Array.from({ length: 160 }, (_, frame) => frame).some((frame) => {
      const a = rc(frame);
      drawForeground(a, r, { level: null });
      return a.lights.length > 0 && pistonState(r.mods[1] as ModuleOf<'piston'>, frame, r.phase).ext === 0;
    });
    expect(warned).toBe(true);
  });

  it("keeps the press's warning lamp in front: it is the tell for the slam", () => {
    const piston: ModuleOf<'piston'> = { type: 'piston', at: [2, 0.5], angle: Math.PI / 2, reach: 4, width: 2, period: 160 };
    const r = setPiece(deco('press'), piston);
    const lit = Array.from({ length: 160 }, (_, frame) => frame).find((frame) => {
      const back = rc(frame);
      const front = rc(frame);
      drawBackdrop(back, r, { level: null });
      drawForeground(front, r, { level: null });
      expect(back.lights).toEqual([]);
      return front.lights.length > 0;
    });
    expect(lit).toBeDefined();
  });
});
