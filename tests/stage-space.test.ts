import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { hazardSignature, SET_PIECES } from '../src/gen/setpieces';
import { rollConcept } from '../src/gen/stage';
import { waysOf } from '../src/gen/stage/volcano';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import { type Module, type ModuleOf, resolveProp } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * Space's stage concepts (src/gen/stage/space.ts) and its own hazards, as space behaviour: each way past a
 * landmark is a real alternative, the landmark floats, and space's hazards do what they're for where they
 * stand. What every landmark owes (scale, ways through, a layout that varies, the static proof, no free ride,
 * tells) is held by tests/conformance.
 */

const IDS = ['starship', 'ring-station', 'planetoid', 'launch-gantry', 'mining-rig'];

function landmark(id: string, seed: number): Level {
  const l = generateLevel(seed, 'space', { concept: id, size: id === 'planetoid' ? 'wide' : 'classic' });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const mods = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`)).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

describe('space stage concepts', () => {
  it('each gets its share of space levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'space', rollProfile(s, 'space'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of IDS) expect(seen.get(id) ?? 0, id).toBeGreaterThan(10);
    expect(seen.get('plain') ?? 0).toBeGreaterThan(30);
  });

  it('every way past a landmark is a real alternative: shut either and the flag is still reached', () => {
    for (const id of IDS) {
      const l = landmark(id, 1);
      const shut = waysOf(lastGenInfo.landmark!);
      expect(shut.length, id).toBe(2);
      for (const r of shut) {
        const tiles = new Uint8Array(l.tiles);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * l.w + x] === T_EMPTY) tiles[y * l.w + x] = T_SOLID;
        const reach = analyzeReach(withBridges({ ...l, tiles, setPieces: [] }, l.solution ?? []));
        expect(reach.goalReached, `${id} with ${JSON.stringify(r)} shut`).toBe(true);
      }
    }
  });

  it('floats: nothing under a landmark but the void', () => {
    for (const id of IDS) {
      const l = landmark(id, 2);
      const r = l.landmark!.rect;
      for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y + r.h; y < l.h; y++) expect(tileAt(l, x, y), `${id} ${x},${y}`).not.toBe(T_SOLID);
    }
  });

  it('the Ring Station spins its saws round the hub down to the floor, and the Planetoid has a moon', () => {
    const ring = landmark('ring-station', 1);
    const [saws] = ofType(ring, 'swinger');
    expect(saws.head).toBe('saw');
    const D = lastGenInfo.landmark!.anchors.deck[0];
    // Low enough to catch a runner on the floor, high enough never to cut into it.
    expect(saws.hub[1] + saws.arm + saws.radius).toBeGreaterThan((D - 1) * TILE);
    expect(saws.hub[1] + saws.arm + saws.radius).toBeLessThanOrEqual(D * TILE);
    const planet = landmark('planetoid', 1);
    const [moon] = ofType(planet, 'rotor');
    expect(moon.look).toBe('moon');
    expect(moon.swing).toBe(0);
  });
});

describe("space's own hazards", () => {
  const plain = (seed: number) => ({ ...generateLevel(seed, 'space', { concept: 'plain', size: 'classic' }), setPieces: [] });
  const place = (name: string) => {
    for (let s = 1; s < 8; s++) {
      const level = plain(s);
      for (let k = 0; k < 6; k++) {
        const got = SET_PIECES.space(new Rng(k * 31 + s), level, { count: 1, family: [name] });
        if (got.length) return { level, pp: got[0] };
      }
    }
    throw new Error(`${name} never placed`);
  };

  it('a meteor shower drops burning rocks on a slant from high in the sky', () => {
    const { pp } = place('meteor shower');
    const guns = resolveProp(pp).mods.filter((m): m is ModuleOf<'cannon'> => m.type === 'cannon');
    expect(guns.length).toBeGreaterThanOrEqual(2);
    for (const g of guns) {
      expect(g.ammo).toBe('meteor');
      expect(g.at[1] / TILE).toBeLessThan(4);
      expect(Math.sin(g.angle)).toBeGreaterThan(0.3);
      expect(Math.abs(Math.cos(g.angle))).toBeGreaterThan(0.1);
    }
  });

  it('an airlock throws you out, not in, and stands clear of the crossings', () => {
    const { level, pp } = place('airlock');
    const m = resolveProp(pp).mods.find((x): x is ModuleOf<'magnet'> => x.type === 'magnet')!;
    expect(m.polarity).toBe(-1);
    expect(hazardSignature([m])).toEqual(['magnet:pushes']);
    for (const b of level.solution ?? []) expect(Math.abs(m.at[0] / TILE - (b.x + 1))).toBeGreaterThan(m.radius / TILE);
  });

  it('fuel cells stand on a deck and light when landed on', () => {
    const { level, pp } = place('fuel cells');
    const m = resolveProp(pp).mods.find((x): x is ModuleOf<'fuse'> => x.type === 'fuse')!;
    expect(m.trigger).toBe('land');
    for (const [x, y] of m.cells) expect(tileAt(level, x, y + 1)).toBe(T_SOLID);
  });
});
