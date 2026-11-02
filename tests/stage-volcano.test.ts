import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { TILE } from '../src/sim/constants';
import { type Level, T_SOLID, tileAt } from '../src/sim/level';
import {
  type Contrib,
  LOB_FLIGHT,
  LOB_OFF,
  LOB_WARN,
  lobCycle,
  lobPoint,
  lobRadius,
  type Module,
  type ModuleOf,
  moduleSim,
  type PlacedProp,
  type PropCtx,
  resolveProp,
} from '../src/sim/props';

/**
 * The volcano's stage concepts (src/gen/stage/volcano.ts) and its own hazards, as volcano behaviour: what
 * each landmark's pieces do where they stand. What every landmark owes (scale, footing, ways through, a
 * layout that varies, the static proof, no free ride, tells) is held by tests/conformance.
 */

function landmark(id: string, seed: number, size?: 'classic' | 'wide'): Level {
  const l = generateLevel(seed, 'volcano', { concept: id, ...(size ? { size } : {}) });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;
/** Every module of the landmark's own pieces, resolved into world px. */
const mods = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`)).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

describe('volcano stage concepts', () => {
  it('each gets its share of volcano levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'volcano', rollProfile(s, 'volcano'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of ['caldera', 'lavafall-organ', 'dragon-ribs', 'lava-tube']) expect(seen.get(id) ?? 0, id).toBeGreaterThan(20);
    // The tide is for the widest levels only.
    expect(seen.get('magma-tide') ?? 0).toBeGreaterThan(4);
    expect(seen.get('plain') ?? 0).toBeGreaterThan(60);
  });

  it('the Caldera floods its crater below the rim, and its serpent leaps out over the rim', () => {
    const l = landmark('caldera', 2);
    const flood = ofType(l, 'flood')[0];
    const serpent = ofType(l, 'lob').find((m) => m.look === 'serpent')!;
    expect(flood.look).toBe('lava');
    const rimRow = Math.floor((flood.at[1] - flood.high) / TILE);
    const a = Math.floor(flood.at[0] / TILE);
    // The rim stands over high water on both sides.
    let rim = 0;
    while (!solid(l, a - 1, rim)) rim++;
    expect(rimRow).toBeGreaterThan(rim + 1);
    // Its arc tops out above the rim, and both ends are in the lava.
    expect(lobPoint(serpent, 0.5)[1]).toBeLessThan(rim * TILE);
    for (const u of [0, 1]) {
      const [x] = lobPoint(serpent, u);
      expect(x >= flood.at[0] && x <= flood.at[0] + flood.w).toBe(true);
    }
  });

  it('the Magma Tide floods the basin floor and leaves its refuges dry', () => {
    const l = landmark('magma-tide', 2, 'wide');
    const tide = ofType(l, 'flood');
    expect(tide.length).toBeGreaterThan(1);
    // One cycle for the whole basin.
    expect(new Set(tide.map((m) => `${m.off},${m.rise},${m.hold}`)).size).toBe(1);
    for (const m of tide) {
      const crest = Math.floor((m.at[1] - m.high) / TILE);
      // Each run of floor ends at a refuge or a wall that stands above the crest.
      const right = Math.round((m.at[0] + m.w) / TILE);
      expect(solid(l, right, crest - 1) || solid(l, right, crest), `refuge at ${right}`).toBe(true);
    }
    // The arch's break is slabbed with obsidian that gives way.
    const glass = ofType(l, 'body').find((m) => m.look === 'obsidian');
    expect(glass?.material).toBe('crumble');
  });

  it('the Lavafall Organ pours its lava off cornices onto the terraces below', () => {
    for (const seed of [1, 4]) {
      const l = landmark('lavafall-organ', seed);
      const falls = ofType(l, 'geyser').filter((m) => m.angle > 0);
      expect(falls.length).toBeGreaterThan(0);
      for (const m of falls) {
        const x = Math.floor(m.at[0] / TILE);
        const y = Math.floor(m.at[1] / TILE);
        expect(solid(l, x, y - 1), 'poured from rock').toBe(true);
        expect(solid(l, x, Math.floor((m.at[1] + m.length) / TILE)), `lands on rock ${seed} ${x},${y} len ${m.length / TILE}`).toBe(true);
      }
    }
  });

  it('the Dragon Ribs breathe fire out of the skull and vent lava up into the ribcage', () => {
    const l = landmark('dragon-ribs', 1);
    const [breath] = ofType(l, 'flame');
    expect(breath).toBeDefined();
    // Along the mouth: the passage it breathes down is open, under bone.
    const bx = Math.floor(breath.at[0] / TILE);
    const by = Math.floor(breath.at[1] / TILE);
    expect(solid(l, bx, by)).toBe(false);
    let roof = by;
    while (roof > 0 && !solid(l, bx, roof)) roof--;
    expect(by - roof).toBeLessThanOrEqual(3);
    for (const v of ofType(l, 'geyser')) {
      const x = Math.floor(v.at[0] / TILE);
      expect(v.angle).toBeLessThan(0);
      expect(solid(l, x, Math.floor(v.at[1] / TILE)), 'vents from the ground').toBe(true);
    }
  });

  it('the Lava Tube hangs its drips from the ceiling', () => {
    for (const seed of [5, 9]) {
      const l = landmark('lava-tube', seed, 'wide');
      const drips = ofType(l, 'dropper');
      expect(drips.length).toBeGreaterThan(0);
      for (const d of drips) for (const [x, y] of d.cells) expect(solid(l, x, y - 1), 'hung from rock').toBe(true);
    }
  });
});

describe('the lob (magma serpent, volcanic bombs)', () => {
  const serpent: Module = { type: 'lob', look: 'serpent', from: [2, 20], to: [14, 20], apex: 8, count: 5, lag: 6, radius: 0.6, off: 100, warn: 40, flight: 90 };
  const pp: PlacedProp = {
    uid: 7,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'k',
      name: 'Serpent',
      maker: 't',
      archetype: 'flamer',
      role: 'hazard',
      style: { metal: 'obsidian', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
      motion: { type: 'none' },
      modules: [serpent],
      footprint: [[14, 19]],
    },
  };
  const r = resolveProp(pp);
  const m = r.mods[0] as ModuleOf<'lob'>;
  const hazards = (f: number) => {
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    moduleSim('lob').build!(m, { r, off: [0, 0], prev: [0, 0], frame: f, mi: 0, live: true } as unknown as PropCtx, out);
    return out.hazards;
  };

  it('hurts nothing while it waits and warns, then each segment hurts on the arc, the tail tapering', () => {
    const total = 100 + 40 + 90 + 4 * 6;
    let flew = 0;
    for (let f = 0; f < total; f++) {
      const c = lobCycle(m, f, r.phase);
      const hz = hazards(f);
      if (c.seg === LOB_OFF || c.seg === LOB_WARN) expect(hz).toEqual([]);
      if (c.seg === LOB_FLIGHT) {
        flew++;
        expect(hz.length).toBeGreaterThan(0);
        expect(hz.length).toBeLessThanOrEqual(5);
        for (const h of hz) {
          if (h.kind !== 'circle') throw new Error('a segment is a circle');
          // On the arc: some point of it is where the segment is.
          const near = Array.from({ length: 101 }, (_, i) => lobPoint(m, i / 100)).some(([x, y]) => Math.hypot(x - h.x, y - h.y) < 3);
          expect(near).toBe(true);
        }
      }
    }
    expect(flew).toBe(90 + 4 * 6);
    expect(lobRadius(m, 4)).toBeLessThan(lobRadius(m, 0));
  });

  it('rises out of the lava, over the apex and back down, the same on every pass', () => {
    const [, y0] = lobPoint(m, 0);
    const [, ym] = lobPoint(m, 0.5);
    expect(y0 - ym).toBeCloseTo(8 * TILE, 5);
    expect(lobPoint(m, 1)).toEqual([14 * TILE, 20 * TILE]);
    const P = 100 + 40 + 90 + 24;
    expect(hazards(150 + P)).toEqual(hazards(150));
  });
});
