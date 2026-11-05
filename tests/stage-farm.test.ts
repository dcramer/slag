import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { MIN_TELL, SET_PIECES } from '../src/gen/setpieces';
import { cycleFrames } from '../src/gen/setpieces/place';
import { ownPieces } from '../src/gen/stage';
import type { Landmark } from '../src/gen/stage/types';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../src/sim/level';
import { driveAt, type ModuleOf, motionOffset, type PlacedProp, resolveProp, swingAngles } from '../src/sim/props';

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

describe('the combine', () => {
  // Placed alone on plain farm levels, as the conformance suite places a recipe: seeds whose wide farm has the long field it needs.
  const found = [3, 21, 33, 35].flatMap((seed) => {
    const level: Level = { ...generateLevel(seed, 'farm', { concept: 'plain', size: 'wide' }), setPieces: [] };
    for (let k = 0; k < 6; k++) {
      const [pp] = SET_PIECES.farm(new Rng(k * 7919 + seed), level, { count: 1, family: ['combine'] });
      if (pp) return [{ level, pp }];
    }
    return [];
  });
  const parts = (pp: PlacedProp) => {
    const r = resolveProp(pp);
    return { r, body: r.mods.find((m) => m.type === 'body') as ModuleOf<'body'>, reel: r.mods.find((m) => m.type === 'swinger') as ModuleOf<'swinger'> };
  };

  it('drives a run of ground with its reel out front, toward where it parks first', () => {
    expect(found.length).toBeGreaterThanOrEqual(2);
    for (const { level, pp } of found) {
      const { r, body, reel } = parts(pp);
      const motion = r.motion;
      if (motion.type !== 'rail') throw new Error('no rail');
      // Cells in tiles, the hub and the rail in px.
      const xs = body.cells.map(([x]) => x);
      const [x0, x1] = [Math.min(...xs), Math.max(...xs) + 1];
      const G = Math.max(...body.cells.map(([, y]) => y)) + 1;
      const face = reel.hub[0] / TILE < x0 ? -1 : 1;
      expect(reel.hub[0] / TILE < x0 || reel.hub[0] / TILE > x1).toBe(true);
      // It backs away from its reel first: the rail runs from the reel's end.
      expect(Math.sign(Math.cos(motion.angle))).toBe(-face);
      const travel = motion.range / TILE;
      const lo = face < 0 ? x0 : x0 - travel;
      for (let x = lo; x < lo + (x1 - x0) + travel; x++) expect(tileAt(level, x, G), `ground under column ${x}`).not.toBe(T_EMPTY);
    }
  });

  it('idles its reel while parked and revs it up for at least MIN_TELL frames before every pull-away', () => {
    for (const { pp } of found) {
      const { r, reel } = parts(pp);
      const drive = reel.drive!;
      const P = cycleFrames(r.mods, r.motion);
      // The reel's turn this frame, in frames of full speed.
      const step = (f: number) => Math.abs(swingAngles(reel, f, r.phase)[0] - swingAngles(reel, f - 1, r.phase)[0]) / ((2 * Math.PI) / reel.period);
      let pulls = 0;
      for (let f = 1; f < 2 * P; f++) {
        const now = driveAt(drive, f, r.phase);
        const before = driveAt(drive, f - 1, r.phase);
        // The machine only moves while the drive says so, its reel at full speed.
        if (motionOffset(r, f)[0] !== motionOffset(r, f - 1)[0]) expect(now.moving || before.moving, `frame ${f}`).toBe(true);
        if (now.moving && before.moving) expect(step(f)).toBeCloseTo(1, 6);
        if (!now.moving && !before.moving && now.rev === 0 && before.rev === 0) expect(step(f)).toBeCloseTo(drive.idle, 6);
        if (now.moving && !before.moving) {
          pulls++;
          for (let j = 1; j <= MIN_TELL; j++) {
            const w = driveAt(drive, f - j, r.phase);
            expect(w.moving).toBe(false);
            expect(w.rev, `${j} frames before pulling away`).toBeGreaterThan(0);
            expect(step(f - j)).toBeGreaterThan(drive.idle);
          }
        }
      }
      expect(pulls).toBeGreaterThanOrEqual(2);
    }
  });
});
