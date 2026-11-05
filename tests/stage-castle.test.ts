import { describe, expect, it } from 'vitest';
import { dcos, dsin } from '../src/core/dmath';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { BELFRY, bridgeGaps } from '../src/gen/stage/castle-keep';
import { waysOf } from '../src/gen/stage/kit';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import { type Module, type ModuleOf, resolveProp, swingHeads } from '../src/sim/props';
import { floodState } from '../src/sim/props/modules/flood';
import { analyzeReach } from '../src/sim/reach';

/**
 * The castle's newer stage concepts (src/gen/stage/castle-keep.ts) as castle behaviour: each way past a
 * landmark is a real alternative, and its pieces do what they're for where they stand. What every landmark
 * owes (scale, footing, ways, a layout that varies, the static proof, no free ride, tells) is held by
 * tests/conformance; the Haunted Wing and the Throne Hall are in tests/castle-concepts.test.ts.
 */

const IDS = ['gatehouse', 'bell-tower', 'boss-bridge'];

function landmark(id: string, seed: number, size: 'classic' | 'wide' = 'classic'): Level {
  const l = generateLevel(seed, 'castle', { concept: id, size });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;
const mods = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`)).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);
/** Where a swinger's head is over one full period (world px), every few frames. */
const sweep = (m: ModuleOf<'swinger'>) => Array.from({ length: Math.ceil(m.period / 3) }, (_, i) => swingHeads(m, i * 3, 0, [0, 0])[0]);

describe('castle stage concepts', () => {
  it('each gets its share of castle levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'castle', rollProfile(s, 'castle'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of IDS) expect(seen.get(id) ?? 0, id).toBeGreaterThan(15);
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

  it("the Gatehouse's portcullis hangs in its vault and slams to the passage floor, and its murder holes pour onto it", () => {
    for (const seed of [1, 3]) {
      const l = landmark('gatehouse', seed);
      const gates = ofType(l, 'dropper');
      expect(gates.length).toBeGreaterThan(0);
      for (const m of gates) {
        expect(m.look).toBe('portcullis');
        const top = Math.min(...m.cells.map(([, y]) => y));
        const bottom = Math.max(...m.cells.map(([, y]) => y));
        for (const [x] of m.cells) {
          expect(solid(l, x, top - 1), 'hung from the vault').toBe(true);
          // One row of passage under it at rest: a runner walks under; it comes down onto the floor.
          expect(solid(l, x, bottom + 1)).toBe(false);
          expect(solid(l, x, bottom + 1 + m.reach)).toBe(true);
        }
      }
      for (const f of ofType(l, 'flame')) {
        expect(f.angle).toBeCloseTo(Math.PI / 2);
        const x = Math.floor(f.at[0] / TILE);
        expect(solid(l, x, Math.floor(f.at[1] / TILE) - 1), 'out of the vault').toBe(true);
        expect(solid(l, x, Math.ceil((f.at[1] + f.length) / TILE)), 'onto the floor').toBe(true);
        expect(f.warn).toBeGreaterThanOrEqual(18);
      }
    }
  });

  it("the Bell Tower's bell swings in its belfry, out of its walls and roof, and through anyone walking under it", () => {
    for (const seed of [1, 2]) {
      const l = landmark('bell-tower', seed);
      const [bell] = ofType(l, 'swinger');
      expect(bell.swing).toBeGreaterThan(0);
      const r = bell.radius * 0.8;
      const hubY = Math.floor(bell.hub[1] / TILE);
      // The pin sits under the belfry's roof.
      expect(solid(l, Math.floor(bell.hub[0] / TILE), hubY - 1)).toBe(true);
      const floor = hubY + BELFRY;
      let low = -Infinity;
      for (const h of sweep(bell)) {
        // Never into the roof over it or the floor under it.
        expect(h.y - r).toBeGreaterThan(hubY * TILE);
        expect(h.y + r).toBeLessThan(floor * TILE);
        low = Math.max(low, h.y + r);
      }
      // At the bottom of its swing it reaches into a standing runner's head.
      expect(low).toBeGreaterThan(floor * TILE - 14 + 2);
    }
  });

  it("the Boss Bridge's firebars turn clear of the walkway and the keeps, and sweep the bridge under them", () => {
    for (const [seed, size] of [
      [1, 'classic'],
      [2, 'wide'],
    ] as const) {
      const l = landmark('boss-bridge', seed, size);
      const anchors = lastGenInfo.landmark!.anchors;
      const [t0, t1] = anchors.trench;
      const [U] = anchors.hall;
      const [G] = anchors.ground;
      const bars = ofType(l, 'swinger');
      expect(bars.length).toBeGreaterThan(1);
      let low = -Infinity;
      for (const m of bars) {
        expect(m.swing, 'a full turn').toBe(0);
        const r = m.radius * 0.85;
        for (const h of sweep(m)) {
          expect(h.y - r, 'under the walkway').toBeGreaterThan((U + 1) * TILE);
          expect(h.x - r, 'clear of the front keep').toBeGreaterThan(t0 * TILE);
          expect(h.x + r, 'clear of the back keep').toBeLessThan((t1 + 1) * TILE);
          low = Math.max(low, h.y + r);
        }
      }
      expect(low, 'through a runner on the bridge').toBeGreaterThan(G * TILE - 14 + 2);
      // A firebar's balls all lie along one arm.
      const hub = bars[0].hub;
      for (const m of bars.filter((b) => b.hub[0] === hub[0] && b.hub[1] === hub[1])) {
        expect(m.angle0).toBe(bars[0].angle0);
        const [h] = swingHeads(m, 37, 0, [0, 0]);
        expect(Math.abs(h.x - hub[0] - dcos(h.a) * m.arm)).toBeLessThan(1e-6);
        expect(Math.abs(h.y - hub[1] - dsin(h.a) * m.arm)).toBeLessThan(1e-6);
      }
    }
  });

  it("the Boss Bridge's lava rises and falls in the trench, never up to the bridge, and its gaps drop into it", () => {
    for (const seed of [1, 3]) {
      const l = landmark('boss-bridge', seed);
      const [G] = lastGenInfo.landmark!.anchors.ground;
      const [lava] = ofType(l, 'flood');
      expect(lava.look).toBe('lava');
      let lo = Infinity;
      let hi = -Infinity;
      for (let f = 0; f < 1200; f += 5) {
        const h = floodState(lava, f, 0).height;
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      expect(hi).toBeGreaterThan(lo);
      // Its crest stays a row under the bridge.
      expect(lava.at[1] - hi).toBeGreaterThan((G + 1) * TILE - 1);
      for (const [x, w] of bridgeGaps(lastGenInfo.landmark!))
        for (let c = x; c < x + w; c++) for (let y = G; y < l.h; y++) expect(solid(l, c, y), `gap ${c},${y}`).toBe(false);
    }
  });
});
