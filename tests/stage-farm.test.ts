import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { setProbeGravity } from '../src/gen/level/probe';
import { rollConcept } from '../src/gen/stage';
import { FARM_CONCEPTS } from '../src/gen/stage/farm';
import type { Landmark } from '../src/gen/stage/types';
import { cycleFrames } from '../src/gen/setpieces/place';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../src/sim/level';
import { type ModuleOf, motionOffset, type PlacedProp, resolveProp } from '../src/sim/props';
import { expectGrounded, expectHung, expectStaticProof, expectVaries, expectWaysThrough, landmarkPieces, waysOf } from './lib/landmark-checks';

/**
 * The farm's stage concepts (src/gen/stage/farm.ts): each appears on its share of farm levels, stands on
 * the ground, keeps two static ways past itself, varies with its seed, and gives no free ride over the
 * pond it owns. The farm's own hazards (live fence, baler, hay hook) hang and stand on real ground and
 * warn before they hurt.
 */

interface Built {
  level: Level;
  landmark: Landmark;
}

function build(id: string, seed: number, size?: 'classic' | 'wide'): Built {
  const level = generateLevel(seed, 'farm', { concept: id, ...(size ? { size } : {}) });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  expect(lastGenInfo.fallback).toBe(false);
  setProbeGravity(level.gravity ?? 1);
  return { level, landmark: lastGenInfo.landmark! };
}

/** Three of each, classic and wide: enough to see the layout move. */
const SAMPLES: Record<string, [number, 'classic' | 'wide' | undefined][]> = {
  'great-windmill': [
    [1, 'classic'],
    [2, 'wide'],
    [3, 'classic'],
  ],
  'grain-elevator': [
    [1, 'classic'],
    [7, 'classic'],
    [8, 'wide'],
  ],
  'big-barn': [
    [1, 'classic'],
    [4, 'wide'],
    [6, 'classic'],
  ],
  'water-mill': [
    [1, 'classic'],
    [2, 'wide'],
    [3, 'classic'],
  ],
  'combine-run': [
    [1, 'wide'],
    [2, 'wide'],
    [3, 'wide'],
  ],
};

const built = new Map<string, Built[]>(Object.entries(SAMPLES).map(([id, s]) => [id, s.map(([seed, size]) => build(id, seed, size))]));
const of = (id: string) => built.get(id)!;
const mods = (pp: PlacedProp) => resolveProp(pp).mods;
const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;

/** The px offsets a lift parks at over a cycle. */
function parks(pp: PlacedProp): number[] {
  const r = resolveProp(pp);
  const P = cycleFrames(r.mods, r.motion);
  const out: number[] = [];
  let run = 0;
  for (let f = 1; f < 2 * P; f++) {
    const y = motionOffset(r, f)[1];
    run = y === motionOffset(r, f - 1)[1] ? run + 1 : 0;
    if (run === 30 && !out.includes(y + 0)) out.push(y + 0);
  }
  return out.sort((a, b) => b - a);
}

describe('farm stage concepts', () => {
  it('there are at least five, and each gets its share of farm levels', () => {
    expect(FARM_CONCEPTS.length).toBeGreaterThanOrEqual(5);
    const seen = new Map<string, number>();
    for (let s = 0; s < 150; s++) {
      const id = rollConcept(s, 'farm', rollProfile(s, 'farm'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const c of FARM_CONCEPTS) expect(seen.get(c.id) ?? 0, c.id).toBeGreaterThan(c.sizes.includes('classic') ? 12 : 5);
    expect(seen.get('plain')).toBeGreaterThan(15);
  });

  for (const c of FARM_CONCEPTS) {
    describe(c.id, () => {
      it('stands on the ground, and everything it hangs hangs from something real', () => {
        for (const { level } of of(c.id)) expectGrounded(level);
      });

      it('keeps two static ways past itself, each enough alone', () => {
        for (const { level, landmark } of of(c.id)) {
          setProbeGravity(level.gravity ?? 1);
          expectWaysThrough(level, waysOf(landmark.anchors));
        }
      });

      it('proves itself without its movers, and none of them is a free ride over its pond', () => {
        for (const { level } of of(c.id)) {
          expectStaticProof(level);
          expect(landmarkPieces(level).length).toBeGreaterThan(0);
        }
      });

      it('is a different building on every seed', () => {
        expectVaries(
          of(c.id).map((b) => b.level),
          (l) => {
            const b = of(c.id).find((x) => x.level === l)!;
            const [p, q] = b.landmark.anchors.layout;
            return { w: l.landmark!.rect.w, h: l.landmark!.rect.h, p, q };
          },
        );
      });
    });
  }

  it('the Great Windmill turns big sails over its roof, the lowest a hop above it', () => {
    for (const { level, landmark } of of('great-windmill')) {
      const sails = landmarkPieces(level)
        .flatMap(mods)
        .find((m) => m.type === 'rotor') as ModuleOf<'rotor'>;
      expect(sails.look).toBe('windmill');
      expect(sails.count).toBeGreaterThanOrEqual(4);
      expect(2 * (sails.arm / TILE + 1.5)).toBeGreaterThanOrEqual(level.w > 48 ? 12 : 10);
      const [R] = landmark.anchors.roof;
      const lowest = sails.hub[1] / TILE + sails.arm / TILE - 0.25;
      expect(R - lowest).toBeGreaterThan(1);
      expect(R - lowest).toBeLessThan(2.5);
    }
  });

  it('the Grain Elevator parks its lift flush with the ground and the bin tops, and its ladder climbs to them', () => {
    for (const { level, landmark } of of('grain-elevator')) {
      const lift = landmarkPieces(level).find((p) => p.def.motion.type === 'rail')!;
      const [T, G] = landmark.anchors.top;
      const stops = parks(lift);
      expect(stops[0]).toBe(0);
      expect(stops[stops.length - 1]).toBe(-(G - T) * TILE);
      const [lc] = landmark.anchors.ladder;
      let rungs = 0;
      for (let y = T; y < G; y++) if (tileAt(level, lc, y) === T_ONEWAY) rungs++;
      expect(rungs).toBeGreaterThanOrEqual(Math.floor((G - T) / 4));
      expect(landmark.anchors.layout[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it('the Big Barn has lofts either side of the mow, something across the mow, and something among the stalls', () => {
    for (const { level, landmark } of of('big-barn')) {
      expect(level.landmark!.skin).toBe('barnboard');
      const [F1] = landmark.anchors.floors;
      const [m0, m1] = landmark.anchors.mow;
      expect(tileAt(level, m0 - 1, F1)).toBe(T_ONEWAY);
      expect(tileAt(level, m1 + 1, F1)).toBe(T_ONEWAY);
      for (let x = m0; x <= m1; x++) expect(tileAt(level, x, F1)).toBe(T_EMPTY);
      const all = landmarkPieces(level).flatMap(mods);
      expect(all.some((m) => (m.type === 'rotor' && m.look === 'hay') || m.type === 'swinger')).toBe(true);
      expect(all.some((m) => m.type === 'piston' || m.type === 'tesla')).toBe(true);
    }
  });

  it('the Water Mill turns its wheel over the tail race under the flume', () => {
    for (const { level, landmark } of of('water-mill')) {
      const wheel = landmarkPieces(level)
        .flatMap(mods)
        .find((m) => m.type === 'rotor') as ModuleOf<'rotor'>;
      expect(wheel.count).toBeGreaterThanOrEqual(6);
      const [rx] = landmark.anchors.race;
      const [G] = landmark.anchors.ground;
      expect(tileAt(level, rx, G)).toBe(T_EMPTY);
      const [fx, R] = landmark.anchors.flume;
      expect(tileAt(level, fx, R)).toBe(T_ONEWAY);
      // Its top passes under the flume; its bottom over a runner's head.
      expect(wheel.hub[1] / TILE - wheel.arm / TILE).toBeGreaterThan(R + 1);
      expect(wheel.hub[1] / TILE + wheel.arm / TILE).toBeLessThan(G - 1.5);
      expect(landmark.anchors.floors[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it('the Combine Run drives its combine and reel together along the field, under the track', () => {
    for (const { level, landmark } of of('combine-run')) {
      const combine = landmarkPieces(level).find((p) => p.def.motion.type === 'rail')!;
      const m = mods(combine);
      expect(m.some((x) => x.type === 'body')).toBe(true);
      expect(m.some((x) => x.type === 'swinger')).toBe(true);
      const motion = combine.def.motion;
      if (motion.type !== 'rail') throw new Error('no rail');
      expect(motion.range).toBeGreaterThanOrEqual(10);
      const [Wk] = landmark.anchors.track;
      const top = Math.min(...(m.find((x) => x.type === 'body') as ModuleOf<'body'>).cells.map(([, y]) => y));
      expect(top - Wk).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the farm's own hazards", () => {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateLevel(seed, 'farm', { concept: 'plain', hazards: 4, danger: 1 }));
  const named = (k: string) => levels.flatMap((l) => l.setPieces.filter((p) => p.def.key === `setpiece:farm:${k}`).map((pp) => ({ l, pp })));

  it('a live fence, a baler and a hay hook each appear, stand or hang on something real, and warn first', () => {
    for (const k of ['electric fence', 'baler', 'hay hook']) {
      const found = named(k);
      expect(found.length, k).toBeGreaterThan(0);
      for (const { l, pp } of found) {
        expectHung(l, pp);
        for (const m of mods(pp)) {
          if (m.type === 'tesla') expect(m.warn).toBeGreaterThanOrEqual(30);
          // The baler's tell is the lamp on its housing, which lights as the ram winds up.
          if (m.type === 'piston') expect(mods(pp).some((d) => d.type === 'deco' && d.kind === 'press')).toBe(true);
          if (m.type === 'swinger') {
            const x = Math.floor(m.hub[0] / TILE);
            const y = Math.floor((m.hub[1] + m.arm) / TILE);
            expect(solid(l, x, y + 1) || tileAt(l, x, y + 1) === T_ONEWAY, 'the hook sweeps a floor').toBe(true);
          }
        }
      }
    }
  });

  it('none of them cuts the plan or gives a free ride', () => {
    for (const l of levels) expectStaticProof(l);
  });
});
