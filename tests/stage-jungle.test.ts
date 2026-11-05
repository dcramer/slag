import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { waysOf } from '../src/gen/stage/kit';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import { type Contrib, logBox, type Module, type ModuleOf, moduleSim, type PropCtx, resolveProp } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * The jungle's stage concepts (src/gen/stage/jungle.ts) and its own hazards, as jungle behaviour: each way
 * past a landmark is a real alternative, and its pieces do what they're for where they stand. What every
 * landmark owes (scale, footing, ways through, a layout that varies, the static proof, no free ride, tells)
 * is held by tests/conformance.
 */

const IDS = ['step-temple', 'waterfall-cliff', 'canopy-village', 'thorn-gorge', 'sun-gate'];

function landmark(id: string, seed: number, size: 'classic' | 'wide' = 'classic'): Level {
  const l = generateLevel(seed, 'jungle', { concept: id, size });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;
/** Every module of the landmark's own pieces, resolved into world px. */
const mods = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`)).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

describe('jungle stage concepts', () => {
  it('each gets its share of jungle levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'jungle', rollProfile(s, 'jungle'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of IDS) expect(seen.get(id) ?? 0, id).toBeGreaterThan(20);
    expect(seen.get('plain') ?? 0).toBeGreaterThan(30);
  });

  it('every way past a landmark is a real alternative: shut either and the flag is still reached', () => {
    for (const id of IDS)
      for (const seed of [1, 2]) {
        const l = landmark(id, seed);
        const shut = waysOf(lastGenInfo.landmark!);
        expect(shut.length, id).toBe(2);
        for (const r of shut) {
          const tiles = new Uint8Array(l.tiles);
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * l.w + x] === T_EMPTY) tiles[y * l.w + x] = T_SOLID;
          const reach = analyzeReach(withBridges({ ...l, tiles, setPieces: [] }, l.solution ?? []));
          expect(reach.goalReached, `${id} seed ${seed} with ${JSON.stringify(r)} shut`).toBe(true);
        }
      }
  });

  it('the Step Temple rolls its boulder across the summit, and its idols shoot down the stair', () => {
    for (const seed of [1, 3]) {
      const l = landmark('step-temple', seed);
      const [boulder] = ofType(l, 'vehicle');
      expect(boulder.look).toBe('boulder');
      const x = Math.floor(boulder.at[0] / TILE);
      const y = Math.round(boulder.at[1] / TILE);
      // It stands on the summit: stone under it, sky over it.
      expect(solid(l, x, y)).toBe(true);
      for (let r = 0; r < y; r++) expect(solid(l, x, r)).toBe(false);
      for (const idol of ofType(l, 'cannon')) {
        expect(idol.ammo).toBe('bolt');
        expect(idol.angle).toBeGreaterThan(Math.PI / 2);
        expect(idol.angle).toBeLessThan(Math.PI);
      }
    }
  });

  it('the Waterfall Cliff pours water over its ledges, shoving rather than killing, and lets up now and then', () => {
    const l = landmark('waterfall-cliff', 2);
    const [falls] = ofType(l, 'geyser');
    expect(falls.look).toBe('water');
    expect(falls.lethal).toBe(false);
    expect(falls.angle).toBeCloseTo(Math.PI / 2);
    // Off long enough to slip through (barrier's MIN_OPENING), and it reaches the ground.
    expect(falls.off).toBeGreaterThanOrEqual(30);
    expect(solid(l, Math.floor(falls.at[0] / TILE), Math.round((falls.at[1] + falls.length) / TILE))).toBe(true);
  });

  it('the Thorn Gorge grows its thorns below the bridge, down the walls of the gorge', () => {
    const l = landmark('thorn-gorge', 1);
    const thorns = ofType(l, 'spikes').filter((m) => m.angle === 0 || m.angle === Math.PI);
    expect(thorns.length).toBeGreaterThan(0);
    const bridge = Math.min(...(l.solution ?? []).map((b) => b.y));
    for (const m of thorns)
      for (const [x, y] of m.cells) {
        expect(m.look).toBe('thorn');
        expect(solid(l, x, y), 'mounted on rock').toBe(true);
        expect(y).toBeGreaterThan(bridge + 1);
      }
  });

  it("the Sun Gate's two lenses sit at either end of the gate's lintel, never side by side", () => {
    for (const seed of [1, 4]) {
      const l = landmark('sun-gate', seed);
      const lenses = ofType(l, 'flame');
      expect(lenses.length).toBe(2);
      const [a, b] = lenses.map((m) => Math.floor(m.at[0] / TILE));
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(6);
      for (const m of lenses) expect(solid(l, Math.floor(m.at[0] / TILE), Math.floor(m.at[1] / TILE) - 1), 'set in the lintel').toBe(true);
    }
  });
});

describe('the log trap (swinger, head log)', () => {
  const m0: ModuleOf<'swinger'> = {
    type: 'swinger',
    head: 'log',
    hub: [10, 2],
    arm: 4,
    angle0: Math.PI / 2,
    period: 220,
    swing: 1,
    dir: 1,
    radius: 0.8,
    count: 1,
    link: 'rod',
  };
  const pp = {
    uid: 3,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'k',
      name: 'Log Trap',
      maker: 't',
      archetype: 'flail' as const,
      role: 'hazard' as const,
      style: { metal: 'jade' as const, trim: 'none' as const, hue: 0, glowHue: 0, woodHue: 26 },
      motion: { type: 'none' as const },
      modules: [m0],
      footprint: [[10, 2] as [number, number]],
    },
  };
  const r = resolveProp(pp);
  const m = r.mods[0] as ModuleOf<'swinger'>;
  const hurt = (f: number) => {
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    moduleSim('swinger').build!(m, { r, off: [0, 0], prev: [0, 0], frame: f, mi: 0, live: true } as unknown as PropCtx, out);
    return out.hazards;
  };

  it('hurts along the whole log, level at every point of its swing', () => {
    for (let f = 0; f < 220; f += 11) {
      const [h] = hurt(f);
      if (h.kind !== 'rect') throw new Error('a log hurts as a box');
      expect(h.r.w).toBeCloseTo(m.radius * 3.4, 5);
      expect(h.r.w).toBeGreaterThan(h.r.h * 2.5);
      expect(h.r).toEqual(logBox(m, { x: h.r.x + h.r.w / 2, y: h.r.y + h.r.h / 2 }));
    }
  });

  it('swings: its box moves across under the hub and back', () => {
    const xs = Array.from({ length: 44 }, (_, i) => {
      const [h] = hurt(i * 5);
      return h.kind === 'rect' ? h.r.x : 0;
    });
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(m.arm);
  });
});
