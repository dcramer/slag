import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { cycleFrames } from '../src/gen/setpieces/place';
import { ownPieces } from '../src/gen/stage';
import type { Landmark } from '../src/gen/stage/types';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../src/sim/level';
import { type ModuleOf, motionOffset, type PlacedProp, resolveProp } from '../src/sim/props';

/**
 * What the farm's stage concepts (src/gen/stage/farm.ts) and its own hazards do that's theirs alone. The
 * generic contract (scale, footing, two ways past, varies with the seed, the static proof, no free ride,
 * tells) is the conformance suite's (tests/conformance/).
 */

interface Built {
  level: Level;
  landmark: Landmark;
}

function build(id: string, seed: number, size: 'classic' | 'wide'): Built {
  const level = generateLevel(seed, 'farm', { concept: id, size });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return { level, landmark: lastGenInfo.landmark! };
}

const two = (id: string, size: 'classic' | 'wide' = 'classic') => [build(id, 1, size), build(id, 2, 'wide')];
const mods = (pp: PlacedProp) => resolveProp(pp).mods;
const module = <T extends ModuleOf<'rotor'>['type'] | 'swinger' | 'body'>(l: Level, type: T) =>
  ownPieces(l)
    .flatMap(mods)
    .find((m) => m.type === type) as Extract<ReturnType<typeof mods>[number], { type: T }>;

/** The px offsets a lift parks at over a cycle, highest last. */
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

describe('the farm concepts', () => {
  it('the Great Windmill turns big sails over its roof, the lowest a hop above it', () => {
    for (const { level, landmark } of two('great-windmill')) {
      const sails = module(level, 'rotor');
      expect(sails.look).toBe('windmill');
      expect(sails.count).toBeGreaterThanOrEqual(4);
      expect(2 * (sails.arm / TILE + 1.5)).toBeGreaterThanOrEqual(11);
      const [R] = landmark.anchors.roof;
      const gap = R - (sails.hub[1] + sails.arm) / TILE - 0.25;
      expect(gap).toBeGreaterThan(1);
      expect(gap).toBeLessThan(2.5);
    }
  });

  it('the Great Windmill stands its sails (and so its tower) over the middle of its own mill', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { level, landmark } = build('great-windmill', seed, seed % 2 ? 'classic' : 'wide');
      const [mx0, mx1] = landmark.anchors.mill;
      expect(module(level, 'rotor').hub[0] / TILE, `seed ${seed}`).toBeCloseTo((mx0 + mx1 + 1) / 2, 5);
    }
  });

  it('the Grain Elevator parks its lift flush with the ground and the bin tops, and its ladder climbs to them', () => {
    for (const { level, landmark } of two('grain-elevator')) {
      const lift = ownPieces(level).find((p) => p.def.motion.type === 'rail')!;
      const [T, G] = landmark.anchors.top;
      const stops = parks(lift);
      expect(stops[0]).toBe(0);
      expect(stops[stops.length - 1]).toBe(-(G - T) * TILE);
      const [lc] = landmark.anchors.ladder;
      let rungs = 0;
      for (let y = T; y < G; y++) if (tileAt(level, lc, y) === T_ONEWAY) rungs++;
      expect(rungs).toBeGreaterThanOrEqual(Math.floor((G - T) / 4));
      expect(Math.floor(landmark.anchors.layout[0] / 10)).toBeGreaterThanOrEqual(2);
    }
  });

  it('the Big Barn has lofts either side of the mow, something across the mow, and something among the stalls', () => {
    for (const { level, landmark } of two('big-barn')) {
      expect(level.landmark!.skin).toBe('barnboard');
      const [F1] = landmark.anchors.floors;
      const [m0, m1] = landmark.anchors.mow;
      expect(tileAt(level, m0 - 1, F1)).toBe(T_ONEWAY);
      expect(tileAt(level, m1 + 1, F1)).toBe(T_ONEWAY);
      for (let x = m0; x <= m1; x++) expect(tileAt(level, x, F1)).toBe(T_EMPTY);
      const all = ownPieces(level).flatMap(mods);
      expect(all.some((m) => (m.type === 'rotor' && m.look === 'hay') || m.type === 'swinger')).toBe(true);
      expect(all.some((m) => m.type === 'piston' || m.type === 'tesla')).toBe(true);
    }
  });

  it('the Water Mill turns its wheel over the tail race, under the flume, over a runner on the ground', () => {
    for (const { level, landmark } of two('water-mill')) {
      const wheel = module(level, 'rotor');
      expect(wheel.count).toBeGreaterThanOrEqual(6);
      const [rx] = landmark.anchors.race;
      const [G] = landmark.anchors.ground;
      expect(tileAt(level, rx, G)).toBe(T_EMPTY);
      const [fx, R] = landmark.anchors.flume;
      expect(tileAt(level, fx, R)).toBe(T_ONEWAY);
      expect((wheel.hub[1] - wheel.arm) / TILE).toBeGreaterThan(R + 1);
      expect((wheel.hub[1] + wheel.arm) / TILE).toBeLessThan(G - 1.5);
      expect(landmark.anchors.floors[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it('the Combine Run drives its combine and reel together along the field, under the track', () => {
    for (const { level, landmark } of [build('combine-run', 1, 'wide'), build('combine-run', 3, 'wide')]) {
      const combine = ownPieces(level).find((p) => p.def.motion.type === 'rail')!;
      const m = mods(combine);
      const body = m.find((x) => x.type === 'body') as ModuleOf<'body'>;
      expect(m.some((x) => x.type === 'swinger')).toBe(true);
      const motion = combine.def.motion;
      if (motion.type !== 'rail') throw new Error('no rail');
      expect(motion.range).toBeGreaterThanOrEqual(10);
      const [Wk] = landmark.anchors.track;
      expect(Math.min(...body.cells.map(([, y]) => y)) - Wk).toBeGreaterThanOrEqual(3);
      // It drives on the field, never over a pit.
      const [G] = landmark.anchors.ground;
      for (let x = body.cells[0][0]; x <= body.cells[0][0] + motion.range + 6; x++) expect(tileAt(level, x, G)).toBe(T_SOLID);
    }
  });
});

describe("the farm's own hazards", () => {
  const levels = [1, 2, 3, 4, 5, 6].map((seed) => generateLevel(seed, 'farm', { concept: 'plain', hazards: 4, danger: 1 }));
  const named = (k: string) => levels.flatMap((l) => l.setPieces.filter((p) => p.def.key === `setpiece:farm:${k}`).map((pp) => ({ l, pp })));

  it('the hay hook swings its block across a floor, from a jib whose post stands beside the arc', () => {
    const found = named('hay hook');
    expect(found.length).toBeGreaterThan(0);
    for (const { l, pp } of found) {
      const m = mods(pp).find((x) => x.type === 'swinger') as ModuleOf<'swinger'>;
      expect(m.head).toBe('mace');
      const x = Math.floor(m.hub[0] / TILE);
      const y = Math.floor((m.hub[1] + m.arm) / TILE);
      expect(tileAt(l, x, y + 1), 'the block sweeps a floor').not.toBe(T_EMPTY);
    }
  });

  it('the muck spreader flings slow muck and the pumpkin catapult lobs bouncing pumpkins, both arcing', () => {
    const ammo = new Set<string>();
    for (const k of ['muck spreader', 'pumpkin catapult']) {
      const found = named(k);
      expect(found.length, k).toBeGreaterThan(0);
      for (const { pp } of found) for (const m of mods(pp)) if (m.type === 'cannon') ammo.add(m.ammo);
    }
    expect([...ammo].sort()).toEqual(['goo', 'rubber']);
  });
});
